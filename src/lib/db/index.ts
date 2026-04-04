import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "jlpt.db");

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

// Initialize tables
export function initializeDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS jlpt_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expression TEXT NOT NULL,
      reading TEXT NOT NULL,
      meaning TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('kanji', 'vocab')),
      jlpt_level TEXT NOT NULL CHECK(jlpt_level IN ('N4', 'N5')),
      sources TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS wanikani_subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wk_subject_id INTEGER NOT NULL,
      characters TEXT,
      meanings TEXT NOT NULL,
      readings TEXT NOT NULL,
      wk_level INTEGER NOT NULL,
      object_type TEXT NOT NULL,
      matched_jlpt_item_id INTEGER REFERENCES jlpt_items(id),
      component_subject_ids TEXT,
      amalgamation_subject_ids TEXT,
      meaning_mnemonic TEXT,
      reading_mnemonic TEXT,
      meaning_hint TEXT,
      reading_hint TEXT
    );

    CREATE TABLE IF NOT EXISTS wanikani_radicals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wk_subject_id INTEGER NOT NULL UNIQUE,
      characters TEXT,
      meanings TEXT NOT NULL,
      wk_level INTEGER NOT NULL,
      character_image_url TEXT,
      meaning_mnemonic TEXT,
      meaning_hint TEXT,
      amalgamation_subject_ids TEXT
    );

    CREATE TABLE IF NOT EXISTS kanji_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query_key TEXT NOT NULL UNIQUE,
      response_json TEXT NOT NULL,
      cached_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jlpt_item_id INTEGER NOT NULL UNIQUE REFERENCES jlpt_items(id),
      status TEXT NOT NULL DEFAULT 'unknown' CHECK(status IN ('known', 'learning', 'unknown')),
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_jlpt_items_expression ON jlpt_items(expression);
    CREATE INDEX IF NOT EXISTS idx_jlpt_items_type_level ON jlpt_items(type, jlpt_level);
    CREATE INDEX IF NOT EXISTS idx_wanikani_characters ON wanikani_subjects(characters);
    CREATE INDEX IF NOT EXISTS idx_wanikani_matched ON wanikani_subjects(matched_jlpt_item_id);
    CREATE INDEX IF NOT EXISTS idx_user_progress_status ON user_progress(status);
    CREATE INDEX IF NOT EXISTS idx_kanji_cache_key ON kanji_cache(query_key);
  `);
}

// Seed database from JSON (flat array format)
export function seedDatabase(seedPath: string) {
  const count = sqlite
    .prepare("SELECT COUNT(*) as count FROM jlpt_items")
    .get() as { count: number };
  if (count.count > 0) return; // Already seeded

  const items = JSON.parse(fs.readFileSync(seedPath, "utf-8")) as Array<{
    expression: string;
    reading: string;
    meaning: string;
    type: string;
    jlpt_level: string;
    sources: string;
  }>;

  const insert = sqlite.prepare(`
    INSERT INTO jlpt_items (expression, reading, meaning, type, jlpt_level, sources)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertMany = sqlite.transaction(
    (rows: typeof items) => {
      for (const item of rows) {
        insert.run(
          item.expression,
          item.reading,
          item.meaning,
          item.type,
          item.jlpt_level,
          item.sources
        );
      }
    }
  );

  insertMany(items);
}

// Auto-initialize on import
initializeDatabase();
const seedPath = path.join(process.cwd(), "data", "jlpt-seed.json");
if (fs.existsSync(seedPath)) {
  seedDatabase(seedPath);
}
