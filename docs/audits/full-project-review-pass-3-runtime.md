# StreamAssist — pass 3 runtime / browser verification

- **Branch:** `slot/sa-review` (HEAD `789d5e4`)
- **Mode:** read-only runtime audit, no fixes. No commits, pushes, merges, destructive browser actions. No cookies/tokens/secrets in this report.
- **Companion reports:** [`docs/audits/full-project-review.md`](./full-project-review.md) (pass 1), [`docs/audits/full-project-review-pass-2.md`](./full-project-review-pass-2.md) (pass 2). This pass verifies pass 1 + pass 2 assumptions in a live browser against the local dev client.
- **Environment used:** Vite dev server `localhost:5173` only. **No API server running** (port 3333 was not started). DB not running. Mediasoup not running. Twitch IRC not running. Every `/api/*` and `/ws` request fails with `502 Bad Gateway` (Vite proxy upstream-down) or `503` for `/api/events/*`.
- **Auth scope used:** **anonymous only.** With the API down, neither the local email-password test account nor any admin scenario could actually be exercised — both are marked "needs full-stack runtime verification" below.

## Why the API was not started

The full-stack scenarios (email-password registration, admin role, host transfer, billing, mediasoup) require:

- Postgres reachable on `127.0.0.1:5432` (or via the Docker compose profile).
- Env vars (`AUTH_JWT_SECRET`, `NADLE_JWT_SECRET`, `DATABASE_URL`, optional Twitch / Google / Monobank credentials).
- A seeded test user, ideally promoted to `admin` and to `STREAMER` role for the beta-gated routes.

You approved spinning up the **client-only** dev server. Because the API is the gate for the email/admin scenarios you also approved, those scenarios in practice could not be reached — `/api/auth/register` returns `503` and `useAuth().refresh()` cannot resolve a Prisma user. They are reported as "needs runtime verification" pending a full-stack environment.

## What ran

- Vite dev server boot (background) — port `5173` returned HTTP 200 within ~2s.
- `chrome-extension://` user-logger is present in the Chrome profile (third-party extension); messages from it are noted in console captures but ignored in findings.
- Network capture: Vite's HMR + asset traffic dominates; results below are filtered to `/api/*`, `/ws`, and game-specific WS endpoints unless otherwise noted.

---

## A. Executive runtime summary

**What works (verified live):**

