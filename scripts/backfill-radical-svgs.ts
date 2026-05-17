#!/usr/bin/env npx tsx
/**
 * backfill-radical-svgs.ts
 *
 * Populates `wanikani_radicals.character_image_url` with the SVG URL for
 * every radical. WaniKani serves an SVG (plus 7 PNG sizes) per radical, and
 * we want the SVG: it scales to any UI size and stays crisp.
 *
 * Critical for the 18 "image-only" radicals like [Kick] that have neither a
 * CJK `characters` field nor an SVG URL stored — currently they render as a
 * bare bracketed meaning ("[Kick]") because the UI has nothing to display.
 *
 * Also fills in the URL for the 485 radicals that DO have characters — the
 * frontend already prefers `characters` when present, so this is a no-op
 * visually but gives us a fallback for future use.
 *
 * Uses /v2/subjects?types=radical bulk endpoint (paginated, 1000 per page).
 * Should be 1-2 API calls total for the ~503 radicals.
 *
 * Run:  npx tsx scripts/backfill-radical-svgs.ts [--dry-run]
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DRY_RUN = process.argv.includes("--dry-run");
const dbPath = path.join(process.cwd(), "data", "jlpt.db");

const token = process.env.WANIKANI_API_TOKEN;
if (!token) {
  // Hand-load .env if not already in the process environment
  const envPath = path.join(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m) process.env[m[1]] = m[2];
    }
  }
}
const WK_TOKEN = process.env.WANIKANI_API_TOKEN;
if (!WK_TOKEN) {
  console.error("❌ WANIKANI_API_TOKEN not set in env or .env");
  process.exit(1);
}

if (!DRY_RUN) {
  const backupPath = dbPath.replace(".db", `-backup-${Date.now()}.db`);
  fs.copyFileSync(dbPath, backupPath);
  console.log(`✅ Backup created: ${path.basename(backupPath)}`);
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

interface CharacterImage {
  url: string;
  content_type: string;
  metadata?: { style_name?: string; inline_styles?: boolean };
}

interface RadicalSubject {
  id: number;
  data: {
    characters: string | null;
    character_images: CharacterImage[];
  };
}

interface WkPage<T> {
  data: T[];
  pages: { next_url: string | null };
  total_count: number;
}

function pickSvg(imgs: CharacterImage[]): string | null {
  const svg = imgs.find((i) => i.content_type === "image/svg+xml");
  return svg?.url ?? null;
}

async function fetchAllRadicals(): Promise<RadicalSubject[]> {
  let url: string | null = "https://api.wanikani.com/v2/subjects?types=radical";
  const all: RadicalSubject[] = [];
  let pages = 0;
  while (url) {
    pages++;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${WK_TOKEN}` },
    });
    if (!res.ok) {
      throw new Error(`WK API ${res.status}: ${await res.text()}`);
    }
    const page = (await res.json()) as WkPage<RadicalSubject>;
    all.push(...page.data);
    url = page.pages.next_url;
    console.log(`  Fetched page ${pages} → ${page.data.length} radicals (total so far: ${all.length})`);
  }
  return all;
}

async function main() {
  console.log("Fetching all radicals from WaniKani...");
  const radicals = await fetchAllRadicals();
  console.log(`\nTotal radicals from WK: ${radicals.length}`);

  // Build the SVG URL map
  const wkIdToSvg = new Map<number, string>();
  let missingSvg = 0;
  for (const r of radicals) {
    const svgUrl = pickSvg(r.data.character_images);
    if (svgUrl) wkIdToSvg.set(r.id, svgUrl);
    else missingSvg++;
  }
  console.log(`Radicals with SVG: ${wkIdToSvg.size}`);
  if (missingSvg > 0) {
    console.log(`Radicals WITHOUT SVG (unexpected): ${missingSvg}`);
  }

  // Check what's in our DB
  const ourRadicals = db
    .prepare(
      `SELECT wk_subject_id, characters, character_image_url FROM wanikani_radicals`,
    )
    .all() as Array<{
      wk_subject_id: number;
      characters: string | null;
      character_image_url: string | null;
    }>;

  let willUpdate = 0;
  let alreadyMatching = 0;
  let notInWk = 0;
  let imageOnlyFixed = 0;

  for (const our of ourRadicals) {
    const svgUrl = wkIdToSvg.get(our.wk_subject_id);
    if (!svgUrl) {
      notInWk++;
      continue;
    }
    if (our.character_image_url === svgUrl) {
      alreadyMatching++;
      continue;
    }
    willUpdate++;
    if (!our.characters) imageOnlyFixed++;
  }

  console.log(`\nOur DB has ${ourRadicals.length} radicals.`);
  console.log(`  Will update:           ${willUpdate}`);
  console.log(`  (of which image-only): ${imageOnlyFixed}`);
  console.log(`  Already matching:      ${alreadyMatching}`);
  console.log(`  Not present in WK:     ${notInWk}`);

  if (DRY_RUN) {
    console.log("\n🏃 DRY RUN — no changes made");
    db.close();
    return;
  }

  const updateStmt = db.prepare(
    `UPDATE wanikani_radicals SET character_image_url = ? WHERE wk_subject_id = ?`,
  );
  const run = db.transaction(() => {
    let n = 0;
    for (const our of ourRadicals) {
      const svgUrl = wkIdToSvg.get(our.wk_subject_id);
      if (svgUrl && our.character_image_url !== svgUrl) {
        updateStmt.run(svgUrl, our.wk_subject_id);
        n++;
      }
    }
    return n;
  });
  const updated = run();
  console.log(`\n✅ Updated ${updated} rows`);

  // Verify the 18 image-only radicals now all have an SVG
  const stillBroken = db
    .prepare(
      `SELECT wk_subject_id, meanings FROM wanikani_radicals
       WHERE characters IS NULL AND character_image_url IS NULL`,
    )
    .all() as Array<{ wk_subject_id: number; meanings: string }>;
  console.log(`\nImage-only radicals still without an SVG: ${stillBroken.length} (expect 0)`);
  if (stillBroken.length > 0) {
    for (const s of stillBroken) console.log(`  wk_id=${s.wk_subject_id} meanings=${s.meanings}`);
  }

  db.close();
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
