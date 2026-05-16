import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { loadItemDetail } from "@/lib/db/queries/item-detail";

export const GET = withAuth<{ id: string }>(async (_request, session, ctx) => {
  const { id } = await ctx!.params;
  const itemId = parseInt(id);

  if (isNaN(itemId)) {
    return NextResponse.json({ error: "Invalid item ID" }, { status: 400 });
  }

  try {
    const detail = loadItemDetail(itemId, session.userId);
    if (!detail) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