- **Landing `/`** — renders Ukrainian copy ("STREAMASSIST · ДЕ ЧАТ СТАЄ ГРОЮ"), 63 dev-asset GETs all 200, only `POST /api/events/client` is `503` because the server is down. No client-side console errors.
- **`/auth`** — login/register page renders with Twitch + Google + email/password options, Ukrainian copy. No console errors.
- **`/app`** — home renders with the games-cards grid (Mafia, Eat First, Nadle, Nadraw, Durak coming soon, Checkers). Game Template is **not** on this grid (P2-5 confirmed).
- **`/app/coin-hub` anonymous** — full Coin Hub UI mounts (balance "0", spin wheel, daily claim, predictions, "Pro" upsell). The page shows a "Bad Gateway" inline error for `/api/economy/wallet/me`, `/api/coinhub`, `/api/economy/transactions`, `/api/economy/cases/catalog`, but no redirect to `/auth`. **Pass 1 FE-M2 directly reproduced.**
- **`/app/eat?mode=view`** — auth bypass works as documented. Page mounts, title `"Кого ми з'їмо першим · Кімната"`. Auto-generates `?game=<8-char-id>` and **immediately POSTs `/api/eat-first/games/<id>/ensure`** and GETs the snapshot. Both 502 (server down). **If the server were running, every fresh anonymous OBS view would create an `EatFirstGame` row.** Pass 2 P2-4 amplified to "frontend auto-creates rows."
- **`/app/mafia?mode=view`** — auth + beta bypass works. Title `"Мафія · Stream Assist"`. Auto-generates `?room=<id>` and attempts `ws://127.0.0.1:3333/ws`. Console logs `[ws] connecting to ws://127.0.0.1:3333/ws`. Snippet shows "WebSocket connection failed" because server is down. Layout has `view-mode` CSS class applied.
- **`/app/game-template?mode=view`** — same bypass behavior as Mafia view-mode. Title `"Шаблон гри · Stream Assist"`. Auto `?room=<id>`. WS attempt fires.
- **Public Nadle `/app/nadle`** — redirects to `/app/nadle/nad1ch` (the default streamer); page renders with leaderboard, on-screen Ukrainian keyboard (Й Ц У К Е Н Г Ш Щ З Х Ї…), 5/6/7-letter word selector, embedded chat panel hardcoded to `#nad1ch`. Inline "Failed to load streamer" because API is down.
- **Public Nadraw `/app/nadraw-show/Nad1ch`** — renders with "Failed to load streamer" inline and "Тут камера (OBS)" placeholder + embedded chat panel.
- **Public Checkers `/app/checkers/lobby?defaultMode=rated`** — renders board + nickname form + leaderboard + chat panel. Note: page title is generic `"Stream Assist"` (no Checkers-specific title); this is a **minor SEO/title inconsistency**.
- **SEO marketing slugs** — `/video-calls-for-streamers`, `/twitch-nadle-game`, `/stream-overlay-tools` all serve the static English `index.html` pages with proper titles (`"Video Calls for Streamers | StreamAssist"`, etc.). Different content from the Ukrainian SPA; intentional SEO landings.
- **Direct reload of anonymous routes** — `/app/coin-hub` re-renders identically after `location.reload()`. Body length matches pre-reload.
- **Route guards for anonymous users:**
  - `/app/call` → `/auth?redirect=/app/call&mode=login` ✓
  - `/app/mafia` → `/auth?redirect=/app/mafia&mode=login` ✓
  - `/app/game-template` → `/auth?redirect=/app/game-template&mode=login` ✓
  - `/app/eat` → `/auth?redirect=/app/eat&mode=login` ✓ (beta gate triggers auth requirement first when not `?mode=view`)
  - `/app/billing` → `/auth?redirect=/app/billing&mode=login` ✓
  - `/app/account` → `/auth?redirect=/app/account&mode=login` ✓
  - `/app/verify-email` → `/auth?redirect=/app/verify-email&mode=login` ✓
  - `/app/beta-access` → `/auth?redirect=/app/beta-access&mode=login` ✓

**What is broken or partially broken (verified live):**

- **`/app/nonexistent-test-slug-12345`** — renders the full Nadle page with title `"Nadle · nonexistent-test-slug-12345"`. Inline message says "Invalid streamer" but the **whole UI is present** (on-screen keyboard, leaderboard, chat panel hardcoded to default `#nad1ch`). No 404, no redirect. The fake slug is **interpolated into the page title** and surfaces in browser history. **Pass 2 P2-6 reproduced.**
- **`/app/coin-hub` anonymous** — see above. The page should require auth (already pass 1 P1).
- **`/app/eat?mode=view` auto-ensure** — see above. The frontend auto-creates DB rows on a server that's up. Pass 2 P2-4 escalated.
- **`/app/admin/*` for anonymous user** — `requiresAdmin` guard redirects to `/app` (no `redirect=...` carry-over). Two child routes (`/app/admin/billing`, `/app/admin/diagnostics`) completed the redirect to `/app` and rendered home within 1.5–2.5s. **One child (`/app/admin/users`) stayed at the path `/app/admin/users` with an empty body and the inherited `/auth` title for ≥4 seconds** — the SPA never completed the redirect. Title `"StreamAssist – Video Calls for Streamers & OBS Overlay"` (inherited from `/auth` because no fresh title was set). This is a runtime UX bug: the page appears blank to anonymous users hitting `/app/admin/users` (the named-index child).
- **`/app/admin` vs `/app/billing` redirect asymmetry** — `/app/billing` redirects to `/auth` with `redirect=...` so login completes the original request; `/app/admin` redirects to `/app` home with **no return-to link**. An anonymous-via-shared-URL admin visit is silently dropped at the games grid with no message. Minor UX inconsistency.
- **`/auth?mode=register`** — the URL parameter does not visibly switch the form between login and register. The shown UI is identical to `/auth`. Either the toggle is hidden behind an interaction I didn't trigger, or the `?mode=register` query is wired but the form does not switch automatically. Needs frontend inspection.
- **`POST /api/events/error` flooding** — at `/app/coin-hub` (anonymous), the page emitted **6 separate `/api/events/error` POSTs within ~2 seconds** as the Coin Hub store kept retrying / reporting the "Bad Gateway" wallet error. Even though the server is down, this is a hot loop of error-reporting calls. Worth verifying on a healthy server to confirm the loop terminates when the upstream succeeds.

