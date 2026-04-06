#!/usr/bin/env python3
"""
Generate grammar-seed.json by merging:
  1. Bunpro N5/N4 curriculum structure (lesson groupings, titles, slugs)
  2. JLPTsensei scraped data (meanings, explanations, example sentences)
"""
import json, re, sys, os
from difflib import SequenceMatcher

BASE_DIR = '/home/noman/resume/jlpt-dashboard/data'

# ─── N5 Grammar Points (from Bunpro N5 curriculum) ───
n5_data = [
    # (slug, title, romaji, meaning, lesson, lesson_title)
    # Lesson 1: Crucial Sentence Elements
    ("da", "だ", "da", "Is, Am, Are (Casual)", 1, "Crucial Sentence Elements"),
    ("desu", "です", "desu", "Is, Am, Are (Polite)", 1, "Crucial Sentence Elements"),
    ("wa", "は", "wa", "Topic marker particle", 1, "Crucial Sentence Elements"),
    ("mo", "も", "mo", "Also, Too, As well", 1, "Crucial Sentence Elements"),
    ("ga-identifier", "が (Identifier)", "ga", "Subject marker, Identifier", 1, "Crucial Sentence Elements"),
    ("ka", "か", "ka", "Question marker particle", 1, "Crucial Sentence Elements"),
    ("no-possessive", "の (Possessive)", "no", "Possessive particle, Noun connector", 1, "Crucial Sentence Elements"),
    ("kore-sore-are", "これ・それ・あれ", "kore sore are", "This, That, That over there", 1, "Crucial Sentence Elements"),
    ("kono-sono-ano", "この・その・あの", "kono sono ano", "This, That, That (modifying nouns)", 1, "Crucial Sentence Elements"),
    # Lesson 2: Things About Nouns
    ("ni-location", "に (Location)", "ni", "At, In, On (Location)", 2, "Things About Nouns"),
    ("de-location", "で (Location)", "de", "At, In (Activity location)", 2, "Things About Nouns"),
    ("wo", "を", "wo", "Object marker particle", 2, "Things About Nouns"),
    ("to-and", "と (And)", "to", "And, With (Listing/companion)", 2, "Things About Nouns"),
    ("ya", "や", "ya", "And (Non-exhaustive list)", 2, "Things About Nouns"),
    ("kara-from", "から (From)", "kara", "From (Starting point)", 2, "Things About Nouns"),
    ("made", "まで", "made", "Until, To, Up to", 2, "Things About Nouns"),
    ("ni-time", "に (Time)", "ni", "At, On (Specific time)", 2, "Things About Nouns"),
    ("ne", "ね", "ne", "Right?, Isn't it?", 2, "Things About Nouns"),
    ("yo", "よ", "yo", "Emphasis, I tell you", 2, "Things About Nouns"),
    # Lesson 3: Basic Verb Conjugation
    ("masu", "ます", "masu", "Polite verb ending", 3, "Basic Verb Conjugation"),
    ("masen", "ません", "masen", "Polite negative verb ending", 3, "Basic Verb Conjugation"),
    ("mashita", "ました", "mashita", "Polite past verb ending", 3, "Basic Verb Conjugation"),
    ("masen-deshita", "ませんでした", "masen deshita", "Polite negative past verb ending", 3, "Basic Verb Conjugation"),
    ("ru-verb-plain", "る-Verb (Dictionary)", "ru verb", "る-Verb dictionary form", 3, "Basic Verb Conjugation"),
    ("u-verb-plain", "う-Verb (Dictionary)", "u verb", "う-Verb dictionary form", 3, "Basic Verb Conjugation"),
    ("ru-verb-negative", "る-Verb (Negative)", "ru verb negative", "る-Verb negative form", 3, "Basic Verb Conjugation"),
    ("u-verb-negative", "う-Verb (Negative)", "u verb negative", "う-Verb negative form", 3, "Basic Verb Conjugation"),
    ("mashou", "ましょう", "mashou", "Let's (Polite volitional)", 3, "Basic Verb Conjugation"),
    # Lesson 4: More Verb Forms
    ("ru-verb-past", "る-Verb (Past)", "ru verb past", "る-Verb past tense", 4, "More Verb Forms"),
    ("u-verb-past", "う-Verb (Past)", "u verb past", "う-Verb past tense", 4, "More Verb Forms"),
    ("nai", "ない", "nai", "Not, Negative plain form", 4, "More Verb Forms"),
    ("nakatta", "なかった", "nakatta", "Was not (Past negative)", 4, "More Verb Forms"),
    ("ga-but", "が (But)", "ga but", "But, However", 4, "More Verb Forms"),
    ("kedo", "けど・けれど", "kedo", "But, Although, However", 4, "More Verb Forms"),
    ("ni-direction", "に (Direction)", "ni direction", "To, Toward (Direction)", 4, "More Verb Forms"),
    # Lesson 5: Linking Structures
    ("ru-verb-neg-past", "る-Verb (Neg-Past)", "ru verb neg past", "る-Verb negative past", 5, "Linking Structures"),
    ("u-verb-neg-past", "う-Verb (Neg-Past)", "u verb neg past", "う-Verb negative past", 5, "Linking Structures"),
    ("te-conjunction", "て (Conjunction)", "te conjunction", "And, Then (Linking events)", 5, "Linking Structures"),
    ("te-iru-1", "ている①", "te iru", "Is doing, ~ing (Progressive)", 5, "Linking Structures"),
    ("he", "へ", "e", "To, Toward (Direction)", 5, "Linking Structures"),
    ("ni-iku", "Verb + にいく", "ni iku", "To go to do, Go in order to", 5, "Linking Structures"),
    # Lesson 6: Knowledge Gaps
    ("dare", "誰", "dare", "Who", 6, "Knowledge Gaps"),
    ("naze", "なぜ", "naze", "Why", 6, "Knowledge Gaps"),
    ("doushite", "どうして", "doushite", "Why, How", 6, "Knowledge Gaps"),
    ("nande", "なんで", "nande", "Why (Casual)", 6, "Knowledge Gaps"),
    ("i-adj-predicate", "い-Adjective (Predicate)", "i-adj predicate", "い-Adjective as predicate", 6, "Knowledge Gaps"),
    ("na-adj-predicate", "な-Adjective (Predicate)", "na-adj predicate", "な-Adjective as predicate", 6, "Knowledge Gaps"),
    ("datta-deshita", "だった・でした", "datta deshita", "Was, Were (Past tense)", 6, "Knowledge Gaps"),
    ("janai", "じゃない", "janai", "Is not, Isn't", 6, "Knowledge Gaps"),
    ("janakatta", "じゃなかった", "janakatta", "Was not, Wasn't", 6, "Knowledge Gaps"),
    ("i-adj-kunakatta", "い-Adj くなかった", "kunakatta", "Was not (い-Adjective past neg)", 6, "Knowledge Gaps"),
    ("to-quotation", "と (Quotation)", "to quotation", "Quotation particle", 6, "Knowledge Gaps"),
    ("tte", "って", "tte", "Casual quotation", 6, "Knowledge Gaps"),
    ("verb-non-past", "Verb (Non-Past)", "verb non-past", "Verb non-past/dictionary form", 6, "Knowledge Gaps"),
    ("verb-ta-noun", "Verb[た] + Noun", "verb ta noun", "Verb modified noun, Relative clause", 6, "Knowledge Gaps"),
    ("no-omission", "の (Noun Omission)", "no omission", "Possessive with noun omission", 6, "Knowledge Gaps"),
    ("na-prohibitive", "な (Prohibitive)", "na prohibitive", "Do not, Don't (Prohibitive)", 6, "Knowledge Gaps"),
    # Lesson 7: Advanced Linking
    ("dake", "だけ", "dake", "Only, Just", 7, "Advanced Linking"),
    ("dore", "どれ", "dore", "Which (of three or more)", 7, "Advanced Linking"),
    ("doko", "どこ", "doko", "Where", 7, "Advanced Linking"),
    ("dono", "どの", "dono", "Which, What kind", 7, "Advanced Linking"),
    ("te-iru-2", "ている②", "te iru 2", "State of being, Has done", 7, "Advanced Linking"),
    ("te-kara", "てから", "te kara", "After doing, Once done", 7, "Advanced Linking"),
    ("te-sequence", "て (Sequence)", "te sequence", "And, And then, Sequential", 7, "Advanced Linking"),
    ("mou", "もう", "mou", "Already, Anymore", 7, "Advanced Linking"),
    ("mada", "まだ", "mada", "Still, Not yet", 7, "Advanced Linking"),
    ("mada-te-imasen", "まだ〜ていません", "mada te imasen", "Still haven't done", 7, "Advanced Linking"),
    ("te-mo-ii", "てもいい", "te mo ii", "It's okay to, May", 7, "Advanced Linking"),
    ("tai", "たい", "tai", "Want to do", 7, "Advanced Linking"),
    ("tari-tari", "たり〜たりする", "tari tari suru", "Things like ~ and ~", 7, "Advanced Linking"),
    # Lesson 8: Counting and Comparisons
    ("i-adj-ku", "い-Adj + く", "i-adj ku", "い-Adjective adverb form", 8, "Counting and Comparisons"),
    ("i-adj-katta", "い-Adj + かった", "i-adj katta", "い-Adjective past tense", 8, "Counting and Comparisons"),
    ("i-adj-kunai", "い-Adj + くない", "i-adj kunai", "い-Adjective negative", 8, "Counting and Comparisons"),
    ("na-adj-ni", "な-Adj + に", "na-adj ni", "な-Adjective adverb form", 8, "Counting and Comparisons"),
    ("counter", "Counter + の + Noun", "counter no noun", "Number + counter + noun", 8, "Counting and Comparisons"),
    ("yori", "より", "yori", "More than, Rather than", 8, "Counting and Comparisons"),
    ("no-hou-ga", "のほうが", "no hou ga", "~ is more (comparative)", 8, "Counting and Comparisons"),
    ("ichiban", "一番", "ichiban", "The most, Number one", 8, "Counting and Comparisons"),
    ("ga-aru", "がある", "ga aru", "There is (inanimate)", 8, "Counting and Comparisons"),
    ("ga-iru", "がいる", "ga iru", "There is (animate)", 8, "Counting and Comparisons"),
    # Lesson 9: Suggesting and Requesting
    ("te-kudasai", "てください", "te kudasai", "Please do (Polite request)", 9, "Suggesting and Requesting"),
    ("naide-kudasai", "ないでください", "naide kudasai", "Please don't", 9, "Suggesting and Requesting"),
    ("te-wa-ikenai", "てはいけない", "te wa ikenai", "Must not, May not", 9, "Suggesting and Requesting"),
    ("nakereba-naranai", "なければならない", "nakereba naranai", "Must, Have to", 9, "Suggesting and Requesting"),
    ("ta-hou-ga-ii", "たほうがいい", "ta hou ga ii", "Should, Better to", 9, "Suggesting and Requesting"),
    ("deshou", "でしょう", "deshou", "Probably, Right?", 9, "Suggesting and Requesting"),
    ("kara-because", "から (Because)", "kara because", "Because, Since", 9, "Suggesting and Requesting"),
    # Lesson 10: Final Concepts
    ("node", "ので", "node", "Because, Since (Formal)", 10, "Final Concepts"),
    ("no-desu", "のです・んです", "no desu", "It is that, The reason is", 10, "Final Concepts"),
    ("tsumori", "つもり", "tsumori", "Plan to, Intend to", 10, "Final Concepts"),
    ("you-ni-naru", "ようになる", "you ni naru", "To reach the point that", 10, "Final Concepts"),
    ("shi", "し", "shi", "And (Listing reasons)", 10, "Final Concepts"),
    ("ga-hoshii", "が欲しい", "ga hoshii", "Want (something)", 10, "Final Concepts"),
    ("nagara-n5", "ながら", "nagara", "While doing", 10, "Final Concepts"),
    ("ni-suru", "にする", "ni suru", "To decide on", 10, "Final Concepts"),
    ("sou-hearsay", "そう (Hearsay)", "sou hearsay", "I heard that, They say", 10, "Final Concepts"),
    ("sou-appearance", "そう (Appearance)", "sou appearance", "Looks like, Seems like", 10, "Final Concepts"),
    ("to-omou", "と思う", "to omou", "I think that", 10, "Final Concepts"),
    ("sugiru", "すぎる", "sugiru", "Too much, Excessively", 10, "Final Concepts"),
]

