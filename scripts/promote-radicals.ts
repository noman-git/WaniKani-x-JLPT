import { db } from "../src/lib/db";
import { jlptItems } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";
import Database from "better-sqlite3";
import path from "path";

async function main() {
  console.log("Analyzing Radicals to dynamically assign JLPT Levels from their Kanji...");
  
  const dbPath = path.join(process.cwd(), "data", "jlpt.db");
  const rawDb = new Database(dbPath);

  // 1. Get all JLPT Kanji that have a WK mapping, and their component radical IDs
  const kanjiRows = rawDb.prepare(`
    SELECT j.id as jlptItemId, j.expression, j.jlpt_level, w.component_subject_ids
    FROM jlpt_items j
    INNER JOIN wanikani_subjects w ON w.matched_jlpt_item_id = j.id
    WHERE j.type = 'kanji' AND w.component_subject_ids IS NOT NULL
  `).all() as any[];

  // 2. Build a map of WK Radical Subject ID -> Lowest JLPT Level 
  const jlptWeights: Record<string, number> = {
    "N5": 1,
    "N4": 2,
    "N3": 3,
    "N2": 4,
    "N1": 5,
    "other": 99
  };

  const invertedWeights = {
    1: "N5",
    2: "N4",
    3: "N3",
    4: "N2",
    5: "N1",
    99: "other"
  };

  const radicalToJlptLevelWeight = new Map<number, number>();

  for (const kanji of kanjiRows) {
     const weight = jlptWeights[kanji.jlpt_level as string] || 99;
     let componentIds: number[] = [];
     try {
       componentIds = JSON.parse(kanji.component_subject_ids);
     } catch(e) {}

     for (const radId of componentIds) {
        if (!radicalToJlptLevelWeight.has(radId)) {
           radicalToJlptLevelWeight.set(radId, weight);
        } else {
           // update if this kanji is a "lower" number (e.g. N5 (1) is lower than N4 (2))
           if (weight < radicalToJlptLevelWeight.get(radId)!) {
              radicalToJlptLevelWeight.set(radId, weight);
           }
        }
     }
  }

  // 3. Find all Radicals in jlpt_items
  const radicalRows = rawDb.prepare(`
     SELECT j.id as jlptItemId, r.wk_subject_id
     FROM jlpt_items j
     INNER JOIN wanikani_radicals r ON r.matched_jlpt_item_id = j.id
     WHERE j.type = 'radical'
  `).all() as any[];

  let updatedCount = 0;

  for (const row of radicalRows) {
     const lowestWeight = radicalToJlptLevelWeight.get(row.wk_subject_id);
     if (lowestWeight && lowestWeight < 99) {
        const jlptLevel = invertedWeights[lowestWeight as keyof typeof invertedWeights];
        rawDb.prepare(`UPDATE jlpt_items SET jlpt_level = ? WHERE id = ?`).run(jlptLevel, row.jlptItemId);
        updatedCount++;
     } else {
        // If it isn't found in any tracked N5/N4/ect. kanji, fallback to 'other'
        rawDb.prepare(`UPDATE jlpt_items SET jlpt_level = 'other' WHERE id = ?`).run(row.jlptItemId);
     }
  }

  rawDb.close();
  console.log(`✅ Successfully assigned lowest JLPT Level to ${updatedCount} Radicals!`);
}

main().catch(console.error);