**What needs full-stack runtime verification:**

- Email-password registration / login / logout / password-reset flows.
- Email-verification gate (`/app/verify-email` redirect when authed but unverified).
- Beta-gate modal on Mafia / Game-Template / Eat First / Call when authed-but-not-streamer.
- Admin role gate (`/app/admin` for an `admin` cookie).
- All Coin Hub mutations (claim, spin, case open).
- Billing flow (Jar create / mark-paid / Mono webhook).
- Predictions create / join / resolve.
- WebRTC join / publish / consume / reconnect / OBS view media render.
- WS reconnect / visibility / focus matrices.
- Mafia host claim, transfer-host two-phase consent flow.
- Game-Template `transferHost` single-phase (BE-M1 from pass 1).
- Twitch IRC chat-reward path.
- Anonymous DB-row creation impact of `/app/eat?mode=view` (P2-4 escalated).

**What is unsafe to test in current environment:**

- Production app — out of scope per the audit constraint.
- Mono webhook against production secret — never.
- Twitch / Google live OAuth in this audit pass (would require your credentials in the browser; you would have to walk me through, never going through the transcript).

---

## B. Route runtime matrix

Legend:
- **A** = anonymous (no session cookie set in this audit).
- **NRV** = needs runtime verification with the full stack and an authenticated session.
- **Prod-ready (anon)** rating refers to whether the anonymous behavior matches design intent.

