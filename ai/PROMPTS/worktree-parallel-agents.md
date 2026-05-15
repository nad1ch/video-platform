# Prompt: Worktree-Parallel Agents

Use this when you want multiple Claude / Cursor agents to work on isolated tasks in parallel without stomping each other.

---

## Role

You are an orchestrator coordinating multiple AI agents on StreamAssist. Each agent works in its own git worktree on its own branch. None of them push or merge without explicit user approval.

## Context

- Multi-agent setup: a top-level orchestrator (human or Claude Opus) and N worker agents.
- Each worker may be Claude Sonnet (implementation) or Claude Haiku (utility) depending on the task. See `/ai/CLAUDE.md` §3 for the model split.
- The repo's main working branch is `main`; integration branch may be `feat/<integration>`.

## When to use this

- Two or more independent tasks that touch different surfaces (e.g., Checkers UI + Nadle leaderboard fix).
- A long-running migration plus an unrelated hotfix.
- Discovery / planning agent running in parallel with a low-risk fix agent.

Do **NOT** use this when:

- Tasks touch the same files (race risk).
- Task A's plan is an input to task B (sequence them).
- The task touches `packages/call-core` from two agents at once (single owner — serialize).

## Setup pattern

```bash
# from repo root, on the integration branch
git worktree add ../sa-checkers-fix    fix/checkers-rematch-timer
git worktree add ../sa-nadle-perf      perf/nadle-leaderboard-batch
git worktree add ../sa-docs            docs/ai-folder-update

# Each worktree is a full checkout with its own branch.
# Open each in a separate Cursor / Claude Code window.
```

Tear down (only after merge):

```bash
git worktree remove ../sa-checkers-fix
git worktree remove ../sa-nadle-perf
git worktree remove ../sa-docs
```

## Constraints (per agent)

- One scope per worktree. Agent A may not touch files agent B owns.
- No agent runs `git push`, `git merge`, or modifies upstream without the user.
- Each agent follows `/ai/AI_RULES.md` independently.
- Each agent outputs the "Before editing" block before doing any edit.
- The orchestrator (human or top-level Claude) decides merge order.

## Output BEFORE editing (from the orchestrator)

```text
Parallel tasks planned:
  1. <branch> — <task> — <files owned> — <agent assignment + model>
  2. <branch> — <task> — <files owned> — <agent assignment + model>
  3. <branch> — <task> — <files owned> — <agent assignment + model>

File-ownership map (who touches what — must be disjoint):
  packages/call-core/**:            <agent or NONE>
  apps/client/src/features/<x>/**:  <agent>
  apps/server/src/<y>/**:           <agent>
  /ai/**:                           <agent>

Shared surfaces (read-only for all agents):
  - .cursor/rules/*
  - /ai/STREAMASSIST_CONTEXT.md

Merge plan:
  - Order of integration:
  - Conflict-resolution owner:
  - Rebase or merge:
```

## Output AFTER each agent finishes

Each agent outputs its standard "After editing" block (see `/ai/AI_RULES.md` §8) plus:

```text
Worktree path:
Branch:
Files owned (and confirmed no edits outside that set):
Ready to merge? Yes/No + reason:
Conflicts expected vs other branches: <list or "none">
```

## Required checks

- Each agent runs the narrowest relevant `npm run test:*` for its surface.
- Orchestrator runs `npm run ci` on the integration branch after merging all worktrees.
- Orchestrator manually QAs the call-realtime surface from `/ai/QA_CHECKLIST.md` §1 if any agent touched a call-adjacent path.

## Minimal-diff requirement

Each worktree's branch must contain only its own task. If an agent's diff sprawls beyond its file-ownership map, the orchestrator rejects the merge and asks the agent to split.
