# Browser-assisted AI debugging workflow

This document specifies how AI agents in this repository must use **real runtime evidence from the browser** when debugging — instead of reasoning from code alone.

## Core principle

> **UI can lie. Browser runtime evidence is the truth.**

Code reading tells you what *should* happen. The browser tells you what *did* happen. When the two disagree, the browser wins until the disagreement is explained.

This workflow complements [`/ai/DEBUG_PLAYBOOK.md`](DEBUG_PLAYBOOK.md). Use it whenever the symptom is observable in a running browser: a black tile, a wrong UI state, a failed request, an unexpected redirect, a stuck overlay.

## Workflow

1. **Describe the symptom clearly.** One sentence. What did you see vs what you expected.
2. **Identify the affected surface.** Pick one (or two, if cross-cutting):
   - Call / WebRTC
   - Mafia overlay
   - Eat First (join / control / admin / overlay)
   - Nadle / Nadraw Show
   - Checkers
   - Auth / session
   - Billing / economy
   - Landing / general UI
3. **Collect browser evidence** using the snippets below (§A–§K). Capture exact values, not summaries.
4. **Classify the failing layer.** Exactly one:
   - **UI layer** — Vue rendering, props, event handlers, template logic
   - **DOM layer** — element existence, CSS, layout, visibility
   - **MediaStream / Track layer** — track lifecycle, `srcObject`, `enabled` / `muted` / `readyState`
   - **WebRTC transport layer** — `RTCPeerConnection`, ICE, stats, mediasoup transport
   - **WebSocket layer** — socket `readyState`, message ordering, reconnect, ping / pong
   - **Server / API layer** — request reaches server, server handler logic, DB / storage
   - **Product / business logic layer** — pure rules in `packages/*-core`, orchestrator decisions, role / permission gates
5. **Send the evidence to Claude** using the "How to send evidence" template below.
6. **Claude must identify root cause or say "root cause not confirmed."** Generic guesses are not acceptable here. See "Root cause confidence levels" below.
7. **Claude proposes the minimal fix.** No refactor in the same change. No protocol drift.
8. **Verify with the same browser evidence after the fix.** Re-run the snippets that showed the broken value; confirm the value is now healthy.
9. **Add a regression test** if the bug is in pure logic (`packages/*-core`), an API handler, or a WS handler. UI / transport bugs get a manual QA case appended to [`/ai/QA_CHECKLIST.md`](QA_CHECKLIST.md) instead.

## Ready-to-copy browser snippets

> Paste each snippet into the browser DevTools console **on the affected page** and copy the output to share with Claude. Snippets are intentionally read-only.

### A. Basic page / runtime state

```js
(() => {
  const safeKeys = ['theme', 'roomId', 'streamerId', 'role', 'mode', 'lang'];
  const ls = Object.fromEntries(safeKeys
    .map(k => [k, localStorage.getItem(k)])
    .filter(([, v]) => v !== null));
  const ss = Object.fromEntries(safeKeys
    .map(k => [k, sessionStorage.getItem(k)])
    .filter(([, v]) => v !== null));
  return {
    href: location.href,
    route: location.pathname + location.search,
    viewport: `${innerWidth}x${innerHeight}`,
    devicePixelRatio,
    userAgent: navigator.userAgent,
    online: navigator.onLine,
    localStorage: ls,
    sessionStorage: ss,
    time: new Date().toISOString(),
  };
})();
```

Do not copy secrets, tokens, or OAuth codes. The `safeKeys` allowlist keeps you to non-sensitive keys.

### B. Console errors

The DevTools console does not expose past entries programmatically. For each error, copy manually and include:

- Exact text (full stack)
- Route at time of error
- Time (approximate)
- Last user action before the error

If you can keep the page open through the bug, enable DevTools → Console → "Preserve log", then reproduce.

### C. Network evidence checklist

Open DevTools → Network. For each suspicious request, capture:

- URL / path
- Method (GET / POST / WS upgrade)
- Status code
- Request payload shape (no secrets)
- Response body snippet (first ~500 chars; redact tokens)
- Cookies included? (without printing cookie values)
- CORS error visible? Which header?
- For WebSocket: close code + reason (1000 normal, 1006 abnormal, 1011 server error, 1015 TLS failure, 4xxx app-defined)

### D. WebSocket evidence

```js
// Best-effort: find a WebSocket via known debug hooks.
// If the app does not expose one globally, open the WS row in DevTools → Network → Messages.
(() => {
  const ws = window.__debugCallSocket?.() ?? window.__callWs ?? null;
  if (!ws) return { found: false, hint: 'Use DevTools → Network → WS frames panel instead.' };
  return {
    readyState: ws.readyState, // 0 connecting, 1 open, 2 closing, 3 closed
    url: ws.url,
    bufferedAmount: ws.bufferedAmount,
    protocol: ws.protocol,
  };
})();
```

