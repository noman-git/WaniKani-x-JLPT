# JLPT Study Dashboard

Self-hosted study dashboard for JLPT N4 & N5 — kanji, vocab, radicals, and grammar — with a WaniKani-style SRS on top of pre-baked WaniKani reference data (meanings, readings, mnemonics, radicals). No WaniKani account or API token required.

Multi-user, invite-code registration, runs on SQLite. Deployed via Docker / Coolify on a VPS.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, standalone output) |
| Database | SQLite (`better-sqlite3`) with WAL |
| ORM | Drizzle |
| Auth | `bcryptjs` + JWT (`jose`) in HTTP-only cookies |
| Hosting | Docker container behind Coolify on a VPS |

## What's in the seed DB

`data/jlpt-seed.db` ships pre-baked. Live counts:

- **2,659** `jlpt_items` — kanji + vocab + radicals, levels N5 / N4 / other
- **9,746** `wanikani_subjects` rows — WaniKani meanings, readings, mnemonics, context sentences, parts of speech
- **503** `wanikani_radicals`
- **278** `grammar_points` + **5,804** grammar↔item links

"Other"-level rows are WK-only context items not in the canonical N5/N4 lists; they show up in the browsing UI but aren't surfaced in the dashboard mastery rollup.

## Features

- Browse kanji / vocab / radicals with status, level, WK-coverage filters
- Detail modal with WK mnemonics, components, related vocab, linked grammar
- Grammar points with cloze quizzes (Japanese fill-in-the-blank)
- WaniKani-style SRS: 9 stages, ease-factor adjustments, separate review timing per item
- Per-user notes on every item and every grammar point
- Dashboard with N5/N4 mastery breakdown (Apprentice → Burned)
- "Mark as known" deep-skip for items the user already knows cold

## Local setup

```bash
npm install
cp .env.example .env  # then edit SESSION_SECRET + ADMIN_SECRET
npm run dev
```

First boot copies `data/jlpt-seed.db` → `data/jlpt.db`. The seed is never touched at runtime.

`.env`:

| Var | Purpose |
|---|---|
| `SESSION_SECRET` | Signs JWT session cookies. Min 16 chars. |
| `ADMIN_SECRET` | Bearer token for admin endpoints. |

## Creating users

There is no open registration — generate an invite code, then register against it.

```bash
# Generate one invite code
curl -X POST http://localhost:3000/api/admin/invite-codes \
  -H "Authorization: Bearer $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"count": 1}'
# → { "codes": ["a1b2c3d4"] }
```

Then open `/`, switch the login form to Register, paste the code.

## Admin API

All require `Authorization: Bearer $ADMIN_SECRET`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/admin/invite-codes` | List codes + who used each |
| `POST` | `/api/admin/invite-codes` | Generate 1–20 codes (`{"count": N}`) |
| `GET` | `/api/admin/users` | List users + progress row counts |
| `POST` | `/api/admin/reset-password` | `{ "userId": N, "newPassword": "…" }` |

## Re-baking the seed

When the underlying reference data changes (new WK mnemonics, grammar fixes, dedup runs):

```bash
# 1. Make sure data/jlpt.db has the data you want to ship
# 2. Strip user data + vacuum into jlpt-seed.db
npx tsx scripts/export-seed.ts
# 3. Commit the new seed
git add data/jlpt-seed.db && git commit -m "Reseed"
```

`scripts/export-seed.ts` copies `jlpt.db` → `jlpt-seed.db`, deletes rows from `users`, `invite_codes`, `user_progress`, `user_notes`, `grammar_progress`, `grammar_notes`, `kanji_cache`, then `VACUUM`s.

## Deployment (Coolify on VPS)

The repo ships a multi-stage `Dockerfile` that:
- builds the Next.js standalone bundle
- copies `data/jlpt-seed.db` into `/app/seed/` inside the image
- expects a writable volume mounted at `/app/data/` for the live `jlpt.db`

In Coolify:

1. Point the app at this repo, set the build pack to **Dockerfile**.
2. Add a persistent volume mounted at `/app/data` (any size — DB is ~14 MB).
3. Set environment variables `SESSION_SECRET` and `ADMIN_SECRET`.
4. Expose port `3000`.
5. Deploy.

On first boot the container copies the baked-in seed to `/app/data/jlpt.db`. On subsequent deploys the volume persists, so user data survives image rebuilds. Re-running the seed via `export-seed.ts` and redeploying does **not** overwrite live user data — the copy-on-init check is "only if jlpt.db is missing."

## Project layout

```
data/
  jlpt-seed.db            # Pre-baked reference data (committed)
  grammar-seed.json       # Auto-loaded into grammar_points on first boot
drizzle/                  # Generated migrations
scripts/
  build-seed.ts           # Build jlpt-seed.db from raw sources
  export-seed.ts          # Strip users + vacuum jlpt.db → jlpt-seed.db
  dedup-items.ts          # Collapse duplicate (expression, type) rows
  …                       # Various enrichment / import scripts
src/
  app/
    api/                  # Route handlers (auth, items, srs, grammar, admin)
    components/           # Modals, quiz, item browser, lesson card stack
    {kanji,vocab,radicals,grammar,learn,review,…}/page.tsx
  lib/
    auth.ts               # JWT + cookie session
    srs/algorithm.ts      # SRS interval/ease math
    db/{index,schema}.ts  # Drizzle schema + connection
Dockerfile
```

## Data sources

- **JLPT vocab/kanji lists**: [open-anki-jlpt-decks](https://github.com/jamsinclair/open-anki-jlpt-decks) + [jlptsensei.com](https://jlptsensei.com) for kanji ground truth
- **WaniKani reference data**: scraped from the public WaniKani API v2
- **Grammar points**: jlptsensei.com (scraped, see `scripts/scrape-jlptsensei.py`) with AI enrichment for cloze examples

## Known data caveats

A code+data review surfaced these — none break the app, all are worth knowing:

- ~200 single-character JLPT vocab items duplicate an existing JLPT kanji item (same char stored as `type='kanji'` and `type='vocab'`, sometimes at different JLPT levels). Lookup queries that pull "items containing X" can render both side-by-side.
- 88 byte-for-byte duplicate rows in `wanikani_subjects` (seed-import artifact).
- `wanikani_subjects.object_type` has 4 values where the code expects 3 (`vocab` for pseudo entries vs `vocabulary` for real WK).
- `jlpt_items.sources` is declared as JSON but ~65% of rows store a plain comma-separated string. `dedup-items.ts` handles both forms.
- The dashboard mastery rollup only buckets N5 + N4. ~936 `other`-level items are included in lesson/review counts but invisible in the mastery breakdown.