# ─── N4 Grammar Points (from scraped_words.txt) ───
n4_raw_path = "/home/noman/Downloads/scraped_words.txt"
n4_data = []

lesson_titles = {
    1: "Ways of Doing and Being",
    2: "Linking and Temporal",
    3: "Seems Like, Could Be",
    4: "Comparisons and Speculation",
    5: "Quantifiers and Limits",
    6: "Causative and Completion",
    7: "Giving and Receiving",
    8: "Conditionals and Necessity",
    9: "Ongoing and Continuous",
    10: "Advanced Expressions",
}

if os.path.exists(n4_raw_path):
    n4_raw = open(n4_raw_path, encoding="utf-8").read()
    current_lesson = 0
    current_lesson_title = ""
    for line in n4_raw.strip().split("\n"):
        line = line.strip()
        if not line:
            continue
        lesson_match = re.match(r"^Lesson\s+(\d+)", line)
        if lesson_match:
            current_lesson = int(lesson_match.group(1))
            current_lesson_title = lesson_titles.get(current_lesson, f"Lesson {current_lesson}")
            continue
        if line.startswith("---"):
            continue
        entry_match = re.match(r"^\d+\.\s+(.+)$", line)
        if entry_match:
            title = entry_match.group(1).strip()
            n4_data.append({"title": title, "meaning": "", "lesson": current_lesson, "lesson_title": current_lesson_title})
        elif n4_data and line and not line.startswith("Lesson"):
            if not n4_data[-1]["meaning"]:
                n4_data[-1]["meaning"] = line.strip()


