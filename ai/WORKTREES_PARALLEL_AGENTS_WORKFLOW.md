# Worktrees + parallel agents workflow

This document specifies how to use git worktrees and multiple AI agents safely on StreamAssist — without mixing scopes, branches, or file ownership.

For a short quick-orchestrator prompt focused on the git-worktree mechanics only, see the sibling [`/ai/PROMPTS/worktree-parallel-agents.md`](PROMPTS/worktree-parallel-agents.md). For the copy-paste prompt that exercises this full workflow, see [`/ai/PROMPTS/worktrees-parallel-agents-workflow.md`](PROMPTS/worktrees-parallel-agents-workflow.md).

## Core principle

> **Parallel agents are useful only when scopes are independent. If scopes overlap, use one agent and one branch.**

Parallelism amplifies whatever discipline (or lack of it) you bring. Two agents on the same file is faster only at producing merge conflicts. Two agents on disjoint files can genuinely halve wall time.

## Workflow

1. **Define the parent goal.** One sentence. What does "done" look like?
2. **Split into independent workstreams.** Each workstream has a single named output.
3. **Decide whether parallelization is safe.** If two workstreams touch the same files or the same high-risk surface, collapse them.
4. **Assign one worktree per workstream.** Never share a worktree across two workstreams.
5. **Assign one agent role per worktree.** Roles are listed in "Agent roles" below.
6. **Define file ownership before editing.** Every workstream lists its owned files and read-only files. No two workstreams may own the same file.
7. **Run read-only discovery in each worktree.** Each agent outputs scope, SSOT files, risks, and minimal plan per [`/ai/CLAUDE.md`](CLAUDE.md) §2 before any edit.
8. **Approve plans before implementation.** Human-in-the-loop gate for each workstream.
9. **Implement minimal diffs.** No refactor + behavior change. No drive-by edits.
10. **Run checks per worktree.** `npm run test:*` / `npm run lint` / `npm run build` as appropriate.
11. **Review each diff independently.** Use [`/ai/PROMPTS/code-review.md`](PROMPTS/code-review.md) per branch.
12. **Merge / cherry-pick in safe order.** See "Merge / integration order" below.
13. **Run final integration QA.** Cross-workstream regressions show up at integration; budget for this.

## When parallel agents are useful

- **Read-only audits** in separate domains (e.g., security audit of `apps/server/src/auth/**` + perf audit of `CallPage.vue`).
- **Docs workflow hardening** — multiple `/ai/*.md` files where ownership is clearly disjoint.
- **Independent feature spikes** — e.g., a Nadle UI tweak and a Checkers rule edge case in `packages/checkers-core` at the same time.
- **Test generation for already-stable pure modules** — adding consistency tests to `packages/nadle-consistency` and `packages/eat-first-consistency` simultaneously.
- **Performance audit vs implementation split** — one agent profiles, one agent prepares the fix candidate.
- **Product / spec / UX work** separate from runtime code — drafting `/ai/PROMPTS/*` or specs while a runtime fix is in flight elsewhere.
- **One agent reviewing another agent's diff** — a review agent runs after implementation completes.

## When parallel agents are dangerous

Do NOT parallelize when workstreams share any of these:

- **Same files.** Hard stop.
- **Same WebSocket protocol** (client sender + server parser must change together — same agent).
- **Same `call-core` / media lifecycle.** One owner.
- **Same auth / session flow** (`apps/server/src/auth/**`, `apps/client/src/composables/useAuth.ts`).
- **Shared server-authority logic** (`apps/server/src/leaderboardRouter.ts`, `apps/server/src/rooms/Room.ts`, `apps/server/src/coinHub/**`, `apps/server/src/billing/**`).
- **Migrations / database schema** — single owner; ordering matters.
- **Billing / security changes** — single owner; reviewer separate.
- **Large refactors** — refactor + parallel feature work multiplies risk.
- **Unclear root cause** — see [`/ai/DEBUG_PLAYBOOK.md`](DEBUG_PLAYBOOK.md) and [`/ai/BROWSER_DEBUG_WORKFLOW.md`](BROWSER_DEBUG_WORKFLOW.md); do not split a hypothesis across agents.
- **Active dirty working tree with unrelated changes** — clean up or stash first; do not start parallel work on top of an unstable baseline.
- **Two agents changing the same feature orchestrator** (`useCheckersOrchestrator`, `useNadrawShowOrchestrator`, `eat-first/composables/control/useControlOrchestrator.js`, etc.).

## Workstream decision table

