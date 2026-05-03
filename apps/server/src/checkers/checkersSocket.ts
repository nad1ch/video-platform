import type { IncomingMessage } from 'node:http'
import type { WebSocket, WebSocketServer } from 'ws'
import {
  applyCheckersRoomMove,
  chooseCheckersBotMove,
  getCheckersState,
  restartCheckersRoom,
  setCheckersState,
  timeoutCheckersRoomTurn,
  type CheckersBotDifficulty,
} from './checkersGameStore'
import {
  loadCheckersLiveRoom,
  persistCheckersLiveRoom,
  type PersistedCheckersRoomMeta,
} from './checkersLiveRoomPersistence'
import { CheckersWs } from './wsProtocol'
import { readSessionFromCookie } from '../auth/session/sessionJwt'
import { resolvePrismaUserIdFromSession } from '../auth/resolvePrismaUserFromSession'
import { attachWsHeartbeat } from '../utils/wsHeartbeat'
import { safeSendJson as safeSend } from '../utils/wsSafeSend'

type CheckersMode = 'friend' | 'bot' | 'local'
type CheckersRole = 'player1' | 'player2' | 'spectator'
type CheckersPlayerRole = Exclude<CheckersRole, 'spectator'>

export type RoomMeta = {
  mode: CheckersMode
  player1?: string
  player2?: string
  /**
   * For rated rooms only: the Prisma userId reserved for each seat at
   * matchmaking time. On WS join, the server resolves the connecting
   * user's Prisma id from the session cookie and rebinds the clientId
   * on match, or downgrades the joiner to spectator if neither matches.
   * This prevents clientId theft across a transient reconnect.
   */
  player1UserId?: string
  player2UserId?: string
  rated: boolean
  readyClientIds: Set<string>
  displayNames: Map<string, string>
  rematchAccepted: Set<string>
  lastMove: { from: { row: number; col: number }; to: { row: number; col: number } } | null
  botDifficulty: CheckersBotDifficulty
}

const clientsByRoom = new Map<string, Set<WebSocket>>()
const roomMeta = new Map<string, RoomMeta>()
const clientBySocket = new WeakMap<WebSocket, string>()
/**
 * Prisma user id resolved from the HTTP-upgrade session cookie. Populated once
 * per socket (cookies are not resent on individual WS frames). `null` means
 * "resolved and anonymous"; `undefined` means "not yet resolved".
 */
const sessionUserIdBySocket = new WeakMap<WebSocket, string | null>()
const cookieHeaderBySocket = new WeakMap<WebSocket, string | undefined>()
const botTimers = new Map<string, ReturnType<typeof setTimeout>>()
const CHECKERS_JSON_PING_MS = 25_000
let checkersJsonPingTimer: ReturnType<typeof setInterval> | null = null
const hydratedRooms = new Set<string>()
const hydrationByRoom = new Map<string, Promise<void>>()

type ClientMsg =
  | { type: typeof CheckersWs.join; roomId: string; clientId: string; displayName?: string; botDifficulty?: CheckersBotDifficulty }
  | {
      type: typeof CheckersWs.move
      roomId?: string
      revision?: number
      from: { row: number; col: number }
      to: { row: number; col: number }
    }
  | { type: typeof CheckersWs.restart; roomId?: string }
  | { type: typeof CheckersWs.setMode; roomId?: string; mode: CheckersMode }
  | { type: typeof CheckersWs.ready; roomId?: string; ready: boolean }
  | { type: typeof CheckersWs.identity; roomId?: string; displayName?: string }
  | { type: typeof CheckersWs.timeout; roomId?: string; revision?: number }
  | { type: typeof CheckersWs.rematch; roomId?: string }

/* safeSend is now `safeSendJson` from `../utils/wsSafeSend` (imported above). */

function pingAllCheckersClients(): void {
  for (const set of clientsByRoom.values()) {
    for (const ws of set) {
      safeSend(ws, { type: 'ping' })
    }
  }
}

