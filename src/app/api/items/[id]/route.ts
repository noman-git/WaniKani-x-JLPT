import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const itemId = parseInt(id);

  if (isNaN(itemId)) {
    return NextResponse.json({ error: "Invalid item ID" }, { status: 400 });
  }

  try {
    const dbPath = path.join(process.cwd(), "data", "jlpt.db");
    const rawDb = new Database(dbPath, { readonly: true });

    // Get the JLPT item
    const item = rawDb
      .prepare(
        `SELECT id, expression, reading, meaning, type, jlpt_level as jlptLevel, sources
         FROM jlpt_items WHERE id = ?`
      )
      .get(itemId) as {
      id: number;
      expression: string;
      reading: string;
      meaning: string;
      type: string;
      jlptLevel: string;
      sources: string;
    } | undefined;

    if (!item) {
      rawDb.close();
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Get user progress
    const progress = rawDb
      .prepare(`SELECT status FROM user_progress WHERE jlpt_item_id = ?`)
      .get(itemId) as { status: string } | undefined;

    // Get ALL WK subjects matched to this item (could be multiple, e.g. kanji + vocab)
    const wkRows = rawDb
      .prepare(
        `SELECT wk_subject_id, characters, meanings, readings, wk_level,
                object_type, component_subject_ids, amalgamation_subject_ids,
                meaning_mnemonic, reading_mnemonic, meaning_hint, reading_hint
         FROM wanikani_subjects WHERE matched_jlpt_item_id = ?`
      )
      .all(itemId) as Array<{
      wk_subject_id: number;
      characters: string;
      meanings: string;
      readings: string;
      wk_level: number;
      object_type: string;
      component_subject_ids: string | null;
      amalgamation_subject_ids: string | null;
      meaning_mnemonic: string | null;
      reading_mnemonic: string | null;
      meaning_hint: string | null;
      reading_hint: string | null;
    }>;

    // Pick the best WK match: prefer kanji type for kanji items, vocab for vocab items
    let primaryWk = wkRows[0] || null;
    if (item.type === "kanji") {
      const kanjiMatch = wkRows.find((r) => r.object_type === "kanji");
      if (kanjiMatch) primaryWk = kanjiMatch;
    } else {
      const vocabMatch = wkRows.find(
        (r) => r.object_type === "vocabulary" || r.object_type === "kana_vocabulary"
      );
      if (vocabMatch) primaryWk = vocabMatch;
    }

    // Resolve radicals from component_subject_ids
    let radicals: Array<{
      id: number;
      characters: string | null;
      meaning: string;
      imageUrl: string | null;
      level: number;
    }> = [];

    if (primaryWk?.component_subject_ids) {
      const componentIds: number[] = JSON.parse(primaryWk.component_subject_ids);
      if (componentIds.length > 0) {
        const placeholders = componentIds.map(() => "?").join(",");
        const radicalRows = rawDb
          .prepare(
            `SELECT wk_subject_id, characters, meanings, wk_level, character_image_url
             FROM wanikani_radicals WHERE wk_subject_id IN (${placeholders})`
          )
          .all(...componentIds) as RadicalRow[];

        radicals = radicalRows.map((r) => {
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
    }

    // Find related JLPT vocab that contains this kanji character
    let relatedVocab: Array<{
      id: number;
      expression: string;
      reading: string;
      meaning: string;
      type: string;
      jlptLevel: string;
    }> = [];

    if (item.type === "kanji" && item.expression.length === 1) {
      relatedVocab = rawDb
        .prepare(
          `SELECT id, expression, reading, meaning, type, jlpt_level as jlptLevel
           FROM jlpt_items
           WHERE type = 'vocab'
             AND expression LIKE ?
             AND expression != ?
           ORDER BY jlpt_level ASC, expression ASC
           LIMIT 30`
        )
        .all(`%${item.expression}%`, item.expression) as typeof relatedVocab;
    }

    // For vocab items, find component kanji in our JLPT lists
    let componentKanji: Array<{
      id: number;
      expression: string;
      reading: string;
      meaning: string;
      jlptLevel: string;
    }> = [];

    if (item.type === "vocab") {
      // Extract unique kanji characters from the expression
      const kanjiChars = [...new Set(
        item.expression.split("").filter((ch) => {
          const code = ch.charCodeAt(0);
          // CJK Unified Ideographs range
          return code >= 0x4e00 && code <= 0x9fff;
        })
      )];

      if (kanjiChars.length > 0) {
        const placeholders = kanjiChars.map(() => "?").join(",");
        componentKanji = rawDb
          .prepare(
            `SELECT id, expression, reading, meaning, jlpt_level as jlptLevel
             FROM jlpt_items
             WHERE type = 'kanji'
               AND expression IN (${placeholders})
             ORDER BY jlpt_level ASC, expression ASC`
          )
          .all(...kanjiChars) as typeof componentKanji;
      }
    }

    // Build WK data response
    let wanikani = null;
    if (primaryWk) {
      const allMeanings: WKMeaningRow[] = JSON.parse(primaryWk.meanings);
      const allReadings: WKReadingRow[] = JSON.parse(primaryWk.readings);

      wanikani = {
        subjectId: primaryWk.wk_subject_id,
        level: primaryWk.wk_level,
        objectType: primaryWk.object_type,
        meanings: allMeanings,
        readings: allReadings,
        radicals,
        meaningMnemonic: primaryWk.meaning_mnemonic,
        readingMnemonic: primaryWk.reading_mnemonic,
        meaningHint: primaryWk.meaning_hint,
        readingHint: primaryWk.reading_hint,
      };
    }

    rawDb.close();

    return NextResponse.json({
      item: {
        ...item,
        status: progress?.status || "unknown",
      },
      wanikani,
      relatedVocab,
      componentKanji,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
