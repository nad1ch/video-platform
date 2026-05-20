# StreamAssist — full-project read-only audit

- **Branch:** `slot/sa-review`
- **HEAD:** `789d5e4` (in sync with `main`)
- **Worktree path:** `D:\Stream staff\video-platform-sa-review`
- **Mode:** read-only audit. No runtime code, configs, tests, or commits were modified.
- **Scope:** entire repository — `apps/client`, `apps/server`, `packages/*`, docs and rules. Specialist sub-agents covered WebRTC/call-core, frontend, backend authority, and security in parallel; findings were verified against file:line evidence before inclusion.

> Where a sub-agent claim is included verbatim, the **Verification** field records the independent file-line check performed during synthesis.

---

## 1. Executive summary

StreamAssist is a notably mature realtime streaming platform. The high-risk surfaces are well-guarded by design intent, in-code comments referencing prior audits ("audit S2", "P0 Bug 3", "audit Batch G"), Serializable transactions across the coin economy, idempotency keys on every ledger writer, fail-closed Mono webhook secret verification in production, Origin-allowlisted WS upgrades, a category-bucketed per-socket rate-limit dispatcher, and an owner-lock with a DB-persisted backstop for Mafia / GameRoom host identity. The cursor-rules `streamassist-engineering-rules.mdc` already lists known risks; the audit confirms most of them are addressed and surfaces a small set of fresh findings.

**There are no Critical authority bypass or money-flow findings.** The strongest active risks are:

1. **SEC-2 (P1)** — `apps/server/src/utils/rateLimit.ts:116-127` reads `X-Forwarded-For` directly and lets the first hop win. Combined with `trust proxy: 1`, an attacker rotating XFF per request bypasses every IP-based limiter (login, register, password-reset). One-line fix.
2. **M1 GameRoom transfer-host parity gap** — `apps/server/src/signaling/messageHandlers.ts:4607-4639`. Mafia uses a two-phase offer/accept (with target consent). The parallel `gameroom:transfer-host` handler unilaterally rebinds ownership. Foundation-only today (no client invokes it), so impact is "release-blocker for the next GameRoom feature."
3. **C1 (frontend)** — `GameTemplateCallPage.vue:1565-1585` does not bind `@game-set-elimination-background` or `@mafia-set-elimination-background`; the swatch UI is a visual no-op. Game-template host UX bug.
4. **F9 / F10 (UX drift)** — when the Mafia host force-mutes / force-cam-offs a peer, the **server pauses the producer correctly** (authority intact), but the targeted peer's local toolbar continues to show mic-on / cam-on because `peer-audio-muted` and `peer-outbound-video-paused` reducers do not propagate to `micEnabled` / `camEnabled` when `peerId === selfPeerId`. Authority is intact; UX is inconsistent.
5. **Architectural duplication** — `apps/client/src/components/call/CallPage.vue` (2558 LOC) and `apps/client/src/components/game-template/GameTemplateCallPage.vue` (1701 LOC) are a byte-faithful fork that already diverged (C1 above). Every CallPage fix needs a parallel patch. This is the largest scaling-risk surface in the client.
6. **M4 Mono webhook retry loop missing** — `apps/server/src/billing/monoWebhookInbox.ts` durably enqueues but processes only inline; a transient DB blip strands a row forever. Real-money UX impact.
7. **M2 frontend** — `/app/coin-hub` is not auth-gated in `apps/client/src/router.ts:180-184`. Guest viewers see a logged-out hub page instead of being redirected to login.

Everything else is Minor or Question.

**Architecture is sound.** Server is authoritative for every flow checked (Mafia host claim/transfer-host, Eat First slot claim, Checkers match result, Mono activation, predictions, leaderboard writes, force-mute/force-cam-off, kick/revive). The client `userIdRaw` on `join-room` is **ignored** in favor of the session JWT id (`messageHandlers.ts:1068-1082`), with a 1/100 sampled spoofing-attempt diagnostic. The `/api/wins` POST endpoint already returns 410 `server_authority_required`. Checkers `/api/matchmaking/result` re-derives the winner from server-side `state.winner` with a revision gate and idempotency set.

---

## 2. Source-of-truth map