function ensureCheckersJsonPingTimer(wss: WebSocketServer): void {
  if (checkersJsonPingTimer !== null) {
    return
  }
  checkersJsonPingTimer = setInterval(pingAllCheckersClients, CHECKERS_JSON_PING_MS)
  if (typeof checkersJsonPingTimer.unref === 'function') {
    checkersJsonPingTimer.unref()
  }
  wss.on('close', () => {
    if (checkersJsonPingTimer !== null) {
      clearInterval(checkersJsonPingTimer)
      checkersJsonPingTimer = null
    }
  })
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

function cleanDisplayName(raw: unknown): string | undefined {
  if (typeof raw !== 'string') {
    return undefined
  }
  const displayName = raw.trim().replace(/\s+/g, ' ').slice(0, 48)
  return displayName.length > 0 ? displayName : undefined
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
    ready?: unknown
    displayName?: unknown
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
    return roomId && clientId
      ? {
          type: CheckersWs.join,
          roomId,
          clientId,
          displayName: cleanDisplayName(msg.displayName),
          botDifficulty: cleanBotDifficulty(msg.botDifficulty),
        }
      : null
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
  if (msg.type === CheckersWs.ready) {
    const roomId = cleanRoomId(msg.roomId)
    return { type: CheckersWs.ready, roomId: roomId ?? undefined, ready: msg.ready === true }
  }
  if (msg.type === CheckersWs.identity) {
    const roomId = cleanRoomId(msg.roomId)
    return { type: CheckersWs.identity, roomId: roomId ?? undefined, displayName: cleanDisplayName(msg.displayName) }
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
    meta = {
      mode: 'bot',
      rated: false,
      readyClientIds: new Set(),
      displayNames: new Map(),
      rematchAccepted: new Set(),
      lastMove: null,
      botDifficulty: 'medium',
    }
    roomMeta.set(roomId, meta)
  }
  return meta
}

function persistedMeta(meta: RoomMeta): PersistedCheckersRoomMeta {
  return {
    mode: meta.mode,
    player1: meta.player1,
    player2: meta.player2,
    player1UserId: meta.player1UserId,
    player2UserId: meta.player2UserId,
    rated: meta.rated,
    readyClientIds: [...meta.readyClientIds],
    displayNames: Object.fromEntries(meta.displayNames),
    rematchAccepted: [...meta.rematchAccepted],
    lastMove: meta.lastMove,
    botDifficulty: meta.botDifficulty,
  }
}

function applyPersistedMeta(roomId: string, meta: PersistedCheckersRoomMeta): void {
  roomMeta.set(roomId, {
    mode: meta.mode,
    player1: meta.player1,
    player2: meta.player2,
    player1UserId: meta.player1UserId,
    player2UserId: meta.player2UserId,
    rated: meta.rated === true,
    readyClientIds: new Set(meta.readyClientIds ?? []),
    displayNames: new Map(Object.entries(meta.displayNames ?? {})),
    rematchAccepted: new Set(meta.rematchAccepted),
    lastMove: meta.lastMove,
    botDifficulty: meta.botDifficulty,
  })
}

function persistRoomSnapshot(roomId: string): void {
  persistCheckersLiveRoom(roomId, {
    state: getCheckersState(roomId),
    meta: persistedMeta(metaForRoom(roomId)),
  })
}

async function hydrateCheckersLiveRoom(roomId: string): Promise<void> {
  if (hydratedRooms.has(roomId)) {
    return
  }
  const existing = hydrationByRoom.get(roomId)
  if (existing) {
    await existing
    return
  }
  const pending = (async () => {
    const snapshot = await loadCheckersLiveRoom(roomId)
    if (snapshot) {
      setCheckersState(roomId, snapshot.state)
      applyPersistedMeta(roomId, snapshot.meta)
    }
    hydratedRooms.add(roomId)
  })().finally(() => {
    hydrationByRoom.delete(roomId)
  })
  hydrationByRoom.set(roomId, pending)
  await pending
}

export function reserveCheckersMatchRoom(
  roomId: string,
  player1ClientId: string,
  player2ClientId: string,
  opts?: { player1UserId?: string | null; player2UserId?: string | null },
): void {
  const meta = metaForRoom(roomId)
  meta.mode = 'friend'
  meta.rated = true
  meta.player1 = player1ClientId
  meta.player2 = player2ClientId
  // Snap session-resolved user ids into the room so WS joiners can be
  // identity-bound even if the reserved clientId has not yet connected
  // (prevents a racer from stealing the seat during the join delay).
  const p1 = typeof opts?.player1UserId === 'string' ? opts.player1UserId.trim() : ''
  const p2 = typeof opts?.player2UserId === 'string' ? opts.player2UserId.trim() : ''
  meta.player1UserId = p1.length > 0 ? p1 : undefined
  meta.player2UserId = p2.length > 0 ? p2 : undefined
  meta.readyClientIds.clear()
  meta.rematchAccepted.clear()
  meta.lastMove = null
  persistRoomSnapshot(roomId)
}

/**
 * Resolve the Prisma userId for this socket from the HTTP-upgrade cookie
 * captured at connect time. Cached in `sessionUserIdBySocket` so the DB
 * lookup runs at most once per WS lifetime. Returns `null` for anonymous.
 */
async function resolveSessionUserIdForSocket(ws: WebSocket): Promise<string | null> {
  const cached = sessionUserIdBySocket.get(ws)
  if (cached !== undefined) return cached
  const cookie = cookieHeaderBySocket.get(ws)
  let resolved: string | null = null
  try {
    const session = readSessionFromCookie(cookie)
    if (session) {
      resolved = await resolvePrismaUserIdFromSession(session)
    }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[checkers-ws] session resolve failed', err)
    }
    resolved = null
  }
  sessionUserIdBySocket.set(ws, resolved)
  return resolved
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
  // Rated matchmaking rooms MUST NOT release seats on a transient disconnect —
  // that allowed clientId theft during a brief reconnect. The seat is
  // identity-bound via `player1UserId`/`player2UserId`; legitimate reclaim
  // happens in `assignRole` via `rebindRatedSeatIfOwner` on the next join.
  if (meta.rated) {
    return
  }
  if (meta.player1 && !roomHasClient(roomId, meta.player1)) {
    delete meta.player1
  }
  if (meta.player2 && meta.player2 !== 'bot' && !roomHasClient(roomId, meta.player2)) {
    delete meta.player2
  }
}

