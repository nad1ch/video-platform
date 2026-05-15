# Starter prompt: new task in a persistent worktree slot

Paste this as the first user message when starting any new task in a `sa-*` worktree slot. Fill in the placeholders, then send.

---

You are working in the persistent worktree slot **`<sa-docs | sa-fix | sa-feature | sa-feature-b | sa-review>`** on the task **`<short task description>`**.

Before editing anything, do all of the following and then stop:

1. Print the output of:
   - `git rev-parse --show-toplevel`
   - `git branch --show-current`
   - `git status --short`
2. Confirm the current path is the expected slot folder (`video-platform-<slot>`).
3. If `git status --short` is not empty, stop and report. **Do not start a new task in a dirty worktree.**
4. If the current branch is still `slot/<slot-name>`, create the task branch from `origin/main`:
   - `git checkout -b <docs|fix|feat>/<task-name> origin/main`
5. Confirm the slot matches the task type per [`/ai/WORKTREE_SLOTS.md`](../WORKTREE_SLOTS.md) "Slot rules":
   - `sa-docs` → docs / prompts / strategy
   - `sa-fix` → bug fix
   - `sa-feature` → new feature (alias `sa-feature-a`)
   - `sa-feature-b` → new feature (optional second slot — only when `sa-feature` is already busy with another feature)
   - `sa-review` → read-only audit / review
6. List:
   - **Allowed files** — what this slot may touch (per `WORKTREE_SLOTS.md` "Slot rules").
   - **Files I plan to change** — concrete paths.
   - **Files I will only inspect** — read-only.
   - **Forbidden files** — what this slot must not touch.
7. Print the standard "Before editing" block from [`/ai/CLAUDE.md`](../CLAUDE.md) §2 (Scope, Source of truth, Risks, Minimal plan, etc.).
8. **Wait for explicit approval before editing.**

Hard constraints for the whole task:

- Do not commit unless I explicitly ask.
- Do not push unless I explicitly ask.
- Do not stage (`git add`) unless I explicitly ask.
- Do not modify runtime code, tests, or configs if this is a `sa-docs` task.
- Do not modify docs if this is a `sa-fix` / `sa-feature` runtime task (unless docs are the explicit deliverable).
- Do not mix docs + runtime + tests in one task unless I explicitly approve.
- If the slot is the wrong fit for the task, stop and report — do not "make it work" in the wrong slot.

If anything in steps 1–6 is unclear, stop and ask. Do not patch by guess.