| Domain | SSOT (server) | SSOT (client) | WS / wire | Notes |
|---|---|---|---|---|
| Session / userId | Signed JWT in `nadle_session` cookie (`auth/session/sessionJwt.ts`) | `composables/useAuth.ts` (read-only mirror of `/api/auth/me`) | n/a | `socketSessionUserId` set at WS upgrade (`socketServer.ts:301-304`); client-claimed `userId` in `join-room` is ignored. |
| Admin role | `User.role` (DB) + env allowlist for non-email providers; email provider requires `emailVerified` (`auth/session/isAdminRequest.ts`) | `useAuth().isAdmin` (derived) | n/a | Strong — see SEC-13 for the only gap (stateless 7-day JWT, no revocation). |
| Streamer ownership | `Streamer.ownerId` or `StreamerMember.role='OWNER'` (`economy/streamerOwnership.ts`); auto-create on Twitch login gated by `TWITCH_STREAMER_MIN_FOLLOWERS` | `useNadleStreamerRoom` reads server-resolved context | REST | Predictions / streamer settings centralize on `isStreamerOwner`. |
| Room / call | `RoomManager` + `Room` + `Peer` (server in-memory, mediasoup-bound). Auth context: `socketSessionUserId`, `socketSessionPrismaUserId`. | `packages/call-core/src/stores/callSession.ts` + `useCallEngine.ts` | `/ws` | One SSOT, no competing stack. |
| Mafia host lock | `Room.mafiaHostUserId` + `mafiaRoomOwnerStore` (in-memory) + `MafiaRoomOwner` (DB backstop, TTL) | `mafiaGame` store reads `mafia:host-updated` | `/ws` `mafia:*` | Two-phase transfer-host with consent + offer store (`mafiaTransferOfferStore.ts`). |
| GameRoom host lock | `Room.gameRoomHostUserId` + `gameRoomOwnerStore` + `GameRoomOwner` (DB) | `gameTemplateGame` store | `/ws` `gameroom:*` | **Transfer-host is single-phase (M1).** No offer store. |
| Eat First slot / host | `Peer.eatFirstSlotId` + `room.ownerUserId` (Prisma id) + `EatFirstPlayer.data.{joinToken,joinDeviceId}` (DB) | `eatFirstCallShell` store | `/eat-first-ws` + `/ws` `eat:*` | Slot auth uses `(joinToken, deviceId)` — public viewer model. Non-constant-time compare on tokens (SEC-Minor). |
| Producers / consumers | `Peer.getProducers()` on server; `useRemoteMedia` `remotePeerStreams` map on client | `useRemoteMedia` (`remotePeerStreams`, `remoteOutboundVideoPausedByPeerId`) | `producer-sync`, `new-producer`, `producer-closed` | Merge-only producer-sync; recv side serialized via `recvApplySerialQueue`. |
| Screen share | `useCallScreenShare` (single-flight `opChain`) | same | client-only, signaled via `producer-video-source` | OS `ended` correctly routed; camera off preserved when restoring. |
| Audio playback unlock | n/a | `call-core/audio/audioPlaybackUnlock` (`main.ts:17` wires `initAudioPlaybackUnlock`) | n/a | One SSOT — confirmed wired by the WebRTC agent. |
| Display names | Client-supplied at `join-room`, server-sanitized (`sanitizeDisplayName`); `peer-display-name` + `room-state` for fan-out | `call-core/utils/participantsMapper` (`resolveParticipantDisplayName`, `resolvePeerDisplayNameForUi`) | same | Single canonical helper set. |
| Coin balance / XP | `CoinBalance` / `XpBalance` + `CoinTransaction` / `XpTransaction` append-only ledgers (Serializable txns) | `coinHub` store + `economy` stores | REST | All mutations go through `walletService.applyDelta`. Idempotency keys enforced. |
| Pending rewards | `PendingReward` + `Pending` (legacy) | `coinHub` claim flow | REST | Two paths consumed atomically in one txn. |
| Cases | `CaseCatalog` + `CaseReward` + `UserPity` + `CaseOpening`; legacy `CoinCase` for hub cases | `casesStore` | REST | Pity counter; weighted random server-side. |
| Predictions | `Prediction` + `PredictionOption` + `PredictionEntry`; Serializable txns; unique `(predictionId, userId)` | `predictionsStore` | REST | Owner-only create/lock/resolve via `isStreamerOwner`. |
| Leaderboard | `GameRound` + `GameResult` + `UserStreamerStats`; 5s read-cache per streamer | `useNadleGlobalLeaderboard` etc. | REST | `/api/wins` POST returns 410. Nadle persistence is server-driven (Twitch IRC). |
| Billing / Mono | `PaymentRequest` + `MonoTransaction` + `Subscription` + `MonoWebhookInbox`; Serializable matcher | `BillingPage` + `useBillingConfig` / `useBillingNotifications` | REST | Webhook secret verified constant-time, fail-closed in prod. M4: inline-only processor. |
| Force-state (mute/cam-off) | `Room.mafiaForceMuteAllActive`, `mafiaForcedCameraOffPeerIds` / `…UserIds`, mirrors for GameRoom | `useCallEngine` reducer reads `peer-audio-muted` / `peer-outbound-video-paused` | `/ws` | Authority is server. F9/F10: self-tile UI drift. |
| OBS / viewer mode | `CallEngineRole='viewer'` skips send transport + publish (`useCallEngine.ts:855-918`) | viewer route gate | n/a | Receive-only — confirmed. |
| Diagnostics | `roomDiagnosticsBus` + `RoomDiagnosticReport` (DB), drained on SIGTERM | `diagnostics` client emitter | n/a | Sampled 1/100 for spoof / schema-drop events. |

---

## 3. Findings by severity

Each finding uses the requested template. IDs preserve the originating sub-agent prefix (`SEC`, `BE`, `RT`, `FE`) plus my own synthesis IDs (`SY`). Verification fields show what I checked personally.

### 3.1 Critical

**No Critical findings.** No authority bypass, no money-flow leak, no auth backdoor, no `<video>` remount risk, no broken cleanup on disconnect.

### 3.2 Major

---

**Finding ID:** SEC-2
**Severity:** Major
**Area:** Auth / abuse / rate-limit
**Files:** `apps/server/src/utils/rateLimit.ts:116-127`; `apps/server/src/index.ts:75` (`trust proxy: 1`); call sites: `apps/server/src/auth/email/emailAuthHandlers.ts` and password-reset paths
**Evidence:** `getClientIp` reads `req.headers['x-forwarded-for']`, takes the first comma-split token, and returns it directly. `req.ip` is only the fallback.
**What is wrong:** With `trust proxy: 1`, Express already derives the correct hop-stripped `req.ip` from XFF. The manual leftmost-XFF parse trusts a user-supplied header — an attacker rotating `X-Forwarded-For: <fresh>` per request creates a new limiter bucket every request, effectively disabling every IP-keyed rate limit (login, register, password-reset).
**Why it matters:** Credential stuffing and password-reset enumeration are gated only by per-email limiters (which exist for login but not for register-time email enumeration).
**Exploit/regression scenario:** `curl -H "X-Forwarded-For: $RANDOM" /api/auth/login` 1000×/min — each fresh value creates a fresh bucket; the 10/5min cap never trips.
**Root cause:** Manual XFF parsing predates the `trust proxy` setting.
**Minimal safe fix direction:** Replace the function body with `return typeof req.ip === 'string' && req.ip.length > 0 ? req.ip : 'unknown'`. The single trusted proxy is Cloudflare; Express will return the right client IP.
**What can break if fixed:** Nothing in single-trusted-proxy topology. If a future proxy chain emerges, `trust proxy` would need to bump to `2`.
**Suggested QA:** Send 15 logins with rotating `X-Forwarded-For` from one source; expect 429 after the 10th.
**Priority:** P1.

---

**Finding ID:** BE-M1
**Severity:** Major
**Area:** Server authority / game-room transfer-host parity
**Files:** `apps/server/src/signaling/messageHandlers.ts:4607-4639` (GameRoom); `apps/server/src/signaling/messageHandlers.ts:1778-1849` (Mafia equivalent, two-phase); `apps/server/src/signaling/clientMessageSchema.ts:408-413`
**Evidence:** `handleGameRoomTransferHost` rebinds `hostUserId` / `hostSessionId` / `hostPeerId` and writes `setGameRoomOwnerUserId(room.id, nextUserId)` synchronously on a single host-sent message. Mafia's `handleMafiaTransferHost` (legacy entry) delegates to the two-phase offer flow (`handleMafiaTransferHostOffer` → `handleMafiaTransferHostAccept`) to force target consent.
**What is wrong:** GameRoom skipped the offer/accept upgrade that Mafia received. Host can transfer ownership to any user with a recorded GameRoom session, without target consent. Owner-lock then prevents the original host from reclaiming for 24h (`signaling/gameRoomOwnerStore.ts:13`).
**Why it matters:** A compromised or buggy host UI permanently moves ownership. Foundation-only today (no client invokes it), but a release blocker for the next GameRoom feature.
**Root cause:** Phase 3A fork copied only the legacy single-phase Mafia path; the consent/offer store added later for Mafia (`mafiaTransferOfferStore.ts`) was never paralleled.
**Minimal safe fix:** Create `gameRoomTransferOfferStore.ts` mirroring `mafiaTransferOfferStore.ts`. Split `handleGameRoomTransferHost` into `Offer / Accept / Reject` handlers + schema entries. Until UI lands, gate the legacy entry to delegate to the offer path (mirrors `messageHandlers.ts:1782-1784`).
**What can break:** No client invokes this today; any future GameRoom UI must send the offer message.
**Suggested QA:** Two tabs, same GameRoom. Host A sends `gameroom:transfer-host` to user B. Expect B to receive `gameroom:transfer-host-pending` and authority to remain unchanged until B accepts.
**Priority:** P1 (foundation invariant).

