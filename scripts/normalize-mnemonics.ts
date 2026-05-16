#!/usr/bin/env npx tsx
/**
 * normalize-mnemonics.ts
 *
 * Strips markdown bold (`**…**`) from text columns in `wanikani_subjects`
 * and replaces it with HTML `<b>…</b>`. Gemini's pseudo-WK content was
 * being written into the DB as raw markdown which then rendered as
 * literal asterisks in the UI; this normalises the data at the source
 * so every downstream consumer sees clean HTML.
 *
 * Touches: meaning_mnemonic, reading_mnemonic, meaning_hint,
 *          reading_hint  on `wanikani_subjects`.
 *
 * Idempotent — running it twice is a no-op (no `**` left to match).
 *
 * Run:  npx tsx scripts/normalize-mnemonics.ts [--dry-run]
 *
 * IMPORTANT: take a backup of data/jlpt.db before running.
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "jlpt.db");
const DRY_RUN = process.argv.includes("--dry-run");

if (!fs.existsSync(DB_PATH)) {
  console.error(`DB not found at ${DB_PATH}`);
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma("foreign_keys = ON");

const BOLD = /\*\*([^*\n][^*\n]*?)\*\*/g;

/**
 * Convert `**bold**` markdown to `<b>bold</b>`. Returns null if input is
 * null/undefined; returns the input unchanged if no markers found.
 */
function normalise(s: string | null | undefined): string | null {
  if (s == null) return s ?? null;
  if (!s.includes("**")) return s;
  return s.replace(BOLD, "<b>$1</b>");
}

const COLUMNS: Array<{ table: string; col: string }> = [
  { table: "wanikani_subjects", col: "meaning_mnemonic" },
  { table: "wanikani_subjects", col: "reading_mnemonic" },
  { table: "wanikani_subjects", col: "meaning_hint" },
  { table: "wanikani_subjects", col: "reading_hint" },
];

let totalRows = 0;
let totalUpdates = 0;

for (const { table, col } of COLUMNS) {
  // Pull only rows that actually contain `**` — keeps the scan small.
  const rows = db
    .prepare(`SELECT id, ${col} as val FROM ${table} WHERE ${col} LIKE '%**%'`)
    .all() as Array<{ id: number; val: string | null }>;

  totalRows += rows.length;
  let touched = 0;

  const update = db.prepare(`UPDATE ${table} SET ${col} = ? WHERE id = ?`);

  const tx = db.transaction((batch: typeof rows) => {
    for (const r of batch) {
      const next = normalise(r.val);
      if (next !== r.val) {
        if (!DRY_RUN) update.run(next, r.id);
        touched++;
      }
    }
  });

  tx(rows);
  totalUpdates += touched;
  console.log(`${table}.${col}: ${rows.length} candidate rows, ${touched} normalised${DRY_RUN ? " (dry-run)" : ""}.`);
}

console.log(`\nTotal: ${totalUpdates}/${totalRows} rows ${DRY_RUN ? "would be" : ""} updated.`);

db.close();
