import { db } from "@/lib/db";
import { grammarPoints } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { withAuth } from "@/lib/api-helpers";
import { upsertProgressStatus } from "@/lib/db/queries/user-state";
import { NextResponse } from "next/server";

const STATUSES = ["known", "learning", "unknown"] as const;
type Status = (typeof STATUSES)[number];

export const POST = withAuth(async (request, session) => {
  try {
    const body = (await request.json()) as {
      grammarPointId?: number;
      status?: Status | "not-started";
    };
    const grammarPointId = body.grammarPointId;
    const status: Status | undefined =
      body.status === "not-started" ? "unknown" : body.status;

    if (!grammarPointId || !status || !STATUSES.includes(status)) {
      return NextResponse.json(
        { error: "Invalid grammarPointId or status" },
        { status: 400 },
      );
    }

    const point = db
      .select()
      .from(grammarPoints)
      .where(eq(grammarPoints.id, grammarPointId))
      .get();
    if (!point) {
      return NextResponse.json({ error: "Grammar point not found" }, { status: 404 });
    }

    upsertProgressStatus({
      table: "grammar_progress",
      fkColumn: "grammar_point_id",
      userId: session.userId,
      fkId: grammarPointId,
      status,
    });

    return NextResponse.json({ success: true, grammarPointId, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
