import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { userProgress } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { calculateNextState, SrsState } from "@/lib/srs/algorithm";

/**
 * Handle incoming SRS grades
 */
export async function POST(req: Request) {
  try {
    // In a real app we derive userId from session.
    // Assuming hardcoded user 1 for internal dashboard sync
    const userId = 1; 

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

    if (!progress) {
      return NextResponse.json({ error: "Progress not found" }, { status: 404 });
    }

    const currentState: SrsState = {
      srsStage: progress.srsStage,
      interval: progress.interval,
      easeFactor: progress.easeFactor,
    };

    // Calculate next mathematical interval
    let nextState: SrsState;
    if (forceKnown) {
        nextState = {
            srsStage: 8, // Master
            interval: 120, // 4 months out
            easeFactor: 2.7, // High ease
        };
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

    return NextResponse.json({ success: true, nextState, nextReviewAt: nextDate.toISOString() });
  } catch (error) {
    console.error("SRS Submit Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
