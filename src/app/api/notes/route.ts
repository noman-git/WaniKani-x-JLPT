import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { getNote, setNote } from "@/lib/db/queries/user-state";

export const GET = withAuth(async (request, session) => {
  const { searchParams } = new URL(request.url);
  const itemId = parseInt(searchParams.get("itemId") || "");

  if (isNaN(itemId)) {
    return NextResponse.json({ error: "Invalid itemId" }, { status: 400 });
  }

  try {
    const content = getNote({
      table: "user_notes",
      fkColumn: "jlpt_item_id",
      userId: session.userId,
      fkId: itemId,
    });
    return NextResponse.json({ content });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});

export const POST = withAuth(async (request, session) => {
  try {
    const { itemId, content } = (await request.json()) as {
      itemId?: number;
      content?: string;
    };

    if (!itemId || typeof content !== "string") {
      return NextResponse.json({ error: "Invalid itemId or content" }, { status: 400 });
    }

    setNote({
      table: "user_notes",
      fkColumn: "jlpt_item_id",
      userId: session.userId,
      fkId: itemId,
      content,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
