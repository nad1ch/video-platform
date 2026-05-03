import type { IncomingMessage } from 'node:http'
import type { WebSocket } from 'ws'
import type { WebSocketServer } from 'ws'
import { readSessionFromCookie } from '../auth/session/sessionJwt'
import { attachWsHeartbeat } from '../utils/wsHeartbeat'
import { safeSendJson as safeSend } from '../utils/wsSafeSend'
import {
  parseOptionalPeerIdFromUpgrade,
  parseStreamerIdFromUpgrade,
} from '../utils/wsUpgradeQuery'
import { canUserControlNadrawRoom } from './nadrawAccess'
import {
  getNadrawRoomSnapshot,
  getNadrawStatePayload,
  hostAckNextRound,
  hostClearNadrawRound,
  hostStartNadrawRound,
  restoreNadrawRoomSnapshot,
  setNadrawCanvasClearListener,
  setNadrawFeedbackListener,
  setNadrawStateListener,
} from './nadrawGameStore'
import { NadrawWs } from './wsProtocol'
import {
  loadNadrawLiveRoom,
  persistNadrawLiveRoom,
  type PersistedNadrawChatEvent,
  type PersistedNadrawDraw,
} from './nadrawLiveRoomPersistence'

const clientsByStreamer = new Map<string, Set<WebSocket>>()
const clientMeta = new Map<WebSocket, { streamerId: string; isStreamer: boolean }>()
const drawHistoryByStreamer = new Map<string, PersistedNadrawDraw[]>()
const chatHistoryByStreamer = new Map<string, PersistedNadrawChatEvent[]>()
const hydratedStreamers = new Set<string>()
const hydrationByStreamer = new Map<string, Promise<void>>()

const NADRAW_JSON_PING_MS = 25_000
const NADRAW_DRAW_HISTORY_LIMIT = 1200
const NADRAW_CHAT_HISTORY_LIMIT = 200
let nadrawJsonPingTimer: ReturnType<typeof setInterval> | null = null

function pingAllNadrawClients(): void {
  for (const set of clientsByStreamer.values()) {
    for (const ws of set) {
      safeSend(ws, { type: NadrawWs.ping })
    }
  }
}

function ensureNadrawJsonPingTimer(wss: WebSocketServer): void {
  if (nadrawJsonPingTimer !== null) {
    return
  }
  nadrawJsonPingTimer = setInterval(pingAllNadrawClients, NADRAW_JSON_PING_MS)
  if (typeof nadrawJsonPingTimer.unref === 'function') {
    nadrawJsonPingTimer.unref()
  }
  wss.on('close', () => {
    if (nadrawJsonPingTimer !== null) {
      clearInterval(nadrawJsonPingTimer)
      nadrawJsonPingTimer = null
    }
  })
}

function persistNadrawSnapshot(streamerId: string): void {
  persistNadrawLiveRoom(streamerId, {
    room: getNadrawRoomSnapshot(streamerId),
    drawOps: drawHistoryByStreamer.get(streamerId) ?? [],
    chatEvents: chatHistoryByStreamer.get(streamerId) ?? [],
  })
}

async function hydrateNadrawLiveRoom(streamerId: string): Promise<void> {
  if (hydratedStreamers.has(streamerId)) {
    return
  }
  const existing = hydrationByStreamer.get(streamerId)
  if (existing) {
    await existing
    return
  }
  const pending = (async () => {
    const snapshot = await loadNadrawLiveRoom(streamerId)
    if (snapshot) {
      restoreNadrawRoomSnapshot(streamerId, snapshot.room)
      drawHistoryByStreamer.set(streamerId, snapshot.drawOps.slice(-NADRAW_DRAW_HISTORY_LIMIT))
      chatHistoryByStreamer.set(streamerId, snapshot.chatEvents.slice(-NADRAW_CHAT_HISTORY_LIMIT))
    }
    hydratedStreamers.add(streamerId)
  })().finally(() => {
    hydrationByStreamer.delete(streamerId)
  })
  hydrationByStreamer.set(streamerId, pending)
  await pending
}

function pushDrawHistory(streamerId: string, payload: PersistedNadrawDraw): void {
  drawHistoryByStreamer.set(streamerId, [...(drawHistoryByStreamer.get(streamerId) ?? []), payload].slice(-NADRAW_DRAW_HISTORY_LIMIT))
  persistNadrawSnapshot(streamerId)
}

