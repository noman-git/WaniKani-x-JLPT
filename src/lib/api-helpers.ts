/**
 * Parse an integer query param, clamping to [min, max] and falling back to
 * `fallback` on NaN. Defends against `page=abc` or `limit=999999999`.
 */
export function parseIntSafe(
  raw: string | null | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (raw == null || raw === "") return fallback;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

export const PAGE_MAX = 10_000;
export const LIMIT_MAX = 100;
