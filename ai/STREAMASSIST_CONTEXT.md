# STREAMASSIST_CONTEXT.md — What you are working in

A short tour. For deep architecture, see `.cursor/rules/streamassist-engineering-rules.mdc`.

## 1. What this is

StreamAssist is **not just a Vue app**. It is a realtime interactive streaming platform.

- Real users on cameras and microphones via WebRTC.
- Real Twitch chat ingested live.
- Real OBS browser sources rendering overlays.
- Multiple games running concurrently in the same call: Mafia, Eat First, Nadle, Nadraw Show, Checkers, plus future games.
- Rooms can have 8–12 active cameras plus viewers.

Breaking the call surface breaks streams in production. Treat it accordingly.

## 2. Top-level layout

```text
apps/
  client/        # Vue 3 + Vite, mounts at /app/*
  server/        # Node + Express, mediasoup workers, WS servers
packages/
  call-core/             # SSOT for WebRTC / mediasoup on the client
  call-core-consistency/ # pure-logic tests for call-core
  checkers-core/         # pure Checkers rules
  nadle-core/            # pure Nadle rules
  ui-theme/              # shared theme
  client-consistency/    # pure shared client logic tests
  eat-first-consistency/ # pure Eat First logic tests
  nadle-consistency/     # pure Nadle logic tests
```

WebSocket upgrade routing is centralized in `apps/server/src/index.ts`:

| Path | Purpose |
|------|---------|
| `/ws` or `/` | Call signaling + Mafia messages |
| `/nadle-ws` | Nadle state / chat / leaderboard / session |
| `/eat-first-ws` | Eat First snapshots and actions |
| `/nadraw-show-ws` | Nadraw state / draw / chat / host actions |
| `/checkers-ws` | Checkers realtime |

## 3. Source-of-truth files (memorize)

### Media / WebRTC (HIGH RISK)

- `packages/call-core/src/useCallOrchestrator.ts`
- `packages/call-core/src/useCallEngine.ts`
- `packages/call-core/src/signaling/useRoomConnection.ts`
- `packages/call-core/src/media/useMediasoupDevice.ts`
- `packages/call-core/src/media/useRemoteMedia.ts`
- `packages/call-core/src/transport/useSendTransport.ts`
- `packages/call-core/src/screenShare/useCallScreenShare.ts`
- `packages/call-core/src/reconnectOrchestrationPolicy.ts`
- `packages/call-core/src/stores/callSession.ts`

### Call UI

- `apps/client/src/components/call/CallPage.vue`
- `apps/client/src/components/call/ParticipantTile.vue`
- `apps/client/src/components/StreamVideo.vue`
- `apps/client/src/components/StreamAudio.vue`
- `apps/client/src/components/call/useMediaStallRecovery.ts`
- `apps/client/src/composables/game-room/useRemoteTileBudget.ts` (runtime SSOT for the remote-tile budget; viewport visibility + server-side `setPeerVisible` hysteresis)

### Server signaling (HIGH RISK)

- `apps/server/src/index.ts` (WS upgrade routing)
- `apps/server/src/signaling/socketServer.ts`
- `apps/server/src/signaling/messageHandlers.ts`
- `apps/server/src/signaling/clientMessageSchema.ts`
- `apps/server/src/signaling/mafiaWsProtocol.ts`
- `apps/server/src/signaling/gameRoomWsProtocol.ts`
- `apps/server/src/signaling/mafiaRoomOwnerStore.ts` (in-memory owner identity per `roomId` — owner-lock SSOT across `Room` finalization)
- `apps/server/src/signaling/gameRoomOwnerStore.ts` (same shape for the generic game-room namespace)
- `apps/server/src/rooms/Room.ts` (also owns Mafia host state)
- `apps/server/src/mediasoup/*`
- `apps/server/src/peers/*`

### Auth (HIGH RISK)

- `apps/client/src/composables/useAuth.ts`
- `apps/server/src/auth/*`

### Leaderboard / economy (HIGH RISK)

- `apps/server/src/leaderboardRouter.ts`
- `apps/server/src/coinHub/*`
- `apps/server/src/billing/*`

### Per-game ownership

