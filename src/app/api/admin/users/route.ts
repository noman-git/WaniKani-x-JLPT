import { requireAdmin, AuthError } from "@/lib/auth";
import { sqlite } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    requireAdmin(request);
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    throw e;
  }

  const usersList = sqlite
    .prepare(
      `SELECT u.id, u.username, u.display_name, u.is_admin, u.created_at,
              COUNT(p.id) as progress_count
       FROM users u
       LEFT JOIN user_progress p ON p.user_id = u.id
       GROUP BY u.id
       ORDER BY u.created_at ASC`
    )
    .all();

  return NextResponse.json({ users: usersList });
}
