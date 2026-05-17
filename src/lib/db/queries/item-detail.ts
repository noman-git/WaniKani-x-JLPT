import { sqlite } from "@/lib/db";

interface WKMeaningRow {
  meaning: string;
  primary: boolean;
  accepted_answer: boolean;
}

interface WKReadingRow {
  reading: string;
  type: string | null;
  primary: boolean;
  accepted_answer: boolean;
}

interface RadicalRow {
  wk_subject_id: number;
  characters: string | null;
  meanings: string;
  wk_level: number;
  character_image_url: string | null;
}

interface JlptItemRow {
  id: number;
  expression: string;
  reading: string;
  meaning: string;
  type: string;
  jlptLevel: string;
  sources: string;
}

interface WkSubjectRow {
  wk_subject_id: number;
  characters: string | null;
  meanings: string;
  readings: string;
  wk_level: number;
  object_type: string;
  match_type: string | null;
  component_subject_ids: string | null;
  amalgamation_subject_ids: string | null;
  meaning_mnemonic: string | null;
  reading_mnemonic: string | null;
  meaning_hint: string | null;
  reading_hint: string | null;
  context_sentences: string | null;
  patterns_of_use: string | null;
  parts_of_speech: string | null;
}

type PrimaryWk = (WkSubjectRow & { imageUrl?: string | null }) | null;

export interface ItemDetail {
  item: JlptItemRow & { status: string };
  note: string;
  wanikani: {
    subjectId: number;
    level: number;
    objectType: string;
    characters: string | null;
    matchType: string | null;
    meanings: WKMeaningRow[];
    readings: WKReadingRow[];
    radicals: Array<{
      id: number;
      characters: string | null;
      meaning: string;
      imageUrl: string | null;
      level: number;
    }>;
    meaningMnemonic: string | null;
    readingMnemonic: string | null;
    meaningHint: string | null;
    readingHint: string | null;
    contextSentences: Array<{ en: string; ja: string }> | null;
    patternsOfUse: Array<{ en: string; ja: string }> | null;
    partsOfSpeech: string[] | null;
    imageUrl?: string | null;
  } | null;
  relatedVocab: Array<{
    id: number;
    expression: string;
    reading: string;
    meaning: string;
    type: string;
    jlptLevel: string;
  }>;
  usedInKanji: Array<{
    id: number;
    expression: string;
    reading: string;
    meaning: string;
    type: string;
    jlptLevel: string;
  }>;
  componentKanji: Array<{
    id: number | null;
    expression: string;
    reading: string;
    meaning: string;
    jlptLevel: string | null;
    wkLevel: number | null;
  }>;
  linkedGrammar: Array<{
    id: number;
    slug: string;
    title: string;
    titleRomaji: string;
    meaning: string;
    jlptLevel: string;
  }>;
}

// Prepared statements (created once, reused across requests)
const getJlptItem = sqlite.prepare(
  `SELECT id, expression, reading, meaning, type, jlpt_level as jlptLevel, sources
   FROM jlpt_items WHERE id = ?`,
);
const getProgress = sqlite.prepare(
  `SELECT status FROM user_progress WHERE jlpt_item_id = ? AND user_id = ?`,
);
const getNote = sqlite.prepare(
  `SELECT content FROM user_notes WHERE jlpt_item_id = ? AND user_id = ?`,
);
const getWkRadical = sqlite.prepare(
  `SELECT wk_subject_id, characters, meanings, wk_level, character_image_url,
          meaning_mnemonic, meaning_hint, amalgamation_subject_ids
   FROM wanikani_radicals WHERE matched_jlpt_item_id = ?`,
);
const getWkSubjects = sqlite.prepare(
  `SELECT wk_subject_id, characters, meanings, readings, wk_level,
          object_type, match_type, component_subject_ids, amalgamation_subject_ids,
          meaning_mnemonic, reading_mnemonic, meaning_hint, reading_hint,
          context_sentences, patterns_of_use, parts_of_speech
   FROM wanikani_subjects WHERE matched_jlpt_item_id = ?`,
);
const getRelatedVocabForKanji = sqlite.prepare(
  `SELECT j.id, j.expression, j.reading, j.meaning, j.type, j.jlpt_level as jlptLevel
   FROM jlpt_items j
   LEFT JOIN wanikani_subjects w ON w.matched_jlpt_item_id = j.id
   WHERE j.type = 'vocab' AND j.expression LIKE ? AND j.expression != ?
   GROUP BY j.id
   ORDER BY MIN(w.wk_level) ASC NULLS LAST, j.jlpt_level ASC, j.expression ASC
   LIMIT 30`,
);
const getUsedInKanjiForRadical = sqlite.prepare(
  `SELECT j.id, j.expression, j.reading, j.meaning, j.type, j.jlpt_level as jlptLevel
   FROM wanikani_subjects w
   INNER JOIN jlpt_items j ON w.matched_jlpt_item_id = j.id
   JOIN json_each(w.component_subject_ids) as comp
   WHERE comp.value = ? AND j.type = 'kanji'
   GROUP BY j.id
   ORDER BY MIN(w.wk_level) ASC NULLS LAST, j.jlpt_level ASC, j.expression ASC
   LIMIT 50`,
);
const getLinkedGrammar = sqlite.prepare(
  `SELECT g.id, g.slug, g.title, g.title_romaji as titleRomaji, g.meaning, g.jlpt_level as jlptLevel
   FROM grammar_points g
   INNER JOIN grammar_item_links l ON l.grammar_point_id = g.id
   WHERE l.jlpt_item_id = ?
   ORDER BY g.jlpt_level ASC, g.id ASC`,
);

