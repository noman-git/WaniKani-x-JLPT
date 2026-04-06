import json
import os
import time
import sqlite3
import asyncio
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
DB_PATH = Path("data/jlpt.db")

CACHE_DIR = Path("data/debug/pseudo_wk_cache")
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# schemas
SCHEMA_PASS1 = {
    "type": "ARRAY",
    "items": {
        "type": "OBJECT",
        "properties": {
            "jlpt_item_id": {"type": "INTEGER"},
            "is_valid_match": {
                "type": "BOOLEAN",
                "description": "True ONLY IF the stripped WaniKani expression accurately represents the core semantic and nuanced meaning of the JLPT item. False if stripping honorifics/prefixes drastically corrupts or alters the nuance (e.g. 'お陰' -> 'お陰で' is false because the trailing で changes grammar, or 'お礼' vs '礼' might be false if usage differs widely)."
            },
            "reasoning": {"type": "STRING"}
        },
        "required": ["jlpt_item_id", "is_valid_match", "reasoning"]
    }
}

SCHEMA_PASS2 = {
    "type": "ARRAY",
    "items": {
        "type": "OBJECT",
        "properties": {
            "jlpt_item_id": {"type": "INTEGER"},
            "meanings": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "meaning": {"type": "STRING"},
                        "primary": {"type": "BOOLEAN"},
                        "accepted_answer": {"type": "BOOLEAN"}
                    },
                    "required": ["meaning", "primary", "accepted_answer"]
                }
            },
            "readings": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "reading": {"type": "STRING"},
                        "type": {"type": "STRING", "description": "e.g., 'onyomi', 'kunyomi' for kanji, or null for vocab", "nullable": True},
                        "primary": {"type": "BOOLEAN"},
                        "accepted_answer": {"type": "BOOLEAN"}
                    },
                    "required": ["reading", "primary", "accepted_answer"]
                }
            },
            "meaning_mnemonic": {"type": "STRING", "description": "A clever WaniKani style meaning mnemonic."},
            "reading_mnemonic": {"type": "STRING", "description": "A clever WaniKani style reading phonetic mnemonic."},
            "parts_of_speech": {
                "type": "ARRAY",
                "items": {"type": "STRING"},
                "description": "E.g., ['noun', 'intransitive verb']"
            },
            "context_sentences": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "ja": {"type": "STRING"},
                        "en": {"type": "STRING"}
                    },
                    "required": ["ja", "en"]
                },
                "description": "At least 2 context sentences."
            }
        },
        "required": [
            "jlpt_item_id", "meanings", "readings", "meaning_mnemonic",
            "reading_mnemonic", "parts_of_speech", "context_sentences"
        ]
    }
}


def get_loose_matches():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("""
        SELECT w.wk_subject_id, w.characters as wk_chars, w.meanings as wk_meanings,
               j.id as jlpt_item_id, j.expression as jlpt_expr, j.meaning as jlpt_meaning
        FROM wanikani_subjects w
        INNER JOIN jlpt_items j ON w.matched_jlpt_item_id = j.id
        WHERE w.characters != j.expression
    """)
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows

def get_unmatched_items():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("""
        SELECT j.id as jlpt_item_id, j.expression, j.reading, j.meaning, j.type
        FROM jlpt_items j
        WHERE j.id NOT IN (
            SELECT matched_jlpt_item_id FROM wanikani_subjects WHERE matched_jlpt_item_id IS NOT NULL
        )
    """)
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows

def unlink_item(jlpt_item_id):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("UPDATE wanikani_subjects SET matched_jlpt_item_id = NULL WHERE matched_jlpt_item_id = ?", (jlpt_item_id,))
    conn.commit()
    conn.close()

