import Database from 'better-sqlite3';
import path from 'path';
import * as fs from 'fs';

const dbPath = path.join(process.cwd(), 'data', 'jlpt.db');
const seedPath = path.join(process.cwd(), 'data', 'grammar-seed.json');

const db = new Database(dbPath);
const seed = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));

const update = db.prepare('UPDATE grammar_points SET examples = ? WHERE slug = ?');

const syncAll = db.transaction((items: any[]) => {
  let updated = 0;
  let skipped = 0;
  for (const item of items) {
    const result = update.run(JSON.stringify(item.examples), item.slug);
    if (result.changes > 0) updated++;
    else skipped++;
  }
  return { updated, skipped };
});

const result = syncAll(seed);
console.log(`Synced ${result.updated} grammar points to DB (${result.skipped} skipped/not found).`);

// Quick validation
const sample = db.prepare('SELECT slug, examples FROM grammar_points LIMIT 3').all() as any[];
for (const s of sample) {
  const ex = JSON.parse(s.examples);
  const first = ex[0];
  console.log(`\n[${s.slug}]`);
  console.log(`  ja:         ${first.ja}`);
  console.log(`  jaPrompt:   ${first.jaPrompt}`);
  console.log(`  clozeAnswer: ${first.clozeAnswer}`);
  const reconstructed = first.jaPrompt?.replace('___', first.clozeAnswer);
  console.log(`  valid:      ${reconstructed === first.ja}`);
}