function pickPrimaryWk(item: JlptItemRow, itemId: number): PrimaryWk {
  if (item.type === "radical") {
    const radRow = getWkRadical.get(itemId) as RadicalRow & {
      meaning_mnemonic: string | null;
      meaning_hint: string | null;
      amalgamation_subject_ids: string | null;
    } | undefined;
    if (!radRow) return null;
    const meaningsWithAccepted = JSON.stringify(
      (JSON.parse(radRow.meanings) as WKMeaningRow[]).map((m) => ({
        ...m,
        accepted_answer: true,
      })),
    );
    return {
      wk_subject_id: radRow.wk_subject_id,
      characters: radRow.characters,
      meanings: meaningsWithAccepted,
      readings: "[]",
      wk_level: radRow.wk_level,
      object_type: "radical",
      match_type: "radical",
      component_subject_ids: null,
      amalgamation_subject_ids: radRow.amalgamation_subject_ids,
      meaning_mnemonic: radRow.meaning_mnemonic,
      reading_mnemonic: null,
      meaning_hint: radRow.meaning_hint,
      reading_hint: null,
      context_sentences: null,
      patterns_of_use: null,
      parts_of_speech: null,
      imageUrl: radRow.character_image_url,
    };
  }
  const wkRows = getWkSubjects.all(itemId) as WkSubjectRow[];
  if (wkRows.length === 0) return null;
  if (item.type === "kanji") {
    const kanjiMatch = wkRows.find((r) => r.object_type === "kanji");
    if (kanjiMatch) return kanjiMatch;
  } else {
    // vocab
    const vocabMatch = wkRows.find(
      (r) => r.object_type === "vocabulary" || r.object_type === "kana_vocabulary",
    );
    if (vocabMatch) return vocabMatch;
  }
  return wkRows[0];
}

function resolveComponentRadicals(primaryWk: PrimaryWk) {
  if (!primaryWk?.component_subject_ids) return [];
  const componentIds: number[] = JSON.parse(primaryWk.component_subject_ids);
  if (componentIds.length === 0) return [];
  const placeholders = componentIds.map(() => "?").join(",");
  const radicalRows = sqlite
    .prepare(
      `SELECT wk_subject_id, characters, meanings, wk_level, character_image_url
       FROM wanikani_radicals WHERE wk_subject_id IN (${placeholders})`,
    )
    .all(...componentIds) as RadicalRow[];
  return radicalRows.map((r) => {
    const meanings: Array<{ meaning: string; primary: boolean }> = JSON.parse(r.meanings);
    const primaryMeaning = meanings.find((m) => m.primary)?.meaning || meanings[0]?.meaning || "";
    return {
      id: r.wk_subject_id,
      characters: r.characters,
      meaning: primaryMeaning,
      imageUrl: r.character_image_url,
      level: r.wk_level,
    };
  });
}

