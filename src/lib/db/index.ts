import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
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

// Ensure all tables exist natively via Drizzle Migrations
export function initializeDatabase() {
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  
  if (fs.existsSync(migrationsFolder)) {
    try {
      console.log("Running Drizzle migrations...");
      migrate(db, { migrationsFolder });
      console.log("Database migrations completed successfully.");
    } catch (err) {
      console.error("Migration failed:", err);
    }
  } else {
    // This allows it to fail gracefully if dev environments don't have drizzle generated yet
    console.warn("No 'drizzle' migrations folder found! Skipping auto-migration.");
  }

  // Auto-seed grammar points if table is empty
  seedGrammarPoints();
}

function seedGrammarPoints() {
  try {
    const count = sqlite.prepare("SELECT COUNT(*) as c FROM grammar_points").get() as { c: number };
    if (count.c > 0) return;

    const seedPath = path.join(process.cwd(), "data", "grammar-seed.json");
    if (!fs.existsSync(seedPath)) return;

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
    if ((e as Error).message.includes("no such table")) {
         // Quietly ignore "no such table" errors if migrations haven't run yet
         return;
    }
    console.error("Failed to seed grammar points:", e);
  }
}

// Auto-initialize on import
initializeDatabase();
