import { makeNotesRoute } from "@/lib/api-helpers";

export const { GET, POST } = makeNotesRoute({
  paramName: "grammarPointId",
  table: "grammar_notes",
  fkColumn: "grammar_point_id",
});
