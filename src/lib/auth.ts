import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { db } from "./db";
import { users } from "./db/schema";
import { eq } from "drizzle-orm";

const SESSION_COOKIE = "jlpt_session";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET env var must be set (min 16 chars)");
  }
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  userId: number;
  username: string;
  isAdmin: boolean;
}

/** Create a signed JWT and set it as an HTTP-only cookie */
export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .setIssuedAt()
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  return token;
}

/** Read and verify the session from the request cookie */
export async function getSession(
  request?: NextRequest
): Promise<SessionPayload | null> {
  try {
    let token: string | undefined;

    if (request) {
      token = request.cookies.get(SESSION_COOKIE)?.value;
    } else {
      const cookieStore = await cookies();
      token = cookieStore.get(SESSION_COOKIE)?.value;
    }

    if (!token) return null;

    const { payload } = await jwtVerify(token, getSecret());
    return {
      userId: payload.userId as number,
      username: payload.username as string,
      isAdmin: payload.isAdmin as boolean,
    };
  } catch {
    return null;
  }
}

/** Get session or throw 401 — use in API routes */
export async function requireAuth(request: NextRequest): Promise<SessionPayload> {
  const session = await getSession(request);
  if (!session) {
    throw new AuthError("Not authenticated");
  }

  // Cross-reference DB to ensure the user still physically exists (prevents SQL 500s)
  const existingUser = db.select({ id: users.id }).from(users).where(eq(users.id, session.userId)).get();
  if (!existingUser) {
    await clearSession();
    throw new AuthError("Session invalid: User no longer exists");
  }

  return session;
}

/** Verify admin secret header for admin-only endpoints */
export function requireAdmin(request: NextRequest): void {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    throw new AuthError("ADMIN_SECRET not configured");
  }
  const provided = request.headers.get("authorization")?.replace("Bearer ", "");
  if (provided !== adminSecret) {
    throw new AuthError("Invalid admin secret");
  }
}

/** Clear the session cookie */
export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
