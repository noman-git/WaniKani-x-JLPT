/**
 * SRS stage → user-facing rank.
 *
 * The system stores integer stages 1..9 (with 0 = unlearned).
 * On the surface these are presented as game-like ranks:
 *
 *   1 → F      2 → E      3 → D      4 → C      5 → B
 *   6 → A      7 → S      8 → SS     9 → SSS
 */

export type SrsRank =
  | "F" | "E" | "D" | "C" | "B"
  | "A" | "S" | "SS" | "SSS";

export const RANKS: Array<{ stage: number; rank: SrsRank }> = [
  { stage: 1, rank: "F"   },
  { stage: 2, rank: "E"   },
  { stage: 3, rank: "D"   },
  { stage: 4, rank: "C"   },
  { stage: 5, rank: "B"   },
  { stage: 6, rank: "A"   },
  { stage: 7, rank: "S"   },
  { stage: 8, rank: "SS"  },
  { stage: 9, rank: "SSS" },
];

const STAGE_TO_RANK = new Map(RANKS.map(r => [r.stage, r.rank]));
const RANK_TO_STAGE = new Map(RANKS.map(r => [r.rank, r.stage]));

export function rankForStage(stage: number): SrsRank | null {
  return STAGE_TO_RANK.get(stage) ?? null;
}

export function stageForRank(rank: SrsRank): number | null {
  return RANK_TO_STAGE.get(rank) ?? null;
}
