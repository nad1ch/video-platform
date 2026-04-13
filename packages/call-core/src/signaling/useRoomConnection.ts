/// <reference types="vite/client" />

import type { RtpCapabilities } from 'mediasoup-client/types'
import { onUnmounted, ref, shallowRef } from 'vue'

export type RemoteProducerInfo = {
  producerId: string
  peerId: string
  kind: 'audio' | 'video'
}

export type RoomPeerInfo = {
  peerId: string
  displayName: string
}

export type RoomStatePayload = {
  peers: RoomPeerInfo[]
  routerRtpCapabilities: RtpCapabilities
  existingProducers: RemoteProducerInfo[]
}

type ServerMessage =
  | { type: 'room-state'; payload: RoomStatePayload }
  | { type: 'peer-joined'; payload: { peerId: string; displayName: string } }
  | { type: 'peer-left'; payload: { peerId: string } }
  | { type: 'peer-display-name'; payload: { peerId: string; displayName: string } }
  | {
      type: 'transport-created'
      payload: {
        direction: 'send' | 'recv'
        transportOptions: Record<string, unknown>
      }
    }
  | { type: 'transport-connected'; payload: { transportId: string } }

function assertProductionUsesWss(url: string): void {
  if (!import.meta.env.PROD) {
    return
  }
  if (!/^wss:\/\//i.test(url.trim())) {
    throw new Error(
      'Production requires wss:// for signaling (ws:// is blocked on HTTPS pages). Set VITE_SIGNALING_URL to a wss:// URL.',
    )
  }
}

/**
 * Normalize path (strip trailing slashes), then if the path is empty or root-only, use `/ws`
 * for nginx-style upstreams. Avoids `//ws` when the env value is `wss://host/`.
 */
function withDefaultSignalingPath(url: string): string {
  try {
    const u = new URL(url)
    while (u.pathname.length > 1 && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1)
    }
    if (u.pathname === '/' || u.pathname === '') {
      u.pathname = '/ws'
    }
    return u.href
  } catch {
    return url
  }
}

function resolveWsUrl(explicit?: string): string {
  let url: string
  if (typeof explicit === 'string' && explicit.trim().length > 0) {
    url = explicit.trim()
  } else {
    const fromEnv = import.meta.env.VITE_SIGNALING_URL
    if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
      url = fromEnv.trim()
    } else if (import.meta.env.DEV) {
      url = 'ws://localhost:3000'
    } else {
      throw new Error(
        'VITE_SIGNALING_URL is not defined. Set it in Vercel or .env.production. Use wss:// for HTTPS.',
      )
    }
  }
  url = withDefaultSignalingPath(url)
  assertProductionUsesWss(url)
  return url
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseRoomPeerList(raw: unknown): RoomPeerInfo[] | null {
  if (!Array.isArray(raw)) {
    return null
  }
  const out: RoomPeerInfo[] = []
  for (const p of raw) {
    if (typeof p === 'string') {
      out.push({
        peerId: p,
        displayName: `Guest ${p.length > 6 ? p.slice(-6) : p}`,
      })
      continue
    }
    if (p && typeof p === 'object') {
      const o = p as { peerId?: unknown; displayName?: unknown }
      if (typeof o.peerId === 'string') {
        const dn =
          typeof o.displayName === 'string' && o.displayName.trim().length > 0
            ? o.displayName.trim().slice(0, 64)
            : `Guest ${o.peerId.length > 6 ? o.peerId.slice(-6) : o.peerId}`
        out.push({ peerId: o.peerId, displayName: dn })
      }
    }
  }
  return out
}

