import type { IncomingMessage } from 'node:http'
import type { WebSocket } from 'ws'
import type { WebSocketServer } from 'ws'
import { readSessionFromCookie } from '../auth/session/sessionJwt'
import { canUserControlNadrawRoom } from './nadrawAccess'
import {
  getNadrawStatePayload,
  hostAckNextRound,
  hostClearNadrawRound,
  hostStartNadrawRound,
  setNadrawCanvasClearListener,
  setNadrawFeedbackListener,
  setNadrawStateListener,
} from './nadrawGameStore'
import { NadrawWs } from './wsProtocol'

const clientsByStreamer = new Map<string, Set<WebSocket>>()
const clientMeta = new Map<WebSocket, { streamerId: string; isStreamer: boolean }>()

const NADRAW_JSON_PING_MS = 25_000
let nadrawJsonPingTimer: ReturnType<typeof setInterval> | null = null

function pingAllNadrawClients(): void {
  for (const set of clientsByStreamer.values()) {
    for (const ws of set) {
      safeSend(ws, { type: NadrawWs.ping })
    }
  }
}

function ensureNadrawJsonPingTimer(): void {
  if (nadrawJsonPingTimer !== null) {
    return
  }
  nadrawJsonPingTimer = setInterval(pingAllNadrawClients, NADRAW_JSON_PING_MS)
  if (typeof nadrawJsonPingTimer.unref === 'function') {
    nadrawJsonPingTimer.unref()
  }
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

function unregisterClient(ws: WebSocket): void {
  const meta = clientMeta.get(ws)
  clientMeta.delete(ws)
  if (!meta) {
    return
  }
  const set = clientsByStreamer.get(meta.streamerId)
  if (!set) {
    return
  }
  set.delete(ws)
  if (set.size === 0) {
    clientsByStreamer.delete(meta.streamerId)
  }
}

function safeSend(ws: WebSocket, obj: unknown): void {
  if (ws.readyState !== 1) {
    return
  }
  try {
    ws.send(JSON.stringify(obj))
  } catch {
    /* ignore */
  }
}

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
  broadcastNadrawState(streamerId)
})

setNadrawFeedbackListener((streamerId, payload) => {
  broadcastNadrawGuessFeedback(streamerId, payload)
})

function parseStreamerId(req: IncomingMessage): string | null {
  try {
    const host = req.headers.host ?? 'localhost'
    const u = new URL(req.url ?? '/', `http://${host}`)
    const id = u.searchParams.get('streamerId')
    if (typeof id !== 'string' || id.trim().length < 4) {
      return null
    }
    return id.trim()
  } catch {
    return null
  }
}

function parseOptionalPeerId(req: IncomingMessage): string | null {
  try {
    const host = req.headers.host ?? 'localhost'
    const u = new URL(req.url ?? '/', `http://${host}`)
    const raw = u.searchParams.get('peerId')
    if (typeof raw !== 'string') {
      return null
    }
    const t = raw.trim()
    if (t.length < 4 || t.length > 200) {
      return null
    }
    return t
  } catch {
    return null
  }
}

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
    const phase = o.phase
    if (phase !== 'start' && phase !== 'move' && phase !== 'end') {
      return null
    }
    if (typeof o.strokeId !== 'string' || o.strokeId.length < 4) {
      return null
    }
    const x = Number((o as { x?: unknown }).x)
    const y = Number((o as { y?: unknown }).y)
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null
    }
    const color = (o as { color?: unknown }).color
    const lineWidth = (o as { lineWidth?: unknown }).lineWidth
    const erase = (o as { erase?: unknown }).erase === true
    const opRaw = (o as { op?: unknown }).op
    const op =
      opRaw === 'fill' || opRaw === 'rect' || opRaw === 'ellipse' || opRaw === 'stroke'
        ? opRaw
        : undefined
    const x2n = Number((o as { x2?: unknown }).x2)
    const y2n = Number((o as { y2?: unknown }).y2)
    return {
      type: NadrawWs.hostDraw,
      phase,
      strokeId: o.strokeId,
      x,
      y,
      color: typeof color === 'string' ? color : undefined,
      lineWidth: typeof lineWidth === 'number' && Number.isFinite(lineWidth) ? lineWidth : undefined,
      erase,
      op,
      x2: Number.isFinite(x2n) ? x2n : undefined,
      y2: Number.isFinite(y2n) ? y2n : undefined,
    }
  }
  return null
}

export function attachNadrawShowSocketServer(wss: WebSocketServer): void {
  ensureNadrawJsonPingTimer()

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const streamerId = parseStreamerId(req)
    if (!streamerId) {
      safeSend(ws, {
        type: NadrawWs.error,
        payload: { code: 'bad_request', message: 'Missing streamerId (use /nadraw-show-ws?streamerId=…)' },
      })
      ws.close(4400, 'missing streamerId')
      return
    }

    const tabPeerId = parseOptionalPeerId(req)
    if (process.env.NODE_ENV !== 'production' && tabPeerId) {
      console.log('[nadraw-show-ws] client tab', { streamerId, peerId: tabPeerId.slice(0, 12) })
    }

    void (async () => {
      const session = readSessionFromCookie(req.headers.cookie)
      const isStreamer = session != null && (await canUserControlNadrawRoom(session, streamerId))

      registerClient(streamerId, ws, isStreamer)

      safeSend(ws, {
        type: NadrawWs.session,
        payload: { canControl: isStreamer },
      })
      safeSend(ws, {
        type: NadrawWs.state,
        payload: getNadrawStatePayload(streamerId, isStreamer),
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

      ws.on('error', () => {
        unregisterClient(ws)
      })

      ws.on('close', () => {
        unregisterClient(ws)
      })
    })()
  })
}
