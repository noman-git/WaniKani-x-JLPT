/**
 * Build JLPT Seed Data
 * 
 * Uses JLPTsensei's authoritative kanji lists (80 N5 + 167 N4)
 * combined with open-anki-jlpt-decks CSV vocab data.
 * 
 * Run: npx tsx scripts/build-seed.ts
 */

import * as fs from "fs";
import * as path from "path";

// ====================================================================
// AUTHORITATIVE KANJI LISTS — Source: jlptsensei.com
// ====================================================================

interface KanjiEntry {
  expression: string;
  reading: string;
  meaning: string;
  type: "kanji";
  jlpt_level: string;
  sources: string;
}

const N5_KANJI_RAW: [string, string, string][] = [
  ["日", "ひ/にち", "day, sun"],
  ["一", "いち/ひとつ", "one"],
  ["国", "くに/こく", "country"],
  ["人", "ひと/じん", "person"],
  ["年", "とし/ねん", "year"],
  ["大", "おおきい/だい", "big, large"],
  ["十", "じゅう/とお", "ten"],
  ["二", "に/ふたつ", "two"],
  ["本", "もと/ほん", "book, origin"],
  ["中", "なか/ちゅう", "inside, middle"],
  ["長", "ながい/ちょう", "long, leader"],
  ["出", "でる/しゅつ", "exit, go out"],
  ["三", "さん/みつ", "three"],
  ["時", "とき/じ", "time, hour"],
  ["行", "いく/こう", "go, conduct"],
  ["見", "みる/けん", "see, look"],
  ["月", "つき/げつ", "month, moon"],
  ["分", "わける/ぶん", "part, minute"],
  ["後", "あと/ご", "after, behind"],
  ["前", "まえ/ぜん", "before, front"],
  ["生", "いきる/せい", "life, live, birth"],
  ["五", "ご/いつつ", "five"],
  ["間", "あいだ/かん", "interval, space"],
  ["上", "うえ/じょう", "above, up"],
  ["東", "ひがし/とう", "east"],
  ["四", "よん/し", "four"],
  ["今", "いま/こん", "now, present"],
  ["金", "かね/きん", "gold, money"],
  ["九", "きゅう/く", "nine"],
  ["入", "はいる/にゅう", "enter"],
  ["学", "まなぶ/がく", "study, learning"],
  ["高", "たかい/こう", "tall, expensive, high"],
  ["円", "えん/まるい", "circle, yen"],
  ["子", "こ/し", "child"],
  ["外", "そと/がい", "outside"],
  ["八", "はち/やつ", "eight"],
  ["六", "ろく/むつ", "six"],
  ["下", "した/か", "below, down"],
  ["来", "くる/らい", "come"],
  ["気", "き/け", "spirit, mood, air"],
  ["小", "ちいさい/しょう", "small, little"],
  ["七", "なな/しち", "seven"],
  ["山", "やま/さん", "mountain"],
  ["話", "はなす/わ", "talk, story, speak"],
  ["女", "おんな/じょ", "woman, female"],
  ["北", "きた/ほく", "north"],
  ["午", "ご", "noon"],
  ["百", "ひゃく", "hundred"],
  ["書", "かく/しょ", "write"],
  ["先", "さき/せん", "previous, ahead"],
  ["名", "な/めい", "name"],
  ["川", "かわ/せん", "river"],
  ["千", "せん/ち", "thousand"],
  ["水", "みず/すい", "water"],
  ["半", "はん/なかば", "half"],
  ["男", "おとこ/だん", "man, male"],
  ["西", "にし/せい", "west"],
  ["電", "でん", "electricity"],
  ["校", "こう", "school"],
  ["語", "かたる/ご", "language, word"],
  ["土", "つち/ど", "earth, ground, soil"],
  ["木", "き/もく", "tree, wood"],
  ["聞", "きく/ぶん", "hear, listen, ask"],
  ["食", "たべる/しょく", "eat, food"],
  ["車", "くるま/しゃ", "car, vehicle"],
  ["何", "なに/なん", "what"],
  ["南", "みなみ/なん", "south"],
  ["万", "まん/ばん", "ten thousand"],
  ["毎", "まい/ごとに", "every, each"],
  ["白", "しろい/はく", "white"],
  ["天", "てん/あまつ", "heaven, sky"],
  ["母", "はは/ぼ", "mother"],
  ["火", "ひ/か", "fire"],
  ["右", "みぎ/う", "right"],
  ["読", "よむ/どく", "read"],
  ["友", "とも/ゆう", "friend"],
  ["左", "ひだり/さ", "left"],
  ["休", "やすむ/きゅう", "rest, day off"],
  ["父", "ちち/ふ", "father"],
  ["雨", "あめ/う", "rain"],
];

