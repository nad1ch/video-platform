# REVIEW_CHECKLIST.md — PR / diff review

Use for every diff before claiming "done", and for every PR you review.

## 1. Scope

- [ ] Diff matches the task described. No unrelated edits, no drive-by formatting.
- [ ] If a refactor was bundled with a behavior change, push back: separate PRs.
- [ ] No new files unless the task needed them.
- [ ] No "while I'm here" cleanup.
- [ ] **For multi-agent / worktree work**: the PR cites its ownership map (which files this workstream owned), the branch base, and the planned merge order. No file in this PR was also owned by another concurrent workstream. No high-risk surface (per §6 of this checklist and [`/ai/CLAUDE.md`](CLAUDE.md) §3) overlaps with another workstream. See [`/ai/WORKTREES_PARALLEL_AGENTS_WORKFLOW.md`](WORKTREES_PARALLEL_AGENTS_WORKFLOW.md).

## 2. Runtime bugs

- [ ] No uninitialized reads (Vue `ref()` accessed before set; server `req.user` before auth).
- [ ] No off-by-one in lists, paginations, timer counts.
- [ ] No silent `catch {}` swallowing errors.
- [ ] No `any` added on a function boundary without justification.
- [ ] Boolean parameters labeled at call sites (or replaced with an enum).
- [ ] No floating promises (`await` or `void` everywhere it matters).
- [ ] No `setTimeout` / `setInterval` without a paired clear path.

## 3. Async / race conditions

- [ ] Every async action checks all six guards before applying its result: **pending**, **disposed**, **socket** (still the one that initiated the request), **room** (still the one the request was scoped to), **revision** (state version still current), **role/permission** (caller still has authority).
- [ ] Stale-socket guards present where a new socket may replace an old one.
- [ ] Single-flight guards on reconnect, join, screen-share start, host transfer.
- [ ] No reconnect-on-focus when the socket is alive.
- [ ] Reactive watchers do not loop (`A → B → A`).
- [ ] No "fire-and-forget" inside `onMounted` without a paired `onUnmounted` cleanup.

## 4. Duplicate side effects / source of truth

