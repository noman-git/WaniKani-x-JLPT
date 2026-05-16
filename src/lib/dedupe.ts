/**
 * Defense-in-depth: collapse items sharing the same `expression` so a single
 * Japanese character never appears as two cards in a "Found in X" section,
 * even if a server query accidentally returns cross-type rows.
 */
export function dedupeByExpression<T extends { expression: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item.expression)) continue;
    seen.add(item.expression);
    out.push(item);
  }
  return out;
}
