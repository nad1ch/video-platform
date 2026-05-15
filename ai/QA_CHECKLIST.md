# QA_CHECKLIST.md — Manual QA before shipping

Pick the rows that apply to your change. Document which you ran and which you skipped (and why) in the "After editing" output.

> For any WebRTC / UI fix, capture browser evidence using [`/ai/BROWSER_DEBUG_WORKFLOW.md`](BROWSER_DEBUG_WORKFLOW.md) §A–§K **before** the fix and **after** the fix; attach both to the QA report. "It looks right now" is not evidence.

## 1. Call / realtime (any change touching `call-core`, `CallPage`, signaling, Mafia)

| # | Scenario | Pass criteria |
|---|----------|---------------|
| C1 | Two tabs join same room as different users | Both tiles render, both audio works, no duplicate "you joined" toasts |
| C2 | Join room, leave, rejoin in same tab | Clean teardown; no zombie tiles; no duplicate producers server-side |
| C3 | Refresh while in call | Reconnects, re-publishes, sees all remote tiles |
| C4 | Tab background → foreground (`visibilitychange`) | No reconnect storm; visible + open triggers soft resync only |
| C5 | Focus another window while socket is alive | Socket NOT reconnected just because focus returned |
| C6 | Lose network (DevTools Offline → Online) | Reconnects via backoff; recovers media |
| C7 | 8–12 cameras visible | Grid stable; no remount on label change; CPU acceptable |
| C8 | Camera off → on → off | Track replaces, no remount; remote sees correct state |
| C9 | Screen share start | Other peers see screen; no flicker on local camera tile |
| C10 | Screen share stop (button) | Camera restored (or null per existing semantics); no zombie producer |
| C11 | Screen share stop (browser "Stop sharing") | Same as C10; `ended` cleanup runs |
| C12 | Screen share: stop → restart 3+ times | No leaked producers; no serialization race |
| C13 | Camera off → screen share → stop share | Lands in camera-off state, not accidentally camera-on |
| C14 | Mic mute / unmute | Audio cuts cleanly; remote VU reacts |
| C15 | Device switch (camera / mic in browser settings) | `replaceTrack` path used; no remount |
| C16 | OBS / browser source as viewer | Receive-only; no controls; no error from missing send transport |
| C17 | Mafia viewer mode | UI hidden; server still authoritative on host state |
| C18 | Host / player / viewer roles | Each sees correct controls; server enforces |

## 2. WebSocket reconnect (any WS change)

| # | Scenario | Pass criteria |
|---|----------|---------------|
| W1 | Disconnect server WS briefly (kill + restart server) | Client reconnects; rejoins; resumes game state |
| W2 | Send a malformed message | Server rejects (Zod / parser) without crashing the room |
| W3 | Idle for 30+ seconds | JSON ping keeps socket alive (Cloudflare / Nginx 25s assumption) |
| W4 | Switch streamer route mid-flight | Stale socket callbacks ignored; new socket connects to new room |
| W5 | Rapid join / leave (5x in 10s) | No leaked sockets, no duplicate timers |

## 3. Game-specific

### Mafia

- [ ] Host lock survives refresh of host's tab.
- [ ] **Host transfer**: hand-off from host A to host B succeeds; old host loses controls atomically; new host gets controls atomically; no two hosts at any moment.
- [ ] Host transfer survives a refresh of either tab during the transition.
- [ ] Force-mute / force-camera state matches server.
- [ ] OBS viewer renders Mafia overlay correctly.
- [ ] Role state visible only to entitled clients.
- [ ] Twitch chat ingest (if any Mafia commands exist): commands from chat reach the host UI; commands during reconnect do not duplicate.

### Eat First — mode matrix

Run each mode in its own tab; verify mode does not bleed into another:

- [ ] **Join mode**: public viewer can join a slot; server validates slot availability; client cannot forge slot.
- [ ] **Control mode**: player controls (hand / ready / claim / vote) reach the server; server is authoritative on slot ownership.
- [ ] **Admin mode**: staff-only controls visible only to staff; non-staff viewing `?mode=admin` gets no privileged actions; server enforces.
- [ ] **Overlay mode**: OBS overlay timer and state match the main app; overlay does not own media lifecycle; refresh of overlay does not desync.
- [ ] Snapshot fetched on join; live updates merge cleanly.
- [ ] Player order swap maintains stable identity.
- [ ] Multiple tabs of the same player reflect same authoritative state.
- [ ] Twitch chat ingest into Eat First (if wired): chat events land in the correct streamer's table; do not cross streamers.

