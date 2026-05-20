# StreamAssist — full-project read-only audit, pass 2

- **Branch:** `slot/sa-review` (HEAD `789d5e4`, clean except prior `docs/audits/full-project-review.md`)
- **Mode:** read-only. No runtime code, configs, tests, or commits modified.
- **Companion:** pass 1 lives at [`docs/audits/full-project-review.md`](./full-project-review.md). Pass 1 was treated as input, not truth — every prior P1 finding was re-verified and several were expanded; nothing was assumed.
- **Scope of pass 2:** breadth-first coverage matrix across every route, REST endpoint, WS message type, feature, store, watcher pattern, and architecture-drift surface, plus a UX/product-risk lens.

---

## A. Executive summary

**Pass 1 was correctly scoped but shallow in five areas:**

1. It accepted "no Critical issues" without auditing the `/app/coin-hub` reachability gap end-to-end. Pass 2 confirms the gate is missing and surfaces three additional public-by-default surfaces in the same vein (`/app/eat-first/.../ensure`, `/app/nadle-ws?streamerId=any`, `/app/nadraw-show?streamer=any`).
2. It did not detect that **two forked store files contain literal NUL (`\x00`) bytes** introduced by whatever tooling produced the fork. `apps/client/src/stores/gameTemplateGame.ts` has 5 NUL bytes and `apps/client/src/stores/gameTemplatePlayers.ts` has 2; all sit inside `.join(' ')` calls where the apparent space character is actually `'\0'`. `mafiaGame.ts` / `mafiaPlayers.ts` have zero NUL bytes. Runtime impact is contained (the NUL is used only as a separator inside private string keys for equality comparison), but this is a real source-corruption finding and a likely flag in code-review tooling.
3. It noted the CallPage / GameTemplateCallPage fork at "SY-1" but missed that the `components/game-call/Game*` extraction is the architectural pattern the page-level fork should follow next. Pass 2 confirms the Phase 5a/5b extraction is complete for `HostActionsBar` / `SpeakingQueueBar` / `Overlay` / `TimerOverlay` — only the page-level fork is the remaining duplicate.
4. It did not enumerate the **3 SEO marketing slug routes**, the `verify-email` / `beta-access` / `account` page chrome, the **Apple OAuth endpoint that returns "not implemented"**, the dual `coin-hub` redirects (`/app/wallet`, `/app/cases`), or the legacy `/eat/{join,admin,control,overlay}` redirects.
5. It did not catalogue the WS server-to-client message universe; only client→server was implicitly mapped via the schema. Pass 2 maps both directions and finds **`wsProtocolDuplication.test.ts` does not cover GameRoom or EatFirst constants** — a CI gap that lets those two protocols drift between client and server without test failure.

**Biggest unknowns still requiring browser/runtime testing:**

- Whether the NUL bytes in `gameTemplateGame.ts` / `gameTemplatePlayers.ts` cause any tooling failure in production builds (vite/tsc/eslint may or may not warn). **Needs runtime verification** — run `npm run build -w client` and `tsc --noEmit` to confirm.
- Whether the `/app` (home) route flickers anonymous content when an unauthenticated user opens it (no `requiresAuth` on home; only beta-gated children require auth).
- Whether `<video>` actually remounts in any scenario despite stable `peerId` keying — pass 1 cleared this by code reading, but only a live 8–12 camera session in OBS confirms.
- Whether the JSON `pong` from server is reliably ≤25 s under Cloudflare Free plan idle behaviour (production-only).
- Whether the `?mode=view` OBS clients on Mafia/Game-Template/Eat First reliably re-receive snapshot after a WS reconnect that did **not** re-run `join-room`. Verify via 30-minute OBS soak.
- Whether the **GameTemplate route is intentionally user-facing** or dev-only. It does not appear on the `HomePage.vue` game-cards list (only Mafia/Eat First/Nadle/Nadraw/Checkers/Durak-coming-soon do). Direct-URL access works for any beta-gated user. **Needs product clarification.**

---

## B. Coverage matrices

### B.1 Routes coverage

Source: `apps/client/src/router.ts` and the route-loaders in `apps/client/src/routerRouteLoaders.ts`. Auth model defined by `router.ts:540-575`. OBS view-mode bypass is `isMafiaObsViewRoute || isEatFirstObsViewRoute`.

| # | Path | Name | Auth | Beta gate | OBS view-mode bypass | Page | Notes |
|---|------|------|------|-----------|---------------------|------|-------|
| 1 | `/` | `landing` | public | – | – | LandingPage.vue (3800 LOC) | huge marketing page |
| 2 | `/auth` | `auth` | public | – | – | AuthPage.vue (364 LOC) | login/register/reset |
| 3 | `/video-calls-for-streamers` | seo-marketing-… | public | – | – | hard-redirect to `/video-calls-for-streamers/index.html` | SEO landing |
| 4 | `/twitch-nadle-game` | seo-marketing-… | public | – | – | hard-redirect | SEO landing |
| 5 | `/stream-overlay-tools` | seo-marketing-… | public | – | – | hard-redirect | SEO landing |
| 6 | `/app` (no name) | – | public | – | – | AppShellLayout.vue (huge) | layout only |
| 7 | `/app` (index) | `home` | public | – | – | HomePage.vue | beta-access modal via `?betaAccess=…` |
| 8 | `/app/verify-email` | `verify-email` | requiresAuth | – | – | VerifyEmailPage.vue | email-verify gate target |
| 9 | `/app/beta-access` | `beta-access` | requiresAuth | – | – | BetaAccessPage.vue | "we'll let you in soon" |
| 10 | `/app/call` | `call` | requiresAuth | yes | n/a | CallPage.vue (2558 LOC) | direct call |
| 11 | `/app/mafia` | `mafia` | requiresAuth | yes | **yes** | MafiaPage.vue → CallPage.vue | OBS source allowed unauth |
| 12 | `/app/game-template` | `game-template` | requiresAuth | yes (`mafia` modal) | **yes** | GameTemplatePage.vue → GameTemplateCallPage.vue (1701 LOC) | **forked CallPage** |
| 13 | `/app/nadle` | `nadle` | public | – | – | redirect to default-streamer Nadle | – |
| 14 | `/app/nadle/:streamer` | `nadle-streamer` | public | – | – | NadleStreamPage.vue (2353 LOC) | viewer-readable |
| 15 | `/app/nadraw-show/:streamer` | `nadraw-show` | public | – | – | NadrawShowPage.vue | viewer-readable |
| 16 | `/app/checkers/:roomId` | `checkers` | public | – | – | CheckersPage.vue | matchmaking link |
| 17 | `/app/eat` | `eat` | public | yes | **yes** | EatFirstPage.vue → EatFirstCallPage.vue | unusual: public route gated by beta WHEN signed in |
| 18 | `/app/coin-hub` | `coin-hub` | **public** (pass 1 FE-M2) | – | – | CoinHubPage.vue (581 LOC) | should require auth |
| 19 | `/app/wallet` | – | – | – | – | redirect → `coin-hub` | legacy |
| 20 | `/app/cases` | – | – | – | – | redirect → `coin-hub` | legacy |
| 21 | `/app/predictions/:streamerId` | `economy-predictions` | requiresAuth | – | – | EconomyPredictionsPage.vue | |
| 22 | `/app/streamer/:streamerId/economy` | `economy-streamer-settings` | requiresAuth | – | – | EconomyStreamerSettingsPage.vue | server enforces ownership |
| 23 | `/app/billing` | `billing` | requiresAuth | – | – | BillingPage.vue (648 LOC) | StreamAssist Pro |
| 24 | `/app/account` | `account` | requiresAuth | – | – | AccountPage.vue (2612 LOC) | likely page-fat |
| 25 | `/app/admin` (index) | `admin-users` | **requiresAdmin** | – | – | AdminUsers.vue | inside Admin layout |
| 26 | `/app/admin/streamers` | `admin-streamers` | admin | – | – | AdminStreamers.vue | |
| 27 | `/app/admin/games` | `admin-games` | admin | – | – | AdminGames.vue | |
| 28 | `/app/admin/stats` | `admin-stats` | admin | – | – | AdminStats.vue | |
| 29 | `/app/admin/debug` | `admin-debug` | admin | – | – | AdminDebug.vue | |
| 30 | `/app/admin/billing` | `admin-billing` | admin | – | – | AdminBilling.vue | |
| 31 | `/app/admin/economy` | `admin-economy` | admin | – | – | AdminEconomy.vue | |
| 32 | `/app/admin/diagnostics` | `admin-diagnostics` | admin | – | – | AdminDiagnostics.vue | |
| 33 | `/app/:streamer` | `app-streamer` | public | – | – | NadleStreamPage.vue | legacy short URL, can shadow unknown static paths |
| 34 | `/call`, `/nadle`, `/nadle/:streamer`, `/nadraw-show/:streamer`, `/eat`, `/eat/join`, `/eat/admin`, `/eat/control`, `/eat/overlay`, `/admin/*` | legacy redirects | – | – | – | – | normalize to `/app/*` |

**Route-level observations:**

