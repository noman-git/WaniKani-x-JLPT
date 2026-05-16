import { sqlite } from "@/lib/db";

/**
 * Upsert a status row in either user_progress or grammar_progress. Used by
 * /api/progress and /api/grammar/progress, which differ only in table/FK names.
 */
export function upsertProgressStatus(opts: {
  table: "user_progress" | "grammar_progress";
  fkColumn: "jlpt_item_id" | "grammar_point_id";
  userId: number;
  fkId: number;
  status: "known" | "learning" | "unknown";
}): void {
  const { table, fkColumn, userId, fkId, status } = opts;
  const now = new Date().toISOString();

  const existing = sqlite
    .prepare(`SELECT id FROM ${table} WHERE user_id = ? AND ${fkColumn} = ?`)
    .get(userId, fkId) as { id: number } | undefined;

  if (existing) {
    sqlite
      .prepare(`UPDATE ${table} SET status = ?, updated_at = ? WHERE id = ?`)
      .run(status, now, existing.id);
  } else {
    sqlite
      .prepare(
        `INSERT INTO ${table} (user_id, ${fkColumn}, status, updated_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(userId, fkId, status, now);
  }
}

/**
 * Get/set personal notes on either user_notes or grammar_notes. Used by
 * /api/notes and /api/grammar/notes.
 */
export function getNote(opts: {
  table: "user_notes" | "grammar_notes";
  fkColumn: "jlpt_item_id" | "grammar_point_id";
  userId: number;
  fkId: number;
}): string {
  const { table, fkColumn, userId, fkId } = opts;
  const row = sqlite
    .prepare(`SELECT content FROM ${table} WHERE user_id = ? AND ${fkColumn} = ?`)
    .get(userId, fkId) as { content: string } | undefined;
  return row?.content ?? "";
}

export function setNote(opts: {
  table: "user_notes" | "grammar_notes";
  fkColumn: "jlpt_item_id" | "grammar_point_id";
  userId: number;
  fkId: number;
  content: string;
}): void {
  const { table, fkColumn, userId, fkId, content } = opts;
  const now = new Date().toISOString();

  const existing = sqlite
    .prepare(`SELECT id FROM ${table} WHERE user_id = ? AND ${fkColumn} = ?`)
    .get(userId, fkId) as { id: number } | undefined;

  if (existing) {
    sqlite
      .prepare(`UPDATE ${table} SET content = ?, updated_at = ? WHERE id = ?`)
      .run(content, now, existing.id);
  } else {
    sqlite
      .prepare(
        `INSERT INTO ${table} (user_id, ${fkColumn}, content, updated_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(userId, fkId, content, now);
  }
}
