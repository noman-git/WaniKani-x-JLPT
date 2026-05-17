import { db } from "@/lib/db";
import { grammarPoints } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { makeProgressRoute } from "@/lib/api-helpers";

export const { POST } = makeProgressRoute({
  paramName: "grammarPointId",
  table: "grammar_progress",
  fkColumn: "grammar_point_id",
  notFoundLabel: "Grammar point",
  verifyId: (id) =>
    !!db
      .select({ id: grammarPoints.id })
      .from(grammarPoints)
      .where(eq(grammarPoints.id, id))
      .get(),
});
