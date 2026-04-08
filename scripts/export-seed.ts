/**
 * Export the current SQLite DB as a clean seed database.
 * Copies the DB, strips user-specific data, and vacuums.
 *
 * Usage: npx tsx scripts/export-seed.ts
 */
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "data", "jlpt.db");
const SEED_PATH = path.join(process.cwd(), "data", "jlpt-seed.db");

if (!fs.existsSync(DB_PATH)) {
  console.error("❌ Database not found at", DB_PATH);
  process.exit(1);
}

// Copy the current DB
fs.copyFileSync(DB_PATH, SEED_PATH);

// Open the copy and strip user data
const db = new Database(SEED_PATH);
db.pragma("journal_mode = DELETE"); // No WAL for the seed file
db.pragma("foreign_keys = OFF"); // Disable for mass deletion

// Clear user-specific tables
db.exec(`
  DELETE FROM user_progress;
  DELETE FROM invite_codes;
  DELETE FROM users;
  DELETE FROM kanji_cache;
`);

// Get stats
const items = db.prepare("SELECT COUNT(*) as c FROM jlpt_items").get() as { c: number };
const subjects = db.prepare("SELECT COUNT(*) as c FROM wanikani_subjects").get() as { c: number };
const radicals = db.prepare("SELECT COUNT(*) as c FROM wanikani_radicals").get() as { c: number };

// Compact
db.exec("VACUUM");
db.close();

const sizeKB = Math.round(fs.statSync(SEED_PATH).size / 1024);
console.log(`✅ Exported seed DB to ${SEED_PATH}`);
console.log(`   JLPT items: ${items.c}`);
console.log(`   WK subjects: ${subjects.c}`);
console.log(`   WK radicals: ${radicals.c}`);
console.log(`   File size: ${sizeKB} KB`);
