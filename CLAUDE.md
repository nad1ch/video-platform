# CLAUDE.md — Repository entry point for Claude Code

This repository has an AI operating system at `/ai`. Read it before doing anything.

The user's global `~/.claude/CLAUDE.md` still applies (minimal-diff, git/terminal safety,
hallucination guardrails, browser-debug allowlist, secret hygiene). The rules below are
**StreamAssist-specific** and override the global rules **only when more specific**.

## Read order

1. [`/ai/CLAUDE.md`](ai/CLAUDE.md) — how Claude works in this repo (workflow, output contract, model split).
2. [`/ai/AI_RULES.md`](ai/AI_RULES.md) — non-negotiable engineering rules.
3. [`/ai/STREAMASSIST_CONTEXT.md`](ai/STREAMASSIST_CONTEXT.md) — what the system is and its source-of-truth files.

Then, depending on the task:

- Debugging → [`/ai/DEBUG_PLAYBOOK.md`](ai/DEBUG_PLAYBOOK.md)
- Browser-observable bug → [`/ai/BROWSER_DEBUG_WORKFLOW.md`](ai/BROWSER_DEBUG_WORKFLOW.md)
- PR / diff review → [`/ai/REVIEW_CHECKLIST.md`](ai/REVIEW_CHECKLIST.md)
- Manual validation before "done" → [`/ai/QA_CHECKLIST.md`](ai/QA_CHECKLIST.md)
- Worktree slots & parallel agents → [`/ai/WORKTREE_SLOTS.md`](ai/WORKTREE_SLOTS.md), [`/ai/WORKTREES_PARALLEL_AGENTS_WORKFLOW.md`](ai/WORKTREES_PARALLEL_AGENTS_WORKFLOW.md)
- Task-specific copy-paste prompts → [`/ai/PROMPTS/`](ai/PROMPTS/)

Deeper architecture and risk rules live in `.cursor/rules/streamassist-engineering-rules.mdc`
and `.cursor/rules/ai-superpower-workflow.mdc`. Follow them.

## What this system is (one paragraph)

StreamAssist is a production realtime interactive streaming platform: **Vue 3 + Vite** client
(`apps/client`), **Node.js / Express** server (`apps/server`), **mediasoup / WebRTC** media stack
(`packages/call-core`), multiple **WebSocket** endpoints (`/ws`, `/nadle-ws`, `/eat-first-ws`,
`/nadraw-show-ws`, `/checkers-ws`), Twitch chat ingest, and OBS / viewer browser-source surfaces.
Game overlays (Mafia, Eat First, Nadle, Nadraw Show, Checkers, plus future games) run concurrently
in the same call. Real users are mid-stream when you make changes.

## Core rule

**Slot first.** Identify the correct worktree slot before starting any task —
`sa-docs`, `sa-fix`, `sa-feature`, or `sa-review`. See [`/ai/WORKTREE_SLOTS.md`](ai/WORKTREE_SLOTS.md).

**Step 0 — branch first.** Create a new logical git branch before editing code. Do not edit on
`main` or any shared integration branch. Naming format and allowed types are canonical in
[`.cursor/rules/ai-superpower-workflow.mdc`](.cursor/rules/ai-superpower-workflow.mdc) §1 — follow it.

Then do not start implementation before all five are complete:

1. **Read-only discovery** — list files you will touch and files you will only inspect.
2. **Source-of-truth identification** — name the SSOT files for the affected surface (see `/ai/STREAMASSIST_CONTEXT.md` §3).
3. **Root cause confirmed** (for bugs) — proved with evidence, not guessed.
4. **Minimal plan** — smallest safe diff; no refactor + behavior change in one PR.
5. **Risk / QA checklist** — risks named; QA rows from `/ai/QA_CHECKLIST.md` selected for the change.

If any step (including step 0) is missing, stop and report what is missing. Do not patch by guess.

## Task routing (which slot, which docs)