| Game | Client | Server | WS path |
|------|--------|--------|---------|
| Mafia | `pages/MafiaPage.vue`, `stores/mafiaGame.ts`, `stores/mafiaPlayers.ts`, `composables/mafiaWsProtocol.ts`, `components/mafia/*` | `rooms/Room.ts` Mafia state, `signaling/mafiaWsProtocol.ts`, `signaling/mafiaRoomOwnerStore.ts` | shares `/ws` |
| Game Template (Mafia fork) | `pages/GameTemplatePage.vue`, `stores/gameTemplateGame.ts`, `stores/gameTemplatePlayers.ts`, `composables/gameRoomWsProtocol.ts`, `components/game-template/*`, `components/game-room/*` | shares `Room.ts` game-room state, `signaling/gameRoomWsProtocol.ts`, `signaling/gameRoomOwnerStore.ts` | shares `/ws` (`gameroom:*` namespace) |
| Eat First | `eat-first/` sub-app | `apps/server/src/eatFirst/*` | `/eat-first-ws` |
| Nadle | `pages/NadleStreamPage.vue`, `nadle/`, `packages/nadle-core` | `apps/server/src/nadle/*` | `/nadle-ws` |
| Nadraw Show | `features/nadraw-show/`, `pages/NadrawShowPage.vue` | `apps/server/src/nadraw-show/*` | `/nadraw-show-ws` |
| Checkers | `features/checkers/`, `packages/checkers-core` | `apps/server/src/checkers/*` | `/checkers-ws` |

## 4. Architectural principles

- **Pages are thin.** They call `use<Feature>Orchestrator()` and render prepared state.
- **Orchestrators own side effects.** WebSockets, timers, reconnects, role logic, cleanup.
- **Overlays do not own media.** They consume `call-core` state.
- **`call-core` is the only media stack.** Never build a parallel one.
- **Pure rules live in `packages/*-core`.** Not in components, not in pages.
- **Server is authority.** Client role flags are UI hints only.
- **Do not migrate historical layouts unsolicited.** `pages/MafiaPage.vue`, `pages/NadleStreamPage.vue`, the `eat-first/` sub-app, and the historical `nadle/` module are current architecture. New features should follow the feature-slice template (`features/<feature>/`), but old pages and components must not be moved or reshaped just for cleanup. Migration only happens when the task explicitly asks for it.

## 5. High-risk zones (treat as production live)

1. **`packages/call-core/**`** — any WebRTC / mediasoup change. Breaks join / publish / consume / screen-share / reconnect.
2. **`CallPage.vue`** — shared between Call and Mafia. Performance regressions cascade to 8–12 camera rooms.
3. **`StreamVideo.vue`** — playback, `srcObject`, stall recovery. Black tiles and CPU spikes live here.
4. **Server signaling** (`apps/server/src/signaling/*`, `rooms/Room.ts`) — wrong handler order breaks all calls.
5. **WS protocol contracts** — client sender and server parser must change together. Silent contract drift kills production.
6. **Auth / session** (`useAuth`, server `auth/*`, signed cookie) — breaks login, admin, host controls, Coin Hub.
7. **Streamer context** (Twitch ID / username normalization, `useNadleStreamerRoom`, `nadrawAccess.ts`) — breaks Nadle, Nadraw, Twitch ingest.
8. **Leaderboard** (`leaderboardRouter.ts`) — economy and rating integrity; client-driven writes are a known risk surface.
9. **Mafia host lock / Eat First snapshot / Checkers winner** — game-state authority.
10. **OBS / viewer mode routes** — browser sources are unforgiving; route must stay stable and lightweight.
11. **Cloudflare / Nginx assumptions** — JSON ping every ~25s; production `wss://`; upgrade routing in `apps/server/src/index.ts`.

### Per-feature risk levels (from `.cursor/rules/streamassist-engineering-rules.mdc` §4 / §19)

