/**
 * Cross-reference our JLPT items vs JLPTsensei reference lists
 * Outputs a comprehensive analysis to data/debug/analysis.md
 */

import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";

const dbPath = path.join(process.cwd(), "data", "jlpt.db");
const outDir = path.join(process.cwd(), "data", "debug");
const db = new Database(dbPath, { readonly: true });

// === Ground truth kanji from JLPTsensei ===
const SENSEI_N5_KANJI = "日一国人年大十二本中長出三時行見月分後前生五間上東四今金九入学高円子外八六下来気小七山話女北午百書先名川千水半男西電校語土木聞食車何南万毎白天母火右読友左休父雨".split("");
const SENSEI_N4_KANJI = "会同事自社発者地業方新場員立開手力問代明動京目通言理体田主題意不作用度強公持野以思家世多正安院心界教文元重近考画海売知道集別物使品計死特私始朝運終台広住無真有口少町料工建空急止送切転研足究楽起着店病質仕借兄写冬勉医去古味図堂夏夕夜妹姉字室屋帰弟待悪旅族早映春昼曜服歌歩注洋漢牛犬秋答紙習肉色花英茶親試買貸赤走週銀青音風飯飲館駅験魚鳥黒".split("");

console.log(`JLPTsensei N5 kanji: ${SENSEI_N5_KANJI.length}`);
console.log(`JLPTsensei N4 kanji: ${SENSEI_N4_KANJI.length}`);

// === Our DB data ===
const ourItems = db.prepare(`
  SELECT id, expression, reading, meaning, type, jlpt_level
  FROM jlpt_items ORDER BY jlpt_level, type, expression
`).all() as Array<{
  id: number; expression: string; reading: string; meaning: string;
  type: string; jlpt_level: string;
}>;

const ourN5Kanji = ourItems.filter(i => i.jlpt_level === "N5" && i.type === "kanji");
const ourN5Vocab = ourItems.filter(i => i.jlpt_level === "N5" && i.type === "vocab");
const ourN4Kanji = ourItems.filter(i => i.jlpt_level === "N4" && i.type === "kanji");
const ourN4Vocab = ourItems.filter(i => i.jlpt_level === "N4" && i.type === "vocab");

// === Analysis: N5 Kanji ===
const ourN5KanjiChars = new Set(ourN5Kanji.map(i => i.expression));
const senseiN5Set = new Set(SENSEI_N5_KANJI);

const n5MissingFromOurs = SENSEI_N5_KANJI.filter(k => !ourN5KanjiChars.has(k));
const n5ExtraInOurs = ourN5Kanji.filter(i => !senseiN5Set.has(i.expression));

// Check if "missing" N5 kanji exist in our data but classified as vocab
const n5MissingButInVocab = n5MissingFromOurs.filter(k => 
  ourItems.some(i => i.expression === k && i.type === "vocab" && i.jlpt_level === "N5")
);
const n5MissingCompletely = n5MissingFromOurs.filter(k => 
  !ourItems.some(i => i.expression === k)
);
const n5MissingButInN4 = n5MissingFromOurs.filter(k =>
  ourItems.some(i => i.expression === k && i.jlpt_level === "N4")
);

// === Analysis: N4 Kanji ===
const ourN4KanjiChars = new Set(ourN4Kanji.map(i => i.expression));
const senseiN4Set = new Set(SENSEI_N4_KANJI);

const n4MissingFromOurs = SENSEI_N4_KANJI.filter(k => !ourN4KanjiChars.has(k));
const n4ExtraInOurs = ourN4Kanji.filter(i => !senseiN4Set.has(i.expression));

const n4MissingButInVocab = n4MissingFromOurs.filter(k =>
  ourItems.some(i => i.expression === k && i.type === "vocab" && i.jlpt_level === "N4")
);
const n4MissingCompletely = n4MissingFromOurs.filter(k =>
  !ourItems.some(i => i.expression === k)
);
const n4MissingButInN5 = n4MissingFromOurs.filter(k =>
  ourItems.some(i => i.expression === k && i.jlpt_level === "N5")
);

// === Single-char vocab that should also be kanji ===
const singleCharVocabN5 = ourN5Vocab.filter(i => i.expression.length === 1);
const singleCharVocabN4 = ourN4Vocab.filter(i => i.expression.length === 1);