function displayNameForClient(meta: RoomMeta, clientId: string | undefined): string | undefined {
  return clientId ? meta.displayNames.get(clientId) : undefined
}

function isClientReady(meta: RoomMeta, clientId: string | undefined): boolean {
  return clientId ? meta.readyClientIds.has(clientId) : false
}

function playerMeta(roomId: string): Partial<Record<CheckersPlayerRole, { displayName?: string; ready: boolean }>> {
  const meta = metaForRoom(roomId)
  return {
    player1: meta.player1
      ? { displayName: displayNameForClient(meta, meta.player1), ready: isClientReady(meta, meta.player1) }
      : undefined,
    player2: meta.player2 && meta.player2 !== 'bot'
      ? { displayName: displayNameForClient(meta, meta.player2), ready: isClientReady(meta, meta.player2) }
      : meta.player2 === 'bot'
        ? { displayName: 'Bot', ready: true }
        : undefined,
  }
}

function privateFriendRoomReady(meta: RoomMeta): boolean {
  if (meta.mode !== 'friend' || meta.rated) {
    return true
  }
  return Boolean(meta.player1 && meta.player2 && meta.readyClientIds.has(meta.player1) && meta.readyClientIds.has(meta.player2))
}

function setClientDisplayName(roomId: string, clientId: string | null, displayName: string | undefined): void {
  if (!clientId) {
    return
  }
  const meta = metaForRoom(roomId)
  if (displayName) {
    meta.displayNames.set(clientId, displayName)
  } else {
    meta.displayNames.delete(clientId)
  }
}

/**
 * For rated rooms: rebind the seat whose `player*UserId` matches this
 * session to the incoming `clientId` (covers legitimate reclaim after a
 * clientId rotation such as a localStorage wipe or a different device).
 * Non-matching joiners end up as spectators — `assignRole` returns
 * `'spectator'` below because neither seat's clientId matches them and
 * both seats are occupied (pruning is disabled for rated rooms).
 */
function rebindRatedSeatIfOwner(
  roomId: string,
  incomingClientId: string,
  sessionUserId: string | null,
): void {
  const meta = metaForRoom(roomId)
  if (!meta.rated || !sessionUserId) return
  if (meta.player1UserId && meta.player1UserId === sessionUserId) {
    if (meta.player1 !== incomingClientId) {
      meta.player1 = incomingClientId
    }
    return
  }
  if (meta.player2UserId && meta.player2UserId === sessionUserId) {
    if (meta.player2 !== incomingClientId) {
      meta.player2 = incomingClientId
    }
  }
}

