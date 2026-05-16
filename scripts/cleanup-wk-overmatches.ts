#!/usr/bin/env npx tsx
/**
 * cleanup-wk-overmatches.ts
 *
 * Cleans three known smells in `wanikani_subjects` that came in with the seed:
 *
 *   A. Over-match: rows where wanikani_subjects.object_type does not align with
 *      the linked jlpt_items.type. Example: WK kanji subject 560 (赤) was matched
 *      to BOTH jlpt_item 233 (kanji 赤 N4) and jlpt_item 396 (vocab 赤 N5). The
 *      second link is wrong — the vocab item should be linked to WK vocabulary
 *      subject 2704 only. Action: set matched_jlpt_item_id = NULL for the
 *      wrong-type links. JLPT items are not touched; both lessons remain.
 *
 *   B. Byte-for-byte clones: identical rows that differ only in `id`. Action:
 *      keep MIN(id) per group, delete the rest.
 *
 *   C. object_type='vocab' (AI-pseudo) → 'vocabulary'. The frontend filters for
 *      'vocabulary' | 'kana_vocabulary' and misses the pseudo bucket.
 *
 * Idempotent: re-running after a clean run is a no-op.
 *
 * Usage:
 *   npx tsx scripts/cleanup-wk-overmatches.ts --dry-run
 *   npx tsx scripts/cleanup-wk-overmatches.ts
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DRY_RUN = process.argv.includes("--dry-run");
const dbPath = path.join(process.cwd(), "data", "jlpt.db");

if (!fs.existsSync(dbPath)) {
  console.error(`❌ Database not found at ${dbPath}`);
  process.exit(1);
}

// Backup before any mutation (real run only)
if (!DRY_RUN) {
  const backupPath = dbPath.replace(".db", `-backup-${Date.now()}.db`);
  fs.copyFileSync(dbPath, backupPath);
  console.log(`✅ Backup created: ${path.basename(backupPath)}`);
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = OFF");

// ── Step A: count + null over-match rows ───────────────────────────
const overmatchCount = (db.prepare(`
  SELECT COUNT(*) as c FROM wanikani_subjects w
  JOIN jlpt_items j ON j.id = w.matched_jlpt_item_id
  WHERE
    (w.object_type = 'kanji' AND j.type != 'kanji') OR
    (w.object_type IN ('vocabulary','kana_vocabulary','vocab') AND j.type != 'vocab')
`).get() as { c: number }).c;

console.log(`\nA. Over-match rows (wrong-type WK↔JLPT links): ${overmatchCount}`);

const nullOvermatch = db.prepare(`
  UPDATE wanikani_subjects
  SET matched_jlpt_item_id = NULL
  WHERE id IN (
    SELECT w.id FROM wanikani_subjects w
    JOIN jlpt_items j ON j.id = w.matched_jlpt_item_id
    WHERE
      (w.object_type = 'kanji' AND j.type != 'kanji') OR
      (w.object_type IN ('vocabulary','kana_vocabulary','vocab') AND j.type != 'vocab')
  )
`);

// ── Step B: count + delete byte-for-byte clones ────────────────────
// Group by every column except `id`. Rows where COUNT>1 means we have clones.
// Keep MIN(id) per group; delete the rest.
const cloneCount = (db.prepare(`
  SELECT COUNT(*) as c FROM (
    SELECT 1 FROM wanikani_subjects
    GROUP BY wk_subject_id, characters, meanings, readings, wk_level,
             object_type, match_type, matched_jlpt_item_id,
             component_subject_ids, amalgamation_subject_ids,
             meaning_mnemonic, reading_mnemonic, meaning_hint, reading_hint,
             context_sentences, patterns_of_use, parts_of_speech
    HAVING COUNT(*) > 1
  )
`).get() as { c: number }).c;

// Rows to be deleted = sum(COUNT-1) per group
const cloneRowsToDelete = (db.prepare(`
  SELECT COALESCE(SUM(c - 1), 0) as total FROM (
    SELECT COUNT(*) as c FROM wanikani_subjects
    GROUP BY wk_subject_id, characters, meanings, readings, wk_level,
             object_type, match_type, matched_jlpt_item_id,
             component_subject_ids, amalgamation_subject_ids,
             meaning_mnemonic, reading_mnemonic, meaning_hint, reading_hint,
             context_sentences, patterns_of_use, parts_of_speech
    HAVING COUNT(*) > 1
  )
`).get() as { total: number }).total;

console.log(`B. Clone groups: ${cloneCount} (rows to delete: ${cloneRowsToDelete})`);

const deleteClones = db.prepare(`
  DELETE FROM wanikani_subjects
  WHERE id NOT IN (
    SELECT MIN(id) FROM wanikani_subjects
    GROUP BY wk_subject_id, characters, meanings, readings, wk_level,
             object_type, match_type, matched_jlpt_item_id,
             component_subject_ids, amalgamation_subject_ids,
             meaning_mnemonic, reading_mnemonic, meaning_hint, reading_hint,
             context_sentences, patterns_of_use, parts_of_speech
  )
`);

// ── Step C → D ordering note ────────────────────────────────────────
// Step A nulls the wrong-type WK→JLPT links but leaves the rows themselves.
// Often those leftover rows are content-identical to the correctly-matched
// row for the same wk_subject_id (just with matched_jlpt_item_id = NULL now).
// Step D deletes those redundant ghosts. We do this BEFORE step B's clone
// check (to maximize the clone-group sizes), but the script applies them in
// order A → B → D → C inside the transaction.

// ── Step D: delete ghost rows (matched=NULL where a matched-non-NULL sibling exists) ──
const ghostCount = (db.prepare(`
  SELECT COUNT(*) as c
  FROM wanikani_subjects w1
  WHERE w1.matched_jlpt_item_id IS NULL
    AND EXISTS (
      SELECT 1 FROM wanikani_subjects w2
      WHERE w2.wk_subject_id = w1.wk_subject_id
        AND w2.matched_jlpt_item_id IS NOT NULL
        AND w2.id != w1.id
    )
`).get() as { c: number }).c;

console.log(`D. Ghost rows (NULL-matched siblings of matched rows): ${ghostCount}`);

const deleteGhosts = db.prepare(`
  DELETE FROM wanikani_subjects
  WHERE matched_jlpt_item_id IS NULL
    AND wk_subject_id IN (
      SELECT wk_subject_id FROM wanikani_subjects
      WHERE matched_jlpt_item_id IS NOT NULL
    )
`);

// ── Step C: count + normalize object_type='vocab' → 'vocabulary' ───
const vocabPseudoCount = (db.prepare(`
  SELECT COUNT(*) as c FROM wanikani_subjects WHERE object_type = 'vocab'
`).get() as { c: number }).c;

console.log(`C. object_type='vocab' rows to normalize: ${vocabPseudoCount}`);

const normalizeVocab = db.prepare(`
  UPDATE wanikani_subjects SET object_type = 'vocabulary' WHERE object_type = 'vocab'
`);

// ── Execute (or skip on dry-run) ───────────────────────────────────
if (DRY_RUN) {
  console.log(`\n🏃 DRY RUN — no changes made\n`);
} else {
  const run = db.transaction(() => {
    const a = nullOvermatch.run().changes;
    const b = deleteClones.run().changes;
    const d = deleteGhosts.run().changes;
    const c = normalizeVocab.run().changes;
    console.log(`\n✅ Applied: A=${a} nulled, B=${b} clones deleted, D=${d} ghosts deleted, C=${c} normalized`);
  });
  run();

  // Verify
  const remainingOvermatch = (db.prepare(`
    SELECT COUNT(*) as c FROM wanikani_subjects w
    JOIN jlpt_items j ON j.id = w.matched_jlpt_item_id
    WHERE
      (w.object_type = 'kanji' AND j.type != 'kanji') OR
      (w.object_type IN ('vocabulary','kana_vocabulary','vocab') AND j.type != 'vocab')
  `).get() as { c: number }).c;

  const remainingClones = (db.prepare(`
    SELECT COUNT(*) as c FROM (
      SELECT 1 FROM wanikani_subjects
      GROUP BY wk_subject_id, characters, meanings, readings, wk_level,
               object_type, match_type, matched_jlpt_item_id,
               component_subject_ids, amalgamation_subject_ids,
               meaning_mnemonic, reading_mnemonic, meaning_hint, reading_hint,
               context_sentences, patterns_of_use, parts_of_speech
      HAVING COUNT(*) > 1
    )
  `).get() as { c: number }).c;

  const remainingVocabPseudo = (db.prepare(`
    SELECT COUNT(*) as c FROM wanikani_subjects WHERE object_type = 'vocab'
  `).get() as { c: number }).c;

  const remainingGhosts = (db.prepare(`
    SELECT COUNT(*) as c FROM wanikani_subjects w1
    WHERE w1.matched_jlpt_item_id IS NULL
      AND EXISTS (
        SELECT 1 FROM wanikani_subjects w2
        WHERE w2.wk_subject_id = w1.wk_subject_id
          AND w2.matched_jlpt_item_id IS NOT NULL
      )
  `).get() as { c: number }).c;

  console.log(`\nVerify:`);
  console.log(`  remaining over-match rows: ${remainingOvermatch} (expect 0)`);
  console.log(`  remaining clone groups:    ${remainingClones} (expect 0)`);
  console.log(`  remaining ghosts:          ${remainingGhosts} (expect 0)`);
  console.log(`  remaining vocab pseudo:    ${remainingVocabPseudo} (expect 0)`);
}

db.close();
