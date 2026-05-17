import { makeNotesRoute } from "@/lib/api-helpers";

export const { GET, POST } = makeNotesRoute({
  paramName: "itemId",
  table: "user_notes",
  fkColumn: "jlpt_item_id",
});