| Surface | Risk | Notes |
|---------|------|-------|
| Call / WebRTC core (`packages/call-core/**`) | **high** | join / publish / consume / screen-share / reconnect — cascade risk to every game. |
| Mafia | **high** | shares `CallPage.vue` and `/ws`; host-lock authority lives in `rooms/Room.ts`. |
| Checkers | **medium-high** | well-isolated engine, but `CheckersPage.vue` is large and wires call-core voice. |
| Eat First | **medium** (overlay / media touchpoints: medium-high) | deliberate sub-app; overlay/media path separate from main `CallPage`. |
| Nadle | **medium** | historical page/module layout; Twitch ingest critical. |
| Nadraw Show | **medium** | well-orchestrated; shares streamer-context patterns with Nadle. |
| Coin Hub | **low-medium** | clearer store / API / component boundary. |
| Auth / session / admin | **high** (critical when touched) | signed-cookie SSOT; admin elevation; email verification. |
| Billing / webhooks | **high** (critical when touched) | money flow; webhook signature + idempotency. |

### Verify before assuming

Four items look settled in the code but are not — confirm before relying on them:

- **Simulcast / spatial-layer signaling.** Confirmed active as of 2026-05-18: `packages/call-core/src/media/adaptiveSimulcastFeatureFlags.ts` exports `ENABLE_PUBLISHER_SIMULCAST = true`, `useRemoteMedia` sends `set-consumer-preferred-layers`, the Zod schema in `apps/server/src/signaling/clientMessageSchema.ts` accepts it, and the server dispatches to `handleSetConsumerPreferredLayers`. Before changing layer policy, still verify by sniffing one room's WS frames — feature flags can flip.
- **Client-side remote-tile playback budget.** Retired. The pure module `apps/client/src/components/call/videoPlaybackBudgetPolicy.ts` was removed in `fix/full-audit-remediation`; it had a passing unit test but no runtime importer. The runtime SSOT is `apps/client/src/composables/game-room/useRemoteTileBudget.ts`, which today actively manages viewport visibility + server-side `setPeerVisible` consumer pause (with 500 ms hide-hysteresis). Its `videoPlaybackSuppressedForPeer` getter currently always returns `false` — element-level `<video>.pause()` suppression is dormant by design. If you reintroduce a budget, wire it through `useRemoteTileBudget`, never a parallel module.
- **`playbackSuppressed` semantics.** This flag is meant to pause/suppress playback at the element level only. It must not stop consumers, close producers, tear down transport, or unsubscribe — those are media-lifecycle actions. If a change makes `playbackSuppressed` trigger any of those, push back.
- **Twitch login auto-Streamer is follower-gated.** `apps/server/src/auth/persistOAuthUser.ts:persistTwitchOAuthUser` only auto-**creates** or auto-**reactivates** a `Streamer` row when the channel meets the follower threshold. The OAuth callback in `apps/server/src/auth/oauthRouter.ts` calls `twitchFetchFollowerCount(accessToken, profile.id)` (Helix `GET /helix/channels/followers?broadcaster_id=<id>`; relies on the self-broadcaster exception so no extra OAuth scope is requested) and passes the total via `PersistTwitchOAuthUserOptions.followerCount`. Threshold defaults to 100 and is overridable via `TWITCH_STREAMER_MIN_FOLLOWERS`. Below threshold OR when the Twitch API failed (`followerCount == null`, fail-closed): the user still logs in normally as `USER`, but no Streamer is created, no `User.streamerId` is set, no `StreamerMember` `OWNER` upsert. Existing **already-active** Streamer rows are grandfathered — the refresh path runs as before and `isActive: true` is preserved, so admin-approved or previously-qualified streamers do not lose status if their follower count later drops. Google / Apple / email logins do NOT auto-create a Streamer. The derived `STREAMER` system role comes from `resolveUserStreamerContext` in `apps/server/src/auth/resolvePrismaUserFromSession.ts` (any active owned `Streamer` or `OWNER` membership). `DELETE /api/admin/streamers/:id` still only flips `isActive: false`; reactivation now requires the next Twitch login to meet the follower threshold (or an admin to re-grant `STREAMER` via `PATCH /api/admin/users/:id/role`).

## 6. Testing surface

```text
npm run test:client      # client / shared pure logic
npm run test:call        # call-core consistency
npm run test:nadle       # Nadle logic + Twitch guess
npm run test:eat-first   # Eat First pure logic
npm run test:ci          # all consistency suites
npm run ci               # tests + lint + client build
npm run build -w client  # client build only
npm run lint             # broad client / server lint
```

Server has no first-class test script. WebRTC internals are mostly not unit-tested by design. Pure-rule tests in `packages/*-consistency` are the safest place to add coverage.