- The route guard at `router.ts:540-575` orders checks as `requiresAdmin → OBS bypass → requiresAuth → beta gate`. OBS bypass is only consulted for `mafia` / `game-template` / `eat` and only when `?mode=view`. Good.
- `home` (`/app`) does **not** require auth, but if the user is authenticated AND `userNeedsEmailVerification` is true AND the route is **not** `verify-email`, they are redirected to `verify-email` (`router.ts:524-530`). This means an authenticated-but-unverified user cannot see the `home` games grid. Anonymous users land on `home` fine.
- The legacy `:streamer` short URL is the **last** child of `/app`. Vue Router matches static names first, so `/app/somebody` resolves only if `somebody` isn't a reserved word. This is acceptable but a URL like `/app/admin` cannot be a streamer named "admin" — also acceptable.
- Beta-gated routes redirect non-streamers to `home?betaAccess=<modal>` — handled by `BetaAccessModal`. So a user who clicks Mafia from the games card grid sees a modal, never the page chrome. Good UX.
- `legacyEatViewValues` mapping: `view=overlay` → `mode=view`; `view=control` and `view=admin` are dropped entirely. That matches the cursor-rules statement that the old Eat First panel surface was removed.

**Suspicious or under-documented:**

- `/app/game-template` is reachable by direct URL by any beta user but is **not on `HomePage.vue`'s game-cards**. Either an internal dev/QA surface or unfinished. Confirm product intent. (Q-Pass2-A)
- `/app/:streamer` legacy short URL can be opened with arbitrary slugs and will render the `NadleStreamPage` for that streamer regardless of whether a row exists. BE-M2 from pass 1 (unbounded `players` Map) compounds here — every distinct slug bookmarked by viewers grows server memory.

### B.2 Features coverage

| Feature | Maturity | Frontend SSOT | Backend SSOT | DB models | WS endpoints | Notes |
|---------|---------:|---------------|--------------|-----------|--------------|-------|
| Call (1:1 / multi) | production | `packages/call-core/**`, `CallPage.vue` | `signaling/*`, `rooms/Room.ts`, `mediasoup/*`, `peers/Peer.ts` | – | `/ws` | server authoritative; beta-gated |
| Mafia | production | `MafiaPage.vue`, `mafiaGame`, `mafiaPlayers`, `composables/mafia*`, `components/mafia/*` | `Room.ts` Mafia fields, `mafiaRoomOwnerStore`, `mafiaTransferOfferStore`, `messageHandlers.ts` `mafia:*` | `MafiaRoomOwner` | shares `/ws` via `mafia:*` | two-phase transfer-host with consent |
| Game Template | partial / dev | `GameTemplatePage.vue`, `gameTemplateGame.ts` (NUL bytes), `gameTemplatePlayers.ts` (NUL bytes), `components/game-template/*` | `Room.ts` game-room fields, `gameRoomOwnerStore`, `messageHandlers.ts` `gameroom:*` | `GameRoomOwner` | shares `/ws` via `gameroom:*` | **transfer-host single-phase (BE-M1)**; **NOT on home page games grid** |
| Eat First | production (overlay/media medium-high risk) | `eat-first/*` sub-app, `EatFirstCallPage.vue`, `eatFirstCallShell`, `composables/eatFirst*` | `apps/server/src/eatFirst/*` | `EatFirstGame`, `EatFirstPlayer`, `EatFirstVote` | `/eat-first-ws` (subscribe-only) + `/ws` via `eat:*` | dual WS endpoint; slot auth via `(joinToken,deviceId)` |
| Nadle / Wordle | production | `pages/NadleStreamPage.vue` (2353 LOC), `nadle/*` module | `apps/server/src/nadle/*` | `Streamer`, `NadleLiveGame`, `GameRound`, `GameResult`, `UserStreamerStats` | `/nadle-ws` | Twitch IRC ingest + chat throttle |
| Nadraw Show | production | `features/nadraw-show/*` | `apps/server/src/nadraw-show/*` | `Streamer`, `NadrawLiveRoom`, `NadrawPrompt` | `/nadraw-show-ws` | crowdsourced prompts via `!add` |
| Checkers | production | `features/checkers/*`, `pages/CheckersPage.vue` | `apps/server/src/checkers/*`, ELO in `leaderboardRouter.ts` | `CheckersLiveRoom`, `GameRound`, `GameResult` | `/checkers-ws` + REST `/api/matchmaking/*` | server-authoritative result + revision idempotency |
| Durak | **planned only** | "coming soon" card on HomePage; no route | none | none | none | confirm in product plan |
| Economy / Coin Hub | production | `pages/CoinHubPage.vue`, `stores/coinHub`, `components/coinhub/*`, `features/economy/*` | `coinHub/*`, `economy/*` (router, claims, cases, ledger, predictions, perks, wallet, earn, analytics, streamer, admin) | `CoinBalance`, `CoinTransaction`, `Pending`, `PendingReward`, `XpBalance`, `XpTransaction`, `CaseCatalog`, `CaseReward`, `UserCaseInventory`, `UserPity`, `CaseOpening`, `CoinCase`, `Claim`, `Spin`, `Prediction`, `PredictionOption`, `PredictionEntry`, `StreamerEconomySettings`, `Badge`, `UserBadge`, `Cosmetic`, `UserCosmetic`, `EquippedCosmetic` | – | Serializable everywhere; idempotency keys; **`coin-hub` route is unauth-gated (P2)** |
| Billing / Pro | production | `pages/BillingPage.vue`, `services/billingApi`, `composables/useBilling*`, `composables/useProSubscription`, `composables/useJarBillingFlow` | `billing/*` | `Subscription`, `PaymentRequest`, `MonoTransaction`, `MonoWebhookInbox` | – | Mono webhook secret fail-closed in prod; **inbox lacks retry loop (BE-M4)** |
| Auth / OAuth / email | production | `composables/useAuth`, `pages/AuthPage`, `pages/VerifyEmailPage` | `auth/*` (Twitch, Google, Apple-stub, email) | `User`, `EmailVerificationToken`, `PasswordResetToken`, `StreamerMember` | – | Apple OAuth returns "not implemented" today |
| Admin | production | `admin/*` (8 sub-pages) | `adminRouter.ts`, `billing/billingAdminRouter.ts`, `economy/admin/*`, `diagnosticsAdminRouter.ts` | `User`, `Streamer`, `AdminAuditLog`, `UserActivityEvent`, `ClientErrorEvent`, etc. | – | admin gate centralized via `isSessionAdminFromCookie` |
| Streamer profile / role | production | `useNadleStreamerRoom`, `nadle/`, `nadraw-show/access` | `nadle/streamerApiRouter`, `auth/persistOAuthUser` (follower threshold gating), `economy/streamerOwnership` | `Streamer`, `StreamerMember` | – | Twitch login auto-creates Streamer only above follower threshold |
| OBS / viewer overlays | production | `?mode=view` branch of Mafia/Game-Template/Eat First; `useMediaStallRecovery.isOperatingAsObsViewSource` | – | – | shares the per-game WS endpoints | rate-limited via per-socket buckets |
| Landing / SEO / public marketing | partial (huge file) | `LandingPage.vue` (3800 LOC), `figma-video-landing/` (separate folder) | – | – | – | three SEO slug routes redirect to `/<slug>/index.html` static files |
| Diagnostics / observability | production | `diagnostics/*`, `MediaDiagnosticsPanel.vue`, `AdminDiagnostics.vue`, `useDiagnostics` | `signaling/roomDiagnosticsBus`, `roomDiagnosticsReport`, `roomDiagnosticsPersistence`, `clientEventsRouter` | `RoomDiagnosticReport`, `UserActivityEvent`, `ClientErrorEvent` | – | drained on SIGTERM |
| Twitch IRC ingest | production | – | `nadle/tmiChat.ts`, `nadraw-show/nadrawTwitchIngest` | – | – | chat reward + nadle guesses; throttled |
| Chat rewards | production | – | `economy/earn/chatRewardService` | `PendingReward` | – | idempotency `chat:streamer:user:day:N`; per-process counter; SY-2 from pass 1 |

**Hidden / experimental:**

- `Durak` — landing card only, **no implementation**, opens coming-soon modal.
- Generic "Economy" coming-soon card on home opens a `comingSoon` modal, but `/app/coin-hub` IS implemented. **Conflicting messaging** to viewers — they see a "coming soon" pitch on the home page while the route is live (and reachable from header chrome). Confirm with product. (Q-Pass2-B)
- `Apple` OAuth endpoint at `/api/auth/apple` returns "not implemented" — wired but unsupported. (`auth/oauthRouter.ts:282`)
- `clientNextWord` (Nadle WS) lets any logged-in user create a fresh `player.game` keyed under any streamerId (BE-M2 from pass 1 expanded).

### B.3 API coverage

REST endpoints catalogued from `apps/server/src/**`. Mount sites identified via `mountX(app)` calls in `apps/server/src/index.ts:305-322`.

