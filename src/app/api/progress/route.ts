import { db } from "@/lib/db";
import { jlptItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { withAuth } from "@/lib/api-helpers";
import { upsertProgressStatus } from "@/lib/db/queries/user-state";
import { NextResponse } from "next/server";

const STATUSES = ["known", "learning", "unknown"] as const;
type Status = (typeof STATUSES)[number];

export const POST = withAuth(async (request, session) => {
  try {
    const { itemId, status } = (await request.json()) as { itemId?: number; status?: Status };

    if (!itemId || !status || !STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid itemId or status" }, { status: 400 });
    }

    const item = db.select().from(jlptItems).where(eq(jlptItems.id, itemId)).get();
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    upsertProgressStatus({
      table: "user_progress",
      fkColumn: "jlpt_item_id",
      userId: session.userId,
      fkId: itemId,
      status,
    });

    return NextResponse.json({ success: true, itemId, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
