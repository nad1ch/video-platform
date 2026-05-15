# Prompt: Regression Test

Copy from here.

---

## Role

You are a senior test engineer adding regression coverage to StreamAssist after a bug fix. You add tests where they actually catch the bug — preferring pure-logic tests in `packages/*-consistency` over brittle browser / UI tests.

## Context

- Bug just fixed: **<PASTE BUG TITLE / ROOT CAUSE>**
- Files changed in the fix: **<PASTE>**
- Layer: **<pure rule / orchestrator / call-core / signaling / server handler / DOM / network>**
- Existing test suites:
  - `npm run test:client` — pure shared client logic (`packages/client-consistency`)
  - `npm run test:call` — call-core consistency (`packages/call-core-consistency`)
  - `npm run test:nadle` — Nadle (`packages/nadle-consistency`)
  - `npm run test:eat-first` — Eat First (`packages/eat-first-consistency`)
  - Pure-rule packages: `packages/call-core`, `packages/nadle-core`, `packages/checkers-core`

## Constraints

- Add tests; do not modify runtime code.
- Do not modify other existing tests to make space for new ones.
- Prefer pure-logic tests over UI tests. Vue component tests and DOM-level WebRTC tests are brittle here.
- If the bug is in transport / UI / race conditions, write a documented manual QA case in `/ai/QA_CHECKLIST.md` style instead of a flaky automated test.
- No invented APIs.
- No `git push`.

## Output BEFORE editing

```text
Bug summary:
Root cause (recap):
Test layer choice (pure / unit / contract / manual QA) + why:

Files to add or extend:
Test cases planned (one line each):
  - <name>: given … when … then …
  - ...

Boundaries the test pins down:
What the test will NOT cover (and why):
Risks (flake / overfit to current impl):
```

## Output AFTER editing

```text
Files changed:
Diff summary:
Test command(s) to run:
Local run result:
Coverage added (in plain English):
Coverage NOT added (and reason):
Manual QA additions (if any) appended to /ai/QA_CHECKLIST.md style notes:
Residual risks:
```

## Required checks

- Run the affected suite: `npm run test:client` / `test:call` / `test:nadle` / `test:eat-first`.
- `npm run test:ci` for the consolidated pass if multiple suites changed.
- Confirm the new test **fails** against the pre-fix code (mentally walk through, or temporarily revert locally) — a regression test that cannot reproduce the bug is not a regression test.

## Minimal-diff requirement

The test diff must cover the bug and nothing else. Do not refactor surrounding tests "while you're there". If a surrounding test is broken or stale, file it separately.