| Group | Method · Path | Auth | Role / ownership | Rate-limited | Idempotency | Notes |
|------:|---------------|------|-------------------|--------------|-------------|-------|
| auth | `GET /api/auth/me` | optional | – | – | – | session info |
| auth | `POST /api/auth/logout` | optional | – | yes (oauthLogoutRateLimit) | – | clears `nadle_session` cookie |
| auth | `POST /api/auth/register` | – | – | yes (per-email + per-IP via XFF — **SEC-2 bypass risk**) | email→DB unique | email-password |
| auth | `POST /api/auth/login` | – | – | yes (per-email + per-IP **SEC-2 bypass**) | – | |
| auth | `POST /api/auth/email-verification/send` | required | – | yes | – | |
| auth | `GET /api/auth/email-verification/verify?token=` | – | – | yes | one-shot token | |
| auth | `POST /api/auth/password-reset/send` | – | – | yes (per-IP **SEC-2 bypass**) | – | |
| auth | `POST /api/auth/password-reset/confirm` | – | – | yes | one-shot token | |
| auth | `GET /api/auth/twitch` | – | – | oauthRateLimit | OAuth state | redirect to Twitch authorize |
| auth | `GET /api/auth/twitch/callback` | – | – | oauthRateLimit | state replay rejection | |
| auth | `GET /api/auth/google` | – | – | oauthRateLimit | – | |
| auth | `GET /api/auth/google/callback` | – | – | oauthRateLimit | state replay rejection | **SEC-5 email collision DoS** unchanged |
| auth | `GET /api/auth/apple` | – | – | – | – | returns "not implemented" |
| auth | `GET /api/me` (legacy) | optional | – | – | – | same as `/api/auth/me` |
| admin | `GET /api/admin/users` | required | admin | – | – | DB scan, no pagination cap shown |
| admin | `GET /api/admin/users/:userId/activity` | required | admin | **no rate limit (SEC-7)** | – | runs 5 parallel Prisma queries |
| admin | `PATCH /api/admin/users/:userId/role` | required | admin | adminMutationRateLimit | – | role mutation + audit log |
| admin | `GET /api/admin/stats` | required | admin | – | – | aggregates |
| admin | `GET /api/admin/analytics/anonymous` | required | admin | – | – | UserActivityEvent rollup |
| admin | `GET /api/admin/streamers` | required | admin | – | – | – |
| admin | `POST /api/admin/streamers` | required | admin | adminMutationRateLimit | – | create streamer row |
| admin | `DELETE /api/admin/streamers/:id` | required | admin | adminMutationRateLimit | – | soft delete (sets isActive:false) |
| admin | `GET /api/admin/rooms/:roomId/diagnostics` | required | admin | – | – | live in-memory snapshot |
| admin diag | `GET /api/admin/diagnostics/reports` | required | admin | diagnosticsAdminRateLimit | – | list finalized reports |
| admin diag | `GET /api/admin/diagnostics/reports/:id` | required | admin | yes | – | |
| admin diag | `GET /api/admin/diagnostics/reports/:id/download` | required | admin | yes | – | attachment download |
| billing | `GET /api/billing/config` | required | – | – | – | gated behind auth (SEC-9 noted, dropped) |
| billing | `POST /api/billing/jar/create-payment-request` | required | – | billingUserMutationRateLimit | reuse open intent | |
| billing | `POST /api/billing/jar/mark-paid` | required | own intent | yes | DB updateMany guard | **BE-M5 race w/ webhook** |
| billing | `GET /api/billing/jar/payment-request/:id` | required | own intent | – | – | |
| billing | `POST /api/billing/billing-email` | required | – | yes | – | |
| billing | `GET /api/billing/subscription/me` | required | – | – | – | |
| billing | `GET /api/billing/mono-personal/webhook` | – | secret | – | – | health ping |
| billing | `POST /api/billing/mono-personal/webhook` | – | **URL-token secret only** | – | inbox row + matcher | **SEC-6**; **BE-M4 no retry loop** |
| billing admin | `GET /api/admin/billing/payment-requests` | required | admin | – | – | |
| billing admin | `POST /api/admin/billing/payment-requests/:id/approve` | required | admin | billingAdminMutationRateLimit | – | |
| billing admin | `POST /api/admin/billing/payment-requests/:id/reject` | required | admin | yes | – | |
| billing admin | `GET /api/admin/billing/subscriptions` | required | admin | – | – | |
| billing admin | `POST /api/admin/billing/poll-mono` | required | admin | yes | – | manual matcher kick |
| billing admin | `POST /api/admin/billing/subscriptions/:id/cancel` | required | admin | yes | single-flight email | |
| coin hub | `GET /api/coinhub` | required | – | – | – | balances + spin + cases snapshot |
| coin hub | `POST /api/coinhub/claim` | required | – | rate limited | per-Pending unique | |
| coin hub | `POST /api/coinhub/spin` | required | – | yes | cooldown-gated | |
| coin hub | `POST /api/coinhub/case/open` | required | – | yes | per-case state machine | legacy hub cases (`luck-*`, `free`, `subscriber`) |
| economy | `GET /api/economy/wallet/me` | required | – | walletReadLimiter | – | snapshot |
| economy | `POST /api/economy/claims/all` | required | – | claimAllLimiter | Serializable; per-PendingReward consume | |
| economy | `POST /api/economy/claims/by-id` | required | own | claimByIdLimiter | yes | |
| economy | `GET /api/economy/transactions` | required | own | txHistoryLimiter | – | cursor-based |
| economy | `GET /api/economy/cases/catalog` | required | – | catalogReadLimiter | – | active catalog |
| economy | `POST /api/economy/cases/:slug/open` | required | – | caseOpenLimiter | per-open ledger row | weighted roll + pity |
| economy | `POST /api/economy/claims/daily` | required | – | dailyLimiter | UTC-day idempotency key | |
| economy admin | `POST /api/admin/economy/users/:userId/grant` | required | admin | adminEconomyRateLimit | – | **SEC-16 no upper bound** |
| economy admin | `POST /api/admin/economy/users/:userId/revoke` | required | admin | yes | – | |
| economy admin | `GET /api/admin/economy/predictions` | required | admin | – | – | |
| economy admin | `GET /api/admin/economy/users/:userId/history` | required | admin | – | – | |
| economy pred | `GET /api/economy/predictions?streamerId=` | required | – | readLimiter | – | public read across streamers |
| economy pred | `POST /api/economy/predictions` | required | streamer owner | createLimiter | – | Serializable |
| economy pred | `POST /api/economy/predictions/:id/join` | required | – | joinLimiter | unique `(predictionId,userId)` | |
| economy pred | `POST /api/economy/predictions/:id/lock` | required | streamer owner | resolveLimiter | – | |
| economy pred | `POST /api/economy/predictions/:id/resolve` | required | streamer owner | yes | – | |
| economy pred | `POST /api/economy/predictions/:id/cancel` | required | streamer owner | yes | – | |
| economy streamer | `GET /api/economy/streamer/summary?streamerId=` | required | streamer owner | – | – | |
| economy streamer | `GET /api/economy/streamer/settings?streamerId=` | required | streamer owner | – | – | |
| economy streamer | `PATCH /api/economy/streamer/settings?streamerId=` | required | streamer owner | – | – | **SEC-23 unclamped numerics** (already noted) |
| leaderboard | `POST /api/wins` | – | – | – | returns 410 | hardened pass 1 |
| leaderboard | `GET /api/leaderboard/wins` | – | – | – | 5s read cache | streamer or `game=checkers` |
| leaderboard | `GET /api/leaderboard/streak` | optional | – | – | yes | also returns viewerMaxStreak when authed |
| leaderboard | `GET /api/leaderboard/rating` | – | – | – | yes | ELO snapshot |
| nadle | `GET /api/streamer/:username` | – | – | – | – | resolve slug |
| nadle | `GET /api/nadle/public-config` | – | – | – | – | client_id |
| nadle | `GET /api/nadle/me` | optional | – | – | – | nadle session |
| nadle | `POST /api/nadle/logout` | – | – | nadleLogoutRateLimit | – | |
| nadraw | `GET /api/nadraw-show/prompts?streamer=` | – | – | – | – | crowdsourced list (approved + own) |
| nadraw | `PATCH /api/nadraw-show/prompts/:id` | required | streamer owner | nadrawMutationRateLimit | – | host approval |
| nadraw | `DELETE /api/nadraw-show/prompts/:id` | required | streamer owner | yes | – | |
| eat-first | `GET /api/eat-first/games/:gameId/snapshot` | optional | – | – | – | viewer-mode-aware |
| eat-first | `POST /api/eat-first/games/:gameId/ensure` | optional | – | eatFirstMutationRateLimit | – | **public-creates-row** |
| eat-first | `PATCH /api/eat-first/games/:gameId/room` | required | host | yes | – | |
| eat-first | `POST /api/eat-first/games/:gameId/hand` | – | slot creds | yes | – | viewer-public |
| eat-first | `POST /api/eat-first/games/:gameId/ready` | – | slot creds | yes | – | |
| eat-first | `POST /api/eat-first/games/:gameId/players/:slotId/claim` | – | deviceId | yes | – | issues joinToken |
| eat-first | `PATCH /api/eat-first/games/:gameId/players/:slotId` | – | slot creds | yes | – | |
| eat-first | `DELETE /api/eat-first/games/:gameId/players/:slotId` | – | slot creds | yes | – | |
| eat-first | `POST /api/eat-first/games/:gameId/votes/submit` | – | slot creds | yes | – | |
| eat-first | `POST /api/eat-first/games/:gameId/votes/clear` | – | slot creds | yes | – | |
| eat-first | `POST /api/eat-first/games/:gameId/votes/delete` | – | slot creds | yes | – | |
| eat-first | `POST /api/eat-first/games/:gameId/players/revive-eliminated` | required | host | yes | – | |
| eat-first | `POST /api/eat-first/games/:gameId/host-reshuffle` | required | host | yes | – | |
| matchmaking | `POST /api/matchmaking/join` | optional | – | matchmakingMutationRateLimit | – | long-poll wait |
| matchmaking | `POST /api/matchmaking/leave` | – | – | yes | – | |
| matchmaking | `POST /api/matchmaking/result` | required | submitter ∈ pair | yes | revision + `recordedResultKeys` | server-authoritative |
| events | `POST /api/events/client` | optional | – | per-IP+path bucket | – | allow-listed events only |
| events | `POST /api/events/room` | – | – | yes | – | diagnostics batch |
| events | `POST /api/events/error` | optional | – | yes | – | error events |
| health | `GET /health` | – | – | – | – | bypasses access log |