function clearDrawHistory(streamerId: string): void {
  drawHistoryByStreamer.set(streamerId, [])
  persistNadrawSnapshot(streamerId)
}

function pushChatHistory(streamerId: string, payload: PersistedNadrawChatEvent): void {
  chatHistoryByStreamer.set(
    streamerId,
    [...(chatHistoryByStreamer.get(streamerId) ?? []), payload].slice(-NADRAW_CHAT_HISTORY_LIMIT),
  )
  persistNadrawSnapshot(streamerId)
}

function sendNadrawHistory(ws: WebSocket, streamerId: string): void {
  safeSend(ws, {
    type: NadrawWs.history,
    payload: {
      drawOps: drawHistoryByStreamer.get(streamerId) ?? [],
      chatEvents: chatHistoryByStreamer.get(streamerId) ?? [],
    },
  })
}

function clientSet(streamerId: string): Set<WebSocket> {
  let set = clientsByStreamer.get(streamerId)
  if (!set) {
    set = new Set()
    clientsByStreamer.set(streamerId, set)
  }
  return set
}

function registerClient(streamerId: string, ws: WebSocket, isStreamer: boolean): void {
  clientSet(streamerId).add(ws)
  clientMeta.set(ws, { streamerId, isStreamer })
}

function unregisterClient(ws: WebSocket): { streamerId: string; isStreamer: boolean; hasStreamerClients: boolean } | null {
  const meta = clientMeta.get(ws)
  clientMeta.delete(ws)
  if (!meta) {
    return null
  }
  const set = clientsByStreamer.get(meta.streamerId)
  if (!set) {
    return { ...meta, hasStreamerClients: false }
  }
  set.delete(ws)
  let hasStreamerClients = false
  for (const client of set) {
    if (clientMeta.get(client)?.isStreamer === true) {
      hasStreamerClients = true
      break
    }
  }
  if (set.size === 0) {
    clientsByStreamer.delete(meta.streamerId)
  }
  return { ...meta, hasStreamerClients }
}

/**
 * Grace period before auto-clearing the active round when the last streamer
 * tab disconnects. A fast refresh / network blip previously wiped the round
 * for every viewer within milliseconds; now a reconnecting streamer within
 * `STREAMER_DISCONNECT_GRACE_MS` keeps the round alive seamlessly.
 */
const STREAMER_DISCONNECT_GRACE_MS = 10_000
const pendingStreamerClearTimers = new Map<string, ReturnType<typeof setTimeout>>()

function cancelPendingStreamerClear(streamerId: string): void {
  const t = pendingStreamerClearTimers.get(streamerId)
  if (t) {
    clearTimeout(t)
    pendingStreamerClearTimers.delete(streamerId)
  }
}

function hasActiveStreamerClient(streamerId: string): boolean {
  const set = clientsByStreamer.get(streamerId)
  if (!set) return false
  for (const client of set) {
    if (clientMeta.get(client)?.isStreamer === true) {
      return true
    }
  }
  return false
}

function cleanupAfterClientDisconnect(ws: WebSocket): void {
  const meta = unregisterClient(ws)
  if (meta?.isStreamer === true && !meta.hasStreamerClients) {
    const streamerId = meta.streamerId
    cancelPendingStreamerClear(streamerId)
    const timer = setTimeout(() => {
      pendingStreamerClearTimers.delete(streamerId)
      // Re-check on fire: if a streamer tab came back during the grace
      // window, keep the round alive. This covers fast refresh, tab
      // restore, brief network blips.
      if (hasActiveStreamerClient(streamerId)) {
        return
      }
      hostClearNadrawRound(streamerId)
      broadcastNadrawCanvasClear(streamerId)
    }, STREAMER_DISCONNECT_GRACE_MS)
    if (typeof timer.unref === 'function') {
      timer.unref()
    }
    pendingStreamerClearTimers.set(streamerId, timer)
  }
}

/* safeSend is now `safeSendJson` from `../utils/wsSafeSend` (imported above). */

export function broadcastNadrawState(streamerId: string): void {
  const set = clientsByStreamer.get(streamerId)
  if (!set) {
    return
  }
  for (const ws of set) {
    const meta = clientMeta.get(ws)
    const includeSecret = meta?.isStreamer === true
    safeSend(ws, {
      type: NadrawWs.state,
      payload: getNadrawStatePayload(streamerId, includeSecret),
    })
  }
}

