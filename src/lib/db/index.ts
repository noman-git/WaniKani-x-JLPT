import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "jlpt.db");
const SEED_DB_PATH = path.join(process.cwd(), "data", "jlpt-seed.db");

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// If no DB exists, copy from seed
if (!fs.existsSync(DB_PATH) && fs.existsSync(SEED_DB_PATH)) {
  fs.copyFileSync(SEED_DB_PATH, DB_PATH);
  console.log("Initialized database from seed");
}

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

// Ensure all tables exist (handles schema additions since seed was created)
export function initializeDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invite_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      used_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL,
      used_at TEXT
    );

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
      match_type TEXT,
      component_subject_ids TEXT,
      amalgamation_subject_ids TEXT,
      meaning_mnemonic TEXT,
      reading_mnemonic TEXT,
      meaning_hint TEXT,
      reading_hint TEXT,
      context_sentences TEXT,
      patterns_of_use TEXT,
      parts_of_speech TEXT
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
      user_id INTEGER NOT NULL REFERENCES users(id),
      jlpt_item_id INTEGER NOT NULL REFERENCES jlpt_items(id),
      status TEXT NOT NULL DEFAULT 'unknown' CHECK(status IN ('known', 'learning', 'unknown')),
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, jlpt_item_id)
    );

    CREATE TABLE IF NOT EXISTS user_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      jlpt_item_id INTEGER NOT NULL REFERENCES jlpt_items(id),
      content TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, jlpt_item_id)
    );

    CREATE INDEX IF NOT EXISTS idx_jlpt_items_expression ON jlpt_items(expression);
    CREATE INDEX IF NOT EXISTS idx_jlpt_items_type_level ON jlpt_items(type, jlpt_level);
    CREATE INDEX IF NOT EXISTS idx_wanikani_characters ON wanikani_subjects(characters);
    CREATE INDEX IF NOT EXISTS idx_wanikani_matched ON wanikani_subjects(matched_jlpt_item_id);
    CREATE INDEX IF NOT EXISTS idx_user_progress_user ON user_progress(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_progress_compound ON user_progress(user_id, jlpt_item_id);
    CREATE INDEX IF NOT EXISTS idx_user_notes_compound ON user_notes(user_id, jlpt_item_id);
    CREATE INDEX IF NOT EXISTS idx_kanji_cache_key ON kanji_cache(query_key);
    CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);

    CREATE TABLE IF NOT EXISTS grammar_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      title_romaji TEXT NOT NULL,
      meaning TEXT NOT NULL,
      structure TEXT NOT NULL,
      explanation TEXT NOT NULL,
      jlpt_level TEXT NOT NULL,
      lesson_number INTEGER NOT NULL DEFAULT 0,
      lesson_title TEXT NOT NULL DEFAULT '',
      examples TEXT NOT NULL DEFAULT '[]',
      related_grammar_slugs TEXT NOT NULL DEFAULT '[]',
      tags TEXT NOT NULL DEFAULT '[]',
      "order" INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS grammar_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      grammar_point_id INTEGER NOT NULL REFERENCES grammar_points(id),
      status TEXT NOT NULL DEFAULT 'unknown' CHECK(status IN ('known', 'learning', 'unknown')),
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, grammar_point_id)
    );

    CREATE TABLE IF NOT EXISTS grammar_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      grammar_point_id INTEGER NOT NULL REFERENCES grammar_points(id),
      content TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, grammar_point_id)
    );

    CREATE INDEX IF NOT EXISTS idx_grammar_points_slug ON grammar_points(slug);
    CREATE INDEX IF NOT EXISTS idx_grammar_points_level ON grammar_points(jlpt_level);
    CREATE INDEX IF NOT EXISTS idx_grammar_progress_compound ON grammar_progress(user_id, grammar_point_id);
    CREATE INDEX IF NOT EXISTS idx_grammar_notes_compound ON grammar_notes(user_id, grammar_point_id);

    CREATE TABLE IF NOT EXISTS grammar_item_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grammar_point_id INTEGER NOT NULL REFERENCES grammar_points(id),
      jlpt_item_id INTEGER NOT NULL REFERENCES jlpt_items(id),
      UNIQUE(grammar_point_id, jlpt_item_id)
    );

    CREATE INDEX IF NOT EXISTS idx_grammar_item_links_grammar ON grammar_item_links(grammar_point_id);
    CREATE INDEX IF NOT EXISTS idx_grammar_item_links_item ON grammar_item_links(jlpt_item_id);
  `);

  // Auto-seed grammar points if table is empty
  seedGrammarPoints();
}

function seedGrammarPoints() {
  const count = sqlite.prepare("SELECT COUNT(*) as c FROM grammar_points").get() as { c: number };
  if (count.c > 0) return;

  const seedPath = path.join(process.cwd(), "data", "grammar-seed.json");
  if (!fs.existsSync(seedPath)) return;

  try {
    const raw = fs.readFileSync(seedPath, "utf-8");
    const points = JSON.parse(raw) as Array<Record<string, unknown>>;

    const insert = sqlite.prepare(`
      INSERT INTO grammar_points (slug, title, title_romaji, meaning, structure, explanation, jlpt_level, lesson_number, lesson_title, examples, related_grammar_slugs, tags, "order")
      VALUES (@slug, @title, @titleRomaji, @meaning, @structure, @explanation, @jlptLevel, @lessonNumber, @lessonTitle, @examples, @relatedGrammarSlugs, @tags, @order)
    `);

    const insertMany = sqlite.transaction((items: Array<Record<string, unknown>>) => {
      for (const p of items) {
        insert.run({
          slug: p.slug,
          title: p.title,
          titleRomaji: p.titleRomaji,
          meaning: p.meaning,
          structure: p.structure,
          explanation: p.explanation,
          jlptLevel: p.jlptLevel,
          lessonNumber: p.lessonNumber,
          lessonTitle: p.lessonTitle,
          examples: JSON.stringify(p.examples),
          relatedGrammarSlugs: JSON.stringify(p.relatedGrammarSlugs),
          tags: JSON.stringify(p.tags),
          order: p.order,
        });
      }
    });

    insertMany(points);
    console.log(`Seeded ${points.length} grammar points`);
  } catch (e) {
    console.error("Failed to seed grammar points:", e);
  }
}

// Auto-initialize on import
initializeDatabase();
