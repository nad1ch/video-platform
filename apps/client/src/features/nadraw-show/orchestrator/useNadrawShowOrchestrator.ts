import { createLogger } from '@/utils/logger'
import { apiUrl } from '@/utils/apiUrl'
import { readJsonIfOk } from '@/utils/apiFetch'
import {
  computed,
  onUnmounted,
  ref,
  shallowRef,
  watch,
  type ComputedRef,
  type Ref,
  type ShallowRef,
} from 'vue'
import { replyJsonPingIfNeeded } from 'call-core'
import type { RouteLocationNormalizedLoaded } from 'vue-router'
import { buildNadrawShowWsUrl } from '../url/nadrawWsUrl'
import type {
  NadrawChatLine,
  NadrawGuessFeedbackPayload,
  NadrawStatePayload,
} from '../core/nadrawTypes'
import { useNadrawAccess } from '../access/useNadrawAccess'
import type { NadleStreamerCard } from '@/composables/useNadleStreamerRoom'
import { useI18n } from 'vue-i18n'

const log = createLogger('nadraw-show:orch')

const WS = {
  state: 'nadraw:state',
  session: 'nadraw:session',
  twitchChat: 'nadraw:twitch-chat',
  guessFeedback: 'nadraw:guess-feedback',
  draw: 'nadraw:draw',
  canvasClear: 'nadraw:canvas-clear',
  error: 'nadraw:error',
  hostStartRound: 'nadraw:host-start-round',
  hostAckNextRound: 'nadraw:host-ack-next-round',
  hostClearRound: 'nadraw:host-clear-round',
  hostClearCanvas: 'nadraw:host-clear-canvas',
  hostDraw: 'nadraw:host-draw',
} as const

export type NadrawPromptRow = {
  id: string
  text: string
  source?: string
  createdBy: string | null
  approved: boolean
  usageCount: number
  createdAt: string
}

export type NadrawDrawOp = 'stroke' | 'fill' | 'rect' | 'ellipse'

export type NadrawDrawToolMeta = {
  color: string
  lineWidth: number
  erase: boolean
  /** Defaults to stroke (freehand). */
  op?: NadrawDrawOp
  /** Second corner normalized 0–1 (shapes, `phase === 'end'`). */
  x2?: number
  y2?: number
}

export type RemoteDrawPayload = {
  phase: 'start' | 'move' | 'end'
  strokeId: string
  x: number
  y: number
  color?: string
  lineWidth?: number
  /** When true, receivers use globalCompositeOperation destination-out. */
  erase?: boolean
  op?: NadrawDrawOp
  x2?: number
  y2?: number
}

function randomPeerId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `nadraw-${Date.now()}-${Math.random().toString(16).slice(2)}`
  }
}

