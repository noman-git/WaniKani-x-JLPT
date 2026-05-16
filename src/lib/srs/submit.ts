import { sqlite } from "@/lib/db";
import {
  calculateNextState,
  FORCE_KNOWN_STATE,
  FORCE_UNKNOWN_STATE,
  SrsState,
} from "@/lib/srs/algorithm";

export interface SrsSubmitInput {
  isCorrect?: boolean;
  timeToAnswerMs?: number;
  mistakeType?: "reading" | "meaning";
  forceKnown?: boolean;
  forceUnknown?: boolean;
}

export interface SrsSubmitResult {
  nextState: SrsState;
  nextReviewAt: string;
}

interface SubmitOpts {
  table: "user_progress" | "grammar_progress";
  fkColumn: "jlpt_item_id" | "grammar_point_id";
  userId: number;
  fkId: number;
  input: SrsSubmitInput;
}

/**
 * Common SRS-grade handler. Reads the user's current state on the given
 * progress table, computes the next state, and upserts. Used by both
 * /api/srs/submit (JLPT items) and /api/grammar/srs/submit (grammar points).
 *
 * `table` and `fkColumn` are interpolated into SQL but constrained by the
 * union types above — safe.
 */
export function submitSrs({ table, fkColumn, userId, fkId, input }: SubmitOpts): SrsSubmitResult {
  const selectStmt = sqlite.prepare(
    `SELECT srs_stage as srsStage, interval, ease_factor as easeFactor
     FROM ${table}
     WHERE user_id = ? AND ${fkColumn} = ?`,
  );
  const row = selectStmt.get(userId, fkId) as SrsState | undefined;

  const currentState: SrsState = row ?? { srsStage: 0, interval: 0, easeFactor: 2.5 };

  const nextState = input.forceKnown
    ? FORCE_KNOWN_STATE
    : input.forceUnknown
      ? FORCE_UNKNOWN_STATE
      : calculateNextState(
          currentState,
          !!input.isCorrect,
          input.timeToAnswerMs || 5000,
          input.mistakeType,
        );

  const now = new Date();
  const nextDate = new Date(now.getTime() + nextState.interval * 24 * 60 * 60 * 1000);
  const status = nextState.srsStage >= 7 ? "known" : "learning";

  if (row !== undefined) {
    sqlite
      .prepare(
        `UPDATE ${table}
         SET status = ?, srs_stage = ?, interval = ?, ease_factor = ?,
             next_review_at = ?, last_reviewed_at = ?, updated_at = ?
         WHERE user_id = ? AND ${fkColumn} = ?`,
      )
      .run(
        status,
        nextState.srsStage,
        nextState.interval,
        nextState.easeFactor,
        nextDate.toISOString(),
        now.toISOString(),
        now.toISOString(),
        userId,
        fkId,
      );
  } else {
    sqlite
      .prepare(
        `INSERT INTO ${table}
         (user_id, ${fkColumn}, status, srs_stage, interval, ease_factor,
          next_review_at, last_reviewed_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        userId,
        fkId,
        status,
        nextState.srsStage,
        nextState.interval,
        nextState.easeFactor,
        nextDate.toISOString(),
        now.toISOString(),
        now.toISOString(),
      );
  }

  return { nextState, nextReviewAt: nextDate.toISOString() };
}