| Task | Slot | Required reading |
|------|------|------------------|
| Audit / review / high-risk discovery | `sa-review` | `/ai/REVIEW_CHECKLIST.md`, `/ai/STREAMASSIST_CONTEXT.md` §5 |
| Confirmed bug fix | `sa-fix` | `/ai/DEBUG_PLAYBOOK.md`, `/ai/REGRESSION_TEST_WORKFLOW.md`, `/ai/BROWSER_DEBUG_WORKFLOW.md` (if browser-observable) |
| Feature work | `sa-feature` | `/ai/PROMPTS/feature-plan.md`, `/ai/STREAMASSIST_CONTEXT.md` §4 |
| Docs / prompts / rules | `sa-docs` | this file, `/ai/AI_RULES.md` |

## High-risk surfaces (treat as production live)

Inline summary — the canonical risk map lives in `/ai/STREAMASSIST_CONTEXT.md` §5
and `.cursor/rules/streamassist-engineering-rules.mdc`.

- `packages/call-core/**` — SSOT for WebRTC / mediasoup on the client. **Never build a parallel media stack.** Do not duplicate media lifecycle in feature UI.
- `apps/server/src/signaling/**`, `apps/server/src/mediasoup/**` — signaling + media authority. Wrong handler order breaks every call.
- `apps/server/src/auth/**`, `apps/client/src/composables/useAuth.ts` — signed-cookie SSOT. Client `role`/`isHost`/`viewerMode` flags are **UI hints only**.
- `apps/server/src/rooms/Room.ts` — Mafia host-lock authority.
- `apps/server/src/eatFirst/**` — Eat First snapshot authority.
- `apps/server/src/leaderboardRouter.ts`, `apps/server/src/coinHub/**`, `apps/server/src/billing/**` — economy, rewards, money flow.
- `apps/client/src/components/call/CallPage.vue`, `ParticipantTile.vue`, `StreamVideo.vue` — playback / `srcObject` / stall recovery. Black tiles and CPU spikes live here. **Avoid `<video>` remounts** unless root cause proves it is needed (key tiles by `peerId`, not by stream revision or `playRev`).
- WS protocol files (`*/wsProtocol.ts`, `clientMessageSchema.ts`) — client sender and server parser must change together. **Never silently change WS / API contracts.**

## Don't-invent rules (StreamAssist-specific)

Read the file before calling. Do not invent:

- WebSocket message names or shapes — use the constants in `*/wsProtocol.ts`.
- REST routes, query params, response shapes.
- Prisma model fields or relations.
- `localStorage` / `sessionStorage` keys — use existing storage helpers.
- Env var names — they are `.env`-bound; ask if unsure.
- Composable names, store names, util names — grep `apps/client/src/composables`, `stores`, `utils` first.
- `roomId`, `streamerId`, Twitch-username normalization rules — reuse, never re-derive.

**One trigger = one side effect.** Never wire two cleanup paths to the same event. Never publish
a track from two places. Never write the same leaderboard row from two callbacks.

## QA expectations for any call / realtime / game change

Run (or instruct the user to run) the rows from `/ai/QA_CHECKLIST.md` relevant to the change.
At minimum for call / realtime / game surfaces:

- 2 tabs (same user / different users as appropriate)
- Join / leave / refresh / reconnect / tab switch
- Screen-share start and stop (including OS-level stop via the `ended` event)
- 8–12 cameras active (cascade-risk check)
- OBS / viewer mode route still renders and is lightweight
- Host / player / viewer role transitions
- WebSocket reconnect after server bounce or network blip
- No duplicate side effects (publish, leaderboard write, cleanup, etc.)

## Output format (after every change)

The canonical "Before editing" and "After editing" blocks are in `/ai/CLAUDE.md` §2 — use them
verbatim. For security work also output the risk block in `/ai/AI_RULES.md` §6.

Minimum after-edit report:

- **Files changed** (one line per file)
- **Diff summary**
- **API / WS contract touched?** Yes/No + which
- **Server authority touched?** Yes/No + which
- **Checks run** (command + result) and **checks not run + why**
- **Manual QA checklist** (concrete steps for this change)
- **Remaining risks / follow-ups**

If you cannot test (no dev server, no reproducible environment), say so explicitly rather than claim success.
