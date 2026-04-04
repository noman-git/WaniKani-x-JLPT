# ⛩️ JLPT Study Dashboard

Track your JLPT N4 & N5 kanji and vocabulary progress. Ships with pre-baked WaniKani reference data (meanings, readings, mnemonics, radicals) — no WaniKani account needed.

Multi-user with invite-code registration. Runs on SQLite. Deploys to Fly.io.

![Dashboard](https://img.shields.io/badge/Next.js-16-black) ![SQLite](https://img.shields.io/badge/SQLite-WAL-blue) ![Auth](https://img.shields.io/badge/Auth-JWT-green)

---

## Features

- **1,767 JLPT items** — N4/N5 kanji and vocabulary from community-curated lists
- **WaniKani integration** — meanings, readings, mnemonics, radicals, and cross-references
- **Progress tracking** — mark items as Known / Learning / Unknown
- **Multi-user** — each user has isolated progress data
- **Invite codes** — admin generates one-time registration codes
- **No external services** — everything runs on SQLite with a single persistent volume

---

## Quick Start

### Prerequisites
- Node.js 20+
- npm

### 1. Clone & install

```bash
git clone <your-repo-url>
cd jlpt-dashboard
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
SESSION_SECRET=pick-a-random-string-at-least-16-chars
ADMIN_SECRET=your-admin-password
```

| Variable | Purpose | Required |
|---|---|---|
| `SESSION_SECRET` | Signs JWT session cookies (min 16 chars) | Yes |
| `ADMIN_SECRET` | Protects admin API endpoints | Yes |

### 3. Run

```bash
npm run dev
```

On first run, the app copies `data/jlpt-seed.db` → `data/jlpt.db`. This seed contains all 1,767 JLPT items and 9,396 WaniKani subjects. No sync or API token needed.

### 4. Create your first user

Generate an invite code, then register:

```bash
# Generate an invite code
curl -X POST http://localhost:3000/api/admin/invite-codes \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"count": 1}'

# Response: { "codes": ["a1b2c3d4"] }
```

Open `http://localhost:3000`, switch to "Register", enter the invite code + your details.

---

## Admin API

All admin endpoints require the header:
```
Authorization: Bearer YOUR_ADMIN_SECRET
```

### Generate Invite Codes

```bash
# Generate 5 one-time invite codes
curl -X POST http://localhost:3000/api/admin/invite-codes \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"count": 5}'
```

Response:
```json
{
  "success": true,
  "codes": ["a1b2c3d4", "e5f6g7h8", ...],
  "message": "Generated 5 invite code(s)"
}
```

### List Invite Codes

```bash
curl http://localhost:3000/api/admin/invite-codes \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET"
```

Response shows each code's status (unused / used by whom).

### List Users

```bash
curl http://localhost:3000/api/admin/users \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET"
```

Response:
```json
{
  "users": [
    {
      "id": 1,
      "username": "noman",
      "display_name": "Noman",
      "is_admin": 0,
      "created_at": "2026-04-04T15:47:55Z",
      "progress_count": 42
    }
  ]
}
```

### Reset a User's Password

```bash
curl -X POST http://localhost:3000/api/admin/reset-password \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"userId": 1, "newPassword": "new-password-here"}'
```

---

## Seed Database

The app ships with `data/jlpt-seed.db` — a pre-built SQLite database containing all reference data (JLPT items, WaniKani subjects, radicals) but no user data.

### How it works

1. On first boot, if `data/jlpt.db` doesn't exist, the app copies `jlpt-seed.db` → `jlpt.db`
2. Users register, log in, and their progress is stored in `jlpt.db`
3. The seed is never modified at runtime

### Re-baking the seed

If you need to update the WaniKani data (new items, updated mnemonics, etc.):

```bash
# 1. Make sure your local jlpt.db has the latest data
#    (run the app, do whatever sync/import you need)

# 2. Export a clean seed (strips users, progress, cache)
npx tsx scripts/export-seed.ts

# 3. Verify
#    Output will show: Items: 1767, Subjects: 9396, Radicals: 503

# 4. Commit the updated seed
git add data/jlpt-seed.db
git commit -m "Update seed data"

# 5. Redeploy
fly deploy
```

The export script (`scripts/export-seed.ts`):
- Copies your live `jlpt.db` → `jlpt-seed.db`
- Deletes all rows from: `users`, `invite_codes`, `user_progress`, `kanji_cache`
- Runs `VACUUM` to compact the file
- Result: a clean ~9MB database ready to ship

---

## Deployment (Fly.io)

### First-time setup

```bash
# 1. Install Fly CLI
curl -L https://fly.io/install.sh | sh

# 2. Sign up / log in
fly auth login

# 3. Launch the app (detects Dockerfile + fly.toml)
fly launch

# 4. Create a persistent volume for the SQLite database
fly volumes create jlpt_data --size 1 --region sin

# 5. Set secrets
fly secrets set \
  SESSION_SECRET="$(openssl rand -hex 16)" \
  ADMIN_SECRET="your-admin-password"

# 6. Deploy
fly deploy
```

### Subsequent deploys

```bash
fly deploy
```

### Architecture

```
┌─────────────────────────────┐
│  Fly.io Machine             │
│  ┌───────────────────────┐  │
│  │  Next.js (standalone) │  │
│  │  Port 3000            │  │
│  └───────┬───────────────┘  │
│          │ reads/writes     │
│  ┌───────▼───────────────┐  │
│  │  /app/data/jlpt.db    │  │  ← Persistent Volume
│  │  (SQLite + WAL)       │  │
│  └───────────────────────┘  │
└─────────────────────────────┘
```

- **Volume**: `jlpt_data` mounted at `/app/data/` — survives redeploys
- **Seed**: On first boot (empty volume), the app copies the baked-in seed DB
- **Region**: `sin` (Singapore) — change in `fly.toml` if needed

---

## Project Structure

```
├── data/
│   └── jlpt-seed.db           # Pre-baked reference data (committed)
├── scripts/
│   └── export-seed.ts          # Re-bake seed from live DB
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── admin/          # Invite codes, users, password reset
│   │   │   ├── auth/           # Login, register, logout, session
│   │   │   ├── items/          # JLPT items list + detail
│   │   │   ├── kanji-lookup/   # Kanji decomposition
│   │   │   ├── progress/       # Mark items known/learning
│   │   │   └── radicals/       # Radical detail
│   │   ├── components/
│   │   │   ├── AuthProvider.tsx     # Client-side auth context
│   │   │   ├── ClientLayout.tsx     # Auth gate + nav
│   │   │   └── ItemDetailModal.tsx  # Item detail with WK data
│   │   ├── items/page.tsx      # Browse items grid
│   │   ├── login/page.tsx      # Login / register
│   │   ├── settings/page.tsx   # User info + about
│   │   ├── page.tsx            # Dashboard with progress stats
│   │   ├── layout.tsx          # Root layout
│   │   └── globals.css         # All styles
│   └── lib/
│       ├── auth.ts             # JWT session management
│       └── db/
│           ├── index.ts        # DB init + seed copy
│           └── schema.ts       # Drizzle schema
├── Dockerfile                  # Multi-stage build
├── fly.toml                    # Fly.io config
└── .env.example                # Environment template
```

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 (App Router, standalone output) |
| Database | SQLite via `better-sqlite3` |
| ORM | Drizzle |
| Auth | `bcryptjs` (password hashing) + `jose` (JWT) |
| Hosting | Fly.io (free tier) |

---

## Data Sources

- **JLPT Items**: [open-anki-jlpt-decks](https://github.com/jamsinclair/open-anki-jlpt-decks) — Tanos-based N4/N5 lists
- **WaniKani Data**: [WaniKani API v2](https://docs.api.wanikani.com/) — meanings, readings, mnemonics, radicals
