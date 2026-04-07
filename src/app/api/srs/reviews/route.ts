import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jlptItems, userProgress, wanikaniSubjects } from "@/lib/db/schema";
import { eq, or, and, lte, isNotNull } from "drizzle-orm";
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
    const userId = session.userId;
    const limit = parseInt(url.searchParams.get("limit") || "100", 10);

    const now = new Date().toISOString();

    // Fetch all items from user_progress where nextReviewAt <= NOW()
    const reviews = await db
      .select({
        item: jlptItems,
        wkDetails: wanikaniSubjects,
        progress: userProgress,
      })
      .from(userProgress)
      .innerJoin(jlptItems, eq(userProgress.jlptItemId, jlptItems.id))
      .leftJoin(wanikaniSubjects, eq(wanikaniSubjects.matchedJlptItemId, jlptItems.id))
      .where(
        and(
          eq(userProgress.userId, userId),
          isNotNull(userProgress.nextReviewAt),
          lte(userProgress.nextReviewAt, now),
          // Do not fetch burned/mastered/known items for routine reviews
          // Actually, 'known' items don't have nextReviewAt if they are sidestepped, OR their nextReviewAt is 120 days away. If it hits, it hits!
        )
      )
      .limit(limit);

    return NextResponse.json({ reviews });
  } catch (error) {
    console.error("SRS Reviews Queue Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