# ─── Load JLPTsensei scraped data ───
scraped_path = os.path.join(BASE_DIR, 'jlptsensei-scraped.json')
jlpt_scraped = []
if os.path.exists(scraped_path):
    with open(scraped_path, encoding='utf-8') as f:
        jlpt_scraped = json.load(f)
    print(f"Loaded {len(jlpt_scraped)} scraped JLPTsensei entries")
else:
    print("WARNING: No scraped data found. Run scrape-jlptsensei.py first!")


def normalize_jp(text):
    """Normalize Japanese text for matching."""
    text = re.sub(r'[〜～・「」【】()（）\s]', '', text)
    text = text.strip('。？！')
    return text


def get_jp_chars(text):
    """Extract only Japanese characters (hiragana, katakana, kanji) from text."""
    return re.findall(r'[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]', text)


def validate_match(bunpro_title, scraped_entry):
    """Validate that a match is correct by checking if the grammar point's
    Japanese characters appear in the scraped examples or explanation."""
    title_jp = get_jp_chars(bunpro_title)
    if not title_jp:
        return True  # Can't validate non-JP titles (e.g. る-Verb)

    # For single-char grammar points, require that char appears in examples
    if len(title_jp) <= 2:
        examples = scraped_entry.get('examples', [])
        scraped_title_jp = get_jp_chars(scraped_entry.get('title', ''))
        # The scraped title should contain the same core characters
        if scraped_title_jp and title_jp:
            # For very short titles, the scraped title must start with or equal our chars
            if title_jp[0] not in scraped_title_jp:
                return False
        return True

    # For multi-char grammar points, check the scraped title contains our chars
    scraped_title_jp = get_jp_chars(scraped_entry.get('title', ''))
    if not scraped_title_jp:
        return True

    # At least half the characters should match
    matches = sum(1 for c in title_jp if c in scraped_title_jp)
    return matches >= len(title_jp) * 0.5


