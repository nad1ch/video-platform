/// <reference types="vite/client" />

import type { RtpCapabilities } from 'mediasoup-client/types'
import { onUnmounted, ref, shallowRef } from 'vue'

export type RoomStatePayload = {
  peers: string[]
  routerRtpCapabilities: RtpCapabilities
}

type ServerMessage =
  | { type: 'room-state'; payload: RoomStatePayload }
  | { type: 'peer-joined'; payload: { peerId: string } }
  | { type: 'peer-left'; payload: { peerId: string } }
  | {
      type: 'transport-created'
      payload: {
        direction: 'send' | 'recv'
        transportOptions: Record<string, unknown>
      }
    }
  | { type: 'transport-connected'; payload: { transportId: string } }

function resolveWsUrl(explicit?: string): string {
  if (typeof explicit === 'string' && explicit.length > 0) {
    return explicit
  }
  const fromEnv = import.meta.env.VITE_SIGNALING_URL
  return typeof fromEnv === 'string' && fromEnv.length > 0 ? fromEnv : 'ws://localhost:3000'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseServerMessage(data: unknown): ServerMessage | null {
  if (!isRecord(data) || typeof data.type !== 'string') {
    return null
  }
  const payload = data.payload

  if (data.type === 'room-state' && isRecord(payload) && Array.isArray(payload.peers)) {
    const peers = payload.peers
    if (!peers.every((p) => typeof p === 'string')) {
      return null
    }
    const caps = payload.routerRtpCapabilities
    if (caps === undefined || caps === null || typeof caps !== 'object') {
      return null
    }
    return {
      type: 'room-state',
      payload: {
        peers: peers as string[],
        routerRtpCapabilities: caps as RtpCapabilities,
      },
    }
  }

  if (
    data.type === 'peer-joined' &&
    isRecord(payload) &&
    typeof payload.peerId === 'string'
  ) {
    return { type: 'peer-joined', payload: { peerId: payload.peerId } }
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

export function useRoomConnection(wsUrl?: string) {
  const resolvedUrl = resolveWsUrl(wsUrl)
  const peers = ref<string[]>([])
  const lastRoomState = shallowRef<RoomStatePayload | null>(null)
  const wsRef = shallowRef<WebSocket | null>(null)
  const messageListeners = new Set<(data: unknown) => void>()

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

  function applyServerMessage(message: ServerMessage): void {
    if (message.type === 'room-state') {
      peers.value = [...message.payload.peers]
      lastRoomState.value = {
        peers: message.payload.peers,
        routerRtpCapabilities: message.payload.routerRtpCapabilities,
      }
      return
    }
    if (message.type === 'peer-joined') {
      const id = message.payload.peerId
      if (!peers.value.includes(id)) {
        peers.value = [...peers.value, id]
      }
      return
    }
    if (message.type === 'peer-left') {
      const id = message.payload.peerId
      peers.value = peers.value.filter((p) => p !== id)
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

      const ws = new WebSocket(resolvedUrl)
      wsRef.value = ws

      ws.onmessage = (ev) => {
        let data: unknown
        try {
          data = JSON.parse(String(ev.data))
        } catch {
          return
        }
        notifyMessageListeners(data)
        const structured = parseServerMessage(data)
        if (structured) {
          applyServerMessage(structured)
        }
      }

      ws.onopen = () => resolve()

      ws.onerror = () => {
        if (wsRef.value === ws) {
          detachSocketHandlers(ws)
          wsRef.value = null
        }
        messageListeners.clear()
        reject(new Error('WebSocket connection failed'))
      }

      ws.onclose = () => {
        if (wsRef.value === ws) {
          wsRef.value = null
        }
        messageListeners.clear()
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

  function joinRoom(roomId: string, peerId: string): void {
    const ws = wsRef.value
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not open; await connect() before joinRoom()')
    }
    ws.send(JSON.stringify({ type: 'join-room', payload: { roomId, peerId } }))
  }

  function disconnect(): void {
    const ws = wsRef.value
    if (ws) {
      detachSocketHandlers(ws)
      ws.close()
    }
    wsRef.value = null
    peers.value = []
    lastRoomState.value = null
    messageListeners.clear()
  }

  onUnmounted(() => {
    disconnect()
  })

  return {
    peers,
    lastRoomState,
    wsRef,
    connect,
    joinRoom,
    disconnect,
    sendJson,
    addMessageListener,
  }
}
