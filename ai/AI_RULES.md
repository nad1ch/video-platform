# AI_RULES.md — Global engineering rules for AI in this repo

These rules complement `.cursor/rules/streamassist-engineering-rules.mdc` and `.cursor/rules/ai-superpower-workflow.mdc`. They define how AI agents move through tasks. They are non-negotiable.

## 0. Branch first

Create a new logical git branch before editing code. Do not edit on `main` or any shared integration branch. Branch naming format and allowed types (`fix/`, `feat/`, `perf/`, `refactor/`, `test/`, `docs/`, `chore/`) are canonical in [`.cursor/rules/ai-superpower-workflow.mdc`](../.cursor/rules/ai-superpower-workflow.mdc) §1 — follow it; do not restate it here.

Read-only analysis does not require a branch. Any task that will create or modify files does.

## 1. The pipeline

Every non-trivial task moves through six roles, in order. Do not skip:

1. **Researcher** — Read flow, identify SSOT, list files. No code yet.
2. **Debugger** — Only on bug tasks. Reproduce, isolate, hypothesize, **confirm** root cause. No code yet.
3. **Architect** — State the minimal plan: which files change, what stays the same, which contracts are touched, what risks remain.
4. **Implementer** — Apply minimal diff. No drive-by edits.
5. **Reviewer** — Self-review against `/ai/REVIEW_CHECKLIST.md` before reporting done.
6. **QA assistant** — Output the `/ai/QA_CHECKLIST.md` items relevant to the change and tell the user how to run them.

## 2. Scope discipline

- **One task = one scope.** If you find an unrelated bug, file it; do not silently fix it in the same diff.
- **One trigger = one side effect.** Never wire two cleanup paths to the same event. Never publish a track from two places. Never write the same leaderboard row from two callbacks.
- **No refactor + behavior change in one diff.** Split into two: behavior-preserving refactor first, then behavior change.
- **No drive-by formatting.** Do not reformat files you are not editing.
- **No "while I'm here" changes.** If it isn't in the task statement, it isn't in this PR.

## 3. Reuse before creating

Before writing new code, search:

- `packages/call-core/src` for media, signaling, participants, display names, screen share, reconnect.
- `apps/client/src/composables` for cross-cutting client helpers.
- `apps/client/src/utils` for `apiFetch`, `apiUrl`, storage helpers, loggers.
- `apps/client/src/stores` for Pinia stores.
- `apps/server/src/*/wsProtocol.ts` for protocol constants.
- `packages/*-consistency` for pure rule tests.

If you cannot find an existing helper, explain in the "Before editing" block why a new one is needed before adding it.

## 4. No duplicate logic

Never re-implement:

- WebSocket message strings (use protocol constants).
- `roomId` / `streamerId` / Twitch username normalization.
- Display-name fallback chains (use call-core display helpers).
- Screen-share start / stop / `ended` handling.
- Media lifecycle (produce / consume / teardown).
- `srcObject` assignment patterns.
- Storage read/write (`storageJson`, etc.).
- Authentication checks.
- Leaderboard write logic.

If you see a duplicate, prefer **deleting one** over adding a third.

## 5. No cross-domain imports

- Features may not import another feature's internals. If shared logic is real, extract to `packages/*-core` or `apps/client/src/composables`.
- Pages may not bypass orchestrators to reach `call-core` internals.
- Overlays may not own media transport. They consume prepared state.
- Server protocol constants belong beside their domain.
- **Do not migrate historical feature layouts unsolicited.** `pages/MafiaPage.vue`, `pages/NadleStreamPage.vue`, the `eat-first/` sub-app, and the historical `nadle/` module are current architecture. New features follow the feature-slice template (`features/<feature>/`); existing structure is preserved unless the task explicitly asks for migration.

## 6. Server is authority

The server is the source of truth for:

- User and session identity (signed httpOnly cookie).
- Room membership and host status.
- Streamer ownership and access.
- Game results, scores, rewards.
- Coin economy and rate limits.
- Mafia host lock, Checkers winner, Eat First snapshot.

Client role flags (`role: 'host'`, `isHost`, `viewerMode`, `mode=viewer`) are **UI hints only**. Never treat them as authority. Never accept client-provided `userId`, `streamerId`, or `score` without server-side validation.

For security-sensitive work, output:

```text
Risk:
Exploit scenario:
Impact:
Minimal fix direction:
Files involved:
Priority (P0–P3):
```

## 7. Realtime invariants

- `packages/call-core` is the **only** place WebRTC / mediasoup logic may live on the client.
- Stable `<video>` element identity: key tiles by `peerId`, not by stream revision or `playRev`.
- Do not clear `srcObject` to "fix" UI bugs. It is part of media lifecycle, not UI state.
- Serialize screen-share start / stop via `useCallScreenShare`. Do not bypass `ended` handling.
- On reconnect: close stale sockets, ignore stale callbacks, clear timers on dispose.
- JSON ping/pong must follow `replyJsonPingIfNeeded` (Cloudflare / Nginx 25s idle assumption).
- Visibility / focus policy: visible + open → soft resync; visible + closed → reconnect; focus alone does NOT reconnect a dead socket.

## 8. Output discipline

The canonical "Before editing" and "After editing" output contract lives in [`/ai/CLAUDE.md`](CLAUDE.md) §2. Use it verbatim on every task — do not paraphrase, abbreviate, or skip fields.

For security-sensitive work, also output the risk block from §6 above (`Risk / Exploit scenario / Impact / Minimal fix direction / Files involved / Priority`).

## 9. Forbidden behaviors

- Coding before discovery.
- Coding before root cause is confirmed (bugs).
- Inventing API / WS message names or shapes.
- Inventing Prisma fields or env vars.
- Silent contract changes.
- Cross-domain imports for convenience.
- A new media stack outside `call-core`.
- Page-level WebSocket state machines.
- Watchers used as implicit state machines without cleanup.
- Reconnect loops without single-flight guards.
- Removing a guard you do not understand.
- Russian-language strings in code, docs, or tests.
- Claiming "tests pass" without running them.
- Force-pushing, `git reset --hard`, merging, or pushing without explicit user request.