export function broadcastNadrawCanvasClear(streamerId: string): void {
  clearDrawHistory(streamerId)
  const set = clientsByStreamer.get(streamerId)
  if (!set) {
    return
  }
  const msg = JSON.stringify({ type: NadrawWs.canvasClear })
  for (const ws of set) {
    if (ws.readyState === 1) {
      try {
        ws.send(msg)
      } catch {
        /* ignore */
      }
    }
  }
}

setNadrawCanvasClearListener((streamerId) => {
  broadcastNadrawCanvasClear(streamerId)
})

export function broadcastNadrawDraw(
  streamerId: string,
  payload: {
    phase: 'start' | 'move' | 'end'
    strokeId: string
    x: number
    y: number
    color?: string
    lineWidth?: number
    erase?: boolean
    op?: 'stroke' | 'fill' | 'rect' | 'ellipse'
    x2?: number
    y2?: number
  },
): void {
  pushDrawHistory(streamerId, payload)
  const set = clientsByStreamer.get(streamerId)
  if (!set) {
    return
  }
  const raw = JSON.stringify({ type: NadrawWs.draw, payload })
  for (const ws of set) {
    if (ws.readyState === 1) {
      try {
        ws.send(raw)
      } catch {
        /* ignore */
      }
    }
  }
}

export function broadcastNadrawTwitchChat(
  streamerId: string,
  payload: { userId: string; displayName: string; text: string },
): void {
  pushChatHistory(streamerId, { kind: 'chat', ...payload })
  const set = clientsByStreamer.get(streamerId)
  if (!set) {
    return
  }
  const raw = JSON.stringify({ type: NadrawWs.twitchChat, payload })
  for (const ws of set) {
    if (ws.readyState === 1) {
      try {
        ws.send(raw)
      } catch {
        /* ignore */
      }
    }
  }
}

export function broadcastNadrawGuessFeedback(
  streamerId: string,
  payload: {
    userId: string
    displayName: string
    text: string
    kind: 'rate_limit' | 'guess_locked' | 'heat' | 'win' | 'wrong'
    heat?: 'cold' | 'warm' | 'hot'
  },
): void {
  pushChatHistory(streamerId, {
    kind: 'feedback',
    userId: payload.userId,
    displayName: payload.displayName,
    text: payload.text,
    feedbackKind: payload.kind,
    heat: payload.heat,
  })
  const set = clientsByStreamer.get(streamerId)
  if (!set) {
    return
  }
  const raw = JSON.stringify({ type: NadrawWs.guessFeedback, payload })
  for (const ws of set) {
    if (ws.readyState === 1) {
      try {
        ws.send(raw)
      } catch {
        /* ignore */
      }
    }
  }
}

setNadrawStateListener((streamerId) => {
  persistNadrawSnapshot(streamerId)
  broadcastNadrawState(streamerId)
})

setNadrawFeedbackListener((streamerId, payload) => {
  broadcastNadrawGuessFeedback(streamerId, payload)
})

/* parseStreamerId / parseOptionalPeerId are now shared helpers in
 * `../utils/wsUpgradeQuery` (identical byte-for-byte behavior). */

type HostStartMsg = {
  type: typeof NadrawWs.hostStartRound
  wordSource: 'random' | 'db' | 'manual'
  manualWord?: string
  roundDurationSec?: number
  roundsPlanned?: number
}

type HostAckNextMsg = {
  type: typeof NadrawWs.hostAckNextRound
  word?: string
}

type HostDrawMsg = {
  type: typeof NadrawWs.hostDraw
  phase: 'start' | 'move' | 'end'
  strokeId: string
  x: number
  y: number
  color?: string
  lineWidth?: number
  erase?: boolean
  op?: 'stroke' | 'fill' | 'rect' | 'ellipse'
  x2?: number
  y2?: number
}

