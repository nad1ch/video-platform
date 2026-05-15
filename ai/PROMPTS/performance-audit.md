# Prompt: Performance Audit

Copy from here.

---

## Role

You are a senior performance engineer auditing a hotspot in StreamAssist. You measure before you optimize. You preserve transport invariants. You follow `.cursor/rules/streamassist-engineering-rules.mdc` §13 and `/ai/AI_RULES.md`.

## Context

- Codebase: Vue 3 + Vite client, WebRTC via `packages/call-core`, 8–12 camera grids, Mafia / Eat First / Nadle / Nadraw / Checkers overlays.
- Reported symptom: **<jank / high CPU / video remount / black tile flicker / OBS source CPU spike / other>**
- Hotspot (best guess): **<CallPage / ParticipantTile / StreamVideo / useRemoteMedia / overlay / landing>**
- Conditions that trigger it: **<n cameras / OBS mode / screen-share / reconnect / which game>**
- Profiling artifacts (if any): **<PASTE FLAME GRAPH / DEVTOOLS PERF / OR "none">**

## Constraints

- Read-only discovery first. Do not edit until the regression is reproduced and the cause is identified.
- Do not change WebRTC transport sequencing for a UI optimization.
- Do not remount `<video>` elements. Stable keys, stable props.
- Do not clear `srcObject` to "fix" rendering.
- No O(N*M) maps in templates.
- Minimal diff only. Split mechanical refactor from media changes.

## Output BEFORE editing

```text
Symptom:
Repro conditions (camera count, mode, role):
Profiling evidence collected:

Hotspot file(s):
Why it rerenders / remounts / re-computes:
Root cause (rerender trigger / watcher loop / unstable key / O(N*M) map / heavy compute):

Minimal safe optimization:
- What changes:
- What does NOT change (transport, ordering, key strategy):
- Why this is safe under 8–12 cameras + OBS mode:

Files to change:
Files to inspect only:
Risks (especially: remount risk, key stability, prop stability):
Test plan (pure helpers if extractable):
Manual perf-QA plan:
```

## Output AFTER editing

```text
Files changed:
Diff summary:
Behavior preserved? Yes/No + why:
Transport touched? Yes/No (should be No):
Video element identity preserved? Yes/No:
Checks run:
Perf measurement before vs after (FPS / CPU / render count / frame time):
Manual QA performed (8–12 cameras, OBS mode, screen-share toggle, reconnect):
Residual risks:
```

## Required checks

- Extracted a pure helper? Add a `packages/*-consistency` test.
- `npm run test:client` and `npm run test:call` if call paths touched.
- `npm run build -w client` if client integration touched.
- Manual QA C7 (8–12 cameras), C16 (OBS), C9–C13 (screen-share) from `/ai/QA_CHECKLIST.md`.

## Minimal-diff requirement

The optimization must be the smallest change that demonstrably moves the metric. If you cannot show "before vs after", you have not finished the audit. Mechanical refactors (e.g., extracting a pure helper) ship in a separate PR from the media-path change.
