# CLAUDE.md — Repository entry point for Claude Code

This repository has an AI operating system at `/ai`. Read it before doing anything.

## Read order

1. [`/ai/CLAUDE.md`](ai/CLAUDE.md) — how Claude works in this repo (workflow, output contract, model split).
2. [`/ai/AI_RULES.md`](ai/AI_RULES.md) — non-negotiable engineering rules.
3. [`/ai/STREAMASSIST_CONTEXT.md`](ai/STREAMASSIST_CONTEXT.md) — what the system is and its source-of-truth files.

Then, depending on the task:

- Debugging → [`/ai/DEBUG_PLAYBOOK.md`](ai/DEBUG_PLAYBOOK.md)
- PR / diff review → [`/ai/REVIEW_CHECKLIST.md`](ai/REVIEW_CHECKLIST.md)
- Manual validation before "done" → [`/ai/QA_CHECKLIST.md`](ai/QA_CHECKLIST.md)
- Task-specific copy-paste prompts → [`/ai/PROMPTS/`](ai/PROMPTS/)

Deeper architecture and risk rules live in `.cursor/rules/streamassist-engineering-rules.mdc` and `.cursor/rules/ai-superpower-workflow.mdc`. Follow them.

## Core rule

**Slot first.** Identify the correct worktree slot before starting any task — `sa-docs`, `sa-fix`, `sa-feature`, or `sa-review`. See [`/ai/WORKTREE_SLOTS.md`](ai/WORKTREE_SLOTS.md).

**Step 0 — branch first.** Create a new logical git branch before editing code. Do not edit on `main` or any shared integration branch. Naming format and allowed types are canonical in [`.cursor/rules/ai-superpower-workflow.mdc`](.cursor/rules/ai-superpower-workflow.mdc) §1 — follow it.

Then do not start implementation before all five are complete:

1. **Read-only discovery** — list files you will touch and files you will only inspect.
2. **Source-of-truth identification** — name the SSOT files for the affected surface (see `/ai/STREAMASSIST_CONTEXT.md` §3).
3. **Root cause confirmed** (for bugs) — proved with evidence, not guessed.
4. **Minimal plan** — smallest safe diff; no refactor + behavior change in one PR.
5. **Risk / QA checklist** — risks named; QA rows from `/ai/QA_CHECKLIST.md` selected for the change.

If any step (including step 0) is missing, stop and report what is missing. Do not patch by guess.
