# mediasoup + Docker (video call networking)

This folder documents **network / ICE / UDP** for the WebRTC stack. UI and `call-core` are not the first place to fix black remote video when transports show `failed`.

**Code paths:** mediasoup transport is created in `apps/server/src/mediasoup/createWebRtcTransport.ts`; ICE extras for the browser are merged in `apps/server/src/signaling/messageHandlers.ts` via `apps/server/src/config/clientIceServers.ts`.

## Recommended dev (Windows / WebRTC): Postgres in Docker, API + Vite on the host

Docker Desktop + UDP + ICE on Windows is awkward for day-to-day work. A common setup is: **only `db` in Docker**; run **`apps/server`** and **`apps/client`** locally so mediasoup binds on the host like production-like paths without container NAT.

1. One-time: `cp docker/docker-compose.local.example.yml docker/docker-compose.local.yml` (if you do not already have `docker/docker-compose.local.yml`).
2. One-time: `cp apps/server/.env.local.example apps/server/.env.local` — **`DATABASE_URL`** must use **`localhost:5432`** (Postgres published from the `db` service).
3. First-time schema: `npm run db:migrate:dev` (from repo root; needs Postgres up).
4. From repo root: **`npm run dev:all`** — starts **`db`**, waits for **`127.0.0.1:5432`**, then runs **`npm run dev -w server`** and **`npm run dev -w client`** together.

If Postgres is already running, you can use **`npm run dev:local`** (server + client only) or **`npm run docker:db:up`** to start just the database.

Use **`docker compose -f docker/docker-compose.local.yml up -d db`** directly if you prefer; it is the same service the scripts target.

## Quick start (repo root)

**API + mediasoup only (default UDP 40000–49999):**

```bash
cp docker/.env.example docker/.env
# optional: set ICE_SERVERS_JSON in docker/.env when using --profile turn
docker compose -f docker/docker-compose.yml up --build
```

**With coturn (TURN relay):** set `ICE_SERVERS_JSON` in `docker/.env` (host-reachable `127.0.0.1:3478` — see below), then:

```bash
docker compose -f docker/docker-compose.yml --profile turn up --build
```

**Windows / unstable UDP (recommended):** copy `docker-compose.local.example.yml` → `docker-compose.local.yml`, `Dockerfile.local.example` → `Dockerfile.local`, `docker/.env.example` → `docker/.env`, then:

```bash
docker compose -f docker/docker-compose.local.yml --profile turn up --build -d
docker compose -f docker/docker-compose.local.yml exec server npx prisma migrate deploy
```

Or: `npm run docker:local:up` (same compose + turn profile). First-time DB: run `migrate deploy` as above.

