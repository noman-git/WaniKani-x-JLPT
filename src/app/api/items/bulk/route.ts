import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";
import { requireAuth, AuthError } from "@/lib/auth";

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
) {
  let session;
  try {
    session = await requireAuth(request);
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    throw e;
  }

  const url = new URL(request.url);
  const idsParam = url.searchParams.get("ids");
  if (!idsParam) {
    return NextResponse.json({ error: "Missing ids parameter" }, { status: 400 });
  }

  const itemIds = idsParam.split(",").map(id => parseInt(id.trim())).filter(id => !isNaN(id));

  if (itemIds.length === 0) {
    return NextResponse.json({ items: {} });
  }

  try {
    const dbPath = path.join(process.cwd(), "data", "jlpt.db");
    const rawDb = new Database(dbPath, { readonly: true });

    // Prepare statements outside the loop for maximum sqlite performance
    const getJlptItemStmt = rawDb.prepare(
      `SELECT id, expression, reading, meaning, type, jlpt_level as jlptLevel, sources
       FROM jlpt_items WHERE id = ?`
    );

    const getProgressStmt = rawDb.prepare(`SELECT status FROM user_progress WHERE jlpt_item_id = ? AND user_id = ?`);
    const getNoteStmt = rawDb.prepare(`SELECT content FROM user_notes WHERE jlpt_item_id = ? AND user_id = ?`);

    const getWkSubjectsStmt = rawDb.prepare(
      `SELECT wk_subject_id, characters, meanings, readings, wk_level,
              object_type, match_type, component_subject_ids, amalgamation_subject_ids,
              meaning_mnemonic, reading_mnemonic, meaning_hint, reading_hint,
              context_sentences, patterns_of_use, parts_of_speech
       FROM wanikani_subjects WHERE matched_jlpt_item_id = ?`
    );

    const getRelatedVocabStmt = rawDb.prepare(
      `SELECT id, expression, reading, meaning, type, jlpt_level as jlptLevel
       FROM jlpt_items
       WHERE type = 'vocab'
         AND expression LIKE ?
         AND expression != ?
       ORDER BY jlpt_level ASC, expression ASC
       LIMIT 30`
    );

    const getLinkedGrammarStmt = rawDb.prepare(
      `SELECT g.id, g.slug, g.title, g.title_romaji as titleRomaji, g.meaning, g.jlpt_level as jlptLevel
       FROM grammar_points g
       INNER JOIN grammar_item_links l ON l.grammar_point_id = g.id
       WHERE l.jlpt_item_id = ?
       ORDER BY g.jlpt_level ASC, g.id ASC`
    );

    const results: Record<number, any> = {};

    for (const itemId of itemIds) {
      // Get the JLPT item
      const item = getJlptItemStmt.get(itemId) as {
        id: number;
        expression: string;
        reading: string;
        meaning: string;
        type: string;
        jlptLevel: string;
        sources: string;
      } | undefined;

      if (!item) continue;

      // Get user progress and note
      const progress = getProgressStmt.get(itemId, session.userId) as { status: string } | undefined;
      const noteRow = getNoteStmt.get(itemId, session.userId) as { content: string } | undefined;

      // Get ALL WK subjects
      const wkRows = getWkSubjectsStmt.all(itemId) as Array<{
        wk_subject_id: number;
        characters: string;
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
      }>;

    // Pick the best WK match: prefer kanji type for kanji items, vocab for vocab items
    let primaryWk: any = null;
    
    if (item.type === "radical") {
       const getWkRadicalsStmt = rawDb.prepare(
         `SELECT wk_subject_id, characters, meanings, wk_level, character_image_url,
                 meaning_mnemonic, meaning_hint, amalgamation_subject_ids
          FROM wanikani_radicals WHERE matched_jlpt_item_id = ?`
       );
       const radRow = getWkRadicalsStmt.get(itemId) as any;
       if (radRow) {
         primaryWk = {
            wk_subject_id: radRow.wk_subject_id,
            characters: radRow.characters,
            meanings: radRow.meanings,
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
            imageUrl: radRow.character_image_url
         };
       }
    } else {
       let bestMatch = wkRows[0] || null;
       if (item.type === "kanji") {
         const kanjiMatch = wkRows.find((r) => r.object_type === "kanji");
         if (kanjiMatch) bestMatch = kanjiMatch;
       } else {
         const vocabMatch = wkRows.find(
           (r) => r.object_type === "vocabulary" || r.object_type === "kana_vocabulary"
         );
         if (vocabMatch) bestMatch = vocabMatch;
       }
       primaryWk = bestMatch;
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
      relatedVocab = rawDb.prepare(`
           SELECT j.id, j.expression, j.reading, j.meaning, j.type, j.jlpt_level as jlptLevel
           FROM jlpt_items j
           LEFT JOIN wanikani_subjects w ON w.matched_jlpt_item_id = j.id
           WHERE j.type = 'vocab'
             AND j.expression LIKE ?
             AND j.expression != ?
           GROUP BY j.id
           ORDER BY MIN(w.wk_level) ASC NULLS LAST, j.jlpt_level ASC, j.expression ASC
           LIMIT 30
      `).all(`%${item.expression}%`, item.expression) as typeof relatedVocab;
    }

    // Find related JLPT kanji that contain this radical
    let usedInKanji: Array<{
      id: number;
      expression: string;
      reading: string;
      meaning: string;
      type: string;
      jlptLevel: string;
    }> = [];

    if (item.type === "radical" && primaryWk?.wk_subject_id) {
       usedInKanji = rawDb.prepare(`
          SELECT j.id, j.expression, j.reading, j.meaning, j.type, j.jlpt_level as jlptLevel
          FROM wanikani_subjects w
          INNER JOIN jlpt_items j ON w.matched_jlpt_item_id = j.id
          JOIN json_each(w.component_subject_ids) as comp
          WHERE comp.value = ? AND j.type = 'kanji'
          GROUP BY j.id
          ORDER BY MIN(w.wk_level) ASC NULLS LAST, j.jlpt_level ASC, j.expression ASC
          LIMIT 50
       `).all(primaryWk.wk_subject_id) as any[];
    }

    // For vocab items, find component kanji (from JLPT list + WK subjects)
    let componentKanji: Array<{
      id: number | null;
      expression: string;
      reading: string;
      meaning: string;
      jlptLevel: string | null;
      wkLevel: number | null;
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
        
        // First: get JLPT kanji (deduplicate by expression, prefer lowest level)
        const jlptRaw = rawDb
          .prepare(
            `SELECT j.id, j.expression, j.reading, j.meaning, j.jlpt_level as jlptLevel, MIN(w.wk_level) as wkLevel
             FROM jlpt_items j
             LEFT JOIN wanikani_subjects w ON w.matched_jlpt_item_id = j.id
             WHERE j.type = 'kanji'
               AND j.expression IN (${placeholders})
             GROUP BY j.id
             ORDER BY MIN(w.wk_level) ASC NULLS LAST, j.jlpt_level ASC`
          )
          .all(...kanjiChars) as Array<{
            id: number; expression: string; reading: string; meaning: string; jlptLevel: string; wkLevel: number | null;
          }>;

        // Dedupe: keep first occurrence (lowest level due to ORDER BY)
        const jlptSeen = new Set<string>();
        const jlptKanji = jlptRaw.filter(k => {
          if (jlptSeen.has(k.expression)) return false;
          jlptSeen.add(k.expression);
          return true;
        });

        const foundJlpt = new Set(jlptKanji.map(k => k.expression));

        // Second: get WK kanji for chars NOT in JLPT list (deduplicate by characters)
        const missingChars = kanjiChars.filter(c => !foundJlpt.has(c));
        let wkKanji: Array<{
          id: null; expression: string; reading: string; meaning: string;
          jlptLevel: null; wkLevel: number;
        }> = [];

        if (missingChars.length > 0) {
          const missingPlaceholders = missingChars.map(() => "?").join(",");
          const wkRows = rawDb
            .prepare(
              `SELECT characters, meanings, readings, wk_level
               FROM wanikani_subjects
               WHERE object_type = 'kanji'
                 AND characters IN (${missingPlaceholders})
               GROUP BY characters
               ORDER BY wk_level ASC`
            )
            .all(...missingChars) as Array<{
              characters: string; meanings: string; readings: string; wk_level: number;
            }>;

          wkKanji = wkRows.map(r => {
            const meanings = JSON.parse(r.meanings);
            const readings = JSON.parse(r.readings);
            const primaryMeaning = meanings.find((m: any) => m.primary)?.meaning || meanings[0]?.meaning || "";
            const primaryReading = readings.find((rd: any) => rd.primary)?.reading || readings[0]?.reading || "";
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

        // Merge and sort purely by WK Level globally
        const allKanji = [
          ...jlptKanji.map(k => ({ ...k, wkLevel: k.wkLevel as number | null })),
          ...wkKanji,
        ];
        
        // Find every character in the string, then sort it.
        const mappedKanji = kanjiChars
          .map(ch => allKanji.find(k => k.expression === ch))
          .filter((k): k is typeof allKanji[number] => k !== undefined);
          
        componentKanji = mappedKanji.sort((a, b) => {
           const aLvl = a.wkLevel ?? 99;
           const bLvl = b.wkLevel ?? 99;
           return aLvl - bLvl;
        });
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
        characters: primaryWk.characters,
        matchType: primaryWk.match_type,
        meanings: allMeanings,
        readings: allReadings,
        radicals,
        meaningMnemonic: primaryWk.meaning_mnemonic,
        readingMnemonic: primaryWk.reading_mnemonic,
        meaningHint: primaryWk.meaning_hint,
        readingHint: primaryWk.reading_hint,
        contextSentences: primaryWk.context_sentences ? JSON.parse(primaryWk.context_sentences) : null,
        patternsOfUse: primaryWk.patterns_of_use ? JSON.parse(primaryWk.patterns_of_use) : null,
        partsOfSpeech: primaryWk.parts_of_speech ? JSON.parse(primaryWk.parts_of_speech) : null,
        imageUrl: primaryWk.imageUrl,
      };
    }

    // Get linked grammar points
    const linkedGrammar = getLinkedGrammarStmt.all(itemId);

    results[itemId] = {
      item: {
        ...item,
        status: progress?.status || "unknown",
      },
      note: noteRow?.content ?? "",
      wanikani,
      relatedVocab,
      usedInKanji,
      componentKanji,
      linkedGrammar,
    };
    } // End of loop over itemIds

    rawDb.close();

    return NextResponse.json({ items: results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
