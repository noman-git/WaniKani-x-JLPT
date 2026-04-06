#!/usr/bin/env python3
"""
Full enrichment pipeline: Scrape ALL JLPTsensei grammar pages and merge into grammar-seed.json.

Steps:
  1. Scrape grammar list pages (with pagination) to get all detail URLs
  2. Scrape each detail page for meaning, explanation, structure, examples
  3. Fuzzy-match scraped data to seed slugs
  4. Merge into grammar-seed.json

Usage:
  python3 enrich-full.py              # Full run
  python3 enrich-full.py --match-only # Skip scraping, use existing jlptsensei-scraped.json
"""
import json, re, time, sys, os, unicodedata
from urllib.request import urlopen, Request
from urllib.parse import unquote
from urllib.error import HTTPError, URLError
import html as htmlmod
from difflib import SequenceMatcher

BASE_DIR = '/home/noman/resume/jlpt-dashboard/data'
SEED_FILE = os.path.join(BASE_DIR, 'grammar-seed.json')
SCRAPED_FILE = os.path.join(BASE_DIR, 'jlptsensei-scraped.json')


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  HTTP + HTML helpers
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Scrape grammar list pages (with pagination)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def scrape_grammar_list_urls(list_url, level):
    """Scrape all grammar point URLs from a JLPTsensei grammar list page."""
    urls = []
    page_num = 1
    while True:
        paged_url = list_url if page_num == 1 else f"{list_url}page/{page_num}/"
        print(f"  Fetching list page {page_num}: {paged_url}")
        html = fetch_page(paged_url)
        if not html:
            break

        # Extract grammar point links
        page_urls = re.findall(
            r'href="(https://jlptsensei\.com/learn-japanese-grammar/[^"]+)"',
            html
        )
        seen = set()
        for u in page_urls:
            clean = u.rstrip('/')
            if clean not in seen and 'page/' not in clean.split('grammar/')[-1]:
                seen.add(clean)
                urls.append((clean + '/', level))

        if f'page/{page_num + 1}/' in html:
            page_num += 1
            time.sleep(0.5)
        else:
            break
    return urls


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Parse a single grammar page
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def parse_grammar_page(raw_html, url, default_level=''):
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
    tm = re.search(r'<title>([^<]+)</title>', raw_html)
    if tm:
        raw_title = strip_tags(tm.group(1))
        # Try "Grammar: TITLE (ROMAJI) ..."
        gm = re.search(r'Grammar:\s*(.+?)\s*(?:Learn|–|\|)', raw_title)
        if gm:
            full = gm.group(1).strip()
            pm = re.match(r'(.+?)\s*\(([^)]+)\)\s*(.*)', full)
            if pm:
                result['title'] = pm.group(1).strip()
                result['romaji'] = pm.group(2).strip()
            else:
                result['title'] = full
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

    # ── Explanation ──
    learn_match = re.search(r'Learn Japanese grammar[^<]*', raw_html)
    if learn_match:
        start = learn_match.start()
        examples_start = raw_html.find('Example #1', start)
        flashcard_start = raw_html.find('Click the image to download', start)
        end = min(
            examples_start if examples_start > start else start + 8000,
            flashcard_start if flashcard_start > start else start + 8000
        )
        chunk = raw_html[start:end]
        text = strip_tags(chunk)
        text = re.sub(r'\s+', ' ', text).strip()
        text = re.sub(r'^Learn Japanese grammar[^.]*\.\s*(?:Meaning:[^.]*\.\s*)?', '', text)
        text = re.sub(r'\{["\']@context.*$', '', text)
        text = text.strip()
        if len(text) > 800:
            text = text[:797] + '...'
        if len(text) > 20:
            result['explanation'] = text

    # ── Structure ──
    struct_m = re.search(r'Standard format:\s*(.+?)(?:\n|<)', raw_html)
    if struct_m:
        result['structure'] = strip_tags(struct_m.group(1)).strip()

    # ── Examples ──
    example_positions = [(m.start(), m.group(1)) for m in re.finditer(r'<h5[^>]*>\s*Example\s*#(\d+)\s*</h5>', raw_html)]
    for idx, (pos, ex_num) in enumerate(example_positions[:8]):
        end_pos = example_positions[idx + 1][0] if idx + 1 < len(example_positions) else pos + 3000
        chunk = raw_html[pos:end_pos]

        jp_match = re.search(r'<p class="m-0 jp">(.*?)</(?:p|div)>', chunk, re.DOTALL)
        ja_sentence = ''
        if jp_match:
            ja_sentence = strip_tags(jp_match.group(1)).strip()
            if ja_sentence and not ja_sentence.endswith(('。', '？', '！', '?', '!')):
                ja_sentence += '。'

        collapse_divs = re.findall(
            r'<div\s+class="collapse[^"]*"[^>]*>\s*<div[^>]*>(.*?)</div>',
            chunk, re.DOTALL
        )

        romaji_text = ''
        en_text = ''
        if len(collapse_divs) >= 3:
            romaji_text = strip_tags(collapse_divs[1]).strip()
            en_text = strip_tags(collapse_divs[2]).strip()
        elif len(collapse_divs) == 2:
            romaji_text = strip_tags(collapse_divs[0]).strip()
            en_text = strip_tags(collapse_divs[1]).strip()

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

    result['examples'] = result['examples'][:4]
    return result


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Fuzzy matching: scraped → seed
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def normalize_jp(text):
    """Normalize Japanese text for matching: strip whitespace, punctuation, variants."""
    text = text.strip()
    text = re.sub(r'[\s・/／・～〜\-]+', '', text)
    text = re.sub(r'[（(][^）)]*[）)]', '', text)  # remove parenthesized notes
    text = text.replace('～', '').replace('〜', '')
    return text


