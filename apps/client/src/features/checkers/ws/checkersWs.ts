import { ref, type Ref } from 'vue'
import { sameOriginApiPrefix } from '@/utils/apiUrl'
import { replyJsonPingIfNeeded } from 'call-core/utils'
import type { CheckersMove, CheckersState } from '../core/types'

export const CheckersWs = {
  join: 'checkers:join',
  move: 'checkers:move',
  restart: 'checkers:restart',
  setMode: 'checkers:set-mode',
  timeout: 'checkers:timeout',
  rematch: 'checkers:rematch',
  state: 'checkers:state',
  update: 'checkers:update',
  error: 'checkers:error',
} as const

export type CheckersWsStatus = 'idle' | 'open' | 'reconnecting' | 'error'
export type CheckersMode = 'friend' | 'bot' | 'local'
export type CheckersRole = 'player1' | 'player2' | 'spectator'
export type CheckersBotDifficulty = 'easy' | 'medium' | 'hard'

export type CheckersStateMessagePayload = {
  roomId: string
  state: CheckersState
  myRole: CheckersRole
  mode: CheckersMode
  rematch?: {
    requestedByMe?: boolean
    requestedByOpponent?: boolean
  }
  lastMove?: Pick<CheckersMove, 'from' | 'to'> | null
}

type CheckersWsClientOptions = {
  onState: (payload: CheckersStateMessagePayload) => void
  onError: (message: string) => void
  getBotDifficulty?: () => CheckersBotDifficulty
}

function randomPeerId(): string {
  try {
    return globalThis.crypto.randomUUID()
  } catch {
    return `checkers-${Date.now()}-${Math.random().toString(16).slice(2)}`
  }
}

export function readCheckersClientId(): string {
  const key = 'checkers:client-id:v1'
  if (typeof localStorage !== 'undefined') {
    const existing = localStorage.getItem(key)
    if (existing) {
      return existing
    }
  }
  const next = randomPeerId()
  try {
    localStorage.setItem(key, next)
  } catch {
    /* ignore */
  }
  return next
}

function buildCheckersWsUrl(peerId: string): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const env = import.meta.env.VITE_CHECKERS_WS_URL as string | undefined
  if (typeof env === 'string' && env.trim().length > 0) {
    const url = new URL(env.trim())
    url.protocol = proto
    url.searchParams.set('peerId', peerId)
    return url.toString()
  }

  const prefix = sameOriginApiPrefix()
  if (prefix.startsWith('http://') || prefix.startsWith('https://')) {
    const url = new URL('/checkers-ws', prefix.endsWith('/') ? prefix : `${prefix}/`)
    url.protocol = proto
    url.searchParams.set('peerId', peerId)
    return url.toString()
  }

  const path = prefix ? `${prefix}/checkers-ws` : '/checkers-ws'
  const query = new URLSearchParams({ peerId }).toString()
  return `${proto}//${window.location.host}${path}?${query}`
}

