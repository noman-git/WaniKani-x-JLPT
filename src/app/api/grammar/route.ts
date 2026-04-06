import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth";
import { db } from "@/lib/db";
import { grammarPoints, grammarProgress } from "@/lib/db/schema";
import { eq, and, like, sql, inArray } from "drizzle-orm";

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

  try {
    const { searchParams } = new URL(request.url);
    const level = searchParams.get("level"); // "N5" or "N4"
    const search = searchParams.get("search");
    const status = searchParams.get("status"); // "known", "learning", "unknown", "not-started"
    const tag = searchParams.get("tag");

    // Build query
    const conditions = [];
    if (level) {
      conditions.push(eq(grammarPoints.jlptLevel, level));
    }
    if (search) {
      conditions.push(
        sql`(${grammarPoints.title} LIKE ${'%' + search + '%'} OR ${grammarPoints.titleRomaji} LIKE ${'%' + search + '%'} OR ${grammarPoints.meaning} LIKE ${'%' + search + '%'})`
      );
    }
    if (tag) {
      conditions.push(like(grammarPoints.tags, `%"${tag}"%`));
    }

    let query = db.select().from(grammarPoints);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }
    const points = query.orderBy(grammarPoints.order).all();

    // Get all progress for this user
    const allProgress = db
      .select()
      .from(grammarProgress)
      .where(eq(grammarProgress.userId, session.userId))
      .all();

    const progressMap = new Map(
      allProgress.map((p) => [p.grammarPointId, p.status])
    );

    // Build response with progress
    let results = points.map((p) => ({
      ...p,
      examples: JSON.parse(p.examples as string),
      relatedGrammarSlugs: JSON.parse(p.relatedGrammarSlugs as string),
      tags: JSON.parse(p.tags as string),
      userStatus: progressMap.get(p.id) || "not-started",
    }));

    // Filter by status if requested
    if (status) {
      if (status === "not-started") {
        results = results.filter((r) => r.userStatus === "not-started");
      } else {
        results = results.filter((r) => r.userStatus === status);
      }
    }

    // Compute stats
    const total = points.length;
    const known = results.filter((r) => r.userStatus === "known").length;
    const learning = results.filter((r) => r.userStatus === "learning").length;

    return NextResponse.json({
      points: results,
      stats: {
        total,
        known: status ? allProgress.filter(p => p.status === "known").length : known,
        learning: status ? allProgress.filter(p => p.status === "learning").length : learning,
        notStarted: status ? total - allProgress.length : total - known - learning,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
