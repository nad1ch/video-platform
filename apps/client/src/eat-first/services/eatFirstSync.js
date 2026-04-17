import { createLogger } from '@/utils/logger'
import { normalizePlayerSlotId } from '../utils/playerSlot.js'

const log = createLogger('eat-first:sync')

/** @type {Map<string, { ws: WebSocket | null, refs: number, roomCbs: Set<Function>, playersCbs: Set<Function>, votesCbs: Set<Function>, reconnectTimer: ReturnType<typeof setTimeout> | null }>} */
const hubs = new Map()

function wsPath() {
  const base = String(import.meta.env.BASE_URL || '/')
  const trimmed = base.endsWith('/') ? base.slice(0, -1) : base
  return `${trimmed}/eat-first-ws`
}

function wsUrl() {
  if (typeof window === 'undefined') return ''
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}${wsPath()}`
}

function getSet(hub, channel) {
  if (channel === 'room') return hub.roomCbs
  if (channel === 'players') return hub.playersCbs
  return hub.votesCbs
}

function dispatch(gameId, msg) {
  const hub = hubs.get(gameId)
  if (!hub) return
  const room = msg.room ?? {}
  const players = msg.players ?? []
  const votes = msg.votes ?? []
  for (const cb of hub.roomCbs) {
    try {
      cb(room)
    } catch (e) {
      log.warn('room callback', e)
    }
  }
  for (const cb of hub.playersCbs) {
    try {
      cb(players)
    } catch (e) {
      log.warn('players callback', e)
    }
  }
  for (const cb of hub.votesCbs) {
    try {
      cb(votes)
    } catch (e) {
      log.warn('votes callback', e)
    }
  }
}

function teardownHub(gameId) {
  const hub = hubs.get(gameId)
  if (!hub) return
  if (hub.reconnectTimer) {
    clearTimeout(hub.reconnectTimer)
    hub.reconnectTimer = null
  }
  if (hub.ws) {
    try {
      hub.ws.close()
    } catch {
      /* ignore */
    }
    hub.ws = null
  }
  hubs.delete(gameId)
}

function connectHub(gameId) {
  const hub = hubs.get(gameId)
  if (!hub || typeof window === 'undefined') return
  if (hub.ws && (hub.ws.readyState === WebSocket.CONNECTING || hub.ws.readyState === WebSocket.OPEN)) {
    return
  }
  const url = wsUrl()
  if (!url) return
  let ws
  try {
    ws = new WebSocket(url)
  } catch (e) {
    log.warn('WebSocket construct failed', e)
    scheduleReconnect(gameId)
    return
  }
  hub.ws = ws
  ws.onopen = () => {
    try {
      ws.send(JSON.stringify({ type: 'subscribe', gameId }))
    } catch {
      /* ignore */
    }
  }
  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(String(ev.data))
      if (msg.type === 'ping') return
      if (msg.type === 'eat-first:init' || msg.type === 'eat-first:update') {
        dispatch(gameId, msg)
      }
    } catch {
      /* ignore */
    }
  }
  ws.onerror = () => {
    /* onclose will reconnect */
  }
  ws.onclose = () => {
    hub.ws = null
    if (hub.refs > 0) {
      scheduleReconnect(gameId)
    }
  }
}

function scheduleReconnect(gameId) {
  const hub = hubs.get(gameId)
  if (!hub || hub.refs <= 0) return
  if (hub.reconnectTimer) return
  hub.reconnectTimer = setTimeout(() => {
    hub.reconnectTimer = null
    connectHub(gameId)
  }, 1500)
}

/**
 * @param {string} gameId
 * @param {'room'|'players'|'votes'} channel
 * @param {(payload: unknown) => void} cb
 * @returns {() => void}
 */
export function subscribeEatFirstChannel(gameId, channel, cb) {
  if (typeof window === 'undefined') {
    queueMicrotask(() => {
      if (channel === 'room') cb({})
      else cb([])
    })
    return () => {}
  }
  const gid = String(gameId ?? '').trim()
  if (!gid) {
    queueMicrotask(() => {
      if (channel === 'room') cb({})
      else cb([])
    })
    return () => {}
  }
  if (!hubs.has(gid)) {
    hubs.set(gid, {
      ws: null,
      refs: 0,
      roomCbs: new Set(),
      playersCbs: new Set(),
      votesCbs: new Set(),
      reconnectTimer: null,
    })
  }
  const hub = hubs.get(gid)
  getSet(hub, channel).add(cb)
  hub.refs += 1
  connectHub(gid)
  return () => {
    getSet(hub, channel).delete(cb)
    hub.refs -= 1
    if (hub.refs <= 0) {
      teardownHub(gid)
    }
  }
}

export function subscribeToCharacterChannel(gameId, playerId, callback) {
  const pid = normalizePlayerSlotId(playerId)
  return subscribeEatFirstChannel(gameId, 'players', (list) => {
    const row = list.find((x) => normalizePlayerSlotId(x.id) === pid)
    if (!row) {
      callback(null)
      return
    }
    const rest = { ...row }
    delete rest.id
    callback(Object.keys(rest).length ? rest : null)
  })
}