def normalize_romaji(text):
    """Normalize romaji for matching."""
    text = text.lower().strip()
    text = re.sub(r'[\s\-_/~]+', '', text)
    text = re.sub(r'\([^)]*\)', '', text)
    return text


def similarity(a, b):
    """Quick similarity score between two strings."""
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


def url_to_romaji_parts(url):
    """Extract romaji parts from a JLPTsensei URL slug."""
    slug = unquote(url.rstrip('/').split('/')[-1])
    slug = re.sub(r'-meaning.*$', '', slug)
    parts = re.findall(r'[a-z][a-z]+', slug)
    return parts


def match_scraped_to_seed(scraped_data, seed_points):
    """Match scraped JLPTsensei entries to seed grammar points.
    
    Uses multi-signal matching:
    1. Title exact/substring match
    2. Romaji similarity + exact match bonuses
    3. URL-extracted romaji vs seed slug romaji
    4. Meaning similarity
    5. Containment bonuses (seed title in scraped title or vice versa)
    
    Returns dict: seed_slug -> (scraped_entry, score)
    """
    matches = {}
    unmatched_scraped = []
    
    # For each scraped entry, find the best matching seed point
    for sc in scraped_data:
        sc_title_norm = normalize_jp(sc.get('title', ''))
        sc_romaji_norm = normalize_romaji(sc.get('romaji', ''))
        sc_meaning = sc.get('meaning', '').lower().strip()
        sc_level = sc.get('level', '')
        sc_url_romaji = url_to_romaji_parts(sc.get('url', ''))
        
        best_slug = None
        best_score = 0.0
        
        for p in seed_points:
            # Only match within same level
            if sc_level and p.get('jlptLevel', '') and sc_level != p['jlptLevel']:
                continue
            
            p_title_norm = normalize_jp(p.get('title', ''))
            p_romaji_norm = normalize_romaji(p.get('titleRomaji', ''))
            p_meaning = p.get('meaning', '').lower().strip()
            
            # ── Signal 1: Title similarity ──
            title_sim = similarity(sc_title_norm, p_title_norm)
            
            # Exact match bonus
            if sc_title_norm and sc_title_norm == p_title_norm:
                title_sim = 1.5
            # Containment bonus: seed title in scraped title (e.g. だ is in だ・です)
            elif p_title_norm and sc_title_norm and len(p_title_norm) >= 1:
                if p_title_norm in sc_title_norm:
                    title_sim = max(title_sim, 1.0 + len(p_title_norm) / max(len(sc_title_norm), 1) * 0.3)
                elif sc_title_norm in p_title_norm:
                    title_sim = max(title_sim, 0.9 + len(sc_title_norm) / max(len(p_title_norm), 1) * 0.2)
            
            # ── Signal 2: Romaji similarity ──
            romaji_sim = similarity(sc_romaji_norm, p_romaji_norm)
            
            # Exact romaji match
            if sc_romaji_norm and sc_romaji_norm == p_romaji_norm:
                romaji_sim = 1.5
            # Containment
            elif p_romaji_norm and sc_romaji_norm and len(p_romaji_norm) >= 2:
                if p_romaji_norm in sc_romaji_norm:
                    romaji_sim = max(romaji_sim, 1.0 + len(p_romaji_norm) / max(len(sc_romaji_norm), 1) * 0.3)
                elif sc_romaji_norm in p_romaji_norm:
                    romaji_sim = max(romaji_sim, 0.9)
            
            # ── Signal 3: URL romaji vs seed slug romaji ──
            url_rom_bonus = 0.0
            if sc_url_romaji and p_romaji_norm:
                p_rom_parts = normalize_romaji(p.get('titleRomaji', '')).replace(' ', '')
                url_rom_joined = ''.join(sc_url_romaji)
                if p_rom_parts and p_rom_parts in url_rom_joined:
                    url_rom_bonus = 0.3
                elif url_rom_joined and url_rom_joined in p_rom_parts:
                    url_rom_bonus = 0.2
                else:
                    url_rom_bonus = similarity(url_rom_joined, p_rom_parts) * 0.2
            
            # ── Signal 4: Meaning similarity ──
            meaning_sim = similarity(sc_meaning, p_meaning)
            
            # Weighted combo
            score = title_sim * 0.4 + romaji_sim * 0.25 + meaning_sim * 0.15 + url_rom_bonus + 0.0
            
            if score > best_score:
                best_score = score
                best_slug = p['slug']
        
        if best_score >= 0.50 and best_slug:
            # Only override if this match is better than previous for same slug
            if best_slug not in matches or best_score > matches[best_slug][1]:
                matches[best_slug] = (sc, best_score)
        else:
            unmatched_scraped.append((sc, best_score, best_slug))
    
    return matches, unmatched_scraped


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Main pipeline
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def main():
    match_only = '--match-only' in sys.argv
    
    # ── Load seed ──
    with open(SEED_FILE, encoding='utf-8') as f:
        seed_points = json.load(f)
    print(f"Loaded {len(seed_points)} seed grammar points")
    
    if match_only:
        # Use existing scraped data
        print(f"\n--match-only: Loading existing {SCRAPED_FILE}")
        with open(SCRAPED_FILE, encoding='utf-8') as f:
            scraped = json.load(f)
        print(f"Loaded {len(scraped)} scraped entries")
    else:
        # ── Step 1: Load URLs from pre-saved files ──
        # (List pages require JavaScript, so URLs were scraped via browser)
        print("\n═══ Step 1: Loading Grammar URLs from Files ═══")
        all_urls = []
        for fname, level in [('jlptsensei-n5-urls.txt', 'N5'), ('jlptsensei-n4-urls.txt', 'N4')]:
            fpath = os.path.join(BASE_DIR, fname)
            if os.path.exists(fpath):
                with open(fpath) as f:
                    for line in f:
                        url = line.strip()
                        if url:
                            all_urls.append((url, level))
                count = sum(1 for u, l in all_urls if l == level)
                print(f"  Loaded {count} {level} URLs from {fname}")
        
        # Deduplicate
        seen = set()
        unique_urls = []
        for url, level in all_urls:
            norm = url.rstrip('/')
            if norm not in seen:
                seen.add(norm)
                unique_urls.append((url, level))
        print(f"  Total unique: {len(unique_urls)}")
        
        # ── Step 2: Load existing scraped data to skip already-done pages ──
        existing = {}
        if os.path.exists(SCRAPED_FILE):
            with open(SCRAPED_FILE, encoding='utf-8') as f:
                for r in json.load(f):
                    existing[r['url'].rstrip('/')] = r
            print(f"  Loaded {len(existing)} previously scraped pages (will skip)")
        
        # ── Step 3: Scrape new pages ──
        new_needed = sum(1 for u, l in unique_urls if u.rstrip('/') not in existing)
        print(f"\n═══ Step 2: Scraping Grammar Pages ({new_needed} new) ═══")
        scraped = list(existing.values())
        new_count = 0
        
        for i, (url, level) in enumerate(unique_urls):
            norm = url.rstrip('/')
            if norm in existing:
                continue  # Already scraped
            
            slug_display = unquote(url.rstrip('/').split('/')[-1])[:40]
            print(f"  [{new_count+1}/{new_needed}] {slug_display}")
            
            page = fetch_page(url)
            if page:
                data = parse_grammar_page(page, url, level)
                scraped.append(data)
                existing[norm] = data
                new_count += 1
                ex_count = len(data['examples'])
                expl = '✓' if data['explanation'] else '✗'
                meaning = '✓' if data['meaning'] else '✗'
                print(f"    → {data['title']} ({data['romaji']}) meaning:{meaning} expl:{expl} ex:{ex_count}")
            
            time.sleep(0.4)
        
        print(f"\n  New pages scraped: {new_count}")
        print(f"  Total scraped: {len(scraped)}")
        
        # Save all scraped data
        with open(SCRAPED_FILE, 'w', encoding='utf-8') as f:
            json.dump(scraped, f, ensure_ascii=False, indent=2)
        print(f"  Saved to: {SCRAPED_FILE}")
    
    # ── Step 3: Match scraped → seed ──
    print(f"\n═══ Step 3: Matching Scraped → Seed ═══")
    matches, unmatched = match_scraped_to_seed(scraped, seed_points)
    
    print(f"  Matched: {len(matches)}/{len(seed_points)} seed points")
    print(f"  Unmatched scraped entries: {len(unmatched)}")
    
    # Show match quality
    high = sum(1 for _, (_, score) in matches.items() if score >= 0.8)
    med = sum(1 for _, (_, score) in matches.items() if 0.6 <= score < 0.8)
    low = sum(1 for _, (_, score) in matches.items() if score < 0.6)
    print(f"  Match quality: ≥0.8: {high}, 0.6-0.8: {med}, <0.6: {low}")
    
    # Show some low-confidence matches for verification
    if low > 0:
        print("\n  ⚠ Low-confidence matches (< 0.6):")
        for slug, (sc, score) in sorted(matches.items(), key=lambda x: x[1][1]):
            if score >= 0.6:
                break
            p = next(pp for pp in seed_points if pp['slug'] == slug)
            print(f"    {score:.2f}  seed: {p['title']} ({p.get('titleRomaji','')}) → scraped: {sc['title']} ({sc.get('romaji','')})")
    
    # ── Step 4: Merge enrichment ──
    print(f"\n═══ Step 4: Merging Enrichment ═══")
    slug_map = {p['slug']: p for p in seed_points}
    enriched_count = 0
    
    for slug, (sc, score) in matches.items():
        p = slug_map[slug]
        
        # Only enrich if we have meaningful data
        changed = False
        if sc.get('explanation') and (not p.get('explanation') or p['explanation'] == p.get('meaning', '')):
            p['explanation'] = sc['explanation']
            changed = True
        if sc.get('structure') and not p.get('structure'):
            p['structure'] = sc['structure']
            changed = True
        if sc.get('examples') and not p.get('examples'):
            p['examples'] = sc['examples']
            changed = True
        if sc.get('meaning') and (not p.get('meaning') or len(sc['meaning']) > len(p.get('meaning', ''))):
            p['meaning'] = sc['meaning']
            changed = True
        
        if changed:
            enriched_count += 1
    
    # Write back
    with open(SEED_FILE, 'w', encoding='utf-8') as f:
        json.dump(seed_points, f, ensure_ascii=False, indent=2)
    
    # Final stats
    w_ex = sum(1 for p in seed_points if p.get('examples'))
    w_expl = sum(1 for p in seed_points if p.get('explanation') and p['explanation'] != p.get('meaning', ''))
    still_empty = [p['slug'] for p in seed_points if not p.get('examples')]
    
    print(f"\n══════════════════════════════════")
    print(f"  Enriched this run: {enriched_count}")
    print(f"  Points with examples: {w_ex}/{len(seed_points)}")
    print(f"  Points with explanations: {w_expl}/{len(seed_points)}")
    print(f"  Still missing examples: {len(still_empty)}")
    print(f"  Written to: {SEED_FILE}")
    
    if still_empty:
        print(f"\n  Still need enrichment ({len(still_empty)}):")
        for slug in still_empty[:20]:
            p = slug_map[slug]
            print(f"    {slug}: {p['title']} ({p.get('titleRomaji','')})")
        if len(still_empty) > 20:
            print(f"    ... and {len(still_empty) - 20} more")


if __name__ == '__main__':
    main()
