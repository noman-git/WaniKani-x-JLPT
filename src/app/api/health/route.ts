import { NextResponse } from "next/server";
import { sqlite } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    sqlite.prepare("SELECT 1").get();
    return NextResponse.json({ status: "ok" });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ status: "error", message }, { status: 503 });
  }
}
