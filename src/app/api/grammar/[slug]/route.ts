import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth";
import { db } from "@/lib/db";
import { grammarPoints, grammarProgress, grammarNotes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
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
    const { slug } = await params;

    const point = db
      .select()
      .from(grammarPoints)
      .where(eq(grammarPoints.slug, slug))
      .get();

    if (!point) {
      return NextResponse.json({ error: "Grammar point not found" }, { status: 404 });
    }

    // Get user progress
    const progress = db
      .select()
      .from(grammarProgress)
      .where(
        and(
          eq(grammarProgress.userId, session.userId),
          eq(grammarProgress.grammarPointId, point.id)
        )
      )
      .get();

    // Get user note
    const note = db
      .select()
      .from(grammarNotes)
      .where(
        and(
          eq(grammarNotes.userId, session.userId),
          eq(grammarNotes.grammarPointId, point.id)
        )
      )
      .get();

    // Get related grammar points
    const relatedSlugs = JSON.parse(point.relatedGrammarSlugs as string) as string[];
    let relatedPoints: Array<{ slug: string; title: string; meaning: string; jlptLevel: string }> = [];
    if (relatedSlugs.length > 0) {
      relatedPoints = db
        .select({
          slug: grammarPoints.slug,
          title: grammarPoints.title,
          meaning: grammarPoints.meaning,
          jlptLevel: grammarPoints.jlptLevel,
        })
        .from(grammarPoints)
        .all()
        .filter(p => relatedSlugs.includes(p.slug));
    }

    return NextResponse.json({
      ...point,
      examples: JSON.parse(point.examples as string),
      relatedGrammarSlugs: relatedSlugs,
      tags: JSON.parse(point.tags as string),
      userStatus: progress?.status || "not-started",
      userNote: note?.content || "",
      relatedGrammar: relatedPoints,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
