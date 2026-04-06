export type SrsState = {
  srsStage: number;
  interval: number; // in days
  easeFactor: number;
};

// Maps continuous interval (in days) back to WaniKani stages visually
export function mapIntervalToStage(interval: number): number {
  if (interval <= 0) return 0;
  if (interval <= 0.2) return 1; // 4h
  if (interval <= 0.4) return 2; // 8h
  if (interval <= 1) return 3;   // 1d
  if (interval <= 3) return 4;   // 2d-3d
  if (interval <= 8) return 5;   // 1w
  if (interval <= 15) return 6;  // 2w
  if (interval <= 32) return 7;  // 1m
  if (interval <= 125) return 8; // 4m (Master)
  return 9; // Burned
}

export function calculateNextState(
  currentState: SrsState,
  isCorrect: boolean,
  timeToAnswerMs: number,
  mistakeType?: "reading" | "meaning"
): SrsState {
  let { interval, easeFactor } = currentState;

  if (isCorrect) {
    // Dynamic Ease adjustment based on speed
    if (timeToAnswerMs < 3000) easeFactor += 0.15;
    else if (timeToAnswerMs > 10000) easeFactor -= 0.1;

    // Minimum ease safeguard
    easeFactor = Math.max(1.3, easeFactor);

    // Calculate new interval
    if (interval === 0) {
      interval = 0.1666; // 4 hours for brand new items
    } else {
      interval = interval * easeFactor;
    }
  } else {
    // Heavy penalization for getting it wrong
    easeFactor = Math.max(1.3, easeFactor - 0.2);

    if (mistakeType === "reading") {
      // WaniKani heavily penalizes reading mistakes
      interval = Math.max(0.1666, interval * 0.4);
    } else {
      // Meaning mistakes drop interval by half
      interval = Math.max(0.1666, interval * 0.5);
    }
  }

  return {
    srsStage: mapIntervalToStage(interval),
    interval: Number(interval.toFixed(4)), // Keep it clean
    easeFactor: Number(easeFactor.toFixed(4)),
  };
}

/**
 * Levenshtein distance for typo forgiveness
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * WaniKani style checking:
 * > 3 chars = allow 1 typo
 * <= 3 chars = exact match needed
 * Ignores case and whitespace.
 */
export function isMeaningCorrect(userInput: string, expectedMeanings: string[]): { isCorrect: boolean; isTypo: boolean } {
  const normalizedUser = userInput.trim().toLowerCase();
  
  for (const expected of expectedMeanings) {
    const normalizedExpected = expected.trim().toLowerCase();
    
    // Exact match
    if (normalizedUser === normalizedExpected) {
      return { isCorrect: true, isTypo: false };
    }

    // Typo checking
    if (normalizedExpected.length > 3) {
      const dist = levenshteinDistance(normalizedUser, normalizedExpected);
      if (dist === 1) {
        return { isCorrect: true, isTypo: true }; // Treat as correct, but flag as typo!
      }
    }
  }

  return { isCorrect: false, isTypo: false };
}
