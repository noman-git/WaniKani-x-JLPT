import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jlptItems, userProgress, wanikaniSubjects } from "@/lib/db/schema";
import { eq, inArray, isNull, and } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth";

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

    // Find items that DO NOT exist in user_progress OR have srsStage = 0
    // Using a simple algorithm: Fetch bottom-up jlptItems, checking user_progress loosely
    const rawUnknownItems = await db
      .select({
        item: jlptItems,
        wkDetails: wanikaniSubjects,
        progress: userProgress,
      })
      .from(jlptItems)
      .leftJoin(userProgress, and(
        eq(userProgress.jlptItemId, jlptItems.id),
        eq(userProgress.userId, userId)
      ))
      .leftJoin(wanikaniSubjects, eq(wanikaniSubjects.matchedJlptItemId, jlptItems.id))
      .orderBy(jlptItems.jlptLevel, jlptItems.id) // Implicit bottom up sorting. N5 first!
      .limit(limit * 3); // Fetch slightly more to account for complex filtering

    const candidates = rawUnknownItems.filter((r) => !r.progress || r.progress.srsStage === 0);

    // Smart Pipeline: Inject missing component kanji ahead of vocabulary!
    const finalQueue: any[] = [];
    const addedIds = new Set<number>();

    for (const record of candidates) {
      if (finalQueue.length >= limit) break;
      if (addedIds.has(record.item.id)) continue;

      // If it's Vocab, we must check its Component Kanji!
      if (record.item.type === "vocab" && record.wkDetails?.componentSubjectIds) {
        let componentSubjectIds: number[] = [];
        try {
          componentSubjectIds = JSON.parse(record.wkDetails.componentSubjectIds);
        } catch { } // Ignore parse errors

        if (componentSubjectIds.length > 0) {
          // Fetch the corresponding WK records for these components
          const components = await db.query.wanikaniSubjects.findMany({
            where: inArray(wanikaniSubjects.wkSubjectId, componentSubjectIds)
          });

          const componentJlptIds = components
            .filter(c => c.matchedJlptItemId !== null)
            .map(c => c.matchedJlptItemId!);

          if (componentJlptIds.length > 0) {
            // Check progress for these components
            const componentProgress = await db.query.userProgress.findMany({
              where: and(
                eq(userProgress.userId, userId),
                inArray(userProgress.jlptItemId, componentJlptIds)
              )
            });

            const masteredIds = new Set(componentProgress.filter(p => p.srsStage > 0).map(p => p.jlptItemId));

            // Any component that IS NOT > 0 (mastered/learning) needs to be prepended safely!
            for (const c of components) {
              if (c.matchedJlptItemId && !masteredIds.has(c.matchedJlptItemId) && !addedIds.has(c.matchedJlptItemId)) {
                 // Component needs to be learned first!
                 const rawKanjiItem = await db.query.jlptItems.findFirst({ where: eq(jlptItems.id, c.matchedJlptItemId) });
                 if (rawKanjiItem && finalQueue.length < limit) {
                   finalQueue.push({ item: rawKanjiItem, wkDetails: c });
                   addedIds.add(rawKanjiItem.id);
                 }
              }
            }
          }
        }
      }

      // Finally append the actual Vocab (or Kanji) record
      if (finalQueue.length < limit && !addedIds.has(record.item.id)) {
        finalQueue.push(record);
        addedIds.add(record.item.id);
      }
    }

    return NextResponse.json({ lessons: finalQueue });
  } catch (error) {
    console.error("SRS Lessons Queue Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
