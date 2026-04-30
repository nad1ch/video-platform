import type { WebSocket, WebSocketServer } from 'ws'
import {
  applyCheckersRoomMove,
  chooseCheckersBotMove,
  getCheckersState,
  restartCheckersRoom,
  timeoutCheckersRoomTurn,
  type CheckersBotDifficulty,
} from './checkersGameStore'
import { CheckersWs } from './wsProtocol'

type CheckersMode = 'friend' | 'bot' | 'local'
type CheckersRole = 'player1' | 'player2' | 'spectator'

type RoomMeta = {
  mode: CheckersMode
  player1?: string
  player2?: string
  rematchAccepted: Set<string>
  lastMove: { from: { row: number; col: number }; to: { row: number; col: number } } | null
  botDifficulty: CheckersBotDifficulty
}

const clientsByRoom = new Map<string, Set<WebSocket>>()
const roomMeta = new Map<string, RoomMeta>()
const clientBySocket = new WeakMap<WebSocket, string>()
const botTimers = new Map<string, ReturnType<typeof setTimeout>>()
const CHECKERS_JSON_PING_MS = 25_000
let checkersJsonPingTimer: ReturnType<typeof setInterval> | null = null

type ClientMsg =
  | { type: typeof CheckersWs.join; roomId: string; clientId: string; botDifficulty?: CheckersBotDifficulty }
  | {
      type: typeof CheckersWs.move
      roomId?: string
      revision?: number
      from: { row: number; col: number }
      to: { row: number; col: number }
    }
  | { type: typeof CheckersWs.restart; roomId?: string }
  | { type: typeof CheckersWs.setMode; roomId?: string; mode: CheckersMode }
  | { type: typeof CheckersWs.timeout; roomId?: string; revision?: number }
  | { type: typeof CheckersWs.rematch; roomId?: string }

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

function pingAllCheckersClients(): void {
  for (const set of clientsByRoom.values()) {
    for (const ws of set) {
      safeSend(ws, { type: 'ping' })
    }
  }
}

function ensureCheckersJsonPingTimer(): void {
  if (checkersJsonPingTimer !== null) {
    return
  }
  checkersJsonPingTimer = setInterval(pingAllCheckersClients, CHECKERS_JSON_PING_MS)
  if (typeof checkersJsonPingTimer.unref === 'function') {
    checkersJsonPingTimer.unref()
  }
}

function cleanRoomId(raw: unknown): string | null {
  if (typeof raw !== 'string') {
    return null
  }
  const roomId = raw.trim().slice(0, 80)
  return roomId.length > 0 ? roomId : null
}

function cleanClientId(raw: unknown): string | null {
  if (typeof raw !== 'string') {
    return null
  }
  const clientId = raw.trim().slice(0, 120)
  return clientId.length > 0 ? clientId : null
}

function cleanMode(raw: unknown): CheckersMode | null {
  return raw === 'friend' || raw === 'bot' || raw === 'local' ? raw : null
}

function cleanBotDifficulty(raw: unknown): CheckersBotDifficulty | undefined {
  return raw === 'easy' || raw === 'medium' || raw === 'hard' ? raw : undefined
}

function isPosition(value: unknown): value is { row: number; col: number } {
  if (!value || typeof value !== 'object') {
    return false
  }
  const pos = value as { row?: unknown; col?: unknown }
  return Number.isInteger(pos.row) && Number.isInteger(pos.col)
}

function parseClientMsg(raw: string): ClientMsg | null {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (!data || typeof data !== 'object') {
    return null
  }
  const msg = data as {
    type?: unknown
    roomId?: unknown
    clientId?: unknown
    revision?: unknown
    mode?: unknown
    botDifficulty?: unknown
    from?: unknown
    to?: unknown
  }
  if (msg.type === 'pong') {
    return null
  }
  if (msg.type === CheckersWs.join) {
    const roomId = cleanRoomId(msg.roomId)
    const clientId = cleanClientId(msg.clientId)
    return roomId && clientId ? { type: CheckersWs.join, roomId, clientId, botDifficulty: cleanBotDifficulty(msg.botDifficulty) } : null
  }
  if (msg.type === CheckersWs.move && isPosition(msg.from) && isPosition(msg.to)) {
    const roomId = cleanRoomId(msg.roomId)
    return {
      type: CheckersWs.move,
      roomId: roomId ?? undefined,
      revision: typeof msg.revision === 'number' && Number.isFinite(msg.revision) ? msg.revision : undefined,
      from: { row: msg.from.row, col: msg.from.col },
      to: { row: msg.to.row, col: msg.to.col },
    }
  }
  if (msg.type === CheckersWs.restart) {
    const roomId = cleanRoomId(msg.roomId)
    return { type: CheckersWs.restart, roomId: roomId ?? undefined }
  }
  if (msg.type === CheckersWs.setMode) {
    const roomId = cleanRoomId(msg.roomId)
    const mode = cleanMode(msg.mode)
    return mode ? { type: CheckersWs.setMode, roomId: roomId ?? undefined, mode } : null
  }
  if (msg.type === CheckersWs.timeout) {
    const roomId = cleanRoomId(msg.roomId)
    return {
      type: CheckersWs.timeout,
      roomId: roomId ?? undefined,
      revision: typeof msg.revision === 'number' && Number.isFinite(msg.revision) ? msg.revision : undefined,
    }
  }
  if (msg.type === CheckersWs.rematch) {
    const roomId = cleanRoomId(msg.roomId)
    return { type: CheckersWs.rematch, roomId: roomId ?? undefined }
  }
  return null
}