export function useNadrawShowOrchestrator(options: {
  route: RouteLocationNormalizedLoaded
  streamerProfile: ShallowRef<NadleStreamerCard | null>
  authLoaded: ComputedRef<boolean>
  isAuthenticated: ComputedRef<boolean>
}): {
  nadrawState: ShallowRef<NadrawStatePayload | null>
  sessionCanControl: ReturnType<typeof ref<boolean>>
  chatLines: ReturnType<typeof ref<NadrawChatLine[]>>
  lastWsError: ReturnType<typeof ref<string | null>>
  wsStatus: ReturnType<typeof ref<'idle' | 'open' | 'reconnecting'>>
  /** Server JSON `{ type: 'ping' }` timestamps — for link health UI and stale reconnect. */
  lastServerPingAt: Ref<number | null>
  wsLinkDot: ComputedRef<'connected' | 'reconnecting' | 'offline'>
  prompts: ReturnType<typeof ref<NadrawPromptRow[]>>
  promptsLoading: ReturnType<typeof ref<boolean>>
  nowTick: ReturnType<typeof ref<number>>
  showHostChrome: ComputedRef<boolean>
  connectWs: () => void
  disposeWs: () => void
  startRound: (
    wordSource: 'random' | 'db' | 'manual',
    manualWord?: string,
    roundDurationSec?: number,
    roundsPlanned?: number,
  ) => void
  clearRound: () => void
  /** Broadcast canvas wipe to all viewers; round timer and word stay active. */
  clearCanvasOnly: () => void
  ackNextRound: (word?: string) => void
  sendDrawStart: (strokeId: string, x: number, y: number, meta?: NadrawDrawToolMeta) => void
  sendDrawMove: (strokeId: string, x: number, y: number, meta?: NadrawDrawToolMeta) => void
  sendDrawEnd: (strokeId: string, x: number, y: number, meta?: NadrawDrawToolMeta) => void
  onCanvasClear: (fn: () => void) => void
  onRemoteDraw: (fn: (p: RemoteDrawPayload) => void) => void
  loadPrompts: () => Promise<void>
  approvePrompt: (id: string, approved: boolean) => Promise<void>
  deletePrompt: (id: string) => Promise<void>
  effectiveSlug: ComputedRef<string | null>
} {
  const { route, streamerProfile, authLoaded, isAuthenticated } = options
  const { t } = useI18n()

  const peerId = randomPeerId()
  const nadrawState = shallowRef<NadrawStatePayload | null>(null)
  const sessionCanControl = ref(false)
  const chatLines = ref<NadrawChatLine[]>([])
  const lastWsError = ref<string | null>(null)
  const wsStatus = ref<'idle' | 'open' | 'reconnecting'>('idle')
  const lastServerPingAt = ref<number | null>(null)
  const prompts = ref<NadrawPromptRow[]>([])
  const promptsLoading = ref(false)
  const nowTick = ref(Date.now())

  let ws: WebSocket | null = null
  /** Streamer id the current socket was opened for (avoids duplicate connects + detects slug changes). */
  let wsTargetStreamerId: string | null = null
  let disposed = false
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  /** Increments on each scheduled reconnect; reset when the socket opens. */
  let reconnectAttempt = 0
  let loggedWsErrorThisSocket = false
  let lockTickTimer: ReturnType<typeof setInterval> | null = null
  let pingWatchTimer: ReturnType<typeof setInterval> | null = null
  const PING_STALE_MS = 60_000
  const PING_WATCH_MS = 5_000
  let lineUid = 0
  let onCanvasClearHook: (() => void) | null = null
  let onRemoteDrawHook: ((p: RemoteDrawPayload) => void) | null = null

  const effectiveSlug = computed(() => {
    const p = route.params.streamer
    const s = typeof p === 'string' ? p : Array.isArray(p) ? p[0] : ''
    const t = String(s ?? '').trim().toLowerCase()
    return t.length > 0 ? t : null
  })

  const { showHostChrome } = useNadrawAccess({
    sessionCanControl,
    authLoaded,
    isAuthenticated,
  })

  const wsLinkDot = computed((): 'connected' | 'reconnecting' | 'offline' => {
    if (wsStatus.value === 'reconnecting') {
      return 'reconnecting'
    }
    if (wsStatus.value !== 'open') {
      return 'offline'
    }
    const t = lastServerPingAt.value
    if (t == null) {
      return 'connected'
    }
    if (Date.now() - t > PING_STALE_MS) {
      return 'reconnecting'
    }
    return 'connected'
  })

  function stopPingWatch(): void {
    if (pingWatchTimer) {
      clearInterval(pingWatchTimer)
      pingWatchTimer = null
    }
  }

  function startPingWatch(socket: WebSocket): void {
    stopPingWatch()
    lastServerPingAt.value = Date.now()
    pingWatchTimer = setInterval(() => {
      if (disposed || !ws || ws !== socket || ws.readyState !== WebSocket.OPEN) {
        return
      }
      const t = lastServerPingAt.value
      if (t != null && Date.now() - t > PING_STALE_MS) {
        log.warn('[nadraw-ws] server ping stale; closing to reconnect')
        try {
          socket.close()
        } catch {
          /* ignore */
        }
      }
    }, PING_WATCH_MS)
  }

  function pushLine(line: Omit<NadrawChatLine, 'id'> & { id?: string }): void {
    lineUid += 1
    chatLines.value = [
      ...chatLines.value.slice(-400),
      { id: line.id ?? `L${lineUid}`, userId: line.userId, displayName: line.displayName, text: line.text, system: line.system },
    ]
  }

  function appendFeedback(f: NadrawGuessFeedbackPayload): void {
    let msg = ''
    if (f.kind === 'rate_limit') {
      msg = t('nadrawShow.feedbackRateLimit')
    } else if (f.kind === 'guess_locked') {
      msg = t('nadrawShow.feedbackGuessLocked')
    } else if (f.kind === 'win') {
      msg = t('nadrawShow.feedbackWin', { name: f.displayName })
    } else if (f.kind === 'wrong') {
      msg = t('nadrawShow.feedbackWrong')
    } else if (f.kind === 'heat') {
      const h = f.heat ?? 'cold'
      msg = t('nadrawShow.feedbackHeat', { name: f.displayName, text: f.text, heat: h })
    }
    if (msg) {
      pushLine({ userId: f.userId, displayName: f.displayName, text: msg, system: true })
    }
  }

  function clearReconnect(): void {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  const MAX_RECONNECT_MS = 10_000
  const BASE_RECONNECT_MS = 800

  function nextReconnectDelayMs(): number {
    const exp = BASE_RECONNECT_MS * Math.pow(2, reconnectAttempt)
    return Math.min(MAX_RECONNECT_MS, exp)
  }

  function scheduleReconnect(): void {
    clearReconnect()
    if (disposed) {
      return
    }
    wsStatus.value = 'reconnecting'
    const delay = nextReconnectDelayMs()
    reconnectAttempt += 1
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connectWs(true)
    }, delay)
  }

  /** Tear down the socket without triggering reconnect (intentional replace or logout). */
  function silentCloseWs(): void {
    stopPingWatch()
    if (!ws) {
      wsTargetStreamerId = null
      return
    }
    const s = ws
    ws = null
    wsTargetStreamerId = null
    s.onopen = null
    s.onmessage = null
    s.onerror = null
    s.onclose = null
    try {
      s.close()
    } catch {
      /* ignore */
    }
  }

  function disposeWs(): void {
    disposed = true
    clearReconnect()
    reconnectAttempt = 0
    if (lockTickTimer) {
      clearInterval(lockTickTimer)
      lockTickTimer = null
    }
    stopPingWatch()
    lastServerPingAt.value = null
    silentCloseWs()
    wsStatus.value = 'idle'
  }

  /** @param fromScheduledReconnect when true, keep exponential backoff counter across attempts */
  function connectWs(fromScheduledReconnect = false): void {
    const id = streamerProfile.value?.id
    if (!id || disposed) {
      return
    }
    if (ws && ws.readyState === WebSocket.OPEN && wsTargetStreamerId === id) {
      return
    }
    if (ws && ws.readyState === WebSocket.CONNECTING && wsTargetStreamerId === id) {
      return
    }
    if (!fromScheduledReconnect) {
      reconnectAttempt = 0
    }
    clearReconnect()
    silentCloseWs()
    const url = buildNadrawShowWsUrl(id, peerId)
    log.info('[nadraw-ws] connecting', { url })
    loggedWsErrorThisSocket = false
    const s = new WebSocket(url)
    ws = s
    wsTargetStreamerId = id
    wsStatus.value = 'reconnecting'

    s.onopen = () => {
      if (disposed) {
        return
      }
      reconnectAttempt = 0
      wsStatus.value = 'open'
      lastWsError.value = null
      startPingWatch(s)
    }

    s.onmessage = (ev) => {
      if (disposed) {
        return
      }
      let data: unknown
      try {
        data = JSON.parse(String(ev.data))
      } catch {
        return
      }
      if (data && typeof data === 'object' && (data as { type?: unknown }).type === 'ping') {
        lastServerPingAt.value = Date.now()
      }
      if (replyJsonPingIfNeeded(data, s)) {
        return
      }
      if (!data || typeof data !== 'object') {
        return
      }
      const o = data as { type?: string; payload?: unknown }
      if (o.type === WS.state && o.payload && typeof o.payload === 'object') {
        nadrawState.value = o.payload as NadrawStatePayload
        return
      }
      if (o.type === WS.session && o.payload && typeof o.payload === 'object') {
        const p = o.payload as { canControl?: boolean }
        sessionCanControl.value = p.canControl === true
        return
      }
      if (o.type === WS.twitchChat && o.payload && typeof o.payload === 'object') {
        const p = o.payload as { userId: string; displayName: string; text: string }
        pushLine({ userId: p.userId, displayName: p.displayName, text: p.text })
        return
      }
      if (o.type === WS.guessFeedback && o.payload && typeof o.payload === 'object') {
        appendFeedback(o.payload as NadrawGuessFeedbackPayload)
        return
      }
      if (o.type === WS.canvasClear) {
        onCanvasClearHook?.()
        return
      }
      if (o.type === WS.draw && o.payload && typeof o.payload === 'object') {
        onRemoteDrawHook?.(o.payload as RemoteDrawPayload)
        return
      }
      if (o.type === WS.error && o.payload && typeof o.payload === 'object') {
        const p = o.payload as { message?: string }
        lastWsError.value = typeof p.message === 'string' ? p.message : 'Server error'
      }
    }

    s.onerror = () => {
      if (disposed) {
        return
      }
      if (!loggedWsErrorThisSocket) {
        loggedWsErrorThisSocket = true
        log.warn('nadraw ws connection error', { streamerId: id.slice(0, 8) })
      }
      lastWsError.value = 'WebSocket error'
    }

    s.onclose = () => {
      if (disposed) {
        return
      }
      if (ws !== s) {
        return
      }
      stopPingWatch()
      ws = null
      wsTargetStreamerId = null
      scheduleReconnect()
    }
  }

  function startRound(
    wordSource: 'random' | 'db' | 'manual',
    manualWord?: string,
    roundDurationSec?: number,
    roundsPlanned?: number,
  ): void {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return
    }
    const payload: Record<string, unknown> = {
      type: WS.hostStartRound,
      wordSource,
    }
    if (typeof manualWord === 'string' && manualWord.length > 0) {
      payload.manualWord = manualWord
    }
    if (typeof roundDurationSec === 'number' && Number.isFinite(roundDurationSec)) {
      payload.roundDurationSec = roundDurationSec
    }
    if (typeof roundsPlanned === 'number' && Number.isFinite(roundsPlanned)) {
      payload.roundsPlanned = roundsPlanned
    }
    ws.send(JSON.stringify(payload))
  }

  function clearRound(): void {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return
    }
    ws.send(JSON.stringify({ type: WS.hostClearRound }))
  }

  function clearCanvasOnly(): void {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return
    }
    ws.send(JSON.stringify({ type: WS.hostClearCanvas }))
  }

  function ackNextRound(word?: string): void {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return
    }
    const payload: Record<string, unknown> = {
      type: WS.hostAckNextRound,
    }
    if (typeof word === 'string' && word.length > 0) {
      payload.word = word
    }
    ws.send(JSON.stringify(payload))
  }

  function drawPayload(
    phase: 'start' | 'move' | 'end',
    strokeId: string,
    x: number,
    y: number,
    meta?: NadrawDrawToolMeta,
  ): Record<string, unknown> {
    const m = meta ?? { color: '#111827', lineWidth: 3, erase: false }
    const base: Record<string, unknown> = {
      type: WS.hostDraw,
      phase,
      strokeId,
      x,
      y,
      lineWidth: m.lineWidth,
      erase: m.erase === true,
    }
    if (!m.erase && typeof m.color === 'string') {
      base.color = m.color
    }
    if (m.op != null && m.op !== 'stroke') {
      base.op = m.op
    }
    if (typeof m.x2 === 'number' && Number.isFinite(m.x2)) {
      base.x2 = m.x2
    }
    if (typeof m.y2 === 'number' && Number.isFinite(m.y2)) {
      base.y2 = m.y2
    }
    return base
  }

  function sendDrawStart(strokeId: string, x: number, y: number, meta?: NadrawDrawToolMeta): void {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return
    }
    ws.send(JSON.stringify(drawPayload('start', strokeId, x, y, meta)))
  }

  function sendDrawMove(strokeId: string, x: number, y: number, meta?: NadrawDrawToolMeta): void {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return
    }
    ws.send(JSON.stringify(drawPayload('move', strokeId, x, y, meta)))
  }

  function sendDrawEnd(strokeId: string, x: number, y: number, meta?: NadrawDrawToolMeta): void {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return
    }
    ws.send(JSON.stringify(drawPayload('end', strokeId, x, y, meta)))
  }

  function onCanvasClear(fn: () => void): void {
    onCanvasClearHook = fn
  }

  function onRemoteDraw(fn: (p: RemoteDrawPayload) => void): void {
    onRemoteDrawHook = fn
  }

  async function loadPrompts(): Promise<void> {
    const sid = streamerProfile.value?.id
    if (!sid || !sessionCanControl.value) {
      prompts.value = []
      return
    }
    promptsLoading.value = true
    try {
      const res = await fetch(apiUrl(`/api/nadraw-show/prompts?streamerId=${encodeURIComponent(sid)}`), {
        credentials: 'include',
      })
      if (!res.ok) {
        prompts.value = []
        return
      }
      const body = await readJsonIfOk<{ prompts: NadrawPromptRow[] }>(res)
      prompts.value = body?.prompts ?? []
    } catch {
      prompts.value = []
    } finally {
      promptsLoading.value = false
    }
  }

  async function approvePrompt(id: string, approved: boolean): Promise<void> {
    const sid = streamerProfile.value?.id
    if (!sid) {
      return
    }
    try {
      const res = await fetch(apiUrl(`/api/nadraw-show/prompts/${encodeURIComponent(id)}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ streamerId: sid, approved }),
      })
      if (res.ok) {
        await loadPrompts()
      }
    } catch {
      /* ignore */
    }
  }

  async function deletePrompt(id: string): Promise<void> {
    const sid = streamerProfile.value?.id
    if (!sid) {
      return
    }
    try {
      const res = await fetch(
        apiUrl(
          `/api/nadraw-show/prompts/${encodeURIComponent(id)}?streamerId=${encodeURIComponent(sid)}`,
        ),
        { method: 'DELETE', credentials: 'include' },
      )
      if (res.ok || res.status === 204) {
        await loadPrompts()
      }
    } catch {
      /* ignore */
    }
  }

  watch(
    () => nadrawState.value?.phase,
    (ph) => {
      if (lockTickTimer) {
        clearInterval(lockTickTimer)
        lockTickTimer = null
      }
      if (ph === 'drawing_locked' || ph === 'drawing_active') {
        nowTick.value = Date.now()
        lockTickTimer = setInterval(() => {
          nowTick.value = Date.now()
        }, 1000)
      }
    },
  )

  watch(
    [streamerProfile, authLoaded],
    () => {
      if (!streamerProfile.value || !authLoaded.value) {
        clearReconnect()
        reconnectAttempt = 0
        stopPingWatch()
        lastServerPingAt.value = null
        silentCloseWs()
        wsStatus.value = 'idle'
        return
      }
      disposed = false
      connectWs()
    },
    { immediate: true },
  )

  watch(showHostChrome, (v) => {
    if (v) {
      void loadPrompts()
    }
  })

  onUnmounted(() => {
    disposeWs()
  })

  return {
    nadrawState,
    sessionCanControl,
    chatLines,
    lastWsError,
    wsStatus,
    lastServerPingAt,
    wsLinkDot,
    prompts,
    promptsLoading,
    nowTick,
    showHostChrome,
    connectWs,
    disposeWs,
    startRound,
    clearRound,
    clearCanvasOnly,
    ackNextRound,
    sendDrawStart,
    sendDrawMove,
    sendDrawEnd,
    onCanvasClear,
    onRemoteDraw,
    loadPrompts,
    approvePrompt,
    deletePrompt,
    effectiveSlug,
  }
}

