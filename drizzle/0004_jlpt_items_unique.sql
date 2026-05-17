-- Enforce within-type uniqueness on jlpt_items. Cross-type duplication
-- (e.g. a kanji 「主」 and a vocab 「主」) is intentional — three rows per
-- character across types is the lesson model. But two `kanji`+`kanji`
-- rows for the same expression, or two `vocab`+`vocab`, is always a bug.
--
-- Current seed has zero rows that violate this; verified before adding.
CREATE UNIQUE INDEX IF NOT EXISTS `jlpt_items_expression_type_unique`
  ON `jlpt_items` (`expression`, `type`);