| # | Route | Expected (from code audit) | Actual (browser) | Auth state | Console/network | Reload | Prod-readiness (anon) | Finding ID |
|---|-------|---------------------------|------------------|-----------:|-----------------|:-----:|----------------------|------------|
| 1 | `/` | landing renders | renders ✓ | A | 1× `/api/events/client` 503 (server down) | ✓ | OK | – |
| 2 | `/auth` | login UI | renders ✓ | A | `/api/auth/me` 503, `/api/events/*` 503 | – | OK | – |
| 3 | `/auth?mode=register` | register form variant | **same as `/auth`** — no visible mode switch | A | same as 2 | – | UX-Q | P3-R1 |
| 4 | `/app` | home + games grid | renders ✓ — Game Template absent from grid | A | `/api/auth/me` 503, `/api/events/*` 503 | ✓ | OK (carry-over of P2-5) | – |
| 5 | `/app/call` | redirect to `/auth?redirect=...` | redirect ✓ | A | route guard fires | ✓ | OK | – |
| 6 | `/app/mafia` | redirect to `/auth?redirect=...` | redirect ✓ | A | route guard fires | ✓ | OK | – |
| 7 | `/app/mafia?mode=view` | anonymous OBS, auto-room | renders ✓, auto `?room=<id>`, attempts WS | A | `ws://127.0.0.1:3333/ws` failed (server down) | ✓ | OK structural; **media: NRV** | – |
| 8 | `/app/game-template` | redirect to `/auth?redirect=...` | redirect ✓ | A | route guard fires | ✓ | OK | – |
| 9 | `/app/game-template?mode=view` | anonymous OBS, auto-room | renders ✓, auto `?room=<id>`, attempts WS | A | same as 7 | ✓ | OK structural; **media: NRV**; visibility decision Pass2-Q-A still open | – |
| 10 | `/app/eat` | redirect to `/auth?redirect=...` | redirect ✓ | A | route guard fires | ✓ | OK | – |
| 11 | `/app/eat?mode=view` | anonymous OBS, auto-game | renders ✓, auto `?game=<id>`, **immediately calls `/api/eat-first/games/<id>/ensure` (POST) + `/snapshot` (GET)** | A | `/api/eat-first/games/<id>/ensure` 502; `/api/eat-first/games/<id>/snapshot` 502; console: `[eat-first:call-page] ensure game failed` warning; `[eat-first:call-snapshot] eat first snapshot fetch failed` warning | ✓ | **OK structurally, but each load creates a DB row when API is up** | P3-R2 (escalates Pass-2 P2-4) |
| 12 | `/app/coin-hub` | **expected by pass 1 to redirect; actually doesn't** | **renders full UI anonymously** ✓ as Bug, with "Bad Gateway" inline. Title `"Монетний хаб · Stream Assist"` | A | `/api/coinhub` 502, `/api/economy/wallet/me` 502, `/api/economy/transactions` 502, `/api/economy/cases/catalog` 502, **6× `/api/events/error` POST 503 within ~2s** (error-report loop) | ✓ — same body length post-reload | **FE-M2 confirmed P1**; new P3-R3 (error-loop) | P1 FE-M2 + P3-R3 |
| 13 | `/app/billing` | redirect to `/auth?redirect=...` | redirect ✓ | A | route guard fires | ✓ | OK | – |
| 14 | `/app/account` | redirect to `/auth?redirect=...` | redirect ✓ | A | route guard fires | ✓ | OK | – |
| 15 | `/app/verify-email` | redirect to `/auth?redirect=...` | redirect ✓ | A | route guard fires | ✓ | OK | – |
| 16 | `/app/beta-access` | redirect to `/auth?redirect=...` | redirect ✓ | A | route guard fires | ✓ | OK | – |
| 17 | `/app/admin` | `requiresAdmin` → redirect (expected to `/app` per code) | redirected to `/app` ✓ | A | route guard fires | ✓ | UX-Q — no return path (compared to `/app/billing`) | P3-R4 |
| 18 | `/app/admin/users` | `requiresAdmin` → redirect | **stays at `/app/admin/users` with empty body for ≥4s.** Title inherits prior `/auth` page title. Eventually router context says final URL is `/app/admin/users` and never resolves home. | A | no body, /api/auth/me 503 | ? | **Stuck blank page (anon)** | P3-R5 |
| 19 | `/app/admin/billing` | `requiresAdmin` → redirect | redirected to `/app` ✓ | A | route guard fires | ✓ | OK | – |
| 20 | `/app/admin/diagnostics` | `requiresAdmin` → redirect | redirected to `/app` ✓ | A | route guard fires | ✓ | OK | – |
| 21 | `/app/admin/streamers`, `/app/admin/games`, `/app/admin/stats`, `/app/admin/debug`, `/app/admin/economy` | `requiresAdmin` → redirect | Not individually tested at runtime; behavior assumed = `/app/admin/billing`. | A | – | NRV | NRV | – |
| 22 | `/app/nadle` | redirect to `/app/nadle/<default>` | redirected to `/app/nadle/nad1ch` ✓ | A | renders, "Failed to load streamer" inline (server down) | ✓ | OK | – |
| 23 | `/app/nadle/nad1ch` (Nadle streamer) | public page | renders ✓ | A | `/api/streamer/nad1ch` 502, `/nadle-ws` will fail; UI renders leaderboard, on-screen keyboard, chat panel | ✓ | OK structurally | – |
| 24 | `/app/nadraw-show/Nad1ch` | public page | renders ✓ | A | "Failed to load streamer" inline; UI renders | ✓ | OK structurally | – |
| 25 | `/app/checkers/lobby?defaultMode=rated` | public page | renders ✓ — board, leaderboard, chat panel | A | "Не вдалося завантажити таблицю" inline | ✓ | OK structurally; title `"Stream Assist"` (no Checkers brand) | P3-R6 (minor) |
| 26 | `/app/nonexistent-test-slug-12345` | renders Nadle for the bogus slug (P2-6) | **renders ✓ — title `"Nadle · nonexistent-test-slug-12345"`, "Invalid streamer" inline, full UI mounted, chat panel hardcoded to default** | A | `/api/streamer/nonexistent-test-slug-12345` 502 | ✓ | **Bad UX: fake slug becomes a valid bookmarkable URL with page title** | **P3-R7** (verifies P2-6) |
| 27 | `/video-calls-for-streamers` | hard-redirect to static HTML | served `index.html` ✓ — title `"Video Calls for Streamers \| StreamAssist"`, English copy | A | static asset serve | ✓ | OK | – |
| 28 | `/twitch-nadle-game` | static SEO landing | served ✓ — title `"nadle — chat word game for Twitch \| StreamAssist"` | A | static asset serve | ✓ | OK | – |
| 29 | `/stream-overlay-tools` | static SEO landing | served ✓ — title `"Stream Overlay Tools \| StreamAssist"` | A | static asset serve | ✓ | OK | – |

---

## C. Runtime findings (pass 3)

ID prefix `P3-R*` for pass-3 runtime originals.

---

