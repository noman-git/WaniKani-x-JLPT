import { withAdmin } from "@/lib/api-helpers";
import { sqlite } from "@/lib/db";
import { NextResponse } from "next/server";

export const GET = withAdmin(async () => {
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
});
