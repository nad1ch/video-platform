# Regression-test workflow

This document specifies how AI agents in this repository must add regression coverage when fixing a confirmed bug. Regression tests are **insurance**: write or identify a test that fails *because of the bug*, fix the bug, prove the test now passes.

## Core principle

> **Do not trust a fix that cannot be verified. Prefer a failing regression test for deterministic logic.**

A passing fix is not the same as a proven fix. Without a test that originally failed, you cannot prove the change actually closed the bug, and you cannot prove a future change will not silently re-open it.

This workflow complements [`/ai/DEBUG_PLAYBOOK.md`](DEBUG_PLAYBOOK.md) and [`/ai/BROWSER_DEBUG_WORKFLOW.md`](BROWSER_DEBUG_WORKFLOW.md). For *post-fix* regression coverage (test added after the fix is already in flight), see the companion prompt at [`/ai/PROMPTS/regression-test.md`](PROMPTS/regression-test.md). For the *failing-test-first* discipline, this document — and its prompt at [`/ai/PROMPTS/regression-test-workflow.md`](PROMPTS/regression-test-workflow.md) — is the source of truth.

## Workflow

1. **Collect bug evidence.** Symptom, reproduction, log / console output. For browser-observable bugs, capture with [`/ai/BROWSER_DEBUG_WORKFLOW.md`](BROWSER_DEBUG_WORKFLOW.md) §A–§K.
2. **Confirm root cause.** Cite file + line. If not confirmed, stop — see [`/ai/DEBUG_PLAYBOOK.md`](DEBUG_PLAYBOOK.md) §1 and [`/ai/BROWSER_DEBUG_WORKFLOW.md`](BROWSER_DEBUG_WORKFLOW.md) "Root cause confidence levels".
3. **Decide whether the bug is testable.** Pure rule, mapper, handler, state transition → yes. Real-browser, GPU, autoplay policy, third-party OAuth flow → no (or only partially).
4. **Pick the narrowest test layer.** The layers actually available in this repo are:
   - **Consistency-package unit / pure unit** — `packages/*-consistency` suites plus the `packages/*-core` packages' own tests. This is the primary layer.
   - **Server unit** — only if a server test runner is available. Today none is established (see [`/ai/STREAMASSIST_CONTEXT.md`](STREAMASSIST_CONTEXT.md) §6); the safer default is to extract the pure portion into a consistency package.
   - **Integration / e2e** — **not currently established** in this repo. Do not propose them unless the task is explicitly to set up that infrastructure.

   Prefer the lowest layer that can reproduce the bug *and* exercise the fixed code path.
5. **Write or identify a failing regression test.** Add to the appropriate `packages/*-consistency` suite, or note an existing test that exercises the path.
6. **Run the test and confirm it fails for the expected reason.** Not for an unrelated mismatch; not for a setup mistake.
7. **Implement the minimal fix.** No refactor in the same change.
8. **Run the same test and confirm it passes.**
9. **Run nearby relevant tests** (e.g., the whole `npm run test:nadle` if the fix is in `packages/nadle-core`).
10. **Add manual QA only for runtime / browser / media surfaces** that cannot be fully automated; record steps in [`/ai/QA_CHECKLIST.md`](QA_CHECKLIST.md) style.

## Where regression tests are high-value in StreamAssist

- Pure game rules — `packages/nadle-core`, `packages/checkers-core`, Eat First rule helpers.
- State transitions — Mafia phase progression, Eat First slot lifecycle, Checkers move legality.
- Mappers — `call-core` participant / display-name mappers, WS payload mappers.
- Timer logic — game-template / Eat First / Mafia timers, preset selection, tick boundaries.
- Duplicate-submit guards — leaderboard write, claim, spin, open-case, host-transfer.
- Permission / access helpers — `resolveUserRole`, Eat First staff guard, admin guards.
- API validation — Zod / schema validators in `apps/server/src/signaling/clientMessageSchema.ts` and route handlers.
- WebSocket message handlers — server-side parsers and dispatchers (pure portion).
- Economy — coin grant / debit / cooldown / idempotency.
- Leaderboard — wins, streak, rating updates, one-write-per-event guarantee.
- Auth / session — role resolution, signed-cookie parsing, email-verification gate.
- Billing — webhook signature verification, idempotency-key respect.
- Twitch — message parsing, per-user throttling, username normalization.
- Feature orchestrator pure helpers — pure pieces extracted from `use<Feature>Orchestrator`.

