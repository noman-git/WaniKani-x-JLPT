import { NextRequest, NextResponse } from "next/server";
import Database from "better-sqlite3";
import path from "path";

const CACHE_TTL_DAYS = 30; // Cache responses for 30 days

function getDb() {
  const dbPath = path.join(process.cwd(), "data", "jlpt.db");
  return new Database(dbPath);
}

function getCachedResponse(rawDb: InstanceType<typeof Database>, key: string): string | null {
  const row = rawDb
    .prepare("SELECT response_json, cached_at FROM kanji_cache WHERE query_key = ?")
    .get(key) as { response_json: string; cached_at: string } | undefined;

  if (!row) return null;

  // Check TTL
  const cachedDate = new Date(row.cached_at);
  const now = new Date();
  const diffDays = (now.getTime() - cachedDate.getTime()) / (1000 * 60 * 60 * 24);

  if (diffDays > CACHE_TTL_DAYS) {
    rawDb.prepare("DELETE FROM kanji_cache WHERE query_key = ?").run(key);
    return null;
  }

  return row.response_json;
}

function setCachedResponse(rawDb: InstanceType<typeof Database>, key: string, json: string) {
  rawDb
    .prepare(
      "INSERT OR REPLACE INTO kanji_cache (query_key, response_json, cached_at) VALUES (?, ?, ?)"
    )
    .run(key, json, new Date().toISOString());
}

export async function GET(request: NextRequest) {
  try {
    const { requireAuth, AuthError } = await import("@/lib/auth");
    await requireAuth(request);
  } catch (e: any) {
    if (e?.name === "AuthError") {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    throw e;
  }

  const { searchParams } = new URL(request.url);
  const char = searchParams.get("char");
  const word = searchParams.get("word");

  if (!char && !word) {
    return NextResponse.json(
      { error: "Provide either 'char' (for kanji lookup) or 'word' (for vocab lookup)" },
      { status: 400 }
    );
  }

  const rawDb = getDb();

  try {
    if (char) {
      // Kanji lookup via kanjiapi.dev
      const cacheKey = `kanjiapi:${char}`;
      const cached = getCachedResponse(rawDb, cacheKey);

      if (cached) {
        rawDb.close();
        return NextResponse.json({ source: "kanjiapi", data: JSON.parse(cached), cached: true });
      }

      const res = await fetch(`https://kanjiapi.dev/v1/kanji/${encodeURIComponent(char)}`);
      if (!res.ok) {
        rawDb.close();
        return NextResponse.json(
          { error: `kanjiapi.dev returned ${res.status}`, source: "kanjiapi" },
          { status: res.status }
        );
      }

      const data = await res.json();
      setCachedResponse(rawDb, cacheKey, JSON.stringify(data));
      rawDb.close();

      return NextResponse.json({ source: "kanjiapi", data, cached: false });
    }

    if (word) {
      // Word lookup via Jisho API
      const cacheKey = `jisho:${word}`;
      const cached = getCachedResponse(rawDb, cacheKey);

      if (cached) {
        rawDb.close();
        return NextResponse.json({ source: "jisho", data: JSON.parse(cached), cached: true });
      }

      const res = await fetch(
        `https://jisho.org/api/v1/search/words?keyword=${encodeURIComponent(word)}`
      );
      if (!res.ok) {
        rawDb.close();
        return NextResponse.json(
          { error: `Jisho API returned ${res.status}`, source: "jisho" },
          { status: res.status }
        );
      }

      const data = await res.json();
      // Only cache the first 5 results to keep cache small
      const trimmed = {
        ...data,
        data: (data.data || []).slice(0, 5),
      };
      setCachedResponse(rawDb, cacheKey, JSON.stringify(trimmed));
      rawDb.close();

      return NextResponse.json({ source: "jisho", data: trimmed, cached: false });
    }
  } catch (error) {
    rawDb.close();
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