---

**Finding ID:** FE-C1
**Severity:** Major
**Area:** Game-template host UX
**Files:** `apps/client/src/components/game-template/GameTemplateCallPage.vue:1565-1585`; `apps/client/src/components/call/ParticipantTile.vue:55-57, 906-907`
**Verification:** Read both files directly. ParticipantTile emits `mafia-set-elimination-background` AND `game-set-elimination-background` at lines 906-907. GameTemplateCallPage's `<ParticipantTile>` binding at lines 1579-1584 binds `@game-toggle-life`, `@game-force-camera-off`, `@game-viewport-layers`, `@remote-playback-stall`, `@video-stall`, `@audio-stall` — **no binding for `@game-set-elimination-background` or `@mafia-set-elimination-background`**.
**What is wrong:** Game-template host can see the elimination-background swatch row (rendered whenever `isDead && resolvedHostShowLifeToggle`), click any swatch, and observe no state change. The bound emit goes to no listener.
**Why it matters:** Visible host-tier UX bug — the affordance animates on click but produces no result.
**Root cause:** Phase 4B fork left the listener off the GameTemplate parent.
**Minimal safe fix:** Add `@game-set-elimination-background="onSetEliminationBackground"` to the binding at line 1579-1584 and add the handler mirroring `onMafiaSetEliminationBackground` (`useMafiaCallHostUi.ts:153-155`) but against `useGameTemplateGameStore`.
**What can break:** None — the emit currently has no consumer.
**Suggested QA:** As Game Template host, eliminate a player; click each elimination-background swatch in the tile menu; expect swatch active state to update and background to render.
**Priority:** P1 (host UX broken on a shipped surface).

---

**Finding ID:** RT-F9
**Severity:** Major
**Area:** Force-mute UX drift (server authority intact)
**Files:** `packages/call-core/src/useCallEngine.ts:758-770` (reducer); `apps/server/src/signaling/messageHandlers.ts:1670-1672` (server broadcast); `packages/call-core/src/media/useLocalMedia.ts` (`micEnabled` ref)
**Verification:** Read the reducer at `useCallEngine.ts:758-770` directly. The handler writes only to `remoteAudioMutedByPeerId` (the remote-tile reducer) and does NOT branch on `peerId === selfPeerId` to drive `micEnabled` (compare to `peer-camera-mirror` reducer at line 786-788 which does correctly self-sync).
**What is wrong:** When the Mafia host force-mutes a peer, the server pauses the audio producer correctly (`runPeerAudioMuteOp`). The server broadcasts `peer-audio-muted` for the muted peer. The targeted peer's reducer ignores its own peerId, so the local toolbar continues to show mic-on, and a click to unmute will fire `set-audio-muted` which the server silently rejects.
**Why it matters:** Authority is intact (no audio leaks), but the user sees a desync that looks like a bug. Tied to victim-blame in chat / overlay messaging.
**Exploit/regression scenario:** Mafia host kills player X's mic; player X clicks unmute; player X's UI shows mic-on indefinitely; nobody else hears them.
**Root cause:** Asymmetric handling between `peer-camera-mirror` (which DOES self-update) and `peer-audio-muted` (which does not).
**Minimal safe fix:** In the `peer-audio-muted` reducer, after updating `remoteAudioMutedByPeerId`, if `peerId === selfPeerId.value`, force `micEnabled.value = !muted` (and on server reject, the next `set-audio-muted` round-trip will keep them in sync).
**What can break:** If the user toggles mic locally before the server echo arrives, the echo will overwrite — verify the watcher at `useCallEngine.ts:1390-1402` reconciles correctly.
**Suggested QA:** Two tabs same user (mafia host + victim). Host force-mutes the victim. Victim's toolbar should snap to muted, and a subsequent victim unmute click should be visibly rejected.
**Priority:** P1.

---

