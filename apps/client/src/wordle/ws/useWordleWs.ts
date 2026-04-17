import { nextTick, ref, shallowRef, watch, type Ref, type ShallowRef, type WatchSource } from 'vue'
import { sameOriginApiPrefix } from '@/utils/apiUrl'
import type { Feedback } from '../wordleLogic'
import type { WordleStreamerCard } from '@/composables/useWordleStreamerRoom'
import {
  WordleWs,
  type WordleChatLine,
  type WordleGameStatePayload,
  type WordleIrcRelayState,
  type WordleLeaderboardEntry,
  type WordleStreamSessionUser,
  type WordleWsConnectionState,
} from './wordleWsTypes'
import { replyJsonPingIfNeeded } from 'call-core'

type WordleWsClientLogger = ReturnType<(typeof import('@/utils/logger'))['createLogger']>

export function useWordleWs(options: {
  streamerProfile: ShallowRef<WordleStreamerCard | null>
  lastError: Ref<string | null>
  wordleTabPeerId: string
  log: WordleWsClientLogger
  onNewGame: () => void
  afterChatLineAppended: () => void
  isAuthenticated: WatchSource<boolean>
}): {
  gameState: ShallowRef<WordleGameStatePayload | null>
  leaderboard: Ref<WordleLeaderboardEntry[]>
  chatLines: Ref<WordleChatLine[]>
  sessionUser: ShallowRef<WordleStreamSessionUser | null>
  wsStatus: Ref<WordleWsConnectionState>
  ircRelayStatus: Ref<WordleIrcRelayState>
  connectWs: () => void
  prepareWordleWsMount: () => void
  disposeWordleWs: () => void
} {
  const { streamerProfile, lastError, wordleTabPeerId, log, onNewGame, afterChatLineAppended, isAuthenticated } =
    options

  const gameState = shallowRef<WordleGameStatePayload | null>(null)
  const leaderboard = ref<WordleLeaderboardEntry[]>([])
  const chatLines = ref<WordleChatLine[]>([])
  const sessionUser = shallowRef<WordleStreamSessionUser | null>(null)
  const wsStatus = ref<WordleWsConnectionState>('idle')
  const ircRelayStatus = ref<WordleIrcRelayState>('idle')

  let ws: WebSocket | null = null
  let wordleWsDisposed = false
  let wordleWsReconnectTimer: ReturnType<typeof setTimeout> | null = null
  /** Resets on successful `open`; incremented when scheduling reconnect after close. */
  let wordleWsReconnectAttempt = 0
  const WORDLE_WS_RECONNECT_BASE_MS = 1000
  const WORDLE_WS_RECONNECT_CAP_MS = 30_000
  const WORDLE_WS_RECONNECT_JITTER_MS = 250

  let chatLineUid = 0

  function clearWordleWsReconnect(): void {
    if (wordleWsReconnectTimer !== null) {
      clearTimeout(wordleWsReconnectTimer)
      wordleWsReconnectTimer = null
    }
  }

  function scheduleWordleWsReconnect(): void {
    clearWordleWsReconnect()
    if (wordleWsDisposed) {
      return
    }
    const attempt = wordleWsReconnectAttempt
    const exp = Math.min(WORDLE_WS_RECONNECT_CAP_MS, WORDLE_WS_RECONNECT_BASE_MS * 2 ** attempt)
    const jitter = Math.floor(Math.random() * WORDLE_WS_RECONNECT_JITTER_MS)
    const delay = exp + jitter
    wordleWsReconnectAttempt = Math.min(attempt + 1, 16)
    wordleWsReconnectTimer = setTimeout(() => {
      wordleWsReconnectTimer = null
      if (wordleWsDisposed) {
        return
      }
      log.warn('disconnected, reconnecting...', { attempt, delayMs: delay })
      connectWs()
    }, delay)
  }

  function wordleWsUrl(streamerId: string): string {
    const env = import.meta.env.VITE_WORDLE_WS_URL as string | undefined
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    if (typeof env === 'string' && env.trim().length > 0) {
      const u = new URL(env.trim())
      u.searchParams.set('streamerId', streamerId)
      u.searchParams.set('peerId', wordleTabPeerId)
      u.protocol = proto
      return u.toString()
    }
    const prefix = sameOriginApiPrefix()
    if (prefix.startsWith('http://') || prefix.startsWith('https://')) {
      const u = new URL('/wordle-ws', prefix.endsWith('/') ? prefix : `${prefix}/`)
      u.protocol = proto
      u.searchParams.set('streamerId', streamerId)
      u.searchParams.set('peerId', wordleTabPeerId)
      return u.toString()
    }
    const path = prefix ? `${prefix}/wordle-ws` : '/wordle-ws'
    const q = new URLSearchParams({ streamerId, peerId: wordleTabPeerId }).toString()
    return `${proto}//${location.host}${path}?${q}`
  }

  function connectWs(): void {
    const streamerId = streamerProfile.value?.id
    if (!streamerId || wordleWsDisposed) {
      return
    }
    clearWordleWsReconnect()
    const prev = ws
    if (prev) {
      prev.onopen = null
      prev.onmessage = null
      prev.onerror = null
      prev.onclose = null
      prev.close()
      ws = null
    }
    wsStatus.value = 'idle'
    const url = wordleWsUrl(streamerId)
    const socket = new WebSocket(url)
    ws = socket

    socket.onopen = () => {
      if (ws !== socket) {
        return
      }
      wordleWsReconnectAttempt = 0
      log.info('connected')
      wsStatus.value = 'open'
    }

    socket.onclose = () => {
      log.info('closed')
      if (ws === socket) {
        ws = null
        wsStatus.value = 'closed'
      }
      if (!wordleWsDisposed) {
        scheduleWordleWsReconnect()
      }
    }

    socket.onerror = () => {
      if (ws === socket) {
        wsStatus.value = 'error'
      }
    }

    socket.onmessage = (ev) => {
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
      if (t === WordleWs.state && p && typeof p === 'object') {
        gameState.value = p as WordleGameStatePayload
      } else if (t === WordleWs.leaderboard && p && typeof p === 'object') {
        const entries = (p as { entries?: WordleLeaderboardEntry[] }).entries
        if (Array.isArray(entries)) {
          leaderboard.value = entries
        }
      } else if (t === WordleWs.newGame) {
        onNewGame()
      } else if (t === WordleWs.session && p && typeof p === 'object') {
        const o = p as { user?: WordleStreamSessionUser | null }
        sessionUser.value = o.user ?? null
      } else if (t === WordleWs.twitchChat && p && typeof p === 'object') {
        const raw = p as Omit<WordleChatLine, '_cid'> & { guessFeedback?: Feedback[] }
        const line: WordleChatLine = {
          ...raw,
          _cid: ++chatLineUid,
        }
        chatLines.value = [...chatLines.value.slice(-250), line]
        void nextTick(afterChatLineAppended)
      } else if (t === WordleWs.ircStatus && p && typeof p === 'object') {
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
      } else if (t === WordleWs.error && p && typeof p === 'object') {
        const msg = (p as { message?: string }).message
        lastError.value = typeof msg === 'string' ? msg : 'Error'
      } else if (t === WordleWs.guessRejected) {
        lastError.value = 'Guess not accepted (wrong length, solved, or max attempts)'
      }
    }
  }

  watch(
    () => streamerProfile.value?.id,
    (id, prev) => {
      if (prev !== undefined && id !== prev) {
        chatLines.value = []
        ircRelayStatus.value = 'idle'
      }
    },
  )

  watch(isAuthenticated, (auth) => {
    if (!auth) {
      sessionUser.value = null
    }
    connectWs()
  })

  function prepareWordleWsMount(): void {
    wordleWsDisposed = false
    wordleWsReconnectAttempt = 0
  }

  function disposeWordleWs(): void {
    wordleWsDisposed = true
    clearWordleWsReconnect()
    const s = ws
    if (s) {
      s.onopen = null
      s.onmessage = null
      s.onerror = null
      s.onclose = null
      s.close()
    }
    ws = null
  }

  return {
    gameState,
    leaderboard,
    chatLines,
    sessionUser,
    wsStatus,
    ircRelayStatus,
    connectWs,
    prepareWordleWsMount,
    disposeWordleWs,
  }
}