function metaForRoom(roomId: string): RoomMeta {
  let meta = roomMeta.get(roomId)
  if (!meta) {
    meta = { mode: 'bot', rematchAccepted: new Set(), lastMove: null, botDifficulty: 'medium' }
    roomMeta.set(roomId, meta)
  }
  return meta
}

export function reserveCheckersMatchRoom(roomId: string, player1ClientId: string, player2ClientId: string): void {
  const meta = metaForRoom(roomId)
  meta.mode = 'friend'
  meta.player1 = player1ClientId
  meta.player2 = player2ClientId
  meta.rematchAccepted.clear()
  meta.lastMove = null
}

function roleForClient(roomId: string, clientId: string | null): CheckersRole {
  if (!clientId) {
    return 'spectator'
  }
  const meta = metaForRoom(roomId)
  if (meta.player1 === clientId) {
    return 'player1'
  }
  if (meta.player2 === clientId) {
    return 'player2'
  }
  return 'spectator'
}

function roomHasClient(roomId: string, clientId: string): boolean {
  const set = clientsByRoom.get(roomId)
  if (!set) {
    return false
  }
  for (const ws of set) {
    if (clientBySocket.get(ws) === clientId) {
      return true
    }
  }
  return false
}

function pruneInactiveRoomRoles(roomId: string): void {
  const meta = metaForRoom(roomId)
  if (meta.player1 && !roomHasClient(roomId, meta.player1)) {
    delete meta.player1
  }
  if (meta.player2 && meta.player2 !== 'bot' && !roomHasClient(roomId, meta.player2)) {
    delete meta.player2
  }
}

function assignRole(roomId: string, clientId: string): CheckersRole {
  const meta = metaForRoom(roomId)
  pruneInactiveRoomRoles(roomId)
  if (meta.player1 === clientId || meta.player2 === clientId) {
    return roleForClient(roomId, clientId)
  }
  if (!meta.player1) {
    meta.player1 = clientId
    return 'player1'
  }
  if (!meta.player2 && meta.mode !== 'bot') {
    meta.player2 = clientId
    return 'player2'
  }
  return 'spectator'
}

function canSocketMove(ws: WebSocket, roomId: string): boolean {
  const meta = metaForRoom(roomId)
  if (meta.mode === 'local') {
    return true
  }
  const role = roleForClient(roomId, clientBySocket.get(ws) ?? null)
  const turn = getCheckersState(roomId).turn
  if (meta.mode === 'bot') {
    return role === 'player1' && turn === 'player1'
  }
  return role === turn
}

function canSocketControlRoom(ws: WebSocket, roomId: string): boolean {
  const meta = metaForRoom(roomId)
  if (meta.mode === 'local') {
    return true
  }
  const role = roleForClient(roomId, clientBySocket.get(ws) ?? null)
  return role === 'player1' || role === 'player2'
}

function clientSet(roomId: string): Set<WebSocket> {
  let set = clientsByRoom.get(roomId)
  if (!set) {
    set = new Set()
    clientsByRoom.set(roomId, set)
  }
  return set
}

function registerClient(roomId: string, ws: WebSocket): void {
  clientSet(roomId).add(ws)
}

function unregisterClient(roomId: string | null, ws: WebSocket): void {
  if (!roomId) {
    return
  }
  const set = clientsByRoom.get(roomId)
  if (!set) {
    return
  }
  set.delete(ws)
  pruneInactiveRoomRoles(roomId)
  if (set.size === 0) {
    clientsByRoom.delete(roomId)
  }
}

