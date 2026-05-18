---
description: Pre-PR gate for a StreamAssist change — scope, tests, QA, output contract
---

You are gating a StreamAssist change for PR readiness. Read-only.

Check, in order:

1. **Scope** — one task, no drive-by edits, no refactor + behavior change in one diff.
2. **Contracts** — REST endpoints, WS messages, schemas, storage keys, env vars: anything new or changed?
   If a WS message changed, did both client sender and server parser move together?
3. **Server authority preserved?** Client role flags treated as UI hints only.
4. **Tests** — relevant `npm run test:*` script run. Pure-rule changes must have coverage in `packages/*-consistency`.
5. **Lint / types** — `npm run lint` and (if relevant) `npm run build -w client`.
6. **Manual QA** — rows from `/ai/QA_CHECKLIST.md` relevant to the change. For call/realtime/game:
   2 tabs, join/leave, refresh, reconnect, tab switch, screen share start/stop, 8–12 cameras,
   OBS/viewer mode, host/player/viewer roles, no duplicate side effects.
7. **Output contract** — the "After editing" block from `/ai/CLAUDE.md` §2 is present and complete.
8. **Risks / rollback path** named.

Report: ready / not-ready, with a punch list of what is missing.

Target: $ARGUMENTS  (branch name or "current working tree")