function parseClientMsg(
  raw: string,
):
  | HostStartMsg
  | HostAckNextMsg
  | { type: typeof NadrawWs.hostClearRound }
  | { type: typeof NadrawWs.hostClearCanvas }
  | HostDrawMsg
  | null {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (!data || typeof data !== 'object') {
    return null
  }
  const o = data as {
    type?: string
    wordSource?: string
    manualWord?: unknown
    roundDurationSec?: unknown
    roundsPlanned?: unknown
    phase?: string
    strokeId?: unknown
  }
  if (o.type === NadrawWs.hostClearRound) {
    return { type: NadrawWs.hostClearRound }
  }
  if (o.type === NadrawWs.hostClearCanvas) {
    return { type: NadrawWs.hostClearCanvas }
  }
  if (o.type === NadrawWs.hostAckNextRound) {
    const w = (o as { word?: unknown }).word
    return {
      type: NadrawWs.hostAckNextRound,
      word: typeof w === 'string' ? w : undefined,
    }
  }
  if (o.type === NadrawWs.hostStartRound) {
    const ws = o.wordSource
    if (ws !== 'random' && ws !== 'db' && ws !== 'manual') {
      return null
    }
    const rd = Number(o.roundDurationSec)
    const rp = Number(o.roundsPlanned)
    return {
      type: NadrawWs.hostStartRound,
      wordSource: ws,
      manualWord: typeof o.manualWord === 'string' ? o.manualWord : undefined,
      roundDurationSec: Number.isFinite(rd) ? rd : undefined,
      roundsPlanned: Number.isFinite(rp) ? rp : undefined,
    }
  }
  if (o.type === NadrawWs.hostDraw) {
    // Strict caps: everything is broadcast to every viewer of this streamer,
    // so a rogue host with a modified client could otherwise push massive
    // stroke payloads. Canvases in the UI stay well below 8 k on each axis;
    // line widths in the palette never exceed 64. Reasonable tight caps.
    const MAX_COORD = 8192
    const MAX_LINE_WIDTH = 256
    const MAX_STROKE_ID_LEN = 128
    const MAX_COLOR_LEN = 32
    const phase = o.phase
    if (phase !== 'start' && phase !== 'move' && phase !== 'end') {
      return null
    }
    if (
      typeof o.strokeId !== 'string' ||
      o.strokeId.length < 4 ||
      o.strokeId.length > MAX_STROKE_ID_LEN
    ) {
      return null
    }
    const x = Number((o as { x?: unknown }).x)
    const y = Number((o as { y?: unknown }).y)
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null
    }
    if (Math.abs(x) > MAX_COORD || Math.abs(y) > MAX_COORD) {
      return null
    }
    const colorRaw = (o as { color?: unknown }).color
    const color =
      typeof colorRaw === 'string' && colorRaw.length <= MAX_COLOR_LEN ? colorRaw : undefined
    const lineWidthRaw = (o as { lineWidth?: unknown }).lineWidth
    const lineWidth =
      typeof lineWidthRaw === 'number' &&
      Number.isFinite(lineWidthRaw) &&
      lineWidthRaw > 0 &&
      lineWidthRaw <= MAX_LINE_WIDTH
        ? lineWidthRaw
        : undefined
    const erase = (o as { erase?: unknown }).erase === true
    const opRaw = (o as { op?: unknown }).op
    const op =
      opRaw === 'fill' || opRaw === 'rect' || opRaw === 'ellipse' || opRaw === 'stroke'
        ? opRaw
        : undefined
    const x2n = Number((o as { x2?: unknown }).x2)
    const y2n = Number((o as { y2?: unknown }).y2)
    const x2 = Number.isFinite(x2n) && Math.abs(x2n) <= MAX_COORD ? x2n : undefined
    const y2 = Number.isFinite(y2n) && Math.abs(y2n) <= MAX_COORD ? y2n : undefined
    return {
      type: NadrawWs.hostDraw,
      phase,
      strokeId: o.strokeId,
      x,
      y,
      color,
      lineWidth,
      erase,
      op,
      x2,
      y2,
    }
  }
  return null
}

