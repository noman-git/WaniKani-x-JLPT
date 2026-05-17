import { db } from "@/lib/db";
import { jlptItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { makeProgressRoute } from "@/lib/api-helpers";

export const { POST } = makeProgressRoute({
  paramName: "itemId",
  table: "user_progress",
  fkColumn: "jlpt_item_id",
  notFoundLabel: "Item",
  verifyId: (id) =>
    !!db.select({ id: jlptItems.id }).from(jlptItems).where(eq(jlptItems.id, id)).get(),
});