- [ ] One trigger → one side effect. No duplicate `join-room`, `producer-sync`, leaderboard write.
- [ ] No second source of truth (e.g., a new participant map next to `call-core`'s).
- [ ] Display names use `call-core` helpers (`buildDisplayNameUiMap`, `resolvePeerDisplayNameForUi`, `normalizeDisplayName`).
- [ ] `roomId` / `streamerId` normalized via existing helper, not a new local one.
- [ ] Storage access uses `storageJson` / existing helpers, not raw `localStorage` / `sessionStorage`.

## 5. API / WebSocket contracts

- [ ] If client message names changed, server parser changed in the same diff.
- [ ] If server emit changed, client receiver changed in the same diff.
- [ ] No new WS message strings without protocol constants.
- [ ] No new REST endpoints without server-side validation (Zod or equivalent).
- [ ] No new query params silently changing client behavior.
- [ ] No new storage key without documenting it.

## 6. Security / server authority

- [ ] No client-provided `userId`, `streamerId`, `host`, `role`, `score`, `winner` accepted without server validation.
- [ ] Mutation endpoints check authenticated user + ownership.
- [ ] Public viewer flows preserved (do not silently lock them).
- [ ] No secrets / tokens / cookies / OAuth codes logged.
- [ ] Rate limits considered for any new HTTP / WS mutation entry point.
- [ ] OAuth redirects sanitized via existing helper.
- [ ] Admin / host gating uses server checks (`resolveUserRole`, ownership helpers), not client flags.
- [ ] If the diff introduces or uses an MCP / connector / tool integration (browser MCP, repo connector, logs / Sentry, DB, internal API, docs platform, design tool), the reviewer verified: permissions (least privilege), data exposure (no secrets / PII), production access (read-only or HITL-gated), and the fallback path (the workflow still works without the connector). See [`/ai/MCP_CONNECTORS_WORKFLOW.md`](MCP_CONNECTORS_WORKFLOW.md).

### Known production risk surfaces — re-verify when touched

These are existing, currently-live trust boundaries called out in `.cursor/rules/streamassist-engineering-rules.mdc` §12. If the diff touches any of them, walk it specifically — generic server-authority rules are not enough.

- **Leaderboard writes (`/api/wins`, `apps/server/src/leaderboardRouter.ts`).** Client-supplied `streamerId`, `result`, `attempts` are accepted today; re-verify idempotency and server-side bindings before any change.
- **Checkers matchmaking and winner / result authority** (`apps/server/src/checkers/checkersMatchmaking.ts`, `checkersSocket.ts`, `leaderboardRouter.ts`). Submitter membership and idempotency are checked; final-board verification is the gap to watch.
- **`join-room` userId / displayName / avatar trust boundary** (`apps/server/src/signaling/messageHandlers.ts`, `apps/server/src/peers/*`). Client-provided identity is accepted as display metadata; do not promote it to authority. Re-verify any change that uses these fields for authorization.
- **Mafia host transfer / owner authority** (`apps/server/src/rooms/Room.ts`, Mafia stores/components). Host lock is server-side; transfer paths are high risk for accidental client trust.
- **Eat First device-id / slot action authority** (`apps/server/src/eatFirst/router.ts`, `apps/server/src/eatFirst/service.ts`). Player `hand` / `ready` / `claim` / `vote` rely on device identifiers, not signed users. This may be intentional for public viewer participation — confirm with product before tightening.
- **Billing / webhook trust boundaries** (`apps/server/src/billing/*`). Webhook signature verification, idempotency keys, and replay protection must be confirmed before any change to billing handlers.
- **Admin role resolution and email verification** (`apps/server/src/auth/resolveUserRole.ts`, `apps/server/src/auth/session/*`, `apps/server/src/auth/email/*`). Admin elevation must trace to a server-resolved role; never to a client-claimed flag or unverified email.

## 7. Performance / video remount risk

- [ ] `<video>` keys stable (`peerId`-based, not `playRev`-based).
- [ ] No `srcObject` cleared except in established cleanup paths.
- [ ] Big reactive structures use `shallowRef` (`MediaStream`, `Map`, `Set`).
- [ ] No O(N*M) participant / role / media maps in templates.
- [ ] No new watchers that clone / stringify large structures on every media tick.
- [ ] OBS / viewer mode still receive-only; controls hidden but server still enforces.
- [ ] 8–12 camera grid not degraded by template-time recomputation.
- [ ] CSS animations and full-screen effects bounded; reduced-motion respected.

## 8. Cleanup / reset / guards

- [ ] Every `addEventListener` has a paired `removeEventListener`.
- [ ] Every timer (`setTimeout` / `setInterval` / `requestAnimationFrame` / RVFC) has a clear path.
- [ ] Every `socket.onmessage` ignores stale callbacks after `socket.close()`.
- [ ] `onUnmounted` / dispose handlers cover every long-lived resource added.
- [ ] State reset between room joins / reconnects, not accumulated across them.

## 9. Tests / QA

- [ ] If touching pure rules (Nadle, Checkers, call-core policies, Eat First), a `packages/*-consistency` test exists or was added.
- [ ] **If the PR fixes a bug**, a regression test that *failed before the fix* is included — OR the PR documents a clear "not automatable" reason and attaches manual QA evidence (browser before / after, QA rows). See [`/ai/REGRESSION_TEST_WORKFLOW.md`](REGRESSION_TEST_WORKFLOW.md).
- [ ] No existing test was rewritten, weakened, or deleted to make CI green or to hide the bug.
- [ ] If touching realtime / UI, manual QA steps are listed (see `/ai/QA_CHECKLIST.md`).
- [ ] No test was modified to make it pass.
- [ ] `npm run test:ci` mentioned and run if pure logic changed.
- [ ] `npm run lint` mentioned and run if broad client / server changes.
- [ ] `npm run build -w client` mentioned and run if client integration touched.

## 10. Realtime-specific (any diff touching call-core, signaling, or game WS)

- [ ] Transport ordering preserved (join → room-state → device → recv → publish).
- [ ] Reconnect / backoff policy preserved.
- [ ] Screen-share serialization preserved.
- [ ] `replaceOutboundVideoTrack` not bypassed.
- [ ] JSON ping/pong (`replyJsonPingIfNeeded`) preserved.
- [ ] Visibility / focus policy preserved.
- [ ] No new media stack outside `call-core`.

## 11. Reject signals

If any of these appear, reject or send back for rework:

- A new media stack outside `call-core`.
- A page-owned WebSocket state machine.
- Cross-feature imports for convenience.
- Client-only authority for host / admin / result / reward.
- Hidden protocol changes (client moved, server didn't, or vice versa).
- Video keys based on stream revisions.
- `localStorage` / `sessionStorage` raw access when a helper exists.
- "Refactor" PR that also changes behavior.
- Russian-language strings in product, docs, comments, or tests.
- Tests modified to silence failures.
- `--no-verify`, `--no-gpg-sign`, or skipped hooks without a stated reason.