| Workstream type | Parallel safe? | Recommended agent role | Recommended branch prefix | Notes |
|-----------------|----------------|------------------------|---------------------------|-------|
| Docs only | yes | Research / Product-spec | `docs/` | Each doc file is its own ownership unit. |
| Read-only audit | yes | Research / Review | `audit/` (or `chore/audit-`) | Read-only by definition; diff is usually a doc summary. |
| Browser debug evidence collection | yes | Browser-evidence | none (no edits) | Evidence gathered per `/ai/BROWSER_DEBUG_WORKFLOW.md`. |
| Regression-test proposal (failing test before fix) | partially | Regression-test | `test/` (when the test lands) | Test agent and fix agent are *sequential*, not parallel — the fix must come after the failing test is approved. |
| Pure utility test generation | yes | Regression-test | `test/` | Multiple `packages/*-consistency` suites in parallel is fine. |
| UI-only copy / layout | yes | Implementation | `feat/` or `fix/` | Different components / different routes only. |
| WebRTC / `call-core` change | **no** | Implementation (single owner) | `fix/` / `perf/` | High-risk surface — see `/ai/CLAUDE.md` §3. |
| WebSocket protocol change | **no** | Implementation (single owner) | `feat/` / `fix/` | Client sender + server parser change together, same agent. |
| Auth / billing / security change | **no** | Implementation (single owner) | `fix/` / `feat/` | Server authority. Reviewer is a separate agent. |
| Cross-feature refactor | **no** | Implementation (single owner) | `refactor/` | Refactor + feature work do not parallelize. |
| Performance audit | yes (audit only) | Research | `audit/` | Audit may run in parallel with anything; *implementation* of the perf fix is single-owner. |
| Product spec | yes | Product-spec | `docs/` | Spec writing is read-only of code; safe to parallelize. |

## File ownership contract

- Each worktree **must list the files it owns** before editing. Format: explicit paths + globs.
- Each worktree **must list its read-only files** (files it inspects but cannot edit).
- **No two worktrees may own the same file.** If a file is genuinely needed by two workstreams, collapse them into one workstream — do not "coordinate."
- **High-risk files cannot be edited in parallel.** This includes everything in [`/ai/CLAUDE.md`](CLAUDE.md) §3 (Default-to-Opus list): `packages/call-core/**`, `apps/server/src/signaling/**`, `apps/server/src/mediasoup/**`, `apps/server/src/auth/**`, `apps/server/src/leaderboardRouter.ts`, `apps/server/src/rooms/Room.ts`, `apps/server/src/eatFirst/**`. Add `apps/server/src/billing/**` and `apps/server/src/coinHub/**` to that set per [`/ai/REVIEW_CHECKLIST.md`](REVIEW_CHECKLIST.md) §6 "Known production risk surfaces".
- **If ownership needs to change** mid-task, stop and re-plan. Do not silently extend ownership; that defeats the contract.
- **Unrelated user changes must not be touched.** If `git status` already contains modified files when a workstream starts, the new worktree must be created from a clean base (typically `main` or the merge base); the original working-tree changes stay where they are, on the original branch.
- **Generated files must be clearly scoped.** Build output, lockfiles, and codegen are owned by the workstream whose change required them.

## Branch naming and git hygiene

- Follow the canonical branch rules in [`/ai/AI_RULES.md`](AI_RULES.md) §0 and [`.cursor/rules/ai-superpower-workflow.mdc`](../.cursor/rules/ai-superpower-workflow.mdc) §1.
- **One branch per workstream.** No "mixed" branches.
- **Branch from the correct base.** Docs work usually branches from `main`. Runtime fixes may branch from the feature-integration line. Confirm the base before creating the branch.
- **Never branch from a dirty runtime branch for a docs workstream** unless explicitly approved. If the runtime branch is dirty, switch to `main` (or its merged-docs line equivalent) first.
- **Do not push without confirmation.**
- **Do not commit mixed runtime + docs unless explicitly approved.** Default is to keep them separate.
- **Cherry-pick only after review.** Cross-branch cherry-pick before review is how silent contract drift sneaks in.
- **Never use destructive git commands** (`reset --hard`, `push --force`, `clean -fd`, `checkout -- .`, `restore .`) without explicit user permission.

## Agent roles

Each role has a single primary responsibility. Roles can be assigned at the model split tier in [`/ai/CLAUDE.md`](CLAUDE.md) §3 — high-stakes to Opus, focused implementation to Sonnet, mechanical to Haiku.

### Research agent

- **Allowed:** read code, search, grep, summarize, propose plans.
- **Forbidden:** any edit.
- **Expected output:** SSOT files, risk map, scope summary, file-ownership proposal.

### Debug agent

- **Allowed:** read code; run read-only browser evidence per [`/ai/BROWSER_DEBUG_WORKFLOW.md`](BROWSER_DEBUG_WORKFLOW.md); form hypotheses.
- **Forbidden:** any edit before root cause is *Confirmed* per `/ai/BROWSER_DEBUG_WORKFLOW.md` "Root cause confidence levels".
- **Expected output:** confirmed root cause + file + line; minimal fix proposal.

### Implementation agent

- **Allowed:** edit owned files; minimal diff; tests within the owned-file set.
- **Forbidden:** edit read-only or unowned files; refactor + behavior change in one diff; cross-domain imports; new media stack outside `call-core`.
- **Expected output:** the standard "After editing" block per `/ai/CLAUDE.md` §2.

### Regression-test agent

