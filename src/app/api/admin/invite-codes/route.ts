import { db } from "@/lib/db";
import { inviteCodes, users } from "@/lib/db/schema";
import { withAdmin } from "@/lib/api-helpers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import crypto from "crypto";

/** Generate a random 8-char invite code */
function generateCode(): string {
  return crypto.randomBytes(4).toString("hex"); // e.g. "a1b2c3d4"
}

/** GET: List all invite codes */
export const GET = withAdmin(async () => {
  const codes = db
    .select({
      id: inviteCodes.id,
      code: inviteCodes.code,
      usedBy: inviteCodes.usedBy,
      createdAt: inviteCodes.createdAt,
      usedAt: inviteCodes.usedAt,
      usedByUsername: users.username,
    })
    .from(inviteCodes)
    .leftJoin(users, eq(inviteCodes.usedBy, users.id))
    .all();

  return NextResponse.json({ codes });
});

/** POST: Generate new invite codes */
export const POST = withAdmin(async (request) => {
  try {
    const body = await request.json().catch(() => ({}));
    const count = Math.min(Math.max(body.count || 1, 1), 20); // 1-20 codes at a time

    const generated: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = generateCode();
      db.insert(inviteCodes)
        .values({ code, createdAt: new Date().toISOString() })
        .run();
      generated.push(code);
    }

    return NextResponse.json({
      success: true,
      codes: generated,
      message: `Generated ${generated.length} invite code(s)`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