function broadcastCheckersToRoom(roomId: string, makeObj: (ws: WebSocket) => unknown): void {
  const set = clientsByRoom.get(roomId)
  if (!set) {
    return
  }
  for (const ws of set) {
    if (ws.readyState !== 1) {
      continue
    }
    try {
      ws.send(JSON.stringify(makeObj(ws)))
    } catch {
      /* ignore */
    }
  }
}

function sendState(ws: WebSocket, roomId: string): void {
  const clientId = clientBySocket.get(ws) ?? null
  const meta = metaForRoom(roomId)
  const role = roleForClient(roomId, clientId)
  const opponentRole = role === 'player1' ? 'player2' : role === 'player2' ? 'player1' : null
  const opponentClientId = opponentRole === 'player1' ? meta.player1 : opponentRole === 'player2' ? meta.player2 : undefined
  safeSend(ws, {
    type: CheckersWs.state,
    payload: {
      roomId,
      state: getCheckersState(roomId),
      myRole: role,
      mode: meta.mode,
      rematch: {
        requestedByMe: clientId ? meta.rematchAccepted.has(clientId) : false,
        requestedByOpponent: opponentClientId ? meta.rematchAccepted.has(opponentClientId) : false,
      },
      lastMove: meta.lastMove,
    },
  })
}

function broadcastUpdate(roomId: string): void {
  broadcastCheckersToRoom(roomId, (ws) => ({
    type: CheckersWs.update,
    payload: {
      roomId,
      state: getCheckersState(roomId),
      myRole: roleForClient(roomId, clientBySocket.get(ws) ?? null),
      mode: metaForRoom(roomId).mode,
      rematch: (() => {
        const clientId = clientBySocket.get(ws) ?? null
        const meta = metaForRoom(roomId)
        const role = roleForClient(roomId, clientId)
        const opponentRole = role === 'player1' ? 'player2' : role === 'player2' ? 'player1' : null
        const opponentClientId = opponentRole === 'player1' ? meta.player1 : opponentRole === 'player2' ? meta.player2 : undefined
        return {
          requestedByMe: clientId ? meta.rematchAccepted.has(clientId) : false,
          requestedByOpponent: opponentClientId ? meta.rematchAccepted.has(opponentClientId) : false,
        }
      })(),
      lastMove: metaForRoom(roomId).lastMove,
    },
  }))
}

const autoRematchTimers = new Map<string, ReturnType<typeof setTimeout>>()

function clearAutoRematch(roomId: string): void {
  const timer = autoRematchTimers.get(roomId)
  if (timer) {
    clearTimeout(timer)
    autoRematchTimers.delete(roomId)
  }
}

function restartRoomForRematch(roomId: string): void {
  const meta = metaForRoom(roomId)
  clearAutoRematch(roomId)
  meta.rematchAccepted.clear()
  meta.lastMove = null
  restartCheckersRoom(roomId)
}

function scheduleAutoRematch(roomId: string): void {
  const meta = metaForRoom(roomId)
  if (meta.mode !== 'friend' || !getCheckersState(roomId).winner || !meta.player1 || !meta.player2) {
    return
  }
  if (!roomHasClient(roomId, meta.player1) || !roomHasClient(roomId, meta.player2)) {
    return
  }
  clearAutoRematch(roomId)
  const timer = setTimeout(() => {
    autoRematchTimers.delete(roomId)
    const currentMeta = metaForRoom(roomId)
    if (!currentMeta.player1 || !currentMeta.player2) return
    if (!roomHasClient(roomId, currentMeta.player1) || !roomHasClient(roomId, currentMeta.player2)) return
    restartRoomForRematch(roomId)
    broadcastUpdate(roomId)
  }, 5000)
  if (typeof timer.unref === 'function') {
    timer.unref()
  }
  autoRematchTimers.set(roomId, timer)
}

function scheduleBotMove(roomId: string): void {
  const state = getCheckersState(roomId)
  if (metaForRoom(roomId).mode !== 'bot' || state.turn !== 'player2' || state.winner) {
    return
  }
  if (botTimers.has(roomId)) {
    return
  }
  const delay = 400 + Math.floor(Math.random() * 301)
  const timer = setTimeout(() => {
    botTimers.delete(roomId)
    const meta = metaForRoom(roomId)
    const state = getCheckersState(roomId)
    if (meta.mode !== 'bot' || state.turn !== 'player2' || state.winner) {
      return
    }
    const move = chooseCheckersBotMove(roomId, meta.botDifficulty)
    if (!move) {
      return
    }
    const result = applyCheckersRoomMove(roomId, move, getCheckersState(roomId).revision)
    if (result.ok) {
      meta.lastMove = { from: move.from, to: move.to }
      broadcastUpdate(roomId)
      scheduleAutoRematch(roomId)
      scheduleBotMove(roomId)
    }
  }, delay)
  botTimers.set(roomId, timer)
}

