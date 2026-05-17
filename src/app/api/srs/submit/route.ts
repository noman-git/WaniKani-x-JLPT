import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { submitSrs } from "@/lib/srs/submit";

export const POST = withAuth(async (req, session) => {
  try {
    const { jlptItemId, isCorrect, timeToAnswerMs, mistakeType, forceKnown, forceUnknown } =
      await req.json();

    if (!jlptItemId) {
      return NextResponse.json({ error: "Missing jlptItemId" }, { status: 400 });
    }

    const result = submitSrs({
      table: "user_progress",
      fkColumn: "jlpt_item_id",
      userId: session.userId,
      fkId: jlptItemId,
      input: { isCorrect, timeToAnswerMs, mistakeType, forceKnown, forceUnknown },
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("SRS Submit Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
});