### Nadle

- [ ] **Web guess** flow: streamer page → submit guess → server records → leaderboard updates → broadcast to viewers.
- [ ] **Twitch chat guess** flow: chat message → server ingest → guess parsed → same code path as web guess → no duplication, no double-credit.
- [ ] Leaderboard increments once per win (no duplicate on rapid reconnect).
- [ ] Streamer route survives Twitch username case differences (e.g. `Streamer` vs `streamer`).
- [ ] Twitch chat per-user throttle holds under bursts.

### Nadraw Show

- [ ] Host start / clear / ack / draw all reach viewers.
- [ ] Viewer cannot reveal the prompt (prompt server-gated; not in viewer payloads).
- [ ] **Twitch chat sync**: chat reactions / answers reach the host UI; chat during reconnect does not duplicate-broadcast.
- [ ] Streamer context resolves correctly across casing differences.

### Checkers

- [ ] Bot / friend / local modes all start.
- [ ] Rematch works without leaking timers.
- [ ] Matchmaking timeout cleans up.
- [ ] ELO / leaderboard write happens once per finished match.
- [ ] Optional call voice (when wired): toggling on/off does not affect Checkers game state; call-core remains the only media stack.

## 4. Auth / admin

- [ ] Login / logout via OAuth.
- [ ] Admin route guard blocks non-admins.
- [ ] Eat First staff guard blocks non-staff.
- [ ] Refresh on a protected route does not flash unauthorized content.
- [ ] **Email verification happy path**: sign-up → verification email sent → link → account marked verified → admin elevation (if applicable) only after verification.
- [ ] Email verification: unverified accounts cannot reach admin-only surfaces.
- [ ] **Beta-access flow** (if change touches `BetaAccessPage.vue` / related guard): non-beta users blocked at the guard; beta users pass; status survives refresh.
- [ ] Admin role resolution traces to a server-resolved role (`resolveUserRole`), not a client-claimed flag.

## 5. Coin Hub / economy

- [ ] **Claim**: daily / one-shot claim → server records once → client UI updates → rapid double-click does not double-credit.
- [ ] **Spin**: spin action → server determines outcome → outcome is server-authoritative; client cannot reroll by replaying the request.
- [ ] **Open case**: case-open action → server picks reward → reward credited once; refresh mid-animation does not re-credit.
- [ ] One win = one leaderboard entry. No duplicate on reconnect.
- [ ] One claim = one coin transaction.
- [ ] Rapid double-click on submit does not produce two writes.
- [ ] Client cannot forge `streamerId`, `result`, or `score` on the wire.

## 5a. Billing (only if the diff touches `apps/server/src/billing/*` or `BillingPage.vue`)

- [ ] **Happy path**: purchase initiation → external provider → webhook arrives → server verifies webhook signature → idempotency key respected → user credited once.
- [ ] Duplicate webhook delivery (replay) is rejected by idempotency.
- [ ] Failed payment does not credit user.
- [ ] No secrets / tokens / signed payloads logged.
- [ ] Webhook handler is the only path that credits; no client-driven credit endpoint.

## 6. Accessibility & motion

- [ ] **`prefers-reduced-motion`** honored: large animations / camera transitions / landing effects reduce or disable when the OS setting is on.
- [ ] Interactive overlays (Mafia, Eat First, Nadraw) reachable via keyboard for primary actions; focus state visible.
- [ ] Hit targets on overlay controls meet ~44×44 px on touch where applicable.
- [ ] Text contrast on overlay surfaces clears WCAG AA against the underlying video.
- [ ] Screen-reader: critical state changes (host transferred, game ended, claim succeeded) reach an `aria-live` region or equivalent if the surface advertises a11y.

## 7. Build / lint / tests (commands to run for the affected surface)

```text
npm run test:ci         # pure consistency tests across packages
npm run test:client     # client / shared pure logic
npm run test:call       # call-core consistency
npm run test:nadle      # Nadle
npm run test:eat-first  # Eat First
npm run lint            # broad client / server changes
npm run build -w client # client integration changes
npm run ci              # everything (tests + lint + client build)
```

Report which you ran. If you skipped any, say why.
