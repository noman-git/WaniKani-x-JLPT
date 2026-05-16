import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jlptItems, userProgress } from "@/lib/db/schema";
import { eq, and, lte, isNotNull } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth";
import { parseIntSafe, LIMIT_MAX } from "@/lib/api-helpers";

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
    const limit = parseIntSafe(url.searchParams.get("limit"), 100, 1, LIMIT_MAX);

    const now = new Date().toISOString();

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
        )
      )
      .orderBy(userProgress.nextReviewAt);

    return NextResponse.json({ reviews: rawReviews });
  } catch (error) {
    console.error("SRS Reviews Queue Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
