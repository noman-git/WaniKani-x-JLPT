import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jlptItems, userProgress } from "@/lib/db/schema";
import { eq, and, lte, isNotNull, or } from "drizzle-orm";
import { parseIntSafe, LIMIT_MAX, withAuth } from "@/lib/api-helpers";

export const GET = withAuth(async (req, session) => {
  try {
    const url = new URL(req.url);
    const userId = session.userId;
    const limit = parseIntSafe(url.searchParams.get("limit"), 100, 1, LIMIT_MAX);
    const trackParam = url.searchParams.get("level");
    const track = trackParam === "N5" || trackParam === "N4" ? trackParam : null;

    const now = new Date().toISOString();

    // Track filter: when N5/N4 is requested, only show kanji & vocab at
    // that level, plus radicals at any level (they're prereq plumbing).
    const trackCondition = track
      ? or(eq(jlptItems.jlptLevel, track), eq(jlptItems.type, "radical"))
      : undefined;

    const rawReviews = await db
      .select({
        item: jlptItems,
        progress: userProgress,
      })
      .from(userProgress)
      .innerJoin(jlptItems, eq(userProgress.jlptItemId, jlptItems.id))
      .where(
        and(
          eq(userProgress.userId, userId),
          isNotNull(userProgress.nextReviewAt),
          lte(userProgress.nextReviewAt, now),
          trackCondition,
        )
      )
      .orderBy(userProgress.nextReviewAt);

    return NextResponse.json({ reviews: rawReviews });
  } catch (error) {
    console.error("SRS Reviews Queue Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
});
