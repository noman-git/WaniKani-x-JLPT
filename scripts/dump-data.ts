/**
 * Diagnostic Data Dump
 * Exports all data from the SQLite database into reviewable static files.
 * 
 * Run: npx tsx scripts/dump-data.ts
 */

import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";

const dbPath = path.join(process.cwd(), "data", "jlpt.db");
const outDir = path.join(process.cwd(), "data", "debug");

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const db = new Database(dbPath, { readonly: true });

// 1. Dump all JLPT items
console.log("=== Dumping JLPT Items ===");
const jlptItems = db.prepare(`
  SELECT id, expression, reading, meaning, type, jlpt_level, sources
  FROM jlpt_items
  ORDER BY jlpt_level, type, expression
`).all() as Array<{
  id: number; expression: string; reading: string; meaning: string;
  type: string; jlpt_level: string; sources: string;
}>;

// Separate into files
const n5Kanji = jlptItems.filter(i => i.jlpt_level === "N5" && i.type === "kanji");
const n5Vocab = jlptItems.filter(i => i.jlpt_level === "N5" && i.type === "vocab");
const n4Kanji = jlptItems.filter(i => i.jlpt_level === "N4" && i.type === "kanji");
const n4Vocab = jlptItems.filter(i => i.jlpt_level === "N4" && i.type === "vocab");

console.log(`N5 Kanji: ${n5Kanji.length}`);
console.log(`N5 Vocab: ${n5Vocab.length}`);
console.log(`N4 Kanji: ${n4Kanji.length}`);
console.log(`N4 Vocab: ${n4Vocab.length}`);
console.log(`Total: ${jlptItems.length}`);

fs.writeFileSync(path.join(outDir, "jlpt_n5_kanji.json"), JSON.stringify(n5Kanji, null, 2));
fs.writeFileSync(path.join(outDir, "jlpt_n5_vocab.json"), JSON.stringify(n5Vocab, null, 2));
fs.writeFileSync(path.join(outDir, "jlpt_n4_kanji.json"), JSON.stringify(n4Kanji, null, 2));
fs.writeFileSync(path.join(outDir, "jlpt_n4_vocab.json"), JSON.stringify(n4Vocab, null, 2));

// Also write a simple text list for quick review
const writeSimpleList = (items: typeof jlptItems, filename: string) => {
  const lines = items.map(i => `${i.expression}\t${i.reading}\t${i.meaning}`);
  fs.writeFileSync(path.join(outDir, filename), lines.join("\n"));
};
writeSimpleList(n5Kanji, "jlpt_n5_kanji.tsv");
writeSimpleList(n5Vocab, "jlpt_n5_vocab.tsv");
writeSimpleList(n4Kanji, "jlpt_n4_kanji.tsv");
writeSimpleList(n4Vocab, "jlpt_n4_vocab.tsv");

// 2. Dump WaniKani subjects
console.log("\n=== Dumping WaniKani Subjects ===");
const wkSubjects = db.prepare(`
  SELECT wk_subject_id, characters, meanings, readings, wk_level, object_type, matched_jlpt_item_id
  FROM wanikani_subjects
  ORDER BY wk_level, object_type, characters
`).all() as Array<{
  wk_subject_id: number; characters: string | null; meanings: string;
  readings: string; wk_level: number; object_type: string;
  matched_jlpt_item_id: number | null;
}>;

const wkKanji = wkSubjects.filter(s => s.object_type === "kanji");
const wkVocab = wkSubjects.filter(s => s.object_type === "vocabulary" || s.object_type === "kana_vocabulary");

console.log(`WK Kanji subjects: ${wkKanji.length}`);
console.log(`WK Vocab subjects: ${wkVocab.length}`);
console.log(`WK Total: ${wkSubjects.length}`);
console.log(`WK Matched to JLPT: ${wkSubjects.filter(s => s.matched_jlpt_item_id !== null).length}`);

fs.writeFileSync(path.join(outDir, "wk_kanji.json"), JSON.stringify(wkKanji, null, 2));
fs.writeFileSync(path.join(outDir, "wk_vocab.json"), JSON.stringify(wkVocab, null, 2));

// 3. Check specific problem items
console.log("\n=== Checking problem items ===");

// Check 日
const hiItem = jlptItems.find(i => i.expression === "日");
const hiWk = wkSubjects.find(s => s.characters === "日");
console.log(`\nJLPT "日":`, hiItem ? `Found (id=${hiItem.id}, level=${hiItem.jlpt_level}, type=${hiItem.type})` : "NOT FOUND in JLPT items");
console.log(`WK "日":`, hiWk ? `Found (wk_id=${hiWk.wk_subject_id}, level=${hiWk.wk_level}, type=${hiWk.object_type}, matched_jlpt_id=${hiWk.matched_jlpt_item_id})` : "NOT FOUND in WK subjects");

