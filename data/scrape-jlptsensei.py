#!/usr/bin/env python3
"""
Scrape JLPTsensei grammar pages for N5/N4.
Extracts: title, romaji, meaning, explanation, example sentences (ja/romaji/en).
"""
import json, re, time, sys, os
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError
import html as htmlmod

BASE_DIR = '/home/noman/resume/jlpt-dashboard/data'


def fetch_page(url, retries=3):
    headers = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'}
    for attempt in range(retries + 1):
        try:
            req = Request(url, headers=headers)
            with urlopen(req, timeout=20) as resp:
                return resp.read().decode('utf-8', errors='replace')
        except Exception as e:
            if attempt < retries:
                time.sleep(2 * (attempt + 1))
            else:
                print(f"  FAILED: {url} -> {e}", file=sys.stderr)
                return None


def strip_tags(text):
    text = re.sub(r'<[^>]+>', '', text)
    return htmlmod.unescape(text).strip()


def extract_text_segments(html_chunk):
    """Extract text segments from HTML by splitting on tags."""
    segments = []
    for part in html_chunk.split('>'):
        text = part.split('<')[0].strip()
        if text and len(text) > 1:
            segments.append(text)
    return segments


def parse_grammar_page(raw_html, url, default_level=''):
    """Parse a single JLPTsensei grammar detail page."""
    result = {
        'url': url,
        'title': '',
        'romaji': '',
        'meaning': '',
        'explanation': '',
        'structure': '',
        'examples': [],
        'level': default_level,
    }

    # ── Title + Romaji from <title> tag ──
    # Format: "N5 Grammar: だ・です (da / desu) Learn Japanese | JLPT Sensei"
    tm = re.search(r'<title>([^<]+)</title>', raw_html)
    if tm:
        raw_title = strip_tags(tm.group(1))
        # Try "Grammar: TITLE (ROMAJI) ..."
        gm = re.search(r'Grammar:\s*(.+?)\s*(?:Learn|–|\|)', raw_title)
        if gm:
            full = gm.group(1).strip()
            # Check for parenthesized romaji
            pm = re.match(r'(.+?)\s*\(([^)]+)\)\s*(.*)', full)
            if pm:
                result['title'] = pm.group(1).strip()
                result['romaji'] = pm.group(2).strip()
            else:
                result['title'] = full
        # Also try: "JLPT N4 Grammar: ば (ba) Conditional Form"
        gm2 = re.search(r'JLPT\s+N\d\s+Grammar:\s*(.+?)\s*(?:Learn|–|\|)', raw_title)
        if gm2 and not result['title']:
            full = gm2.group(1).strip()
            pm = re.match(r'(.+?)\s*\(([^)]+)\)\s*(.*)', full)
            if pm:
                result['title'] = pm.group(1).strip()
                result['romaji'] = pm.group(2).strip()
            else:
                result['title'] = full

    # ── Level ──
    lm = re.search(r'Level:\s*<a[^>]*>JLPT\s+(N\d)', raw_html)
    if lm:
        result['level'] = lm.group(1)
    elif not result['level']:
        lm2 = re.search(r'(?:JLPT\s+)?(N[45])', raw_html[:5000])
        if lm2:
            result['level'] = lm2.group(1)

    # ── Meaning from og:description ──
    og = re.search(r'property="og:description"\s+content="([^"]+)"', raw_html)
    if not og:
        og = re.search(r'content="([^"]+)"\s+property="og:description"', raw_html)
    if og:
        desc = og.group(1)
        mm = re.search(r'Meaning:\s*(.+?)\.', desc)
        if mm:
            result['meaning'] = mm.group(1).strip()

    # ── Explanation: Main body text after "Learn Japanese grammar:" ──
    learn_match = re.search(r'Learn Japanese grammar[^<]*', raw_html)
    if learn_match:
        # Get text chunk from here until examples section
        start = learn_match.start()
        # Find where examples begin
        examples_start = raw_html.find('Example #1', start)
        flashcard_start = raw_html.find('Click the image to download', start)
        end = min(
            examples_start if examples_start > start else start + 8000,
            flashcard_start if flashcard_start > start else start + 8000
        )
        chunk = raw_html[start:end]
        text = strip_tags(chunk)
        text = re.sub(r'\s+', ' ', text).strip()
        # Remove leading boilerplate
        text = re.sub(r'^Learn Japanese grammar[^.]*\.\s*(?:Meaning:[^.]*\.\s*)?', '', text)
        text = re.sub(r'\{["\']@context.*$', '', text)
        text = text.strip()
        if len(text) > 800:
            text = text[:797] + '...'
        if len(text) > 20:
            result['explanation'] = text

    # ── Structure from "Standard format" or how-to section ──
    struct_m = re.search(r'Standard format:\s*(.+?)(?:\n|<)', raw_html)
    if struct_m:
        result['structure'] = strip_tags(struct_m.group(1)).strip()

    # ── Examples: Parse "Example #N" blocks ──
    # HTML structure per example:
    #   <h5>Example #1</h5>
    #   <div class="...example-main"><p class="m-0 jp">Text<span class=color>grammar</span>Rest</p></div>
    #   <div class="collapse...example_ja..."><div>furigana reading</div></div>
    #   <div class="collapse...example_roma..."><div>romaji</div></div>
    #   <div class="collapse..."><div>English translation</div></div>
    example_positions = [(m.start(), m.group(1)) for m in re.finditer(r'<h5[^>]*>\s*Example\s*#(\d+)\s*</h5>', raw_html)]

    for idx, (pos, ex_num) in enumerate(example_positions[:8]):  # Max 8 examples
        # Get chunk for this example (until next example or end)
        end_pos = example_positions[idx + 1][0] if idx + 1 < len(example_positions) else pos + 3000
        chunk = raw_html[pos:end_pos]

        # ── Japanese sentence: extract from <p class="m-0 jp">...</p> ──
        # strip_tags preserves all text including <span class=color> content
        jp_match = re.search(r'<p class="m-0 jp">(.*?)</(?:p|div)>', chunk, re.DOTALL)
        ja_sentence = ''
        if jp_match:
            ja_sentence = strip_tags(jp_match.group(1)).strip()
            if ja_sentence and not ja_sentence.endswith(('。', '？', '！', '?', '!')):
                ja_sentence += '。'

        # ── Romaji & English: from collapse divs ──
        # Pattern: 3 collapse divs per example:
        #   1st (example_ja): furigana hint
        #   2nd (example_roma): romaji
        #   3rd: English translation
        collapse_divs = re.findall(
            r'<div\s+class="collapse[^"]*"[^>]*>\s*<div[^>]*>(.*?)</div>',
            chunk, re.DOTALL
        )

        romaji_text = ''
        en_text = ''

        if len(collapse_divs) >= 3:
            # 2nd collapse = romaji, 3rd = English
            romaji_text = strip_tags(collapse_divs[1]).strip()
            en_text = strip_tags(collapse_divs[2]).strip()
        elif len(collapse_divs) == 2:
            # Some may only have 2: romaji + English
            romaji_text = strip_tags(collapse_divs[0]).strip()
            en_text = strip_tags(collapse_divs[1]).strip()

        # Clean up
        if romaji_text and not romaji_text.endswith('.'):
            romaji_text += '.'
        if en_text and not en_text.endswith('.'):
            en_text += '.'

        if ja_sentence and en_text:
            result['examples'].append({
                'ja': ja_sentence.strip(),
                'romaji': romaji_text.strip() if romaji_text else '',
                'en': en_text.strip(),
            })

    # Keep at most 4 examples
    result['examples'] = result['examples'][:4]
    return result


