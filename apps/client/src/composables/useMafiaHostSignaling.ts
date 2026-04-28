import { storeToRefs } from 'pinia'
import { onBeforeUnmount, nextTick, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { useCallSessionStore, type WsStatus } from 'call-core'
import { useMafiaGameStore } from '@/stores/mafiaGame'
import type {
  MafiaPlayerKickPayload,
  MafiaPlayerLifeState,
  MafiaPlayerLifeStateSnapshotPayload,
  MafiaPageBackgroundSettings,
  MafiaPlayerRevivePayload,
  MafiaPlayersUpdatePayload,
  MafiaModeUpdatePayload,
  MafiaReshufflePayload,
  MafiaSettingsUpdatePayload,
  MafiaTimerStartPayload,
  MafiaTimerStopPayload,
} from '@/utils/mafiaGameTypes'

function parseMafiaHostUpdated(
  data: unknown,
): { hostPeerId: string | null; hostUserId: string | null; hostSessionId: string | null } | null {
  if (!data || typeof data !== 'object') {
    return null
  }
  const o = data as { type?: unknown; payload?: unknown }
  if (o.type !== 'mafia:host-updated') {
    return null
  }
  const p = o.payload
  if (!p || typeof p !== 'object') {
    return null
  }
  const h = (p as { hostPeerId?: unknown }).hostPeerId
  const u = (p as { hostUserId?: unknown }).hostUserId
  const s = (p as { hostSessionId?: unknown }).hostSessionId
  const hostPeerId = typeof h === 'string' && h.length > 0 ? h : null
  const hostUserId = typeof u === 'string' && u.length > 0 ? u : null
  const hostSessionId = typeof s === 'string' && s.length > 0 ? s : null
  if (h === null || hostPeerId != null || hostUserId != null || hostSessionId != null) {
    return { hostPeerId, hostUserId, hostSessionId }
  }
  return null
}

function parseMafiaQueueUpdate(data: unknown): { speakingQueue: number[] } | null {
  if (!data || typeof data !== 'object') {
    return null
  }
  const o = data as { type?: unknown; payload?: unknown }
  if (o.type !== 'mafia:queue-update') {
    return null
  }
  const p = o.payload
  if (!p || typeof p !== 'object') {
    return null
  }
  const q = (p as { speakingQueue?: unknown }).speakingQueue
  if (!Array.isArray(q)) {
    return null
  }
  const out: number[] = []
  for (const x of q) {
    if (typeof x === 'number' && Number.isInteger(x) && x >= 1) {
      out.push(x)
    }
  }
  return { speakingQueue: out }
}

const MAFIA_ROLES = new Set(['mafia', 'don', 'sheriff', 'doctor', 'civilian'])

function parseMafiaReshuffle(data: unknown): MafiaReshufflePayload | null {
  if (!data || typeof data !== 'object') {
    return null
  }
  const o = data as { type?: unknown; payload?: unknown }
  if (o.type !== 'mafia:reshuffle') {
    return null
  }
  const p = o.payload
  if (!p || typeof p !== 'object') {
    return null
  }
  const players = (p as { players?: unknown }).players
  if (!Array.isArray(players) || players.length < 1) {
    return null
  }
  const out: MafiaReshufflePayload['players'] = []
  for (let i = 0; i < players.length; i += 1) {
    const row = players[i]
    if (!row || typeof row !== 'object') {
      return null
    }
    const r = row as { peerId?: unknown; seat?: unknown; role?: unknown }
    if (typeof r.peerId !== 'string' || r.peerId.length < 1) {
      return null
    }
    if (typeof r.seat !== 'number' || !Number.isInteger(r.seat) || r.seat !== i + 1) {
      return null
    }
    if (typeof r.role !== 'string' || !MAFIA_ROLES.has(r.role)) {
      return null
    }
    out.push({ peerId: r.peerId, seat: r.seat, role: r.role as MafiaReshufflePayload['players'][number]['role'] })
  }
  return { players: out }
}

const NIGHT_ACTION_KEYS = ['mafia', 'doctor', 'sheriff', 'don'] as const

function parseMafiaPlayersUpdate(data: unknown): MafiaPlayersUpdatePayload | null {
  if (!data || typeof data !== 'object') {
    return null
  }
  const o = data as { type?: unknown; payload?: unknown }
  if (o.type !== 'mafia:players-update') {
    return null
  }
  const p = o.payload
  if (!p || typeof p !== 'object') {
    return null
  }
  const order = (p as { order?: unknown }).order
  if (!Array.isArray(order) || order.length < 1) {
    return null
  }
  const outOrder: string[] = []
  for (const id of order) {
    if (typeof id !== 'string' || id.length < 1) {
      return null
    }
    outOrder.push(id)
  }
  const sq = (p as { speakingQueue?: unknown }).speakingQueue
  if (!Array.isArray(sq)) {
    return null
  }
  const outQ: number[] = []
  for (const x of sq) {
    if (typeof x === 'number' && Number.isInteger(x) && x >= 1) {
      outQ.push(x)
    }
  }
  const naRaw = (p as { nightActions?: unknown }).nightActions
  const nightActions: MafiaPlayersUpdatePayload['nightActions'] = {}
  if (naRaw && typeof naRaw === 'object') {
    for (const k of NIGHT_ACTION_KEYS) {
      const v = (naRaw as Record<string, unknown>)[k]
      if (v != null && typeof v === 'number' && Number.isInteger(v) && v >= 1) {
        nightActions[k] = v
      }
    }
  }
  const clearRoles = (p as { clearRoles?: unknown }).clearRoles
  const oldMode = (p as { oldMafiaMode?: unknown }).oldMafiaMode
  return {
    order: outOrder,
    nightActions,
    speakingQueue: outQ,
    ...(clearRoles === true ? { clearRoles: true } : {}),
    ...(typeof oldMode === 'boolean' ? { oldMafiaMode: oldMode } : {}),
  }
}

function parseMafiaModeUpdate(data: unknown): MafiaModeUpdatePayload | null {
  if (!data || typeof data !== 'object') {
    return null
  }
  const o = data as { type?: unknown; payload?: unknown }
  if (o.type !== 'mafia:mode-update') {
    return null
  }
  const p = o.payload
  if (!p || typeof p !== 'object') {
    return null
  }
  const mode = (p as { mode?: unknown }).mode
  return mode === 'old' || mode === 'new' ? { mode } : null
}

function parseMafiaSettingsUpdate(data: unknown): MafiaSettingsUpdatePayload | null {
  if (!data || typeof data !== 'object') {
    return null
  }
  const o = data as { type?: unknown; payload?: unknown }
  if (o.type !== 'mafia:settings-update') {
    return null
  }
  const p = o.payload
  if (!p || typeof p !== 'object') {
    return null
  }
  const rawBackgrounds = (p as { deadBackgrounds?: unknown }).deadBackgrounds
  if (!Array.isArray(rawBackgrounds)) {
    return null
  }
  const deadBackgrounds: MafiaSettingsUpdatePayload['deadBackgrounds'] = []
  for (const raw of rawBackgrounds) {
    if (!raw || typeof raw !== 'object') {
      continue
    }
    const item = raw as { id?: unknown; url?: unknown; type?: unknown }
    if (typeof item.id !== 'string' || item.id.length < 1) {
      continue
    }
    if (typeof item.url !== 'string' || item.url.length < 1 || item.url.length > 7_000_000) {
      continue
    }
    if (item.type !== 'preset' && item.type !== 'custom') {
      continue
    }
    deadBackgrounds.push({ id: item.id, url: item.url, type: item.type })
  }
  const activeBackgroundId = (p as { activeBackgroundId?: unknown }).activeBackgroundId
  return {
    deadBackgrounds,
    activeBackgroundId: typeof activeBackgroundId === 'string' ? activeBackgroundId : null,
  }
}

function parseBackgroundItem(raw: unknown): MafiaPageBackgroundSettings['backgrounds'][number] | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }
  const item = raw as { id?: unknown; url?: unknown; type?: unknown }
  if (typeof item.id !== 'string' || item.id.length < 1) {
    return null
  }
  if (typeof item.url !== 'string' || item.url.length < 1 || item.url.length > 7_000_000) {
    return null
  }
  if (item.type !== 'default' && item.type !== 'preset' && item.type !== 'custom') {
    return null
  }
  return { id: item.id, url: item.url, type: item.type }
}