function parseServerMessage(data: unknown): ServerMessage | null {
  if (!isRecord(data) || typeof data.type !== 'string') {
    return null
  }
  const payload = data.payload

  if (data.type === 'room-state' && isRecord(payload) && Array.isArray(payload.peers)) {
    const peerList = parseRoomPeerList(payload.peers)
    if (!peerList) {
      return null
    }
    const caps = payload.routerRtpCapabilities
    if (caps === undefined || caps === null || typeof caps !== 'object') {
      return null
    }
    const existingProducers: RemoteProducerInfo[] = []
    const rawExisting = payload.existingProducers
    if (Array.isArray(rawExisting)) {
      for (const row of rawExisting) {
        if (!row || typeof row !== 'object') {
          continue
        }
        const r = row as { producerId?: unknown; peerId?: unknown; kind?: unknown }
        if (
          typeof r.producerId === 'string' &&
          typeof r.peerId === 'string' &&
          (r.kind === 'audio' || r.kind === 'video')
        ) {
          existingProducers.push({
            producerId: r.producerId,
            peerId: r.peerId,
            kind: r.kind,
          })
        }
      }
    }
    return {
      type: 'room-state',
      payload: {
        peers: peerList,
        routerRtpCapabilities: caps as RtpCapabilities,
        existingProducers,
      },
    }
  }

  if (data.type === 'peer-joined' && isRecord(payload) && typeof payload.peerId === 'string') {
    const displayName =
      typeof payload.displayName === 'string' && payload.displayName.trim().length > 0
        ? payload.displayName.trim().slice(0, 64)
        : `Guest ${payload.peerId.length > 6 ? payload.peerId.slice(-6) : payload.peerId}`
    return { type: 'peer-joined', payload: { peerId: payload.peerId, displayName } }
  }

  if (
    data.type === 'peer-display-name' &&
    isRecord(payload) &&
    typeof payload.peerId === 'string' &&
    typeof payload.displayName === 'string' &&
    payload.displayName.trim().length > 0
  ) {
    return {
      type: 'peer-display-name',
      payload: {
        peerId: payload.peerId,
        displayName: payload.displayName.trim().slice(0, 64),
      },
    }
  }

  if (
    data.type === 'peer-left' &&
    isRecord(payload) &&
    typeof payload.peerId === 'string'
  ) {
    return { type: 'peer-left', payload: { peerId: payload.peerId } }
  }

  if (
    data.type === 'transport-created' &&
    isRecord(payload) &&
    (payload.direction === 'send' || payload.direction === 'recv') &&
    isRecord(payload.transportOptions)
  ) {
    return {
      type: 'transport-created',
      payload: {
        direction: payload.direction,
        transportOptions: payload.transportOptions,
      },
    }
  }

  if (
    data.type === 'transport-connected' &&
    isRecord(payload) &&
    typeof payload.transportId === 'string'
  ) {
    return { type: 'transport-connected', payload: { transportId: payload.transportId } }
  }

  return null
}

export type WsStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error'

function tryParseNewProducerNotice(data: unknown): RemoteProducerInfo | null {
  if (!isRecord(data) || data.type !== 'new-producer') {
    return null
  }
  const payload = data.payload
  if (!isRecord(payload)) {
    return null
  }
  const producerId = payload.producerId
  const peerId = payload.peerId
  const kind = payload.kind
  if (
    typeof producerId !== 'string' ||
    typeof peerId !== 'string' ||
    (kind !== 'audio' && kind !== 'video')
  ) {
    return null
  }
  return { producerId, peerId, kind }
}

