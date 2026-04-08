import { db } from "../src/lib/db";
import { jlptItems, wanikaniSubjects } from "../src/lib/db/schema";
import { eq, isNull, and, ne } from "drizzle-orm";
import Database from "better-sqlite3";
import path from "path";

async function main() {
  console.log("Analyzing AI Vocab for Prerequisites and Leveling...");
  
  const dbPath = path.join(process.cwd(), "data", "jlpt.db");
  const rawDb = new Database(dbPath);

  // 1. Get all Vocab items that have a WK mapping but missing components (or have wk_level = 0)
  // Our custom AI items have wk_level = 0 and component_subject_ids = NULL
  const query = `
    SELECT j.id as jlptItemId, j.expression, j.jlpt_level, w.id as wkRowId, w.wk_subject_id
    FROM jlpt_items j
    INNER JOIN wanikani_subjects w ON w.matched_jlpt_item_id = j.id
    WHERE j.type = 'vocab' 
      AND (w.component_subject_ids IS NULL OR w.wk_level = 0)
  `;
  
  const targets = rawDb.prepare(query).all() as any[];
  console.log(`Found ${targets.length} custom vocabulary items requiring enrichment.`);

  // 2. Load all Kanji items and their WK Subjects lookup map
  const kanjiMapRows = rawDb.prepare(`
    SELECT j.expression, j.id as jlptItemId, w.wk_subject_id, w.wk_level
    FROM jlpt_items j
    LEFT JOIN wanikani_subjects w ON w.matched_jlpt_item_id = j.id
    WHERE j.type = 'kanji' AND w.wk_subject_id IS NOT NULL
  `).all() as any[];

  // Also query WaniKani official Kanji in case the Kanji isn't in JLPT items but IS in WaniKani
  // Example: 御 is 'other' level, we just added it, it has a wk_subject_id!
  // It is covered by the LEFT JOIN above since it is in jlpt_items now.

  const kanjiExpToWk = new Map<string, { subjectId: number, level: number }>();
  for (const row of kanjiMapRows) {
    kanjiExpToWk.set(row.expression, { subjectId: row.wk_subject_id, level: row.wk_level });
  }

  let updatedCount = 0;

  for (const item of targets) {
     // Extract Kanji CJK characters
     const chars = [...item.expression].filter((ch) => {
        const code = ch.charCodeAt(0);
        return code >= 0x4e00 && code <= 0x9fff; // CJK Unified Ideographs
     });

     const uniqueChars = [...new Set(chars)];
     
     let highestWkLevel = 0;
     const componentIds: number[] = [];
     
     for (const char of uniqueChars) {
        const kanjiData = kanjiExpToWk.get(char);
        if (kanjiData) {
            componentIds.push(kanjiData.subjectId);
            if (kanjiData.level > highestWkLevel) {
               highestWkLevel = kanjiData.level;
            }
        } else {
            // What if a Kanji is completely missing from WANIKANI?
            // Extremely rare, but we ignore it for component dependencies.
        }
     }

     let newWkLevel = highestWkLevel;
     let componentStr: string | null = componentIds.length > 0 ? JSON.stringify(componentIds) : null;

     // Kana-only vocabulary handling
     if (uniqueChars.length === 0) {
        // Spray Kana Vocab across early WK Levels depending on JLPT Level
        // N5 -> spread levels 2 to 10
        // N4 -> spread levels 11 to 25
        if (item.jlpt_level === "N5") {
             // Math.floor(Math.random() * 9) + 2 // random 2-10
             // To be deterministic, hash the expression length + id modulo 9
             newWkLevel = ((item.expression.length * 7 + item.jlptItemId) % 9) + 2; 
        } else if (item.jlpt_level === "N4") {
             newWkLevel = ((item.expression.length * 7 + item.jlptItemId) % 15) + 11;
        } else {
             newWkLevel = 25;
        }
        componentStr = null;
     }

     if (newWkLevel === 0) {
         // Fallback if kanji existed but had no WK level
         newWkLevel = item.jlpt_level === "N5" ? 5 : 15;
     }

     rawDb.prepare(`
       UPDATE wanikani_subjects
       SET wk_level = ?, component_subject_ids = ?
       WHERE id = ?
     `).run(newWkLevel, componentStr, item.wkRowId);

     updatedCount++;
  }

  rawDb.close();
  console.log(`✅ Successfully enriched ${updatedCount} JLPT items!`);
}

main().catch(console.error);
