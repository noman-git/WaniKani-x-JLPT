import { db } from "@/lib/db";
import { jlptItems, wanikaniSubjects, wanikaniRadicals } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

const WK_API_BASE = "https://api.wanikani.com/v2";

interface WKMeaning {
  meaning: string;
  primary: boolean;
  accepted_answer: boolean;
}

interface WKReading {
  reading: string;
  primary: boolean;
  accepted_answer: boolean;
  type?: string; // "onyomi" | "kunyomi" | "nanori" for kanji
}

interface WKSubject {
  id: number;
  object: string; // "radical" | "kanji" | "vocabulary" | "kana_vocabulary"
  data: {
    characters: string | null;
    meanings: WKMeaning[];
    readings?: WKReading[];
    level: number;
    component_subject_ids?: number[]; // radical IDs for kanji
    amalgamation_subject_ids?: number[]; // vocab IDs for kanji/radical
    meaning_mnemonic?: string;
    reading_mnemonic?: string;
    meaning_hint?: string;
    reading_hint?: string;
    character_images?: Array<{
      url: string;
      metadata: { inline_styles?: boolean };
      content_type: string;
    }>;
  };
}

async function fetchAllSubjects(token: string): Promise<WKSubject[]> {
  const subjects: WKSubject[] = [];
  let url: string | null =
    `${WK_API_BASE}/subjects?types=radical,kanji,vocabulary,kana_vocabulary`;

  while (url) {
    const res: Response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Wanikani-Revision": "20170710",
      },
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`WaniKani API error (${res.status}): ${error}`);
    }

    const data: { data: WKSubject[]; pages?: { next_url?: string | null } } =
      await res.json();
    subjects.push(...data.data);
    url = data.pages?.next_url || null;

    // Rate limit: wait 1 second between requests
    if (url) await new Promise((r) => setTimeout(r, 1000));
  }

  return subjects;
}

