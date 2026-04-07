import json
import os
import time
from pathlib import Path
from dotenv import load_dotenv

try:
    from google import genai
    from google.genai import types
except ImportError:
    print("Please install google-genai: pip install google-genai")
    exit(1)

load_dotenv()
if not os.getenv("GEMINI_API_KEY"):
    print("ERROR: GEMINI_API_KEY is not set in .env")
    exit(1)

client = genai.Client()

INPUT_PATH = Path("data/grammar-seed.json")
OUTPUT_PATH = Path("data/grammar-seed.json")
CACHE_DIR = Path("data/debug/cloze_cache")
CACHE_DIR.mkdir(parents=True, exist_ok=True)

SCHEMA = {
    "type": "ARRAY",
    "items": {
        "type": "OBJECT",
        "properties": {
            "slug": {"type": "STRING"},
            "examples": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "ja": {"type": "STRING", "description": "The original Japanese sentence, unchanged."},
                        "romaji": {"type": "STRING", "description": "The original romaji, unchanged."},
                        "en": {"type": "STRING", "description": "The original English translation, unchanged."},
                        "jaPrompt": {"type": "STRING", "description": "The Japanese sentence with exactly one '___' replacing the grammar target."},
                        "clozeAnswer": {"type": "STRING", "description": "The exact Japanese text removed to create the blank."},
                    },
                    "required": ["ja", "romaji", "en", "jaPrompt", "clozeAnswer"]
                }
            }
        },
        "required": ["slug", "examples"]
    }
}

SYS_INSTRUCT = """You are an expert Japanese linguistics professor specializing in JLPT grammar.

You will receive grammar points, each with a title (the grammar pattern) and example sentences.

YOUR TASK: For each example sentence, identify the EXACT substring in the Japanese sentence that demonstrates the grammar pattern being taught, then:
1. Create `jaPrompt`: the original `ja` sentence with that substring replaced by exactly `___`
2. Create `clozeAnswer`: the exact substring you removed

RULES:
- The `ja`, `romaji`, and `en` fields MUST be returned EXACTLY as given. Do NOT modify them.
- `jaPrompt.replace("___", clozeAnswer)` MUST exactly equal the original `ja`. This is critical.
- For particles like が, は, を, に, で, と, etc: blank out just the particle itself.
  Example: title="が (Identifier)", ja="誰が来ましたか。" → jaPrompt="誰___来ましたか。", clozeAnswer="が"
- For verb conjugation patterns like "る-Verb (Negative)": blank out the conjugated verb form.
  Example: title="る-Verb (Negative)", ja="朝ごはんを食べない。" → jaPrompt="朝ごはんを___。", clozeAnswer="食べない"
- For multi-word patterns like "〜なければならない": blank out the actual conjugated form as it appears.
  Example: title="〜なければならない", ja="宿題をしなければならない。" → jaPrompt="宿題を___。", clozeAnswer="しなければならない"
- For demonstratives like "これ・それ・あれ": blank out whichever one appears.
  Example: title="これ・それ・あれ", ja="これは私の辞書です。" → jaPrompt="___は私の辞書です。", clozeAnswer="これ"
- Always pick the MOST RELEVANT occurrence if the pattern appears multiple times.
- The blank should be the smallest meaningful chunk that tests the grammar point.
- NEVER blank out particles that are NOT the grammar target.

Return ONLY the JSON array with slug and updated examples."""


def chunk_list(lst, n):
    for i in range(0, len(lst), n):
        yield lst[i:i + n]


def process_chunk(chunk_id, chunk_data):
    cache_file = CACHE_DIR / f"chunk_{chunk_id}.json"
    if cache_file.exists():
        print(f"  Skipping chunk {chunk_id} (cached)")
        with open(cache_file, "r", encoding="utf-8") as f:
            return json.load(f)

    # Build a compact input with just slug, title, and examples
    compact = []
    for item in chunk_data:
        compact.append({
            "slug": item["slug"],
            "title": item["title"],
            "meaning": item.get("meaning", ""),
            "examples": item.get("examples", [])
        })

    prompt = "Process these grammar points and return the JSON array with cloze data:\n\n"
    prompt += json.dumps(compact, ensure_ascii=False, indent=2)

    print(f"  Processing chunk {chunk_id} ({len(chunk_data)} points)...")

    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model='gemini-3.1-pro-preview',
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SYS_INSTRUCT,
                    response_mime_type="application/json",
                    response_schema=SCHEMA,
                    temperature=0.1,
                ),
            )

            result = json.loads(response.text)

            if len(result) != len(chunk_data):
                print(f"    Warning: Expected {len(chunk_data)}, got {len(result)}. Retrying...")
                continue

            # Validate cloze integrity
            errors = 0
            for item in result:
                for ex in item.get("examples", []):
                    reconstructed = ex.get("jaPrompt", "").replace("___", ex.get("clozeAnswer", ""))
                    if reconstructed != ex.get("ja", ""):
                        errors += 1
            
            if errors > 0:
                print(f"    Warning: {errors} cloze reconstruction mismatches. Retrying...")
                if attempt < 2:
                    continue

            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(result, f, ensure_ascii=False, indent=2)

            print(f"    Chunk {chunk_id} done ({errors} errors).")
            return result

        except Exception as e:
            print(f"    Attempt {attempt+1} failed: {e}")
            time.sleep((attempt + 1) * 3)

    print(f"  ERROR: Failed chunk {chunk_id} after 3 attempts.")
    return None


def main():
    if not INPUT_PATH.exists():
        print(f"Input not found: {INPUT_PATH}")
        return

    with open(INPUT_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    print(f"Loaded {len(data)} grammar points.")

    CHUNK_SIZE = 10
    chunks = list(chunk_list(data, CHUNK_SIZE))
    print(f"Processing in {len(chunks)} chunks...\n")

    # Build a lookup from slug -> cloze examples
    cloze_lookup = {}

    for i, chunk in enumerate(chunks):
        res = process_chunk(i, chunk)
        if res is None:
            print("Aborting. Run again to resume from cache.")
            return
        for item in res:
            cloze_lookup[item["slug"]] = item["examples"]
        time.sleep(1)

    # Merge cloze data back into original seed
    updated = 0
    errors = 0
    for point in data:
        slug = point["slug"]
        if slug in cloze_lookup:
            cloze_examples = cloze_lookup[slug]
            orig_examples = point.get("examples", [])

            # Merge: keep original fields, add jaPrompt and clozeAnswer
            merged = []
            for j, orig in enumerate(orig_examples):
                if j < len(cloze_examples):
                    ce = cloze_examples[j]
                    merged.append({
                        "ja": orig["ja"],       # Keep original
                        "romaji": orig["romaji"],
                        "en": orig["en"],
                        "jaPrompt": ce.get("jaPrompt", ""),
                        "clozeAnswer": ce.get("clozeAnswer", ""),
                    })

                    # Validate
                    reconstructed = ce.get("jaPrompt", "").replace("___", ce.get("clozeAnswer", ""))
                    if reconstructed != orig["ja"]:
                        errors += 1
                else:
                    merged.append(orig)

            point["examples"] = merged
            updated += 1

    print(f"\nMerged cloze data into {updated} grammar points ({errors} reconstruction errors).")

    # Backup and save
    backup_path = INPUT_PATH.with_suffix(".json.bak")
    if not backup_path.exists():
        import shutil
        shutil.copy2(INPUT_PATH, backup_path)
        print(f"Backed up to {backup_path}")

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"Saved updated seed to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