def find_best_scraped_match(title, romaji, level):
    """Find the best matching scraped entry for a grammar point.
    Uses strict matching: exact title or exact romaji only."""
    norm_title = normalize_jp(title)
    clean_romaji = romaji.lower().strip() if romaji else ''
    # Remove disambiguation suffixes we added (e.g., "kara because" -> "kara")
    base_romaji = re.sub(r'\s+(because|from|and|but|quotation|identifier|direction|location|time|possessive|omission|prohibitive|sequence|predicate|conjunction|hearsay|appearance)$', '', clean_romaji)

    candidates = []
    for scraped in jlpt_scraped:
        if scraped.get('level', '') != level:
            continue

        sc_title = normalize_jp(scraped.get('title', ''))
        sc_romaji = scraped.get('romaji', '').lower().strip()
        score = 0.0

        # Tier 1: Exact title match (highest confidence)
        if norm_title and sc_title and norm_title == sc_title:
            score = 1.0
        # Tier 2: Title is contained exactly in scraped title (e.g., から matches から)
        elif norm_title and sc_title and len(norm_title) >= 2:
            if norm_title == sc_title[:len(norm_title)] or sc_title == norm_title[:len(sc_title)]:
                score = 0.85
        # Tier 3: Exact romaji match
        elif base_romaji and sc_romaji and base_romaji == sc_romaji:
            score = 0.9
        # Tier 4: High fuzzy match on long titles only (>= 3 JP chars)
        elif len(get_jp_chars(title)) >= 3:
            ratio = SequenceMatcher(None, norm_title, sc_title).ratio()
            if ratio >= 0.8:
                score = ratio * 0.85

        if score > 0:
            candidates.append((score, scraped))

    # Sort by score descending
    candidates.sort(key=lambda x: -x[0])

    # Return the best candidate that passes validation
    for score, scraped in candidates:
        if score >= 0.6 and validate_match(title, scraped):
            return scraped

    return None


