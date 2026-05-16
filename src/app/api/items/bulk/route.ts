import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-helpers";
import { loadItemDetail, ItemDetail } from "@/lib/db/queries/item-detail";

export const GET = withAuth(async (request, session) => {
  const url = new URL(request.url);
  const idsParam = url.searchParams.get("ids");
  if (!idsParam) {
    return NextResponse.json({ error: "Missing ids parameter" }, { status: 400 });
  }

  const itemIds = idsParam
    .split(",")
    .map((id) => parseInt(id.trim()))
    .filter((id) => !isNaN(id));

  if (itemIds.length === 0) {
    return NextResponse.json({ items: {} });
  }

  try {
    const results: Record<number, ItemDetail> = {};
    for (const id of itemIds) {
      const detail = loadItemDetail(id, session.userId);
      if (detail) results[id] = detail;
    }
    return NextResponse.json({ items: results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