function assignRole(roomId: string, clientId: string): CheckersRole {
  const meta = metaForRoom(roomId)
  pruneInactiveRoomRoles(roomId)
  if (meta.player1 === clientId || meta.player2 === clientId) {
    return roleForClient(roomId, clientId)
  }
  // Rated rooms have identity-bound seats populated by matchmaking. A joiner
  // whose clientId does not match either seat AFTER `rebindRatedSeatIfOwner`
  // is not the reserved player — downgrade to spectator rather than taking
  // an empty seat (seats are never empty in rated rooms because prune is
  // disabled and reservation runs before WS join).
  if (meta.rated) {
    return 'spectator'
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
  if (meta.mode === 'friend' && !privateFriendRoomReady(meta)) {
    return false
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
      rated: meta.rated,
      players: playerMeta(roomId),
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
      rated: metaForRoom(roomId).rated,
      players: playerMeta(roomId),
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
  persistRoomSnapshot(roomId)
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
      persistRoomSnapshot(roomId)
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
  meta.rated = false
  meta.readyClientIds.clear()
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
  persistRoomSnapshot(roomId)
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
  } else {
    persistRoomSnapshot(roomId)
  }
  broadcastUpdate(roomId)
  scheduleBotMove(roomId)
}

export function attachCheckersSocketServer(wss: WebSocketServer): void {
  ensureCheckersJsonPingTimer(wss)
  attachWsHeartbeat(wss, { logLabel: 'checkers-ws' })

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    let roomId: string | null = null

    // Capture cookie header once (WS frames do not re-send cookies). The
    // lazy `resolveSessionUserIdForSocket` reads it on the first rated
    // `join` to look up the Prisma userId.
    cookieHeaderBySocket.set(ws, req.headers.cookie)

    ws.on('message', (buf) => {
      const msg = parseClientMsg(buf.toString())
      if (!msg) {
        return
      }

      if (msg.type === CheckersWs.join) {
        void (async () => {
          await hydrateCheckersLiveRoom(msg.roomId)
          unregisterClient(roomId, ws)
          roomId = msg.roomId
          clientBySocket.set(ws, msg.clientId)
          if (msg.botDifficulty) {
            metaForRoom(msg.roomId).botDifficulty = msg.botDifficulty
          }
          setClientDisplayName(msg.roomId, msg.clientId, msg.displayName)
          registerClient(roomId, ws)
          // Rated rooms: bind the seat to the session user id. If the joiner
          // is the reserved player, rebind their seat's clientId; otherwise
          // `assignRole` returns 'spectator' for rated rooms with no open seats.
          if (metaForRoom(roomId).rated) {
            const sessionUserId = await resolveSessionUserIdForSocket(ws)
            rebindRatedSeatIfOwner(roomId, msg.clientId, sessionUserId)
          }
          assignRole(roomId, msg.clientId)
          persistRoomSnapshot(roomId)
          sendState(ws, roomId)
          scheduleBotMove(roomId)
        })()
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
        persistRoomSnapshot(targetRoomId)
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

      if (msg.type === CheckersWs.identity) {
        setClientDisplayName(targetRoomId, clientBySocket.get(ws) ?? null, msg.displayName)
        persistRoomSnapshot(targetRoomId)
        broadcastUpdate(targetRoomId)
        return
      }

      if (msg.type === CheckersWs.ready) {
        const meta = metaForRoom(targetRoomId)
        const clientId = clientBySocket.get(ws) ?? null
        const role = roleForClient(targetRoomId, clientId)
        if (meta.mode !== 'friend' || meta.rated || !clientId || (role !== 'player1' && role !== 'player2')) {
          return
        }
        if (msg.ready) {
          meta.readyClientIds.add(clientId)
        } else {
          meta.readyClientIds.delete(clientId)
        }
        persistRoomSnapshot(targetRoomId)
        broadcastUpdate(targetRoomId)
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
        persistRoomSnapshot(targetRoomId)
        broadcastUpdate(targetRoomId)
        scheduleAutoRematch(targetRoomId)
        scheduleBotMove(targetRoomId)
        return
      }

      if (!canSocketMove(ws, targetRoomId)) {
        sendState(ws, targetRoomId)
        return
      }

      // Human moves MUST carry the client-known `revision`. Without it, the
      // stale-revision guard in `applyCheckersRoomMove` silently skips its
      // check — a reconnecting client with a cached out-of-date board could
      // commit a move against a newer server state. The bot path calls
      // `applyCheckersRoomMove` directly (not via this handler) and always
      // passes the current revision, so rejecting here is safe.
      if (typeof msg.revision !== 'number') {
        sendState(ws, targetRoomId)
        return
      }

      const result = applyCheckersRoomMove(targetRoomId, { from: msg.from, to: msg.to }, msg.revision)
      if (result.ok) {
        metaForRoom(targetRoomId).lastMove = { from: msg.from, to: msg.to }
        persistRoomSnapshot(targetRoomId)
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
