import { db } from "@/lib/db";
import { jlptItems, wanikaniSubjects, userProgress } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

const WK_API_BASE = "https://api.wanikani.com/v2";

interface WKSubject {
  id: number;
  object: string;
  data: {
    characters: string | null;
    meanings: Array<{ meaning: string; primary: boolean }>;
    readings?: Array<{ reading: string; primary: boolean; type?: string }>;
    level: number;
  };
}

async function fetchAllSubjects(token: string): Promise<WKSubject[]> {
  const subjects: WKSubject[] = [];
  let url: string | null =
    `${WK_API_BASE}/subjects?types=kanji,vocabulary,kana_vocabulary`;

  while (url) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Wanikani-Revision": "20170710",
      },
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`WaniKani API error (${res.status}): ${error}`);
    }

    const data = await res.json();
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
  const jlptMap = new Map<string, Array<typeof allJlptItems[0]>>();
  for (const item of allJlptItems) {
    if (!jlptMap.has(item.expression)) {
      jlptMap.set(item.expression, []);
    }
    jlptMap.get(item.expression)!.push(item);
  }

  let matched = 0;
  let unmatched = 0;

  // Clear existing WK subjects before re-syncing
  db.delete(wanikaniSubjects).run();

  const insertStmt = db
    .insert(wanikaniSubjects)
    .values({
      wkSubjectId: sql.placeholder("wkSubjectId"),
      characters: sql.placeholder("characters"),
      meanings: sql.placeholder("meanings"),
      readings: sql.placeholder("readings"),
      wkLevel: sql.placeholder("wkLevel"),
      objectType: sql.placeholder("objectType"),
      matchedJlptItemId: sql.placeholder("matchedJlptItemId"),
    })
    .prepare();

  for (const subject of subjects) {
    const chars = subject.data.characters;
    if (!chars) continue;

    const meanings = subject.data.meanings
      .filter((m) => m.primary)
      .map((m) => m.meaning);
    const readings = (subject.data.readings || [])
      .filter((r) => r.primary)
      .map((r) => r.reading);

    const jlptMatches = jlptMap.get(chars) || [];

    if (jlptMatches.length > 0) {
      // Insert one row per matching JLPT item
      for (const jlptItem of jlptMatches) {
        insertStmt.run({
          wkSubjectId: subject.id,
          characters: chars,
          meanings: JSON.stringify(meanings),
          readings: JSON.stringify(readings),
          wkLevel: subject.data.level,
          objectType: subject.object,
          matchedJlptItemId: jlptItem.id,
        });
      }
      matched++;
    } else {
      // No JLPT match — still store the WK subject for reference
      insertStmt.run({
        wkSubjectId: subject.id,
        characters: chars,
        meanings: JSON.stringify(meanings),
        readings: JSON.stringify(readings),
        wkLevel: subject.data.level,
        objectType: subject.object,
        matchedJlptItemId: null,
      });
      unmatched++;
    }
  }

  return { matched, unmatched, total: subjects.length };
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
        matchedToJLPT: stats.matched,
        notInJLPT: stats.unmatched,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