def insert_pseudo_wk(data, original_item):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    jlpt_id = data["jlpt_item_id"]
    pseudo_wk_id = 900000 + jlpt_id
    
    c.execute("""
        SELECT id FROM wanikani_subjects WHERE wk_subject_id = ?
    """, (pseudo_wk_id,))
    
    if c.fetchone():
        # Update instead of insert
        c.execute("""
            UPDATE wanikani_subjects SET 
                meanings = ?, readings = ?, meaning_mnemonic = ?, reading_mnemonic = ?,
                context_sentences = ?, parts_of_speech = ?, matched_jlpt_item_id = ?
            WHERE wk_subject_id = ?
        """, (
            json.dumps(data["meanings"]), json.dumps(data["readings"]),
            data.get("meaning_mnemonic"), data.get("reading_mnemonic"),
            json.dumps(data["context_sentences"]), json.dumps(data["parts_of_speech"]),
            jlpt_id, pseudo_wk_id
        ))
    else:
        # Insert new
        c.execute("""
            INSERT INTO wanikani_subjects (
                wk_subject_id, characters, meanings, readings, wk_level, object_type,
                matched_jlpt_item_id, match_type, meaning_mnemonic, reading_mnemonic,
                context_sentences, parts_of_speech
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            pseudo_wk_id, original_item["expression"], json.dumps(data["meanings"]),
            json.dumps(data["readings"]), 0, original_item["type"], jlpt_id,
            "pseudo", data.get("meaning_mnemonic"), data.get("reading_mnemonic"),
            json.dumps(data["context_sentences"]), json.dumps(data["parts_of_speech"])
        ))
        
    conn.commit()
    conn.close()


def chunk_list(lst, n):
    for i in range(0, len(lst), n):
        yield lst[i:i + n]

def process_pass1_chunk(chunk_id, items):
    cache_file = CACHE_DIR / f"pass1_{chunk_id}.json"
    if cache_file.exists():
        with open(cache_file, "r", encoding="utf-8") as f:
            return json.load(f)

    prompt = "Evaluate these loosely matched JLPT <-> WaniKani pairs.\\n\\n" + json.dumps(items, ensure_ascii=False, indent=2)
    sys_inst = "You are an expert Japanese linguist validating programmatic vocab cross-references."
    
    for attempt in range(3):
        try:
            resp = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=sys_inst,
                    response_mime_type="application/json",
                    response_schema=SCHEMA_PASS1,
                    temperature=0.1
                )
            )
            result = json.loads(resp.text)
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(result, f, ensure_ascii=False)
            return result
        except Exception as e:
            print(f"Pass1 Chunk {chunk_id} attempt {attempt+1} failed: {e}")
            time.sleep(2)
    return None

async def process_pass2_chunk_async(chunk_id, items):
    cache_file = CACHE_DIR / f"pass2_{chunk_id}.json"
    if cache_file.exists():
        with open(cache_file, "r", encoding="utf-8") as f:
            return json.load(f)

    prompt = "Generate WaniKani style metadata for these orphaned JLPT items.\\n\\n" + json.dumps(items, ensure_ascii=False, indent=2)
    sys_inst = "You are WaniKani's lead content creator. Generate amazing, highly educational mnemonics and natural context sentences."
    
    # Needs to run standard synchronous genai client in executor if we don't use genai.Client(async_mode=True).
    # Fortunately `genai.Client()` handles async out of the box with `client.aio.models.generate_content`
    for attempt in range(3):
        try:
            resp = await client.aio.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=sys_inst,
                    response_mime_type="application/json",
                    response_schema=SCHEMA_PASS2,
                    temperature=0.5
                )
            )
            result = json.loads(resp.text)
            if len(result) != len(items):
                print(f"Warning: Extracted {len(result)} items instead of {len(items)}. Retrying.")
                await asyncio.sleep(2)
                continue
                
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(result, f, ensure_ascii=False)
            return result
        except Exception as e:
            print(f"Pass2 Chunk {chunk_id} attempt {attempt+1} failed: {e}")
            await asyncio.sleep(4)
    return None

async def run_pass2(unmatched_items):
    chunks2 = list(chunk_list(unmatched_items, 10))
    tasks = [process_pass2_chunk_async(i, chunk) for i, chunk in enumerate(chunks2)]
    results = await asyncio.gather(*tasks)
    
    for i, res in enumerate(results):
        if not res:
            print(f"Fatal error in pass 2 LLM chunk {i}. Ignored.")
            continue
        chunk = chunks2[i]
        chunk_dict = {str(item["jlpt_item_id"]): item for item in chunk}
        for ans in res:
            orig = chunk_dict.get(str(ans["jlpt_item_id"]))
            if orig:
                insert_pseudo_wk(ans, orig)

def main():
    print("=== PASS 1: Verifying Loose Matches ===")
    loose_items = get_loose_matches()
    print(f"Found {len(loose_items)} loose matches.")
    
    unlinked_count = 0
    chunks1 = list(chunk_list(loose_items, 10))
    for i, chunk in enumerate(chunks1):
        res = process_pass1_chunk(i, chunk)
        if not res:
            print("Fatal error in pass 1 LLM. Aborting.")
            return
        
        for ans in res:
            if not ans.get("is_valid_match", True):
                unlink_item(ans["jlpt_item_id"])
                unlinked_count += 1
    print(f"Pass 1 Complete. Unlinked {unlinked_count} bad matches.\\n")
    
    print("=== PASS 2: Generating Pseudo-WK Data ===")
    unmatched_items = get_unmatched_items()
    print(f"Found {len(unmatched_items)} unmatched items requiring LLM content.")
    
    asyncio.run(run_pass2(unmatched_items))
    print("Pass 2 Complete. All gap items pseudo-linked!")

if __name__ == "__main__":
    main()