**Coverage observations:**

- The `/api` no-cache middleware at `index.ts:115` correctly sets `Cache-Control: no-store` for ALL `/api/*`. Webhook endpoint exempt because it returns 200 quickly anyway. Good.
- Every mutation endpoint that requires auth runs `resolvePrismaUserIdFromSession`. The 401 path is structurally identical across routers. Good consistency.
- **Eat First REST endpoints** are the loosest authority surface: most player actions accept `(joinToken, deviceId)` per row — anyone with the credentials can act. This is the documented public-viewer model. The host-only routes (`room`, `revive-eliminated`, `host-reshuffle`) DO require auth + streamer ownership check.
- The 12 `eat-first` routes are protected by ONE `eatFirstMutationRateLimit` middleware (240 mutations/min/IP).
- The newer `/api/economy/cases/*` and legacy `/api/coinhub/case/open` both exist — the new path is used for catalog cases, the legacy for static hub cases. **Two paths, two state machines, partially overlapping.** Worth surfacing for product consolidation.

### B.4 WS coverage

#### B.4.1 WS endpoint map

| Endpoint | Server file | Server schema | Client sender | Heartbeat | Origin allowlist |
|---|---|---|---|---|---|
| `/ws` (+ `/`) | `signaling/socketServer.ts`, `signaling/messageHandlers.ts` (5070 LOC) | `signaling/clientMessageSchema.ts` (Zod) | `useRoomConnection.ts`, `useMafiaHostSignaling.ts`, `useGameRoomHostSignaling.ts`, `useEatFirstCallSignaling.ts` | WS-frame ping 45s + JSON ping 25s | yes |
| `/eat-first-ws` | `eatFirst/broadcast.ts` | inline `JSON.parse + type check` | `eat-first/services/eatFirstSync.js` (implied) | WS-frame heartbeat | yes |
| `/nadle-ws` | `nadle/nadleSocket.ts` | inline parser via `NadleWs` constants | `nadle/ws/useNadleWs.ts` | inline ping/pong + safeSend | yes |
| `/nadraw-show-ws` | `nadraw-show/nadrawSocket.ts` | inline parser via `NadrawWs` constants | `features/nadraw-show/orchestrator/useNadrawShowOrchestrator.ts` | safeSend ping | yes |
| `/checkers-ws` | `checkers/checkersSocket.ts` | inline parser via `CheckersWs` constants | `features/checkers/ws/checkersWs.ts` | safeSend ping | yes |

#### B.4.2 `/ws` message types (Zod-validated)

**Generic / call signaling (client → server):**
- `client-ping`, `pong`
- `join-room`, `update-display-name`
- `create-transport`, `connect-transport`, `produce`, `producer-video-source`, `set-outbound-video-paused`, `set-audio-muted`, `consume`, `set-consumer-preferred-layers`, `set-consumer-paused`
- `call-chat`, `raise-hand`, `set-camera-mirror`, `request-producer-sync`

**Server-emitted:**
- `room-state`, `peer-joined`, `peer-display-name`, `peer-left`, `peer-audio-muted`, `peer-camera-mirror`, `transport-created`, `transport-connected`, `produced`, `new-producer`, `producer-closed`, `producer-video-source-changed`, `peer-outbound-video-paused`, `consumed`, `producer-sync`, `consume-failed`, `active-speaker`, `server-pong`, `signaling-auth`, `error`, `rate-limited`, `ping`

**Mafia (`mafia:*`) — 26 types total:**
- Client→server: `claim-host`, `transfer-host` (legacy single-phase), `transfer-host-offer`, `transfer-host-accept`, `transfer-host-reject`, `queue-update`, `reshuffle`, `players-update`, `player-name-update`, `mode-update`, `settings-update`, `page-background-settings`, `audio-mix-update`, `timer-start`, `timer-stop`, `timer-preset-select`, `player-kick`, `player-revive`, `force-camera-off`, `force-mute-all`, `request-snapshot`
- Server→client: `host-updated`, `transfer-host-pending`, `transfer-host-result`, `player-nickname-update`, `player-life-state`, `force-peer-mic`

**GameRoom (`gameroom:*`) — 19 types (no transfer-host consent flow, no mode/settings/page-bg/role/nightActions):**
- Client→server: `claim-host`, `transfer-host` (single-phase, **BE-M1**), `queue-update`, `reshuffle`, `players-update`, `player-name-update`, `audio-mix-update`, `timer-start/stop/preset-select`, `player-kick`, `player-revive`, `force-camera-off`, `force-mute-all`, `request-snapshot`
- Server→client: `host-updated`, `player-nickname-update`, `player-life-state`, `force-peer-mic`

**Eat First (`eat:*`) — 23 types:**
- Client→server: `force-mute-all`, `audio-mix-update`, `page-background-settings`, `slot-claim`, `trait-reveal-request`, `trait-regenerate-request`, `trait-type-reroll-request`, `action-card-reroll-request`, `action-card-use`, `players-update`, `speaking-queue-update`, `table-round-deal`, `timer-start/stop/preset-select`, `reshuffle-cameras`
- Server→client: `host-updated`, `trait-revealed`, `trait-regenerated`, `trait-type-rerolled`, `action-card-rerolled`, `action-card-used`, `trait-state-sync`, `table-state-sync`

#### B.4.3 Per-game-WS messages

- `/nadle-ws` `NadleWs`: 11 types: `state`, `leaderboard`, `userGuess`, `newGame`, `twitchChat`, `ircStatus`, `session`, `error`, `guessRejected`, `clientGuess`, `clientNextWord`.
- `/nadraw-show-ws` `NadrawWs`: 14 types: `state`, `session`, `twitchChat`, `guessFeedback`, `history`, `draw`, `canvasClear`, `error`, `ping`, host actions (`startRound`, `ackNextRound`, `clearRound`, `clearCanvas`, `draw`).
- `/checkers-ws` `CheckersWs`: 11 types: `join`, `move`, `restart`, `setMode`, `ready`, `identity`, `timeout`, `rematch`, `state`, `update`, `error`.
- `/eat-first-ws`: ONE inbound type: `subscribe { gameId }`; outbound: `eat-first:init`, `eat-first:update`.

#### B.4.4 WS gaps and concerns

