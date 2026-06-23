# Kimchi Browser Extension (v0.1)

Chrome MV3 extension that saves jobs to the Kimchi pipeline from ATS pages and generic career sites.

## Build tooling choice: **Vite** (not Plasmo)

| Option | Why not / why yes |
|--------|-------------------|
| **Vite** ✓ | Minimal, full control, vanilla TS popup (no React), multi-entry build for background/content/popup, easy to debug |
| Plasmo | Opinionated framework, React-first defaults, heavier abstraction for a small v0.1 |

## Permissions (minimal)

| Permission | Why |
|------------|-----|
| `storage` | Dev/prod toggle, auth cache |
| `activeTab` | Save generic career pages on user click (temporary tab access) |
| `cookies` | Read Kimchi Supabase session cookies **only** for Kimchi host URLs |
| `scripting` | Inject parser on generic pages via popup |

**Host permissions** (not `*://*/*`):

- Kimchi: `app.kimchi.so`, dev staging URL
- ATS: Greenhouse, Lever, Ashby, LinkedIn Jobs

## Auth strategy (v0.1)

1. Popup → **Sign in to Kimchi** opens `{baseUrl}/login` in a new tab
2. User completes Supabase magic link / Google / LinkedIn on the web app (unchanged)
3. Extension reads session cookies via `chrome.cookies.getAll({ url: kimchiBaseUrl })`
4. Background attaches `Cookie` header to `GET/POST /api/jobs`
5. `GET /api/jobs` (200) = authenticated; 401 = not signed in

**No changes to web login flow.** Extension never intercepts OAuth redirects.

### Backend dependencies (coordinate with backend agent)

These are **not required for v0.1** if `host_permissions` + manual `Cookie` header work (Chrome extensions bypass CORS for permitted hosts):

| Route | Status | Notes |
|-------|--------|-------|
| `POST /api/jobs` | ✅ Exists | `{ company, role, url?, stage?, notes? }` |
| `GET /api/jobs` | ✅ Exists | Used as auth probe + future dedupe |
| `GET /api/auth/extension-session` | 🔲 Optional | Cleaner auth check than jobs list |
| CORS for `chrome-extension://` | 🔲 Optional | May live on `feat/backend-extension-api` |

**Notes JSON** (no new DB field):

```json
{ "source": "extension", "parser": "greenhouse", "capturedAt": "2026-06-23T..." }
```

Future: dedicated `source` / `extensionCapture` column — document with backend agent before adding.

## Parser strategy

Priority order on each page:

1. ATS-specific DOM (Greenhouse, Lever, Ashby, LinkedIn Jobs)
2. JSON-LD `JobPosting`
3. Open Graph (`og:title`, `og:site_name`)
4. `<title>` heuristics (`Role at Company | …`)
5. URL slug fallback

**Stage rules:**

- `APPLIED` — confirmation/thank-you URLs or DOM
- `APPLYING` — `/apply` paths
- `SAVED` — listing pages (default)

Parser id logged to console as `[Kimchi] { parser, result, url }`.

## Development

```bash
cd extension
npm install
npm run build          # one-off build → dist/
npm run dev            # watch mode
python3 scripts/generate-icons.py   # first time (needs Pillow)
```

### Load unpacked in Chrome

1. Build: `npm run build`
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. **Load unpacked** → select `extension/dist/`
5. Pin the Kimchi icon

### Manual test checklist (dev Kimchi)

Use **Dev staging** in popup settings: `https://kimchi-git-dev-second-ladder.vercel.app`

- [ ] Extension loads without service worker errors
- [ ] Sign in opens Kimchi login tab; after login, popup shows "Signed in"
- [ ] **Greenhouse** listing: floating button appears, console shows `[Kimchi] greenhouse` parse
- [ ] **Lever** listing: same
- [ ] Save creates job visible at `/opportunities/pipeline`
- [ ] **Generic**: open any careers page with JSON-LD JobPosting → popup **Save current page**
- [ ] Error state: signed out → save shows auth error
- [ ] Dev/prod toggle switches API base URL

### Test URLs

| Site | Example pattern |
|------|-----------------|
| Greenhouse | `boards.greenhouse.io/*/jobs/*` |
| Lever | `jobs.lever.co/*/*` |
| LinkedIn | `linkedin.com/jobs/view/*` |
| Generic | Any page with JSON-LD `JobPosting` |

## Project layout

```
extension/
  manifest.json
  package.json
  vite.config.ts
  src/
    background/     # service worker — auth cookies, API calls
    content/        # floating button, toast, page parse trigger
    popup/          # login, env toggle, save current page
    parsers/        # greenhouse, lever, ashby, linkedin-jobs, generic
    lib/            # config, auth, api, storage, types
  public/icons/
  scripts/generate-icons.py
```

## PR checklist

- [ ] `extension/dist/` built locally (dist not committed — build in CI or document load-unpacked from source build)
- [ ] Permissions list in PR description
- [ ] Backend blockers listed if any
- [ ] Did **not** push to `dev`/`main` without San approval