## Where manual QA is still required

Automated tests do not cover these reliably; fall back to [`/ai/QA_CHECKLIST.md`](QA_CHECKLIST.md):

- Mediasoup transport lifecycle (real `produce` / `consume` / teardown sequencing under load).
- Actual camera / microphone permission prompts.
- Real screen-share picker (browser-native UI).
- Browser autoplay restrictions (audio unlock, user-gesture rules).
- OBS Browser Source behavior (different cookie / autoplay / GPU profile).
- GPU / rendering / video-decoder performance under 8–12 cameras.
- Visual layout and accessibility (color contrast, focus order, reduced motion).
- Third-party OAuth and payment-provider redirects (Twitch OAuth, payment-provider checkout).

## Test layer decision table

Pick the **highest-leverage, lowest-layer** test that can reproduce the bug.

| Bug type | Best first test layer | Example target | Manual QA needed? |
|----------|-----------------------|----------------|-------------------|
| Pure util bug | `packages/client-consistency` unit | e.g. `packages/eat-first-consistency/eatFirstTimerStripModel.test.ts` pattern | no |
| Mapper bug | `packages/call-core-consistency` | participant / display-name mapper test | no |
| Game rule bug | per-game (no uniform shape — see note below) | Nadle → `packages/nadle-consistency` · Eat First → `packages/eat-first-consistency` · Checkers → `packages/checkers-core` own tests · Mafia → no dedicated test home today (see Example 7) | no |
| Timer / state transition bug | `packages/<game>-consistency` | Eat First timer / Mafia phase test | small smoke check |
| API validation bug | server unit (if a runner is available) or `packages/client-consistency` schema fixture | Zod schema fixture for `apps/server/src/signaling/clientMessageSchema.ts` | no |
| WS handler bug (pure portion) | consistency suite for the protocol | `eatFirstHostActionEmit.test.ts` pattern | small smoke check |
| Permission / auth bug (pure resolver) | server unit (if a runner is available) or extract pure helper into a consistency package | pure portion of `resolveUserRole` | yes — full auth flow |
| Leaderboard / economy duplicate submit | server unit + consistency contract for the idempotency-key shape | leaderboard write test | yes — double-click QA |
| Billing webhook idempotency | server unit + consistency contract for replay protection | webhook idempotency-key test | yes — provider replay |
| Twitch message parsing / throttling | `packages/nadle-consistency` | guess parser + per-user rate-limit test | yes — live chat smoke |
| WebRTC / video black screen | **none reliably** | n/a | yes — browser evidence + QA C1, C7, C9–C13, C16 |
| CSS / layout bug | none (very brittle to unit-test) | n/a | yes — visual QA |
| OAuth redirect bug | none (third-party) | n/a | yes — full OAuth round-trip |

Note: the StreamAssist server has no first-class test script today (see [`/ai/STREAMASSIST_CONTEXT.md`](STREAMASSIST_CONTEXT.md) §6). "Server unit" rows above are conditional on a runner being available; the safer default is to extract the pure portion into `packages/*-consistency` and test it there.

Note: game-rule test homes are **not uniform** — there is no generic `packages/<game>-consistency` template. Specifically:

- Nadle rules → `packages/nadle-consistency` (separate from `packages/nadle-core`).
- Eat First rules → `packages/eat-first-consistency`.
- Checkers rules → `packages/checkers-core` itself (no separate `checkers-consistency` package exists in the repo today; do not look for one).
- Mafia game state lives **server-side** in `apps/server/src/rooms/Room.ts`; there is no dedicated consistency package for Mafia today. See Example 7 below for the realistic options.

## Regression test contract