// Check a few more common N5 kanji
const testChars = ["日", "月", "火", "水", "木", "金", "土", "人", "大", "小", "山", "川", "一", "二", "三", "年", "学", "生", "本", "中"];
console.log("\n=== Spot-check common kanji ===");
console.log("Char\tIn JLPT?\tJLPT Level\tJLPT Type\tIn WK?\tWK Level\tWK Type\tMatched?");
for (const ch of testChars) {
  const jlpt = jlptItems.find(i => i.expression === ch);
  const wk = wkSubjects.find(s => s.characters === ch);
  console.log([
    ch,
    jlpt ? "YES" : "NO",
    jlpt?.jlpt_level || "-",
    jlpt?.type || "-",
    wk ? "YES" : "NO",
    wk?.wk_level?.toString() || "-",
    wk?.object_type || "-",
    wk?.matched_jlpt_item_id ? "YES" : "NO",
  ].join("\t"));
}

// 4. Unmatched JLPT items (not on WK)
console.log("\n=== JLPT items NOT matched to any WK subject ===");
const unmatchedJlpt = db.prepare(`
  SELECT j.id, j.expression, j.reading, j.meaning, j.type, j.jlpt_level
  FROM jlpt_items j
  LEFT JOIN wanikani_subjects w ON w.matched_jlpt_item_id = j.id
  WHERE w.id IS NULL
  ORDER BY j.jlpt_level, j.type, j.expression
`).all() as typeof jlptItems;

const unmatchedN5K = unmatchedJlpt.filter(i => i.jlpt_level === "N5" && i.type === "kanji");
const unmatchedN5V = unmatchedJlpt.filter(i => i.jlpt_level === "N5" && i.type === "vocab");
const unmatchedN4K = unmatchedJlpt.filter(i => i.jlpt_level === "N4" && i.type === "kanji");
const unmatchedN4V = unmatchedJlpt.filter(i => i.jlpt_level === "N4" && i.type === "vocab");

console.log(`Unmatched N5 Kanji: ${unmatchedN5K.length} / ${n5Kanji.length}`);
console.log(`Unmatched N5 Vocab: ${unmatchedN5V.length} / ${n5Vocab.length}`);
console.log(`Unmatched N4 Kanji: ${unmatchedN4K.length} / ${n4Kanji.length}`);
console.log(`Unmatched N4 Vocab: ${unmatchedN4V.length} / ${n4Vocab.length}`);

fs.writeFileSync(path.join(outDir, "unmatched_n5_kanji.json"), JSON.stringify(unmatchedN5K, null, 2));
fs.writeFileSync(path.join(outDir, "unmatched_n5_vocab.json"), JSON.stringify(unmatchedN5V, null, 2));
fs.writeFileSync(path.join(outDir, "unmatched_n4_kanji.json"), JSON.stringify(unmatchedN4K, null, 2));
fs.writeFileSync(path.join(outDir, "unmatched_n4_vocab.json"), JSON.stringify(unmatchedN4V, null, 2));

// Print the unmatched N5 kanji for quick review (should be 0 or very few)
console.log("\nUnmatched N5 Kanji list:");
for (const item of unmatchedN5K) {
  console.log(`  ${item.expression} (${item.reading}) — ${item.meaning}`);
}

console.log("\nUnmatched N4 Kanji list:");
for (const item of unmatchedN4K) {
  console.log(`  ${item.expression} (${item.reading}) — ${item.meaning}`);
}

// 5. Check if 日 exists in WK but wasn't matched because of type mismatch
console.log("\n=== Debugging match logic ===");
const allWkWithHi = wkSubjects.filter(s => s.characters === "日");
console.log(`All WK subjects with characters="日":`);
for (const s of allWkWithHi) {
  console.log(`  wk_id=${s.wk_subject_id}, type=${s.object_type}, level=${s.wk_level}, meanings=${s.meanings}, matched_jlpt_id=${s.matched_jlpt_item_id}`);
}

// Check the JLPT items that have "日" in their expression
const jlptWithHi = jlptItems.filter(i => i.expression.includes("日"));
console.log(`\nJLPT items containing "日" in expression:`);
for (const item of jlptWithHi) {
  console.log(`  id=${item.id}, expr="${item.expression}", type=${item.type}, level=${item.jlpt_level}`);
}

db.close();

console.log(`\n=== All debug files written to: ${outDir} ===`);
console.log("Files:");
for (const f of fs.readdirSync(outDir)) {
  const stat = fs.statSync(path.join(outDir, f));
  console.log(`  ${f} (${(stat.size / 1024).toFixed(1)} KB)`);
}
