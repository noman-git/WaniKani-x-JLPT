import { db } from "@/lib/db";
import { jlptItems, userProgress } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
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

    // Upsert progress
    const existing = db
      .select()
      .from(userProgress)
      .where(eq(userProgress.jlptItemId, itemId))
      .get();

    if (existing) {
      db.update(userProgress)
        .set({ status, updatedAt: new Date().toISOString() })
        .where(eq(userProgress.jlptItemId, itemId))
        .run();
    } else {
      db.insert(userProgress)
        .values({
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