A test that does not satisfy all of these is not a regression test:

- The test **must fail before the fix.** If it passes on the broken code, it does not protect against this bug.
- The test must fail **for the expected reason** — the assertion that fails must directly express the bug. Not a setup mismatch, not an unrelated comparison.
- The test must be **narrow.** It exercises one behavior. Broad scenario tests are useful but separate.
- The test must **not encode current broken behavior.** Snapshotting the bug as "expected" is the opposite of a regression test.
- The test must **not require real external services** (mediasoup workers, Twitch, payment provider, real OAuth) unless it is explicitly an integration / e2e test in a dedicated path.
- **Do not rewrite existing tests** to hide the bug.
- **Do not delete tests** to make CI green.
- **One bug = one targeted regression test** when practical. Multiple-bug scenarios can share a test only if they cannot be separated.
- **Extraction is a separate PR.** If the only way to add a failing regression test is to extract code into a pure helper (or a new consistency package), that extraction is a separate, behavior-preserving PR. The bug fix lands in a follow-up PR against the extracted helper. **Do not bundle extraction + fix in a single diff unless the user explicitly approves** — see [`/ai/AI_RULES.md`](AI_RULES.md) §2 ("No refactor + behavior change in one diff").
- If no automated test is practical, **document why** in the PR description and provide manual QA evidence (browser before / after, screenshots, log snippets, QA rows from [`/ai/QA_CHECKLIST.md`](QA_CHECKLIST.md)).

## How to ask Claude for a regression test

Paste this template, filled out:

```text
Bug:
Evidence:
Confirmed root cause:
Expected behavior:
Actual behavior:
Likely files:
Constraints:
- Do not fix yet.
- First identify the narrowest useful regression test.
- Write or propose the failing test.
- Explain why it fails before the fix.
- Then wait for approval before implementation.
```

For a copy-paste prompt with the full constraints + output contract, see [`/ai/PROMPTS/regression-test-workflow.md`](PROMPTS/regression-test-workflow.md).

## StreamAssist examples

Concrete examples of where the failing-test-first discipline applies, and where it does not.

### 1. Leaderboard / wins duplicate submit

- **Test target:** `packages/client-consistency` for the idempotency-key generation contract; server unit (if a runner is available) for one-write-per-key.
- **Failing assertion (pre-fix):** "two submits with the same idempotency key produce one row" — currently produces two.
- **Why this protects:** locks the idempotency contract at the server boundary so a future refactor cannot drop it silently. See [`/ai/REVIEW_CHECKLIST.md`](REVIEW_CHECKLIST.md) §6 "Known production risk surfaces".

### 2. Auth / session role resolution

- **Test target:** extract the pure portion of `apps/server/src/auth/resolveUserRole.ts` into a consistency package; or add a server unit if a runner is available.
- **Failing assertion (pre-fix):** "an unverified email cannot resolve to `admin`" — currently does for a specific path.
- **Why this protects:** closes the elevation gap and pins the rule for future role-resolution changes.

### 3. WebSocket stale-socket ignored

- **Test target:** `packages/call-core-consistency` for the socket-revision / disposed-flag guard.
- **Failing assertion (pre-fix):** "a callback fired on socket A after socket B replaces it is ignored" — currently fires.
- **Why this protects:** prevents resurrected ghost rooms / duplicate joins after reconnect. See [`/ai/REVIEW_CHECKLIST.md`](REVIEW_CHECKLIST.md) §3 six guards.

### 4. Game rule edge case

- **Test target:** `packages/nadle-core` or `packages/checkers-core`.
- **Failing assertion (pre-fix):** the specific edge input that currently misbehaves.
- **Why this protects:** pins one rule cell at the lowest possible layer; cheap to add, very stable.

### 5. Billing webhook idempotency

- **Test target:** server unit (if a runner is available) or a pure consistency test for the idempotency-key store wrapper.
- **Failing assertion (pre-fix):** "a replayed webhook with the same idempotency key does not credit twice" — currently does.
- **Why this protects:** webhook replays from the provider are routine; idempotency must be enforced. See [`/ai/REVIEW_CHECKLIST.md`](REVIEW_CHECKLIST.md) §6.