Capture alongside (from URL / query):

- `roomId` from path
- `streamerId` from path / query
- Any `mode=...` flags

### E. Video element evidence

```js
(() => Array.from(document.querySelectorAll('video')).map((v, i) => {
  const s = v.srcObject;
  return {
    i,
    paused: v.paused,
    readyState: v.readyState, // 0..4
    currentTime: v.currentTime,
    videoWidth: v.videoWidth,
    videoHeight: v.videoHeight,
    autoplay: v.autoplay,
    muted: v.muted,
    srcObject: !!s,
    tracks: s ? s.getTracks().map(t => ({
      kind: t.kind,
      readyState: t.readyState,
      enabled: t.enabled,
      muted: t.muted,
      label: t.label,
      id: t.id,
    })) : null,
  };
}))();
```

### F. Canvas pixel test

Confirms whether a `<video>` is actually rendering pixels.

```js
(() => {
  const v = document.querySelectorAll('video')[0];
  if (!v || !v.videoWidth) return { ok: false, reason: 'no video / no dimensions' };
  const c = document.createElement('canvas');
  c.width = Math.min(v.videoWidth, 64);
  c.height = Math.min(v.videoHeight, 64);
  c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
  const data = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) sum += data[i] + data[i + 1] + data[i + 2];
  return { ok: true, pixelSum: sum, hint: sum > 0 ? 'real pixels' : 'all black / no frames decoded' };
})();
```

- `pixelSum > 0` → real pixels are reaching the element; if the user reports black, look at CSS / z-index / an overlay covering it.
- `pixelSum === 0` → no frames decoded; look at track / transport / decoder.

### G. WebRTC track evidence (detailed)

```js
(() => Array.from(document.querySelectorAll('video, audio')).flatMap((el, i) => {
  const s = el.srcObject;
  if (!s) return [{ i, kind: el.tagName, srcObject: false }];
  return s.getTracks().map(t => ({
    i,
    elKind: el.tagName,
    kind: t.kind,
    readyState: t.readyState,
    enabled: t.enabled,
    muted: t.muted,
    label: t.label,
    contentHint: t.contentHint,
    settings: t.getSettings?.() ?? null,
  }));
}))();
```

### H. WebRTC stats checklist

Run on a real `RTCPeerConnection` handle (debug hook, or captured at a breakpoint inside `useCallEngine`). Without a handle, you can still infer a lot from §C and §E.

```js
(async () => {
  const pc = window.__debugPc?.() ?? null;
  if (!pc) return { hint: 'No debug PC handle. Capture from a breakpoint in useCallEngine.' };
  const stats = await pc.getStats();
  const out = [];
  for (const r of stats.values()) {
    if (r.type === 'inbound-rtp') out.push({
      kind: r.kind, ssrc: r.ssrc,
      bytesReceived: r.bytesReceived,
      framesDecoded: r.framesDecoded,
      framesDropped: r.framesDropped,
      packetsLost: r.packetsLost,
      jitter: r.jitter,
      nackCount: r.nackCount,
      pliCount: r.pliCount,
    });
    if (r.type === 'outbound-rtp') out.push({
      kind: r.kind, ssrc: r.ssrc,
      bytesSent: r.bytesSent,
      framesEncoded: r.framesEncoded,
      qualityLimitationReason: r.qualityLimitationReason,
    });
  }
  return out;
})();
```

Health rules (see also [`/ai/DEBUG_PLAYBOOK.md`](DEBUG_PLAYBOOK.md) §3a):

- `bytesReceived` growing every second → media flowing.
- `framesDecoded` growing while `bytesReceived` grows → decoder OK.
- `framesDropped` rising → CPU pressure or receiver-side playback budget.
- `packetsLost`, `nackCount`, `pliCount` rising together → network loss.
- `qualityLimitationReason` ∈ {`cpu`, `bandwidth`, `other`} → encoder is throttling.

### I. CSS / layout evidence

For "the tile is missing" / "the button doesn't click" when pixels exist but the user does not see them.

```js
(el => {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    rect: { x: r.x, y: r.y, w: r.width, h: r.height },
    display: cs.display,
    visibility: cs.visibility,
    opacity: cs.opacity,
    zIndex: cs.zIndex,
    pointerEvents: cs.pointerEvents,
    overflow: cs.overflow,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  };
})(document.querySelector('SELECTOR_HERE'));
```