function parseMafiaPageBackgroundSettings(data: unknown): MafiaPageBackgroundSettings | null {
  if (!data || typeof data !== 'object') {
    return null
  }
  const o = data as { type?: unknown; payload?: unknown }
  if (o.type !== 'mafia:page-background-settings') {
    return null
  }
  const p = o.payload
  if (!p || typeof p !== 'object') {
    return null
  }
  const rawBackgrounds = (p as { backgrounds?: unknown }).backgrounds
  if (!Array.isArray(rawBackgrounds)) {
    return null
  }
  const backgrounds = rawBackgrounds
    .map(parseBackgroundItem)
    .filter((item): item is MafiaPageBackgroundSettings['backgrounds'][number] => item != null)
  const selectedBackgroundId = (p as { selectedBackgroundId?: unknown }).selectedBackgroundId
  const forcedBackgroundId = (p as { forcedBackgroundId?: unknown }).forcedBackgroundId
  return {
    backgrounds,
    selectedBackgroundId: typeof selectedBackgroundId === 'string' ? selectedBackgroundId : null,
    forcedBackgroundId: typeof forcedBackgroundId === 'string' ? forcedBackgroundId : null,
  }
}

function parseMafiaTimerStart(data: unknown): MafiaTimerStartPayload | null {
  if (!data || typeof data !== 'object') {
    return null
  }
  const o = data as { type?: unknown; payload?: unknown }
  if (o.type !== 'mafia:timer-start') {
    return null
  }
  const p = o.payload
  if (!p || typeof p !== 'object') {
    return null
  }
  const s = (p as { startedAt?: unknown; duration?: unknown }).startedAt
  const d = (p as { startedAt?: unknown; duration?: unknown }).duration
  if (typeof s !== 'number' || !Number.isFinite(s)) {
    return null
  }
  if (typeof d !== 'number' || !Number.isFinite(d) || d < 1000) {
    return null
  }
  const run = (p as { isRunning?: unknown }).isRunning
  const isRunning = run === false ? false : true
  return { startedAt: s, duration: d, isRunning }
}