const N4_KANJI_RAW: [string, string, string][] = [
  ["会", "あう/かい", "meet, meeting"],
  ["同", "おなじ/どう", "same, agree"],
  ["事", "こと/じ", "thing, matter, fact"],
  ["自", "みずから/じ", "self, oneself"],
  ["社", "やしろ/しゃ", "company, shrine"],
  ["発", "はつ/ほつ", "departure, emit"],
  ["者", "もの/しゃ", "person, someone"],
  ["地", "ち/じ", "ground, earth"],
  ["業", "わざ/ぎょう", "business, industry"],
  ["方", "かた/ほう", "direction, person, way"],
  ["新", "あたらしい/しん", "new"],
  ["場", "ば/じょう", "place, location"],
  ["員", "いん", "member"],
  ["立", "たつ/りつ", "stand"],
  ["開", "ひらく/かい", "open"],
  ["手", "て/しゅ", "hand"],
  ["力", "ちから/りょく", "power, strength"],
  ["問", "とう/もん", "question, ask"],
  ["代", "かわり/だい", "substitute, generation, age"],
  ["明", "あかるい/めい", "bright, clear"],
  ["動", "うごく/どう", "move, motion"],
  ["京", "みやこ/きょう", "capital"],
  ["目", "め/もく", "eye"],
  ["通", "とおる/つう", "pass through, traffic"],
  ["言", "いう/げん", "say, word"],
  ["理", "り", "reason, logic"],
  ["体", "からだ/たい", "body"],
  ["田", "た/でん", "rice field"],
  ["主", "ぬし/しゅ", "master, main"],
  ["題", "だい", "topic, subject, title"],
  ["意", "い", "mind, meaning, intention"],
  ["不", "ふ/ぶ", "un-, non-, negative"],
  ["作", "つくる/さく", "make, create"],
  ["用", "もちいる/よう", "use, business"],
  ["度", "たび/ど", "degree, time, occasion"],
  ["強", "つよい/きょう", "strong"],
  ["公", "こう/おおやけ", "public"],
  ["持", "もつ/じ", "hold, have"],
  ["野", "の/や", "field, plains"],
  ["以", "もって/い", "by means of, compared with"],
  ["思", "おもう/し", "think"],
  ["家", "いえ/か", "house, home, family"],
  ["世", "よ/せい", "world, generation"],
  ["多", "おおい/た", "many, much"],
  ["正", "ただしい/せい", "correct, right, proper"],
  ["安", "やすい/あん", "cheap, safe, peaceful"],
  ["院", "いん", "institution, temple"],
  ["心", "こころ/しん", "heart, mind"],
  ["界", "かい", "world, boundary"],
  ["教", "おしえる/きょう", "teach"],
  ["文", "ふみ/ぶん", "sentence, text, writing"],
  ["元", "もと/げん", "origin, former, beginning"],
  ["重", "おもい/じゅう", "heavy, important"],
  ["近", "ちかい/きん", "near, close"],
  ["考", "かんがえる/こう", "think, consider"],
  ["画", "かく/が", "picture, stroke"],
  ["海", "うみ/かい", "sea, ocean"],
  ["売", "うる/ばい", "sell"],
  ["知", "しる/ち", "know"],
  ["道", "みち/どう", "road, way, path"],
  ["集", "あつめる/しゅう", "gather, collect"],
  ["別", "わかれる/べつ", "separate, different"],
  ["物", "もの/ぶつ", "thing, object"],
  ["使", "つかう/し", "use"],
  ["品", "しな/ひん", "goods, quality"],
  ["計", "はかる/けい", "plan, measure, count"],
  ["死", "しぬ/し", "die, death"],
  ["特", "とく", "special"],
  ["私", "わたし/し", "I, private"],
  ["始", "はじめる/し", "begin, start"],
  ["朝", "あさ/ちょう", "morning"],
  ["運", "はこぶ/うん", "carry, luck, fate"],
  ["終", "おわる/しゅう", "end, finish"],
  ["台", "だい/たい", "stand, pedestal, counter"],
  ["広", "ひろい/こう", "wide, broad"],
  ["住", "すむ/じゅう", "live, reside, dwell"],
  ["無", "ない/む", "nothing, none"],
  ["真", "ま/しん", "true, real"],
  ["有", "ある/ゆう", "have, exist"],
  ["口", "くち/こう", "mouth"],
  ["少", "すこし/しょう", "few, little"],
  ["町", "まち/ちょう", "town"],
  ["料", "りょう", "fee, materials"],
  ["工", "こう/く", "craft, construction"],
  ["建", "たてる/けん", "build"],
  ["空", "そら/くう", "sky, empty"],
  ["急", "いそぐ/きゅう", "hurry, urgent"],
  ["止", "とまる/し", "stop"],
  ["送", "おくる/そう", "send"],
  ["切", "きる/せつ", "cut"],
  ["転", "ころがる/てん", "roll, revolve, turn"],
  ["研", "とぐ/けん", "polish, study"],
  ["足", "あし/そく", "foot, leg, sufficient"],
  ["究", "きゅう", "research, investigate"],
  ["楽", "たのしい/がく", "fun, music, comfort"],
  ["起", "おきる/き", "get up, occur"],
  ["着", "きる/つく/ちゃく", "wear, arrive"],
  ["店", "みせ/てん", "store, shop"],
  ["病", "やむ/びょう", "sick, disease"],
  ["質", "しつ/しち", "quality, substance"],
  ["仕", "し/つかえる", "serve, work"],
  ["借", "かりる/しゃく", "borrow"],
  ["兄", "あに/きょう", "older brother"],
  ["写", "うつす/しゃ", "copy, photograph"],
  ["冬", "ふゆ/とう", "winter"],
  ["勉", "べん", "exertion, study"],
  ["医", "い", "medicine, doctor"],
  ["去", "さる/きょ", "leave, past"],
  ["古", "ふるい/こ", "old, ancient"],
  ["味", "あじ/み", "taste, flavor"],
  ["図", "ず/と", "diagram, map, plan"],
  ["堂", "どう", "hall, temple"],
  ["夏", "なつ/か", "summer"],
  ["夕", "ゆう/ゆうべ", "evening"],
  ["夜", "よる/や", "night"],
  ["妹", "いもうと/まい", "younger sister"],
  ["姉", "あね/し", "older sister"],
  ["字", "じ", "letter, character"],
  ["室", "しつ/むろ", "room"],
  ["屋", "や/おく", "shop, house, roof"],
  ["帰", "かえる/き", "return, go home"],
  ["弟", "おとうと/だい", "younger brother"],
  ["待", "まつ/たい", "wait"],
  ["悪", "わるい/あく", "bad, evil"],
  ["旅", "たび/りょ", "travel, trip"],
  ["族", "ぞく", "tribe, family, clan"],
  ["早", "はやい/そう", "early, fast"],
  ["映", "うつる/えい", "reflect, project, movie"],
  ["春", "はる/しゅん", "spring"],
  ["昼", "ひる/ちゅう", "noon, daytime"],
  ["曜", "よう", "day of the week"],
  ["服", "ふく", "clothes, clothing"],
  ["歌", "うた/か", "song, sing"],
  ["歩", "あるく/ほ", "walk, step"],
  ["注", "そそぐ/ちゅう", "pour, note, attention"],
  ["洋", "よう", "ocean, Western style"],
  ["漢", "かん", "China, kanji"],
  ["牛", "うし/ぎゅう", "cow, bull"],
  ["犬", "いぬ/けん", "dog"],
  ["秋", "あき/しゅう", "autumn, fall"],
  ["答", "こたえる/とう", "answer, response"],
  ["紙", "かみ/し", "paper"],
  ["習", "ならう/しゅう", "learn, practice"],
  ["肉", "にく", "meat, flesh"],
  ["色", "いろ/しょく", "color"],
  ["花", "はな/か", "flower"],
  ["英", "えい", "England, English, brilliant"],
  ["茶", "ちゃ/さ", "tea"],
  ["親", "おや/しん", "parent, intimate"],
  ["試", "こころみる/し", "try, test, attempt"],
  ["買", "かう/ばい", "buy"],
  ["貸", "かす/たい", "lend"],
  ["赤", "あか/せき", "red"],
  ["走", "はしる/そう", "run"],
  ["週", "しゅう", "week"],
  ["銀", "ぎん", "silver"],
  ["青", "あお/せい", "blue, green, young"],
  ["音", "おと/おん", "sound, noise"],
  ["風", "かぜ/ふう", "wind, style"],
  ["飯", "めし/はん", "meal, cooked rice"],
  ["飲", "のむ/いん", "drink"],
  ["館", "かん/やかた", "building, hall, mansion"],
  ["駅", "えき", "station"],
  ["験", "けん/げん", "exam, verify, effect"],
  ["魚", "さかな/ぎょ", "fish"],
  ["鳥", "とり/ちょう", "bird"],
  ["黒", "くろ/こく", "black"],
];

