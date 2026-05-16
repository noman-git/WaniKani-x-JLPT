import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { grammarPoints, grammarProgress } from "@/lib/db/schema";
import { eq, and, lte, isNotNull } from "drizzle-orm";
import { parseIntSafe, LIMIT_MAX, withAuth } from "@/lib/api-helpers";

export const GET = withAuth(async (req, session) => {
  try {
    const url = new URL(req.url);
    const userId = session.userId;
    const limit = parseIntSafe(url.searchParams.get("limit"), 100, 1, LIMIT_MAX);

    const now = new Date().toISOString();

    const rawReviews = await db
      .select({
        item: grammarPoints,
        progress: grammarProgress,
      })
      .from(grammarProgress)
      .innerJoin(grammarPoints, eq(grammarProgress.grammarPointId, grammarPoints.id))
      .where(
        and(
          eq(grammarProgress.userId, userId),
          isNotNull(grammarProgress.nextReviewAt),
          lte(grammarProgress.nextReviewAt, now)
        )
      )
      .limit(limit);

    const reviews = rawReviews.map(r => {
        const p = r.item;
        return {
            item: {
                ...p,
                examples: JSON.parse(p.examples as string),
                relatedGrammarSlugs: JSON.parse(p.relatedGrammarSlugs as string),
                tags: JSON.parse(p.tags as string),
            },
            progress: r.progress
        };
    });

    return NextResponse.json({ reviews });
  } catch (error) {
    console.error("Grammar Reviews Queue Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
});