Replace `SELECTOR_HERE` with the element under investigation (e.g. `.participant-tile`, `[data-role="host-controls"]`).

### J. Auth / session evidence

```js
(async () => {
  const r = await fetch('/api/auth/me', { credentials: 'include' });
  let body = null;
  try { body = await r.json(); } catch { body = '<non-JSON>'; }
  return {
    route: location.pathname,
    status: r.status,
    bodyShape: body && typeof body === 'object'
      ? Object.fromEntries(Object.entries(body).map(([k, v]) => [k, typeof v]))
      : body,
    cookieNames: document.cookie.split(';').map(c => c.split('=')[0].trim()).filter(Boolean),
    credentialsIncluded: true,
  };
})();
```

For redirect-loop bugs, also note in DevTools → Network the chain of 30x responses and which `Location` headers were followed.

**Never print cookie values, OAuth codes, signed tokens, or secrets.**

### K. Economy / billing / leaderboard evidence

When an action did not register or registered twice:

- Action attempted (plain English)
- Request payload **shape** (keys + types, no secrets)
- Response status + body shape
- Did the user double-click? Did the network retry? Was an idempotency key sent?
- Are there two writes server-side for the same logical event?
- Was the value (`score` / `coins` / `streamerId` / `result`) supplied by the client? (See [`/ai/REVIEW_CHECKLIST.md`](REVIEW_CHECKLIST.md) §6 — server is authority.)

## How to send evidence to Claude

Paste this template, filled out:

```text
Symptom:
Expected:
Actual:
Route:
Action before bug:
Browser evidence:
  - Page state (§A):
  - Console errors (§B):
  - Network (§C):
  - WebSocket (§D):
  - Video elements (§E):
  - Canvas pixel test (§F):
  - Track detail (§G):
  - WebRTC stats (§H):
  - CSS / layout (§I):
  - Auth / session (§J):
  - Economy / billing (§K):
What I already tried:
```

End your message with:

> **Do not code yet. First identify the failing layer and root cause confidence.**

## Root cause confidence levels

| Level | Meaning | What Claude may do |
|-------|---------|--------------------|
| **Confirmed** | Evidence directly proves the cause (e.g. `track.readyState === 'ended'` proves no media). | Propose minimal fix; implement on user approval. |
| **Likely** | Evidence is consistent with the cause but does not exclude alternatives. | Propose targeted additional evidence to confirm before fixing. |
| **Not confirmed** | Insufficient evidence; multiple plausible causes. | **Stop. Request more evidence.** Do not patch by guess. |

**Rule:** Claude must not implement a fix when root cause is *Not confirmed* on any of these high-risk surfaces:

- `packages/call-core/**` (any media stack change)
- WebRTC transport / signaling
- WS protocols (`/ws`, `/nadle-ws`, `/eat-first-ws`, `/nadraw-show-ws`, `/checkers-ws`)
- `apps/server/src/auth/**`
- `apps/server/src/leaderboardRouter.ts`, `apps/server/src/coinHub/**`, `apps/server/src/billing/**`

For low-risk UI surfaces (landing copy, layout polish, label changes), *Likely* may be enough if the change is reversible and observable.

## StreamAssist-specific high-risk browser debug flows

Each flow lists: evidence to collect → likely layer → do-not-touch-before-confirmed list.

### F1. Camera not visible (local tile black)

- Evidence: §E (`videoWidth` / `videoHeight`, tracks), §F (canvas pixel), §G (`track.readyState` / `enabled` / `muted` / `label`), browser site-permissions panel.
- Likely layer: MediaStream / Track → DOM / CSS → WebRTC send.
- Do not touch before confirmed: `packages/call-core/src/transport/useSendTransport.ts`, `screenShare/*`, `media/useLocalMedia.ts`.

### F2. Screen share appears black to remote peers

- Evidence: locally §F (pixel test on screen-share tile); remote-side §E and §H (`inbound-rtp` video `framesDecoded`); §C for any `consume` errors.
- Likely layer: WebRTC transport (consumer paused / wrong producer) → MediaStream / Track.
- Do not touch before confirmed: `useCallScreenShare.ts`, `useRemoteMedia.ts`, mediasoup server.

### F3. Screen share stop does not restore camera

- Evidence: §E (tracks on local tile before / after stop), §G (`label` should switch back to a camera label), server logs around `replaceOutboundVideoTrack`.
- Likely layer: WebRTC send (track-replace ordering) → product logic.
- Do not touch before confirmed: `useCallScreenShare.ts`, `useSendTransport.ts`.

### F4. Remote participant not visible