**Finding ID:** P3-R1
**Severity:** Question
**Route/flow:** `/auth?mode=register`
**Files:** `apps/client/src/pages/AuthPage.vue` (not opened at byte-level this pass — needs targeted inspection)
**Evidence:** Direct URL with `?mode=register` renders the same DOM as `/auth`. Snippet identical: "Акаунт · РЕКОМЕНДОВАНО ДЛЯ СТРІМІНГУ — ПОВНА СЕСІЯ TWITCH І ФУНКЦІЇ ДЛЯ ЕФІРУ. · Увійти через Twitch · Увійти через Google · АБО · Пошта · Пароль · Забув пароль? · Увійти / Зареєструватися".
**Expected:** Either the form switches to "register" mode, or the toggle becomes visible.
**Actual:** No visible difference. The "Увійти / Зареєструватися" button is the only switch; no preselection from the URL.
**Why it matters:** Beta-access modal in pass 2 redirects unauthorized users to `home?betaAccess=…`; the `Open StreamAssist` CTA elsewhere may use `?mode=register` expecting the register form preselected. Inspect to confirm. Likely minor.
**Code-audit confirmed?** No — this is new in pass 3.
**Needs fix later?** Yes if `?mode=register` is documented behavior.
**Recommended branch:** `fix/auth-page-mode-query-toggle` (only if behavior is wrong).
**QA:** Open `/auth?mode=register` directly and click "Open app · register" links from landing.
**Priority:** P3.

---

**Finding ID:** P3-R2
**Severity:** Major (escalation of pass-2 P2-4)
**Route/flow:** `/app/eat?mode=view` (and any first-time visit to `/app/eat`)
**Files:** `apps/client/src/eat-first/services/eatFirstTransport.js` (`jfetch`, `efEnsureGame`), `apps/client/src/eat-first/composables/useEatFirstCallGameSnapshot.ts:17`, `apps/server/src/eatFirst/router.ts:138-155` (`POST /api/eat-first/games/:gameId/ensure`)
**Evidence (runtime):**
- Anonymous visit to `/app/eat?mode=view` with no `?game=` auto-generated a random `?game=d99xhyfe`.
- Network capture shows immediately:
  - `GET /api/eat-first/games/d99xhyfe/snapshot` → 502
  - `POST /api/eat-first/games/d99xhyfe/ensure` → 502
- Console warnings emitted: `[eat-first:call-snapshot] eat first snapshot fetch failed Error: Bad Gateway` and `[eat-first:call-page] ensure game failed Error: Bad Gateway`.
- On a healthy server, both calls would succeed and the `ensure` POST would **create an `EatFirstGame` row** keyed by the auto-generated game id.
**What is wrong:** Pass 2 identified that the endpoint is anonymous-callable. Pass 3 confirms the **frontend triggers it automatically on every page load**, including OBS view mode with a random new game id. Therefore the practical attack surface is broader than pass 2 estimated.
**Why it matters:** A scripted scraper, or an OBS browser source that rotates URLs, can populate `EatFirstGame` indefinitely. Rate limit (240 mutations/min/IP) bounds throughput but not total volume over weeks.
**Code audit already confirmed?** Partially (pass 2 P2-4). Pass 3 adds runtime confirmation of automatic invocation.
**Needs fix later?** Yes — product decision needed first.
**Recommended branch:** `fix/eat-first-ensure-anon-cap` (after product decision).
**QA:** Open `/app/eat?mode=view` in a fresh tab against a live server; verify a new `EatFirstGame` row exists in DB. Open 20 fresh tabs in a row; verify row count grew by 20 (and inspect rate-limit response).
**Priority:** P2.

---

**Finding ID:** P3-R3
**Severity:** Minor (potential perf)
**Route/flow:** `/app/coin-hub` anonymous
**Files:** `apps/client/src/pages/CoinHubPage.vue`, `apps/client/src/stores/coinHub.ts`, `apps/client/src/utils/clientAnalytics.ts` (suspected error-reporter)
**Evidence (runtime):** Within ~2 seconds after navigating to `/app/coin-hub` anonymously, the network log captured **6 POSTs to `/api/events/error`** (all 503 because server is down). On a healthy server these would all succeed and would write 6 `ClientErrorEvent` rows for a single page load.
**What is wrong:** The Coin Hub store reports each individual failing call (wallet, transactions, cases catalog, coinhub) plus retries / "Bad Gateway" surfacing. With auth required (FE-M2 fix landed), the page would not mount anonymously and this wouldn't fire — but for any logged-out user momentarily on this page (or after a session expiry mid-session), the error-reporter is loud.
**Why it matters:** Per-page burst writes to `/api/events/error`. The server already accepts but rate-limits via `consumeRateLimit` and bodies up to 16 KB. Acceptable but worth confirming the loop terminates and isn't a per-error retry storm.
**Code audit confirmed?** No — new in pass 3.
**Needs fix later?** Verify; if confirmed multiplicative, debounce.
**Recommended branch:** `perf/coin-hub-error-report-debounce`
**QA:** Open `/app/coin-hub` (logged out, server up) and count `/api/events/error` requests over 5 seconds. Compare to logged-in healthy state.
**Priority:** P3.

