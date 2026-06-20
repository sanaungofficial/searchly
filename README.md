# Searchly

> Searchly reads your resume, understands your story, and prepares every application — an AI-powered job search workspace by Second Ladder.

Built with **Next.js 16 · TypeScript · Tailwind CSS v4 · shadcn/ui**.

---

## What's inside

Searchly is a two-part product:

### 1. Onboarding flow (5 screens)
A guided, editorial onboarding experience that collects the user's resume, LinkedIn, and target roles:
1. **Welcome** — drag-and-drop resume upload
2. **LinkedIn** — input + "analyzing your background…" state
3. **The Read-Back** — AI-generated profile card with strengths, target roles, and one honest note
4. **Target Jobs** — paste 1–3 job URLs
5. **Transition** — preview of the workspace + "Get Interviews →" CTA

### 2. Workspace (5 sections)
- **Opportunities** — Discover (pipeline snapshot, market signals, companies radar, live previews) + Pipeline (flat list of all jobs with stage filter chips, Add Job URL paste, Upload CSV bulk add)
- **Profile** — Dream Role (readiness %, gap analysis), Experience, Skills, Learning Path (progress ring), Resume Assets
- **Live** — Featured weekly session + filterable sessions grid
- **Coaching** — My Coach + searchable coach directory
- **Network** — Hive Mind referrals + filterable contacts grid

### Key features
- **Job drawer** with AI Tools: Update resume, Create cover letter, Tell me why I'm a good fit
- **Floating ChatWidget** (✦ bottom-right) on every workspace page — context-aware, opens the drawer with the selected tool from any section
- **CSV bulk upload** for jobs (`url,company,role` format)
- **Notifications** popover with cross-section navigation
- **Editorial design system**: Cormorant Garamond italic headings, DM Sans body, DM Mono stats, Playfair Display logo — forest green + gold + cream palette

---

## Quick start

### Prerequisites
- [Node.js](https://nodejs.org/) 18+ or [Bun](https://bun.sh/) (recommended)
- Git

### Install & run locally

```bash
# Clone your repo (after you've pushed it)
git clone https://github.com/YOUR_USERNAME/searchly.git
cd searchly

# Install dependencies
bun install   # or: npm install

# Start the dev server
bun run dev   # or: npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Click "Searchly" in the header to jump straight to the workspace
The onboarding "Get Interviews →" button on the last screen also enters the workspace. The "← Onboarding" link in the sidebar returns to onboarding.

---

## Deploy

### Option A: Vercel (recommended — 2 minutes)

1. Push this repo to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit — Searchly"
   gh repo create searchly --public --source=. --push
   # or create the repo on github.com and push manually
   ```

2. Go to [vercel.com/new](https://vercel.com/new) and import the repo.

3. Vercel auto-detects Next.js — just click **Deploy**.

4. Your app is live at `https://searchly.vercel.app` (or your custom domain).

No environment variables are required — all data is currently mock/static.

### Option B: Self-hosted (Docker / VPS)

```bash
bun run build
bun run start
```

The app runs on port 3000 by default. Put it behind nginx/Caddy for production.

---

## Project structure

```
searchly/
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout — Google Fonts (Playfair, Cormorant, DM Sans, DM Mono)
│   │   ├── page.tsx            # Toggles between onboarding + workspace views
│   │   └── globals.css         # Searchly theme tokens + keyframe animations
│   └── components/
│       └── scout/              # All Searchly components
│           ├── screens.tsx              # 5 onboarding screens + header + demo button
│           ├── workspace.tsx            # Top-level workspace orchestrator
│           ├── workspace-sidebar.tsx    # Forest-green sidebar + notifications popover
│           ├── workspace-data.ts        # All static data (jobs, companies, coaches, etc.)
│           ├── workspace-icons.tsx      # Inline SVG icons (nav + actions)
│           ├── workspace-opportunities.tsx  # Discover + Pipeline tabs, Add Job, CSV upload, JobDrawer
│           ├── workspace-profile.tsx    # Dream Role + Experience + Skills + Learning + Assets
│           ├── workspace-coaching.tsx   # My Coach + Find a Coach
│           ├── workspace-network.tsx    # Hive Mind + contacts grid
│           ├── workspace-live.tsx       # Live sessions
│           └── chat-widget.tsx          # Floating ✦ button + popup (AI Tools)
├── public/                     # Static assets
├── prisma/                     # Prisma schema (SQLite — unused, ready for persistence)
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
└── eslint.config.mjs
```

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 + inline styles for editorial precision |
| UI library | shadcn/ui (New York) + Lucide icons |
| State | React `useState` / `useReducer` (no external store needed yet) |
| Database | Prisma ORM (SQLite — schema ready, not yet wired) |
| Fonts | Google Fonts via `next/font` |
| Package manager | Bun (also works with npm/pnpm/yarn) |

---

## Available scripts

```bash
bun run dev        # Start dev server on port 3000
bun run build      # Production build
bun run start      # Start production server
bun run lint       # ESLint
bun run db:push    # Push Prisma schema to SQLite (when you wire persistence)
```

---

## Roadmap (suggested next steps)

- [ ] Wire Add Job + AI Tools to real `z-ai-web-dev-sdk` calls on the server side (currently mock data)
- [ ] Persist Kanban cards + learning progress to Prisma (schema is ready)
- [ ] Add NextAuth.js authentication
- [ ] Build the company-detail view (clicking a radar card opens a drawer)
- [ ] Real-time notifications via WebSocket
- [ ] Mobile-responsive polish for the workspace (currently desktop-first)

---

## License

MIT — see [LICENSE](LICENSE) (add one if you want; otherwise default copyright applies).

---

Built with care by the Second Ladder team.
