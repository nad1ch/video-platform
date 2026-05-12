<script setup lang="ts">
/**
 * GameCallShell — reusable Game Call foundation (Phase 4 lab).
 *
 * Owns one `useCallOrchestrator()` invocation for the lab session and
 * manages join/leave around its lifecycle. Provides the orchestrator
 * context to descendants via `provide(GAME_CALL_SESSION_KEY, …)` so
 * `<GameCallVideoGrid>`, `<CallControlsDock>` (consumed by the lab page),
 * and any per-game overlay layer can read tiles / mic state / cam state
 * without prop-drilling.
 *
 * Production CallPage owns its own orchestrator instance on its own routes;
 * GameCallShell is only mounted by the Game Template page on
 * `/app/game-template`, which is a separate route. The two orchestrator
 * instances never coexist.
 *
 * **Hard isolation from production Mafia state**: this component does NOT
 * import any Mafia store or composable. It only consumes call-core. Any
 * game-specific UI (Mafia / EatFirst / …) lives in slot content rendered by
 * the page that mounts the shell.
 */

import {
  computed,
  onBeforeUnmount,
  onMounted,
  provide,
  shallowRef,
  watch,
} from 'vue'
import { storeToRefs } from 'pinia'
import {
  useCallOrchestrator,
  useCallSessionStore,
  type CallEngineRole,
} from 'call-core'
import { useAuth } from '@/composables/useAuth'
import { createLogger } from '@/utils/logger'
import {
  GAME_CALL_SESSION_KEY,
  type GameCallShellContext,
  type GameCallTileLike,
} from './gameCallShellContext'

const log = createLogger('game-call-lab:shell')

const props = withDefaults(
  defineProps<{
    /**
     * Full signaling room id (including any namespace prefix). The lab
     * passes `gamecall-lab:<id>` to keep the lab session isolated from
     * production Mafia / EatFirst rooms.
     */
    roomId: string
    /** mediasoup role; defaults to `participant`. */
    role?: CallEngineRole
    /** Optional explicit display name override (defaults to auth user). */
    displayNameOverride?: string
    /**
     * When true, the shell automatically calls `joinCall()` on mount.
     * Default true. Set false to drive joining manually from the page.
     */
    autoJoin?: boolean
  }>(),
  {
    role: 'participant',
    displayNameOverride: undefined,
    autoJoin: true,
  },
)

const emit = defineEmits<{
  joined: []
  left: []
  'join-error': [message: string]
}>()

const { user, ensureAuthLoaded, isAdmin } = useAuth()

// ---- Orchestrator wiring (one instance per shell mount) ----

const joinAvatarUrl = computed(() => {
  const a = user.value?.avatar
  return typeof a === 'string' && a.trim().length > 0 ? a.trim() : undefined
})
const joinUserId = computed(() => {
  const id = user.value?.id
  return typeof id === 'string' && id.trim().length > 0 ? id.trim() : undefined
})
const role = computed<CallEngineRole>(() => props.role)
const allowManualVideoQuality = computed(() => isAdmin.value)

const orchestrator = useCallOrchestrator({
  role,
  allowManualVideoQuality,
  joinAvatarUrl,
  joinUserId,
})

const {
  session,
  joining,
  joinError,
  joinCall,
  leaveCall,
  tiles,
  sizeTier,
  micEnabled,
  camEnabled,
  callDeafened,
  toggleMic,
  toggleCam,
  toggleCallDeafen,
  audioInputDevices,
  videoInputDevices,
  audioOutputDevices,
  refreshMediaDevices,
  localAudioInputDeviceId,
  localVideoInputDeviceId,
  setCallAudioInputDevice,
  setCallVideoInputDevice,
  handRaised,
  toggleRaiseHand,
  screenSharing,
  toggleScreenShare,
  callChatMessages,
  sendChatMessage,
  wsStatus,
} = orchestrator

const callSession = useCallSessionStore()
const { selfPeerId, selfDisplayName, inCall } = storeToRefs(callSession)

// ---- `sa-call-route` html class (mirrors CallPage's behaviour) ----

const CALL_ROUTE_HTML_CLASS = 'sa-call-route'
let htmlClassApplied = false
function applyCallRouteClass(): void {
  if (typeof document === 'undefined' || htmlClassApplied) return
  document.documentElement.classList.add(CALL_ROUTE_HTML_CLASS)
  htmlClassApplied = true
}
function removeCallRouteClass(): void {
  if (typeof document === 'undefined' || !htmlClassApplied) return
  document.documentElement.classList.remove(CALL_ROUTE_HTML_CLASS)
  htmlClassApplied = false
}

// ---- Join sequence (lab room) ----

async function joinLabRoom(): Promise<void> {
  await ensureAuthLoaded()
  if (joining.value) return
  if (inCall.value && session.roomId === props.roomId) return
  if (inCall.value) {
    leaveCall()
  }
  session.roomId = props.roomId
  if (props.displayNameOverride && props.displayNameOverride.trim().length > 0) {
    session.selfDisplayName = props.displayNameOverride.trim()
  }
  try {
    await joinCall()
    if (inCall.value) {
      emit('joined')
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (import.meta.env.DEV) {
      log.warn('joinLabRoom failed', { roomId: props.roomId, err: msg })
    }
    emit('join-error', msg)
  }
}

watch(joinError, (err) => {
  if (err) emit('join-error', err)
})

watch(inCall, (value, prev) => {
  if (prev && !value) emit('left')
})

onMounted(() => {
  applyCallRouteClass()
  if (props.autoJoin) {
    void joinLabRoom()
  }
})

onBeforeUnmount(() => {
  if (inCall.value || joining.value) {
    leaveCall()
  }
  removeCallRouteClass()
})

// ---- Shell context (provided to descendants) ----

const ctx: GameCallShellContext = {
  joining,
  joinError,
  inCall,
  wsStatus,
  selfPeerId,
  selfDisplayName,
  tiles: tiles as unknown as GameCallShellContext['tiles'],
  sizeTier,
  micEnabled,
  camEnabled,
  callDeafened,
  toggleMic,
  toggleCam,
  toggleCallDeafen,
  handRaised,
  toggleRaiseHand,
  screenSharing,
  toggleScreenShare,
  audioInputDevices: audioInputDevices as unknown as GameCallShellContext['audioInputDevices'],
  videoInputDevices: videoInputDevices as unknown as GameCallShellContext['videoInputDevices'],
  audioOutputDevices: audioOutputDevices as unknown as GameCallShellContext['audioOutputDevices'],
  refreshMediaDevices,
  localAudioInputDeviceId,
  localVideoInputDeviceId,
  setCallAudioInputDevice,
  setCallVideoInputDevice,
  joinLabRoom,
  leaveCall,
  callChatMessages,
  sendChatMessage,
}

provide(GAME_CALL_SESSION_KEY, ctx)

defineExpose({ ctx, tiles, joinLabRoom, leaveCall })

const slotCtx = shallowRef<GameCallShellContext>(ctx)

// Convenience: typed slot context with a narrowed tiles shape.
const slotProps = computed(() => ({
  ctx: slotCtx.value,
  tiles: tiles.value as readonly GameCallTileLike[],
}))
</script>

<template>
  <!--
    Renderless wrapper: the shell adds no DOM of its own. The consuming page
    owns the layout (typically wrapping the slot content in production
    `.call-page__shell` / `.call-page__active` classes for visual parity with
    `<CallPage>`).
  -->
  <slot
    :ctx="slotProps.ctx"
    :tiles="slotProps.tiles"
  />
</template>
