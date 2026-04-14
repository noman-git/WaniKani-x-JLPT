#!/usr/bin/env npx tsx
/**
 * dedup-items.ts
 * 
 * Deduplicates jlpt_items rows where the same expression+type appears
 * more than once (44 duplicate kanji pairs from different sources).
 * 
 * For each duplicate group it:
 *   1. Picks a "keeper" — the entry with more readings, then richer meaning,
 *      then lower JLPT level number (N5 > N4 numerically, but N4 is harder).
 *   2. Reassigns all FK references to the keeper:
 *        - wanikani_subjects.matched_jlpt_item_id
 *        - wanikani_radicals.matched_jlpt_item_id
 *        - grammar_item_links.jlpt_item_id
 *        - user_progress.jlpt_item_id
 *        - user_notes.jlpt_item_id
 *   3. Merges meanings/readings from the loser into the keeper.
 *   4. Deletes the loser row.
 * 
 * Run:  npx tsx scripts/dedup-items.ts [--dry-run]
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DRY_RUN = process.argv.includes("--dry-run");
const dbPath = path.join(process.cwd(), "data", "jlpt.db");

// Backup first
const backupPath = dbPath.replace(".db", `-backup-${Date.now()}.db`);
fs.copyFileSync(dbPath, backupPath);
console.log(`✅ Backup created: ${path.basename(backupPath)}`);

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = OFF"); // We handle FK integrity ourselves

// ── Find all duplicate groups (same expression + type, multiple rows) ──
const dupeGroups = db.prepare(`
  SELECT expression, type, GROUP_CONCAT(id) as ids
  FROM jlpt_items
  WHERE type IN ('kanji', 'vocab')
  GROUP BY expression, type
  HAVING COUNT(*) > 1
  ORDER BY expression
`).all() as Array<{ expression: string; type: string; ids: string }>;

console.log(`\n🔍 Found ${dupeGroups.length} duplicate groups\n`);

if (dupeGroups.length === 0) {
  console.log("Nothing to do!");
  db.close();
  process.exit(0);
}

// ── Prepare statements ──
const getItem = db.prepare(`SELECT * FROM jlpt_items WHERE id = ?`);

// FK update statements
const updateWkSubjects = db.prepare(`UPDATE wanikani_subjects SET matched_jlpt_item_id = ? WHERE matched_jlpt_item_id = ?`);
const updateWkRadicals = db.prepare(`UPDATE wanikani_radicals SET matched_jlpt_item_id = ? WHERE matched_jlpt_item_id = ?`);
const updateUserProgress = db.prepare(`UPDATE user_progress SET jlpt_item_id = ? WHERE jlpt_item_id = ? AND NOT EXISTS (SELECT 1 FROM user_progress WHERE user_id = (SELECT user_id FROM user_progress WHERE jlpt_item_id = ?) AND jlpt_item_id = ?)`);
const deleteOrphanProgress = db.prepare(`DELETE FROM user_progress WHERE jlpt_item_id = ?`);
const updateUserNotes = db.prepare(`UPDATE user_notes SET jlpt_item_id = ? WHERE jlpt_item_id = ? AND NOT EXISTS (SELECT 1 FROM user_notes WHERE user_id = (SELECT user_id FROM user_notes WHERE jlpt_item_id = ?) AND jlpt_item_id = ?)`);
const deleteOrphanNotes = db.prepare(`DELETE FROM user_notes WHERE jlpt_item_id = ?`);

// Grammar links: move non-duplicate links, delete remaining
const moveGrammarLinks = db.prepare(`
  UPDATE grammar_item_links SET jlpt_item_id = ?
  WHERE jlpt_item_id = ?
    AND grammar_point_id NOT IN (
      SELECT grammar_point_id FROM grammar_item_links WHERE jlpt_item_id = ?
    )
`);
const deleteGrammarLinks = db.prepare(`DELETE FROM grammar_item_links WHERE jlpt_item_id = ?`);

// Update and delete items
const updateItem = db.prepare(`UPDATE jlpt_items SET reading = ?, meaning = ?, sources = ? WHERE id = ?`);
const deleteItem = db.prepare(`DELETE FROM jlpt_items WHERE id = ?`);

// ── Merge helper: combine readings and meanings without duplication ──
function mergeReadings(a: string, b: string): string {
  const setA = new Set(a.split("/").map(s => s.trim()).filter(Boolean));
  const setB = b.split("/").map(s => s.trim()).filter(Boolean);
  for (const r of setB) setA.add(r);
  return [...setA].join("/");
}

function mergeMeanings(a: string, b: string): string {
  // Split on semicolons and commas, normalize
  const normalize = (s: string) => s.trim().toLowerCase();
  const partsA = a.split(/[;,]/).map(s => s.trim()).filter(Boolean);
  const seen = new Set(partsA.map(normalize));
  const partsB = b.split(/[;,]/).map(s => s.trim()).filter(Boolean);
  for (const m of partsB) {
    if (!seen.has(normalize(m))) {
      partsA.push(m);
      seen.add(normalize(m));
    }
  }
  return partsA.join("; ");
}

function mergeSources(a: string, b: string): string {
  const setA = new Set<string>();
  // Sources can be a plain string or a JSON array
  for (const raw of [a, b]) {
    if (raw.startsWith("[")) {
      try {
        const arr = JSON.parse(raw) as string[];
        arr.forEach(s => setA.add(s));
      } catch { setA.add(raw); }
    } else if (raw) {
      setA.add(raw);
    }
  }
  return [...setA].join(",");
}

// ── Score an item to pick the keeper (higher = better) ──
function itemScore(item: any): number {
  let score = 0;
  // More readings = more informative
  score += (item.reading || "").split("/").length * 10;
  // Longer meaning = richer
  score += (item.meaning || "").length;
  // Lower JLPT number = harder level (prefer keeping N4 over N5)
  const level = parseInt((item.jlpt_level || "N5").replace("N", ""));
  score += (6 - level) * 5; // N4 → 10, N5 → 5
  return score;
}

// ── Process each duplicate group ──
let totalDeleted = 0;
let totalFksMoved = 0;

const runDedup = db.transaction(() => {
  for (const group of dupeGroups) {
    const ids = group.ids.split(",").map(Number);
    const items = ids.map(id => getItem.get(id) as any);

    // Sort by score descending — first one is keeper
    items.sort((a, b) => itemScore(b) - itemScore(a));
    const keeper = items[0];
    const losers = items.slice(1);

    console.log(`📦 ${group.expression} (${group.type})`);
    console.log(`   Keeper: id=${keeper.id} level=${keeper.jlpt_level} source=${keeper.sources}`);

    for (const loser of losers) {
      console.log(`   Loser:  id=${loser.id} level=${loser.jlpt_level} source=${loser.sources}`);

      // 1. Merge readings/meanings into keeper
      const mergedReading = mergeReadings(keeper.reading, loser.reading);
      const mergedMeaning = mergeMeanings(keeper.meaning, loser.meaning);
      const mergedSources = mergeSources(keeper.sources, loser.sources);

      if (!DRY_RUN) {
        updateItem.run(mergedReading, mergedMeaning, mergedSources, keeper.id);
      }

      // 2. Move FK references from loser → keeper
      let fksMoved = 0;

      // wanikani_subjects
      const wkResult = DRY_RUN ? { changes: 0 } : updateWkSubjects.run(keeper.id, loser.id);
      fksMoved += wkResult.changes;

      // wanikani_radicals
      const wrResult = DRY_RUN ? { changes: 0 } : updateWkRadicals.run(keeper.id, loser.id);
      fksMoved += wrResult.changes;

      // user_progress (handle UNIQUE constraint)
      if (!DRY_RUN) {
        const upResult = updateUserProgress.run(keeper.id, loser.id, loser.id, keeper.id);
        fksMoved += upResult.changes;
        deleteOrphanProgress.run(loser.id); // Clean up any remaining
      }

      // user_notes (handle UNIQUE constraint)
      if (!DRY_RUN) {
        const unResult = updateUserNotes.run(keeper.id, loser.id, loser.id, keeper.id);
        fksMoved += unResult.changes;
        deleteOrphanNotes.run(loser.id);
      }

      // grammar_item_links (move non-conflicting, delete rest)
      if (!DRY_RUN) {
        const glResult = moveGrammarLinks.run(keeper.id, loser.id, keeper.id);
        fksMoved += glResult.changes;
        deleteGrammarLinks.run(loser.id);
      }

      // 3. Delete the loser item
      if (!DRY_RUN) {
        deleteItem.run(loser.id);
      }

      console.log(`   → Merged: reading="${mergedReading}" meaning="${mergedMeaning}"`);
      console.log(`   → FKs moved: ${fksMoved}`);
      totalFksMoved += fksMoved;
      totalDeleted++;
    }
    console.log();
  }
});

if (DRY_RUN) {
  console.log("🏃 DRY RUN — no changes made\n");
  runDedup();
  console.log(`Would delete ${totalDeleted} duplicate items`);
} else {
  runDedup();
  console.log(`\n✅ Done! Deleted ${totalDeleted} duplicate items, moved ${totalFksMoved} FK references`);
}

// Verify no duplicates remain
const remaining = db.prepare(`
  SELECT expression, type, COUNT(*) as cnt
  FROM jlpt_items
  WHERE type IN ('kanji', 'vocab')
  GROUP BY expression, type
  HAVING cnt > 1
`).all();

if (remaining.length > 0) {
  console.log(`\n⚠️  ${remaining.length} duplicates still remain (vocab with different readings are expected):`);
  for (const r of remaining as any[]) {
    console.log(`   ${r.expression} (${r.type}) × ${r.cnt}`);
  }
} else {
  console.log("\n✅ No duplicates remain!");
}

db.close();