function resolveComponentKanji(item: JlptItemRow): ItemDetail["componentKanji"] {
  if (item.type !== "vocab") return [];

  // Extract unique CJK Unified Ideographs from the expression
  const kanjiChars = [...new Set(
    item.expression.split("").filter((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 0x4e00 && code <= 0x9fff;
    }),
  )];
  if (kanjiChars.length === 0) return [];

  const placeholders = kanjiChars.map(() => "?").join(",");

  // First pass: get kanji from jlpt_items (preferred)
  const jlptRaw = sqlite
    .prepare(
      `SELECT j.id, j.expression, j.reading, j.meaning, j.jlpt_level as jlptLevel, MIN(w.wk_level) as wkLevel
       FROM jlpt_items j
       LEFT JOIN wanikani_subjects w ON w.matched_jlpt_item_id = j.id
       WHERE j.type = 'kanji' AND j.expression IN (${placeholders})
       GROUP BY j.id
       ORDER BY MIN(w.wk_level) ASC NULLS LAST, j.jlpt_level ASC`,
    )
    .all(...kanjiChars) as Array<{
      id: number;
      expression: string;
      reading: string;
      meaning: string;
      jlptLevel: string;
      wkLevel: number | null;
    }>;

  // Dedupe by expression (keeps lowest-WK-level row)
  const jlptSeen = new Set<string>();
  const jlptKanji = jlptRaw.filter((k) => {
    if (jlptSeen.has(k.expression)) return false;
    jlptSeen.add(k.expression);
    return true;
  });

  // Second pass: for chars NOT in JLPT, fall back to wanikani_subjects
  const foundJlpt = new Set(jlptKanji.map((k) => k.expression));
  const missingChars = kanjiChars.filter((c) => !foundJlpt.has(c));
  let wkKanji: Array<{
    id: null;
    expression: string;
    reading: string;
    meaning: string;
    jlptLevel: null;
    wkLevel: number;
  }> = [];

  if (missingChars.length > 0) {
    const missingPlaceholders = missingChars.map(() => "?").join(",");
    const wkRows = sqlite
      .prepare(
        `SELECT characters, meanings, readings, wk_level
         FROM wanikani_subjects
         WHERE object_type = 'kanji' AND characters IN (${missingPlaceholders})
         GROUP BY characters
         ORDER BY wk_level ASC`,
      )
      .all(...missingChars) as Array<{
        characters: string;
        meanings: string;
        readings: string;
        wk_level: number;
      }>;
    wkKanji = wkRows.map((r) => {
      const meanings = JSON.parse(r.meanings);
      const readings = JSON.parse(r.readings);
      const primaryMeaning =
        meanings.find((m: { primary: boolean; meaning: string }) => m.primary)?.meaning ||
        meanings[0]?.meaning ||
        "";
      const primaryReading =
        readings.find((rd: { primary: boolean; reading: string }) => rd.primary)?.reading ||
        readings[0]?.reading ||
        "";
      return {
        id: null,
        expression: r.characters,
        reading: primaryReading,
        meaning: primaryMeaning,
        jlptLevel: null,
        wkLevel: r.wk_level,
      };
    });
  }

  // Order by character position in the source expression, then WK level
  type ComponentKanji = ItemDetail["componentKanji"][number];
  const merged: ComponentKanji[] = [
    ...jlptKanji.map((k) => ({ ...k, wkLevel: k.wkLevel as number | null })),
    ...wkKanji,
  ];
  const mapped = kanjiChars
    .map((ch) => merged.find((k) => k.expression === ch))
    .filter((k): k is ComponentKanji => k !== undefined);
  return mapped.sort((a, b) => (a.wkLevel ?? 99) - (b.wkLevel ?? 99));
}

/**
 * Hydrate a single JLPT item with its WaniKani data, user progress + note,
 * component radicals/kanji, related vocab, "found in kanji", and linked
 * grammar points. Returns null if the item doesn't exist.
 *
 * Used by /api/items/[id] and /api/items/bulk.
 */
export function loadItemDetail(itemId: number, userId: number): ItemDetail | null {
  const item = getJlptItem.get(itemId) as JlptItemRow | undefined;
  if (!item) return null;

  const progress = getProgress.get(itemId, userId) as { status: string } | undefined;
  const noteRow = getNote.get(itemId, userId) as { content: string } | undefined;

  const primaryWk = pickPrimaryWk(item, itemId);
  const radicals = resolveComponentRadicals(primaryWk);

  let relatedVocab: ItemDetail["relatedVocab"] = [];
  if (item.type === "kanji" && item.expression.length === 1) {
    relatedVocab = getRelatedVocabForKanji.all(
      `%${item.expression}%`,
      item.expression,
    ) as ItemDetail["relatedVocab"];
  }

  let usedInKanji: ItemDetail["usedInKanji"] = [];
  if (item.type === "radical" && primaryWk?.wk_subject_id) {
    usedInKanji = getUsedInKanjiForRadical.all(
      primaryWk.wk_subject_id,
    ) as ItemDetail["usedInKanji"];
  }

  const componentKanji = resolveComponentKanji(item);

  let wanikani: ItemDetail["wanikani"] = null;
  if (primaryWk) {
    wanikani = {
      subjectId: primaryWk.wk_subject_id,
      level: primaryWk.wk_level,
      objectType: primaryWk.object_type,
      characters: primaryWk.characters,
      matchType: primaryWk.match_type,
      meanings: JSON.parse(primaryWk.meanings) as WKMeaningRow[],
      readings: JSON.parse(primaryWk.readings) as WKReadingRow[],
      radicals,
      meaningMnemonic: primaryWk.meaning_mnemonic,
      readingMnemonic: primaryWk.reading_mnemonic,
      meaningHint: primaryWk.meaning_hint,
      readingHint: primaryWk.reading_hint,
      contextSentences: primaryWk.context_sentences
        ? JSON.parse(primaryWk.context_sentences)
        : null,
      patternsOfUse: primaryWk.patterns_of_use
        ? JSON.parse(primaryWk.patterns_of_use)
        : null,
      partsOfSpeech: primaryWk.parts_of_speech
        ? JSON.parse(primaryWk.parts_of_speech)
        : null,
      imageUrl: primaryWk.imageUrl ?? null,
    };
  }

  const linkedGrammar = getLinkedGrammar.all(itemId) as ItemDetail["linkedGrammar"];

  return {
    item: { ...item, status: progress?.status || "unknown" },
    note: noteRow?.content ?? "",
    wanikani,
    relatedVocab,
    usedInKanji,
    componentKanji,
    linkedGrammar,
  };
}