---

**Finding ID:** P3-R4
**Severity:** Minor (UX)
**Route/flow:** `/app/admin` anonymous redirect
**Files:** `apps/client/src/router.ts:540-547` (admin redirect)
**Evidence:** `/app/admin` for anonymous user redirects to `/app` (home) with no `redirect=...` query; `/app/billing` for anonymous user redirects to `/auth?redirect=/app/billing&mode=login`. Two different paths to "user not allowed."
**What is wrong:** Inconsistent UX. A user who clicks an admin link (e.g., from a Slack message) lands silently on the games grid with no breadcrumb or message. By contrast, the billing link properly routes through `/auth` and returns to billing post-login.
**Why it matters:** Discoverability. An admin who isn't currently signed in won't realize they need to sign in — they'll see the home games grid.
**Code audit confirmed?** Surfaced in pass 2's route table (admin uses `requiresAdmin`, not `requiresAuth`); pass 3 confirms the UX path.
**Needs fix later?** Minor; either send admins through `/auth?redirect=` like the other auth-required routes, or display a banner on `/app` explaining why they landed there.
**Recommended branch:** `fix/admin-route-anon-redirect-with-return-path`
**Priority:** P3.

---

**Finding ID:** P3-R5
**Severity:** Major (visible UX bug for one specific path)
**Route/flow:** `/app/admin/users` anonymous
**Files:** `apps/client/src/router.ts:230-235` (admin children — `path: ''` named `admin-users` is the parent's index child)
**Evidence (runtime):** Anonymous navigation to `/app/admin/users` does NOT redirect within 4+ seconds. `location.pathname` stays at `/app/admin/users`, `document.body.innerText.length === 0`, `document.title` shows the inherited `/auth` title (`"StreamAssist – Video Calls for Streamers & OBS Overlay"`). The other admin children (`/app/admin/billing`, `/app/admin/diagnostics`) correctly redirected to `/app` and rendered home.
**What is wrong:** The admin index child (`path: ''`) routes differently from the named admin children. The result is a **blank page with stale title** for anyone hitting `/app/admin/users` directly without admin. Bookmarks land at a broken state.
**Why it matters:** Visible blank page for a user who is not authenticated. Title still says "StreamAssist – Video Calls for Streamers & OBS Overlay" while the URL is `/app/admin/users` — confusing.
**Code audit confirmed?** Not in pass 1/2. **New runtime-only finding.**
**Needs fix later?** Yes. Investigate why the admin index child does not complete the parent-meta `requiresAdmin` redirect within the same tick as the sibling children.
**Recommended branch:** `fix/admin-index-route-blank-for-anonymous`
**QA:** Navigate anonymously to `/app/admin/users`, `/app/admin`, `/app/admin/streamers`, `/app/admin/games`, `/app/admin/stats`, `/app/admin/debug`, `/app/admin/billing`, `/app/admin/economy`, `/app/admin/diagnostics`. Verify all redirect to `/app` within 1s.
**Priority:** P2.

---

**Finding ID:** P3-R6
**Severity:** Minor (SEO/UX)
**Route/flow:** `/app/checkers/:roomId`
**Files:** `apps/client/src/router.ts:166-172` (`meta: { appTitle: 'Шашки', footerContext: 'home', footer: false }`); `apps/client/src/features/checkers/pages/CheckersPage.vue` (does not appear to set `document.title` from `meta.appTitle`)
**Evidence (runtime):** Navigating to `/app/checkers/lobby?defaultMode=rated` set `document.title = "Stream Assist"`. By contrast, `/app/nadle/<streamer>` sets `"Nadle · <streamer>"`, `/app/mafia?mode=view` sets `"Мафія · Stream Assist"`, `/app/eat?mode=view` sets `"Кого ми з'їмо першим · Кімната"`. Checkers is the only major route in this pass whose title is the generic app title.
**What is wrong:** Either the title wiring for Checkers is missing, or the `appTitle: 'Шашки'` meta is not actually consumed by whatever applies it.
**Why it matters:** SEO and browser-tab UX. With Checkers as the title, multiple Checkers tabs collide visually with other Stream Assist tabs.
**Code audit confirmed?** Surfaced only at runtime.
**Needs fix later?** Yes — minor.
**Recommended branch:** `fix/checkers-page-title-from-meta`
**Priority:** P3.

---

**Finding ID:** P3-R7
**Severity:** Major (UX + SEO + cataloguing — re-confirms pass-2 P2-6)
**Route/flow:** `/app/<any-slug>` legacy short URL
**Files:** `apps/client/src/router.ts:278-283` (`path: ':streamer'`)
**Evidence (runtime):** `/app/nonexistent-test-slug-12345` rendered the full Nadle page. `document.title` was set to `"Nadle · nonexistent-test-slug-12345"`. The page showed "Invalid streamer" inline but rendered the leaderboard, on-screen keyboard, 5/6/7-letter selector, and embedded chat panel hardcoded to `#nad1ch` (the default streamer). No 404, no redirect.
**What is wrong:** Any HTTP GET to `/app/<anything>` (except reserved routes) becomes a valid SPA URL with a bookmarkable state, a misleading page title (containing the bogus slug), and a partially rendered Nadle UI. Search engines may index typo URLs.
**Why it matters:** Bookmarking typos; SEO pollution; user confusion if they share `/app/marygold` thinking Marygold is a streamer; pairs with pass 1 BE-M2 (server `players` Map grows per slug if any WS connect attempt occurs).
**Code audit confirmed?** Yes — pass 2 P2-6. Pass 3 reproduces it at runtime.
**Needs fix later?** Yes — product decision. Either validate the slug against an active streamer in the route loader and 404, or document this behavior.
**Recommended branch:** `fix/legacy-streamer-shortcut-validation`
**QA:** Open `/app/<random-slug>` (server up); confirm 404 page or redirect; confirm title does not include the bogus slug.
**Priority:** P2.

---

## D. Product / UX inconsistencies (runtime-observed)

Pages that say coming-soon but the feature exists:
- **Coin Hub vs Economy modal** (pass 2 P2-3) — the home Economy section opens a "Economy coming soon" modal while `/app/coin-hub` is fully implemented and reachable from chrome. Confirmed at runtime — the home page Ukrainian copy includes "ЕКОНОМІКА · Почати заробляти · JACKPOT" and the click target opens a coming-soon modal, but **the Coin Hub page is live**.

Pages reachable but not linked:
- **`/app/game-template`** (pass 2 P2-5) — runtime confirmed not on the home games grid. Page itself works in `?mode=view` form for anyone. Direct URL works for any beta user.

Pages linked but not ready:
- **Durak** — appears on the home games grid as `comingSoon`; no route. Behaves as documented "coming soon."
- **Coin Hub anonymous** — linked from chrome but blocks at server because viewer is logged out, while the page mounts the UI anyway. Mixed signal.

Routes that should probably be hidden:
- **`/app/<random-slug>`** — legacy short URL is reachable for any slug; runtime confirms behavior (P3-R7).
- **`/app/game-template`** — pending product decision (P2-5 / Pass2-Q-A).
- **`/api/auth/apple`** — server endpoint replies "not implemented" (pass 2 P2-9); not visited at runtime in pass 3 because it's a server route.

Auth/role behavior that feels confusing:
- **`/app/admin` vs `/app/billing` redirect asymmetry** (P3-R4).
- **`/app/admin/users` blank-page state** (P3-R5).
- **`/auth?mode=register`** — no visible effect; toggle is non-obvious (P3-R1).
- **OBS view-mode bypass is documented but does NOT block the auto-ensure of EatFirst rows** (P3-R2). Whether this is intended for OBS streamers without accounts is the product decision in Pass2-Q-D.

---

## E. Browser-only unknowns left

The following could not be verified at runtime in this pass because either (a) the API/DB/mediasoup stack was not running, (b) authenticated sessions are required and no safe account/session was available, or (c) the verification requires multi-tab or browser-specific setup.

| Item | Reason left unverified | What's needed |
|---|---|---|
| Authed `/api/auth/me` shape and cookie attributes | server not running | start full stack with seeded test user |
| Email-password register → verify-email gate | server not running | as above |
| Email-password login → redirect carry-over | server not running | as above |
| Beta-access modal opening at `home?betaAccess=mafia` (etc.) | requires authed-non-streamer cookie | as above |
| `/app/admin` for admin role | requires admin cookie | promote test user via DB seed |
| `/app/admin/users/:userId/role` (admin route mutation) | admin-only; runtime audit forbids destructive admin actions | use a throwaway admin user against a clean DB |
| Coin Hub mutations (claim / spin / case-open) | requires authed cookie | as above |
| Predictions create / join / resolve | requires authed cookie + streamer ownership | seed Streamer + ownerId |
| Billing Jar create / mark-paid | requires authed cookie + mock Mono webhook | seed env vars; never test against production Mono |
| WebRTC join / publish / consume / replaceTrack | mediasoup down | start mediasoup workers |
| OBS view-mode actual media render | mediasoup down | as above |
| WS reconnect/visibility/focus matrices | server down | as above |
| Mafia host claim, two-phase transfer-host | server down | as above |
| `gameroom:transfer-host` single-phase exploit | server down | as above |
| 8–12 cameras tile-remount QA | mediasoup down + multi-tab | as above + multiple browsers |
| Twitch IRC chat-reward end-to-end | depends on TWITCH_* env + DB | seed Streamer row + dev IRC channel |
| EatFirst real DB-row creation impact (P3-R2) | server not running | start server with empty DB; visit `/app/eat?mode=view` 10× and count rows |
| Cloudflare 25s idle ping behavior | production-only | observation on staging |
| `wsProtocolDuplication` parity for GameRoom + EatFirst | a unit test, not browser | add to `packages/client-consistency/wsProtocolDuplication.test.ts` |
| Apple OAuth "not implemented" UX | server endpoint, not browser | curl or full stack |
| Mono webhook secret rotation behavior | production-only | ops runbook |

---

## F. Follow-up audit suggestions (no fixes)

Pass 3 is sufficient as a **route/auth/structural** verification of pass 1 and pass 2. Pass 4 should focus on flows that genuinely need a full backend up. Suggested next read-only passes:

1. **Pass 4: full-stack runtime audit** — start `dev:host-db` or `dev:all`, seed an admin + streamer test user, then walk the authenticated and admin scenarios from this matrix.
2. **Pass 5: WebRTC multi-tab runtime audit** — 2 tabs, 8–12 simulated cameras, Mafia + GameTemplate + OBS view; verify pass 1 RT-F9 / F10 self-tile drift, video element identity, screen share start/stop/`ended`, reconnect.
3. **Pass 6: Economy mutation safety audit** — under a full stack: ledger invariant (`sum delta == balance`), idempotency keys across daily/case/prediction/chat-reward, two-tab race on claims/spin/case-open.
4. **Pass 7: OBS 4K visual audit** — open Mafia / Eat First / Nadle / Nadraw at OBS-typical resolutions (1920×1080, 4K, vertical) and check overlay/timer/queue stability.
5. **Pass 8: WS reconnect & visibility/focus audit** — kill server mid-call, restore, verify reconnect cadence, ensure no duplicate timers / sockets; tab switch + visibility-change; `online` re-arm path.
6. **Pass 9: legacy-route stress audit** — script visits to 100 distinct fake `/app/<slug>` URLs against a healthy server and confirm `players` Map memory growth or — if validation is added — clean 404s.
7. **Pass 10: SEO / page-title audit** — run a headless crawler across every route and confirm titles match the route's `meta.appTitleKey` / `appTitle`. Catch P3-R6 generically.

---

## Closing notes

- The dev client started and is still running in the background. Per safe-audit policy I am leaving it alone — the user can stop it with the harness or by terminating the npm process.
- No runtime code, configs, tests, or secrets were modified or printed.
- Pass 1 + pass 2 + pass 3 collectively form the "no Critical, several P1/P2, several runtime-confirmed" state of `slot/sa-review` @ `789d5e4`.

*End of pass 3. No commits, no pushes, no merges. The only new file is `docs/audits/full-project-review-pass-3-runtime.md`.*
