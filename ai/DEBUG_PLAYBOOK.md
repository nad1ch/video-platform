# DEBUG_PLAYBOOK.md — How to debug in StreamAssist

Use this any time the user reports a bug. Do not skip steps.

## 1. The seven-step loop

1. **Reproduce** — get a deterministic recipe. If you cannot reproduce, say so; do not guess.
2. **Isolate the layer** — Client UI? Composable / orchestrator? `call-core`? WebSocket? Server handler? Mediasoup? DB? Network (Cloudflare / Nginx)?
3. **Collect runtime evidence** — console logs, WS frames, server logs, mediasoup stats, DOM / track state.
4. **Form hypotheses** — list 2–4 plausible root causes. Rank by evidence.
5. **Confirm root cause** — prove the top hypothesis with a targeted log / test / inspection. Do not skip this step.
6. **Minimal fix** — smallest diff that closes the root cause. No refactor in the same PR.
7. **Regression coverage** — add a pure-logic test in `packages/*-consistency` when the bug touches pure rules. If the bug is in transport / UI, document QA steps instead.

## 2. Required output before fixing

```text
Reproduction steps:
Affected layer:
Evidence collected:
Hypotheses (ranked):
Confirmed root cause:
Why it happens:
Exact broken condition:
What can break if fixed:
Minimal fix plan:
Files to change:
Regression test plan (or QA steps if no test possible):
```

If root cause is **not** confirmed, say so. Do not patch.

## 3. WebRTC / video-element evidence checklist

When the symptom is "black tile", "frozen video", "no audio", "tile disappears", "tile flickers", "remount loop", inspect in this order:

| # | Check | Where | What "broken" looks like |
|---|-------|-------|--------------------------|
| 1 | `<video>` element exists | DOM | element missing → mount / unmount bug; check `v-if` / key |
| 2 | `video.srcObject` is set | Element prop | `null` → stream not assigned or cleared by UI code |
| 3 | `video.srcObject.getTracks().length > 0` | MediaStream | 0 tracks → consume failed or track removed |
| 4 | Track exists for kind | `getVideoTracks()` / `getAudioTracks()` | missing → producer not consumed or transport down |
| 5 | `track.readyState === 'live'` | Track | `'ended'` → upstream stopped or consumer closed |
| 6 | `track.enabled === true` | Track | `false` → UI muted the track |
| 7 | `track.muted` | Track | `true` → no media flowing (browser-reported) |
| 8 | `video.readyState >= 2` (HAVE_CURRENT_DATA) | Element | `0` / `1` → autoplay blocked, format mismatch, or no frames |
| 9 | `video.currentTime` is advancing | Element over time | stuck → consumer paused, network stalled, or playback suppressed |
| 10 | `video.videoWidth > 0 && video.videoHeight > 0` | Element | `0` → no decoded frame yet |
| 11 | Canvas pixel test | draw `<video>` to canvas, sample pixel | all black → no decoded frame; non-black → render path is fine, look at CSS / z-index |
| 12 | `video.paused` | Element | `true` → autoplay policy or `playbackSuppressed` |
| 13 | Mediasoup consumer paused? | `useRemoteMedia` state | paused unexpectedly → bug in receive path |
| 14 | RVFC / play revision bumped? | call-core | unstable key → forced remount |

Quick console snippet to run in the browser when triaging:

```js
const v = document.querySelector('video');
const s = v?.srcObject;
const t = s?.getVideoTracks?.()[0];
console.table({
  elementExists: !!v,
  srcObjectExists: !!s,
  trackCount: s?.getTracks?.().length ?? 0,
  trackExists: !!t,
  trackReadyState: t?.readyState,
  trackEnabled: t?.enabled,
  trackMuted: t?.muted,
  videoReadyState: v?.readyState,
  currentTime: v?.currentTime,
  videoWidth: v?.videoWidth,
  videoHeight: v?.videoHeight,
  paused: v?.paused,
});
```

Canvas pixel test:

```js
const v = document.querySelector('video');
const c = document.createElement('canvas');
c.width = v.videoWidth; c.height = v.videoHeight;
c.getContext('2d').drawImage(v, 0, 0);
console.log('topleft pixel:', c.getContext('2d').getImageData(0, 0, 1, 1).data);
```

### 3a. WebRTC stats and transport state

The DOM/track checklist tells you what the consumer is presenting. `getStats()` tells you whether media is actually flowing. Run on the receive-side `RTCPeerConnection`:

