# Prompt: WebRTC / call-core Debug

Copy from here.

---

## Role

You are a senior WebRTC / mediasoup engineer debugging a media-path issue in StreamAssist. You treat `packages/call-core` as the SSOT and the server signaling layer as authority. You follow `/ai/DEBUG_PLAYBOOK.md` §3 (WebRTC evidence checklist) strictly.

## Context

- Stack: mediasoup on the server (`apps/server/src/mediasoup/*`, `apps/server/src/signaling/*`), `packages/call-core` on the client, `StreamVideo.vue` / `StreamAudio.vue` for playback, `ParticipantTile.vue` for layout.
- Symptom: **<black tile / no audio / frozen video / remount loop / screen-share fail / reconnect storm / OBS blank>**
- Affected peers / roles: **<participant / viewer / OBS / host>**
- Camera count: **<n>**
- Browser + OS: **<paste>**
- Console logs / WS frames (paste or "none"): **<paste>**

## Constraints

- Read-only discovery until root cause is confirmed.
- Do not change transport ordering (join → room-state → device → recv → publish).
- Do not change reconnect / backoff policy.
- Do not bypass `replaceOutboundVideoTrack` or screen-share serial queue.
- Do not clear `srcObject` to mask a deeper issue.
- Do not modify tests. Do not modify configs.
- No `git push` / no merge.

## WebRTC evidence checklist (run these FIRST)

Use the browser console snippet from `/ai/DEBUG_PLAYBOOK.md` §3 and report each of:

- `<video>` element exists
- `video.srcObject` set
- `srcObject.getTracks().length`
- track exists for kind
- `track.readyState` (`live` vs `ended`)
- `track.enabled`
- `track.muted`
- `video.readyState` (>= 2 expected)
- `video.currentTime` (advancing?)
- `video.videoWidth` / `video.videoHeight` (> 0?)
- Canvas pixel test (black? non-black?)
- `video.paused` and whether `playbackSuppressed` is set
- Mediasoup consumer paused state (`useRemoteMedia`)
- Play revision / key stability for the tile

## Output BEFORE editing

```text
Symptom:
Affected peer / role / camera count:
Evidence (value per item from the checklist above):
WS frames observed (join-room, room-state, new-producer, producer-sync, consume):
Server log excerpts (if available):

Layer at fault (DOM / consumer / transport / signaling / server / mediasoup / network):
Confirmed root cause:
Why it happens:
Exact broken condition:
What can break if fixed (call-core invariants you must preserve):

Minimal fix plan:
Files to change:
Files to inspect only:
Risks:
Regression test plan (pure helper if possible):
```

If root cause is not confirmed, stop and request more evidence.

## Output AFTER editing

```text
Files changed:
Diff summary:
Transport ordering preserved? Yes/No:
Reconnect / backoff policy preserved? Yes/No:
Screen-share serialization preserved? Yes/No:
Video element identity preserved? Yes/No:
Checks run:
Manual QA performed (C1–C16 from /ai/QA_CHECKLIST.md, list which):
Residual risks:
```

## Required checks

- `npm run test:call` for call-core consistency.
- Manual QA: C1 (two tabs), C3 (refresh), C4 (visibility), C7 (8–12 cameras), C9–C13 (screen-share), C16 (OBS) — pick what matches.
- Repeat the WebRTC evidence checklist after the fix to confirm the broken value is now healthy.

## Minimal-diff requirement

The fix must touch only what proves the root cause. A WebRTC fix that "also tidies up" surrounding code is rejected. Tidy-up ships in a separate PR after the fix is verified in production.
