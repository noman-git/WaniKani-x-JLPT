import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth";
import { db } from "@/lib/db";
import { grammarPoints, grammarProgress } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function POST(request: NextRequest) {
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
    let { grammarPointId, status } = await request.json();
    
    if (status === "not-started") status = "unknown";

    if (!grammarPointId || !["known", "learning", "unknown"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid grammarPointId or status" },
        { status: 400 }
      );
    }

    // Check grammar point exists
    const point = db
      .select()
      .from(grammarPoints)
      .where(eq(grammarPoints.id, grammarPointId))
      .get();

    if (!point) {
      return NextResponse.json({ error: "Grammar point not found" }, { status: 404 });
    }

    // Upsert progress
    const existing = db
      .select()
      .from(grammarProgress)
      .where(
        and(
          eq(grammarProgress.userId, session.userId),
          eq(grammarProgress.grammarPointId, grammarPointId)
        )
      )
      .get();

    const now = new Date().toISOString();

    if (existing) {
      db.update(grammarProgress)
        .set({ status, updatedAt: now })
        .where(eq(grammarProgress.id, existing.id))
        .run();
    } else {
      db.insert(grammarProgress)
        .values({
          userId: session.userId,
          grammarPointId,
          status,
          updatedAt: now,
        })
        .run();
    }

    return NextResponse.json({ success: true, grammarPointId, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
