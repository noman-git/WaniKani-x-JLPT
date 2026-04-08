import { requireAuth, AuthError } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  let session;
  try {
    session = await requireAuth(request);
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    throw e;
  }
  
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const level = searchParams.get("level");
  const onWanikani = searchParams.get("onWanikani");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");

  const userId = session.userId;

  try {
    const whereClauses: string[] = [];
    const params: Record<string, unknown> = {};

    whereClauses.push("j.type = @type");
    params.type = "radical";

    if (level) {
      whereClauses.push("j.jlpt_level = @level");
      params.level = level;
    }

    if (onWanikani) {
      if (onWanikani === "true") {
        whereClauses.push("w_agg.wk_subject_id IS NOT NULL");
      } else {
        whereClauses.push("w_agg.wk_subject_id IS NULL");
      }
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
        "(j.expression LIKE @search OR j.meaning LIKE @search)"
      );
      params.search = `%${search}%`;
    }

    const whereSQL =
      whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const wkSubquery = `
      LEFT JOIN (
        SELECT matched_jlpt_item_id,
               MIN(wk_subject_id) as wk_subject_id,
               MIN(wk_level) as wk_level,
               MIN(characters) as wk_characters,
               'radical' as match_type
        FROM wanikani_radicals
        WHERE matched_jlpt_item_id IS NOT NULL
        GROUP BY matched_jlpt_item_id
      ) w_agg ON w_agg.matched_jlpt_item_id = j.id
    `;

    const progressJoin = userId
      ? `LEFT JOIN user_progress p ON p.jlpt_item_id = j.id AND p.user_id = @userId`
      : `LEFT JOIN user_progress p ON 0 = 1`;

    params.userId = userId;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM jlpt_items j
      ${progressJoin}
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
      ${progressJoin}
      ${wkSubquery}
      ${whereSQL}
      ORDER BY w_agg.wk_level ASC, j.expression ASC
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

    const statsProgressJoin = userId
      ? `LEFT JOIN user_progress p ON p.jlpt_item_id = j.id AND p.user_id = ${userId}`
      : `LEFT JOIN user_progress p ON 0 = 1`;

    const stats = rawDb
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
        ${statsProgressJoin}
        LEFT JOIN (
          SELECT matched_jlpt_item_id, MIN(wk_subject_id) as wk_subject_id
          FROM wanikani_radicals
          WHERE matched_jlpt_item_id IS NOT NULL
          GROUP BY matched_jlpt_item_id
        ) w_agg ON w_agg.matched_jlpt_item_id = j.id
        WHERE j.type = 'radical'
        GROUP BY j.jlpt_level, j.type
      `
      )
      .all();
    rawDb.close();

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