```js
// pc = receive-side RTCPeerConnection (capture via call-core devtools / breakpoint)
const stats = await pc.getStats();
for (const r of stats.values()) {
  if (r.type === 'inbound-rtp' && r.kind === 'video') {
    console.log({
      bytesReceived: r.bytesReceived,
      framesDecoded: r.framesDecoded,
      framesDropped: r.framesDropped,
      packetsLost: r.packetsLost,
      jitter: r.jitter,
      nackCount: r.nackCount,
      pliCount: r.pliCount,
    });
  }
}
```

Interpreting:

- `bytesReceived` not growing → no media on the wire (transport / firewall / consumer paused upstream).
- `framesDecoded` flat while `bytesReceived` grows → decoder issue or producer encoding stalled.
- `framesDropped` rising → CPU pressure or receiver-side playback budget kicking in.
- `packetsLost` rising → network loss; `nackCount` / `pliCount` should track.
- `jitter` > ~30 ms sustained → unstable network or simulcast layer churn.

Transport / lifecycle flags to inspect alongside:

| Layer | Field | Healthy | Broken |
|-------|-------|---------|--------|
| WebSocket | `socket.readyState` | `1` (OPEN) | `0` / `2` / `3` |
| WebRTC | `pc.iceConnectionState` | `connected` / `completed` | `failed` / `disconnected` / stuck `checking` |
| WebRTC | `pc.connectionState` | `connected` | `failed` / `disconnected` |
| mediasoup client | `transport.closed` | `false` | `true` (stale transport) |
| mediasoup client | `producer.closed` / `producer.paused` | `false` / `false` | producer dead or paused unexpectedly |
| mediasoup client | `consumer.closed` / `consumer.paused` | `false` / `false` | consumer dead or paused unexpectedly |

Server side (if reachable): check mediasoup `Transport`, `Producer`, `Consumer` `closed` flags via the diagnostics route or server logs before assuming the client is at fault.

## 4. WebSocket / signaling evidence

- DevTools → Network → WS → frames. Confirm the **actual** wire message names — do not guess from code.
- Server logs: `apps/server/src/signaling/*` use structured logging; grep by `roomId` and `peerId`.
- Mismatch in message name → silent protocol drift. Fix client and server together.
- Reconnect loops: confirm `replyJsonPingIfNeeded` is wired and 25s idle does not kill the socket via Cloudflare / Nginx.
- Stale socket: a callback fires after `socket.close()` → guard with the same socket reference captured at send time.

## 5. Common StreamAssist failure shapes

| Symptom | Likely root cause | First file to read |
|---------|-------------------|--------------------|
| Black remote tile | `srcObject` cleared by UI; or consumer paused | `StreamVideo.vue`, `useRemoteMedia.ts` |
| Tile remount on every state change | Unstable `:key`; key bound to `playRev` | `ParticipantTile.vue`, `CallPage.vue` |
| Screen-share start works, second start fails | Serial queue bypassed or `ended` not cleaned up | `useCallScreenShare.ts` |
| New joiner sees no one | `new-producer` arrived before receive listener; missing `producer-sync` | `useCallEngine.ts`, `messageHandlers.ts` |
| Reconnect storm | Multiple timers; reconnect on focus when socket is alive | `useRoomConnection.ts`, `reconnectOrchestrationPolicy.ts` |
| Mafia host lock lost on refresh | Client-side host flag treated as authority | `rooms/Room.ts`, `stores/mafiaGame.ts` |
| Duplicate leaderboard write | Client-driven submit without server idempotency | `apps/server/src/leaderboardRouter.ts` |
| Eat First overlay desync | Overlay assumed media lifecycle it doesn't own | `apps/client/src/eat-first/stores/*` |
| OBS source goes blank after Twitch refresh | Visibility / focus reconnect policy regression | `reconnectOrchestrationPolicy.ts`, `useRoomConnection.ts` |
| Twitch chat guess never lands | Streamer ID / username casing mismatch | `streamerActiveGame.ts`, Nadle ingest |
| Camera off → screen share → stop share leaves camera on | Restore state logic bypassed | `useCallScreenShare.ts`, `useSendTransport.ts` |

## 6. When you cannot reproduce

Say so. Then ask for:

- Browser + version
- OBS vs regular tab
- Streamer / participant / viewer role
- Twitch viewer / streamer dashboard / app
- Console log dump
- Network → WS frames around the failure
- Approximate time so the user can pull server logs
- Camera count / screen-share active / mode flags

Do not patch by guess.
