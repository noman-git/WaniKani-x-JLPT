import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userProgress } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { calculateNextState, FORCE_KNOWN_STATE, SrsState } from "@/lib/srs/algorithm";
import { requireAuth, AuthError } from "@/lib/auth";

/**
 * Handle incoming SRS grades
 */
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

    // Expecting: { jlptItemId: 123, isCorrect: true, timeToAnswerMs: 1500, mistakeType: null, forceKnown: false }
    const payload = await req.json();
    const { jlptItemId, isCorrect, timeToAnswerMs, mistakeType, forceKnown } = payload;

    if (!jlptItemId) {
      return NextResponse.json({ error: "Missing jlptItemId" }, { status: 400 });
    }

    // Grab current state
    const progress = await db.query.userProgress.findFirst({
      where: and(eq(userProgress.userId, userId), eq(userProgress.jlptItemId, jlptItemId))
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

    // Calculate next mathematical interval
    let nextState: SrsState;
    if (forceKnown) {
        nextState = FORCE_KNOWN_STATE;
    } else {
        nextState = calculateNextState(
          currentState,
          isCorrect,
          timeToAnswerMs || 5000, // Defend against undefined
          mistakeType
        );
    }

    // Turn interval (in days) into a hard NextReviewAt timestamp
    const now = new Date();
    const nextDate = new Date(now.getTime() + nextState.interval * 24 * 60 * 60 * 1000);

    // Determine literal status
    const status = nextState.srsStage >= 8 ? "known" : "learning";

    // Re-save logic
    if (progress) {
      await db.update(userProgress)
        .set({
          status,
          srsStage: nextState.srsStage,
          interval: nextState.interval,
          easeFactor: nextState.easeFactor,
          nextReviewAt: nextDate.toISOString(),
          lastReviewedAt: now.toISOString(),
          updatedAt: now.toISOString()
        })
        .where(and(eq(userProgress.userId, userId), eq(userProgress.jlptItemId, jlptItemId)));
    } else {
      await db.insert(userProgress)
        .values({
          userId,
          jlptItemId,
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
    console.error("SRS Submit Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