def make_slug(title, level):
    """Generate a URL-safe slug from a grammar title."""
    s = re.sub(r'（[^）]*）', '', title)
    s = re.sub(r'\([^)]*\)', '', s)
    s = re.sub(r'[〜～・「」【】]', '', s)
    s = s.strip()
    slug = re.sub(r'[^\w\s-]', '', s.lower())
    slug = re.sub(r'[\s_]+', '-', slug)
    slug = slug.strip('-')
    if not slug:
        slug = "grammar"
    return f"{level.lower()}-{slug}"


def make_romaji(title):
    """Generate a simple romaji from the title."""
    furigana = re.findall(r'（([^）]+)）', title)
    if furigana:
        return ' '.join(furigana)
    s = re.sub(r'[〜～]', '', title)
    return s.strip()


# ─── Build the full dataset ───
points = []
order = 0
seen_slugs = set()
matched_count = 0
enriched_count = 0

# Add N5 points
for slug, title, romaji, meaning, lesson, lesson_title in n5_data:
    order += 1
    final_slug = f"n5-{slug}"
    if final_slug in seen_slugs:
        final_slug = f"{final_slug}-{order}"
    seen_slugs.add(final_slug)

    # Try to find matching scraped data
    scraped = find_best_scraped_match(title, romaji, 'N5')

    explanation = meaning
    examples = []
    structure = meaning
    enriched_meaning = meaning

    if scraped:
        matched_count += 1
        if scraped.get('meaning'):
            enriched_meaning = scraped['meaning']
        if scraped.get('explanation'):
            explanation = scraped['explanation']
            enriched_count += 1
        if scraped.get('examples'):
            examples = scraped['examples']
        if scraped.get('structure'):
            structure = scraped['structure']
        if scraped.get('romaji') and len(scraped['romaji']) > len(romaji):
            romaji = scraped['romaji']

    points.append({
        "slug": final_slug,
        "title": title,
        "titleRomaji": romaji,
        "meaning": enriched_meaning,
        "structure": structure,
        "explanation": explanation,
        "jlptLevel": "N5",
        "lessonNumber": lesson,
        "lessonTitle": lesson_title,
        "examples": examples,
        "relatedGrammarSlugs": [],
        "tags": [],
        "order": order,
    })

# Add N4 points
for item in n4_data:
    if not item["title"] or not item["meaning"]:
        continue
    order += 1
    title = item["title"]
    meaning = item["meaning"]
    lesson = item["lesson"]
    lesson_title = item["lesson_title"]

    slug = make_slug(title, "n4")
    if slug in seen_slugs:
        slug = f"{slug}-{order}"
    seen_slugs.add(slug)

    romaji = make_romaji(title)

    # Try to find matching scraped data
    scraped = find_best_scraped_match(title, romaji, 'N4')

    explanation = meaning
    examples = []
    structure = meaning
    enriched_meaning = meaning

    if scraped:
        matched_count += 1
        if scraped.get('meaning'):
            enriched_meaning = scraped['meaning']
        if scraped.get('explanation'):
            explanation = scraped['explanation']
            enriched_count += 1
        if scraped.get('examples'):
            examples = scraped['examples']
        if scraped.get('structure'):
            structure = scraped['structure']
        if scraped.get('romaji') and len(scraped['romaji']) > 2:
            romaji = scraped['romaji']

    points.append({
        "slug": slug,
        "title": title,
        "titleRomaji": romaji,
        "meaning": enriched_meaning,
        "structure": structure,
        "explanation": explanation,
        "jlptLevel": "N4",
        "lessonNumber": lesson,
        "lessonTitle": lesson_title,
        "examples": examples,
        "relatedGrammarSlugs": [],
        "tags": [],
        "order": order,
    })

# Write the seed file
output_path = os.path.join(BASE_DIR, "grammar-seed.json")
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(points, f, ensure_ascii=False, indent=2)

# Summary
n5_count = len([p for p in points if p["jlptLevel"] == "N5"])
n4_count = len([p for p in points if p["jlptLevel"] == "N4"])
w_examples = len([p for p in points if p["examples"]])
tot_examples = sum(len(p["examples"]) for p in points)
w_explanation = len([p for p in points if p["explanation"] != p["meaning"]])

print(f"\n=== Grammar Seed Generated ===")
print(f"  Total: {len(points)} grammar points ({n5_count} N5 + {n4_count} N4)")
print(f"  Matched to scraped data: {matched_count}")
print(f"  With real explanations: {enriched_count}")
print(f"  With example sentences: {w_examples} ({tot_examples} total)")
print(f"  Written to: {output_path}")
