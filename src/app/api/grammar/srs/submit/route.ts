import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { submitSrs } from "@/lib/srs/submit";

export const POST = withAuth(async (req, session) => {
  try {
    const { grammarPointId, isCorrect, timeToAnswerMs, mistakeType, forceKnown } =
      await req.json();

    if (!grammarPointId) {
      return NextResponse.json({ error: "Missing grammarPointId" }, { status: 400 });
    }

    const result = submitSrs({
      table: "grammar_progress",
      fkColumn: "grammar_point_id",
      userId: session.userId,
      fkId: grammarPointId,
      input: { isCorrect, timeToAnswerMs, mistakeType, forceKnown },
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Grammar SRS Submit Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
});
