import { db } from "@/lib/db";
import { jlptItems, userProgress } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, AuthError } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

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
    const { itemId, status } = await request.json();

    if (!itemId || !["known", "learning", "unknown"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid itemId or status" },
        { status: 400 }
      );
    }

    // Check item exists
    const item = db
      .select()
      .from(jlptItems)
      .where(eq(jlptItems.id, itemId))
      .get();

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Upsert progress for this user
    const existing = db
      .select()
      .from(userProgress)
      .where(
        and(
          eq(userProgress.userId, session.userId),
          eq(userProgress.jlptItemId, itemId)
        )
      )
      .get();

    if (existing) {
      db.update(userProgress)
        .set({ status, updatedAt: new Date().toISOString() })
        .where(eq(userProgress.id, existing.id))
        .run();
    } else {
      db.insert(userProgress)
        .values({
          userId: session.userId,
          jlptItemId: itemId,
          status,
          updatedAt: new Date().toISOString(),
        })
        .run();
    }

    return NextResponse.json({ success: true, itemId, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
