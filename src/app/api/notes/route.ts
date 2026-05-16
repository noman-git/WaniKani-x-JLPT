import { NextRequest, NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth";
import { sqlite } from "@/lib/db";

export async function GET(request: NextRequest) {
  let session;
  try {
    session = await requireAuth(request);
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    throw e;
  }

  const { searchParams } = new URL(request.url);
  const itemId = parseInt(searchParams.get("itemId") || "");

  if (isNaN(itemId)) {
    return NextResponse.json({ error: "Invalid itemId" }, { status: 400 });
  }

  try {
    const row = sqlite
      .prepare(
        `SELECT content FROM user_notes WHERE user_id = ? AND jlpt_item_id = ?`
      )
      .get(session.userId, itemId) as { content: string } | undefined;

    return NextResponse.json({ content: row?.content ?? "" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireAuth(request);
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    throw e;
  }

  try {
    const { itemId, content } = await request.json();

    if (!itemId || typeof content !== "string") {
      return NextResponse.json({ error: "Invalid itemId or content" }, { status: 400 });
    }

    const existing = sqlite
      .prepare(`SELECT id FROM user_notes WHERE user_id = ? AND jlpt_item_id = ?`)
      .get(session.userId, itemId) as { id: number } | undefined;

    const now = new Date().toISOString();

    if (existing) {
      sqlite
        .prepare(`UPDATE user_notes SET content = ?, updated_at = ? WHERE id = ?`)
        .run(content, now, existing.id);
    } else {
      sqlite
        .prepare(
          `INSERT INTO user_notes (user_id, jlpt_item_id, content, updated_at) VALUES (?, ?, ?, ?)`
        )
        .run(session.userId, itemId, content, now);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
