import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { grammarProgress } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { calculateNextState, SrsState } from "@/lib/srs/algorithm";
import { requireAuth, AuthError } from "@/lib/auth";

export async function POST(req: NextRequest) {
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

    const payload = await req.json();
    const { grammarPointId, isCorrect, timeToAnswerMs, mistakeType, forceKnown } = payload;

    if (!grammarPointId) {
      return NextResponse.json({ error: "Missing grammarPointId" }, { status: 400 });
    }

    const progress = await db.query.grammarProgress.findFirst({
      where: and(eq(grammarProgress.userId, userId), eq(grammarProgress.grammarPointId, grammarPointId))
    });

    const currentState: SrsState = progress ? {
      srsStage: progress.srsStage,
      interval: progress.interval,
      easeFactor: progress.easeFactor,
    } : {
      srsStage: 0,
      interval: 0,
      easeFactor: 2.5,
    };

    let nextState: SrsState;
    if (forceKnown) {
        nextState = {
            srsStage: 8,
            interval: 120,
            easeFactor: 2.7,
        };
    } else {
        nextState = calculateNextState(
          currentState,
          isCorrect,
          timeToAnswerMs || 5000,
          mistakeType
        );
    }

    const now = new Date();
    const nextDate = new Date(now.getTime() + nextState.interval * 24 * 60 * 60 * 1000);
    const status = nextState.srsStage >= 8 ? "known" : "learning";

    if (progress) {
      await db.update(grammarProgress)
        .set({
          status,
          srsStage: nextState.srsStage,
          interval: nextState.interval,
          easeFactor: nextState.easeFactor,
          nextReviewAt: nextDate.toISOString(),
          lastReviewedAt: now.toISOString(),
          updatedAt: now.toISOString()
        })
        .where(eq(grammarProgress.id, progress.id));
    } else {
      await db.insert(grammarProgress)
        .values({
          userId,
          grammarPointId,
          status,
          srsStage: nextState.srsStage,
          interval: nextState.interval,
          easeFactor: nextState.easeFactor,
          nextReviewAt: nextDate.toISOString(),
          lastReviewedAt: now.toISOString(),
          updatedAt: now.toISOString()
        });
    }

    return NextResponse.json({ success: true, nextState, nextReviewAt: nextDate.toISOString() });
  } catch (error) {
    console.error("Grammar SRS Submit Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
