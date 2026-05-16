import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { db } from "@/lib/db";
import { grammarPoints, grammarProgress, grammarNotes, grammarItemLinks, jlptItems, wanikaniSubjects } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export const GET = withAuth<{ slug: string }>(async (_request, session, ctx) => {
  try {
    const { slug } = await ctx!.params;

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

    // Get linked jlpt items
    const linkedItemsRaw = db
      .select({
        id: jlptItems.id,
        expression: jlptItems.expression,
        meaning: jlptItems.meaning,
        reading: jlptItems.reading,
        type: jlptItems.type,
        jlptLevel: jlptItems.jlptLevel,
        wkReadings: wanikaniSubjects.readings,
      })
      .from(grammarItemLinks)
      .innerJoin(jlptItems, eq(grammarItemLinks.jlptItemId, jlptItems.id))
      .leftJoin(wanikaniSubjects, eq(wanikaniSubjects.matchedJlptItemId, jlptItems.id))
      .where(eq(grammarItemLinks.grammarPointId, point.id))
      .all();

    // Remove duplicates if the NLP matcher matched the same vocab multiple times
    const linkedItems = linkedItemsRaw.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);

    return NextResponse.json({
      ...point,
      examples: JSON.parse(point.examples as string),
      relatedGrammarSlugs: relatedSlugs,
      tags: JSON.parse(point.tags as string),
      userStatus: progress?.status || "not-started",
      userNote: note?.content || "",
      relatedGrammar: relatedPoints,
      linkedItems,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