export function createCheckersWsClient(options: CheckersWsClientOptions): {
  status: Ref<CheckersWsStatus>
  lastServerPingAt: Ref<number | null>
  connect: (roomId: string) => void
  sendMove: (move: Pick<CheckersMove, 'from' | 'to'>, revision: number) => void
  restart: () => void
  setMode: (mode: CheckersMode) => void
  timeoutTurn: (revision: number) => void
  requestRematch: () => void
  dispose: () => void
} {
  const status = ref<CheckersWsStatus>('idle')
  const lastServerPingAt = ref<number | null>(null)
  const peerId = randomPeerId()
  const clientId = readCheckersClientId()

  let ws: WebSocket | null = null
  let activeRoomId: string | null = null
  let disposed = false
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectAttempt = 0

  function clearReconnect(): void {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  function closeCurrentSocket(): void {
    const socket = ws
    ws = null
    if (!socket) {
      return
    }
    socket.onopen = null
    socket.onmessage = null
    socket.onerror = null
    socket.onclose = null
    try {
      socket.close()
    } catch {
      /* ignore */
    }
  }

  function scheduleReconnect(): void {
    clearReconnect()
    if (disposed || !activeRoomId) {
      return
    }
    status.value = 'reconnecting'
    const delay = Math.min(10_000, 800 * 2 ** reconnectAttempt)
    reconnectAttempt = Math.min(reconnectAttempt + 1, 12)
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      if (activeRoomId) {
        connect(activeRoomId)
      }
    }, delay)
  }

  function connect(roomIdRaw: string): void {
    const roomId = roomIdRaw.trim()
    if (!roomId || disposed) {
      return
    }
    if (ws && ws.readyState === WebSocket.OPEN && activeRoomId === roomId) {
      return
    }
    activeRoomId = roomId
    clearReconnect()
    closeCurrentSocket()

    const url = buildCheckersWsUrl(peerId)
    if (!url) {
      return
    }

    status.value = 'reconnecting'
    const socket = new WebSocket(url)
    ws = socket

    socket.onopen = () => {
      if (ws !== socket) {
        return
      }
      reconnectAttempt = 0
      status.value = 'open'
      lastServerPingAt.value = Date.now()
      socket.send(JSON.stringify({ type: CheckersWs.join, roomId, clientId, botDifficulty: options.getBotDifficulty?.() }))
    }

    socket.onmessage = (event) => {
      if (ws !== socket) {
        return
      }
      let data: unknown
      try {
        data = JSON.parse(String(event.data))
      } catch {
        return
      }
      if (data && typeof data === 'object' && (data as { type?: unknown }).type === 'ping') {
        lastServerPingAt.value = Date.now()
      }
      if (replyJsonPingIfNeeded(data, socket)) {
        return
      }
      if (!data || typeof data !== 'object') {
        return
      }
      const msg = data as { type?: string; payload?: unknown }
      if ((msg.type === CheckersWs.state || msg.type === CheckersWs.update) && msg.payload) {
        options.onState(msg.payload as CheckersStateMessagePayload)
        return
      }
      if (msg.type === CheckersWs.error && msg.payload && typeof msg.payload === 'object') {
        const payload = msg.payload as { message?: unknown }
        options.onError(typeof payload.message === 'string' ? payload.message : 'Checkers WebSocket error')
      }
    }

    socket.onerror = () => {
      if (ws === socket) {
        status.value = 'error'
      }
    }

    socket.onclose = () => {
      if (ws !== socket || disposed) {
        return
      }
      ws = null
      scheduleReconnect()
    }
  }

  function sendMove(move: Pick<CheckersMove, 'from' | 'to'>, revision: number): void {
    if (!ws || ws.readyState !== WebSocket.OPEN || !activeRoomId) {
      return
    }
    ws.send(
      JSON.stringify({
        type: CheckersWs.move,
        roomId: activeRoomId,
        revision,
        from: move.from,
        to: move.to,
      }),
    )
  }

  function restart(): void {
    if (!ws || ws.readyState !== WebSocket.OPEN || !activeRoomId) {
      return
    }
    ws.send(JSON.stringify({ type: CheckersWs.restart, roomId: activeRoomId }))
  }

  function setMode(mode: CheckersMode): void {
    if (!ws || ws.readyState !== WebSocket.OPEN || !activeRoomId) {
      return
    }
    ws.send(JSON.stringify({ type: CheckersWs.setMode, roomId: activeRoomId, mode }))
  }

  function timeoutTurn(revision: number): void {
    if (!ws || ws.readyState !== WebSocket.OPEN || !activeRoomId) {
      return
    }
    ws.send(JSON.stringify({ type: CheckersWs.timeout, roomId: activeRoomId, revision }))
  }

  function requestRematch(): void {
    if (!ws || ws.readyState !== WebSocket.OPEN || !activeRoomId) {
      return
    }
    ws.send(JSON.stringify({ type: CheckersWs.rematch, roomId: activeRoomId }))
  }

  function dispose(): void {
    disposed = true
    clearReconnect()
    closeCurrentSocket()
    activeRoomId = null
    status.value = 'idle'
    lastServerPingAt.value = null
  }

  return { status, lastServerPingAt, connect, sendMove, restart, setMode, timeoutTurn, requestRematch, dispose }
}
