import sqlite3
import json
import fugashi

def main():
    # Initialize tokenizer
    tagger = fugashi.Tagger()

    # Connect to db
    db = sqlite3.connect("data/jlpt.db")
    db.row_factory = sqlite3.Row

    # Fetch grammar points
    grammar_pts = db.execute("SELECT id, slug, examples FROM grammar_points").fetchall()
    
    # Fetch JLPT items
    items = db.execute("SELECT id, expression, type FROM jlpt_items").fetchall()
    
    # Build maps
    vocab_map = {}
    kanji_set = {}
    
    for row in items:
        expr = row["expression"]
        if row["type"] == "vocab":
            vocab_map[expr] = row["id"]
        elif row["type"] == "kanji":
            kanji_set[expr] = row["id"]

    links_to_insert = set()
    
    print(f"Loaded {len(grammar_pts)} grammar points and {len(items)} items.")

    for gp in grammar_pts:
        gp_id = gp["id"]
        try:
            exs = json.loads(gp["examples"])
        except:
            continue
            
        # Combine all Japanese examples into one chunk of text
        ja_text = " ".join(ex["ja"] for ex in exs if "ja" in ex)
        
        # 1. Match Kanji by direct character iteration
        for char in ja_text:
            if char in kanji_set:
                links_to_insert.add((gp_id, kanji_set[char]))
                
        # 2. Match Vocab using NLP Tokenizer (Mecab/Fugashi)
        for word in tagger(ja_text):
            # word.surface is the conjugated form in the sentence
            # word.feature.lemma is the dictionary base form (often in vocab lists)
            lemma = word.feature.lemma if word.feature.lemma else word.surface
            surface = word.surface
            
            # Check lemma first
            if lemma in vocab_map:
                # Filter out pure hiragana 1-2 char words that are too common (like て, に, は, する)
                if len(lemma) <= 2 and all('\u3040' <= c <= '\u309f' for c in lemma):
                    # Only add if it's explicitly in the vocab list and not super basic grammar glue
                    if lemma not in ["する", "いる", "ある", "なる", "の", "だ", "に", "は", "が", "を", "と", "も", "で", "や", "から", "まで", "へ"]:
                        links_to_insert.add((gp_id, vocab_map[lemma]))
                else:
                    links_to_insert.add((gp_id, vocab_map[lemma]))
                    
            # Check surface just in case
            elif surface in vocab_map:
                if len(surface) <= 2 and all('\u3040' <= c <= '\u309f' for c in surface):
                    pass # Skip bare particles
                else:
                    links_to_insert.add((gp_id, vocab_map[surface]))
                    
    print(f"Generated {len(links_to_insert)} cross-references!")

    # Insert into DB
    db.execute("DELETE FROM grammar_item_links")
    db.executemany("INSERT INTO grammar_item_links (grammar_point_id, jlpt_item_id) VALUES (?, ?)", list(links_to_insert))
    db.commit()
    print("Database updated!")

if __name__ == "__main__":
    main()
