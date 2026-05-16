import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { getNote, setNote } from "@/lib/db/queries/user-state";

export const GET = withAuth(async (request, session) => {
  const { searchParams } = new URL(request.url);
  const grammarPointId = parseInt(searchParams.get("grammarPointId") || "");

  if (isNaN(grammarPointId)) {
    return NextResponse.json({ error: "Invalid grammarPointId" }, { status: 400 });
  }

  try {
    const content = getNote({
      table: "grammar_notes",
      fkColumn: "grammar_point_id",
      userId: session.userId,
      fkId: grammarPointId,
    });
    return NextResponse.json({ content });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});

export const POST = withAuth(async (request, session) => {
  try {
    const { grammarPointId, content } = (await request.json()) as {
      grammarPointId?: number;
      content?: string;
    };

    if (!grammarPointId || typeof content !== "string") {
      return NextResponse.json(
        { error: "Invalid grammarPointId or content" },
        { status: 400 },
      );
    }

    setNote({
      table: "grammar_notes",
      fkColumn: "grammar_point_id",
      userId: session.userId,
      fkId: grammarPointId,
      content,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
