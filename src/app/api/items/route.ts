import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const level = searchParams.get("level"); // N4, N5
  const type = searchParams.get("type"); // kanji, vocab
  const status = searchParams.get("status"); // known, learning, unknown
  const search = searchParams.get("search");
  const onWanikani = searchParams.get("onWanikani"); // true, false
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");

  try {
    // Build WHERE clauses
    const whereClauses: string[] = [];
    const params: Record<string, unknown> = {};

    if (level) {
      whereClauses.push("j.jlpt_level = @level");
      params.level = level;
    }
    if (type) {
      whereClauses.push("j.type = @type");
      params.type = type;
    }
    if (status) {
      if (status === "unknown") {
        whereClauses.push("(p.status IS NULL OR p.status = 'unknown')");
      } else {
        whereClauses.push("p.status = @status");
        params.status = status;
      }
    }
    if (search) {
      whereClauses.push(
        "(j.expression LIKE @search OR j.reading LIKE @search OR j.meaning LIKE @search)"
      );
      params.search = `%${search}%`;
    }
    if (onWanikani === "true") {
      whereClauses.push("w_agg.wk_subject_id IS NOT NULL");
    } else if (onWanikani === "false") {
      whereClauses.push("w_agg.wk_subject_id IS NULL");
    }

    const whereSQL =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    // Use a subquery to pick only one WK match per JLPT item (the lowest WK level)
    const wkSubquery = `
      LEFT JOIN (
        SELECT matched_jlpt_item_id,
               MIN(wk_subject_id) as wk_subject_id,
               MIN(wk_level) as wk_level,
               MIN(characters) as wk_characters,
               MIN(match_type) as match_type
        FROM wanikani_subjects
        WHERE matched_jlpt_item_id IS NOT NULL
        GROUP BY matched_jlpt_item_id
      ) w_agg ON w_agg.matched_jlpt_item_id = j.id
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM jlpt_items j
      LEFT JOIN user_progress p ON p.jlpt_item_id = j.id
      ${wkSubquery}
      ${whereSQL}
    `;

    const dataQuery = `
      SELECT
        j.id, j.expression, j.reading, j.meaning, j.type, j.jlpt_level as jlptLevel, j.sources,
        COALESCE(p.status, 'unknown') as status,
        w_agg.wk_subject_id as wkSubjectId,
        w_agg.wk_level as wkLevel,
        w_agg.wk_characters as wkCharacters,
        w_agg.match_type as matchType
      FROM jlpt_items j
      LEFT JOIN user_progress p ON p.jlpt_item_id = j.id
      ${wkSubquery}
      ${whereSQL}
      ORDER BY j.jlpt_level ASC, j.type ASC, j.expression ASC
      LIMIT @limit OFFSET @offset
    `;

    params.limit = limit;
    params.offset = (page - 1) * limit;

    const Database = (await import("better-sqlite3")).default;
    const path = await import("path");
    const dbPath = path.join(process.cwd(), "data", "jlpt.db");
    const rawDb = new Database(dbPath, { readonly: true });

    const countResult = rawDb.prepare(countQuery).get(params) as { total: number };
    const items = rawDb.prepare(dataQuery).all(params);
    rawDb.close();

    // Summary stats (also deduplicated)
    const statsDb = new Database(dbPath, { readonly: true });
    const stats = statsDb
      .prepare(
        `
        SELECT
          j.jlpt_level as level,
          j.type,
          COUNT(*) as total,
          SUM(CASE WHEN p.status = 'known' THEN 1 ELSE 0 END) as known,
          SUM(CASE WHEN p.status = 'learning' THEN 1 ELSE 0 END) as learning,
          SUM(CASE WHEN w_agg.wk_subject_id IS NOT NULL THEN 1 ELSE 0 END) as onWanikani
        FROM jlpt_items j
        LEFT JOIN user_progress p ON p.jlpt_item_id = j.id
        LEFT JOIN (
          SELECT matched_jlpt_item_id, MIN(wk_subject_id) as wk_subject_id
          FROM wanikani_subjects
          WHERE matched_jlpt_item_id IS NOT NULL
          GROUP BY matched_jlpt_item_id
        ) w_agg ON w_agg.matched_jlpt_item_id = j.id
        GROUP BY j.jlpt_level, j.type
      `
      )
      .all();
    statsDb.close();

    return NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total: countResult.total,
        totalPages: Math.ceil(countResult.total / limit),
      },
      stats,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
