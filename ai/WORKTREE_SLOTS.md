# Worktree slots

The simple persistent worktree model for StreamAssist. Read this before starting any task.

## Purpose

This file defines the persistent worktree slots used in this repo. The goal is to keep day-to-day work safe and simple — without spawning dozens of throwaway worktrees, and without mixing unrelated scopes inside a single task.

For multi-agent / multi-stream coordination (file-ownership maps, merge order, agent roles) see [`/ai/WORKTREES_PARALLEL_AGENTS_WORKFLOW.md`](WORKTREES_PARALLEL_AGENTS_WORKFLOW.md). For everyday tasks, prefer the slot model below.

## Core model

| Slot folder | Purpose |
|---|---|
| `video-platform/` (main repo) | Clean base. Not for AI editing. |
| `video-platform-sa-docs/` | Docs, AI rules, prompts, README, strategy, workflow docs. |
| `video-platform-sa-fix/` | Bug fixes, runtime fixes, small safe fixes. |
| `video-platform-sa-feature/` (alias `sa-feature-a`) | First feature workspace — new features, game mechanics, viewer economy, product functionality. |
| `video-platform-sa-feature-b/` *(optional)* | Second feature workspace — use only when `sa-feature` already holds an active unfinished feature. Same rules as `sa-feature`. |
| `video-platform-sa-review/` | Read-only audits, code review, architecture review, performance audit, security review. |

**Slot count:**

- The model has 4 slot categories: docs, fix, feature, review.
- The feature category may have 2 physical instances: `sa-feature` and `sa-feature-b`.
- Total physical slots: 4 by default, 5 when `sa-feature-b` is in use.
- Do not add more slot types or more feature variants for now.

**Definitions:**

- **Worktree = reusable workspace slot.** Folder lives on disk indefinitely.
- **Branch = one concrete task.** Created per task. Naming format and allowed types are canonical in [`.cursor/rules/ai-superpower-workflow.mdc`](../.cursor/rules/ai-superpower-workflow.mdc) §1.

**Rules:**

- Do not create dozens of worktrees. Start with these 4 slot categories.
- Each slot is reusable across many tasks over time.
- Each task still needs its own branch — never reuse a task branch for a new task.
- Never reuse a dirty worktree for a new task. The previous task must be committed, discarded, or intentionally parked first.
- One active task per worktree at any time.
- Do not mix docs + runtime + tests in a single task unless explicitly approved.
- If unsure where a task belongs, start in `sa-review` for read-only discovery first.
- `sa-feature-b` is the only optional additional slot. Use it only when `sa-feature` already holds an active unfinished feature, to allow a second independent feature to run in parallel. Same rules as `sa-feature`. Do not create further variants.
- Temporary Claude worktrees with random names (e.g. `busy-poitras-73ae48`) may still appear from older sessions. Treat them as legacy. The persistent slot model is the preferred workflow.

## Slot rules

### `sa-docs`

**Allowed:**

- `ai/**`
- `docs/**`
- `README.md`
- markdown documentation anywhere
- prompts under `ai/PROMPTS/**`
- workflow / strategy docs

**Forbidden:**

- `apps/**`
- `packages/**`
- runtime code
- real test files
- config files unless the task is explicitly about docs-related config

**Typical branches:**

- `docs/mcp-connectors-workflow`
- `docs/ai-review-checklist`
- `docs/browser-debug-workflow`

### `sa-fix`

**Allowed:**

- minimal bug fixes
- runtime fixes
- small UI / server fixes
- targeted tests only when the fix needs one (failing-before-fix regression test per [`/ai/REGRESSION_TEST_WORKFLOW.md`](REGRESSION_TEST_WORKFLOW.md))

**Required before code:**

- reproduction / evidence
- source of truth identified (see [`/ai/STREAMASSIST_CONTEXT.md`](STREAMASSIST_CONTEXT.md) §3)
- confirmed root cause (see [`/ai/DEBUG_PLAYBOOK.md`](DEBUG_PLAYBOOK.md))
- minimal fix plan
- what can break (risk list)
- QA checklist rows from [`/ai/QA_CHECKLIST.md`](QA_CHECKLIST.md)

**Forbidden:**

- broad refactor
- unrelated cleanup
- changing API / WS contracts without explicit approval
- touching `packages/call-core/**` without confirmed root cause
- bundling several bugs in one branch

**Typical branches:**

