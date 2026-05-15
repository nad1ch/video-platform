# CLAUDE.md — How Claude works in StreamAssist

This file is the primary entry point for Claude (and any Claude-compatible AI agent) operating in this repository. It is intentionally short.

Deep architecture lives in `.cursor/rules/streamassist-engineering-rules.mdc`.
Workflow discipline lives in `.cursor/rules/ai-superpower-workflow.mdc` and `/ai/AI_RULES.md`.

## 0. Identity

You are operating in a production realtime streaming platform:

- Vue 3 + Vite client (`apps/client`)
- Node.js / Express server (`apps/server`)
- WebRTC media stack (`packages/call-core`)
- Multiple WebSocket endpoints: `/ws` (call signaling + Mafia), `/nadle-ws`, `/eat-first-ws`, `/nadraw-show-ws`, `/checkers-ws`
- Twitch chat ingest and OBS/viewer surfaces
- Game overlays: Mafia, Eat First, Nadle, Nadraw Show, Checkers, future games

Real users are mid-stream when you make changes. Treat realtime / WebRTC / auth / economy paths as production-safe by default.

## 1. Mandatory workflow

Researcher → Debugger → Architect → Implementer → Reviewer → QA.

For every task:

1. **Read-only discovery first.** Never edit before you have stated scope, source of truth, files to touch, files to inspect only, and risks.
2. **Find the source of truth** before changing anything (see `/ai/STREAMASSIST_CONTEXT.md` §3).
3. **For bugs: confirm root cause before writing code.** Do not ship a "probably fixes it" patch.
4. **Minimal diff only.** No refactor + behavior change in the same change.
5. **Never invent APIs**, WebSocket message names, route paths, storage keys, Prisma fields, or env vars. Read the file; do not guess.
6. **Never silently change API or WS contracts.** If the client wire changes, the server must change in the same task, and vice versa.
7. **Never `git push`, `git merge`, force-push, or modify upstream branches** unless the user explicitly asks.
8. **Treat `packages/call-core` as the single source of truth for media.** Do not build a second media stack.
9. **The server is authority** for user, room, streamer, host, role, result, rewards, and rate limits. Client flags are UI hints only.

## 2. Output contract

### Before editing

Always print:

```text
Scope:
Source of truth files:
Files to change:
Files to inspect only:
Existing helpers / composables / stores to reuse:
Realtime / contract surfaces touched (REST endpoint / WS message / store / protocol const):
Risks:
Minimal plan:
```

### After editing

Always print:

```text
Files changed:
Diff summary (one line per file):
Behavior preserved outside scope? Yes/No + why:
API / WS contract touched? Yes/No + which:
Server authority touched? Yes/No + which:
Checks run (command + result):
Checks skipped + why:
Manual QA checklist (concrete steps for this change):
Residual risks:
```

## 3. Model split

Use the right model for the cost-of-mistake. Default to the higher tier when in doubt.

| Tier | Model ID | Use for |
|------|----------|---------|
| High-stakes | `claude-opus-4-7` | Architecture decisions, `packages/call-core` work, mediasoup / signaling changes, auth / security, server-authority changes, multi-file refactors, debugging WebRTC, root-cause analysis on races / reconnect, PR reviews of high-risk surfaces. |
| Implementation | `claude-sonnet-4-6` | Implementing an approved plan, focused fixes in a single file, writing tests against a known spec, mechanical refactors with no behavior change. |
| Cheap / utility | `claude-haiku-4-5-20251001` | One-shot grep / rename, docstring cleanup, README touch-ups, lint fixes, file scaffolding from a template. |

Default to Opus for any file under:

- `packages/call-core/**`
- `apps/server/src/signaling/**`
- `apps/server/src/mediasoup/**`
- `apps/server/src/auth/**`
- `apps/server/src/leaderboardRouter.ts`
- `apps/server/src/rooms/Room.ts`
- `apps/server/src/eatFirst/**`

## 4. What Claude must NOT do here

- Do not modify application runtime code while writing AI documentation, planning, or review.
- Do not modify tests to make them pass.
- Do not modify `packages/*/src/**` for "cleanup" without a task.
- Do not change config files (eslint, tsconfig, package.json scripts) unless the task is config.
- Do not add `// removed`, dead exports, or backwards-compat shims when a clean change is possible.
- Do not respond in Russian. Ukrainian or English only (existing repo policy).

## 5. Entry points to read first

When opening this repo cold, read these in order:

1. `.cursor/rules/streamassist-engineering-rules.mdc` — architecture, risk map, SSOT rules
2. `.cursor/rules/ai-superpower-workflow.mdc` — task discipline
3. `/ai/STREAMASSIST_CONTEXT.md` — short tour of the system
4. `/ai/AI_RULES.md` — workflow rules
5. `/ai/DEBUG_PLAYBOOK.md` — when fixing a bug
6. `/ai/BROWSER_DEBUG_WORKFLOW.md` — when the bug is observable in a running browser (black tile, stuck UI, failed network call, redirect loop, stale overlay)
7. `/ai/REGRESSION_TEST_WORKFLOW.md` — when fixing a deterministic bug; write a failing test first, then the fix
8. `/ai/WORKTREES_PARALLEL_AGENTS_WORKFLOW.md` — when running multiple agents or worktrees in parallel
9. `/ai/REVIEW_CHECKLIST.md` — when reviewing a diff
10. `/ai/QA_CHECKLIST.md` — before claiming done

For copy-paste prompts, see `/ai/PROMPTS/`.

> **How to use the prompts.** Files in `/ai/PROMPTS/*.md` are designed to be pasted **as a user message** into Claude Code / Cursor after filling in the `<…>` placeholders. They are not system prompts. Do not load them as system prompts, slash-command definitions, or agent-definition files unless you have explicitly adapted them for that role.
