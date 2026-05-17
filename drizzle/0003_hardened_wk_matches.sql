-- Harden wanikani_subjects against the two import-script bugs that produced
-- the cleanup-wk-overmatches.ts payload.
--
-- 1. Partial UNIQUE on (wk_subject_id, matched_jlpt_item_id) WHERE NOT NULL:
--    prevents byte-for-byte clones of the same WK→JLPT link. Allows multiple
--    NULL matched_jlpt_item_id rows (correct — most WK subjects are unmatched).
--
-- 2. BEFORE INSERT/UPDATE triggers enforcing object_type ↔ jlpt_items.type
--    alignment. SQLite CHECK constraints cannot reference another table, so
--    we use triggers that raise ABORT on mismatch.

CREATE UNIQUE INDEX IF NOT EXISTS `wanikani_subjects_wk_match_unique`
  ON `wanikani_subjects` (`wk_subject_id`, `matched_jlpt_item_id`)
  WHERE `matched_jlpt_item_id` IS NOT NULL;
--> statement-breakpoint

DROP TRIGGER IF EXISTS `wanikani_subjects_type_align_insert`;
--> statement-breakpoint

CREATE TRIGGER `wanikani_subjects_type_align_insert`
BEFORE INSERT ON `wanikani_subjects`
FOR EACH ROW
WHEN NEW.matched_jlpt_item_id IS NOT NULL
BEGIN
  SELECT CASE
    WHEN NEW.object_type = 'kanji'
      AND (SELECT type FROM jlpt_items WHERE id = NEW.matched_jlpt_item_id) != 'kanji'
    THEN RAISE(ABORT, 'wanikani_subjects: kanji subject cannot match non-kanji jlpt_item')
    WHEN NEW.object_type IN ('vocabulary', 'kana_vocabulary')
      AND (SELECT type FROM jlpt_items WHERE id = NEW.matched_jlpt_item_id) != 'vocab'
    THEN RAISE(ABORT, 'wanikani_subjects: vocab subject cannot match non-vocab jlpt_item')
  END;
END;
--> statement-breakpoint

DROP TRIGGER IF EXISTS `wanikani_subjects_type_align_update`;
--> statement-breakpoint

CREATE TRIGGER `wanikani_subjects_type_align_update`
BEFORE UPDATE OF object_type, matched_jlpt_item_id ON `wanikani_subjects`
FOR EACH ROW
WHEN NEW.matched_jlpt_item_id IS NOT NULL
BEGIN
  SELECT CASE
    WHEN NEW.object_type = 'kanji'
      AND (SELECT type FROM jlpt_items WHERE id = NEW.matched_jlpt_item_id) != 'kanji'
    THEN RAISE(ABORT, 'wanikani_subjects: kanji subject cannot match non-kanji jlpt_item')
    WHEN NEW.object_type IN ('vocabulary', 'kana_vocabulary')
      AND (SELECT type FROM jlpt_items WHERE id = NEW.matched_jlpt_item_id) != 'vocab'
    THEN RAISE(ABORT, 'wanikani_subjects: vocab subject cannot match non-vocab jlpt_item')
  END;
END;