function parseMafiaTimerStop(data: unknown): MafiaTimerStopPayload | null {
  if (!data || typeof data !== 'object') {
    return null
  }
  const o = data as { type?: unknown; payload?: unknown }
  if (o.type !== 'mafia:timer-stop') {
    return null
  }
  if (o.payload === undefined || o.payload === null) {
    return {}
  }
  if (typeof o.payload !== 'object' || Object.keys(o.payload as object).length > 0) {
    return null
  }
  return {}
}

function parseMafiaPlayerKick(data: unknown): MafiaPlayerKickPayload | null {
  if (!data || typeof data !== 'object') {
    return null
  }
  const o = data as { type?: unknown; payload?: unknown }
  if (o.type !== 'mafia:player-kick') {
    return null
  }
  const p = o.payload
  if (!p || typeof p !== 'object') {
    return null
  }
  const id = (p as { peerId?: unknown }).peerId
  if (typeof id !== 'string' || id.length < 1) {
    return null
  }
  return { peerId: id }
}

function parseMafiaPlayerRevive(data: unknown): MafiaPlayerRevivePayload | null {
  if (!data || typeof data !== 'object') {
    return null
  }
  const o = data as { type?: unknown; payload?: unknown }
  if (o.type !== 'mafia:player-revive') {
    return null
  }
  const p = o.payload
  if (!p || typeof p !== 'object') {
    return null
  }
  const id = (p as { peerId?: unknown }).peerId
  if (typeof id !== 'string' || id.length < 1) {
    return null
  }
  return { peerId: id }
}

