import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth";
import Database from "better-sqlite3";
import path from "path";

export async function GET(req: NextRequest) {
  let session;
  try {
    session = await requireAuth(req);
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    throw e;
  }

  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "5", 10);
    const userId = session.userId;

    const dbPath = path.join(process.cwd(), "data", "jlpt.db");
    const rawDb = new Database(dbPath, { readonly: true });

    // 1. Build a fast WK ID -> JLPT ID lookup
    const wkToJlpt = new Map<number, number>();
    const mappingRows = rawDb.prepare(`
       SELECT wk_subject_id, matched_jlpt_item_id FROM wanikani_subjects WHERE matched_jlpt_item_id IS NOT NULL
       UNION ALL
       SELECT wk_subject_id, matched_jlpt_item_id FROM wanikani_radicals WHERE matched_jlpt_item_id IS NOT NULL
    `).all() as any[];
    mappingRows.forEach(r => wkToJlpt.set(r.wk_subject_id, r.matched_jlpt_item_id));

    // 2. Fetch all learned items for the user
    const learnedRows = rawDb.prepare(`
       SELECT jlpt_item_id FROM user_progress WHERE user_id = ? AND srs_stage > 0
    `).all(userId) as any[];
    const learnedIds = new Set(learnedRows.map(r => r.jlpt_item_id));

    // 3. Fetch all UNLEARNED candidates, sorted strictly by wk_level!
    const candidatesQuery = `
       SELECT 
          j.id as jlptItemId, 
          j.expression, 
          j.reading, 
          j.meaning, 
          j.type, 
          j.jlpt_level as jlptLevel,
          COALESCE(w.wk_level, r.wk_level, 99) as wkLevel,
          COALESCE(w.component_subject_ids, r.amalgamation_subject_ids) as componentSubjectIds,
          'true' as _isRaw
       FROM jlpt_items j
       LEFT JOIN user_progress p ON p.jlpt_item_id = j.id AND p.user_id = ?
       LEFT JOIN wanikani_subjects w ON w.matched_jlpt_item_id = j.id
       LEFT JOIN wanikani_radicals r ON r.matched_jlpt_item_id = j.id
       WHERE (p.id IS NULL OR p.srs_stage = 0)
         AND j.jlpt_level != 'other'
       ORDER BY wkLevel ASC, j.id ASC
    `;
    const sortedCandidates = rawDb.prepare(candidatesQuery).all(userId) as any[];

    // 4. Smart Prerequisites Pipeline
    const finalQueue: any[] = [];
    const fullItemsFetchKeys: number[] = [];

    for (const row of sortedCandidates) {
       if (finalQueue.length >= limit) break;

       let isUnlocked = true;

       if (row.componentSubjectIds && (row.type === "kanji" || row.type === "vocab")) {
          let componentWkIds: number[] = [];
          try {
             componentWkIds = JSON.parse(row.componentSubjectIds);
          } catch(e) {}

          // Check if ALL components that exist in our system have been learned
          for (const wkId of componentWkIds) {
             const dependentJlptId = wkToJlpt.get(wkId);
             // If a component maps to a JLPT item in our DB, the user MUST have learned it!
             if (dependentJlptId && !learnedIds.has(dependentJlptId)) {
                isUnlocked = false;
                break;
             }
          }
       }

       if (isUnlocked) {
          finalQueue.push({ _tempId: row.jlptItemId, type: row.type });
          fullItemsFetchKeys.push(row.jlptItemId);
       }
    }

    rawDb.close();

    if (fullItemsFetchKeys.length === 0) {
       return NextResponse.json({ lessons: [] });
    }

    // 5. Fetch fully hydrated objects for the frontend using Drizzle
    const hydratedLessons: any[] = [];
    for (const id of fullItemsFetchKeys) {
        const itemRecord = await db.query.jlptItems.findFirst({
            where: (jlptItems, { eq }) => eq(jlptItems.id, id)
        });
        if (!itemRecord) continue;

        let wkDetails = null;
        if (itemRecord.type === "radical") {
           wkDetails = await db.query.wanikaniRadicals.findFirst({
               where: (wanikaniRadicals, { eq }) => eq(wanikaniRadicals.matchedJlptItemId, id)
           });
        } else {
           wkDetails = await db.query.wanikaniSubjects.findFirst({
               where: (wanikaniSubjects, { eq }) => eq(wanikaniSubjects.matchedJlptItemId, id)
           });
        }

        hydratedLessons.push({ item: itemRecord, wkDetails });
    }

    return NextResponse.json({ lessons: hydratedLessons });
  } catch (error) {
    console.error("SRS Lessons Queue Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