**Finding ID:** RT-F10
**Severity:** Major
**Area:** Force-camera-off UX drift
**Files:** `packages/call-core/src/media/useRemoteMedia.ts:1490-1513` (reducer); `apps/server/src/signaling/messageHandlers.ts:2451-2457`; `packages/call-core/src/media/useLocalMedia.ts` (`camEnabled` ref); `packages/call-core/src/useCallEngine.ts:1167-1186` (local-tile render)
**Verification:** Read the reducer at `useRemoteMedia.ts:1490-1513`. It updates `remoteOutboundVideoPausedByPeerId` for ALL peerIds, but `camEnabled` (in `useLocalMedia`) is unaffected. The local-tile render at `useCallEngine.ts:1178` uses `outboundVideoSource.value === 'screen' || camEnabled.value` — local preview keeps showing the camera.
**What is wrong:** Same shape as RT-F9 but for video. Mafia host force-cam-offs a peer; the server pauses the video producer (good); the targeted peer's local tile still shows their own preview because `camEnabled` is unchanged.
**Why it matters:** Same as RT-F9 — authority intact, UX desync.
**Root cause:** The reducer doesn't propagate the self entry into `camEnabled`.
**Minimal safe fix:** In the reducer, if `peerId === selfPeerId`, propagate `paused` into `camEnabled` (with a small guard so this doesn't fight a legitimate local toggle in flight). Confirm by re-running the camera-toggle watcher at `useCallEngine.ts:1331-1364`.
**Suggested QA:** Mafia host force-cam-offs player X. Player X's local preview should switch to the avatar; remotes already see them as off.
**Priority:** P1.

---

**Finding ID:** SY-1 (architectural duplication)
**Severity:** Major
**Area:** Frontend architecture / maintenance scaling
**Files:** `apps/client/src/components/call/CallPage.vue` (2558 LOC) and `apps/client/src/components/game-template/GameTemplateCallPage.vue` (1701 LOC); also `apps/client/src/stores/mafiaGame.ts` (2105 LOC) vs `apps/client/src/stores/gameTemplateGame.ts` (996 LOC)
**Verification:** `wc -l` confirms sizes. Grep shows the same `setPeerVisible` machinery, the same comment blocks at parallel line numbers, the same composable imports, the same `<ParticipantTile>` event surface. FE-C1 above already demonstrates real drift.
**What is wrong:** Two near-identical large `<CallPage>` files maintained in parallel; the fork has already silently diverged (FE-C1).
**Why it matters:** Every CallPage bug fix needs a parallel patch; every QA row needs to be run twice. Scaling cost grows linearly with future features.
**Root cause:** Phase 3C fork was done byte-faithful before extraction; small route-specific surface (4 composables + 2 stores + 1 protocol prefix) was deemed not yet worth de-duplicating.
**Minimal safe fix:** Out-of-scope for an audit — but a single-file driver parameterized by a `useGameRoomBindings()` adapter is the obvious target. Until then, every CallPage diff must include a corresponding GameTemplateCallPage diff with a CI check that flags drift (e.g., `wsProtocolDuplication.test.ts`-style parity test).
**What can break:** Refactor risk is high; the fork should stay until a dedicated refactor task is scheduled.
**Suggested QA:** Add a unit test that asserts the two files import the same set of composables and bind the same emit surface on `<ParticipantTile>`. Run all `/ai/QA_CHECKLIST.md` §1 (Call/realtime) rows against `/app/mafia` AND `/app/game-template` for any CallPage change.
**Priority:** P2 (no immediate user impact beyond FE-C1; long-term P1 strategic risk).

---

**Finding ID:** BE-M4
**Severity:** Major
**Area:** Billing — webhook durability gap
**Files:** `apps/server/src/billing/billingRouter.ts:201-224`; `apps/server/src/billing/monoWebhookInbox.ts:55-101`
**Evidence:** The webhook handler enqueues a `MonoWebhookInbox` row, then calls `processMonoWebhookInboxRow(enqueued.id)` inline. If `ingestStatementWebhook` throws (DB blip, parse drift), the row gets `attempts++` and `lastError`. No background reaper exists; the comment at `monoWebhookInbox.ts:18-20` acknowledges this.
**What is wrong:** Transient failures leave inbox rows unprocessed forever until manual admin replay.
**Why it matters:** Real-money UX: a "I paid" user could wait indefinitely for activation.
**Root cause:** Acknowledged tech debt.
**Minimal safe fix:** Add a `setInterval` reaper (30-60s) that picks rows with `processedAt IS NULL AND attempts < N` and calls `processMonoWebhookInboxRow(id)`. Use `.unref()`. Bound by `attempts < N` to prevent retry storms.
**What can break:** Retry storm only if a deterministic bug makes every payload throw; mitigated by `attempts` cap.
**Suggested QA:** Force `ingestStatementWebhook` to throw once; verify row stays at `attempts=1`; restart server; verify reaper retry and the row reaches `processedAt`.
**Priority:** P2.

---

**Finding ID:** FE-M2
**Severity:** Major
**Area:** Frontend route gating
**Files:** `apps/client/src/router.ts:180-184`
**Verification:** Read the route record directly. `coin-hub` has `meta: { appTitleKey, footerContext }` — no `requiresAuth: true`. Other economy routes (`billing` line 213, `account` line 219, `economy-predictions` line 201, `economy-streamer-settings` line 207) all have `requiresAuth: true`.
**What is wrong:** Unauthenticated viewers can navigate to `/app/coin-hub`. The CoinHub store will fail with `errorKind: 'auth'` and the page renders a logged-out state instead of redirecting to `/auth?redirect=/app/coin-hub`.
**Why it matters:** Poor UX gap — guest sees an empty hub instead of the auth page.
**Root cause:** Route declared during the "single user-facing economy surface" consolidation without the auth gate.
**Minimal safe fix:** Add `requiresAuth: true` to the `coin-hub` route meta.
**What can break:** None — the page already requires auth at the API layer; the gate just routes the user properly. Confirm `economy-cases` redirect (line 195) inherits the gate via the target route.
**Suggested QA:** Open `/app/coin-hub` in a fresh incognito window; expect redirect to `/auth?redirect=/app/coin-hub`.
**Priority:** P2.

---

**Finding ID:** SEC-5
**Severity:** Major
**Area:** Auth / OAuth account-onboarding DoS
**Files:** `apps/server/src/auth/persistOAuthUser.ts:198-256`
**Evidence:** `persistGoogleOAuthUser` upserts on `(provider='google', providerUserId=googleId)`. `User.email` has a `@unique` constraint. If someone (or an attacker) registered an email-password account with the same email, the Google upsert fails with P2002 — caught and logged but the OAuth flow continues. The session is signed but subsequent `/api/auth/me` cannot resolve a Prisma user.
**What is wrong:** Targeted email squat can DoS Google onboarding.
**Why it matters:** Not an account-takeover, but a denial-of-onboarding for a specific email address.
**Root cause:** Google flow has no email-collision preflight equivalent to email-password's `emailAuthHandlers.ts:220-224` check.
**Minimal safe fix:** Before the Google upsert, look up any `User` with that email and `provider !== 'google'`. Define merge semantics: link to existing OAuth account or reject with a clear `authError=ACCOUNT_LINK_REQUIRED`.
**What can break:** Linking semantics need to be designed carefully to avoid takeover (e.g., never link to a verified email-password account silently).
**Suggested QA:** Register a fresh email-password account `x@gmail.com`; attempt Google login with same email; verify either a clear error or a documented merge path.
**Priority:** P2.

---

**Finding ID:** SEC-6
**Severity:** Major
**Area:** Billing — Mono webhook secret is the only authentication
**Files:** `apps/server/src/billing/billingRouter.ts:201-315`
**Evidence:** Monobank Personal API delivers callbacks with a URL-token (`?secret=…` query string). The handler verifies with constant-time compare, fail-closed in production. There is no HMAC, no signature, no IP allowlist. Per-secret-lifetime, if the secret leaks (Cloudflare access logs, reverse-proxy logs, operator slip), any attacker who knows the StatementItem schema can register a `PaymentRequest`, forge a matching `StatementItem`, and trigger auto-activation.
**What is wrong:** The defense-in-depth is the Serializable matcher (`tryAutoMatchTransaction`) — but the matcher will auto-activate on a forged StatementItem that matches `(amount, currency, direction, accountId)`. The secret is the only gate.
**Why it matters:** Operational risk; not a design defect (Monobank's Personal API tier doesn't support HMAC).
**Root cause:** Provider authentication model.
**Minimal safe fix:**
1. Document the rotation runbook for `MONO_WEBHOOK_SECRET`.
2. Confirm Cloudflare Logpush strips `?secret=…` (the in-process log already redacts via `redactUrlSecrets` in `index.ts:51-53`).
3. Consider Cloudflare WAF rule + source-IP allowlist for monobank.ua's egress (fragile but useful).
4. Consider rejecting duplicate `monoTransactionId` if seen within a small replay window.
**Suggested QA:** Verify the secret is not in any production log layer; confirm the rotation runbook exists.
**Priority:** P2.

---

**Finding ID:** FE-M4
**Severity:** Major
**Area:** Mafia state hydration on refresh
**Files:** `apps/client/src/components/call/CallPage.vue:2179-2198`; `apps/client/src/stores/mafiaGame.ts:107-112`; `apps/client/src/pages/MafiaPage.vue:20`
**Evidence:** On `onBeforeUnmount`, CallPage resets stores including `mafiaGameStore.fullReset()`. `oldMafiaMode` defaults to `true` on remount. `MafiaPage.vue:20` gates `showMafiaOverlay = !oldMafiaMode || isMafiaHost`. Until the server snapshot arrives, non-hosts see an empty overlay.
**What is wrong:** Mafia mid-game refresh on a slow network can flash an empty overlay for non-host players until the WS snapshot lands.
**Why it matters:** Visible "broken game" moment on reconnect.
**Minimal safe fix:** Hydrate `oldMafiaMode` from the server snapshot (via `mafia:players-update` or a dedicated `room-state` extension) before rendering the overlay placeholder; gate the empty-overlay branch on a `snapshotReceived` ref rather than the default boolean.
**Suggested QA:** Mafia host starts new game with `oldMafiaMode=false`; non-host refreshes mid-game; expect overlay to render within 1s of WS reconnect, not flash empty.
**Priority:** P2.

---

**Finding ID:** FE-M3
**Severity:** Major
**Area:** Auth / network-failure path
**Files:** `apps/client/src/composables/useAuth.ts:266-316`
**Evidence:** `refreshOnce` swallows network errors and always flips `loaded = true`, leaving `user.value = null`. The route guard then redirects to `/auth` even though the cookie may be valid. `ensureAuthLoaded` short-circuits on `loaded.value === true` so the user stays logged out until manual retry.
**What is wrong:** Flaky network at boot triggers a spurious logout.
**Minimal safe fix:** On network throw, do NOT flip `loaded = true` if `user.value === null`; surface a separate `loadFailed` ref so the guard can re-attempt.
**Suggested QA:** Set DevTools network to Offline at page-load on `/app/mafia`; expect graceful retry rather than `/auth` redirect.
**Priority:** P2.

---

**Finding ID:** SEC-1
**Severity:** Major (build correctness)
**Area:** Admin router
**Files:** `apps/server/src/adminRouter.ts:62` and `apps/server/src/adminRouter.ts:170`
**Verification:** Read both blocks. The function `parseAdminDateParam(value: unknown): Date | undefined` is declared twice with byte-identical bodies.
**What is wrong:** TypeScript `noEmit` may pass with duplicate function declarations of identical signature, but most strict configurations produce TS2393 ("Duplicate function implementation"). Either way the second declaration is dead code and a merge artifact.
**Minimal safe fix:** Delete the duplicate at lines 170-176.
**What can break:** Nothing — bodies are identical.
**Suggested QA:** `tsc --noEmit` on `apps/server`.
**Priority:** P2.

---

**Finding ID:** BE-M2
**Severity:** Major
**Area:** Nadle — streamer-scope memory growth + unauthenticated streamer targeting
**Files:** `apps/server/src/nadle/nadleSocket.ts:234-243, 290-345`; `apps/server/src/nadle/gameStore.ts:195-252`; `apps/server/src/utils/wsUpgradeQuery.ts`
**Evidence:** WS upgrade reads `?streamerId=` with no membership check. `gameStore.stores: Map<streamerId, …>` and per-store `players: Map<userId, Player>` grow unbounded per logged-in viewer.
**What is wrong:** (a) Any logged-in user can submit guesses against any streamer's game store. Memory grows linearly with unique viewers. (b) If the product intent is "anyone can play along", the memory leak is the real concern; if the product intent is "invited viewers only", access control is missing.
**Minimal safe fix:** (a) Validate `streamerId` exists & active before registering the client (`prisma.streamer.findFirst({ where: { id, isActive: true }, select: { id: true } })`). (b) Cap or LRU-evict stale `players` entries per streamer.
**Suggested QA:** Connect to `/nadle-ws?streamerId=does-not-exist`; expect close 4400.
**Priority:** P2.

---

**Finding ID:** BE-M5
**Severity:** Major
**Area:** Billing — `mark-paid` vs webhook race
**Files:** `apps/server/src/billing/billingService.ts:411-484`
**Evidence:** `markPaymentRequestAsPaid` flips `status → 'checking'` via `updateMany`, then calls `pollAndMatchOnce` outside a transaction. A concurrent Monobank webhook can be running `persistAndMatchStatementItem` → `tryAutoMatchTransaction` against the same `paymentRequestId`. Both legs are individually idempotent (Serializable matcher), but ordering of the final status is variable.
**What is wrong:** Race between user `mark-paid` and webhook arrival can produce inconsistent transient statuses (`auto_matched` vs `needs_review`). Money side is safe; UX is jittery.
**Minimal safe fix:** Wrap `mark-paid` status flip + immediate match in `prisma.$transaction({ isolationLevel: 'Serializable' })`.
**Priority:** P3 (defense in depth; matcher already protects the money side).

---

### 3.3 Minor

| ID | Area | File:line | Issue | Priority |
|----|------|-----------|-------|----------|
| SEC-7 | Admin / abuse | `adminRouter.ts:269-361` | `/api/admin/users/:userId/activity` has no rate-limit middleware while other admin endpoints have one — stolen cookie can bulk-pull every user's activity log | P2 |
| SEC-10 | Logs | `auth/oauthRouter.ts:147, 212, 277` | OAuth callback error logging includes raw upstream body; cap to 256 chars and strip auth headers | P3 |
| SEC-13 | Session | `auth/session/sessionJwt.ts:78` | 7-day stateless JWT, no server-side revocation; stolen cookie remains valid until natural expiry even after logout | P2 |
| SEC-14 | Billing | `billing/billingMatcher.ts:78-82` | Pro subscription extension has no upper bound — extends indefinitely | P3 |
| SEC-15 | Coin Hub | `coinHub/coinHubAdminGate.ts:48-67` | `COINHUB_MUTATION_BYPASS=1` activates whenever `NODE_ENV !== 'production'` — unset `NODE_ENV` matches that | P3 |
| SEC-16 | Admin economy | `economy/admin/adminEconomyRouter.ts:48-117` | `coinAmount` / `xpAmount` admin grants are clamped to `>= 0` but have no upper bound; clamp e.g. to 10_000_000 | P3 |
| SEC-17 | Session types | `auth/session/sessionJwt.ts:43` | `verifySessionToken` silently downgrades a JWT `role=host` claim to `user`; harmless today, footgun for future contributors | P3 |
| BE-Mi2 | Mafia transfer-offer | `signaling/messageHandlers.ts:975-1018` | `replaceDuplicatePeerId` (same-peerId reload path) does not clear pending Mafia transfer offers; bounded to 30s offer TTL | P3 |
| BE-Mi3 | Mafia rename | `signaling/messageHandlers.ts:3462-3491` | `mafia:player-name-update` does not route through `sanitizeDisplayName` (unicode/RTL spoofing) | P3 |
| BE-Mi5 | Eat First | `signaling/messageHandlers.ts:3018-3077` | `handleEatFirstActionCardUse` broadcasts before DB write commits; restart between broadcast and persist permits replay | P3 |
| BE-Mi10 | Eat First | `signaling/messageHandlers.ts:3155-3192` | `handleEatFirstTableRoundDeal` passes `null` ownerUserId for anonymous hosts; gated today by `isEatFirstHostPeer` | P3 |
| BE-M6 | Leaderboard | `leaderboardRouter.ts:175-205, 256-292, 553-609` | `$queryRaw` streak queries have no LIMIT; grows linearly with rounds | P3 |
| RT-F4 | Server authority echo | `messageHandlers.ts:3849` | Server rejects `set-outbound-video-paused: false` when `forcedCameraOff` but does not echo back to the rejecting sender, contributing to RT-F10 drift | P2 |
| RT-F1 | Display names | `useCallEngine.ts:615-620` + `callSession.ts` | `mergeRemotePeersFromProducerSync` merges across producer-syncs without replacing, allowing stale names across implicit room switches | P3 |
| RT-F2 | Device listener leak | `useLocalMedia.ts:134-136` | `navigator.mediaDevices.devicechange` listener attached at module body — HMR-only concern, not production | P3 |
| RT-F6 | Reconnect | `useCallEngine.ts:941` | Double soft `request-producer-sync` after reconnect (one in wire, one in visibility scheduler) — redundant but idempotent | P3 |
| RT-F12 | Send transport | `useSendTransport.ts:298` | `transport.on('produce')` hardcodes `videoSource: 'camera'`; race window on reconnect mid-screen-share | P2 |
| RT-F17 | Stats path | `useRemoteMedia.ts:1724` | Sequential `consumer.getStats()` calls in the pressure tick — parallelize for 8–12 camera rooms | P3 |
| RT-F27 | Wire semantics | `messageHandlers.ts:3816` | `request-producer-sync` default semantics differ between client and server (`soft` vs implicit) | P3 |
| FE-M5 | Storage helpers | `features/checkers/pages/CheckersPage.vue:739-756` | Raw `localStorage.getItem`/`setItem` instead of `readStorageJson`/`writeStorageJson` | P3 |
| FE-M6 | Storage helpers | 12 files (see frontend report) | Bypassed shared storage helpers; `useBillingNotifications.ts:78` & `useAdminMode.ts:23` lack `typeof localStorage === 'undefined'` guard | P3 |
| FE-M7 | Perf | `composables/useNadleState.ts:157-170` | Deep watcher persists local round to localStorage on every keystroke; debounce by 250ms or drop `guessInput` from the watcher | P3 |
| FE-M8 | A11y | `components/mafia/MafiaHostPanel.vue:469-549` | Draggable/collapsible host panel is pointer-only; bind `Escape` to collapse, support keyboard reposition | P2 |
| FE-M9 | Render alloc | `components/call/CallPage.vue:2096-2107` | `tileLayoutStyle(row)` returns fresh objects in spotlight mode; allocate per active-speaker tick; profile before fixing | P3 |
| FE-C2 | Cross-route store | `composables/useMafiaCallHostUi.ts:153-155`; `components/call/CallPage.vue:2417-2420, 2432` | `onMafiaSetEliminationBackground` is not route-gated; an Eat First host clicking swatches writes to the Mafia store | P2 |
| SY-2 | Chat reward at scale | `economy/earn/chatRewardService.ts:36-50, 153-208` | Per-process in-memory counter; under horizontal scale a process that hits `idempotentReplay` never bumps its counter and may stall further chat rewards on that process for that user. DB idempotency key prevents double-credit, but reward throughput may halve. | P3 (Question) |
| SY-3 | Eat First slot auth | `eatFirst/service.ts:239-244` | `tok !== storedTok` and `dev !== storedDev` are not constant-time compares. Random viewer tokens make timing attack impractical, but `crypto.timingSafeEqual` is the standard pattern. | P3 |

### 3.4 Questions

| ID | Question | Where to confirm |
|----|----------|------------------|
| Q1 | Is `MAX_ATTEMPTS_PER_ROUND` enforceable inside `submitGuess` if `expectedGameId` flips mid-round? | `apps/server/src/nadle/gameStore.ts:209-225` |
| Q2 | Is `handleGameRoomTransferHost` invoked by any current client UI? Determines whether BE-M1 is foundation-only or release-blocking. | grep `gameroom:transfer-host` in `apps/client/src` |
| Q3 | `clientEventsRouter.ts:373-403` resolves the Prisma user via DB lookup on every analytics POST. Cache per cookie? | `apps/server/src/clientEventsRouter.ts:373-403` |
| Q4 | Eat First `(joinToken, deviceId)` model — is the product intent "slot anyone with the credentials, including device transfer" or "device-bound"? | `apps/server/src/eatFirst/service.ts:198-244` |
| Q5 | Mafia `oldMafiaMode` toggle on the same game (no fork): is there a need to persist mode flip across reconnect (FE-M4)? | `apps/server/src/rooms/Room.ts:150-…` (`mafiaMode` field) |
| Q6 | Backend agent's M3 claim — mic-mirror not cleared on revive. **Verified false:** `Room.ts:841-845` `clearMafiaForceStateForUser` clears BOTH `mafiaForcedCameraOffUserIds` and `mafiaForcedMicMutedUserIds`. Recorded as Question for record-keeping. | `apps/server/src/rooms/Room.ts:841-845` |
| Q7 | CSRF guard XRW fallback in `apps/server/src/index.ts:176-180` — is the X-Requested-With path still needed? Today no client lacks Origin. | `apps/server/src/index.ts:160-185` |
| Q8 | `BillingPage.vue` 648 LOC + `CoinHubPage.vue` 581 LOC + `NadleStreamPage.vue` 2353 LOC — are these page-owned business logic violations or expected for their domains? `NadleStreamPage.vue` is by far the heaviest and likely contains streamer-context wiring that could move to an orchestrator. | `apps/client/src/pages/NadleStreamPage.vue` |

---

## 4. Prioritized roadmap

### Top 10 must-fix (in order)

1. **SEC-2** — XFF rate-limit bypass. One-line fix in `apps/server/src/utils/rateLimit.ts`.
2. **SEC-1** — Duplicate `parseAdminDateParam`. Delete lines 170-176 of `apps/server/src/adminRouter.ts`.
3. **FE-C1** — Game Template elimination-background emit binding. Add one line + one handler.
4. **FE-M2** — `coin-hub` route auth gate. Add `requiresAuth: true` to `apps/client/src/router.ts:182`.
5. **RT-F9 / RT-F10** — Self-tile UX drift on force-mute / force-cam-off. Single watcher fix each.
6. **BE-M1** — GameRoom transfer-host parity. Add offer store + split handler. Foundation invariant.
7. **BE-M4** — Mono webhook inbox reaper (`setInterval` retry).
8. **FE-M3** — Auth network-fail false-logout. Don't flip `loaded=true` on network throw with `user===null`.
9. **FE-M4** — Mafia overlay-empty flash on refresh. Gate on `snapshotReceived`.
10. **SY-1** — Plan the CallPage/GameTemplateCallPage de-duplication. Until then, add a CI parity test on emit bindings.

### P0 (today)

Nothing in P0. No active money-leak, no auth bypass, no media-stack break.

### P1

SEC-2, FE-C1, RT-F9, RT-F10, BE-M1, SEC-1.

### P2 cleanup / refactor

FE-M2, BE-M4, FE-M3, FE-M4, SEC-7, SEC-13, FE-M8, FE-C2, BE-M2, BE-M5, RT-F4, RT-F12, SY-1.

### What should NOT be touched now

- `packages/call-core/src/useCallEngine.ts` — the engine is 1744 lines and dense with reconnect / device-load / publish-tier logic. Do not refactor without an explicit task; only land the RT-F9 / RT-F10 / RT-F12 surgical patches.
- `apps/server/src/rooms/Room.ts` (1360 LOC) — single SSOT for Mafia + GameRoom + EatFirst host state, force-state mirrors, audio-mix rebind. Touch only as part of BE-M1.
- `apps/server/src/signaling/messageHandlers.ts` (5070 LOC) — dispatcher. Surgical changes only.
- `apps/client/src/pages/NadleStreamPage.vue` (2353 LOC) — historical page; refactor only if the task explicitly asks (`.cursor/rules/streamassist-engineering-rules.mdc` §3 / §4).
- `apps/client/src/components/call/CallPage.vue` (2558 LOC) — only land C1 / F9 / F10 / route-gate patches; full restructure is its own project.
- Anything billing related — except BE-M4 reaper.

### Suggested task split by branch

```text
Branch:           fix/auth-xff-rate-limit-leak
Worktree slot:    sa-fix
Scope:            SEC-2 only — make getClientIp return req.ip
Files to change:  apps/server/src/utils/rateLimit.ts
Files to inspect: apps/server/src/index.ts (trust proxy=1), all rate-limit call sites
Risk:             Low — single function; behavior under single trusted proxy is identical
Checks:           tsc; npm run test:ci; manual curl with rotating XFF
Manual QA:        Hit /api/auth/login 15× with X-Forwarded-For: $RANDOM; expect 429 after 10th

Branch:           fix/adminrouter-duplicate-parseAdminDateParam
Worktree slot:    sa-fix
Scope:            SEC-1 — remove duplicate function declaration
Files to change:  apps/server/src/adminRouter.ts (delete lines 170-176)
Risk:             Trivial
Checks:           tsc on apps/server

Branch:           fix/game-template-elimination-background-binding
Worktree slot:    sa-fix
Scope:            FE-C1 — wire missing emit
Files to change:  apps/client/src/components/game-template/GameTemplateCallPage.vue
                  (optionally a new useGameTemplateCallHostUi.ts mirroring useMafiaCallHostUi.ts)
Files to inspect: apps/client/src/components/call/ParticipantTile.vue
Risk:             Low
Manual QA:        Game Template host eliminates, clicks swatch → background updates

Branch:           fix/coin-hub-route-auth-gate
Worktree slot:    sa-fix
Scope:            FE-M2 — add requiresAuth: true
Files to change:  apps/client/src/router.ts (line 182)
Risk:             Trivial
Manual QA:        Incognito navigate to /app/coin-hub → expect redirect to /auth

Branch:           fix/call-self-tile-server-mute-drift
Worktree slot:    sa-fix
Scope:            RT-F9 + RT-F10 — self-sync local toolbars from server force-state
Files to change:  packages/call-core/src/useCallEngine.ts (peer-audio-muted reducer)
                  packages/call-core/src/media/useRemoteMedia.ts (peer-outbound-video-paused reducer)
                  Optional: apps/server/src/signaling/messageHandlers.ts:3849 (echo to rejecting sender — RT-F4)
Risk:             Medium — must not regress local pre-server toggle UX; verify camera-toggle watcher reconciles
Manual QA:        Mafia 2-tab; host force-mute victim → victim toolbar shows muted; victim clicks unmute → toolbar reverts

Branch:           feat/game-room-transfer-host-offer
Worktree slot:    sa-feature
Scope:            BE-M1 — parallel of mafiaTransferOfferStore + offer/accept/reject handlers
Files to change:  apps/server/src/signaling/gameRoomTransferOfferStore.ts (new)
                  apps/server/src/signaling/messageHandlers.ts
                  apps/server/src/signaling/clientMessageSchema.ts
                  apps/server/src/signaling/socketServer.ts
Files to inspect: apps/server/src/signaling/mafiaTransferOfferStore.ts (canonical)
Risk:             Medium — wire-contract change, but no client invokes today
Manual QA:        Two tabs; gameroom:transfer-host → expect pending offer to target; reject; expire

Branch:           fix/mono-webhook-inbox-reaper
Worktree slot:    sa-fix
Scope:            BE-M4 — setInterval reaper for unprocessed inbox rows
Files to change:  apps/server/src/billing/monoWebhookInbox.ts
                  apps/server/src/billing/billingRouter.ts (start/stop reaper on bootstrap)
Risk:             Low — bounded by `attempts < N`
Manual QA:        Force ingest throw; row stays attempts=1; restart; reaper retries

Branch:           fix/useauth-network-failure-grace
Worktree slot:    sa-fix
Scope:            FE-M3 — don't flip loaded=true on network throw with user===null
Files to change:  apps/client/src/composables/useAuth.ts (refreshOnce)
Risk:             Low — confined to one branch
Manual QA:        DevTools Offline + page reload on /app/mafia → expect retry, not /auth redirect

Branch:           fix/mafia-old-mode-snapshot-hydrate
Worktree slot:    sa-fix
Scope:            FE-M4 — gate overlay-empty placeholder on snapshotReceived
Files to change:  apps/client/src/stores/mafiaGame.ts
                  apps/client/src/pages/MafiaPage.vue (line 20)
Risk:             Low — purely additive
Manual QA:        Mafia non-host refresh mid-game → overlay reappears within 1s, no empty flash

Branch:           chore/duplicated-callpage-parity-test
Worktree slot:    sa-fix
Scope:            SY-1 — add CI parity test that flags CallPage ↔ GameTemplateCallPage emit-binding drift
Files to change:  packages/client-consistency/callPageGameTemplateParity.test.ts (new)
Risk:             Trivial — test only
```

---

## 5. QA matrix

For any change touching the surfaces below, run these rows from `/ai/QA_CHECKLIST.md` plus the audit-specific additions.

| Change scope | QA rows from `/ai/QA_CHECKLIST.md` | Audit-specific additions |
|---|---|---|
| `packages/call-core/**`, `CallPage.vue` | C1–C18, W1–W5 | RT-F9 / RT-F10 scenarios (host force-mute/cam-off victim → check victim toolbar). Run on BOTH `/app/mafia` AND `/app/game-template`. |
| Mafia signaling | Mafia §3, W1–W5 | Verify Mafia 2-phase transfer-host accept / reject / expire / cancel; refresh during pending offer (BE-Mi2). |
| GameRoom signaling | n/a yet | BE-M1: confirm no client invokes `gameroom:transfer-host`; if any does, treat as P1 release blocker. |
| Eat First | Eat First §3 | FE-C2: Eat First host clicks elimination-background swatch — verify intended cross-route behavior. |
| Nadle | Nadle §3 | BE-M2: connect with non-existent `?streamerId=` and with arbitrary streamerId — verify rejection and no memory growth. |
| Auth | §4 (full) | SEC-2 XFF bypass; FE-M3 offline-reload; SEC-5 Google email collision. |
| Coin Hub / economy | §5 (full) | FE-M2 incognito → /app/coin-hub redirect. |
| Billing | §5a (full) | BE-M4: force `ingestStatementWebhook` throw → reaper recovery; BE-M5: race `mark-paid` against webhook arrival. |
| A11y | §6 | FE-M8: keyboard navigation of MafiaHostPanel; Escape collapses. |
| Build / type | §7 | `tsc --noEmit` on `apps/server` to confirm SEC-1 fix; full `npm run ci`. |

---

## 6. Final verdict

| Dimension | Score /10 | Notes |
|---|---:|---|
| Architecture | 8.0 | Clear SSOT per domain; pages thin for new code; historical pages preserved (`NadleStreamPage.vue` heavy). Mafia/GameTemplate duplication is the largest scaling risk. |
| Realtime stability | 8.5 | Reconnect + visibility + focus policy is rigorous; `replaceDuplicatePeerId`, owner-lock + DB backstop, schema-drift sampling, error-budget eviction. |
| WebRTC / media | 8.5 | One stack (`call-core`); serialized recv queue; merge-only producer-sync; `<video>` element identity stable. RT-F9/F10 are UX drift, not media leaks. |
| Security / server authority | 8.5 | Strong: client `userId` ignored in `join-room`, leaderboard POST removed, predictions Serializable, billing fail-closed. SEC-2 XFF is the only sharp edge. |
| Performance | 7.5 | Solid receive-pressure / adaptive simulcast; some hot watchers and a long CallPage `:class` block; minor per-keystroke storage write. |
| Feature boundaries | 7.0 | Mafia / GameTemplate fork is concrete duplication; FE-C2 demonstrates cross-route mutation; otherwise reasonable. |
| OBS / viewer readiness | 8.5 | Viewer role correctly skips send transport; hard-resync is skipped for OBS view; overlays consume prepared state. |
| Monetization / economy safety | 9.0 | Ledger + idempotency + Serializable; Mono fail-closed; predictions atomic; webhook inbox durable (lacks retry loop — BE-M4). |
| Test coverage confidence | 6.0 | Pure-rule packages well-covered (`*-consistency` suites); UI / media / mediasoup integration tests intentionally absent; admin / billing have only smoke. The QA checklist is well-curated but manual. |

**What is already strong**
- One media stack, one room model, one signaling parser. Owner-lock + DB backstop survives restarts.
- Ledger correctness is enforced via `applyDelta` + idempotency keys; cannot drop balance below zero.
- Mono webhook fail-closed in production; constant-time secret compare; raw payload stored before processing.
- WS schema enforced via Zod on `/ws`; sampled drop-event telemetry; per-socket rate-limit categories.
- OAuth state replay rejection + nonce binding; CSRF gate via Origin/X-Requested-With; admin-mutation rate limiter.
- Call reconnect + visibility/focus policy is rigorous and tested against the cursor rules.
- Twitch chat reward path has idempotency keys, in-process caps, cooldown, and duplicate-text dedupe.

**What is fragile**
- `getClientIp` (SEC-2) — the single line that defeats all IP rate-limits.
- The CallPage / GameTemplateCallPage fork — drift already happened (FE-C1).
- The Mono webhook is durably enqueued but processed inline only (BE-M4).
- Mafia overlay state on refresh (FE-M4).
- 7-day stateless JWT with no revocation (SEC-13) — a stolen cookie outlives manual logout.

**What is blocking production confidence**
- Nothing immediately — SEC-2 is the highest active risk, fixed in one line.
- A small operational paper-trail concern: confirm the Cloudflare Logpush rule strips `?secret=` and that `MONO_WEBHOOK_SECRET` has a rotation runbook (SEC-6).

**What is blocking scaling**
- Architectural duplication (SY-1) doubles maintenance cost per CallPage feature.
- `nadleSocket` unbounded `players` map per streamerId (BE-M2) — long-running streamers grow memory linearly with unique viewers.
- Per-process chat-reward counter (SY-2) — multi-instance deploys may halve reward throughput before the DB idempotency key catches duplicates.

**What is blocking monetization**
- BE-M4 (Mono webhook retry) — a transient DB blip strands a paying user's activation.
- SEC-6 operational: secret rotation runbook + log redaction confirmation.
- Nothing structural — the matcher is correct and atomic.

**What is blocking good streamer UX**
- FE-C1 / FE-C2 / FE-M4 — visible glitches on Mafia / Eat First / Game Template host surfaces.
- FE-M8 — Mafia host panel is keyboard-inaccessible.
- RT-F9 / RT-F10 — self-tile force-state drift, observable by any victim.
- FE-M2 — guests can't even reach the coin hub.

---

## 7. Open questions for the product / engineering owner

1. **Eat First slot auth model** (Q4) — is `(joinToken, deviceId)` an intentionally transferable credential or device-bound? Today it allows transfer (anyone with both wins). Verify.
2. **GameRoom transfer-host UI** (Q2) — is any client invoking `gameroom:transfer-host` today? If yes, BE-M1 is P1 release blocker; if no, P2 foundation.
3. **Mafia mode hydration** (Q5) — should `oldMafiaMode` be hydrated from a `room-state` field on join, or is the current "host re-broadcasts on join" sufficient?
4. **Cross-route store coupling** (FE-C2) — is `mafiaGameStore.eliminationBackgroundByPeerId` intentionally shared between Mafia and Eat First? If yes, document and route-gate at the handler; if no, split into a neutral store.
5. **7-day session revocation** (SEC-13) — is a `sessionVersion` claim acceptable, or is the current statelessness deliberate?
6. **CallPage fork** (SY-1) — is there a plan to de-duplicate, or is the parity-test approach sufficient for the medium term?
7. **`/api/billing/config` auth** (SEC-9, dropped) — confirmed intentional? Logged-out visitors cannot read the Pro price.
8. **Chat reward per-process caps** (SY-2) — does the deploy run multiple Node processes? If yes, the in-process counter is best-effort and the DB idempotency key is the real cap.

---

*End of audit. No runtime code, configs, tests, or commits were modified. Branch `slot/sa-review` is at `789d5e4`.*
