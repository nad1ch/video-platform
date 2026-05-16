import { computed, onUnmounted, ref, shallowRef, watch, type Ref } from 'vue'
import { efSnapshot } from '@/eat-first/services/eatFirstTransport'
import { createLogger } from '@/utils/logger'

const log = createLogger('eat-first:call-snapshot')

type EatFirstCallDisplay = {
  hostDisplaySeat: number
  playerCount: number
}

type EatFirstSnapshotShape = {
  room?: Record<string, unknown>
  players?: unknown[]
  votes?: unknown[]
  display?: unknown
}

export function useEatFirstCallGameSnapshot(gameId: Ref<string>, isStreamView?: Ref<boolean>) {
  const snapshot = shallowRef<EatFirstSnapshotShape | null>(null)
  const loading = ref(false)
  let pollTimer: ReturnType<typeof setInterval> | null = null

  async function refresh(): Promise<void> {
    const gid = gameId.value.trim()
    if (!gid) {
      snapshot.value = null
      return
    }
    loading.value = true
    try {
      const s = (await efSnapshot(gid)) as unknown
      snapshot.value = s && typeof s === 'object' && !Array.isArray(s) ? (s as EatFirstSnapshotShape) : null
    } catch (e) {
      log.warn('eat first snapshot fetch failed', e)
      snapshot.value = null
    } finally {
      loading.value = false
    }
  }

  function stopPoll(): void {
    if (pollTimer != null) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  function startPollIfEligible(): void {
    if (pollTimer != null) return
    if (isStreamView?.value === true) return
    if (gameId.value.trim().length < 1) return
    pollTimer = setInterval(() => void refresh(), 4000)
  }

  watch(
    () => gameId.value,
    () => {
      stopPoll()
      void refresh()
      // OBS / `mode=view` relies on WS `eat:table-state-sync` replay; skip the 4s REST poll.
      startPollIfEligible()
    },
    { immediate: true },
  )

  if (isStreamView != null) {
    watch(
      () => isStreamView.value,
      (next) => {
        if (next) stopPoll()
        else startPollIfEligible()
      },
    )
  }

  onUnmounted(stopPoll)

  const room = computed((): Record<string, unknown> => {
    const r = snapshot.value?.room
    return r && typeof r === 'object' && !Array.isArray(r) ? r : {}
  })

  const ownerUserId = computed(() => {
    const raw = room.value.ownerUserId
    return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : ''
  })

  const gamePhase = computed(() => String(room.value.gamePhase ?? '').trim() || '—')

  const display = computed((): EatFirstCallDisplay => {
    const d = snapshot.value?.display
    if (d && typeof d === 'object' && !Array.isArray(d)) {
      const o = d as { hostDisplaySeat?: unknown; playerCount?: unknown }
      const hostSeat = Number(o.hostDisplaySeat)
      const playerCount = Number(o.playerCount)
      if (Number.isFinite(hostSeat) && Number.isFinite(playerCount)) {
        return { hostDisplaySeat: hostSeat, playerCount }
      }
    }
    const po = room.value.playerOrder
    if (Array.isArray(po)) {
      const n = po.filter((x) => typeof x === 'string' && String(x).trim().length > 0).length
      return { hostDisplaySeat: n + 1, playerCount: n }
    }
    return { hostDisplaySeat: 1, playerCount: 0 }
  })

  const speakingTimer = computed(() => {
    const t = room.value.speakingTimer
    if (typeof t === 'number' && Number.isFinite(t)) return t
    if (typeof t === 'string' && t.trim() !== '' && Number.isFinite(Number(t))) return Number(t)
    return null
  })

  const timerRoomFields = computed(() => {
    const r = room.value
    const startedAt = typeof r.timerStartedAt === 'string' ? r.timerStartedAt.trim() : ''
    const paused = Boolean(r.timerPaused)
    const fr = r.timerRemainingFrozen
    let frozenRemainingSec: number | null = null
    if (typeof fr === 'number' && Number.isFinite(fr)) {
      frozenRemainingSec = fr
    } else if (typeof fr === 'string' && fr.trim() !== '' && Number.isFinite(Number(fr))) {
      frozenRemainingSec = Number(fr)
    }
    return { startedAt, paused, frozenRemainingSec }
  })

  return { snapshot, room, ownerUserId, gamePhase, display, speakingTimer, timerRoomFields, loading, refresh }
}