### 6. Eat First timer / state transition

- **Test target:** `packages/eat-first-consistency`.
- **Failing assertion (pre-fix):** a specific tick or transition currently produces the wrong next state (or the wrong remaining time, or skips a phase).
- **Why this protects:** timer / state transitions are the most testable Eat First surface and the most common regression class.

### 7. Mafia host ownership / transfer

- **Where the state lives:** server-side, in `apps/server/src/rooms/Room.ts`. **This is not call-core.** Do not put this test in `packages/call-core-consistency` — that suite is for media (WebRTC, mediasoup, screen share, participant maps). Putting Mafia game state there would violate the SSOT rules in [`/ai/STREAMASSIST_CONTEXT.md`](STREAMASSIST_CONTEXT.md).
- **Realistic test targets today:**
  - **Server unit** — only if a server test runner becomes available. None is established today (see [`/ai/STREAMASSIST_CONTEXT.md`](STREAMASSIST_CONTEXT.md) §6).
  - **Extracted pure helper + new Mafia-specific consistency package** — extract the host-transfer state machine to a pure helper (e.g. `packages/mafia-core` or `packages/mafia-consistency`) as a **separate behavior-preserving prep PR**; the bug fix then lands in a follow-up PR against the extracted helper (see the regression-test contract below on extraction).
  - **Until a test home exists** — manual QA only. Use [`/ai/QA_CHECKLIST.md`](QA_CHECKLIST.md) §3 "Mafia" host-lock and host-transfer rows, plus [`/ai/BROWSER_DEBUG_WORKFLOW.md`](BROWSER_DEBUG_WORKFLOW.md) F8 (Mafia host controls not visible) for evidence capture before and after the fix.
- **Failing assertion (pre-fix, once a test home exists):** "transfer from A to B with A still connected leaves a window where both have host" — currently does.
- **Why this protects:** host authority is a high-risk surface (see [`/ai/CLAUDE.md`](CLAUDE.md) §3); atomic transfer must be locked in.

### 8. Twitch message parsing / throttling

- **Test target:** `packages/nadle-consistency` (parser, throttler).
- **Failing assertion (pre-fix):** a specific malformed or rapid-burst input currently produces the wrong output or no throttling.
- **Why this protects:** Twitch chat is unpredictable; the parser must handle wild input and the rate-limit must not drift.

### 9. WebRTC black screen — automated test not enough

- **Test target:** **none reliably automatable.**
- **What to do instead:** document the bug, capture browser evidence with [`/ai/BROWSER_DEBUG_WORKFLOW.md`](BROWSER_DEBUG_WORKFLOW.md) §E + §F + §H, and append a QA row to [`/ai/QA_CHECKLIST.md`](QA_CHECKLIST.md) §1 covering the specific repro recipe.
- **Manual QA:** rows C1 (two tabs), C7 (8–12 cameras), §F canvas pixel test on the affected tile, §H `framesDecoded` growth check.
- **Why this is acceptable:** WebRTC layer behavior depends on browser, codec, GPU, and network in ways unit tests cannot reproduce. Manual QA is the protection. Document this honestly in the PR.

## Output format

### Before implementation

```text
1. Root cause (file + line):
2. Is the bug testable? (yes — narrowest layer + reason / no — manual QA only + reason):
3. Narrowest test layer:
4. Test file to add or change:
5. Expected failing assertion (one sentence):
6. Why this test protects against regression (one sentence):
7. Manual QA still needed (rows from /ai/QA_CHECKLIST.md):
8. Approval needed before fix? (yes/no — yes for high-risk surfaces per /ai/CLAUDE.md §3):
```

### After implementation

```text
1. Test added / updated (file + name):
2. Failing-before-fix evidence (command + output excerpt):
3. Fix summary (file + line — one line per file):
4. Passing-after-fix evidence (command + output excerpt):
5. Nearby tests run (suite + result):
6. Manual QA run / not run (rows + outcome):
7. Remaining risk:
```
