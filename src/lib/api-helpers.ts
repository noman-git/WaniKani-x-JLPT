import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireAdmin, requireAuth, SessionPayload } from "@/lib/auth";

/**
 * Parse an integer query param, clamping to [min, max] and falling back to
 * `fallback` on NaN. Defends against `page=abc` or `limit=999999999`.
 */
export function parseIntSafe(
  raw: string | null | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (raw == null || raw === "") return fallback;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

export const PAGE_MAX = 10_000;
export const LIMIT_MAX = 100;

type RouteContext<T = unknown> = { params: Promise<T> };

/**
 * Wrap a route handler that needs an authenticated session. The wrapper
 * calls requireAuth, maps AuthError → 401, and passes the session through to
 * the handler. Any other thrown error bubbles up to Next.js default handling.
 */
export function withAuth<T = unknown>(
  handler: (
    request: NextRequest,
    session: SessionPayload,
    context?: RouteContext<T>,
  ) => Promise<NextResponse>,
) {
  return async (request: NextRequest, context?: RouteContext<T>) => {
    try {
      const session = await requireAuth(request);
      return await handler(request, session, context);
    } catch (e) {
      if (e instanceof AuthError) {
        return NextResponse.json({ error: e.message }, { status: 401 });
      }
      throw e;
    }
  };
}

/**
 * Same shape as withAuth but for routes gated by the ADMIN_SECRET bearer
 * token. Maps AuthError → 403.
 */
export function withAdmin<T = unknown>(
  handler: (
    request: NextRequest,
    context?: RouteContext<T>,
  ) => Promise<NextResponse>,
) {
  return async (request: NextRequest, context?: RouteContext<T>) => {
    try {
      requireAdmin(request);
      return await handler(request, context);
    } catch (e) {
      if (e instanceof AuthError) {
        return NextResponse.json({ error: e.message }, { status: 403 });
      }
      throw e;
    }
  };
}
