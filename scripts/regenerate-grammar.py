import json
import os
import time
import asyncio
from pathlib import Path
from dotenv import load_dotenv

# Try importing the modern google-genai library first
try:
    from google import genai
    from google.genai import types
except ImportError:
    print("Please install google-genai: pip install google-genai")
    exit(1)

# Load environment variables
load_dotenv()
if not os.getenv("GEMINI_API_KEY"):
    print("ERROR: GEMINI_API_KEY is not set in .env")
    exit(1)

# Initialize the client
client = genai.Client()

# Paths
INPUT_PATH = Path("data/grammar-seed.json")
OUTPUT_PATH = Path("data/grammar-seed.json")
CACHE_DIR = Path("data/debug/llm_cache")
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Schema Definition for Structured Output
SCHEMA = {
    "type": "ARRAY",
    "items": {
        "type": "OBJECT",
        "properties": {
            "slug": {
                "type": "STRING",
                "description": "Standardized slug: '{level}-{romaji}'. E.g., 'n5-da', 'n4-kamoshirenai'."
            },
            "title": {
                "type": "STRING",
                "description": "The exact Japanese grammar pattern from the original input."
            },
            "titleRomaji": {
                "type": "STRING",
                "description": "Pure, lowercase romaji of the title."
            },
            "meaning": {
                "type": "STRING",
                "description": "Extremely concise 1-line English gloss, max 80 chars. E.g. 'might; maybe; probably'."
            },
            "structure": {
                "type": "STRING",
                "description": "Grammatical formula (e.g. 'Noun + だ\\nVerb (Casual) + かもしれない')."
            },
            "explanation": {
                "type": "STRING",
                "description": "2-4 paragraphs of pure, educational markdown explaining the nuance, usage context, and common mistakes. NO HTML."
            },
            "jlptLevel": {
                "type": "STRING",
                "description": "Must match original: 'N5' or 'N4'."
            },
            "lessonNumber": {
                "type": "INTEGER",
                "description": "Must match original lessonNumber."
            },
            "lessonTitle": {
                "type": "STRING",
                "description": "Must match original lessonTitle."
            },
            "order": {
                "type": "INTEGER",
                "description": "Must match original order."
            },
            "examples": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "ja": {"type": "STRING", "description": "The Japanese sentence."},
                        "romaji": {"type": "STRING", "description": "Lowercase romaji sentence."},
                        "en": {"type": "STRING", "description": "Natural English translation."}
                    },
                    "required": ["ja", "romaji", "en"]
                },
                "description": "Exactly 4 distinct, high-quality examples using the grammar."
            },
            "tags": {
                "type": "ARRAY",
                "items": {"type": "STRING"},
                "description": "Grammar tags, e.g., 'particle', 'conjunction', 'honorific'. Minimum 1 tag."
            },
            "relatedGrammarSlugs": {
                "type": "ARRAY",
                "items": {"type": "STRING"},
                "description": "Array of slugs of related points (can be empty if none applicable)."
            }
        },
        "required": [
            "slug", "title", "titleRomaji", "meaning", "structure", 
            "explanation", "jlptLevel", "lessonNumber", "lessonTitle", 
            "order", "examples", "tags", "relatedGrammarSlugs"
        ]
    }
}

SYS_INSTRUCT = """You are an expert Japanese teacher and JLPT curriculum designer.
You will receive a list of grammar points (with their corrupted/inconsistent existing data).
Your job is to COMPLETELY REWRITE the content for each grammar point according to the requested schema.
- Disregard the old corrupted explanations or mismatched meanings/examples.
- Ensure 100% accuracy for JLPT N5/N4 levels.
- Provide exactly 4 high-quality examples per grammar point.
- The meaning should be extremely concise.
- Structure should clearly show formation rules.
- Explanation should be rich, markdown-formatted, and helpful.
- Keep the `title`, `jlptLevel`, `lessonNumber`, `lessonTitle`, and `order` exactly the same as the input.
- Return ONLY the JSON array matching the schema."""

def chunk_list(lst, n):
    for i in range(0, len(lst), n):
        yield lst[i:i + n]

def process_chunk(chunk_id, chunk_data):
    cache_file = CACHE_DIR / f"chunk_{chunk_id}.json"
    if cache_file.exists():
        print(f"Skipping chunk {chunk_id} (already cached)")
        with open(cache_file, "r", encoding="utf-8") as f:
            return json.load(f)

    print(f"Processing chunk {chunk_id} ({len(chunk_data)} points)...")
    
    prompt = "Please process these grammar points and return the fixed JSON array:\\n\\n"
    prompt += json.dumps(chunk_data, ensure_ascii=False, indent=2)
    
    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SYS_INSTRUCT,
                    response_mime_type="application/json",
                    response_schema=SCHEMA,
                    temperature=0.2,
                ),
            )
            
            # Parse the response text as JSON
            result = json.loads(response.text)
            
            # Small validation check
            if len(result) != len(chunk_data):
                print(f"  Warning: Expected {len(chunk_data)} returned, got {len(result)}. Retrying...")
                continue
                
            # Sort by original order to be safe
            result.sort(key=lambda x: x.get('order', 0))
            
            # Save to cache
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
                
            print(f"  Chunk {chunk_id} done.")
            return result
            
        except Exception as e:
            print(f"  Attempt {attempt+1} failed: {e}")
            time.sleep((attempt + 1) * 2)
            
    print(f"ERROR: Failed to process chunk {chunk_id} after 3 attempts.")
    return None

def main():
    if not INPUT_PATH.exists():
        print(f"Input file not found: {INPUT_PATH}")
        return

    with open(INPUT_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    print(f"Loaded {len(data)} grammar points.")
    
    # Process in chunks of 5
    CHUNK_SIZE = 5
    chunks = list(chunk_list(data, CHUNK_SIZE))
    print(f"Processing in {len(chunks)} chunks...")
    
    all_results = []
    
    for i, chunk in enumerate(chunks):
        res = process_chunk(i, chunk)
        if res is None:
            print("Aborting due to chunk failure. Run again to resume from cache.")
            return
        all_results.extend(res)
        
        # Rate limit protection just in case
        time.sleep(1)
        
    print(f"\\nAll chunks processed successfully! Total points: {len(all_results)}")
    
    # Save the final merged output
    # First, make a backup of the original
    if INPUT_PATH.exists():
        backup_path = INPUT_PATH.with_suffix(".json.bak")
        os.rename(INPUT_PATH, backup_path)
        print(f"Backed up original to {backup_path}")
        
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(all_results, f, ensure_ascii=False, indent=2)
        
    print(f"Saved {len(all_results)} points to {OUTPUT_PATH}")

if __name__ == "__main__":
    main()