- **`wsProtocolDuplication.test.ts` does NOT cover `GameRoomWs` or `EatFirstWs`.** The test file at `packages/client-consistency/wsProtocolDuplication.test.ts:20-26` imports MafiaWs / NadleWs / NadrawWs server-client mirror pairs and asserts `toEqual`. The two newer protocols (GameRoom in Phase 3B, EatFirst constants extracted in audit #44) are absent — CI lets them drift without test failure. (Pass2-F1)
- **Game-room transfer-host consent flow missing on protocol level** (already in pass 1 as BE-M1). The client mirror in `gameRoomWsProtocol.ts` does not declare `transferHostOffer/Pending/Accept/Reject/Result`. Verified.
- **Mafia and GameRoom share Room.ts state.** A `gameroom:*` message lands in the same `Room` instance that may also have Mafia state. The room id prefix (`mafia:*` vs `gameroom:*`) gates which fields the handler touches. **Mixed-prefix room ids are not possible** because `roomId` enters via `join-room` and is normalized once, but worth a contract test that asserts a Mafia-prefixed room cannot accept `gameroom:*` mutations and vice versa.
- **No unhandled-message reporting at the namespace level.** A `mafia:foo` that's not in the schema is silently dropped (1/100 sampled diagnostic). Acceptable; not a finding.
- The `?streamerId=` query on `/nadle-ws` and `/nadraw-show-ws` is **not validated against the DB at upgrade time.** Memory grows per distinct slug (BE-M2 from pass 1, re-confirmed).

### B.5 DB / economy coverage

DB models extracted from `apps/server/prisma/schema.prisma`:

**Auth / session:**
- `User` (provider+id unique; email unique optional; role; twitchId; streamerId)
- `Streamer` (twitch-tied; follower thresholded; `ownerId`; `isActive`)
- `StreamerMember` (OWNER role unique per user/streamer)
- `EmailVerificationToken`, `PasswordResetToken` (tokenHash unique, expiresAt, usedAt)
- `AdminAuditLog`

**Diagnostics / activity:**
- `UserActivityEvent`, `ClientErrorEvent`, `RoomDiagnosticReport`, `MonoWebhookInbox`

**Economy / ledger:**
- `CoinBalance` (singleton per user; amount ≥ 0)
- `CoinTransaction` (append-only; idempotencyKey unique; balanceBefore/After invariants)
- `XpBalance`, `XpTransaction` (parallel of coin)
- `Pending` (legacy flat counter); `PendingReward` (typed unclaimed grants; idempotencyKey unique; expiry; claimedAt/lostAt)
- `Spin` (one-row-per-user; nextAvailableAt + lastReward)
- `Claim` (audit row per claimAll/byId)
- `CaseCatalog`, `CaseReward`, `UserCaseInventory`, `UserPity`, `CaseOpening`
- `CoinCase` (legacy hub cases — six fixed)
- `Prediction`, `PredictionOption`, `PredictionEntry` (unique `(predictionId,userId)`; payoutPendingRewardId unique; refund single-flight)
- `StreamerEconomySettings` (per-streamer toggles + caps)
- `Badge`, `UserBadge`, `Cosmetic`, `UserCosmetic`, `EquippedCosmetic`
- `Subscription` (Pro; one per user; cancelledEmailSentAt / expiredEmailSentAt single-flight)
- `PaymentRequest` (internalReference unique; matchedTransactionId unique; status state machine)
- `MonoTransaction` (monoTransactionId unique = idempotency)

**Game state:**
- `GameRound`, `GameResult` (universal — used by Nadle, Checkers, Eat First-adjacent reporting)
- `UserStreamerStats` (Nadle-style per-stream tallies)
- `UserStats` (legacy global; coins live in ledger now)
- `MafiaRoomOwner`, `GameRoomOwner` (TTL-stamped owner persistence)
- `EatFirstGame`, `EatFirstPlayer`, `EatFirstVote`
- `NadleLiveGame`, `CheckersLiveRoom`, `NadrawLiveRoom`
- `NadrawPrompt`

**Strong invariants in this schema:**
- Every coin-amount mutation goes through `walletService.applyDelta` and writes one `CoinTransaction` row in the same Serializable txn.
- `sum(CoinTransaction.delta where userId = X) == CoinBalance.amount` for every user.
- `PendingReward.idempotencyKey` is `@unique`, so retries of an earn event cannot create duplicates.
- `MonoTransaction.monoTransactionId @unique` and `PaymentRequest.matchedTransactionId @unique` mean a webhook replay or an admin double-approve cannot activate twice.

**Schema observations:**
- `CoinTransaction.delta` is `Int` (32-bit). A grant of `Number.MAX_SAFE_INTEGER` (2^53) would overflow at the Prisma serializer layer and likely throw. SEC-16 (admin grants unclamped) is bounded by Int32, but the resulting balance still cannot exceed Int32 max (~2.1 billion coins). Worth a Question.
- `Pending` and `PendingReward` both exist (the legacy flat counter is read by `claimPending` alongside the typed table). New code should only write `PendingReward`. Migration debt is documented in the schema comment but not enforced.
- `UserStats` is legacy and partially shadowed by ledger; confirm it is still read by anything. (Pass2-Q-DB1)
- `NadleLiveGame.state`, `NadrawLiveRoom.state`, `CheckersLiveRoom.state` are `Json` — no shape contract at the DB level. The shape is whatever the per-domain service writes. Acceptable for snapshot tables.

### B.6 Test coverage

| Package | Test files | Notes |
|---------|-----------:|-------|
| `packages/call-core/__tests__` | 22 (incl. 1 helper `mockCallState.ts`) | adaptiveVideoPreferredLayers, callFlow, callStateFlow, consumeLifecycleManager, displayCaptureVideoTrack, inferSignalingWsUrlFromApiBase, normalizeDisplayName, outboundCameraTrack, participantsMapper, preferredVideoInputDevice, previewStream, receiveDeviceProfile, receiverBaselineLayerPolicy, receiveVideoQualityPressure, reconnectOrchestrationPolicy, recoveryCoordinator, recvApplySerialQueue, resolvePeerDisplayName, screenShareConstraints, useLocalMediaToggleCam, videoFpsPressure. **All pure logic; no mediasoup integration.** |
| `packages/call-core-consistency` | 8 | call-tab-peer-id, client-message-schema, grid-tier, json-ws-ping, media-codecs, video-quality-preset, video-simulcast, wait-for-condition |
| `packages/client-consistency` | 42 | Mafia behavior, Eat First, Coin Hub math, Game-Template wiring, Checkers engine, transfer-host consent protocol, mafiaGameRoomOwnerStore, callTileOrdering, callTileHoverLayering, gameTimerCompute, monoWebhookInboxErrorFormat, safe-oauth-redirect, storage-json, **wsProtocolDuplication (Mafia/Nadle/Nadraw only)**, streamVideoMemoDeps, participantTileBooleanFallback, … |
| `packages/eat-first-consistency` | 13 | route-utils, theme, callable-api, host-action-emit, player-order, swap-wiring, speaking-controller, timer-strip, timer-preset-select, gender-display, seo |
| `packages/nadle-consistency` | 1 | nadle-logic |
| `apps/server` | **0 first-class** | server has no test script |

**Coverage gaps with highest expected value:**
1. **`apps/server/**` integration tests.** Auth flows (Twitch follower threshold, Google email collision, email-verify token TTL), billing matcher (mark-paid race vs webhook), economy ledger invariants, admin role mutation audit log shape. Today these are pure-logic-tested only.
2. **`GameRoomWs` and `EatFirstWs` cross-boundary parity** (extend `wsProtocolDuplication.test.ts`).
3. **CallPage ↔ GameTemplateCallPage parity test** asserting the two pages bind the same `<ParticipantTile>` event surface (would have caught FE-C1 from pass 1).
4. **Reconnect/visibility/focus matrix tests for `reconnectOrchestrationPolicy`** are present, but no equivalent for the engine's `online`-rearm path (`useCallEngine.ts:1625-1634`).
5. **Mafia / Game-Template / Eat First WS contract tests against `clientMessageSchema`** for every payload shape. Today the schema is the only contract; a regression there is only caught by runtime drift.
6. **`getClientIp` (SEC-2)** — a single unit test that asserts `getClientIp` honors `req.ip` (not raw XFF) would lock the fix in once landed.
7. **`gameTemplateGame.ts` NUL-byte detector** — once the file is cleaned, add a CI grep step.

---

## C. Findings (pass 2)

Severity prefix scheme: `P2-` for pass 2 originals; `P1-` re-confirms pass 1 with new evidence.

### Critical

None new. Pass 1's "no Critical" verdict holds.

### Major

---

**Finding ID:** P2-1
**Severity:** Major (data integrity / source hygiene)
**Area:** Client store fork — binary corruption
**Files:** `apps/client/src/stores/gameTemplateGame.ts` (5 NUL bytes), `apps/client/src/stores/gameTemplatePlayers.ts` (2 NUL bytes)
**Evidence:**
- `tr -cd '\0' < apps/client/src/stores/gameTemplateGame.ts | wc -c` → `5`
- `tr -cd '\0' < apps/client/src/stores/gameTemplatePlayers.ts | wc -c` → `2`
- `tr -cd '\0' < apps/client/src/stores/mafiaGame.ts | wc -c` → `0`
- Byte-position scan locates each NUL at column 66 of line 197 (`numberingKey = computed(() => numberingOrder.value.join(' '))`), columns 20 and 55 of line 209 (`if (next.join(' ') !== numberingOrder.value.join(' '))`), columns 32 and 47 of lines 248–249 (`nextKey = next.join(' ')`; `curKey = numberingOrder.value.join(' ')`).
- Same pattern in `gameTemplatePlayers.ts` at lines 44/45.
- The Read tool displays these as ASCII space `' '`, but the on-disk byte is `0x00`. They survive `vue-tsc` (NUL is a legal string codepoint), but they break `grep -rn "'foo'"` style searches that don't anticipate them and corrupt some IDE / git-diff renderers.
**What is wrong:** The fork tooling that produced `gameTemplate*` from `mafia*` inserted NUL bytes wherever a literal `' '` (ASCII space inside single quotes) appeared. The strings produced by `.join('\0')` are then used as comparison keys (`nextKey === curKey`). The keys are unique per ordering tuple, so equality semantics are preserved — but the strings are no longer printable space-separated tokens.
**Why it matters:**
- TypeScript-source files should never contain NUL bytes. Most lint/format tooling treats them as binary corruption.
- Any future inspection (debug logs, console.log of these keys, error reporting that snapshots state) will show garbled output.
- Indicates the fork was not produced by a clean copy/edit pass; raises confidence concerns for the entire `gameTemplate*` set.
**Flow affected:** GameTemplate numbering / order key comparison (`pinHostPeerToEnd`, `reconcileNumberingWithEngine`); GameTemplate players store's `joinOrder` change detection.
**Root cause:** Suspected: the fork was done by a tool (or copy/paste through a clipboard layer) that interprets U+2002/U+2003/`&nbsp;` or similar as `\0`. Or a regex substitution that consumed the inner space character and left it empty.
**Confirmed / needs runtime verification?** **Confirmed via byte-level scan.** Runtime impact (whether the production build emits them, whether eslint / vue-tsc / vite refuse to compile) **needs runtime verification.**
**Minimal future fix direction:** Replace `'\0'` with `' '` (a real space) on the five offending lines of `gameTemplateGame.ts` and the two of `gameTemplatePlayers.ts`. Behavior identical (the strings stay unique). Then add a CI grep step: `! grep -rl $'\x00' apps/client/src apps/server/src packages` to lock the fix.
**What can break if fixed:** Nothing. Comparison strings shift from `"a\0b\0c"` to `"a b c"` — equality continues to hold.
**Recommended branch:** `fix/game-template-store-nul-bytes`
**Recommended worktree slot:** `sa-fix`
**QA:** Build the client (`npm run build -w client`) before and after; diff `dist/assets/*.js` to confirm only the expected bytes changed.
**Priority:** P1 (small fix, high confidence-restoration value).

---

**Finding ID:** P2-2
**Severity:** Major (test-coverage gap)
**Area:** WS protocol cross-boundary parity
**Files:** `packages/client-consistency/wsProtocolDuplication.test.ts`
**Evidence:** Imports Mafia/Nadle/Nadraw client+server constant pairs (lines 20-26). No imports of `GameRoomWs` (`apps/server/src/signaling/gameRoomWsProtocol.ts` ↔ `apps/client/src/composables/gameRoomWsProtocol.ts`) or `EatFirstWs` (`apps/server/src/signaling/eatFirstWsProtocol.ts` ↔ `apps/client/src/eat-first/eatFirstWsProtocol.ts`).
**What is wrong:** A future rename or addition on one side of GameRoom or EatFirst protocols will not be caught by CI.
**Why it matters:** Silent contract drift is the exact failure mode this test was written to prevent. The two newest protocols are the most likely to drift.
**Flow affected:** GameTemplate host UI, Eat First overlay/host UI.
**Root cause:** Test added before GameRoom (Phase 3B) and the EatFirst protocol-constants extraction (audit #44).
**Confirmed:** Yes (by reading the test).
**Minimal future fix direction:** Add two `it(...)` blocks importing the four constant tables and asserting `toEqual`.
**What can break if fixed:** Nothing — adding a test is additive.
**Recommended branch:** `test/ws-protocol-parity-gameroom-eatfirst`
**Recommended worktree slot:** `sa-fix`
**QA:** `npm run test:client`.
**Priority:** P2.

---

**Finding ID:** P2-3
**Severity:** Major (UX inconsistency / product-messaging drift)
**Area:** Home page vs Coin Hub
**Files:** `apps/client/src/pages/HomePage.vue:62, 139-154, 231`; `apps/client/src/pages/CoinHubPage.vue` (581 LOC, fully implemented); `apps/client/src/router.ts:180-184`
**Evidence:**
- The home page displays an **"Economy coming soon"** modal entry when the Economy section is clicked (`economyComingSoonRoute = { name: 'home', query: { comingSoon: 'economy' } }`).
- The `coin-hub` route is fully implemented and lists balance, claims, spin, cases, transactions.
- The header-chrome separately exposes the Coin Hub link (per `AppShellLayout.vue:84` reading `coinHub.balance`).
- A user opening the home page sees "Economy is coming soon"; a user opening the chrome dropdown lands directly inside the live Coin Hub.
**What is wrong:** Two contradictory product messages to the same user. Either Coin Hub is in soft-launch and the home card should also link to it, or the Coin Hub is admin/staff-only and shouldn't be exposed in chrome.
**Why it matters:** Conversion / trust UX. Streamers and viewers cannot tell whether the economy is live.
**Flow affected:** First-time logged-in viewer, returning user, streamer.
**Root cause:** Product copy lags the runtime state.
**Confirmed:** Yes.
**Minimal future fix direction:** Either make the home card link directly to `/app/coin-hub`, or hide the chrome entry. This is a product decision, not an engineering one.
**Recommended branch:** `docs/economy-product-state-clarification` (no code change until decision made)
**Priority:** P2.

---

**Finding ID:** P2-4
**Severity:** Major (auth / public surface)
**Area:** `/app/eat-first/games/:gameId/ensure` public-creates-row
**Files:** `apps/server/src/eatFirst/router.ts:138-155`
**Evidence:** `app.post('${base}/games/:gameId/ensure', …)` calls `resolveEatFirstEnsureOwnerUserId(req.headers.cookie)` (optional auth) and then `eatFirstEnsureGame(gameId, ownerUserId)`. If no session, the row is created with `ownerUserId = null` / undefined; if session, the caller becomes the owner.
**What is wrong:** Any IP can create an `EatFirstGame` row at any `gameId` it picks. Bounded by the 240-mutations/min/IP rate limit (so 240 rows/IP/min worst case). DB has no per-IP cap, no per-user cap, no daily cap.
**Why it matters:** A bored or hostile actor can populate the `EatFirstGame` table with arbitrary gameIds. Each row is tiny but cumulative; no automated cleanup is documented.
**Exploit scenario:** scripted attacker fills `EatFirstGame` with millions of rows over weeks until table size impacts Postgres performance.
**Flow affected:** Eat First room creation.
**Root cause:** Intentional public-friendly UX for OBS streamers without an account.
**Confirmed:** Yes.
**Minimal future fix direction:** Either require auth on `ensure` (small breaking change for anonymous overlays — confirm product intent first), or add a daily cap of ~50 ensure-creations/IP and a sweep that deletes rows with no associated players older than 24h.
**Recommended branch:** `fix/eat-first-ensure-anon-cap` (after product decision)
**Priority:** P2.

---

**Finding ID:** P2-5
**Severity:** Major (UX / product completeness)
**Area:** Game Template visibility
**Files:** `apps/client/src/pages/HomePage.vue:79-137` (game-cards array); `apps/client/src/router.ts:127-149` (game-template route)
**Evidence:** Game Template is a fully wired route with a forked page (1701 LOC) and its own Pinia stores, but **does not appear in the home page games grid**. Mafia / Eat First / Nadle / Nadraw / Checkers / Durak-coming-soon are listed; Game Template is absent.
**What is wrong:** Either (a) Game Template is internal-only and the route should be hidden / admin-gated, or (b) the home page is missing a card.
**Why it matters:** A logged-in streamer who knows the URL can play; a logged-in streamer who doesn't, can't. Inconsistent surface visibility.
**Flow affected:** Streamer discovery of which games are available.
**Root cause:** Likely the de-Mafia-ification project is mid-Phase 5b and the page is not user-facing yet.
**Confirmed:** Yes (route + page exist; no card).
**Minimal future fix direction:** Product decision. If internal-only, change `requiresAdmin: true` (the page becomes admin-gated) or use a feature flag.
**Recommended branch:** `docs/game-template-visibility-decision`
**Priority:** P2.

---

**Finding ID:** P2-6
**Severity:** Major (auth / data leak surface)
**Area:** `/app/:streamer` legacy short URL
**Files:** `apps/client/src/router.ts:278-283`
**Evidence:** The last child of `/app/*` is a wildcard streamer slug that loads `NadleStreamPage.vue`. The route loader fires for any slug that is not a reserved word, regardless of whether the streamer exists.
**What is wrong:** No 404 surface. NadleStreamPage will fetch `/api/streamer/:username` which returns null for nonexistent streamers; the page then renders an empty state. Bookmarks for fictional streamers stay valid URLs.
**Why it matters:**
- Allows fishing for typos / case-sensitivity differences in streamer slugs to enumerate which exist.
- Pairs with BE-M2 from pass 1: each distinct slug a viewer connects to grows the per-streamer in-memory `players` map.
**Flow affected:** Anonymous viewer browsing.
**Confirmed:** Yes (route position + loader).
**Minimal future fix direction:** Either (a) validate slug against an active streamer in a route loader and redirect to home/404, or (b) accept the current behavior and document that bookmarkable typos are tolerated.
**Recommended branch:** `fix/legacy-streamer-shortcut-validation`
**Priority:** P2.

---

### Minor

| ID | File:line | Issue | Priority |
|----|-----------|-------|----------|
| P2-7 | `apps/client/src/composables/useBillingNotifications.ts:78`; `apps/client/src/composables/useAdminMode.ts:23`; plus 12 other files | Raw `localStorage`/`sessionStorage` access bypasses `apps/client/src/utils/storageJson.js` shared helper; 14 files total vs 5 using the helper | P3 |
| P2-8 | `apps/client/src/stores/mafiaGame.ts` (163 internal members) vs `gameTemplateGame.ts` (82) | After NUL fix, ~half the surface area is shared via the Phase 5a/5b extraction (`components/game-call/*`). Page-level fork remains (SY-1 in pass 1) | P2 |
| P2-9 | `apps/server/src/auth/oauthRouter.ts:282` | Apple OAuth endpoint returns "not implemented" but is exposed at `/api/auth/apple`. Either remove the route or implement | P3 |
| P2-10 | `apps/client/src/pages/HomePage.vue:115-127` | Durak game card is `comingSoon` only — confirm not user-visible as production | P3 |
| P2-11 | `apps/server/src/eatFirst/service.ts:239-244` | Slot auth `tok !== storedTok` is not constant-time. Random tokens make timing-attack impractical; flagged for completeness | P3 |
| P2-12 | `apps/server/src/economy/router/economyRouter.ts:271-288` (daily) vs `apps/server/src/coinHub/coinHubRouter.ts:79` (claim) | **Two parallel coin-credit paths**: new typed-pending claim (`/api/economy/claims/*`) and legacy flat-pending claim (`/api/coinhub/claim`). Both exist; both are documented to coexist; surface area is doubled for everything touching credit | P2 |
| P2-13 | `apps/server/src/leaderboardRouter.ts:175-292, 553-609` | Raw `$queryRaw` streak queries with no LIMIT; 5s cache helps but cold miss is unbounded scan over `GameResult ⋈ GameRound` (same as pass 1 BE-M6) | P3 |
| P2-14 | `apps/server/src/nadle/nadleSocket.ts:234-243, 290-345` | `?streamerId=` not validated; unbounded `players` map per slug (same as pass 1 BE-M2 — expanded with the route wildcard above) | P2 |
| P2-15 | `apps/server/src/economy/admin/adminEconomyRouter.ts:48-117` | Admin grant body accepts `coinAmount` / `xpAmount` with only `Math.max(0, Math.floor(...))` — no upper bound (SEC-16 from pass 1) | P3 |
| P2-16 | `apps/server/src/auth/session/sessionJwt.ts:78` | 7-day stateless JWT; no `sessionVersion` revocation; logout clears cookie only (SEC-13 from pass 1) | P2 |
| P2-17 | `apps/server/src/auth/oauthRouter.ts:113-116` | Logout clears `nadle_session` cookie but not `sa_oauth_nonce` (SEC-21 from pass 1). 5-minute nonce TTL bounds impact | P3 |
| P2-18 | `apps/client/src/pages/LandingPage.vue` (3800 LOC) | Very large marketing page. No correctness concern, but maintenance debt + bundle-size question. Confirm code-splitting | P3 |
| P2-19 | `apps/client/src/pages/AccountPage.vue` (2612 LOC) | Page-fat: at this size, account-page likely owns business logic that should live in composables / services | P3 |
| P2-20 | `apps/client/src/pages/NadleStreamPage.vue` (2353 LOC) | Same shape as Account / Landing. Documented in cursor rules as "current architecture, do not migrate unsolicited" — flag only for future planning | P3 |
| P2-21 | `apps/client/src/components/call/CallPage.vue:1497-1521` | The `applyingEatFirstSpeakingQueueFromSignaling` race guard around outbound `eat:speaking-queue-update` — flagged for re-verification with concurrent host toggle | P3 (Question) |
| P2-22 | `apps/server/prisma/schema.prisma:236-260` | `CoinTransaction.delta` is `Int` (Int32). Bounds admin grant to ~2.1B coins per tx but no application-level enforcement; combined with SEC-16 a careless admin can hit Int32 overflow | P3 (Question) |
| P2-23 | `apps/server/src/economy/predictions/predictionService.ts:447-474` | `listPredictionsForStreamer` is auth-required but visible to ALL authed users for ALL streamers. Confirmed intentional in pass 1; logging here for product-clarity completeness | P3 (Question) |
| P2-24 | `apps/client/src/router.ts:540-575` | The route guard performs `ensureAuthLoaded()` twice if both `requiresAdmin` and `requiresAuth` (or the email-verification branch and the auth gate) fire on the same navigation. Cosmetic; `ensureAuthLoaded` is idempotent | P3 |
| P2-25 | `apps/client/src/components/coinhub/SpinModule.vue:79-101` + `apps/client/src/composables/useAuth.ts:289, 292, 445` + `apps/client/src/stores/gameTemplateGame.ts` + `apps/client/src/stores/mafiaGame.ts` + `apps/client/src/utils/clientAnalytics.ts` | 6 files use raw `sessionStorage.*` (same drift class as P2-7) | P3 |
| P2-26 | `apps/server/src/billing/billingService.ts:411-484` | `mark-paid` flips status then `pollAndMatchOnce` outside a Serializable txn; race with concurrent webhook (BE-M5 from pass 1) | P3 |
| P2-27 | `apps/server/src/coinHub/coinHubAdminGate.ts:48-67` | `COINHUB_MUTATION_BYPASS=1` is active when `NODE_ENV !== 'production'` — default-unset `NODE_ENV` enables it. Belt-and-suspenders fix: positive `NODE_ENV` allowlist (SEC-15 from pass 1) | P3 |
| P2-28 | `apps/server/src/auth/persistOAuthUser.ts:198-256` | Google OAuth account-onboarding DoS via email collision (SEC-5 from pass 1, re-confirmed) | P2 |

### Questions (require product / runtime answer)

| ID | Question |
|----|----------|
| Pass2-Q-A | Is `/app/game-template` intentionally user-facing (and we forgot to add the home-page card), or internal/dev-only (and we forgot to add `requiresAdmin`)? |
| Pass2-Q-B | Should the home page "Economy coming soon" modal redirect to `/app/coin-hub`? If Coin Hub is staff-only, why is it exposed in chrome to all users? |
| Pass2-Q-C | Is the `/api/auth/apple` "not implemented" endpoint planned for completion, or should the route be deleted to avoid a "looks supported but isn't" UX trap? |
| Pass2-Q-D | Is anonymous `POST /api/eat-first/games/:gameId/ensure` deliberate (OBS overlays without accounts), or should ensure require auth and the seed flow run server-side only? |
| Pass2-Q-E | Should `clientNextWord` (Nadle) and the WS `?streamerId=` paths validate the streamer exists, accepting a closed list of audience-ready streamers? |
| Pass2-Q-F | `UserStats` model is partially redundant with `CoinBalance` + ledger. Is it still read by any code path, or can it be deprecated? |
| Pass2-Q-G | Mono webhook fail-closed in production requires secret rotation. Is a runbook documented? Are Cloudflare access logs scrubbed for `?secret=`? |
| Pass2-Q-H | The `/api/coinhub/case/open` (legacy) and `/api/economy/cases/:slug/open` (new) coexist. Is consolidation planned, or are the legacy "luck-*"/"free"/"subscriber" cases permanently separate? |
| Pass2-Q-I | The cursor rules say `playbackSuppressed` should NEVER stop consumers or close producers; pass 1 verified by code reading. Has this been confirmed under real OBS-source soak? |
| Pass2-Q-J | The fork that produced `gameTemplateGame.ts` introduced NUL bytes. Was a specific tool / pipeline used? If yes, the same tool may have affected other forks; recommend a CI grep step on every commit. |

---

## D. Suspicious places list (raw)

Files / functions / routes flagged for deeper inspection in future passes, even where no confirmed bug exists:

**Frontend pages (page-fat):**
- `apps/client/src/pages/LandingPage.vue` (3800 LOC) — review for unused assets and bundle size.
- `apps/client/src/pages/AccountPage.vue` (2612 LOC) — likely page-owned business logic.
- `apps/client/src/pages/NadleStreamPage.vue` (2353 LOC) — historical layout.
- `apps/client/src/components/call/CallPage.vue` (2558 LOC) — fork base; the master.
- `apps/client/src/components/game-template/GameTemplateCallPage.vue` (1701 LOC) — fork target.
- `apps/client/src/components/call/ParticipantTile.vue` (3059 LOC) — heaviest component; review for prop bloat and conditional render branches.

**Frontend forks pending consolidation:**
- `apps/client/src/stores/mafiaGame.ts` (2105) vs `apps/client/src/stores/gameTemplateGame.ts` (996 — has NUL bytes).
- `apps/client/src/stores/mafiaPlayers.ts` (77) vs `apps/client/src/stores/gameTemplatePlayers.ts` (85 — has NUL bytes).
- `apps/client/src/composables/useMafiaCallHostUi.ts` vs `useGameRoomCallHostUi.ts`.
- `apps/client/src/composables/useMafiaHostSignaling.ts` vs `useGameRoomHostSignaling.ts`.
- `apps/client/src/composables/useMafiaMediaRoom.ts` vs `useGameRoomMediaRoom.ts`.
- `apps/client/src/composables/useMafiaAudioMixSignaling.ts` vs `useGameRoomAudioMixSignaling.ts`.
- `apps/client/src/composables/useMafiaSpeakingHint.ts` vs `useGameRoomSpeakingHint.ts`.
- `apps/client/src/composables/mafiaStreamViewRoute.ts` vs `gameRoomStreamViewRoute.ts`.

**Backend hot paths:**
- `apps/server/src/signaling/messageHandlers.ts` (5070 LOC) — every Mafia/GameRoom/EatFirst mutation lands here.
- `apps/server/src/rooms/Room.ts` (1360 LOC) — single SSOT for three game protocols; touch with care.
- `apps/server/src/billing/billingService.ts` (1211 LOC) — money state machine.
- `apps/server/src/leaderboardRouter.ts` (700 LOC) — `$queryRaw` aggregates without LIMIT.

**Direct-storage-access files (drift class P2-7 / P2-25):**
- `apps/client/src/composables/useCallDevicePickers.ts`, `useAdminMode.ts`, `useBillingNotifications.ts`, `useNadleState.ts`
- `apps/client/src/features/checkers/pages/CheckersPage.vue`, `apps/client/src/features/checkers/ws/checkersWs.ts`
- `apps/client/src/stores/mafiaGame.ts`, `apps/client/src/stores/gameTemplateGame.ts`
- `apps/client/src/utils/callTileLocalDisplayNames.ts`, `apps/client/src/utils/clientAnalytics.ts`
- `apps/client/src/components/coinhub/SpinModule.vue`
- `apps/client/src/components/call/useCallChatPanel.ts`
- `apps/client/src/composables/useAuth.ts`

**Page-owned suspicious patterns:**
- `apps/client/src/pages/CoinHubPage.vue:117-119` — handles `errorKind === 'auth'` because the route is unauth-gated (P1 FE-M2).
- `apps/client/src/components/call/CallPage.vue:1497-1521` — `applyingEatFirstSpeakingQueueFromSignaling` race-guard.

**Backend public-creates-row surfaces:**
- `apps/server/src/eatFirst/router.ts:138-155` `POST /games/:gameId/ensure` (P2-4).
- `apps/server/src/nadle/nadleSocket.ts:234-243` `clientNextWord` and connection registration without streamer validation (P2-14).

**Files with NUL bytes (P2-1):**
- `apps/client/src/stores/gameTemplateGame.ts` (5)
- `apps/client/src/stores/gameTemplatePlayers.ts` (2)

**Unclear product surface:**
- `apps/server/src/auth/oauthRouter.ts:282` `/api/auth/apple` (returns "not implemented").
- `apps/client/src/router.ts:127-149` `/app/game-template` (not in home cards).
- `apps/client/src/pages/HomePage.vue:139-154` "Economy coming soon" while Coin Hub is live.
- Generic "Economy" modal text vs live Coin Hub.

---

## E. Follow-up audit plan (read-only, smaller passes)

1. **Runtime / browser audit (WebRTC).** Spin a 2-tab call on `slot/sa-review`, capture `chrome://webrtc-internals` + `getStats()`, verify F9 / F10 from pass 1 in the real DOM; verify `<video>` element does NOT remount under cam-toggle and screen-share-toggle; verify `playbackSuppressed` does not tear down consumers. Output: a written "browser observability" report in `docs/audits/`.
2. **Route/auth guard pass.** Walk every route × every role (anonymous, user, streamer, admin) in a real browser using a script or manual checklist. Especially: `coin-hub`, `game-template`, `home` flicker under anonymous, beta-access modal across all four routes, OBS view-mode without auth on all three eligible routes.
3. **Economy / wallet pass.** End-to-end ledger trace for each earn source (chat, game-participation, daily, case-open, prediction-payout) and each spend (predictions, case-open). Verify invariant `sum(CoinTransaction.delta where userId=X) == CoinBalance.amount` after a forced 5-minute test session. Identify gambling-like surfaces (cases / pity / odds) and confirm regulatory posture.
4. **Mafia / GameRoom / Eat First drift audit.** Diff `mafiaGame.ts` vs `gameTemplateGame.ts` line-by-line (after NUL fix) and produce a delta report. Same for stores, composables, page CSS. Output: a `docs/audits/mafia-vs-gameroom-drift.md`.
5. **OBS / 4K UI audit.** Browser-load Mafia/Eat First/Nadle/Nadraw at OBS browser-source resolution (1920×1080, 4K, vertical); confirm overlay/timer/queue layout stability; check `prefers-reduced-motion` and reduced-CPU posture.
6. **WS protocol audit pass.** Run a fuzzer against every `/ws` message shape (oversize strings, wrong types, missing fields, extra fields). Confirm Zod rejection is sampled into diagnostics correctly. Confirm GameRoom and EatFirst constants stay in lockstep across a future intentional rename.
7. **Test gap pass.** Land the four tests proposed in §B.6 (server integration scaffolding; GameRoom/EatFirst parity; CallPage/GameTemplateCallPage emit parity; XFF unit test).

---

## F. Fix backlog (no implementation now)

Grouped by future-branch. **None of these are to be implemented in this audit pass.**

**`fix/*` (correctness):**
- `fix/auth-xff-rate-limit-leak` — P1 from pass 1 (SEC-2). One-line fix in `apps/server/src/utils/rateLimit.ts`.
- `fix/adminrouter-duplicate-parseAdminDateParam` — P1 from pass 1 (SEC-1). Delete dup at lines 170-176.
- `fix/coin-hub-route-auth-gate` — P1 from pass 1 (FE-M2). Add `requiresAuth: true`.
- `fix/game-template-elimination-background-binding` — P1 from pass 1 (FE-C1). Bind emit + handler.
- `fix/call-self-tile-server-mute-drift` — P1 from pass 1 (RT-F9 / F10).
- `fix/game-template-store-nul-bytes` — **P2-1 NEW.** Replace 7 NUL bytes with real spaces; add CI grep guard.
- `fix/mono-webhook-inbox-reaper` — pass 1 BE-M4. Add setInterval retry with `attempts<N`.
- `fix/useauth-network-failure-grace` — pass 1 FE-M3.
- `fix/mafia-old-mode-snapshot-hydrate` — pass 1 FE-M4.
- `fix/legacy-streamer-shortcut-validation` — **P2-6 NEW.** Validate `:streamer` exists or redirect.
- `fix/eat-first-ensure-anon-cap` — **P2-4 NEW** (pending product decision).
- `fix/apple-oauth-not-implemented-cleanup` — **P2-9 NEW** (pending product decision).

**`feat/*`:**
- `feat/game-room-transfer-host-offer` — pass 1 BE-M1. New offer/accept/reject store + handlers.

**`perf/*`:**
- `perf/leaderboard-streak-query-limit` — pass 1 BE-M6 / P2-13. Add LIMIT or precompute.
- `perf/parallel-consumer-getstats` — pass 1 RT-F17.

**`refactor/*`:**
- `refactor/callpage-game-template-de-fork` — pass 1 SY-1 / P2-8. Single driver + per-route adapter; big project.
- `refactor/storage-helpers-consolidation` — P2-7 / P2-25. 14 raw `localStorage` files and 6 raw `sessionStorage` files migrate to `storageJson.js`.
- `refactor/economy-claim-path-consolidation` — P2-12. Decide whether to retire `/api/coinhub/claim` once `/api/economy/claims/*` covers every kind.

**`test/*`:**
- `test/ws-protocol-parity-gameroom-eatfirst` — P2-2. Extend the duplication test to GameRoom + EatFirst.
- `test/callpage-game-template-emit-parity` — pass 1 SY-1 follow-up.
- `test/server-auth-integration-smoke` — net-new server-side scaffolding.
- `test/xff-rate-limit-bypass-regression` — locks SEC-2 fix.

**`docs/*`:**
- `docs/economy-product-state-clarification` — P2-3.
- `docs/game-template-visibility-decision` — P2-5.
- `docs/mono-webhook-secret-rotation-runbook` — pass 1 SEC-6 follow-up.
- `docs/coin-hub-vs-economy-modal-decision` — P2-3 follow-up.

---

## G. Final verdict (pass 2)

| Dimension | Score /10 | Pass 1 → Pass 2 | Notes |
|---|---:|---|---|
| Audit confidence | 8.0 | n/a → 8.0 | breadth coverage is now full; runtime/browser verification remains the gap |
| Route coverage | 9.0 | n/a → 9.0 | every route + 4 admin subroutes + 7 legacy redirects + 3 SEO statics enumerated |
| Backend coverage | 8.5 | n/a → 8.5 | every Express mount + WS dispatcher mapped; server-test gap is what holds the score |
| WS coverage | 8.5 | n/a → 8.5 | 5 endpoints + 80+ message types catalogued; parity-test gap noted |
| WebRTC coverage | 8.0 | 8.5 → 8.0 | minor downgrade — confirmed pass 1's analysis was sound, but the OBS/4K runtime soak is still untouched |
| Economy coverage | 9.0 | 9.0 → 9.0 | ledger invariants confirmed; SEC-16 and BE-M4 remain; case-path duality is the new visible item |
| UI/UX coverage | 7.5 | 7.0 → 7.5 | game-template visibility, economy modal, coin-hub gate, OBS preview surface all surfaced |
| Test coverage confidence | 6.5 | 6.0 → 6.5 | call-core internal tests located (22 files) — bumps confidence; server tests still zero |

**Closing notes:**

- Pass 1's "no Critical" verdict survives pass 2.
- Pass 1's P1 list is **still correct and still the right place to start**: SEC-2 → SEC-1 → FE-C1 → FE-M2 → RT-F9/F10 → BE-M1 → BE-M4 → FE-M3 → FE-M4.
- Pass 2 adds **P2-1 (NUL-byte source corruption)** as a P1 candidate — small fix, large confidence-restoration value. Recommend bundling with the FE-C1 GameTemplate fix into one `sa-fix` branch.
- The strategic refactor item remains the page-level fork (SY-1 / P2-8). Phase 5a/5b extraction is the existing model and is working — it just hasn't reached the page level yet.
- The runtime browser audit, the route/auth guard pass, and the economy/wallet pass (E.1 / E.2 / E.3 above) are the highest-value next read-only passes.

---

*End of pass 2. No runtime code, configs, tests, or commits were modified. Branch `slot/sa-review` is at `789d5e4`. The only new file is `docs/audits/full-project-review-pass-2.md`.*