- **Allowed:** add tests under `packages/*-consistency` (or the appropriate `packages/*-core`) for the owned-bug surface.
- **Forbidden:** edit runtime code; weaken or delete existing tests; bundle extraction + fix (see [`/ai/REGRESSION_TEST_WORKFLOW.md`](REGRESSION_TEST_WORKFLOW.md) "Regression test contract").
- **Expected output:** failing test + failing-before-fix evidence + verification commands.

### Browser-evidence agent

- **Allowed:** run read-only snippets §A–§K from `/ai/BROWSER_DEBUG_WORKFLOW.md`; capture before / after evidence.
- **Forbidden:** any code edit; printing tokens, secrets, OAuth codes, or `ws.url` query strings without redaction.
- **Expected output:** completed evidence template per `/ai/BROWSER_DEBUG_WORKFLOW.md` "How to send evidence to Claude".

### Review agent

- **Allowed:** read the diff, cite issues by file + line, recommend approve / request-changes / reject.
- **Forbidden:** edit the reviewed diff; suggest fixes that bundle refactor + behavior change.
- **Expected output:** completed review per [`/ai/PROMPTS/code-review.md`](PROMPTS/code-review.md).

### Product / spec agent

- **Allowed:** read codebase to inform spec; write spec docs.
- **Forbidden:** edit runtime code or tests as part of spec work.
- **Expected output:** spec doc per [`/ai/PROMPTS/product-spec.md`](PROMPTS/product-spec.md).

### Integration QA agent

- **Allowed:** run integration QA per [`/ai/QA_CHECKLIST.md`](QA_CHECKLIST.md); capture browser evidence per `/ai/BROWSER_DEBUG_WORKFLOW.md`.
- **Forbidden:** edit code to "make QA pass"; modify tests.
- **Expected output:** QA results + manual-QA evidence + remaining risks.

## Merge / integration order

Recommended order, lowest-risk first:

1. **Docs / rules.** Land first. Other workstreams reference them.
2. **Pure tests.** New consistency tests with no runtime change.
3. **Pure helpers / refactors.** Behavior-preserving extractions and helper introductions; no behavior change.
4. **Runtime fixes** for bugs already covered by tests landed in step 2.
5. **UI integrations** that consume helpers landed in step 3 or fixes landed in step 4.
6. **High-risk WebRTC / WS / auth / billing changes.** Land last and on their own.
7. **Final integration QA.** Manual rows from `/ai/QA_CHECKLIST.md` matching every surface touched.

If the suggested order conflicts with the user's stated priority, raise it explicitly — do not silently reorder.

## StreamAssist-specific rules

- **Do not edit `packages/call-core/**` in parallel with feature UI** that consumes its state. The orchestrator and the consumer must agree on the contract; two agents will fight.
- **Do not edit a WS protocol** (`apps/server/src/signaling/*WsProtocol.ts`, `apps/server/src/eatFirst/*`, etc.) in parallel with its server handlers unless the same agent owns both sides. Protocol drift is the most common source of silent breakage — see `/ai/AI_RULES.md` §9 "Silent contract changes".
- **Do not edit billing / security in parallel with unrelated runtime changes.** Reviewer must be a separate agent.
- **Do not split a single root-cause bug across multiple implementation agents.** One root cause, one fix.
- **Browser-evidence agent can collect evidence in parallel** with anything — capturing read-only browser state does not block other work. *Implementation* still waits for the confirmed root cause.
- **Review agent must run after each workstream diff.** No diff lands unreviewed.
- **Final QA must include realtime scenarios** when any workstream touches `call-core`, `CallPage.vue`, signaling, a game WS, an overlay, or `apps/server/src/rooms/Room.ts`. See `/ai/QA_CHECKLIST.md` §1 C1–C18.

## Parallel agent prompt template

Use this template when assigning a worktree to an agent. Fill in every field:

```text
Parent goal:
Workstream:
Agent role:
Branch / worktree:
Owned files:
Read-only files:
Forbidden files:
Expected output:
Checks:
Merge dependency (which other workstream(s), if any, must land before this one):
Stop conditions (when the agent must halt and ask the user — e.g. ownership conflict, unconfirmed root cause on high-risk surface):
```

## Output format

### Before creating worktrees

```text
1. Parent goal (one sentence):
2. Proposed workstreams (list, one-line description each):
3. Parallel-safe? (yes / partial / no — with rationale per the decision table):
4. Branch / worktree plan (branch name + base + worktree path per workstream):
5. File ownership map (each workstream → owned files + read-only files; disjoint check):
6. Risks (overlap risks, base risks, dirty-tree risks):
7. Stop conditions (per workstream):
```

User approves before any worktree is created.

### After each workstream

```text
1. Branch / worktree:
2. Files changed (only owned files; confirm disjoint vs. other workstreams):
3. Diff summary (one line per file):
4. Checks run (test / lint / build):
5. Review status (reviewer agent's recommendation):
6. Merge readiness (yes / no + why):
7. Remaining risks:
```

### Final integration

```text
1. Merge order (actually executed):
2. Conflicts (if any, how resolved):
3. Integration checks (test:ci / lint / build):
4. Manual QA (rows from /ai/QA_CHECKLIST.md):
5. Remaining risks:
```