If `docker compose up` fails with **`bind: An attempt was made to access a socket in a way forbidden by its access permissions`** on UDP, Windows has likely **excluded** part of the range you mapped (often **49xxx** is crowded). Use **`docker-compose.local.yml`** with **55000–55100** for mediasoup, or [adjust exclusions](https://learn.microsoft.com/en-us/troubleshoot/developer/visualstudio/ide/port-blocked-by-windows) — this is an OS constraint, not the app.

### Docker: WebSocket works, consumers exist, but no remote video (RTP)

That pattern is usually **ICE / announced address**, not UI or mediasoup app logic. HTTP can work on `localhost` while **SRTP** needs candidates the peer can actually reach.

- **`MEDIASOUP_ANNOUNCED_ADDRESS=127.0.0.1`** is only reliable when the SPA and both peers behave like a single loopback path. With **Docker NAT**, **another tab**, **incognito**, or **another browser**, peers may not share the same `127.0.0.1` semantics → **ICE can look partly “up” while RTP does not arrive**.
- **Fix:** in **`docker/.env`** (loaded by `env_file: .env` in `docker-compose.local.yml`), set your **host LAN IP** (same machine that runs Docker Desktop), then restart compose:

  ```env
  MEDIASOUP_ANNOUNCED_ADDRESS=192.168.x.x
  WORDLE_CLIENT_ORIGIN=http://192.168.x.x:5173
  ```

  Open the app at **`http://192.168.x.x:5173`**, not `localhost`, so the browser, signaling, and ICE line up. Optional: **`VITE_SIGNALING_URL=ws://192.168.x.x:3000`** in `apps/client/.env.local` for the same host.

- Compose uses **`${MEDIASOUP_ANNOUNCED_ADDRESS:-127.0.0.1}`** so you override via `.env` without editing the YAML.

**Frontend (separate terminal):** `npm run dev -w client` — open `http://localhost:5173` (or your LAN URL if you set `MEDIASOUP_ANNOUNCED_ADDRESS` as above). Ensure signaling matches (`VITE_SIGNALING_URL` or dev default `ws://localhost:3000`).

## Validate in the browser

1. Open `chrome://webrtc-internals` during a call.
2. Confirm **ICE connection state** moves to **connected** (not stuck **failed**).
3. Check **candidate pair** / **bytes received** on inbound video.

## Why ICE fails in Docker (especially Windows Desktop)

1. **Signaling (WebSocket)** uses TCP to port 3000 — usually works.
2. **Media (SRTP)** uses **UDP** (and ICE) on `MEDIASOUP_RTC_*` — must be published from the container to the host and allowed by the OS firewall.
3. Docker NAT and large UDP port ranges often **fail or flap** on Docker Desktop + Windows.
4. **Announced address**: mediasoup must advertise an IP the **browser** can reach. Inside `createWebRtcTransport` (`apps/server/src/mediasoup/createWebRtcTransport.ts`), candidates use `MEDIASOUP_ANNOUNCED_ADDRESS` (or dev fallback `127.0.0.1`). If the SPA is opened as `http://192.168.x.x:5173`, set that **LAN IP**, not `127.0.0.1`, and align client signaling URL.

## Files

| File | Role |
|------|------|
| `docker-compose.yml` | Default dev: API `:3000`, UDP `40000-49999`, optional TURN profile |
| `docker-compose.local.example.yml` | Postgres + mediasoup UDP **`55000-55100`** (often safer on Windows than 49xxx) |
| `.env.example` | Copy to `docker/.env` — Twitch + optional mediasoup / `ICE_SERVERS_JSON` |

## Minimal checklist (black remote + `transport failed`)

1. **UDP range** in `ports:` matches `MEDIASOUP_RTC_MIN_PORT` / `MEDIASOUP_RTC_MAX_PORT` (see `apps/server/src/mediasoup/createWorker.ts`).
2. **`MEDIASOUP_ANNOUNCED_ADDRESS`** = address the **browser** uses to reach the host (localhost vs LAN IP).
3. On **Windows**, prefer **`docker-compose.local.example.yml`** (narrow range) if the wide range fails.
4. **TURN** (optional): `docker compose --profile turn up` and set `ICE_SERVERS_JSON` in `docker/.env`.

## TURN / coturn — important: browser vs Docker DNS

ICE servers are passed to **`RTCPeerConnection` in the browser**. The browser must resolve and reach the TURN host.

- **Wrong for a browser on the host:** `turn:coturn:3478` (hostname `coturn` only exists **inside** the compose network).
- **Right for local dev (coturn publishes `3478:3478`):** `turn:127.0.0.1:3478` (or your LAN IP from another device).

Match **username/credential** to coturn’s `--user=` in `docker-compose.yml` (default `webrtc` / `change-me`).

### Relay ports (easy to miss)

Opening **3478** alone is **not** enough. Coturn allocates **relay** RTP on **`--min-port`–`--max-port`** (default in this repo: **49160–49200**). Those UDP ports must be **published** from the coturn service to the host (`49160-49200:49160-49200/udp` in compose). Otherwise: TURN allocation can succeed, auth looks fine, but **relay media never reaches the browser**.

If you change coturn’s relay range in `command:`, change the **`ports:`** mapping to match.

### Relay-only diagnostic (verify TURN path)

The Node server already forwards ICE extras to mediasoup transports (`apps/server/src/signaling/messageHandlers.ts`). To **force relay-only** so the browser cannot fall back to direct/host candidates:

1. Set **`ICE_SERVERS_JSON`** in `docker/.env` (see example below).
2. Add **`ICE_TRANSPORT_POLICY=relay`** to the same `docker/.env` (read by `apps/server/src/config/clientIceServers.ts`).
3. Restart the **server** container (or full stack).

In **`chrome://webrtc-internals`**, confirm the selected pair uses **relay** candidates. Remove `ICE_TRANSPORT_POLICY` when done (restore default `all`).

Example line for `docker/.env` (single line, no spaces — or use JSON escaping carefully):

```env
ICE_SERVERS_JSON=[{"urls":["turn:127.0.0.1:3478?transport=udp","turn:127.0.0.1:3478?transport=tcp"],"username":"webrtc","credential":"change-me"}]
```

Production: use a **public hostname** and real TURN secrets; set `--external-ip` on coturn for NAT.

## Fallbacks

- **Stable local dev:** run `apps/server` **without Docker** (Node on host), mediasoup binds on host — fewer NAT layers.
- **Always TURN:** helps when host UDP is unreliable; adds latency but can unblock relay-only paths — set **`ICE_TRANSPORT_POLICY=relay`** in **`docker/.env`** (server env; see TURN section above and `apps/server/env.example`).

See also: `docs/call-local-docker-troubleshooting.md` (short troubleshooting narrative).

## OAuth (Twitch / Google) with Docker

The **Node server** must have `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET` (and Google if used) **inside the container**.

1. **`cp docker/.env.example docker/.env`** and fill credentials (file is gitignored).
2. Compose uses **`env_file: .env`** next to `docker-compose.local.yml` so variables are injected into `server`.
3. **Redirect URIs** in Twitch/Google consoles must be **`http://localhost:3000/api/auth/.../callback`**, not port 5173.

**Frontend in dev:** `useAuth` uses `apiUrl('/api/auth/twitch')`. With default Vite, **`VITE_API_URL` is unset** → browser opens **`http://localhost:5173/api/...`**, and Vite **proxies `/api` to `http://localhost:3000`** (`vite.config.ts`). So the address bar can show `:5173` while the API is still the Node server — that is expected.

If you set **`VITE_API_URL=http://localhost:3000`**, OAuth redirects go to the API origin directly (also valid).

**Security:** never commit real client secrets. If secrets were pasted into chat or logs, **rotate** them in Twitch/Google developer consoles.