- `fix/mafia-host-transfer`
- `fix/eat-first-overlay-stale`
- `fix/call-timer-layering`

### `sa-feature`

**Slot variants:** `sa-feature` is the canonical name (alias: `sa-feature-a`). An optional second slot `sa-feature-b` exists for parallel feature work — use it only when `sa-feature` already holds an active unfinished feature. The rules below apply to both. One active task per slot; do not mix two features in the same slot.

**Allowed:**

- new features
- new product flows
- new game mechanics
- viewer economy work
- streamer tools
- UI / UX feature work

**Required before code:**

- product goal
- MVP scope
- current architecture summary
- source of truth identified
- feature boundary defined
- server-authority check (see [`/ai/CLAUDE.md`](CLAUDE.md) §1, item 9)
- QA checklist rows from [`/ai/QA_CHECKLIST.md`](QA_CHECKLIST.md)

**Forbidden:**

- feature explosion (do not grow scope mid-task)
- putting business logic in page components
- duplicating source of truth
- client-authoritative economy / game results
- large unrelated refactors

**Typical branches:**

- `feat/viewer-daily-claim`
- `feat/mafia-host-panel-v2`
- `feat/nadle-twitch-sync`

### `sa-review`

**Allowed:**

- read-only audit
- code review
- architecture review
- performance audit
- security review
- product / technical planning

**Forbidden:**

- editing files unless explicitly approved
- committing
- pushing
- fixing while reviewing (split into a `sa-fix` task)
- changing runtime code

**Typical branches:**

- no branch needed for pure read-only work — stay on `slot/sa-review`
- `docs/review-call-performance` only if a written report file is the output

## Starting a task

Before editing anything in any slot, output:

1. **Current worktree / branch.** `git -C <slot-path> branch --show-current`.
2. **Git status.** `git -C <slot-path> status --short`. Must be clean.
3. **Is this the correct slot?** State why this slot fits the task type.
4. **Task type.** docs / fix / feature / review / mixed (mixed needs explicit approval).
5. **Owned files.** Explicit paths or globs this task will edit.
6. **Read-only files.** Files inspected but not edited.
7. **Forbidden files.** Files this slot must not touch (see slot rules above).
8. **Risks.** What can break; which contracts / surfaces are nearby.
9. **Minimal plan.** Smallest safe diff.
10. **Approval needed before editing.** Wait for the user.

The 10 points above are the slot-specific pre-flight. They sit on top of the standard "Before editing" / "After editing" output contract in [`/ai/CLAUDE.md`](CLAUDE.md) §2.

A copy-paste starter prompt is at [`/ai/PROMPTS/worktree-slot-start.md`](PROMPTS/worktree-slot-start.md).

## Finishing a task

A task is finished only when one of these is true:

1. **Committed** — changes on the task branch, ready for review / push by the user.
2. **Discarded** — `git restore` / `git reset` performed by the user; worktree returned to clean.
3. **Intentionally parked** — branch left in a known incomplete state with a clear note (WIP commit + comment, or a TODO at the top of the task branch).

Before starting another task in the same slot:

- `git status` must be clean.
- The branch must be correct for the new task (typically a fresh branch from `origin/main`).
- The old task must not have leftover uncommitted files in the slot.

If any of these fail, stop and resolve the previous task before starting the next one.

## Simple commands / mental model

- worktree = workspace slot (the folder)
- branch = task (the work item)
- one task per worktree at a time
- clean before reuse
- do not delete a worktree before commit / push / PR if it still holds work that matters

```bash
# Start a task in a slot
cd "D:/Stream staff/video-platform-sa-fix"
git status                                   # must be clean
git checkout -b fix/<task-name> origin/main

# Finish a task (only when the user asks)
git status                                   # confirm staged files match scope
git commit -m "fix: ..."                     # only when the user asks
# git push                                    # only when the user asks

# Return slot to clean for the next task
git status                                   # must be clean again
git checkout slot/sa-fix                     # back on the slot's parking branch
```

## When to add more worktrees

Do not add more slot types now. The 4 categories above (plus the optional `sa-feature-b` instance) are the full set.

Only consider `sa-perf`, `sa-spike`, or similar later if **all** of the following are true:

- the slot model has been used comfortably for several weeks, and
- there are repeated tasks of a kind that genuinely do not fit any existing slot, and
- the user explicitly asks.

When in doubt: one of the existing slot categories is the answer.
