import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userProgress, jlptItems, grammarPoints, grammarProgress } from "@/lib/db/schema";
import { eq, and, isNotNull, lte, sql } from "drizzle-orm";
import { withAuth } from "@/lib/api-helpers";

export const GET = withAuth(async (_req, session) => {
  try {
    const userId = session.userId;

    // 1. Total JLPT Items
    const totalItemsRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(jlptItems);
    const totalItems = totalItemsRes[0].count;

    // 2. Due Reviews
    const now = new Date().toISOString();
    const dueReviewsRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(userProgress)
      .where(
        and(
          eq(userProgress.userId, userId),
          isNotNull(userProgress.nextReviewAt),
          lte(userProgress.nextReviewAt, now)
        )
      );
    const dueReviews = dueReviewsRes[0].count;

    // 3. Stage Distributions Grouped by JLPT Level
    const distributionRes = await db
      .select({ 
         level: jlptItems.jlptLevel,
         stage: userProgress.srsStage, 
         count: sql<number>`count(*)` 
      })
      .from(userProgress)
      .innerJoin(jlptItems, eq(userProgress.jlptItemId, jlptItems.id))
      .where(eq(userProgress.userId, userId))
      .groupBy(jlptItems.jlptLevel, userProgress.srsStage);

    let inProgress = 0; // any stage > 0

    // Per-stage rollup: stages 1..9 each get their own count, grouped by
    // JLPT level. Mirrors the F → SSS ranking the dashboard renders.
    const blankLevel = () => ({
      stage1: 0, stage2: 0, stage3: 0,
      stage4: 0, stage5: 0, stage6: 0,
      stage7: 0, stage8: 0, stage9: 0,
    });
    const levels: Record<string, ReturnType<typeof blankLevel>> = {
      N5: blankLevel(),
      N4: blankLevel(),
      Other: blankLevel(),
    };

    const levelKey = (raw: string) =>
      raw === "N5" ? "N5" : raw === "N4" ? "N4" : "Other";

    distributionRes.forEach(row => {
       const lvl = levelKey(row.level);
       if (row.stage >= 1 && row.stage <= 9) {
         const key = `stage${row.stage}` as keyof ReturnType<typeof blankLevel>;
         levels[lvl][key] += row.count;
         inProgress += row.count;
       }
    });

    const upcomingLessons = totalItems - inProgress;

    // --- Grammar Stats ---
    const totalGrammarRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(grammarPoints);
    const totalGrammar = totalGrammarRes[0].count;

    const dueGrammarReviewsRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(grammarProgress)
      .where(
        and(
          eq(grammarProgress.userId, userId),
          isNotNull(grammarProgress.nextReviewAt),
          lte(grammarProgress.nextReviewAt, now)
        )
      );
    const grammarReviews = dueGrammarReviewsRes[0].count;

    const grammarInProgressRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(grammarProgress)
      .where(
        and(
          eq(grammarProgress.userId, userId),
          sql`${grammarProgress.srsStage} > 0`
        )
      );
    const grammarInProgress = grammarInProgressRes[0].count;
    
    const grammarLessons = totalGrammar - grammarInProgress;

    return NextResponse.json({
       upcomingLessons,
       dueReviews,
       levels,
       grammarLessons,
       grammarReviews
    });

  } catch (error) {
    console.error("Stats Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
});
