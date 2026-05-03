import { nextTick, ref, shallowRef, watch, type Ref, type ShallowRef, type WatchSource } from 'vue'
import { sameOriginApiPrefix } from '@/utils/apiUrl'
import type { Feedback, WordLength } from '../nadleLogic'
import type { NadleStreamerCard } from '@/composables/useNadleStreamerRoom'
import {
  NadleWs,
  type NadleChatLine,
  type NadleGameStatePayload,
  type NadleIrcRelayState,
  type NadleLeaderboardEntry,
  type NadleStreamSessionUser,
  type NadleWsConnectionState,
} from './nadleWsTypes'
import { replyJsonPingIfNeeded } from 'call-core/utils'

type NadleWsClientLogger = ReturnType<(typeof import('@/utils/logger'))['createLogger']>

export function useNadleWs(options: {
  streamerProfile: ShallowRef<NadleStreamerCard | null>
  lastError: Ref<string | null>
  nadleTabPeerId: string
  log: NadleWsClientLogger
  onNewGame: () => void
  afterChatLineAppended: () => void
  isAuthenticated: WatchSource<boolean>
}): {
  gameState: ShallowRef<NadleGameStatePayload | null>
  leaderboard: Ref<NadleLeaderboardEntry[]>
  chatLines: Ref<NadleChatLine[]>
  sessionUser: ShallowRef<NadleStreamSessionUser | null>
  sessionIsAdmin: Ref<boolean>
  wsStatus: Ref<NadleWsConnectionState>
  ircRelayStatus: Ref<NadleIrcRelayState>
  connectWs: () => void
  sendGuess: (word: string, gameId?: string) => boolean
  requestNextWord: (wordLength?: WordLength) => boolean
  prepareNadleWsMount: () => void
  disposeNadleWs: () => void
} {
  const { streamerProfile, lastError, nadleTabPeerId, log, onNewGame, afterChatLineAppended, isAuthenticated } =
    options

  const gameState = shallowRef<NadleGameStatePayload | null>(null)
  const leaderboard = ref<NadleLeaderboardEntry[]>([])
  const chatLines = ref<NadleChatLine[]>([])
  const sessionUser = shallowRef<NadleStreamSessionUser | null>(null)
  const sessionIsAdmin = ref(false)
  const wsStatus = ref<NadleWsConnectionState>('idle')
  const ircRelayStatus = ref<NadleIrcRelayState>('idle')

  let ws: WebSocket | null = null
  let wsTargetStreamerId: string | null = null
  let nadleWsDisposed = false
  let nadleWsReconnectTimer: ReturnType<typeof setTimeout> | null = null
  
  let nadleWsReconnectAttempt = 0
  const NADLE_WS_RECONNECT_BASE_MS = 1000
  const NADLE_WS_RECONNECT_CAP_MS = 30_000
  const NADLE_WS_RECONNECT_JITTER_MS = 250

  let chatLineUid = 0

  function clearNadleWsReconnect(): void {
    if (nadleWsReconnectTimer !== null) {
      clearTimeout(nadleWsReconnectTimer)
      nadleWsReconnectTimer = null
    }
  }

  function sendJson(obj: unknown): boolean {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return false
    }
    ws.send(JSON.stringify(obj))
    return true
  }

  function sendGuess(word: string, gameId?: string): boolean {
    return sendJson({ type: NadleWs.clientGuess, word, gameId })
  }

  function requestNextWord(wordLength?: WordLength): boolean {
    return sendJson({ type: NadleWs.clientNextWord, wordLength })
  }

  function scheduleNadleWsReconnect(): void {
    clearNadleWsReconnect()
    if (nadleWsDisposed) {
      return
    }
    const attempt = nadleWsReconnectAttempt
    const exp = Math.min(NADLE_WS_RECONNECT_CAP_MS, NADLE_WS_RECONNECT_BASE_MS * 2 ** attempt)
    const jitter = Math.floor(Math.random() * NADLE_WS_RECONNECT_JITTER_MS)
    const delay = exp + jitter
    nadleWsReconnectAttempt = Math.min(attempt + 1, 16)
    nadleWsReconnectTimer = setTimeout(() => {
      nadleWsReconnectTimer = null
      if (nadleWsDisposed) {
        return
      }
      log.warn('disconnected, reconnecting...', { attempt, delayMs: delay })
      connectWs()
    }, delay)
  }

  function silentCloseNadleWs(): void {
    clearNadleWsReconnect()
    const s = ws
    if (!s) {
      wsTargetStreamerId = null
      return
    }
    s.onopen = null
    s.onmessage = null
    s.onerror = null
    s.onclose = null
    s.close()
    ws = null
    wsTargetStreamerId = null
  }

  function nadleWsUrl(streamerId: string): string {
    const env = import.meta.env.VITE_NADLE_WS_URL as string | undefined
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    if (typeof env === 'string' && env.trim().length > 0) {
      const u = new URL(env.trim())
      u.searchParams.set('streamerId', streamerId)
      u.searchParams.set('peerId', nadleTabPeerId)
      u.protocol = proto
      return u.toString()
    }
    const prefix = sameOriginApiPrefix()
    if (prefix.startsWith('http://') || prefix.startsWith('https://')) {
      const u = new URL('/nadle-ws', prefix.endsWith('/') ? prefix : `${prefix}/`)
      u.protocol = proto
      u.searchParams.set('streamerId', streamerId)
      u.searchParams.set('peerId', nadleTabPeerId)
      return u.toString()
    }
    const path = prefix ? `${prefix}/nadle-ws` : '/nadle-ws'
    const q = new URLSearchParams({ streamerId, peerId: nadleTabPeerId }).toString()
    return `${proto}//${location.host}${path}?${q}`
  }

  function connectWs(): void {
    const streamerId = streamerProfile.value?.id
    if (!streamerId || nadleWsDisposed) {
      return
    }
    if (ws && wsTargetStreamerId === streamerId) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        return
      }
    }
    silentCloseNadleWs()
    wsStatus.value = 'idle'
    const url = nadleWsUrl(streamerId)
    const socket = new WebSocket(url)
    ws = socket
    wsTargetStreamerId = streamerId

    socket.onopen = () => {
      if (nadleWsDisposed || ws !== socket) {
        return
      }
      nadleWsReconnectAttempt = 0
      log.info('connected')
      wsStatus.value = 'open'
    }

    socket.onclose = () => {
      if (nadleWsDisposed || ws !== socket) {
        return
      }
      log.info('closed')
      ws = null
      wsTargetStreamerId = null
      wsStatus.value = 'closed'
      scheduleNadleWsReconnect()
    }

    socket.onerror = () => {
      if (nadleWsDisposed || ws !== socket) {
        return
      }
      wsStatus.value = 'error'
    }

    socket.onmessage = (ev) => {
      if (nadleWsDisposed || ws !== socket) {
        return
      }
      let data: { type?: string; payload?: unknown }
      try {
        data = JSON.parse(String(ev.data))
      } catch {
        return
      }
      if (replyJsonPingIfNeeded(data, socket)) {
        return
      }
      const t = data.type
      const p = data.payload
      if (t === NadleWs.state && p && typeof p === 'object') {
        gameState.value = p as NadleGameStatePayload
      } else if (t === NadleWs.leaderboard && p && typeof p === 'object') {
        const entries = (p as { entries?: NadleLeaderboardEntry[] }).entries
        if (Array.isArray(entries)) {
          leaderboard.value = entries
        }
      } else if (t === NadleWs.newGame) {
        onNewGame()
      } else if (t === NadleWs.session && p && typeof p === 'object') {
        const o = p as { user?: NadleStreamSessionUser | null; isAdmin?: unknown }
        sessionUser.value = o.user ?? null
        sessionIsAdmin.value = o.isAdmin === true
      } else if (t === NadleWs.twitchChat && p && typeof p === 'object') {
        const raw = p as Omit<NadleChatLine, '_cid'> & { guessFeedback?: Feedback[] }
        const line: NadleChatLine = {
          ...raw,
          _cid: ++chatLineUid,
        }
        chatLines.value = [...chatLines.value.slice(-250), line]
        void nextTick(afterChatLineAppended)
      } else if (t === NadleWs.ircStatus && p && typeof p === 'object') {
        const st = (p as { status?: unknown }).status
        if (
          st === 'connected' ||
          st === 'disconnected' ||
          st === 'reconnecting' ||
          st === 'connecting' ||
          st === 'error'
        ) {
          ircRelayStatus.value = st
        }
      } else if (t === NadleWs.error && p && typeof p === 'object') {
        const msg = (p as { message?: string }).message
        lastError.value = typeof msg === 'string' ? msg : 'Error'
      } else if (t === NadleWs.guessRejected) {
        lastError.value = 'Guess not accepted (wrong length, solved, or max attempts)'
      }
    }
  }

  watch(
    [() => streamerProfile.value?.id ?? null, isAuthenticated],
    ([id, auth], oldValue) => {
      const prevId = Array.isArray(oldValue) ? oldValue[0] : undefined
      if (!auth) {
        sessionUser.value = null
      }
      if (prevId !== undefined && id !== prevId) {
        chatLines.value = []
        ircRelayStatus.value = 'idle'
      }
      if (!id) {
        silentCloseNadleWs()
        wsStatus.value = 'idle'
        return
      }
      connectWs()
    },
    { immediate: true },
  )

  function prepareNadleWsMount(): void {
    nadleWsDisposed = false
    nadleWsReconnectAttempt = 0
  }

  function disposeNadleWs(): void {
    nadleWsDisposed = true
    silentCloseNadleWs()
    wsStatus.value = 'idle'
  }

  return {
    gameState,
    leaderboard,
    chatLines,
    sessionUser,
    sessionIsAdmin,
    wsStatus,
    ircRelayStatus,
    connectWs,
    sendGuess,
    requestNextWord,
    prepareNadleWsMount,
    disposeNadleWs,
  }
}
