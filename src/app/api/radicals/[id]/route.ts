import { NextResponse } from "next/server";
import { sqlite } from "@/lib/db";
import { withAuth } from "@/lib/api-helpers";

export const GET = withAuth<{ id: string }>(async (_request, _session, ctx) => {
  const { id } = await ctx!.params;
  const wkSubjectId = parseInt(id);

  if (isNaN(wkSubjectId)) {
    return NextResponse.json({ error: "Invalid radical ID" }, { status: 400 });
  }

  try {
    const rawDb = sqlite;

    // Get the radical with all its data
    const radical = rawDb
      .prepare(
        `SELECT wk_subject_id, characters, meanings, wk_level, character_image_url,
                meaning_mnemonic, meaning_hint, amalgamation_subject_ids
         FROM wanikani_radicals WHERE wk_subject_id = ?`
      )
      .get(wkSubjectId) as {
      wk_subject_id: number;
      characters: string | null;
      meanings: string;
      wk_level: number;
      character_image_url: string | null;
      meaning_mnemonic: string | null;
      meaning_hint: string | null;
      amalgamation_subject_ids: string | null;
    } | undefined;

    if (!radical) {
      return NextResponse.json({ error: "Radical not found" }, { status: 404 });
    }

    const meanings: Array<{ meaning: string; primary: boolean }> = JSON.parse(
      radical.meanings
    );

    // Find JLPT kanji that use this radical by checking component_subject_ids
    const allKanjiSubjects = rawDb
      .prepare(
        `SELECT ws.matched_jlpt_item_id, ws.component_subject_ids
         FROM wanikani_subjects ws
         WHERE ws.component_subject_ids IS NOT NULL
           AND ws.object_type = 'kanji'
           AND ws.matched_jlpt_item_id IS NOT NULL`
      )
      .all() as Array<{
      matched_jlpt_item_id: number;
      component_subject_ids: string;
    }>;

    const matchedItemIds = new Set<number>();
    for (const row of allKanjiSubjects) {
      const ids: number[] = JSON.parse(row.component_subject_ids);
      if (ids.includes(wkSubjectId)) {
        matchedItemIds.add(row.matched_jlpt_item_id);
      }
    }

    // Get the actual JLPT kanji items
    let usedByKanji: Array<{
      id: number;
      expression: string;
      reading: string;
      meaning: string;
      jlptLevel: string;
    }> = [];

    if (matchedItemIds.size > 0) {
      const itemIds = [...matchedItemIds];
      const placeholders = itemIds.map(() => "?").join(",");
      usedByKanji = rawDb
        .prepare(
          `SELECT DISTINCT id, expression, reading, meaning, jlpt_level as jlptLevel
           FROM jlpt_items
           WHERE id IN (${placeholders})
             AND type = 'kanji'
           ORDER BY jlpt_level ASC, expression ASC`
        )
        .all(...itemIds) as typeof usedByKanji;
    }

    return NextResponse.json({
      radical: {
        wkSubjectId: radical.wk_subject_id,
        characters: radical.characters,
        meanings,
        level: radical.wk_level,
        imageUrl: radical.character_image_url,
      },
      meaningMnemonic: radical.meaning_mnemonic,
      meaningHint: radical.meaning_hint,
      usedByKanji,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