function parseMafiaPlayerLifeStateSnapshot(data: unknown): MafiaPlayerLifeStateSnapshotPayload | null {
  if (!data || typeof data !== 'object') {
    return null
  }
  const o = data as { type?: unknown; payload?: unknown }
  if (o.type !== 'mafia:player-life-state') {
    return null
  }
  const p = o.payload
  if (!p || typeof p !== 'object') {
    return null
  }
  const states = (p as { states?: unknown }).states
  if (!states || typeof states !== 'object' || Array.isArray(states)) {
    return null
  }
  const out: Record<string, MafiaPlayerLifeState> = {}
  for (const [peerId, state] of Object.entries(states as Record<string, unknown>)) {
    if (typeof peerId !== 'string' || peerId.length < 1) {
      continue
    }
    if (state === 'dead' || state === 'ghost' || state === 'alive') {
      out[peerId] = state
    }
  }
  return { states: out }
}

/**
 * Mafia “ведучий” — one per signaling room, via `mafia:claim-host` / `mafia:host-updated` on the call WebSocket.
 * Shared `speakingQueue` is sent by the host as `mafia:queue-update` and applied for all clients (including host echo).
 */
export function useMafiaHostSignaling(
  sendSignalingMessage: (obj: object) => void,
  subscribeSignalingMessage: (fn: (data: unknown) => void) => () => void,
  wsStatus: Ref<WsStatus | string>,
): void {
  const mafia = useMafiaGameStore()
  const {
    mafiaHostPeerId,
    mafiaHostUserId,
    mafiaHostSessionId,
    localMafiaSessionId,
    localMafiaUserId,
    speakingQueue,
    isMafiaHost,
    reshuffleBroadcastPayload,
    playersUpdateBroadcastPayload,
    applyingPlayersUpdateFromSignaling,
    timerStartBroadcastPayload,
    timerStopBroadcastPayload,
    kickBroadcastPayload,
    reviveBroadcastPayload,
    modeUpdateBroadcastPayload,
    settingsUpdateBroadcastPayload,
    pageBackgroundSettingsBroadcastPayload,
  } = storeToRefs(mafia)
  const session = useCallSessionStore()
  const { inCall, selfPeerId } = storeToRefs(session)

  /** While true, do not re-send `mafia:queue-update` (remote / echo apply). */
  const applyingQueueFromSignaling = ref(false)

  const off = subscribeSignalingMessage((data) => {
    const hostParsed = parseMafiaHostUpdated(data)
    if (hostParsed) {
      mafia.setMafiaHostFromSignaling(hostParsed.hostPeerId, hostParsed.hostUserId, hostParsed.hostSessionId)
    }
    const queueParsed = parseMafiaQueueUpdate(data)
    if (queueParsed) {
      applyingQueueFromSignaling.value = true
      mafia.applySpeakingQueueFromSignaling(queueParsed.speakingQueue)
      void nextTick(() => {
        applyingQueueFromSignaling.value = false
      })
    }
    const reshuffleParsed = parseMafiaReshuffle(data)
    if (reshuffleParsed) {
      mafia.applyMafiaReshuffleFromSignaling(reshuffleParsed)
    }
    const playersParsed = parseMafiaPlayersUpdate(data)
    if (playersParsed) {
      applyingPlayersUpdateFromSignaling.value = true
      mafia.applyMafiaPlayersUpdateFromSignaling(playersParsed)
      void nextTick(() => {
        applyingPlayersUpdateFromSignaling.value = false
      })
    }
    const modeParsed = parseMafiaModeUpdate(data)
    if (modeParsed) {
      mafia.applyMafiaModeFromSignaling(modeParsed)
    }
    const settingsParsed = parseMafiaSettingsUpdate(data)
    if (settingsParsed && !isMafiaHost.value) {
      mafia.applyMafiaSettingsUpdateFromSignaling(settingsParsed)
    }
    const pageBackgroundParsed = parseMafiaPageBackgroundSettings(data)
    if (pageBackgroundParsed && !isMafiaHost.value) {
      mafia.applyMafiaPageBackgroundSettingsFromSignaling(pageBackgroundParsed)
    }
    const timerParsed = parseMafiaTimerStart(data)
    if (timerParsed) {
      mafia.applyMafiaTimerFromSignaling(timerParsed)
    }
    if (parseMafiaTimerStop(data) != null) {
      mafia.applyMafiaTimerStopFromSignaling()
    }
    const kickParsed = parseMafiaPlayerKick(data)
    if (kickParsed) {
      mafia.applyMafiaKickFromSignaling(kickParsed)
    }
    const reviveParsed = parseMafiaPlayerRevive(data)
    if (reviveParsed) {
      mafia.applyMafiaReviveFromSignaling(reviveParsed)
    }
    const lifeStateParsed = parseMafiaPlayerLifeStateSnapshot(data)
    if (lifeStateParsed) {
      mafia.applyMafiaPlayerLifeStateSnapshotFromSignaling(lifeStateParsed)
    }
  })
  onBeforeUnmount(off)

  watch(
    [inCall, mafiaHostPeerId, mafiaHostUserId, mafiaHostSessionId, localMafiaSessionId, localMafiaUserId, selfPeerId, wsStatus],
    () => {
      if (!inCall.value) {
        mafia.setMafiaHostFromSignaling(null, null, null)
        return
      }
      if (wsStatus.value !== 'open') {
        return
      }
      const sid = selfPeerId.value
      if (typeof sid !== 'string' || sid.length === 0) {
        return
      }
      const localUserId = localMafiaUserId.value
      const localSessionId = localMafiaSessionId.value
      if (typeof localUserId !== 'string' || localUserId.length === 0 || localSessionId.length === 0) {
        return
      }
      if (mafiaHostUserId.value != null && mafiaHostUserId.value !== localUserId) {
        return
      }
      sendSignalingMessage({ type: 'mafia:claim-host', payload: { sessionId: localSessionId } })
    },
    { immediate: true },
  )

  watch(
    speakingQueue,
    (q) => {
      if (applyingQueueFromSignaling.value || applyingPlayersUpdateFromSignaling.value) {
        return
      }
      if (!inCall.value) {
        return
      }
      if (wsStatus.value !== 'open') {
        return
      }
      if (!isMafiaHost.value) {
        return
      }
      sendSignalingMessage({ type: 'mafia:queue-update', payload: { speakingQueue: [...q] } })
    },
    { deep: true },
  )

  watch(
    reshuffleBroadcastPayload,
    (p) => {
      if (p == null) {
        return
      }
      if (!inCall.value) {
        mafia.clearReshuffleBroadcastPayload()
        return
      }
      if (wsStatus.value !== 'open') {
        mafia.clearReshuffleBroadcastPayload()
        return
      }
      if (!isMafiaHost.value) {
        mafia.clearReshuffleBroadcastPayload()
        return
      }
      sendSignalingMessage({ type: 'mafia:reshuffle', payload: p })
      mafia.clearReshuffleBroadcastPayload()
    },
    { flush: 'post' },
  )

  watch(
    playersUpdateBroadcastPayload,
    (p) => {
      if (p == null) {
        return
      }
      if (!inCall.value) {
        mafia.clearPlayersUpdateBroadcastPayload()
        return
      }
      if (wsStatus.value !== 'open') {
        mafia.clearPlayersUpdateBroadcastPayload()
        return
      }
      if (!isMafiaHost.value) {
        mafia.clearPlayersUpdateBroadcastPayload()
        return
      }
      sendSignalingMessage({ type: 'mafia:players-update', payload: p })
      mafia.clearPlayersUpdateBroadcastPayload()
    },
    { flush: 'post' },
  )

  watch(
    modeUpdateBroadcastPayload,
    (p) => {
      if (p == null) {
        return
      }
      if (!inCall.value) {
        mafia.clearModeUpdateBroadcastPayload()
        return
      }
      if (wsStatus.value !== 'open') {
        mafia.clearModeUpdateBroadcastPayload()
        return
      }
      if (!isMafiaHost.value) {
        mafia.clearModeUpdateBroadcastPayload()
        return
      }
      sendSignalingMessage({ type: 'mafia:mode-update', payload: p })
      mafia.clearModeUpdateBroadcastPayload()
    },
    { flush: 'post' },
  )

  watch(
    settingsUpdateBroadcastPayload,
    (p) => {
      if (p == null) {
        return
      }
      if (!inCall.value) {
        mafia.clearSettingsUpdateBroadcastPayload()
        return
      }
      if (wsStatus.value !== 'open') {
        mafia.clearSettingsUpdateBroadcastPayload()
        return
      }
      if (!isMafiaHost.value) {
        mafia.clearSettingsUpdateBroadcastPayload()
        return
      }
      sendSignalingMessage({ type: 'mafia:settings-update', payload: p })
      mafia.clearSettingsUpdateBroadcastPayload()
    },
    { flush: 'post' },
  )

  watch(
    pageBackgroundSettingsBroadcastPayload,
    (p) => {
      if (p == null) {
        return
      }
      if (!inCall.value) {
        mafia.clearPageBackgroundSettingsBroadcastPayload()
        return
      }
      if (wsStatus.value !== 'open') {
        mafia.clearPageBackgroundSettingsBroadcastPayload()
        return
      }
      if (!isMafiaHost.value) {
        mafia.clearPageBackgroundSettingsBroadcastPayload()
        return
      }
      sendSignalingMessage({ type: 'mafia:page-background-settings', payload: p })
      mafia.clearPageBackgroundSettingsBroadcastPayload()
    },
    { flush: 'post' },
  )

  watch(
    timerStartBroadcastPayload,
    (p) => {
      if (p == null) {
        return
      }
      if (!inCall.value) {
        mafia.clearTimerStartBroadcastPayload()
        return
      }
      if (wsStatus.value !== 'open') {
        mafia.clearTimerStartBroadcastPayload()
        return
      }
      if (!isMafiaHost.value) {
        mafia.clearTimerStartBroadcastPayload()
        return
      }
      sendSignalingMessage({ type: 'mafia:timer-start', payload: p })
      mafia.clearTimerStartBroadcastPayload()
    },
    { flush: 'post' },
  )

  watch(
    timerStopBroadcastPayload,
    (p) => {
      if (p == null) {
        return
      }
      if (!inCall.value) {
        mafia.clearTimerStopBroadcastPayload()
        return
      }
      if (wsStatus.value !== 'open') {
        mafia.clearTimerStopBroadcastPayload()
        return
      }
      if (!isMafiaHost.value) {
        mafia.clearTimerStopBroadcastPayload()
        return
      }
      sendSignalingMessage({ type: 'mafia:timer-stop', payload: {} })
      mafia.clearTimerStopBroadcastPayload()
    },
    { flush: 'post' },
  )

  watch(
    kickBroadcastPayload,
    (p) => {
      if (p == null) {
        return
      }
      if (!inCall.value) {
        mafia.clearKickBroadcastPayload()
        return
      }
      if (wsStatus.value !== 'open') {
        mafia.clearKickBroadcastPayload()
        return
      }
      if (!isMafiaHost.value) {
        mafia.clearKickBroadcastPayload()
        return
      }
      sendSignalingMessage({ type: 'mafia:player-kick', payload: p })
      mafia.clearKickBroadcastPayload()
    },
    { flush: 'post' },
  )

  watch(
    reviveBroadcastPayload,
    (p) => {
      if (p == null) {
        return
      }
      if (!inCall.value) {
        mafia.clearReviveBroadcastPayload()
        return
      }
      if (wsStatus.value !== 'open') {
        mafia.clearReviveBroadcastPayload()
        return
      }
      if (!isMafiaHost.value) {
        mafia.clearReviveBroadcastPayload()
        return
      }
      sendSignalingMessage({ type: 'mafia:player-revive', payload: p })
      mafia.clearReviveBroadcastPayload()
    },
    { flush: 'post' },
  )
}
