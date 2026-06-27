# Kimchi — Agent Guide

**Product:** Kimchi (by Second Ladder)  
**Repo:** [github.com/sanaungofficial/searchly](https://github.com/sanaungofficial/searchly)  
**Public name:** Kimchi · **Repo name:** searchly

---

## Goal

Keep environments and branches separated so work does not collide or break production. When in doubt: **feat branch → dev → test → main (only with San's approval).**

---

## Stack

- Next.js App Router (`src/app/`)
- Supabase Auth + Storage
- Prisma ORM → Postgres
- Vercel deploys

---

## Environments

| Branch | URL | Purpose |
|--------|-----|---------|
| `main` | `https://app.kimchi.so` | Production |
| `dev` | `https://kimchi-git-dev-second-ladder.vercel.app` | Staging — **test all non-AI work here** |
| `feat/*` | *(no deploy)* | Isolated agent work — GitHub only until PR merges to `dev` |

**Important:** The full workspace shell (sidebar, Live, notifications) is what you verify on **dev**. Production may serve a different UI — do not assume prod matches dev for workspace components.

### Env vars (typical)

| Variable | Dev / staging | Production |
|----------|---------------|------------|
| `NEXT_PUBLIC_SHOW_BETA` | `true` | `false` |
| `NEXT_PUBLIC_VERCEL_ENV` | `preview` | `production` |
| `ANTHROPIC_API_KEY` | usually unset | set |
| `HIREBASE_API_KEY` | set on preview — resume parse + company profiles/job scans | set for resume parse + company index |
| `NEXT_PUBLIC_APP_URL` | dev URL | `https://app.kimchi.so` |

### Passcode (production only)

Code gates **only when `VERCEL_ENV=production`** (i.e. `app.kimchi.so`).

- **Dev staging:** no passcode — go straight to the app
- **Production:** visit `/passcode`, enter `3992` (POSTs to `/api/passcode`)

There is no `GET /api/passcode?code=…` handler.

---

## Branch rules (do not break these)

1. **Never push to `dev` or `main`** unless San explicitly says "go ahead" for that specific push.
2. **Always branch from `dev`:** `feat/<short-description>` (e.g. `feat/resume-upload-fix`).
3. **One feature per branch** — avoids agents stepping on each other's commits.
4. **Do not merge or rebase `main` into your feat branch** unless San asks — stay based on `dev`.
5. After a production release, **`dev` and `main` should be synced** so they do not drift.

### Flow (every feature)

```
dev  →  checkout feat/my-thing  →  work  →  push feat/my-thing
     →  PR feat/my-thing → dev  →  San approves  →  squash-merge to dev
     →  Vercel builds dev  →  browser-test on dev URL
     →  San approves  →  merge dev → main (production)
```

**`feat/*` branches do not deploy.** Only `dev` and `main` get Vercel environments.

---

## Git

If local git is broken (e.g. Google Drive conflict on an old clone), use the GitHub API / `gh` to commit to a **feat branch**. Always specify the branch explicitly.

Working clone in Cursor: `/Users/san/searchly` (git has worked here).

---

## AI / API features

Dev staging **has no AI API key**. For routes that call Claude (resume parse, readback, job match, cover letter, etc.):

- On **dev:** verify UI only (form, loader, error states)
- Tell San explicitly: *"AI calls cannot be verified on dev — needs production or manual test"*
- **Never claim an AI feature is fully done** based on dev alone

All code still merges via `feat → dev → main`. AI verification happens on prod (or San tests manually).

---

## Definition of done

Before telling San a feature is done:

- [ ] Changes are on a `feat/*` branch (or merged to `dev` via PR)
- [ ] Vercel dev deployment is green (project `prj_h6r7lyPJvkeNp1IGc7Omp1wnTE3l`, team `team_IkNsspVs2tQqGkubaiHOM6zJ`)
- [ ] **Browser-tested on dev URL** when possible — do not report "done" from code review alone
- [ ] If AI-powered: UI checked on dev + prod verification called out
- [ ] **`dev` / `main` not pushed** without San's explicit approval

If squash-merge to `dev` did not trigger Vercel, ask San before force-pushing a no-op rebuild to `dev`.

---

## Route map

```
src/app/
  (workspace)/           ← layout scoping only (no URL segment)
    layout.tsx           ← SACRED: sidebar + shell. Do not edit without approval.
    dashboard/
    opportunities/
    profile/
    admin/
    clients/
    coaching/
    live/
    network/
  login/                 ← not under (auth)/
  signup/
  onboarding/            ← outside workspace layout
  auth/callback/
  passcode/
  api/
```

---

## Sacred / high-risk files

| File | Why |
|------|-----|
| `src/app/(workspace)/layout.tsx` | Workspace shell — breaks all pages |
| `src/middleware.ts` | Auth + passcode routing |
| `prisma/schema.prisma` | DB schema — coordinate before changing |

---

## Key files

- `src/components/scout/workspace-sidebar.tsx` — nav, Live dot, notifications
- `src/components/scout/workspace-data.ts` — static `LIVE_SESSIONS`, `NOTIFICATIONS`
- `src/components/scout/screens.tsx` — onboarding screens
- `src/components/scout/workspace-profile.tsx` — profile / About / Assets
- `src/lib/auth.ts` — `requireAdmin()`, `isAdmin()`
- `src/app/auth/callback/route.ts` — post-login routing (new → onboarding, returning → dashboard)

---

## Prisma models

`User`, `Profile`, `UserAsset`, `Job`, `TailoredResume`, `CoachProfile`, `TrackedCompany`, `Subscription`, `AiUsageLog`, `MonthlyUsage`, `PromptConfig`

---

## Auth routing (current behavior)

| User | After login |
|------|-------------|
| New (first DB row) | `/onboarding` → `/profile` when finished |
| Returning | `/dashboard` |

---

## Supabase

- Add **both** prod and dev URLs to Auth → Redirect URLs (`/auth/callback`)
- Dev and prod often share one database — accounts and uploads appear in both

---

## Cursor Cloud specific instructions

Single Next.js app. Required services for local dev: **Postgres** (Prisma) and **Supabase** (auth/storage). All other integrations (Anthropic, Hirebase, Stripe, Nylas, Resend, Plivo, 100ms, Airtable, …) are optional and feature-gated by env checks.

**Startup (the update script already ran `npm install` + `npx prisma generate`):**
- Start the local Postgres that the setup provisioned: `sudo pg_ctlcluster 16 main start` (needed once per VM boot; the dev DB role/name are `kimchi`/`kimchi`).
- Run the dev server with `npm run dev` (serves `http://localhost:3000`). Use `npm`, not `bun` — `bun` is not installed here and `dev` is plain `next dev`. The `build`/`start` scripts use `bun` but are production-only.

**Env vars (`.env.local`, gitignored, created during setup):** points Prisma at the local Postgres and sets placeholder Supabase values so the app boots. Real hosted values injected as Cursor Secrets / shell env vars override `.env.local` (Next.js does not override already-set `process.env`). To run **real auth** (login → onboarding → dashboard) and storage, set real `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (and typically the shared `POSTGRES_PRISMA_URL` / `POSTGRES_URL_NON_POOLING`). With placeholder Supabase, public pages (`/login`, `/signup`, `/pricing`) render but sign-in cannot complete.

**Prisma gotchas:**
- The datasource uses `POSTGRES_PRISMA_URL` + `POSTGRES_URL_NON_POOLING` (not `DATABASE_URL`).
- The Prisma CLI only auto-loads `.env` (not `.env.local`), and the committed `.env` has a stale SQLite `DATABASE_URL`. So for `prisma db push` / `migrate`, export the two `POSTGRES_*` vars inline first, e.g.:
  `export POSTGRES_PRISMA_URL=postgresql://kimchi:kimchi@127.0.0.1:5432/kimchi`; `export POSTGRES_URL_NON_POOLING=$POSTGRES_PRISMA_URL`; `npx prisma db push`.
- After installing/changing deps, re-run `npx prisma generate` if the client seems stale.

**Lint:** `npm run lint` works but the codebase currently has many pre-existing ESLint errors; a non-zero exit is expected and is not an environment problem (`next.config.ts` sets `typescript.ignoreBuildErrors: true`).
