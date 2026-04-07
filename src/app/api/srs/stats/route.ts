import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userProgress, jlptItems, grammarPoints, grammarProgress } from "@/lib/db/schema";
import { eq, and, isNotNull, lte, sql } from "drizzle-orm";
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

    let mastered = 0; // Stage 8, 9, known
    let inProgress = 0; // Stage 1-7 (Apprentice / Guru)
    
    const levels: Record<string, any> = {
      "N5": { apprentice: 0, guru: 0, master: 0, enlightened: 0, burned: 0 },
      "N4": { apprentice: 0, guru: 0, master: 0, enlightened: 0, burned: 0 },
      "Unknown": { apprentice: 0, guru: 0, master: 0, enlightened: 0, burned: 0 }
    };

    distributionRes.forEach(row => {
       const lvl = levels[row.level] ? row.level : "Unknown";
       
       if (row.stage >= 1 && row.stage <= 4) levels[lvl].apprentice += row.count;
       else if (row.stage === 5 || row.stage === 6) levels[lvl].guru += row.count;
       else if (row.stage === 7) levels[lvl].master += row.count;
       else if (row.stage === 8) levels[lvl].enlightened += row.count;
       else if (row.stage === 9) levels[lvl].burned += row.count;

       if (row.stage > 0) {
          if (row.stage >= 8) mastered += row.count;
          else inProgress += row.count;
       }
    });

    const upcomingLessons = totalItems - mastered - inProgress;

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
}