export function useRoomConnection(wsUrl?: string) {
  const resolvedUrl = resolveWsUrl(wsUrl)
  const peers = ref<string[]>([])
  const lastRoomState = shallowRef<RoomStatePayload | null>(null)
  const wsRef = shallowRef<WebSocket | null>(null)
  const wsStatus = ref<WsStatus>('idle')
  const messageListeners = new Set<(data: unknown) => void>()
  /** Before drainPendingNewProducers(), stash early new-producer (recv listener not ready yet). */
  const pendingNewProducers: RemoteProducerInfo[] = []
  let bufferNewProducers = true

  function addMessageListener(handler: (data: unknown) => void): () => void {
    messageListeners.add(handler)
    return () => {
      messageListeners.delete(handler)
    }
  }

  function notifyMessageListeners(data: unknown): void {
    for (const listener of messageListeners) {
      listener(data)
    }
  }

  function bufferIncomingNewProducer(data: unknown): void {
    if (!bufferNewProducers) {
      return
    }
    const row = tryParseNewProducerNotice(data)
    if (!row) {
      return
    }
    if (pendingNewProducers.some((p) => p.producerId === row.producerId)) {
      return
    }
    pendingNewProducers.push(row)
    if (import.meta.env.DEV) {
      console.log('[ws] buffered new-producer (early)', row)
    }
  }

  function drainPendingNewProducers(): RemoteProducerInfo[] {
    bufferNewProducers = false
    const out = [...pendingNewProducers]
    pendingNewProducers.length = 0
    if (import.meta.env.DEV && out.length > 0) {
      console.log('[ws] drainPendingNewProducers', { count: out.length })
    }
    return out
  }

  function applyServerMessage(message: ServerMessage): void {
    if (message.type === 'room-state') {
      peers.value = message.payload.peers.map((p) => p.peerId)
      lastRoomState.value = {
        peers: [...message.payload.peers],
        routerRtpCapabilities: message.payload.routerRtpCapabilities,
        existingProducers: [...message.payload.existingProducers],
      }
      return
    }
    if (message.type === 'peer-joined') {
      const { peerId, displayName } = message.payload
      if (!peers.value.includes(peerId)) {
        peers.value = [...peers.value, peerId]
      }
      if (lastRoomState.value && !lastRoomState.value.peers.some((p) => p.peerId === peerId)) {
        lastRoomState.value = {
          ...lastRoomState.value,
          peers: [...lastRoomState.value.peers, { peerId, displayName }],
        }
      }
      return
    }
    if (message.type === 'peer-display-name') {
      const { peerId, displayName } = message.payload
      if (!lastRoomState.value) {
        return
      }
      const idx = lastRoomState.value.peers.findIndex((p) => p.peerId === peerId)
      if (idx >= 0) {
        const nextPeers = [...lastRoomState.value.peers]
        nextPeers[idx] = { peerId, displayName }
        lastRoomState.value = { ...lastRoomState.value, peers: nextPeers }
      }
      return
    }
    if (message.type === 'peer-left') {
      const id = message.payload.peerId
      peers.value = peers.value.filter((p) => p !== id)
      if (lastRoomState.value) {
        lastRoomState.value = {
          ...lastRoomState.value,
          peers: lastRoomState.value.peers.filter((p) => p.peerId !== id),
        }
      }
    }
  }

  function detachSocketHandlers(ws: WebSocket): void {
    ws.onopen = null
    ws.onmessage = null
    ws.onerror = null
    ws.onclose = null
  }

  function connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const previous = wsRef.value
      if (previous) {
        detachSocketHandlers(previous)
        previous.close()
        wsRef.value = null
      }
      peers.value = []
      lastRoomState.value = null
      messageListeners.clear()
      pendingNewProducers.length = 0
      bufferNewProducers = true

      wsStatus.value = 'connecting'

      if (import.meta.env.DEV) {
        console.log('[ws] connecting to', resolvedUrl)
      }
      const ws = new WebSocket(resolvedUrl)
      wsRef.value = ws

      ws.onmessage = (ev) => {
        let data: unknown
        try {
          data = JSON.parse(String(ev.data))
        } catch {
          return
        }
        bufferIncomingNewProducer(data)
        notifyMessageListeners(data)
        const structured = parseServerMessage(data)
        if (structured) {
          applyServerMessage(structured)
        }
      }

      ws.onopen = () => {
        if (wsRef.value !== ws) {
          return
        }
        wsStatus.value = 'open'
        resolve()
      }

      ws.onerror = () => {
        if (wsRef.value === ws) {
          wsStatus.value = 'error'
          detachSocketHandlers(ws)
          wsRef.value = null
        }
        messageListeners.clear()
        pendingNewProducers.length = 0
        bufferNewProducers = true
        reject(new Error('WebSocket connection failed'))
      }

      ws.onclose = () => {
        if (wsRef.value === ws) {
          wsRef.value = null
          wsStatus.value = 'closed'
        }
        messageListeners.clear()
        pendingNewProducers.length = 0
        bufferNewProducers = true
      }
    })
  }

  function sendJson(obj: object): void {
    const ws = wsRef.value
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open')
    }
    ws.send(JSON.stringify(obj))
  }

  function joinRoom(roomId: string, peerId: string, displayName?: string): void {
    const ws = wsRef.value
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open; await connect() before joinRoom()')
    }
    const trimmed = displayName?.trim()
    const payload: { roomId: string; peerId: string; displayName?: string } = { roomId, peerId }
    if (trimmed && trimmed.length > 0) {
      payload.displayName = trimmed.slice(0, 64)
    }
    ws.send(JSON.stringify({ type: 'join-room', payload }))
  }

  function sendUpdateDisplayName(displayName: string): void {
    const ws = wsRef.value
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return
    }
    const t = displayName.trim().slice(0, 64)
    if (!t) {
      return
    }
    ws.send(JSON.stringify({ type: 'update-display-name', payload: { displayName: t } }))
  }

  function disconnect(): void {
    const ws = wsRef.value
    if (ws) {
      detachSocketHandlers(ws)
      ws.close()
    }
    wsRef.value = null
    wsStatus.value = 'closed'
    peers.value = []
    lastRoomState.value = null
    messageListeners.clear()
    pendingNewProducers.length = 0
    bufferNewProducers = true
  }

  onUnmounted(() => {
    disconnect()
  })

  return {
    peers,
    lastRoomState,
    wsRef,
    wsStatus,
    connect,
    joinRoom,
    sendUpdateDisplayName,
    disconnect,
    sendJson,
    addMessageListener,
    drainPendingNewProducers,
  }
}
