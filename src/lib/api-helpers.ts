import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireAdmin, requireAuth, SessionPayload } from "@/lib/auth";
import { getNote, setNote, upsertProgressStatus } from "@/lib/db/queries/user-state";

export const STATUSES = ["known", "learning", "unknown"] as const;
export type Status = (typeof STATUSES)[number];

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

type NotesConfig = {
  paramName: string;
  table: "user_notes" | "grammar_notes";
  fkColumn: "jlpt_item_id" | "grammar_point_id";
};

/**
 * Build the GET/POST handlers for a personal-notes endpoint. /api/notes
 * (jlpt items) and /api/grammar/notes (grammar points) differ only in the
 * query/body param name and the backing table/column.
 */
export function makeNotesRoute(cfg: NotesConfig) {
  const GET = withAuth(async (request, session) => {
    const { searchParams } = new URL(request.url);
    const fkId = parseInt(searchParams.get(cfg.paramName) || "", 10);
    if (Number.isNaN(fkId)) {
      return NextResponse.json({ error: `Invalid ${cfg.paramName}` }, { status: 400 });
    }
    try {
      const content = getNote({
        table: cfg.table,
        fkColumn: cfg.fkColumn,
        userId: session.userId,
        fkId,
      });
      return NextResponse.json({ content });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });

  const POST = withAuth(async (request, session) => {
    try {
      const body = (await request.json()) as Record<string, unknown>;
      const fkId = body[cfg.paramName];
      const content = body.content;
      if (typeof fkId !== "number" || typeof content !== "string") {
        return NextResponse.json(
          { error: `Invalid ${cfg.paramName} or content` },
          { status: 400 },
        );
      }
      setNote({
        table: cfg.table,
        fkColumn: cfg.fkColumn,
        userId: session.userId,
        fkId,
        content,
      });
      return NextResponse.json({ success: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });

  return { GET, POST };
}

type ProgressConfig = {
  paramName: string;
  table: "user_progress" | "grammar_progress";
  fkColumn: "jlpt_item_id" | "grammar_point_id";
  verifyId: (id: number) => boolean;
  notFoundLabel: string;
};

/**
 * Build the POST handler for a progress-status endpoint. /api/progress and
 * /api/grammar/progress share the same upsert shape; this also normalizes
 * the legacy "not-started" alias (sent by the grammar UI) to "unknown".
 */
export function makeProgressRoute(cfg: ProgressConfig) {
  const POST = withAuth(async (request, session) => {
    try {
      const body = (await request.json()) as Record<string, unknown>;
      const fkId = body[cfg.paramName];
      const rawStatus = body.status === "not-started" ? "unknown" : body.status;
      if (
        typeof fkId !== "number" ||
        typeof rawStatus !== "string" ||
        !STATUSES.includes(rawStatus as Status)
      ) {
        return NextResponse.json(
          { error: `Invalid ${cfg.paramName} or status` },
          { status: 400 },
        );
      }
      const status = rawStatus as Status;

      if (!cfg.verifyId(fkId)) {
        return NextResponse.json(
          { error: `${cfg.notFoundLabel} not found` },
          { status: 404 },
        );
      }

      upsertProgressStatus({
        table: cfg.table,
        fkColumn: cfg.fkColumn,
        userId: session.userId,
        fkId,
        status,
      });

      return NextResponse.json({ success: true, [cfg.paramName]: fkId, status });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  });

  return { POST };
}