def scrape_grammar_list_urls(list_url, level):
    """Scrape all grammar point URLs from a JLPTsensei grammar list page (handles pagination)."""
    urls = []
    page_num = 1

    while True:
        paged_url = list_url if page_num == 1 else f"{list_url}page/{page_num}/"
        print(f"  Fetching list page {page_num}: {paged_url}")
        html = fetch_page(paged_url)
        if not html:
            break

        # Extract grammar point links
        # Pattern: <a href="https://jlptsensei.com/learn-japanese-grammar/...">
        page_urls = re.findall(
            r'href="(https://jlptsensei\.com/learn-japanese-grammar/[^"]+meaning[^"]*)"',
            html
        )
        # Deduplicate while preserving order
        seen = set()
        for u in page_urls:
            clean = u.rstrip('/')
            if clean not in seen:
                seen.add(clean)
                urls.append((clean + '/', level))

        # Check if there's a next page
        if f'page/{page_num + 1}/' in html:
            page_num += 1
            time.sleep(0.5)
        else:
            break

    return urls


def main():
    # ── Step 1: Collect all grammar page URLs ──
    print("=== Collecting Grammar URLs ===")
    all_urls = []

    # Read existing URL files
    for fname, level in [('jlptsensei-n5-urls.txt', 'N5'), ('jlptsensei-n4-urls.txt', 'N4')]:
        fpath = os.path.join(BASE_DIR, fname)
        if os.path.exists(fpath):
            with open(fpath) as f:
                for line in f:
                    url = line.strip().split('#')[0].strip()
                    if url:
                        all_urls.append((url, level))
            print(f"  Loaded {len([u for u, l in all_urls if l == level])} {level} URLs from {fname}")

    # Optionally scrape more from list pages (if URL files are small)
    if len(all_urls) < 80:
        print("  URL files seem small, scraping list pages...")
        n5_urls = scrape_grammar_list_urls('https://jlptsensei.com/jlpt-n5-grammar-list/', 'N5')
        n4_urls = scrape_grammar_list_urls('https://jlptsensei.com/jlpt-n4-grammar-list/', 'N4')
        all_urls = n5_urls + n4_urls

    # Deduplicate
    seen_urls = set()
    unique_urls = []
    for url, level in all_urls:
        norm = url.rstrip('/')
        if norm not in seen_urls:
            seen_urls.add(norm)
            unique_urls.append((url, level))

    print(f"\nTotal unique URLs: {len(unique_urls)}")

    # ── Step 2: Scrape each page ──
    print("\n=== Scraping Grammar Pages ===")
    results = []
    for i, (url, level) in enumerate(unique_urls):
        slug = url.rstrip('/').split('/')[-1][:50]
        print(f"  [{i+1}/{len(unique_urls)}] {slug}")

        page = fetch_page(url)
        if page:
            data = parse_grammar_page(page, url, level)
            results.append(data)
            ex_count = len(data['examples'])
            expl = '✓' if data['explanation'] else '✗'
            meaning = '✓' if data['meaning'] else '✗'
            print(f"    → {data['title']} ({data['romaji']}) meaning:{meaning} expl:{expl} ex:{ex_count}")
        time.sleep(0.4)

    # ── Step 3: Save results ──
    out = os.path.join(BASE_DIR, 'jlptsensei-scraped.json')
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    # Stats
    w_meaning = sum(1 for r in results if r['meaning'])
    w_expl = sum(1 for r in results if r['explanation'])
    w_ex = sum(1 for r in results if r['examples'])
    tot_ex = sum(len(r['examples']) for r in results)

    print(f"\n=== Done! ===")
    print(f"  Total scraped: {len(results)} pages")
    print(f"  With meaning:     {w_meaning}/{len(results)}")
    print(f"  With explanation:  {w_expl}/{len(results)}")
    print(f"  With examples:    {w_ex}/{len(results)} ({tot_ex} total examples)")
    print(f"  Saved to: {out}")

    # Also save URL files if they were regenerated
    n5_urls_scraped = [r['url'] for r in results if r['level'] == 'N5']
    n4_urls_scraped = [r['url'] for r in results if r['level'] == 'N4']
    if len(n5_urls_scraped) > 40:
        with open(os.path.join(BASE_DIR, 'jlptsensei-n5-urls.txt'), 'w') as f:
            f.write('\n'.join(n5_urls_scraped) + '\n')
    if len(n4_urls_scraped) > 40:
        with open(os.path.join(BASE_DIR, 'jlptsensei-n4-urls.txt'), 'w') as f:
            f.write('\n'.join(n4_urls_scraped) + '\n')


if __name__ == '__main__':
    main()
