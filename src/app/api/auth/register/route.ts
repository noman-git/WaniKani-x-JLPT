import { db } from "@/lib/db";
import { users, inviteCodes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createSession } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { username, password, displayName, inviteCode } = await request.json();

    // Validate inputs
    if (!username || !password || !displayName || !inviteCode) {
      return NextResponse.json(
        { error: "Username, password, display name, and invite code are required" },
        { status: 400 }
      );
    }

    if (username.length < 3 || username.length > 20) {
      return NextResponse.json(
        { error: "Username must be 3-20 characters" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Validate invite code
    const code = db
      .select()
      .from(inviteCodes)
      .where(eq(inviteCodes.code, inviteCode))
      .get();

    if (!code) {
      return NextResponse.json(
        { error: "Invalid invite code" },
        { status: 400 }
      );
    }

    if (code.usedBy !== null) {
      return NextResponse.json(
        { error: "This invite code has already been used" },
        { status: 400 }
      );
    }

    // Check username uniqueness
    const existing = db
      .select()
      .from(users)
      .where(eq(users.username, username.toLowerCase()))
      .get();

    if (existing) {
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 409 }
      );
    }

    // Create user
    const passwordHash = await bcrypt.hash(password, 10);
    const result = db
      .insert(users)
      .values({
        username: username.toLowerCase(),
        passwordHash,
        displayName,
        isAdmin: false,
        createdAt: new Date().toISOString(),
      })
      .run();

    const userId = Number(result.lastInsertRowid);

    // Mark invite code as used
    db.update(inviteCodes)
      .set({ usedBy: userId, usedAt: new Date().toISOString() })
      .where(eq(inviteCodes.id, code.id))
      .run();

    // Create session
    await createSession({
      userId,
      username: username.toLowerCase(),
      isAdmin: false,
    });

    return NextResponse.json({
      success: true,
      user: { id: userId, username: username.toLowerCase(), displayName },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