- Evidence: §H `inbound-rtp` `bytesReceived` for that peer, §D WS frames around `new-producer` / `producer-sync`, §E remote tile existence, §F pixel test.
- Likely layer: WebSocket (missed producer) → WebRTC consume → DOM.
- Do not touch before confirmed: `useCallEngine.ts`, `useRemoteMedia.ts`, `messageHandlers.ts`.

### F5. Audio works but video does not (or vice versa)

- Evidence: §H both `inbound-rtp` `kind: 'audio'` and `kind: 'video'`; §G per-track `enabled` / `muted`; §E `videoWidth` vs audio-track presence.
- Likely layer: WebRTC consume (one kind paused / closed) → product logic (one kind suppressed in UI).
- Do not touch before confirmed: `useRemoteMedia.ts`, `apps/client/src/components/call/videoPlaybackBudgetPolicy.ts` (note the "Verify before assuming" caveat in [`/ai/STREAMASSIST_CONTEXT.md`](STREAMASSIST_CONTEXT.md) §5).

### F6. Viewer mode broken (controls leak or media never arrives)

- Evidence: §A `role` / `mode` from URL / storage, §D WS `join-room` payload, §J auth, §H `inbound-rtp` only (no outbound for viewer).
- Likely layer: Product / role logic → server authority.
- Do not touch before confirmed: `messageHandlers.ts` `join-room` handling, `CallPage.vue` role wiring.

### F7. OBS browser source broken (blank source)

- Evidence: load the OBS URL in a regular Chrome tab; run §E + §F + §H; check §D for reconnect storm; check `prefers-reduced-motion` and autoplay policy.
- Likely layer: Auth / session (browser-source cookies often differ) → autoplay / audio-unlock → WebRTC consume.
- Do not touch before confirmed: `reconnectOrchestrationPolicy.ts`, `audio/audioPlaybackUnlock.ts`, OBS-only route guards.

### F8. Mafia host controls not visible (host UI missing for the actual host)

- Evidence: §J `/api/auth/me`, §D WS `host` / role messages, §A `mode` from URL, server logs for host state in `rooms/Room.ts`.
- Likely layer: Product / role logic → server authority for host.
- Do not touch before confirmed: `rooms/Room.ts` Mafia state, `stores/mafiaGame.ts`, `signaling/mafiaWsProtocol.ts`.

### F9. Eat First overlay stale (overlay shows wrong state)

- Evidence: §A current `mode=overlay` URL / query; §D WS snapshot vs delta frames; compare to main app state at the same instant; §D WS `readyState`.
- Likely layer: WebSocket (snapshot vs delta merge) → product / state.
- Do not touch before confirmed: `apps/server/src/eatFirst/broadcast.ts`, `apps/client/src/eat-first/services/eatFirstSync.js`, `stores/eatFirstCallShell.ts`.

### F10. Nadle Twitch guesses not syncing

- Evidence: §C web-guess request vs Twitch ingest path; §D WS frames on `/nadle-ws` for guess events; server logs for `streamerActiveGame.ts` / Nadle ingest; casing differences in streamer username.
- Likely layer: Server / API (Twitch ingest), product logic (streamer-ID normalization).
- Do not touch before confirmed: `apps/server/src/nadle/*`, Twitch ingest helpers.

### F11. Leaderboard / wins not submitted (or submitted twice)

- Evidence: §C request payload + response for `/api/wins` (or relevant route); count requests around the event; idempotency-key presence; §J auth state.
- Likely layer: Server / API authority and idempotency.
- Do not touch before confirmed: `apps/server/src/leaderboardRouter.ts`. See [`/ai/REVIEW_CHECKLIST.md`](REVIEW_CHECKLIST.md) §6 "Known production risk surfaces".

### F12. Auth redirect loop

- Evidence: §J `/api/auth/me` status; §C 30x chain with `Location` headers; cookie-name list (no values) at each step; same-site / secure attributes; whether `credentials: 'include'` is set client-side.
- Likely layer: Auth / session.
- Do not touch before confirmed: `apps/server/src/auth/oauthRouter.ts`, `apps/server/src/auth/session/*`, client `useAuth`.

### F13. Billing / economy duplicate action

- Evidence: §K full block; §C double-request check; server logs for the webhook handler and idempotency-key store.
- Likely layer: Server / API authority and idempotency.
- Do not touch before confirmed: `apps/server/src/billing/*`, `apps/server/src/coinHub/*`. See [`/ai/REVIEW_CHECKLIST.md`](REVIEW_CHECKLIST.md) §6.

---

For one-shot debugging sessions, use the copy-paste prompt at [`/ai/PROMPTS/browser-assisted-debug.md`](PROMPTS/browser-assisted-debug.md).