function matchSubjects(subjects: WKSubject[]) {
  const allJlptItems = db.select().from(jlptItems).all();

  // Map expression -> ALL matching JLPT items (not just one)
  const jlptMap = new Map<string, Array<(typeof allJlptItems)[0]>>();
  for (const item of allJlptItems) {
    if (!jlptMap.has(item.expression)) {
      jlptMap.set(item.expression, []);
    }
    jlptMap.get(item.expression)!.push(item);
  }

  let exactMatched = 0;
  let readingMatched = 0;
  let prefixMatched = 0;
  let unmatched = 0;
  let radicalCount = 0;

  // Clear existing WK data before re-syncing
  db.delete(wanikaniSubjects).run();
  db.delete(wanikaniRadicals).run();

  const insertSubject = db
    .insert(wanikaniSubjects)
    .values({
      wkSubjectId: sql.placeholder("wkSubjectId"),
      characters: sql.placeholder("characters"),
      meanings: sql.placeholder("meanings"),
      readings: sql.placeholder("readings"),
      wkLevel: sql.placeholder("wkLevel"),
      objectType: sql.placeholder("objectType"),
      matchedJlptItemId: sql.placeholder("matchedJlptItemId"),
      matchType: sql.placeholder("matchType"),
      componentSubjectIds: sql.placeholder("componentSubjectIds"),
      amalgamationSubjectIds: sql.placeholder("amalgamationSubjectIds"),
      meaningMnemonic: sql.placeholder("meaningMnemonic"),
      readingMnemonic: sql.placeholder("readingMnemonic"),
      meaningHint: sql.placeholder("meaningHint"),
      readingHint: sql.placeholder("readingHint"),
    })
    .prepare();

  const insertRadical = db
    .insert(wanikaniRadicals)
    .values({
      wkSubjectId: sql.placeholder("wkSubjectId"),
      characters: sql.placeholder("characters"),
      meanings: sql.placeholder("meanings"),
      wkLevel: sql.placeholder("wkLevel"),
      characterImageUrl: sql.placeholder("characterImageUrl"),
      meaningMnemonic: sql.placeholder("meaningMnemonic"),
      meaningHint: sql.placeholder("meaningHint"),
      amalgamationSubjectIds: sql.placeholder("amalgamationSubjectIds"),
    })
    .onConflictDoUpdate({
      target: wanikaniRadicals.wkSubjectId,
      set: {
        characters: sql`excluded.characters`,
        meanings: sql`excluded.meanings`,
        wkLevel: sql`excluded.wk_level`,
        characterImageUrl: sql`excluded.character_image_url`,
        meaningMnemonic: sql`excluded.meaning_mnemonic`,
        meaningHint: sql`excluded.meaning_hint`,
        amalgamationSubjectIds: sql`excluded.amalgamation_subject_ids`,
      },
    })
    .prepare();

  // ── Pass 1: Insert all subjects with exact matches ──
  // Track which JLPT items got exact matches so we know what's left for Pass 2
  const exactMatchedItemIds = new Set<number>();
  // Build a reading lookup for Pass 2: reading string -> WK subject data
  const wkReadingMap = new Map<string, Array<{ subject: WKSubject; commonFields: Record<string, unknown> }>>();

  for (const subject of subjects) {
    // Store radicals in their own table
    if (subject.object === "radical") {
      let imageUrl: string | null = null;
      if (!subject.data.characters && subject.data.character_images) {
        const svgImage = subject.data.character_images.find(
          (img) =>
            img.content_type === "image/svg+xml" &&
            img.metadata?.inline_styles === false
        );
        imageUrl = svgImage?.url || null;
      }

      insertRadical.run({
        wkSubjectId: subject.id,
        characters: subject.data.characters || null,
        meanings: JSON.stringify(
          subject.data.meanings.map((m) => ({
            meaning: m.meaning,
            primary: m.primary,
          }))
        ),
        wkLevel: subject.data.level,
        characterImageUrl: imageUrl,
        meaningMnemonic: subject.data.meaning_mnemonic || null,
        meaningHint: subject.data.meaning_hint || null,
        amalgamationSubjectIds: subject.data.amalgamation_subject_ids
          ? JSON.stringify(subject.data.amalgamation_subject_ids)
          : null,
      });
      radicalCount++;
      continue;
    }

    const chars = subject.data.characters;
    if (!chars) continue;

    const meanings = JSON.stringify(
      subject.data.meanings.map((m) => ({
        meaning: m.meaning,
        primary: m.primary,
        accepted_answer: m.accepted_answer,
      }))
    );

    const readings = JSON.stringify(
      (subject.data.readings || []).map((r) => ({
        reading: r.reading,
        type: r.type || null,
        primary: r.primary,
        accepted_answer: r.accepted_answer,
      }))
    );

    const componentIds = subject.data.component_subject_ids
      ? JSON.stringify(subject.data.component_subject_ids)
      : null;
    const amalgamationIds = subject.data.amalgamation_subject_ids
      ? JSON.stringify(subject.data.amalgamation_subject_ids)
      : null;

    const commonFields = {
      wkSubjectId: subject.id,
      characters: chars,
      meanings,
      readings,
      wkLevel: subject.data.level,
      objectType: subject.object,
      componentSubjectIds: componentIds,
      amalgamationSubjectIds: amalgamationIds,
      meaningMnemonic: subject.data.meaning_mnemonic || null,
      readingMnemonic: subject.data.reading_mnemonic || null,
      meaningHint: subject.data.meaning_hint || null,
      readingHint: subject.data.reading_hint || null,
    };

    // Try exact expression match
    const jlptMatches = jlptMap.get(chars) || [];

    if (jlptMatches.length > 0) {
      for (const jlptItem of jlptMatches) {
        insertSubject.run({
          ...commonFields,
          matchedJlptItemId: jlptItem.id,
          matchType: "exact",
        });
        exactMatchedItemIds.add(jlptItem.id);
      }
      exactMatched++;
    } else {
      insertSubject.run({
        ...commonFields,
        matchedJlptItemId: null,
        matchType: null,
      });
      unmatched++;
    }

    // Index readings for Pass 2 (vocab/kana_vocab only)
    if (subject.object === "vocabulary" || subject.object === "kana_vocabulary") {
      for (const r of subject.data.readings || []) {
        if (!wkReadingMap.has(r.reading)) {
          wkReadingMap.set(r.reading, []);
        }
        wkReadingMap.get(r.reading)!.push({ subject, commonFields });
      }
    }
  }

  // ── Pass 2: Fallback matching for unmatched JLPT vocab items ──
  const unmatchedVocab = allJlptItems.filter(
    (item) => item.type === "vocab" && !exactMatchedItemIds.has(item.id)
  );

  // Common prefixes to strip for fuzzy matching
  const PREFIXES_TO_STRIP = ["お", "ご", "御"];

  for (const item of unmatchedVocab) {
    // Strategy A: Reading-based match
    // Check if the JLPT item's expression (often hiragana like いじめる)
    // matches a reading of any WK subject (e.g., 苛める has reading いじめる)
    const readingMatches = wkReadingMap.get(item.expression);
    if (readingMatches && readingMatches.length > 0) {
      // Use the first match (most relevant)
      const best = readingMatches[0];
      insertSubject.run({
        ...best.commonFields,
        matchedJlptItemId: item.id,
        matchType: "reading",
      });
      readingMatched++;
      continue;
    }

    // Strategy B: Prefix strip match
    // Strip common honorific prefixes (お, ご) and try exact match
    // Only strip if the remaining part is >= 2 chars OR contains kanji
    let stripped: string | null = null;
    for (const prefix of PREFIXES_TO_STRIP) {
      if (item.expression.startsWith(prefix) && item.expression.length > prefix.length) {
        const candidate = item.expression.slice(prefix.length);
        // Require at least 2 characters, or the candidate contains kanji
        const hasKanji = [...candidate].some((ch) => {
          const code = ch.charCodeAt(0);
          return code >= 0x4e00 && code <= 0x9fff;
        });
        if (candidate.length >= 2 || hasKanji) {
          stripped = candidate;
          break;
        }
      }
    }

    if (stripped) {
      // Check if the stripped expression matches any WK subject
      const strippedMatches = jlptMap.get(stripped); // First check JLPT map (not useful here)
      
      // Actually, look through ALL WK subjects for chars matching the stripped expression
      // We need to find the WK subject row we already inserted
      // More efficient: check if stripped expression is a WK subject character
      const wkByChars = subjects.find(
        (s) =>
          s.object !== "radical" &&
          s.data.characters === stripped
      );
      
      if (wkByChars && wkByChars.data.characters) {
        const meanings = JSON.stringify(
          wkByChars.data.meanings.map((m) => ({
            meaning: m.meaning,
            primary: m.primary,
            accepted_answer: m.accepted_answer,
          }))
        );
        const readings = JSON.stringify(
          (wkByChars.data.readings || []).map((r) => ({
            reading: r.reading,
            type: r.type || null,
            primary: r.primary,
            accepted_answer: r.accepted_answer,
          }))
        );

        insertSubject.run({
          wkSubjectId: wkByChars.id,
          characters: wkByChars.data.characters,
          meanings,
          readings,
          wkLevel: wkByChars.data.level,
          objectType: wkByChars.object,
          matchedJlptItemId: item.id,
          matchType: "prefix_strip",
          componentSubjectIds: wkByChars.data.component_subject_ids
            ? JSON.stringify(wkByChars.data.component_subject_ids)
            : null,
          amalgamationSubjectIds: wkByChars.data.amalgamation_subject_ids
            ? JSON.stringify(wkByChars.data.amalgamation_subject_ids)
            : null,
          meaningMnemonic: wkByChars.data.meaning_mnemonic || null,
          readingMnemonic: wkByChars.data.reading_mnemonic || null,
          meaningHint: wkByChars.data.meaning_hint || null,
          readingHint: wkByChars.data.reading_hint || null,
        });
        prefixMatched++;
        continue;
      }

      // Also try reading match on the stripped version
      const strippedReadingMatches = wkReadingMap.get(stripped);
      if (strippedReadingMatches && strippedReadingMatches.length > 0) {
        const best = strippedReadingMatches[0];
        insertSubject.run({
          ...best.commonFields,
          matchedJlptItemId: item.id,
          matchType: "prefix_strip",
        });
        prefixMatched++;
        continue;
      }
    }
  }

  return {
    exactMatched,
    readingMatched,
    prefixMatched,
    unmatched,
    total: subjects.length,
    radicalCount,
  };
}

export async function POST() {
  const token = process.env.WANIKANI_API_TOKEN;
  if (!token || token === "your_token_here") {
    return NextResponse.json(
      { error: "WANIKANI_API_TOKEN not configured in .env" },
      { status: 400 }
    );
  }

  try {
    const subjects = await fetchAllSubjects(token);
    const stats = matchSubjects(subjects);

    return NextResponse.json({
      success: true,
      stats: {
        totalFetched: stats.total,
        matchedExact: stats.exactMatched,
        matchedByReading: stats.readingMatched,
        matchedByPrefixStrip: stats.prefixMatched,
        notInJLPT: stats.unmatched,
        radicalsStored: stats.radicalCount,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

