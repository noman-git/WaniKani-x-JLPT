#!/usr/bin/env npx tsx
/**
 * cleanup-wk-overmatches.ts
 *
 * Cleans known smells in `wanikani_subjects` that came in with the seed:
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
 *   D. Ghost rows: a NULL-matched row alongside a non-NULL-matched sibling for
 *      the same wk_subject_id. Keep the matched one; delete the ghost.
 *
 *   E. Orphan pairs: two-plus rows for the same wk_subject_id where ALL rows
 *      have matched_jlpt_item_id = NULL. Step B misses these because the rows
 *      differ in match_type (one carries the original 'prefix_strip'/'reading'
 *      tag, the other was the unmatched copy); Step D misses them because
 *      neither has a matched sibling. Survivor rule: prefer a row with a
 *      non-empty match_type (so 'prefix_strip'/'reading' tags survive); break
 *      ties by MIN(id). Delete the rest.
 *
 *   F. Multi-match: same wk_subject_id matched to two different jlpt_items.
 *      The partial unique index allows this. Survivor rule: prefer the row
 *      whose matched jlpt_items.expression equals wk.characters (e.g. for
 *      WK 6475 「伺う」 this keeps the 伺う kanji-form jlpt_item over the
 *      うかがう kana-form one); break ties by MIN(id). Delete the rest.
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

// ── Ordering note ───────────────────────────────────────────────────
// Step A nulls the wrong-type WK→JLPT links but leaves the rows themselves.
// Often those leftover rows are content-identical to the correctly-matched
// row for the same wk_subject_id (just with matched_jlpt_item_id = NULL now).
// Step D deletes those redundant ghosts. Step E mops up the case where Step A
// produced TWO null-matched rows for the same wk_id (so Step D's "has a
// matched sibling" condition doesn't fire). Step F resolves multi-match
// groups (same wk_id matched to two different jlpt_items).
// Apply order inside the transaction: A → F → D → E → B → C.

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

// ── Step E: collapse orphan pairs (multi NULL-matched rows for same wk_id) ──
const orphanPairCount = (db.prepare(`
  SELECT COUNT(*) as c FROM (
    SELECT wk_subject_id FROM wanikani_subjects
    WHERE matched_jlpt_item_id IS NULL
    GROUP BY wk_subject_id
    HAVING COUNT(*) > 1
  )
`).get() as { c: number }).c;

const orphanRowsToDelete = (db.prepare(`
  SELECT COALESCE(SUM(c - 1), 0) as total FROM (
    SELECT COUNT(*) as c FROM wanikani_subjects
    WHERE matched_jlpt_item_id IS NULL
    GROUP BY wk_subject_id
    HAVING COUNT(*) > 1
  )
`).get() as { total: number }).total;

console.log(`E. Orphan-pair groups (multi NULL-matched for same wk_id): ${orphanPairCount} (rows to delete: ${orphanRowsToDelete})`);

// Survivor per group: row with a non-empty match_type wins
// (preserves 'prefix_strip'/'reading'); ties broken by MIN(id).
const deleteOrphans = db.prepare(`
  DELETE FROM wanikani_subjects
  WHERE id IN (
    SELECT id FROM (
      SELECT id,
        ROW_NUMBER() OVER (
          PARTITION BY wk_subject_id
          ORDER BY
            CASE WHEN match_type IS NOT NULL AND match_type != '' THEN 0 ELSE 1 END,
            id
        ) AS rn,
        COUNT(*) OVER (PARTITION BY wk_subject_id) AS grp_size
      FROM wanikani_subjects
      WHERE matched_jlpt_item_id IS NULL
    )
    WHERE grp_size > 1 AND rn > 1
  )
`);

// ── Step F: resolve multi-match (same wk_id, different jlpt_item matches) ──
const multiMatchCount = (db.prepare(`
  SELECT COUNT(*) as c FROM (
    SELECT wk_subject_id FROM wanikani_subjects
    WHERE matched_jlpt_item_id IS NOT NULL
    GROUP BY wk_subject_id
    HAVING COUNT(*) > 1
  )
`).get() as { c: number }).c;

const multiMatchRowsToDelete = (db.prepare(`
  SELECT COALESCE(SUM(c - 1), 0) as total FROM (
    SELECT COUNT(*) as c FROM wanikani_subjects
    WHERE matched_jlpt_item_id IS NOT NULL
    GROUP BY wk_subject_id
    HAVING COUNT(*) > 1
  )
`).get() as { total: number }).total;

console.log(`F. Multi-match groups (same wk_id matched to multiple jlpt_items): ${multiMatchCount} (rows to delete: ${multiMatchRowsToDelete})`);

// Survivor: row whose linked jlpt_items.expression equals wk.characters wins
// (prefers the kanji-form match over the kana-form); ties broken by MIN(id).
const deleteMultiMatch = db.prepare(`
  DELETE FROM wanikani_subjects
  WHERE id IN (
    SELECT id FROM (
      SELECT w.id,
        ROW_NUMBER() OVER (
          PARTITION BY w.wk_subject_id
          ORDER BY
            CASE WHEN j.expression = w.characters THEN 0 ELSE 1 END,
            w.id
        ) AS rn,
        COUNT(*) OVER (PARTITION BY w.wk_subject_id) AS grp_size
      FROM wanikani_subjects w
      LEFT JOIN jlpt_items j ON j.id = w.matched_jlpt_item_id
      WHERE w.matched_jlpt_item_id IS NOT NULL
    )
    WHERE grp_size > 1 AND rn > 1
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
    const f = deleteMultiMatch.run().changes;
    const d = deleteGhosts.run().changes;
    const e = deleteOrphans.run().changes;
    const b = deleteClones.run().changes;
    const c = normalizeVocab.run().changes;
    console.log(`\n✅ Applied: A=${a} nulled, F=${f} multi-match deleted, D=${d} ghosts deleted, E=${e} orphans deleted, B=${b} clones deleted, C=${c} normalized`);
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

  const remainingOrphans = (db.prepare(`
    SELECT COUNT(*) as c FROM (
      SELECT wk_subject_id FROM wanikani_subjects
      WHERE matched_jlpt_item_id IS NULL
      GROUP BY wk_subject_id
      HAVING COUNT(*) > 1
    )
  `).get() as { c: number }).c;

  const remainingMultiMatch = (db.prepare(`
    SELECT COUNT(*) as c FROM (
      SELECT wk_subject_id FROM wanikani_subjects
      WHERE matched_jlpt_item_id IS NOT NULL
      GROUP BY wk_subject_id
      HAVING COUNT(*) > 1
    )
  `).get() as { c: number }).c;

  console.log(`\nVerify:`);
  console.log(`  remaining over-match rows:    ${remainingOvermatch} (expect 0)`);
  console.log(`  remaining clone groups:       ${remainingClones} (expect 0)`);
  console.log(`  remaining ghosts:             ${remainingGhosts} (expect 0)`);
  console.log(`  remaining orphan pairs:       ${remainingOrphans} (expect 0)`);
  console.log(`  remaining multi-match groups: ${remainingMultiMatch} (expect 0)`);
  console.log(`  remaining vocab pseudo:       ${remainingVocabPseudo} (expect 0)`);
}

db.close();
