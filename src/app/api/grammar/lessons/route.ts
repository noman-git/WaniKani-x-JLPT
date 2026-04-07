import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { grammarPoints, grammarProgress } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
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
    const limit = parseInt(url.searchParams.get("limit") || "3", 10);
    const userId = session.userId;

    // Fetch grammar items that DO NOT exist in grammarProgress OR have srsStage = 0
    // ordered by jlptLevel (N5 first) and order.
    const rawUnknownItems = await db
      .select({
        item: grammarPoints,
        progress: grammarProgress,
      })
      .from(grammarPoints)
      .leftJoin(grammarProgress, and(
        eq(grammarProgress.grammarPointId, grammarPoints.id),
        eq(grammarProgress.userId, userId)
      ))
      .orderBy(grammarPoints.jlptLevel, grammarPoints.order)
      .limit(limit * 3);

    const candidates = rawUnknownItems.filter((r) => !r.progress || r.progress.srsStage === 0);
    
    // Parse JSON fields
    const finalQueue = candidates.slice(0, limit).map(c => {
       const p = c.item;
       return {
         ...p,
         examples: JSON.parse(p.examples as string),
         relatedGrammarSlugs: JSON.parse(p.relatedGrammarSlugs as string),
         tags: JSON.parse(p.tags as string),
       };
    });

    return NextResponse.json({ lessons: finalQueue });
  } catch (error) {
    console.error("Grammar Lessons Queue Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