export function attachNadrawShowSocketServer(wss: WebSocketServer): void {
  ensureNadrawJsonPingTimer(wss)
  attachWsHeartbeat(wss, { logLabel: 'nadraw-show-ws' })

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const streamerId = parseStreamerIdFromUpgrade(req)
    if (!streamerId) {
      safeSend(ws, {
        type: NadrawWs.error,
        payload: { code: 'bad_request', message: 'Missing streamerId (use /nadraw-show-ws?streamerId=…)' },
      })
      ws.close(4400, 'missing streamerId')
      return
    }

    const tabPeerId = parseOptionalPeerIdFromUpgrade(req)
    if (process.env.NODE_ENV !== 'production' && tabPeerId) {
      console.log('[nadraw-show-ws] client tab', { streamerId, peerId: tabPeerId.slice(0, 12) })
    }

    // IMPORTANT: attach lifecycle listeners synchronously BEFORE the hydration
    // IIFE awaits. Otherwise, a client that disconnects during hydration would
    // fire `'close'` / `'error'` before any listener exists; the `ws` library
    // never re-emits past events, so `clientMeta` / `clientsByStreamer` would
    // leak forever and broadcasts would still iterate the dead socket.
    ws.on('error', () => {
      cleanupAfterClientDisconnect(ws)
    })

    ws.on('close', () => {
      cleanupAfterClientDisconnect(ws)
    })

    ws.on('message', (buf) => {
      void (async () => {
        try {
          const raw = buf.toString()
          let parsed: unknown
          try {
            parsed = JSON.parse(raw)
          } catch {
            return
          }
          if (parsed && typeof parsed === 'object' && (parsed as { type?: unknown }).type === 'pong') {
            return
          }

          const msg = parseClientMsg(raw)
          if (!msg) {
            return
          }

          // Messages that arrive before `registerClient` has run (still hydrating)
          // have no meta yet — drop them. Same check as before the move; the
          // client retries via subsequent user actions after receiving `state`.
          const meta = clientMeta.get(ws)
          if (!meta || meta.streamerId !== streamerId) {
            return
          }

          if (msg.type === NadrawWs.hostDraw) {
            if (!meta.isStreamer) {
              safeSend(ws, { type: NadrawWs.error, payload: { code: 'forbidden', message: 'Drawing is streamer-only.' } })
              return
            }
            const st = getNadrawStatePayload(streamerId, true)
            if (st.phase !== 'drawing_locked' && st.phase !== 'drawing_active') {
              return
            }
            broadcastNadrawDraw(streamerId, {
              phase: msg.phase,
              strokeId: msg.strokeId,
              x: msg.x,
              y: msg.y,
              color: msg.color,
              lineWidth: msg.lineWidth,
              erase: msg.erase,
              op: msg.op,
              x2: msg.x2,
              y2: msg.y2,
            })
            return
          }

          if (!meta.isStreamer) {
            safeSend(ws, { type: NadrawWs.error, payload: { code: 'forbidden', message: 'Host actions only.' } })
            return
          }

          if (msg.type === NadrawWs.hostClearCanvas) {
            broadcastNadrawCanvasClear(streamerId)
            return
          }

          if (msg.type === NadrawWs.hostClearRound) {
            hostClearNadrawRound(streamerId)
            broadcastNadrawCanvasClear(streamerId)
            return
          }

          if (msg.type === NadrawWs.hostStartRound) {
            const result = await hostStartNadrawRound(streamerId, {
              wordSource: msg.wordSource,
              manualWord: msg.manualWord,
              roundDurationSec: msg.roundDurationSec,
              roundsPlanned: msg.roundsPlanned,
            })
            if (!result.ok) {
              safeSend(ws, {
                type: NadrawWs.error,
                payload: { code: result.code, message: result.message },
              })
              return
            }
            broadcastNadrawCanvasClear(streamerId)
            return
          }

          if (msg.type === NadrawWs.hostAckNextRound) {
            const result = await hostAckNextRound(streamerId, { word: msg.word })
            if (!result.ok) {
              safeSend(ws, {
                type: NadrawWs.error,
                payload: { code: result.code, message: result.message },
              })
              return
            }
            broadcastNadrawCanvasClear(streamerId)
          }
        } catch (e) {
          console.error('[nadraw-show-ws] message handler error', e)
          safeSend(ws, {
            type: NadrawWs.error,
            payload: { code: 'internal_error', message: 'Server error.' },
          })
        }
      })()
    })

    void (async () => {
      await hydrateNadrawLiveRoom(streamerId)

      // If the socket already closed during hydration, the `'close'` handler
      // above already ran `cleanupAfterClientDisconnect` (no-op because meta
      // was never registered). Avoid registering a now-dead socket.
      if (ws.readyState !== 1) {
        return
      }

      const session = readSessionFromCookie(req.headers.cookie)
      const isStreamer = session != null && (await canUserControlNadrawRoom(session, streamerId))

      // A new streamer tab arrived during the post-disconnect grace window —
      // cancel the pending round-clear so the host can resume seamlessly.
      if (isStreamer) {
        cancelPendingStreamerClear(streamerId)
      }

      registerClient(streamerId, ws, isStreamer)

      safeSend(ws, {
        type: NadrawWs.session,
        payload: { canControl: isStreamer },
      })
      safeSend(ws, {
        type: NadrawWs.state,
        payload: getNadrawStatePayload(streamerId, isStreamer),
      })
      sendNadrawHistory(ws, streamerId)
    })()
  })
}
