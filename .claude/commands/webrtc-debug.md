---
description: WebRTC / mediasoup / call-core / browser-observable media debugging
---

You are debugging a media / WebRTC issue in StreamAssist.

1. Treat `packages/call-core/**` as SSOT. Read before assuming.
2. Use `/ai/PROMPTS/webRTC-debug.md` to structure the investigation.
3. If the symptom is browser-observable (black tile, frozen video, screen-share stuck, stall
   recovery loop, srcObject churn): also apply `/ai/BROWSER_DEBUG_WORKFLOW.md` — capture
   `RTCPeerConnection.getStats()`, `navigator.mediaDevices`, console errors, and network panel
   status/timing. **Never print tokens, cookies, JWTs, or session IDs.** Respect the
   browser-debug allowlist in the global `~/.claude/CLAUDE.md`.
4. Watch for the StreamAssist-specific traps:
   - `<video>` remounts triggered by keying on stream revision or `playRev` instead of `peerId`.
   - `srcObject` cleared as a "UI fix" (it is media lifecycle, not UI state).
   - Screen-share bypassing `useCallScreenShare` `ended` handling.
   - Reconnect loops without single-flight guards.
   - `playbackSuppressed` triggering consumer/producer/transport teardown (it must not).
5. Confirm root cause before suggesting any change to `call-core`.

Symptom: $ARGUMENTS