// === Build the analysis report ===
let report = `# JLPT Data Analysis Report

## Summary

| Metric | N5 | N4 |
|--------|----|----|
| JLPTsensei kanji count | ${SENSEI_N5_KANJI.length} | ${SENSEI_N4_KANJI.length} |
| Our kanji count | ${ourN5Kanji.length} | ${ourN4Kanji.length} |
| Our vocab count | ${ourN5Vocab.length} | ${ourN4Vocab.length} |
| Missing kanji (vs sensei) | ${n5MissingFromOurs.length} | ${n4MissingFromOurs.length} |
| Extra kanji (not in sensei) | ${n5ExtraInOurs.length} | ${n4ExtraInOurs.length} |
| Missing but classified as vocab | ${n5MissingButInVocab.length} | ${n4MissingButInVocab.length} |
| Missing completely from DB | ${n5MissingCompletely.length} | ${n4MissingCompletely.length} |
| Missing but in other level | ${n5MissingButInN4.length} | ${n4MissingButInN5.length} |
| Single-char vocab (should be kanji too) | ${singleCharVocabN5.length} | ${singleCharVocabN4.length} |

## Problem 1: Missing N5 Kanji (${n5MissingFromOurs.length} missing vs JLPTsensei's 80)

### Missing N5 kanji classified as vocab in our data:
${n5MissingButInVocab.map(k => {
  const item = ourItems.find(i => i.expression === k && i.type === "vocab");
  return `- **${k}** — ${item?.reading} — ${item?.meaning} (in our DB as N${item?.jlpt_level?.slice(1)} vocab)`;
}).join("\n") || "None"}

### Missing N5 kanji classified under N4 in our data:
${n5MissingButInN4.map(k => {
  const item = ourItems.find(i => i.expression === k && i.jlpt_level === "N4");
  return `- **${k}** — ${item?.reading} — ${item?.meaning} (in our DB as N4 ${item?.type})`;
}).join("\n") || "None"}

### Missing N5 kanji completely absent from our DB:
${n5MissingCompletely.map(k => `- **${k}**`).join("\n") || "None"}

### Extra kanji in our N5 list (not in JLPTsensei):
${n5ExtraInOurs.map(i => `- **${i.expression}** — ${i.reading} — ${i.meaning}`).join("\n") || "None"}

## Problem 2: Missing N4 Kanji (${n4MissingFromOurs.length} missing vs JLPTsensei's ${SENSEI_N4_KANJI.length})

### Missing N4 kanji classified as vocab in our data:
${n4MissingButInVocab.map(k => {
  const item = ourItems.find(i => i.expression === k && i.type === "vocab" && i.jlpt_level === "N4");
  return `- **${k}** — ${item?.reading} — ${item?.meaning} (in our DB as N4 vocab)`;
}).join("\n") || "None"}

### Missing N4 kanji classified under N5 in our data:
${n4MissingButInN5.map(k => {
  const item = ourItems.find(i => i.expression === k && i.jlpt_level === "N5");
  return `- **${k}** — ${item?.reading} — ${item?.meaning} (in our DB as N5 ${item?.type})`;
}).join("\n") || "None"}

### Missing N4 kanji completely absent from our DB:
${n4MissingCompletely.map(k => `- **${k}**`).join("\n") || "None"}

### Extra kanji in our N4 list (not in JLPTsensei):
${n4ExtraInOurs.map(i => `- **${i.expression}** — ${i.reading} — ${i.meaning}`).join("\n") || "None"}

## Problem 3: Single-character Vocab That Should Also Be Kanji

These are words in the vocab list that are a single kanji character — they should appear in the kanji list too.

### N5 single-char vocab (${singleCharVocabN5.length}):
${singleCharVocabN5.map(i => `- **${i.expression}** — ${i.reading} — ${i.meaning}`).join("\n")}

### N4 single-char vocab (${singleCharVocabN4.length}):
${singleCharVocabN4.map(i => `- **${i.expression}** — ${i.reading} — ${i.meaning}`).join("\n")}

## Reference: JLPTsensei Complete Kanji Lists

### N5 Kanji (${SENSEI_N5_KANJI.length}):
${SENSEI_N5_KANJI.join(" ")}

### N4 Kanji (${SENSEI_N4_KANJI.length}):
${SENSEI_N4_KANJI.join(" ")}
`;

fs.writeFileSync(path.join(outDir, "analysis.md"), report);
db.close();
console.log("Analysis written to data/debug/analysis.md");