function setRoomMode(roomId: string, mode: CheckersMode, clientId: string | null): void {
  const meta = metaForRoom(roomId)
  meta.mode = mode
  meta.rematchAccepted.clear()
  meta.lastMove = null
  if (mode === 'bot') {
    if (clientId && (!meta.player1 || meta.player1 === clientId)) {
      meta.player1 = clientId
    }
    meta.player2 = 'bot'
  } else if (meta.player2 === 'bot') {
    delete meta.player2
  }
}

function acceptRematch(ws: WebSocket, roomId: string): void {
  const meta = metaForRoom(roomId)
  const clientId = clientBySocket.get(ws) ?? null
  const role = roleForClient(roomId, clientId)
  if (!clientId || (role !== 'player1' && role !== 'player2')) {
    return
  }
  if (!getCheckersState(roomId).winner) {
    return
  }
  meta.rematchAccepted.add(clientId)
  clearAutoRematch(roomId)
  const player1Ready = meta.player1 ? meta.rematchAccepted.has(meta.player1) : false
  const player2Ready = meta.player2 ? meta.rematchAccepted.has(meta.player2) : false
  if (player1Ready && player2Ready) {
    restartRoomForRematch(roomId)
  }
  broadcastUpdate(roomId)
  scheduleBotMove(roomId)
}

export function attachCheckersSocketServer(wss: WebSocketServer): void {
  ensureCheckersJsonPingTimer()

  wss.on('connection', (ws: WebSocket) => {
    let roomId: string | null = null

    ws.on('message', (buf) => {
      const msg = parseClientMsg(buf.toString())
      if (!msg) {
        return
      }

      if (msg.type === CheckersWs.join) {
        unregisterClient(roomId, ws)
        roomId = msg.roomId
        clientBySocket.set(ws, msg.clientId)
        if (msg.botDifficulty) {
          metaForRoom(msg.roomId).botDifficulty = msg.botDifficulty
        }
        registerClient(roomId, ws)
        assignRole(roomId, msg.clientId)
        sendState(ws, roomId)
        scheduleBotMove(roomId)
        return
      }

      const targetRoomId = msg.roomId ?? roomId
      if (!targetRoomId) {
        safeSend(ws, {
          type: CheckersWs.error,
          payload: { code: 'not_joined', message: 'Join a checkers room before moving' },
        })
        return
      }

      if (msg.type === CheckersWs.restart) {
        if (!canSocketControlRoom(ws, targetRoomId)) {
          return
        }
        restartCheckersRoom(targetRoomId)
        clearAutoRematch(targetRoomId)
        metaForRoom(targetRoomId).rematchAccepted.clear()
        metaForRoom(targetRoomId).lastMove = null
        broadcastUpdate(targetRoomId)
        scheduleBotMove(targetRoomId)
        return
      }

      if (msg.type === CheckersWs.setMode) {
        if (!canSocketControlRoom(ws, targetRoomId)) {
          return
        }
        setRoomMode(targetRoomId, msg.mode, clientBySocket.get(ws) ?? null)
        broadcastUpdate(targetRoomId)
        scheduleBotMove(targetRoomId)
        return
      }

      if (msg.type === CheckersWs.rematch) {
        acceptRematch(ws, targetRoomId)
        return
      }

      if (msg.type === CheckersWs.timeout) {
        if (!canSocketMove(ws, targetRoomId)) {
          sendState(ws, targetRoomId)
          return
        }
        timeoutCheckersRoomTurn(targetRoomId, msg.revision)
        metaForRoom(targetRoomId).lastMove = null
        broadcastUpdate(targetRoomId)
        scheduleAutoRematch(targetRoomId)
        scheduleBotMove(targetRoomId)
        return
      }

      if (!canSocketMove(ws, targetRoomId)) {
        sendState(ws, targetRoomId)
        return
      }

      const result = applyCheckersRoomMove(targetRoomId, { from: msg.from, to: msg.to }, msg.revision)
      if (result.ok) {
        metaForRoom(targetRoomId).lastMove = { from: msg.from, to: msg.to }
        broadcastUpdate(targetRoomId)
        scheduleAutoRematch(targetRoomId)
        scheduleBotMove(targetRoomId)
      } else if (result.reason === 'stale-revision') {
        sendState(ws, targetRoomId)
      }
    })

    ws.on('error', () => {
      if (roomId) clearAutoRematch(roomId)
      unregisterClient(roomId, ws)
    })

    ws.on('close', () => {
      if (roomId) clearAutoRematch(roomId)
      unregisterClient(roomId, ws)
    })
  })
}
