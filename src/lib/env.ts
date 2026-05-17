// Server-side env validation. Imported eagerly at startup (from db/index.ts)
// so a misconfigured deploy fails on boot instead of on the first auth request.
//
// Skipped during `next build` — the build container does not have the runtime
// secrets, and Next.js still imports server modules to collect route info.

const SKIP = process.env.NEXT_PHASE === "phase-production-build";

function require(name: string, minLength = 0): string {
  const value = process.env[name];
  if (!value || value.length < minLength) {
    throw new Error(
      minLength > 0
        ? `${name} env var must be set (min ${minLength} chars)`
        : `${name} env var must be set`
    );
  }
  return value;
}

function validate() {
  if (SKIP) return;
  require("SESSION_SECRET", 16);
  require("ADMIN_SECRET");
}

validate();

export function getSessionSecret(): Uint8Array {
  return new TextEncoder().encode(require("SESSION_SECRET", 16));
}

export function getAdminSecret(): string {
  return require("ADMIN_SECRET");
}