// ====================================================================
// CSV DOWNLOAD & PARSING
// ====================================================================

const CSV_SOURCES: Record<string, string> = {
  N5: "https://raw.githubusercontent.com/jamsinclair/open-anki-jlpt-decks/main/src/n5.csv",
  N4: "https://raw.githubusercontent.com/jamsinclair/open-anki-jlpt-decks/main/src/n4.csv",
};

interface VocabEntry {
  expression: string;
  reading: string;
  meaning: string;
  type: "vocab";
  jlpt_level: string;
  sources: string;
}

function parseCsv(csv: string): Array<{ expression: string; reading: string; meaning: string }> {
  const lines = csv.split("\n").filter((l) => l.trim());
  const results: Array<{ expression: string; reading: string; meaning: string }> = [];

  for (const line of lines) {
    // Skip header
    if (line.startsWith("expression") || line.startsWith("Expression")) continue;

    // CSV parsing: handle quoted fields
    const parts: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        parts.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    parts.push(current.trim());

    if (parts.length >= 3) {
      const expression = parts[0].replace(/"/g, "").trim();
      const reading = parts[1].replace(/"/g, "").trim();
      const meaning = parts[2].replace(/"/g, "").trim();
      if (expression && meaning) {
        results.push({ expression, reading: reading || expression, meaning });
      }
    }
  }

  return results;
}

// ====================================================================
// MAIN BUILD
// ====================================================================

async function main() {
  const outDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  console.log("=== Building JLPT Seed Data ===\n");

  // 1. Build kanji entries from reference lists
  console.log("Building kanji from JLPTsensei reference...");
  const kanjiEntries: KanjiEntry[] = [];

  for (const [ch, reading, meaning] of N5_KANJI_RAW) {
    kanjiEntries.push({
      expression: ch,
      reading,
      meaning,
      type: "kanji",
      jlpt_level: "N5",
      sources: "jlptsensei",
    });
  }

  for (const [ch, reading, meaning] of N4_KANJI_RAW) {
    kanjiEntries.push({
      expression: ch,
      reading,
      meaning,
      type: "kanji",
      jlpt_level: "N4",
      sources: "jlptsensei",
    });
  }

  console.log(`  N5 kanji: ${N5_KANJI_RAW.length}`);
  console.log(`  N4 kanji: ${N4_KANJI_RAW.length}`);
  console.log(`  Total kanji: ${kanjiEntries.length}`);

  // 2. Download and parse vocab CSVs
  console.log("\nDownloading vocab CSVs...");
  const vocabEntries: VocabEntry[] = [];
  const kanjiExpressionSet = new Set(kanjiEntries.map((k) => `${k.expression}-${k.jlpt_level}`));

  for (const [level, url] of Object.entries(CSV_SOURCES)) {
    console.log(`  Fetching ${level}...`);
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`  ERROR: Failed to fetch ${level} CSV (${res.status})`);
      continue;
    }
    const csv = await res.text();
    const parsed = parseCsv(csv);
    console.log(`  Parsed ${parsed.length} entries from ${level} CSV`);

    const vocabDedup = new Set<string>();

    for (const entry of parsed) {
      const dedupKey = `${entry.expression}-${level}`;

      // Skip if already added as vocab
      if (vocabDedup.has(dedupKey)) continue;
      vocabDedup.add(dedupKey);

      // Add as vocab entry
      vocabEntries.push({
        expression: entry.expression,
        reading: entry.reading,
        meaning: entry.meaning,
        type: "vocab",
        jlpt_level: level,
        sources: "open-anki-jlpt-decks",
      });

      // If it's a single character and NOT already in the kanji list for this level,
      // also add it as a kanji entry
      if (entry.expression.length === 1) {
        const kanjiKey = `${entry.expression}-${level}`;
        if (!kanjiExpressionSet.has(kanjiKey)) {
          // Check if it's a real kanji (CJK Unified range)
          const cp = entry.expression.codePointAt(0) || 0;
          if (cp >= 0x4e00 && cp <= 0x9fff) {
            kanjiEntries.push({
              expression: entry.expression,
              reading: entry.reading,
              meaning: entry.meaning,
              type: "kanji",
              jlpt_level: level,
              sources: "open-anki-jlpt-decks",
            });
            kanjiExpressionSet.add(kanjiKey);
            console.log(`    + Added single-char vocab as kanji: ${entry.expression} (${level})`);
          }
        }
      }
    }
  }

  console.log(`\n  Total vocab: ${vocabEntries.length}`);

  // 3. Merge and output
  const allItems = [...kanjiEntries, ...vocabEntries];

  console.log(`\n=== Final Seed Stats ===`);
  const n5k = allItems.filter((i) => i.jlpt_level === "N5" && i.type === "kanji").length;
  const n5v = allItems.filter((i) => i.jlpt_level === "N5" && i.type === "vocab").length;
  const n4k = allItems.filter((i) => i.jlpt_level === "N4" && i.type === "kanji").length;
  const n4v = allItems.filter((i) => i.jlpt_level === "N4" && i.type === "vocab").length;

  console.log(`  N5 kanji: ${n5k}`);
  console.log(`  N5 vocab: ${n5v}`);
  console.log(`  N4 kanji: ${n4k}`);
  console.log(`  N4 vocab: ${n4v}`);
  console.log(`  Total: ${allItems.length}`);

  const outPath = path.join(outDir, "jlpt-seed.json");
  fs.writeFileSync(outPath, JSON.stringify(allItems, null, 2));
  console.log(`\nSeed data written to: ${outPath}`);
}

main().catch(console.error);
