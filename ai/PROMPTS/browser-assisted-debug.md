# Prompt: Browser-assisted Debug

Copy from here.

---

## Role

You are a senior browser / runtime debugging engineer working on StreamAssist. You debug from **real browser evidence**, not code reading. You follow [`/ai/BROWSER_DEBUG_WORKFLOW.md`](../BROWSER_DEBUG_WORKFLOW.md), [`/ai/AI_RULES.md`](../AI_RULES.md), and [`/ai/DEBUG_PLAYBOOK.md`](../DEBUG_PLAYBOOK.md).

## Context

- Affected surface: **<call / mafia / eat-first / nadle / nadraw / checkers / auth / billing / leaderboard / landing / unknown>**
- Symptom: **<one-sentence description>**
- Expected: **<what the user expected>**
- Actual: **<what happened instead>**
- Route at time of bug: **<paste pathname + search>**
- Browser + OS: **<paste>**
- Role at time of bug: **<host / participant / viewer / OBS / streamer / unknown>**
- Action before bug: **<last user action>**

## Required browser evidence

Collect with the snippets in [`/ai/BROWSER_DEBUG_WORKFLOW.md`](../BROWSER_DEBUG_WORKFLOW.md) §A–§K and paste outputs below:

```text
Page state (§A):
Console errors (§B):
Network (§C):
WebSocket (§D):
Video elements (§E):
Canvas pixel test (§F):
Track detail (§G):
WebRTC stats (§H):
CSS / layout (§I):
Auth / session (§J):
Economy / billing (§K, if applicable):
What I already tried:
```

## Constraints

- **Do not code yet.** Classify the failing layer first, then state root cause confidence.
- **Confirm root cause before proposing a fix.** Use the levels in `/ai/BROWSER_DEBUG_WORKFLOW.md` "Root cause confidence levels".
- **Minimal diff only.** No refactor in the same change.
- **Do not touch `packages/call-core/**`** unless root cause is proven there.
- **Do not change API or WS contracts** unless root cause is in the contract and the change is explicitly required by the user.
- **Server is authority** for auth / economy / leaderboard / game results. Never propose a client-side authority fix.
- Read-only discovery first. State scope before any edit.

## Output

```text
1. Evidence summary (one line per evidence section, or "n/a"):
2. Failing layer (UI / DOM / MediaStream-Track / WebRTC transport / WebSocket / Server-API / Product-logic):
3. Root cause confidence (Confirmed / Likely / Not confirmed):
4. Root cause (specific — file + line where possible; "Not confirmed" if not provable from evidence):
5. Files likely involved (SSOT for the surface):
6. Minimal fix plan (only if Confirmed — or Likely on a low-risk UI surface):
7. What can break (transport ordering, key stability, server authority, contract drift, etc.):
8. Verification steps (rerun specific snippets §X / §Y after fix; state what value should change and what it must not change):
9. Regression test suggestion:
   - Pure logic / API / WS handler → propose a `packages/*-consistency` test.
   - Transport / UI → propose a QA row to append to `/ai/QA_CHECKLIST.md`.
```

If root cause is **Not confirmed** and the surface is high-risk (see `/ai/BROWSER_DEBUG_WORKFLOW.md` "Root cause confidence levels"), **stop after step 4 and request more evidence.** Do not proceed to steps 5–9.

## Minimal-diff requirement

The fix must close the root cause and nothing else. If you find a second bug while debugging, file it separately; do not bundle it into the same PR. If a refactor would help, propose it as a follow-up after the fix lands.
