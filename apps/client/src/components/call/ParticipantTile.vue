<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
  watch,
} from 'vue'
import { useI18n } from 'vue-i18n'
import { normalizeDisplayName } from 'call-core'
import { createLogger } from '@/utils/logger'
import type { MafiaRole } from '@/utils/mafiaGameTypes'
import type {
  GameEliminationAvatarKind,
  GameEliminationBackground,
  GamePlayerLifeState,
} from '@/utils/gameTileTypes'
import GameEliminationMark from '../game-call/GameEliminationMark.vue'
import StreamAudio from '../StreamAudio.vue'
import StreamVideo from '../StreamVideo.vue'

const tileLog = createLogger('participant-tile')

const { t } = useI18n()

type EatFirstTraitKey =
  | 'gender'
  | 'age'
  | 'profession'
  | 'health'
  | 'hobby'
  | 'phobia'
  | 'fact'
  | 'baggage'

type EatFirstRevealState = 'hidden' | 'pending' | 'revealed'

const emit = defineEmits<{
  'update:listenVolume': [value: number]
  'update:listenMuted': [value: boolean]
  
  'commit-local-display-name': [payload: { peerId: string; name: string | null }]
  
  'mafia-toggle-life': [peerId: string]
  /** Neutral alias of `mafia-toggle-life`; fired in parallel for Game Template. */
  'game-toggle-life': [peerId: string]

  'mafia-force-camera-off': [peerId: string]
  /** Neutral alias of `mafia-force-camera-off`; fired in parallel for Game Template. */
  'game-force-camera-off': [peerId: string]

  'mafia-set-elimination-background': [payload: { peerId: string; background: GameEliminationBackground }]
  /** Neutral alias of `mafia-set-elimination-background`; fired in parallel for Game Template. */
  'game-set-elimination-background': [payload: { peerId: string; background: GameEliminationBackground }]

  'mafia-viewport-layers': [visible: boolean]
  /** Neutral alias of `mafia-viewport-layers`; fired in parallel for Game Template. */
  'game-viewport-layers': [visible: boolean]
  
  'remote-playback-stall': [payload: { peerId: string; stalling: boolean }]
  /**
   * Frame-decode stall detected on the inbound video track. Bubbled from
   * `<StreamVideo>`; CallPage debounces these and triggers a soft producer
   * resync. Only fires for remote tiles with a known `peerId`.
   */
  'video-stall': [payload: { peerId: string }]
  /**
   * Audio-stall detected on the inbound audio track (server says peer should
   * be sending but `track.muted` has been true for >=30s). Bubbled from
   * `<StreamAudio>`; CallPage routes through the same soft → hard producer
   * resync ladder as `video-stall`.
   */
  'audio-stall': [payload: { peerId: string }]
  'eat-first-reveal-trait': [payload: { peerId: string; traitKey: EatFirstTraitKey; closed?: boolean }]
  'eat-first-generate-trait': [payload: { peerId: string; traitKey: EatFirstTraitKey }]
  'eat-first-reroll-action-card': [payload: { peerId: string }]
  'eat-first-use-action-card': [payload: { peerId: string }]
}>()

const props = withDefaults(
  defineProps<{
    
    peerId?: string
    displayName: string
    /**
     * Stable name for avatar initials fallback. Defaults to `displayName`.
     * Used to keep the center placeholder identity stable when a route-level
     * nickname override changes only the visible label.
     */
    avatarFallbackName?: string
    stream: MediaStream | null
    isLocal: boolean
    videoEnabled: boolean
    audioEnabled: boolean
    
    playRev?: number
    
    sizeTier: 'sm' | 'md' | 'lg'
    



    rowSpeaking: boolean

    remoteListenVolume?: number

    remoteListenMuted?: boolean
    /** “Raise hand” from signaling (call room). */
    raiseHand?: boolean
    
    videoFillCover?: boolean
    
    videoPresentation?: 'camera' | 'screen' | 'none'
    
    avatarUrl?: string
    canEditDisplayName?: boolean
    
    mafiaSeatIndex?: number
    /** Neutral alias of `mafiaSeatIndex`; takes precedence when defined. */
    gameSeatIndex?: number
    eatFirstTraits?: Record<EatFirstTraitKey, string> | null
    eatFirstTraitHostView?: boolean
    eatFirstTraitOwnerView?: boolean
    eatFirstRevealedTraitKeys?: string[]
    /**
     * Host sees every seated player's card; a seated player sees only their own.
     * Host gets a reroll control; the seat owner gets a use button until `used`.
     */
    eatFirstActionCard?: { title: string; description: string; templateId: string; used: boolean } | null
    


    mafiaVisibleRole?: MafiaRole
    /** Neutral alias of `mafiaVisibleRole`; takes precedence when defined. */
    gameVisibleRole?: MafiaRole

    streamViewMode?: boolean

    mafiaLifeState?: GamePlayerLifeState
    /** Neutral alias of `mafiaLifeState`; takes precedence when defined. */
    gameLifeState?: GamePlayerLifeState
    mafiaEliminationKind?: GameEliminationAvatarKind
    /** Neutral alias of `mafiaEliminationKind`; takes precedence when defined. */
    gameEliminationKind?: GameEliminationAvatarKind
    mafiaEliminationIconSrc?: string
    /** Neutral alias of `mafiaEliminationIconSrc`; takes precedence when defined. */
    gameEliminationIconSrc?: string
    mafiaEliminationBackground?: GameEliminationBackground
    /** Neutral alias of `mafiaEliminationBackground`; takes precedence when defined. */
    gameEliminationBackground?: GameEliminationBackground
    mafiaDeadBackgroundUrl?: string | null
    /** Neutral alias of `mafiaDeadBackgroundUrl`; takes precedence when defined. */
    gameDeadBackgroundUrl?: string | null

    mafiaHostShowLifeToggle?: boolean
    /** Neutral alias of `mafiaHostShowLifeToggle`; takes precedence when defined. */
    gameHostShowLifeToggle?: boolean




    mafiaLayerViewportObserve?: boolean
    /** Neutral alias of `mafiaLayerViewportObserve`; takes precedence when defined. */
    gameLayerViewportObserve?: boolean
    


    videoPlaybackSuppressed?: boolean
    
    videoTargetPlaybackFps?: number
  }>(),
  {
    streamViewMode: false,
    mafiaLifeState: 'alive',
    mafiaEliminationKind: 'skull',
    mafiaEliminationBackground: 'dark',
    mafiaDeadBackgroundUrl: null,
    mafiaHostShowLifeToggle: false,
    mafiaLayerViewportObserve: false,
    videoPlaybackSuppressed: false,
    rowSpeaking: false,
    eatFirstTraitHostView: false,
    eatFirstTraitOwnerView: false,
    eatFirstRevealedTraitKeys: () => [],
    eatFirstActionCard: null,
    canEditDisplayName: true,
  },
)

const ELIMINATION_BACKGROUND_OPTIONS = Object.freeze([
  'dark',
  'red',
  'violet',
  'gray',
] as const satisfies readonly GameEliminationBackground[])

const tileRootRef = ref<HTMLElement | null>(null)
let tileLayerObserver: IntersectionObserver | null = null
let tileLayerLastEmitted: boolean | null = null

const editingName = ref(false)
const nameDraft = ref('')
const nameInputRef = ref<HTMLInputElement | null>(null)

function peerIdForNameEdit(): string {
  return typeof props.peerId === 'string' ? props.peerId.trim() : ''
}

const remotePlaybackStallPeerIdForVideo = computed(() => {
  if (props.isLocal) {
    return null
  }
  const id = typeof props.peerId === 'string' ? props.peerId.trim() : ''
  return id.length > 0 ? id : null
})

function startNameEdit(): void {
  if (props.streamViewMode || props.canEditDisplayName !== true) {
    return
  }
  const id = peerIdForNameEdit()
  if (!id) {
    return
  }
  nameDraft.value = props.displayName
  editingName.value = true
  void nextTick(() => {
    nameInputRef.value?.focus()
    nameInputRef.value?.select()
  })
}

function cancelNameEdit(): void {
  editingName.value = false
  nameDraft.value = props.displayName
}

function finishNameEdit(): void {
  if (!editingName.value) {
    return
  }
  if (props.canEditDisplayName !== true) {
    editingName.value = false
    return
  }
  editingName.value = false
  const id = peerIdForNameEdit()
  if (!id) {
    return
  }
  const trimmed = normalizeDisplayName(nameDraft.value).slice(0, 64)
  if (trimmed === normalizeDisplayName(props.displayName)) {
    return
  }
  emit('commit-local-display-name', { peerId: id, name: trimmed.length > 0 ? trimmed : null })
}

function onNameInputEnter(ev: KeyboardEvent): void {
  const el = ev.target
  if (el instanceof HTMLInputElement) {
    el.blur()
  }
}

function initials(name: string): string {
  const n = normalizeDisplayName(name)
  const parts = n.split(/\s+/).filter(Boolean).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}


const audioSplitStream = shallowRef<MediaStream | null>(null)

function clearSplitHolder(holder: { value: MediaStream | null }): void {
  const m = holder.value
  if (!m) {
    return
  }
  for (const t of [...m.getTracks()]) {
    m.removeTrack(t)
  }
  holder.value = null
}

function syncSplitStream(
  holder: { value: MediaStream | null },
  tracks: MediaStreamTrack[],
): void {
  if (tracks.length === 0) {
    clearSplitHolder(holder)
    return
  }
  if (!holder.value) {
    holder.value = new MediaStream()
  }
  const m = holder.value
  const want = new Set(tracks.map((t) => t.id))
  const kind = tracks[0]?.kind
  const current = kind === 'video' ? m.getVideoTracks() : m.getAudioTracks()
  for (const t of current) {
    if (!want.has(t.id)) {
      m.removeTrack(t)
    }
  }
  for (const t of tracks) {
    if (!m.getTracks().some((et) => et.id === t.id)) {
      m.addTrack(t)
    }
  }
}

watch(
  () => [props.stream, props.playRev ?? 0, props.isLocal] as const,
  () => {
    if (!props.stream || props.isLocal) {
      clearSplitHolder(audioSplitStream)
      return
    }
    syncSplitStream(audioSplitStream, props.stream.getAudioTracks())
  },
  { immediate: true },
)

onUnmounted(() => {
  clearSplitHolder(audioSplitStream)
  clearEatFirstTimers()
})

/**
 * Resolved fallback for each neutral / legacy prop pair: the neutral
 * `game*` prop wins when defined, otherwise we fall back to the legacy
 * `mafia*` prop (which carries its own default via `withDefaults`). This
 * lets Game Template bind `:game-*` and production Mafia keep binding
 * `:mafia-*` without changing internal logic anywhere downstream.
 */
const resolvedSeatIndex = computed(() => props.gameSeatIndex ?? props.mafiaSeatIndex)
const resolvedVisibleRole = computed(() => props.gameVisibleRole ?? props.mafiaVisibleRole)
const resolvedLifeState = computed(() => props.gameLifeState ?? props.mafiaLifeState)
const resolvedEliminationKind = computed(
  () => props.gameEliminationKind ?? props.mafiaEliminationKind,
)
const resolvedEliminationIconSrc = computed(() => {
  const value = props.gameEliminationIconSrc ?? props.mafiaEliminationIconSrc
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : ''
})
const resolvedEliminationBackground = computed(
  () => props.gameEliminationBackground ?? props.mafiaEliminationBackground,
)
const resolvedDeadBackgroundUrl = computed(
  () => props.gameDeadBackgroundUrl ?? props.mafiaDeadBackgroundUrl,
)
const resolvedHostShowLifeToggle = computed(
  () => props.gameHostShowLifeToggle || props.mafiaHostShowLifeToggle,
)
const resolvedLayerViewportObserve = computed(
  () => props.gameLayerViewportObserve || props.mafiaLayerViewportObserve,
)

const showSeatBadge = computed(
  () => typeof resolvedSeatIndex.value === 'number' && resolvedSeatIndex.value > 0,
)

const EAT_FIRST_TRAIT_LABELS: Record<EatFirstTraitKey, string> = {
  gender: 'Стать',
  age: 'Вік',
  profession: 'Професія',
  health: 'Здоровʼя',
  hobby: 'Хобі',
  phobia: 'Фобія',
  fact: 'Факт',
  baggage: 'Багаж',
}

const EAT_FIRST_REVEAL_DELAY_MS = 3000

const eatFirstRevealState = ref<Partial<Record<EatFirstTraitKey, EatFirstRevealState>>>({})
const eatFirstRevealTimers = new Map<EatFirstTraitKey, ReturnType<typeof setTimeout>>()
const eatFirstToastVisible = ref(false)
const eatFirstToastLabel = ref('')
let eatFirstToastTimer: ReturnType<typeof setTimeout> | null = null

function clearEatFirstTimers(): void {
  for (const timer of eatFirstRevealTimers.values()) {
    clearTimeout(timer)
  }
  eatFirstRevealTimers.clear()
  if (eatFirstToastTimer != null) {
    clearTimeout(eatFirstToastTimer)
    eatFirstToastTimer = null
  }
}

const eatFirstTraitValues = computed<Partial<Record<EatFirstTraitKey, string>>>(() => {
  const src =
    props.eatFirstTraits && typeof props.eatFirstTraits === 'object' && !Array.isArray(props.eatFirstTraits)
      ? props.eatFirstTraits
      : null
  if (!src) return {}
  const out: Partial<Record<EatFirstTraitKey, string>> = {}
  for (const key of Object.keys(EAT_FIRST_TRAIT_LABELS) as EatFirstTraitKey[]) {
    const value = typeof src[key] === 'string' ? src[key].trim() : ''
    if (value.length > 0) out[key] = value
  }
  return out
})

/**
 * Render the Eat First trait overlay whenever at least one trait has a value.
 * Partial state is legitimate (trait-type reroll mid-round, cold join before
 * `eat:table-state-sync` has hydrated every key); requiring all 8 keys hid the
 * whole overlay during normal play. Per-cell renderers already handle empty
 * values gracefully — host/owner via `'Невідомо'`, OBS viewers via the
 * crossed-eye marker.
 */
const hasEatFirstTraits = computed(() =>
  (Object.keys(EAT_FIRST_TRAIT_LABELS) as EatFirstTraitKey[]).some((key) => {
    const value = eatFirstTraitValues.value[key]
    return typeof value === 'string' && value.length > 0
  }),
)

const eatFirstTraitsBySection = computed(() => {
  const values = eatFirstTraitValues.value
  return {
    top: [
      { key: 'gender' as const, label: EAT_FIRST_TRAIT_LABELS.gender, value: values.gender ?? '' },
      { key: 'age' as const, label: EAT_FIRST_TRAIT_LABELS.age, value: values.age ?? '' },
    ],
    left: [
      { key: 'profession' as const, label: EAT_FIRST_TRAIT_LABELS.profession, value: values.profession ?? '' },
      { key: 'health' as const, label: EAT_FIRST_TRAIT_LABELS.health, value: values.health ?? '' },
      { key: 'hobby' as const, label: EAT_FIRST_TRAIT_LABELS.hobby, value: values.hobby ?? '' },
    ],
    right: [
      { key: 'phobia' as const, label: EAT_FIRST_TRAIT_LABELS.phobia, value: values.phobia ?? '' },
      { key: 'fact' as const, label: EAT_FIRST_TRAIT_LABELS.fact, value: values.fact ?? '' },
      { key: 'baggage' as const, label: EAT_FIRST_TRAIT_LABELS.baggage, value: values.baggage ?? '' },
    ],
  }
})

// Local reveal animation state is keyed by `traitKey`, not by trait value — the
// only meaningful invalidation is the tile binding to a different peer. Avoid
// `JSON.stringify` here: at 8–12 cameras × every `eat:table-state-sync` it is
// the hottest per-tile work and contributes to render churn without changing
// behavior (server-authoritative reveal state arrives via
// `props.eatFirstRevealedTraitKeys`, which is already reactive per-cell).
watch(
  () => props.peerId,
  () => {
    clearEatFirstTimers()
    eatFirstRevealState.value = {}
    eatFirstToastVisible.value = false
    eatFirstToastLabel.value = ''
  },
)

function isEatFirstTraitOwnerView(): boolean {
  return props.eatFirstTraitOwnerView === true && !props.streamViewMode
}

function isEatFirstTraitHostView(): boolean {
  return props.eatFirstTraitHostView === true && !props.streamViewMode
}

function canRevealTrait(): boolean {
  return isEatFirstTraitOwnerView() || isEatFirstTraitHostView()
}

function canGenerateTrait(): boolean {
  return isEatFirstTraitHostView()
}

function eatFirstTraitStateFor(key: EatFirstTraitKey): EatFirstRevealState {
  if (Array.isArray(props.eatFirstRevealedTraitKeys) && props.eatFirstRevealedTraitKeys.includes(key)) {
    return 'revealed'
  }
  return eatFirstRevealState.value[key] ?? 'hidden'
}

/** Remote viewers only: compact chips until publicly revealed. Host and seated player see full labels/values. */
function eatFirstTraitCellSealed(key: EatFirstTraitKey): boolean {
  if (isEatFirstTraitHostView() || isEatFirstTraitOwnerView()) return false
  return eatFirstTraitStateFor(key) !== 'revealed'
}

function eatFirstTraitInsightLayout(): boolean {
  return isEatFirstTraitHostView() || isEatFirstTraitOwnerView()
}

function eatFirstCanRevealValue(key: EatFirstTraitKey): boolean {
  if (props.eatFirstTraitHostView || props.eatFirstTraitOwnerView) return true
  return eatFirstTraitStateFor(key) === 'revealed'
}

function eatFirstValueText(key: EatFirstTraitKey, rawValue: string): string {
  const effectiveValue = typeof rawValue === 'string' ? rawValue.trim() : ''
  if (eatFirstCanRevealValue(key)) return effectiveValue || 'Невідомо'
  return ''
}

const EAT_FIRST_TRAIT_VALUE_MAX_LINE_CHARS = 18

/** Word-wrapped lines; each line is at most `EAT_FIRST_TRAIT_VALUE_MAX_LINE_CHARS` (long tokens split). */
function eatFirstWrapTraitValueLines(text: string): string[] {
  const maxChars = EAT_FIRST_TRAIT_VALUE_MAX_LINE_CHARS
  const t = text.trim()
  if (!t) return []

  const lines: string[] = []
  let line = ''

  const pushLine = (): void => {
    if (line.length > 0) {
      lines.push(line)
      line = ''
    }
  }

  const consumeOversizedWord = (word: string): void => {
    let w = word
    while (w.length > maxChars) {
      lines.push(w.slice(0, maxChars))
      w = w.slice(maxChars)
    }
    line = w
  }

  const words = t.split(/\s+/).filter(Boolean)
  for (const word of words) {
    if (word.length > maxChars) {
      pushLine()
      consumeOversizedWord(word)
      continue
    }
    const next = line.length === 0 ? word : `${line} ${word}`
    if (next.length <= maxChars) {
      line = next
    } else {
      pushLine()
      line = word
    }
  }
  pushLine()
  return lines
}

function eatFirstValueDisplayLines(key: EatFirstTraitKey, rawValue: string): string[] {
  const full = eatFirstValueText(key, rawValue).trim()
  if (!full) return []
  return eatFirstWrapTraitValueLines(full)
}

/** Non-owner/non-host viewers: hidden traits show a crossed-out eye in the value slot (no asterisks). */
function eatFirstPeerShowsHiddenEyeMark(key: EatFirstTraitKey): boolean {
  if (canRevealTrait()) return false
  return eatFirstTraitStateFor(key) !== 'revealed'
}

function onEatFirstReveal(key: EatFirstTraitKey, label: string): void {
  if (!canRevealTrait()) return
  const current = eatFirstTraitStateFor(key)
  // Toggle: clicking a revealed trait emits a close-request so the server
  // strips it from `revealedByPeer`/`openedByPlayerByPeer`. The server then
  // re-broadcasts and the parent CallPage updates `eatFirstRevealedTraitKeys`.
  if (current === 'revealed') {
    const t = eatFirstRevealTimers.get(key)
    if (t != null) {
      clearTimeout(t)
      eatFirstRevealTimers.delete(key)
    }
    eatFirstRevealState.value = { ...eatFirstRevealState.value, [key]: 'hidden' }
    emit('eat-first-reveal-trait', {
      peerId: typeof props.peerId === 'string' ? props.peerId : '',
      traitKey: key,
      closed: true,
    })
    return
  }
  if (current === 'pending') return
  eatFirstRevealState.value = { ...eatFirstRevealState.value, [key]: 'pending' }
  eatFirstToastLabel.value = label
  eatFirstToastVisible.value = true
  if (eatFirstToastTimer != null) {
    clearTimeout(eatFirstToastTimer)
  }
  eatFirstToastTimer = setTimeout(() => {
    eatFirstToastVisible.value = false
    eatFirstToastTimer = null
  }, EAT_FIRST_REVEAL_DELAY_MS)
  const existing = eatFirstRevealTimers.get(key)
  if (existing != null) {
    clearTimeout(existing)
  }
  const timer = setTimeout(() => {
    eatFirstRevealState.value = { ...eatFirstRevealState.value, [key]: 'revealed' }
    eatFirstRevealTimers.delete(key)
    emit('eat-first-reveal-trait', {
      peerId: typeof props.peerId === 'string' ? props.peerId : '',
      traitKey: key,
    })
  }, EAT_FIRST_REVEAL_DELAY_MS)
  eatFirstRevealTimers.set(key, timer)
}

function eatFirstRevealEyeLabel(key: EatFirstTraitKey): string {
  return eatFirstTraitStateFor(key) === 'revealed'
    ? 'Приховати характеристику від інших'
    : 'Показати характеристику всім'
}

function onEatFirstGenerateTrait(key: EatFirstTraitKey): void {
  if (!canGenerateTrait()) return
  emit('eat-first-generate-trait', {
    peerId: typeof props.peerId === 'string' ? props.peerId : '',
    traitKey: key,
  })
}

function onEatFirstRerollActionCard(): void {
  if (!isEatFirstTraitHostView()) return
  emit('eat-first-reroll-action-card', {
    peerId: typeof props.peerId === 'string' ? props.peerId : '',
  })
}

function onEatFirstPlayerUseActionCard(): void {
  if (!isEatFirstTraitOwnerView() || isEatFirstTraitHostView()) return
  const card = props.eatFirstActionCard
  if (!card || card.used === true) return
  emit('eat-first-use-action-card', {
    peerId: typeof props.peerId === 'string' ? props.peerId : '',
  })
}


const tilePrimaryLine = computed(() => {
  if (!showSeatBadge.value || typeof resolvedSeatIndex.value !== 'number') {
    return props.displayName
  }
  return normalizeDisplayName(props.displayName)
})

const showRoleBadge = computed(() => !props.streamViewMode && resolvedVisibleRole.value != null)

const roleBadgeLabel = computed(() => {
  const r = resolvedVisibleRole.value
  if (r == null) {
    return ''
  }
  return t(`mafiaPage.nightRole.${r}`)
})

const hasLiveLocalVideo = computed(() => {
  if (!props.stream || !props.isLocal) {
    return false
  }
  void props.playRev
  if (props.videoPresentation === 'none') {
    return false
  }
  return props.stream.getVideoTracks().some((t) => t.readyState === 'live')
})

/** Remote only: at least one video track with `readyState === 'live'` (do not use `muted` / `enabled`). */
const hasLiveVideoTrack = computed(() => {
  if (!props.stream || props.isLocal) {
    return false
  }
  void props.playRev
  return props.stream.getVideoTracks().some((t) => t.readyState === 'live')
})

const showVideo = computed(() => {
  if (!props.stream) {
    return false
  }
  if (props.isLocal) {
    return props.videoEnabled && hasLiveLocalVideo.value
  }
  return props.videoEnabled && hasLiveVideoTrack.value
})

const isDead = computed(() => resolvedLifeState.value === 'dead')
const deadBackgroundUrlText = computed(() => {
  const value = resolvedDeadBackgroundUrl.value
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : ''
})
const hasCustomDeadBackground = computed(() => isDead.value && deadBackgroundUrlText.value.length > 0)


const deadShade = computed(
  () => !props.isLocal && !props.streamViewMode && isDead.value,
)

const eliminationBackgroundClass = computed(() =>
  isDead.value
    ? hasCustomDeadBackground.value
      ? 'tile--mafia-elim-bg-custom'
      : `tile--mafia-elim-bg-${resolvedEliminationBackground.value}`
    : '',
)

/**
 * Per-tile signal that the consumer opted into the neutral `game-*`
 * API (i.e. rendered from the Game Template / GameRoom path):
 * `gameLifeState` is the one `game*` prop the GT call site always binds
 * to a defined value; Mafia never binds it. Used to route user-visible
 * i18n labels (host life toggle title, elimination-background labels)
 * through `gameRoom.*` keys instead of legacy `mafiaPage.*` ones.
 * No route-name coupling: ParticipantTile stays a pure presentational
 * component.
 */
const usesNeutralApi = computed(() => props.gameLifeState !== undefined)

const hostLifeToggleTitle = computed(() => {
  if (usesNeutralApi.value) {
    return isDead.value
      ? t('gameRoom.hostTileReviveTitle')
      : t('gameRoom.hostTileEliminateTitle')
  }
  return isDead.value
    ? t('mafiaPage.hostTileReviveTitle')
    : t('mafiaPage.hostTileEliminateTitle')
})

const eliminationBackgroundGroupLabel = computed(() =>
  usesNeutralApi.value
    ? t('gameRoom.eliminationBackgroundLabel')
    : t('mafiaPage.eliminationBackgroundLabel'),
)

function eliminationBackgroundSwatchLabel(bg: GameEliminationBackground): string {
  return usesNeutralApi.value
    ? t(`gameRoom.eliminationBackground.${bg}`)
    : t(`mafiaPage.eliminationBackground.${bg}`)
}

const deadBackgroundStyle = computed(() =>
  hasCustomDeadBackground.value
    ? { '--mafia-dead-background-image': `url(${JSON.stringify(deadBackgroundUrlText.value)})` }
    : undefined,
)

const resolvedAvatarUrl = computed(() => {
  const u = props.avatarUrl
  return typeof u === 'string' && u.trim().length > 0 ? u.trim() : ''
})


const showCustomDeadBackgroundOnly = computed(() =>
  hasCustomDeadBackground.value && !showVideo.value,
)
const showEliminationMark = computed(
  () => isDead.value && !showCustomDeadBackgroundOnly.value && !showVideo.value,
)
const showAvatar = computed(
  () =>
    !showCustomDeadBackgroundOnly.value &&
    !showEliminationMark.value &&
    !showVideo.value &&
    resolvedAvatarUrl.value !== '',
)
const showInitialsFallback = computed(
  () =>
    !showCustomDeadBackgroundOnly.value &&
    !showEliminationMark.value &&
    !showVideo.value &&
    resolvedAvatarUrl.value === '',
)

const volumePercentUi = computed(() =>
  Math.min(200, Math.max(0, Math.round((props.remoteListenVolume ?? 1) * 100))),
)

const localListenSilenced = computed(
  () =>
    Boolean(props.remoteListenMuted) ||
    (Number(props.remoteListenVolume ?? 1) <= 0.0001),
)

const localListenIconAria = computed(() =>
  localListenSilenced.value ? t('callPage.localListenUnmuteAria') : t('callPage.localListenMuteAria'),
)

/**
 * Stable DOM identity for `<StreamVideo>`: peer id only (no playRev/stream in key).
 * Track/cam changes are handled inside `StreamVideo` via `playRev` + `bindStream`; remounting on every bump was redundant and costly at scale.
 */
const streamVideoStableKey = computed(() =>
  props.isLocal ? 'local' : typeof props.peerId === 'string' && props.peerId.length > 0 ? props.peerId : 'peer',
)

const isSpeaking = computed(() => props.rowSpeaking)

/** Memo deps for the video subtree — label/mic/row speaking can change without patching WebRTC. */
const streamVideoMemoDeps = computed(() => [
  props.stream,
  props.playRev ?? 0,
  showVideo.value,
  hasLiveVideoTrack.value,
  Boolean(props.videoFillCover),
  props.isLocal,
  props.videoPresentation,
  props.mafiaLifeState,
  Boolean(props.videoPlaybackSuppressed),
  props.videoTargetPlaybackFps ?? null,
])

function onVolumeSliderInput(ev: Event): void {
  const t = ev.target as HTMLInputElement
  const pct = Math.min(200, Math.max(0, Number(t.value)))
  const gain = pct / 100
  emit('update:listenVolume', gain)
  if (pct > 0 && (props.remoteListenMuted ?? false)) {
    emit('update:listenMuted', false)
  }
}

function onLocalListenIconClick(): void {
  const vol = Number(props.remoteListenVolume ?? 1)
  const muted = Boolean(props.remoteListenMuted)
  if (!muted && vol > 0.0001) {
    emit('update:listenMuted', true)
    return
  }
  emit('update:listenMuted', false)
}

const killAnim = ref(false)
const reviveAnim = ref(false)
let killAnimTimer: ReturnType<typeof setTimeout> | undefined
let reviveAnimTimer: ReturnType<typeof setTimeout> | undefined

watch(
  () => isDead.value,
  (next, prev) => {
    if (props.isLocal || props.streamViewMode) {
      return
    }
    if (prev === undefined) {
      return
    }
    if (prev === true && next === false) {
      reviveAnim.value = true
      if (reviveAnimTimer != null) {
        clearTimeout(reviveAnimTimer)
      }
      reviveAnimTimer = setTimeout(() => {
        reviveAnim.value = false
        reviveAnimTimer = undefined
      }, 700)
    } else if (prev === false && next === true) {
      killAnim.value = true
      if (killAnimTimer != null) {
        clearTimeout(killAnimTimer)
      }
      killAnimTimer = setTimeout(() => {
        killAnim.value = false
        killAnimTimer = undefined
      }, 420)
    }
  },
)

function onHostLifeClick(): void {
  const id = typeof props.peerId === 'string' ? props.peerId.trim() : ''
  if (id.length < 1) {
    return
  }
  emit('mafia-toggle-life', id)
  emit('game-toggle-life', id)
  if (!isDead.value) {
    emit('mafia-force-camera-off', id)
    emit('game-force-camera-off', id)
  }
}

function setEliminationBackground(background: GameEliminationBackground): void {
  const id = typeof props.peerId === 'string' ? props.peerId.trim() : ''
  if (id.length < 1) {
    return
  }
  emit('mafia-set-elimination-background', { peerId: id, background })
  emit('game-set-elimination-background', { peerId: id, background })
}

onBeforeUnmount(() => {
  if (killAnimTimer != null) {
    clearTimeout(killAnimTimer)
  }
  if (reviveAnimTimer != null) {
    clearTimeout(reviveAnimTimer)
  }
  disconnectTileLayerObserver()
  tileLayerLastEmitted = null
  if (resolvedLayerViewportObserve.value && !props.isLocal) {
    emit('mafia-viewport-layers', true)
    emit('game-viewport-layers', true)
  }
})

function disconnectTileLayerObserver(): void {
  if (tileLayerObserver) {
    tileLayerObserver.disconnect()
    tileLayerObserver = null
  }
}

function emitTileLayerViewport(visible: boolean): void {
  if (tileLayerLastEmitted === visible) {
    return
  }
  tileLayerLastEmitted = visible
  emit('mafia-viewport-layers', visible)
  emit('game-viewport-layers', visible)
}

function connectTileLayerObserver(): void {
  disconnectTileLayerObserver()
  tileLayerLastEmitted = null
  if (typeof window === 'undefined' || !resolvedLayerViewportObserve.value || props.isLocal) {
    return
  }
  const id = peerIdForNameEdit()
  if (!id) {
    return
  }
  const el = tileRootRef.value
  if (!el) {
    return
  }
  tileLayerObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.target === el) {
          emitTileLayerViewport(entry.isIntersecting)
        }
      }
    },
    { root: null, rootMargin: '10% 10% 10% 10%', threshold: 0 },
  )
  tileLayerObserver.observe(el)
}

function scheduleTileLayerObserverConnect(): void {
  void nextTick(() => {
    if (!resolvedLayerViewportObserve.value || props.isLocal) {
      disconnectTileLayerObserver()
      tileLayerLastEmitted = null
      return
    }
    connectTileLayerObserver()
  })
}

watch(
  () => [resolvedLayerViewportObserve.value, props.isLocal, props.peerId] as const,
  () => {
    scheduleTileLayerObserverConnect()
  },
  { flush: 'post' },
)

onMounted(() => {
  scheduleTileLayerObserverConnect()
})

if (import.meta.env.DEV) {
  watch(
    () =>
      [
        props.peerId,
        props.isLocal,
        showVideo.value,
        props.videoPresentation,
        props.videoFillCover,
        props.stream,
        props.playRev,
        hasLiveVideoTrack.value,
        props.videoEnabled,
      ] as const,
    () => {
      if (props.isLocal) {
        return
      }
      const v = props.stream?.getVideoTracks()[0]
      tileLog.debug('remote tile', {
        peerId: props.peerId,
        showVideo: showVideo.value,
        videoPresentation: props.videoPresentation,
        videoEnabled: props.videoEnabled,
        hasLiveVideoTrack: hasLiveVideoTrack.value,
        vt: v
          ? {
              readyState: v.readyState,
              muted: v.muted,
              enabled: v.enabled,
            }
          : null,
      })
    },
    { flush: 'post' },
  )
}
</script>

<template>
  <div
    ref="tileRootRef"
    class="tile"
    draggable="false"
    :data-video-presentation="videoPresentation"
    :class="[
      `tile--${sizeTier}`,
      eliminationBackgroundClass,
      {
        'is-speaking': isSpeaking,
        'tile--speaking': isSpeaking,
        'tile--mafia-kill-anim': killAnim,
        'tile--mafia-revive-glow': reviveAnim,
      },
    ]"
    :style="deadBackgroundStyle"
  >
    <div class="tile-media">
      <div
        v-if="hasEatFirstTraits"
        class="tile-eat-first-overlay"
        :class="{ 'tile-eat-first-overlay--insight': eatFirstTraitInsightLayout() }"
        aria-hidden="false"
      >
        <div class="tile-eat-first-overlay__top">
          <div
            v-for="item in eatFirstTraitsBySection.top"
            :key="`eatf-top-${item.key}`"
            class="tile-eat-first-card tile-eat-first-card--mini"
            :class="{
              'tile-eat-first-card--pending': eatFirstTraitStateFor(item.key) === 'pending',
              'tile-eat-first-card--revealed': eatFirstTraitStateFor(item.key) === 'revealed',
              'tile-eat-first-card--sealed': eatFirstTraitCellSealed(item.key),
              'tile-eat-first-card--insight': eatFirstTraitInsightLayout(),
            }"
          >
            <span class="tile-eat-first-card__icon" aria-hidden="true">
              <svg
                v-if="item.key === 'gender'"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
              >
                <path d="M15 3h6v6" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M21 3l-5 5" stroke-linecap="round" stroke-linejoin="round" />
                <circle cx="10" cy="14" r="5" />
              </svg>
              <svg
                v-else
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
              >
                <rect x="3.5" y="5.5" width="17" height="15" rx="2.2" />
                <path d="M8 3.5v4M16 3.5v4M3.5 10.5h17" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </span>
            <span class="tile-eat-first-card__main">
              <span class="tile-eat-first-card__title">{{ item.label.toUpperCase() }}</span>
              <span
                class="tile-eat-first-card__value"
                :class="{ 'tile-eat-first-card__value--peer-hidden': eatFirstPeerShowsHiddenEyeMark(item.key) }"
              >
                <template v-if="eatFirstPeerShowsHiddenEyeMark(item.key)">
                  <span class="tile-eat-first-card__peer-hidden-eye" aria-hidden="true">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                    >
                      <path d="M3 3l18 18" stroke-linecap="round" stroke-linejoin="round" />
                      <path d="M10.8 6.1A12.6 12.6 0 0 1 12 5.8c6.7 0 10.5 6.2 10.5 6.2a18 18 0 0 1-3.1 3.9" />
                      <path d="M14.2 14.2a3.2 3.2 0 0 1-4.4-4.4" />
                      <path d="M6.1 8.1A18.8 18.8 0 0 0 1.5 12s3.8 6.2 10.5 6.2a12.6 12.6 0 0 0 3.3-.4" />
                    </svg>
                  </span>
                </template>
                <template v-else>
                  <span
                    v-for="(line, eatFirstLineIdx) in eatFirstValueDisplayLines(item.key, item.value)"
                    :key="`eatf-mini-val-${item.key}-${eatFirstLineIdx}`"
                    class="tile-eat-first-card__value-line"
                  >
                    {{ line }}
                  </span>
                </template>
              </span>
            </span>
            <span v-if="canGenerateTrait() || canRevealTrait()" class="tile-eat-first-card__actions">
              <button
                v-if="canGenerateTrait()"
                type="button"
                class="tile-eat-first-card__action-btn tile-eat-first-card__action-btn--dice"
                @click.stop="onEatFirstGenerateTrait(item.key)"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <rect x="5" y="5" width="14" height="14" rx="2.4" />
                  <circle cx="9" cy="9" r="1.1" fill="currentColor" stroke="none" />
                  <circle cx="15" cy="15" r="1.1" fill="currentColor" stroke="none" />
                  <circle cx="9" cy="15" r="1.1" fill="currentColor" stroke="none" />
                  <circle cx="15" cy="9" r="1.1" fill="currentColor" stroke="none" />
                </svg>
              </button>
              <button
                v-if="canRevealTrait()"
                type="button"
                class="tile-eat-first-card__eye-btn"
                :aria-label="eatFirstRevealEyeLabel(item.key)"
                @click.stop="onEatFirstReveal(item.key, item.label)"
              >
                <svg
                  v-if="eatFirstTraitStateFor(item.key) === 'revealed'"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  aria-hidden="true"
                >
                  <path d="M1.5 12s3.8-6.5 10.5-6.5S22.5 12 22.5 12s-3.8 6.5-10.5 6.5S1.5 12 1.5 12Z" />
                  <circle cx="12" cy="12" r="3.2" />
                </svg>
                <svg
                  v-else
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  aria-hidden="true"
                >
                  <path d="M3 3l18 18" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M10.8 6.1A12.6 12.6 0 0 1 12 5.8c6.7 0 10.5 6.2 10.5 6.2a18 18 0 0 1-3.1 3.9" />
                  <path d="M14.2 14.2a3.2 3.2 0 0 1-4.4-4.4" />
                  <path d="M6.1 8.1A18.8 18.8 0 0 0 1.5 12s3.8 6.2 10.5 6.2a12.6 12.6 0 0 0 3.3-.4" />
                </svg>
              </button>
            </span>
          </div>
        </div>

        <div class="tile-eat-first-overlay__columns">
          <div class="tile-eat-first-overlay__column tile-eat-first-overlay__column--left">
            <div
              v-for="item in eatFirstTraitsBySection.left"
              :key="`eatf-left-${item.key}`"
              class="tile-eat-first-card"
              :class="{
                'tile-eat-first-card--pending': eatFirstTraitStateFor(item.key) === 'pending',
                'tile-eat-first-card--revealed': eatFirstTraitStateFor(item.key) === 'revealed',
                'tile-eat-first-card--sealed': eatFirstTraitCellSealed(item.key),
                'tile-eat-first-card--insight': eatFirstTraitInsightLayout(),
              }"
            >
              <span class="tile-eat-first-card__icon" aria-hidden="true">
                <svg
                  v-if="item.key === 'profession'"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                >
                  <rect x="3.5" y="7" width="17" height="12" rx="2.2" />
                  <path d="M9 7V5.5h6V7M3.5 11.5h17" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <svg
                  v-else-if="item.key === 'health'"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                >
                  <path
                    d="M3 12h3l2-3 3 7 2-4h3l2-3 3 3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                <svg
                  v-else
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                >
                  <path d="M6 9.5h12M7 9.5V8a2 2 0 1 1 4 0v1.5M13 9.5V8a2 2 0 1 1 4 0v1.5" />
                  <rect x="4" y="9.5" width="16" height="9.5" rx="3" />
                  <path d="M9.5 14h5" stroke-linecap="round" />
                </svg>
              </span>
              <span class="tile-eat-first-card__main">
                <span class="tile-eat-first-card__title">{{ item.label.toUpperCase() }}</span>
                <span
                  class="tile-eat-first-card__value"
                  :class="{ 'tile-eat-first-card__value--peer-hidden': eatFirstPeerShowsHiddenEyeMark(item.key) }"
                >
                  <template v-if="eatFirstPeerShowsHiddenEyeMark(item.key)">
                    <span class="tile-eat-first-card__peer-hidden-eye" aria-hidden="true">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                      >
                        <path d="M3 3l18 18" stroke-linecap="round" stroke-linejoin="round" />
                        <path d="M10.8 6.1A12.6 12.6 0 0 1 12 5.8c6.7 0 10.5 6.2 10.5 6.2a18 18 0 0 1-3.1 3.9" />
                        <path d="M14.2 14.2a3.2 3.2 0 0 1-4.4-4.4" />
                        <path d="M6.1 8.1A18.8 18.8 0 0 0 1.5 12s3.8 6.2 10.5 6.2a12.6 12.6 0 0 0 3.3-.4" />
                      </svg>
                    </span>
                  </template>
                  <template v-else>
                    <span
                      v-for="(line, eatFirstLineIdx) in eatFirstValueDisplayLines(item.key, item.value)"
                      :key="`eatf-left-val-${item.key}-${eatFirstLineIdx}`"
                      class="tile-eat-first-card__value-line"
                    >
                      {{ line }}
                    </span>
                  </template>
                </span>
              </span>
              <span v-if="canGenerateTrait() || canRevealTrait()" class="tile-eat-first-card__actions">
                <button
                  v-if="canGenerateTrait()"
                  type="button"
                  class="tile-eat-first-card__action-btn tile-eat-first-card__action-btn--dice"
                  @click.stop="onEatFirstGenerateTrait(item.key)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <rect x="5" y="5" width="14" height="14" rx="2.4" />
                    <circle cx="9" cy="9" r="1.1" fill="currentColor" stroke="none" />
                    <circle cx="15" cy="15" r="1.1" fill="currentColor" stroke="none" />
                    <circle cx="9" cy="15" r="1.1" fill="currentColor" stroke="none" />
                    <circle cx="15" cy="9" r="1.1" fill="currentColor" stroke="none" />
                  </svg>
                </button>
                <button
                  v-if="canRevealTrait()"
                  type="button"
                  class="tile-eat-first-card__eye-btn"
                  :aria-label="eatFirstRevealEyeLabel(item.key)"
                  @click.stop="onEatFirstReveal(item.key, item.label)"
                >
                  <svg
                    v-if="eatFirstTraitStateFor(item.key) === 'revealed'"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    aria-hidden="true"
                  >
                    <path d="M1.5 12s3.8-6.5 10.5-6.5S22.5 12 22.5 12s-3.8 6.5-10.5 6.5S1.5 12 1.5 12Z" />
                    <circle cx="12" cy="12" r="3.2" />
                  </svg>
                  <svg
                    v-else
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    aria-hidden="true"
                  >
                    <path d="M3 3l18 18" stroke-linecap="round" stroke-linejoin="round" />
                    <path d="M10.8 6.1A12.6 12.6 0 0 1 12 5.8c6.7 0 10.5 6.2 10.5 6.2a18 18 0 0 1-3.1 3.9" />
                    <path d="M14.2 14.2a3.2 3.2 0 0 1-4.4-4.4" />
                    <path d="M6.1 8.1A18.8 18.8 0 0 0 1.5 12s3.8 6.2 10.5 6.2a12.6 12.6 0 0 0 3.3-.4" />
                  </svg>
                </button>
              </span>
            </div>
          </div>

          <div class="tile-eat-first-overlay__column tile-eat-first-overlay__column--right">
            <div
              v-for="item in eatFirstTraitsBySection.right"
              :key="`eatf-right-${item.key}`"
              class="tile-eat-first-card"
              :class="{
                'tile-eat-first-card--pending': eatFirstTraitStateFor(item.key) === 'pending',
                'tile-eat-first-card--revealed': eatFirstTraitStateFor(item.key) === 'revealed',
                'tile-eat-first-card--sealed': eatFirstTraitCellSealed(item.key),
                'tile-eat-first-card--insight': eatFirstTraitInsightLayout(),
              }"
            >
              <span class="tile-eat-first-card__icon" aria-hidden="true">
                <svg
                  v-if="item.key === 'phobia'"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                >
                  <circle cx="12" cy="12" r="2.3" />
                  <path d="M12 4v3M12 17v3M4 12h3M17 12h3M6.2 6.2l2.1 2.1M15.7 15.7l2.1 2.1M17.8 6.2l-2.1 2.1M8.3 15.7l-2.1 2.1" />
                </svg>
                <svg
                  v-else-if="item.key === 'fact'"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                >
                  <path d="M12 3l1.9 4.1L18 9l-4.1 1.9L12 15l-1.9-4.1L6 9l4.1-1.9Z" />
                </svg>
                <svg
                  v-else
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                >
                  <rect x="5" y="8" width="14" height="11" rx="2.2" />
                  <path d="M9 8V6h6v2M12 11.5v4M10 13.5h4" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
              <span class="tile-eat-first-card__main">
                <span class="tile-eat-first-card__title">{{ item.label.toUpperCase() }}</span>
                <span
                  class="tile-eat-first-card__value"
                  :class="{ 'tile-eat-first-card__value--peer-hidden': eatFirstPeerShowsHiddenEyeMark(item.key) }"
                >
                  <template v-if="eatFirstPeerShowsHiddenEyeMark(item.key)">
                    <span class="tile-eat-first-card__peer-hidden-eye" aria-hidden="true">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                      >
                        <path d="M3 3l18 18" stroke-linecap="round" stroke-linejoin="round" />
                        <path d="M10.8 6.1A12.6 12.6 0 0 1 12 5.8c6.7 0 10.5 6.2 10.5 6.2a18 18 0 0 1-3.1 3.9" />
                        <path d="M14.2 14.2a3.2 3.2 0 0 1-4.4-4.4" />
                        <path d="M6.1 8.1A18.8 18.8 0 0 0 1.5 12s3.8 6.2 10.5 6.2a12.6 12.6 0 0 0 3.3-.4" />
                      </svg>
                    </span>
                  </template>
                  <template v-else>
                    <span
                      v-for="(line, eatFirstLineIdx) in eatFirstValueDisplayLines(item.key, item.value)"
                      :key="`eatf-right-val-${item.key}-${eatFirstLineIdx}`"
                      class="tile-eat-first-card__value-line"
                    >
                      {{ line }}
                    </span>
                  </template>
                </span>
              </span>
              <span v-if="canGenerateTrait() || canRevealTrait()" class="tile-eat-first-card__actions">
                <button
                  v-if="canGenerateTrait()"
                  type="button"
                  class="tile-eat-first-card__action-btn tile-eat-first-card__action-btn--dice"
                  @click.stop="onEatFirstGenerateTrait(item.key)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <rect x="5" y="5" width="14" height="14" rx="2.4" />
                    <circle cx="9" cy="9" r="1.1" fill="currentColor" stroke="none" />
                    <circle cx="15" cy="15" r="1.1" fill="currentColor" stroke="none" />
                    <circle cx="9" cy="15" r="1.1" fill="currentColor" stroke="none" />
                    <circle cx="15" cy="9" r="1.1" fill="currentColor" stroke="none" />
                  </svg>
                </button>
                <button
                  v-if="canRevealTrait()"
                  type="button"
                  class="tile-eat-first-card__eye-btn"
                  :aria-label="eatFirstRevealEyeLabel(item.key)"
                  @click.stop="onEatFirstReveal(item.key, item.label)"
                >
                  <svg
                    v-if="eatFirstTraitStateFor(item.key) === 'revealed'"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    aria-hidden="true"
                  >
                    <path d="M1.5 12s3.8-6.5 10.5-6.5S22.5 12 22.5 12s-3.8 6.5-10.5 6.5S1.5 12 1.5 12Z" />
                    <circle cx="12" cy="12" r="3.2" />
                  </svg>
                  <svg
                    v-else
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    aria-hidden="true"
                  >
                    <path d="M3 3l18 18" stroke-linecap="round" stroke-linejoin="round" />
                    <path d="M10.8 6.1A12.6 12.6 0 0 1 12 5.8c6.7 0 10.5 6.2 10.5 6.2a18 18 0 0 1-3.1 3.9" />
                    <path d="M14.2 14.2a3.2 3.2 0 0 1-4.4-4.4" />
                    <path d="M6.1 8.1A18.8 18.8 0 0 0 1.5 12s3.8 6.2 10.5 6.2a12.6 12.6 0 0 0 3.3-.4" />
                  </svg>
                </button>
              </span>
            </div>
          </div>
        </div>

        <div
          v-if="eatFirstActionCard != null && eatFirstActionCard.title.length > 0"
          class="tile-eat-first-action-card"
          :class="{
            'tile-eat-first-action-card--used-host':
              isEatFirstTraitHostView() && eatFirstActionCard.used === true,
          }"
          role="group"
          :aria-label="t('eatFirstCall.actionCardGroupAria')"
        >
          <button
            v-if="isEatFirstTraitOwnerView() && !isEatFirstTraitHostView()"
            type="button"
            class="tile-eat-first-action-card__use-btn"
            :disabled="eatFirstActionCard.used === true"
            :aria-label="
              eatFirstActionCard.used === true
                ? t('eatFirstCall.actionCardAlreadyUsedAria')
                : t('eatFirstCall.useActionCardAria')
            "
            @click.stop="onEatFirstPlayerUseActionCard"
          >
            {{ eatFirstActionCard.title }}
          </button>
          <span v-else class="tile-eat-first-action-card__title">
            {{ eatFirstActionCard.title }}
          </span>
          <button
            v-if="isEatFirstTraitHostView()"
            type="button"
            class="tile-eat-first-action-card__btn"
            :title="t('eatFirstCall.rerollActionCardTitle')"
            :aria-label="t('eatFirstCall.rerollActionCardTitle')"
            @click.stop="onEatFirstRerollActionCard"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" aria-hidden="true">
              <rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" stroke-width="1.8" />
              <circle cx="9" cy="9" r="1.3" fill="currentColor" />
              <circle cx="15" cy="9" r="1.3" fill="currentColor" />
              <circle cx="12" cy="12" r="1.3" fill="currentColor" />
              <circle cx="9" cy="15" r="1.3" fill="currentColor" />
              <circle cx="15" cy="15" r="1.3" fill="currentColor" />
            </svg>
          </button>
        </div>

        <div v-if="eatFirstToastVisible" class="tile-eat-first-toast" role="status" aria-live="polite">
          <p class="tile-eat-first-toast__line">
            Ти відкриваєш: <span class="tile-eat-first-toast__accent">{{ eatFirstToastLabel }}</span>
          </p>
          <p class="tile-eat-first-toast__line">Інші гравці побачать через 3 сек.</p>
        </div>
      </div>
      <!-- v-memo: label/speaking zoom/etc. must not re-patch WebRTC elements when only metadata changes. -->
      <StreamAudio
        v-if="!isLocal && audioSplitStream"
        class="tile-audio"
        v-memo="[
          audioSplitStream,
          playRev ?? 0,
          remoteListenVolume ?? 1,
          remoteListenMuted ?? false,
        ]"
        :stream="audioSplitStream"
        :play-rev="playRev"
        :listen-volume="remoteListenVolume ?? 1"
        :listen-muted="remoteListenMuted ?? false"
        :peer-id="peerId"
        :audio-enabled="audioEnabled"
        @audio-stall="(p) => emit('audio-stall', p)"
      />
      <div
        v-show="showVideo"
        class="tile-video-wrap"
        :class="{ 'tile-video-wrap--mafia-dead': deadShade }"
      >
        <div class="tile-video-clip" v-memo="streamVideoMemoDeps">
          <StreamVideo
            :key="streamVideoStableKey"
            :stream="stream"
            muted
            :play-rev="playRev"
            :report-video-ui="false"
            :remote-playback-stall-peer-id="remotePlaybackStallPeerIdForVideo"
            :peer-id="remotePlaybackStallPeerIdForVideo"
            :video-presentation="
              videoPresentation && videoPresentation !== 'none' ? videoPresentation : undefined
            "
            fill
            :fill-cover="Boolean(videoFillCover)"
            :playback-suppressed="!showVideo || Boolean(videoPlaybackSuppressed)"
            :target-playback-fps="videoTargetPlaybackFps"
            @remote-playback-stall="(p) => emit('remote-playback-stall', p)"
            @video-stall="(p) => emit('video-stall', p)"
          />
        </div>
        <div v-if="deadShade" class="tile-dead-veneer" aria-hidden="true" />
        <div class="tile-overlay" aria-hidden="false">
          <div
            v-if="!editingName"
            class="tile-overlay__label-group"
            :class="{ 'tile-overlay__label-group--editable': !streamViewMode }"
            :title="streamViewMode ? undefined : t('callPage.renameLocalHint')"
            @dblclick.stop="startNameEdit"
          >
            <span
              v-if="showSeatBadge"
              class="tile-overlay__seat-badge"
              aria-hidden="true"
              >{{ resolvedSeatIndex }}</span
            >
            <span
              v-if="showRoleBadge"
              class="tile-overlay__role-badge"
              :title="roleBadgeLabel"
              aria-hidden="true"
              >{{ roleBadgeLabel }}</span
            >
            <span class="tile-overlay__identity">
              <span
                class="tile-overlay__display-name"
                :class="{ 'tile-overlay__display-name--editable': !streamViewMode }"
              >{{ tilePrimaryLine }}</span>
            </span>
          </div>
          <div v-else class="tile-overlay__name-edit">
            <span v-if="showSeatBadge" class="tile-overlay__seat-badge" aria-hidden="true">{{ resolvedSeatIndex }}</span>
            <span
              v-if="showRoleBadge"
              class="tile-overlay__role-badge"
              :title="roleBadgeLabel"
              aria-hidden="true"
              >{{ roleBadgeLabel }}</span
            >
            <input
              ref="nameInputRef"
              v-model="nameDraft"
              class="tile-overlay__name-input"
              type="text"
              maxlength="64"
              :aria-label="t('callPage.editNameAria')"
              @blur="finishNameEdit"
              @keydown.enter.prevent="onNameInputEnter"
              @keydown.escape.prevent="cancelNameEdit"
            />
          </div>
          <span v-if="!streamViewMode" class="tile-overlay__icons" aria-hidden="true">
            <span v-if="raiseHand" class="tile-overlay__hand" :title="t('callPage.raiseHandBadge')" aria-hidden="true"
              >✋</span
            >
            <span class="tile-overlay__mic" :class="{ 'tile-overlay__mic--off': !audioEnabled }">
              <svg
                v-if="audioEnabled"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                width="15"
                height="15"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 3c-1.66 0-3 1.2-3 2.7v4.6c0 1.5 1.34 2.7 3 2.7s3-1.2 3-2.7V5.7C15 4.2 13.66 3 12 3Z"
                />
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v3" />
              </svg>
              <svg
                v-else
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                width="15"
                height="15"
              >
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                <path d="M12 19v3" />
                <path d="M3 3l18 18" />
              </svg>
            </span>
          </span>
        </div>
      </div>
      <div v-if="!showVideo" class="tile-placeholder">
        <div class="tile-placeholder__main">
          <GameEliminationMark
            v-if="showEliminationMark"
            class="tile-placeholder-elimination"
            :kind="resolvedEliminationKind"
            :icon-src="resolvedEliminationIconSrc"
          />
          <img
            v-else-if="showAvatar"
            class="tile-placeholder-avatar tile-placeholder-avatar--img"
            :src="resolvedAvatarUrl"
            alt=""
            decoding="async"
            loading="lazy"
          />
          <span v-else-if="showInitialsFallback" class="tile-placeholder-avatar">{{
            initials(typeof avatarFallbackName === 'string' && avatarFallbackName.trim().length > 0 ? avatarFallbackName : displayName)
          }}</span>
        </div>
        <div class="tile-overlay tile-overlay--on-placeholder" aria-hidden="false">
          <div
            v-if="!editingName"
            class="tile-overlay__label-group"
            :class="{ 'tile-overlay__label-group--editable': !streamViewMode }"
            :title="streamViewMode ? undefined : t('callPage.renameLocalHint')"
            @dblclick.stop="startNameEdit"
          >
            <span
              v-if="showSeatBadge"
              class="tile-overlay__seat-badge"
              aria-hidden="true"
              >{{ resolvedSeatIndex }}</span
            >
            <span
              v-if="showRoleBadge"
              class="tile-overlay__role-badge"
              :title="roleBadgeLabel"
              aria-hidden="true"
              >{{ roleBadgeLabel }}</span
            >
            <span class="tile-overlay__identity">
              <span
                class="tile-overlay__display-name"
                :class="{ 'tile-overlay__display-name--editable': !streamViewMode }"
              >{{ tilePrimaryLine }}</span>
            </span>
          </div>
          <div v-else class="tile-overlay__name-edit">
            <span v-if="showSeatBadge" class="tile-overlay__seat-badge" aria-hidden="true">{{ resolvedSeatIndex }}</span>
            <span
              v-if="showRoleBadge"
              class="tile-overlay__role-badge"
              :title="roleBadgeLabel"
              aria-hidden="true"
              >{{ roleBadgeLabel }}</span
            >
            <input
              ref="nameInputRef"
              v-model="nameDraft"
              class="tile-overlay__name-input"
              type="text"
              maxlength="64"
              :aria-label="t('callPage.editNameAria')"
              @blur="finishNameEdit"
              @keydown.enter.prevent="onNameInputEnter"
              @keydown.escape.prevent="cancelNameEdit"
            />
          </div>
          <span v-if="!streamViewMode" class="tile-overlay__icons" aria-hidden="true">
            <span v-if="raiseHand" class="tile-overlay__hand" :title="t('callPage.raiseHandBadge')" aria-hidden="true"
              >✋</span
            >
            <span class="tile-overlay__mic" :class="{ 'tile-overlay__mic--off': !audioEnabled }">
              <svg
                v-if="audioEnabled"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                width="15"
                height="15"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 3c-1.66 0-3 1.2-3 2.7v4.6c0 1.5 1.34 2.7 3 2.7s3-1.2 3-2.7V5.7C15 4.2 13.66 3 12 3Z"
                />
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v3" />
              </svg>
              <svg
                v-else
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                width="15"
                height="15"
              >
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                <path d="M12 19v3" />
                <path d="M3 3l18 18" />
              </svg>
            </span>
          </span>
        </div>
      </div>
      <div v-if="!isLocal && !streamViewMode" class="tile-menu-cluster">
        <button
          v-if="resolvedHostShowLifeToggle"
          type="button"
          class="tile-menu__life"
          :class="{ 'tile-menu__life--revive': isDead }"
          data-no-mafia-tile-host
          data-no-game-room-tile-host
          :title="hostLifeToggleTitle"
          :aria-label="hostLifeToggleTitle"
          @click.stop="onHostLifeClick"
        >
          <span class="tile-menu__life-ico" aria-hidden="true">{{
            isDead ? '👤' : '💀'
          }}</span>
        </button>
        <div class="tile-remote-volume tile-menu-hoverable tile-menu-hoverable--remote">
          <div class="tile-menu tile-menu--remote">
            <button
              type="button"
              class="tile-remote-volume__trigger"
              draggable="false"
              :aria-label="localListenIconAria"
              :aria-pressed="localListenSilenced"
              @click.stop="onLocalListenIconClick"
            >
              <svg
                v-if="!localListenSilenced"
                class="tile-remote-volume__ico"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                width="18"
                height="18"
                aria-hidden="true"
              >
                <path d="M11 5 6 9H2v6h4l5 4V5Z" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
              <svg
                v-else
                class="tile-remote-volume__ico"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                width="18"
                height="18"
                aria-hidden="true"
              >
                <path d="M11 5 6 9H2v6h4l5 4V5Z" />
                <path d="m22 9-6 6M16 9l6 6" />
              </svg>
            </button>
            <div
              class="tile-menu__dropdown tile-remote-volume__dropdown"
              draggable="false"
              @click.stop
              @dragstart.stop.prevent
              @mousedown.stop
              @pointerdown.stop
              @touchstart.stop
            >
              <label class="tile-menu__row">
                <span class="tile-menu__label">{{ t('callPage.listenVolume') }}</span>
                <span class="tile-menu__pct">{{ volumePercentUi }}%</span>
              </label>
              <input
                class="tile-menu__range"
                type="range"
                min="0"
                max="200"
                step="1"
                :value="volumePercentUi"
                :aria-label="t('callPage.localListenVolumeSliderAria')"
                draggable="false"
                @input="onVolumeSliderInput"
                @click.stop
                @dragstart.stop.prevent
                @mousedown.stop
                @pointerdown.stop
                @touchstart.stop
              />
              <div v-if="isDead" class="tile-menu__row tile-menu__row--mafia-bg">
                <span class="tile-menu__label">{{ eliminationBackgroundGroupLabel }}</span>
                <div class="tile-menu__swatches" role="group" :aria-label="eliminationBackgroundGroupLabel">
                  <button
                    v-for="bg in ELIMINATION_BACKGROUND_OPTIONS"
                    :key="bg"
                    type="button"
                    class="tile-menu__swatch"
                    :class="[`tile-menu__swatch--${bg}`, { 'tile-menu__swatch--active': resolvedEliminationBackground === bg }]"
                    :aria-label="eliminationBackgroundSwatchLabel(bg)"
                    :aria-pressed="resolvedEliminationBackground === bg"
                    @click="setEliminationBackground(bg)"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tile {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  border-radius: 14px;
  overflow: hidden;
  background: transparent;
  border: 1px solid var(--call-tile-border, #2e303a);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

/**
 * Active talker: Web Audio RMS in call-core (remotes) or `useLocalTileSpeakingVisual` (local).
 * Outer glow + tile scale live on `CallPage` `.call-page__tile-wrap` (grid `overflow` clips inner shadow).
 * Here: border + inner video nudge only.
 */
.tile.is-speaking {
  overflow: visible;
  z-index: 1;
  border-color: color-mix(in srgb, #a855f7 40%, var(--call-tile-border, #2e303a));
}

.tile.is-speaking .tile-video-wrap {
  transform: none;
}

.tile:hover:not(.is-speaking),
.tile:focus-within:not(.is-speaking) {
  transform: scale(1.01);
  border-color: color-mix(in srgb, var(--sa-color-border, #2e303a) 80%, transparent);
}

.tile:has(.tile-remote-volume:hover),
.tile:has(.tile-remote-volume:focus-within) {
  overflow: visible;
  z-index: 4;
}

.tile--mafia-kill-anim {
  animation: mafia-tile-kill 0.42s ease;
}

.tile--mafia-revive-glow {
  animation: mafia-tile-revive 0.7s ease;
}

@keyframes mafia-tile-kill {
  0% {
    box-shadow: inset 0 0 0 0 rgb(239 68 68 / 0);
  }
  45% {
    box-shadow:
      inset 0 0 0 1px rgb(239 68 68 / 0.32),
      0 0 16px rgb(127 29 29 / 0.24);
  }
  100% {
    box-shadow: inset 0 0 0 0 rgb(239 68 68 / 0);
  }
}

@keyframes mafia-dead-background-in {
  from {
    opacity: 0.82;
  }
  to {
    opacity: 1;
  }
}

@keyframes mafia-tile-revive {
  0%,
  100% {
    box-shadow: 0 0 0 0 color-mix(in srgb, #22c55e 0%, transparent);
  }
  40% {
    box-shadow: 0 0 0 3px color-mix(in srgb, #4ade80 50%, transparent),
      0 0 20px color-mix(in srgb, #22c55e 45%, transparent);
  }
}

@media (prefers-reduced-motion: reduce) {
  .tile--mafia-kill-anim,
  .tile--mafia-revive-glow {
    animation: none;
  }

  .tile--speaking .tile-video-wrap {
    transform: none;
  }

  .tile.is-speaking {
    box-shadow: 0 0 0 1px rgba(168, 85, 247, 0.45);
    transform: none;
  }

  .tile-video-wrap {
    transition: none;
  }
}

.tile-media {
  position: relative;
  flex: 0 0 auto;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  aspect-ratio: 16 / 9;
  
  background: #050508;
  border-radius: 14px;
  container-type: size;
}

.tile-audio {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 0;
}


.tile-video-wrap {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: #000;
  border-radius: 14px;
  
  overflow: hidden;
  transform-origin: center center;
  transition: transform 0.2s ease;
}

.tile--speaking .tile-video-wrap {
  transform: scale(1.02);
}

.tile-video-wrap--mafia-dead .tile-video-clip {
  filter: grayscale(0.9) brightness(0.5);
  transition: filter 0.32s ease;
}

.tile--mafia-elim-bg-dark .tile-media {
  background: transparent;
}

.tile--mafia-elim-bg-dark .tile-video-wrap,
.tile--mafia-elim-bg-dark .tile-placeholder {
  background: linear-gradient(135deg, rgb(3 7 18 / 0.6), rgb(43 45 49 / 0.6));
  animation: mafia-dead-background-in 0.22s ease-out both;
}

.tile--mafia-elim-bg-red .tile-video-wrap,
.tile--mafia-elim-bg-red .tile-placeholder {
  background: radial-gradient(circle at 50% 34%, rgb(127 29 29 / 0.9), rgb(24 8 12) 66%, #050205);
  animation: mafia-dead-background-in 0.22s ease-out both;
}

.tile--mafia-elim-bg-violet .tile-video-wrap,
.tile--mafia-elim-bg-violet .tile-placeholder {
  background: radial-gradient(circle at 50% 32%, rgb(88 28 135 / 0.88), rgb(24 12 45) 62%, #07030f);
  animation: mafia-dead-background-in 0.22s ease-out both;
}

.tile--mafia-elim-bg-gray .tile-video-wrap,
.tile--mafia-elim-bg-gray .tile-placeholder {
  background: radial-gradient(circle at 50% 32%, rgb(71 85 105 / 0.86), rgb(17 24 39) 62%, #030712);
  animation: mafia-dead-background-in 0.22s ease-out both;
}

.tile--mafia-elim-bg-custom .tile-video-wrap,
.tile--mafia-elim-bg-custom .tile-placeholder {
  background: var(--mafia-dead-background-image) center / cover no-repeat #050205;
  animation: mafia-dead-background-in 0.22s ease-out both;
}

.tile-dead-veneer {
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: 14px;
  pointer-events: none;
  background: linear-gradient(180deg, rgb(0 0 0 / 0.35) 0%, rgb(0 0 0 / 0.6) 100%);
  transition: opacity 0.32s ease;
}

.tile--mafia-elim-bg-red .tile-dead-veneer {
  background:
    radial-gradient(circle at 50% 34%, rgb(220 38 38 / 0.34), transparent 58%),
    linear-gradient(180deg, rgb(31 0 0 / 0.45), rgb(0 0 0 / 0.7));
}

.tile--mafia-elim-bg-violet .tile-dead-veneer {
  background:
    radial-gradient(circle at 50% 34%, rgb(168 85 247 / 0.3), transparent 58%),
    linear-gradient(180deg, rgb(20 8 45 / 0.5), rgb(0 0 0 / 0.72));
}

.tile--mafia-elim-bg-gray .tile-dead-veneer {
  background:
    radial-gradient(circle at 50% 34%, rgb(148 163 184 / 0.2), transparent 58%),
    linear-gradient(180deg, rgb(15 23 42 / 0.55), rgb(0 0 0 / 0.72));
}

.tile-video-clip {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  overflow: hidden;
  z-index: 0;

  clip-path: inset(0 round 14px);
  /* The clip already has `overflow: hidden` + `clip-path`, so painting is bounded.
     `contain: layout paint` lets the browser decouple internal video relayouts
     and decode-driven repaints from the grid, without changing visuals. */
  contain: layout paint;
}

.tile-video-wrap :deep(.stream-video) {
  width: 100%;
  height: 100%;
  border-radius: inherit;
}





@media (max-width: 768px) {
  .tile-video-clip :deep(.stream-video--fill) {
    object-fit: contain !important;
  }
}

.tile-eat-first-overlay {
  position: absolute;
  inset: 0;
  z-index: 3;
  padding: 7px;
  border-radius: 14px;
  border: 1px solid rgb(168 85 247 / 0.34);
  box-shadow:
    inset 0 0 0 1px rgb(168 85 247 / 0.08),
    0 0 16px rgb(88 28 135 / 0.16);
  pointer-events: none;
}

.tile-eat-first-overlay--insight .tile-eat-first-overlay__column {
  width: min(48%, 280px);
}

.tile-eat-first-overlay--insight .tile-eat-first-overlay__top {
  max-width: calc(82% - 10px);
}

.tile-eat-first-overlay__top {
  position: absolute;
  left: 7px;
  top: 6px;
  display: flex;
  align-items: flex-start;
  gap: 6px;
  max-width: calc(62% - 10px);
}

.tile-eat-first-overlay__columns {
  position: absolute;
  inset: auto 7px 48px 7px;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 14%;
}

.tile-eat-first-overlay__column {
  width: min(36%, 170px);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.tile-eat-first-overlay__column--right {
  align-items: flex-end;
}

.tile-eat-first-card {
  pointer-events: auto;
  box-sizing: border-box;
  width: fit-content;
  max-width: 100%;
  min-height: 42px;
  border-radius: 12px;
  border: 1px solid rgb(168 85 247 / 0.33);
  background: linear-gradient(135deg, rgb(13 8 28 / 0.87), rgb(8 5 20 / 0.8));
  box-shadow:
    0 2px 12px rgb(0 0 0 / 0.35),
    inset 0 0 0 1px rgb(255 255 255 / 0.03);
  color: rgb(237 233 254 / 0.96);
  display: flex;
  align-items: center;
  gap: 6px;
  text-align: left;
  padding: 5px 7px;
}

.tile-eat-first-card--mini {
  min-height: 40px;
}

.tile-eat-first-card--sealed {
  max-width: min(6.75rem, 100%);
}

.tile-eat-first-card--sealed.tile-eat-first-card--mini {
  max-width: min(4.35rem, 100%);
  padding: 4px 6px;
}

.tile-eat-first-card--pending {
  border-color: rgb(250 204 21 / 0.62);
  box-shadow:
    0 0 12px rgb(250 204 21 / 0.22),
    0 2px 12px rgb(0 0 0 / 0.35);
}

.tile-eat-first-card--revealed {
  max-width: 100%;
  border-color: rgb(250 204 21 / 0.88);
  box-shadow:
    0 0 14px rgb(250 204 21 / 0.38),
    0 2px 12px rgb(0 0 0 / 0.35);
}

.tile-eat-first-card--revealed .tile-eat-first-card__value {
  white-space: normal;
  overflow: visible;
  text-overflow: unset;
  word-break: break-word;
  hyphens: auto;
}

.tile-eat-first-card--insight {
  max-width: 100%;
}

.tile-eat-first-card--insight .tile-eat-first-card__main {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
}

.tile-eat-first-card--insight .tile-eat-first-card__title {
  white-space: normal;
  word-break: break-word;
  line-height: 1.18;
  hyphens: auto;
}

.tile-eat-first-card--insight .tile-eat-first-card__value {
  white-space: normal;
  overflow: visible;
  text-overflow: unset;
  word-break: break-word;
  hyphens: auto;
}

.tile-eat-first-card__icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: rgb(192 132 252 / 0.95);
}

.tile-eat-first-card__icon svg {
  width: 100%;
  height: 100%;
}

.tile-eat-first-card__main {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.tile-eat-first-card__title {
  font-size: 0.46rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  line-height: 1.1;
  color: rgb(196 181 253 / 0.95);
}

.tile-eat-first-card__value {
  font-size: 0.66rem;
  font-weight: 700;
  line-height: 1.12;
  color: rgb(248 250 252 / 0.98);
}

.tile-eat-first-card__value:not(.tile-eat-first-card__value--peer-hidden) {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.06em;
  min-width: 0;
  white-space: normal;
  overflow: visible;
}

.tile-eat-first-card__value-line {
  display: block;
  max-width: 100%;
  line-height: 1.14;
  word-break: break-word;
}

.tile-eat-first-card--sealed .tile-eat-first-card__value:not(.tile-eat-first-card__value--peer-hidden) > .tile-eat-first-card__value-line:only-child {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tile-eat-first-card__value--peer-hidden {
  display: inline-flex;
  align-items: center;
  min-height: 1.05em;
}

.tile-eat-first-card__peer-hidden-eye {
  display: inline-flex;
  width: 17px;
  height: 17px;
  flex-shrink: 0;
  color: rgb(248 250 252 / 0.92);
}

.tile-eat-first-card__peer-hidden-eye svg {
  width: 100%;
  height: 100%;
}

.tile-eat-first-card__eye-btn {
  pointer-events: auto;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid rgb(250 204 21 / 0.35);
  border-radius: 8px;
  background: rgb(17 11 35 / 0.92);
  color: rgb(253 224 71 / 0.95);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
}

.tile-eat-first-card__eye-btn:hover {
  border-color: rgb(250 204 21 / 0.62);
  color: rgb(254 249 195 / 0.98);
}

.tile-eat-first-card__eye-btn svg {
  width: 14px;
  height: 14px;
}

.tile-eat-first-card__actions {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
}

.tile-eat-first-card__action-btn {
  pointer-events: auto;
  width: 18px;
  height: 18px;
  border: 1px solid rgb(168 85 247 / 0.36);
  border-radius: 999px;
  background: rgb(17 11 35 / 0.9);
  color: rgb(196 181 253 / 0.92);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.tile-eat-first-card__action-btn svg {
  width: 12px;
  height: 12px;
}

.tile-eat-first-card__action-btn--dice:hover {
  border-color: rgb(196 181 253 / 0.62);
  color: rgb(233 213 255 / 0.98);
}

.tile-eat-first-action-card {
  position: absolute;
  left: 50%;
  bottom: 6%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: min(85%, 22rem);
  padding: 4px 6px 4px 10px;
  background: linear-gradient(
    140deg,
    rgb(140 99 220 / 0.92) 0%,
    rgb(98 64 168 / 0.95) 60%,
    rgb(64 38 124 / 0.95) 100%
  );
  border: 1px solid rgb(255 255 255 / 0.18);
  border-radius: 999px;
  box-shadow:
    0 0 0 1px rgb(0 0 0 / 0.25),
    0 6px 14px rgb(20 8 50 / 0.45);
  color: #fff;
  font-size: 11px;
  font-weight: 500;
  line-height: 1.15;
  letter-spacing: 0.01em;
  pointer-events: auto;
  z-index: 5;
}

/* Host-only: match revealed-trait gold ring after the seat used their action card. */
.tile-eat-first-action-card--used-host {
  border-color: rgb(250 204 21 / 0.88);
  box-shadow:
    0 0 14px rgb(250 204 21 / 0.38),
    0 2px 12px rgb(0 0 0 / 0.35),
    0 0 0 1px rgb(0 0 0 / 0.25);
}

.tile-eat-first-action-card__title {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tile-eat-first-action-card__use-btn {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: inherit;
  font-weight: inherit;
  line-height: inherit;
  letter-spacing: inherit;
  text-align: center;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tile-eat-first-action-card__use-btn:hover:not(:disabled) {
  filter: brightness(1.08);
}

.tile-eat-first-action-card__use-btn:disabled {
  cursor: default;
  opacity: 0.82;
}

.tile-eat-first-action-card__btn {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  margin: 0;
  border: 0;
  border-radius: 50%;
  background: rgb(255 255 255 / 0.14);
  color: #fff;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.12s ease;
}

.tile-eat-first-action-card__btn:hover {
  background: rgb(255 255 255 / 0.24);
  transform: scale(1.05);
}

.tile-eat-first-action-card__btn:active {
  transform: scale(0.96);
}

.tile-eat-first-toast {
  position: absolute;
  left: 50%;
  bottom: 58px;
  transform: translateX(-50%);
  min-width: 210px;
  max-width: min(72%, 320px);
  padding: 7px 10px;
  border-radius: 12px;
  border: 1px solid rgb(250 204 21 / 0.45);
  background: linear-gradient(135deg, rgb(20 14 8 / 0.94), rgb(12 8 6 / 0.92));
  box-shadow: 0 6px 22px rgb(0 0 0 / 0.45);
  pointer-events: none;
}

.tile-eat-first-toast__line {
  margin: 0;
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1.2;
  color: rgb(250 250 250 / 0.97);
}

.tile-eat-first-toast__line + .tile-eat-first-toast__line {
  margin-top: 3px;
}

.tile-eat-first-toast__accent {
  color: rgb(196 181 253 / 0.98);
}

.tile-overlay {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  min-height: 0;
  box-sizing: border-box;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.65rem 0.55rem;
  background: transparent;
  pointer-events: none;
  border-bottom-left-radius: 14px;
  border-bottom-right-radius: 14px;
}


.tile-overlay__label-group {
  display: flex;
  align-items: center;
  gap: var(--sa-space-2, 0.5rem);
  flex: 1;
  min-width: 0;
  pointer-events: none;
}

.tile-overlay__label-group--editable {
  pointer-events: auto;
}


.tile-overlay__seat-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-width: 1.3rem;
  height: 1.3rem;
  padding: 0 0.2rem;
  border-radius: 9999px;
  flex-shrink: 0;
  font-size: 0.6rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  line-height: 1;
  color: #fff;
  border: 1px solid rgb(255 255 255 / 0.14);
  background: color-mix(in srgb, #2a2a2e 88%, #000);
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.45);
}

.tile-overlay__role-badge {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  max-width: 5.2rem;
  padding: 0.1rem 0.32rem;
  border-radius: 6px;
  font-size: 0.6rem;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: #f5f3ff;
  border: 1px solid color-mix(in srgb, #a78bfa 50%, transparent);
  background: color-mix(in srgb, #4c1d95 35%, #000 65%);
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.4);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tile-overlay__display-name {
  font-size: 0.8rem;
  font-weight: 600;
  color: #f9fafb;
  text-shadow: 0 1px 2px rgb(0 0 0 / 0.75);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.tile-overlay__identity {
  display: flex;
  flex-direction: column;
  min-width: 0;
  max-width: 100%;
  gap: 1px;
}

.tile-overlay__display-name--editable {
  pointer-events: auto;
  cursor: text;
}

.tile-overlay__name-edit {
  display: flex;
  align-items: center;
  gap: var(--sa-space-2, 0.5rem);
  flex: 1;
  min-width: 0;
  pointer-events: auto;
}


.tile-overlay__name-input {
  flex: 1;
  min-width: 0;
  max-width: 100%;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.35;
  padding: 0.4rem 0.55rem;
  border: 1px solid var(--sa-color-border);
  border-radius: var(--sa-radius-sm);
  background: color-mix(in srgb, var(--sa-color-surface) 88%, transparent);
  color: var(--sa-color-text-main);
  outline: none;
}

.tile-overlay__name-input:focus-visible {
  outline: 2px solid var(--sa-color-primary, #a78bfa);
  outline-offset: 1px;
}

.tile-overlay__icons {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
}

.tile-overlay__hand {
  font-size: 0.85rem;
  line-height: 1;
  filter: drop-shadow(0 0 4px rgb(250 204 21 / 0.45));
}

.tile-overlay__mic {
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.95;
  color: #86efac;
}

.tile-overlay__mic--off {
  color: #f87171;
  opacity: 0.95;
}





.tile-menu-cluster {
  position: absolute;
  top: 7px;
  right: 7px;
  z-index: 40;
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: flex-end;
  gap: 7px;
  max-width: calc(100% - 14px);
  pointer-events: auto;
  opacity: 1;
}

.tile-menu {
  position: relative;
  transition: opacity 0.15s ease;
}


.tile-menu--remote {
  z-index: 1;
}

.tile-menu__life {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin: 0;
  padding: 0;
  line-height: 0;
  font-size: 0;
  border-radius: 999px;
  border: 0;
  background: url('@/assets/mafia/ui/tile-skull.svg') center / 24px 24px no-repeat;
  color: #fecaca;
  cursor: pointer;
  box-shadow: none;
  transition:
    opacity 0.15s ease,
    filter 0.16s ease,
    transform 0.16s ease;
  z-index: 2;
}

.tile-menu__life:hover {
  filter: brightness(1.08);
  transform: scale(1.05);
}

.tile-menu__life--revive {
  background: rgb(34 197 94 / 0.24);
  color: #dcfce7;
  box-shadow:
    inset 0 0 0 1px rgb(255 255 255 / 0.18),
    0 0 10px rgb(34 197 94 / 0.22);
}

.tile-menu__life-ico {
  display: block;
  width: 24px;
  height: 24px;
  font-size: 0;
  line-height: 1;
  opacity: 0;
}

.tile-menu__life--revive .tile-menu__life-ico {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  opacity: 1;
}


.tile-menu-hoverable--remote,
.tile-remote-volume {
  position: relative;
  transition: opacity 0.15s ease;
}

/**
 * Hover bridge: (1) vertical padding under the trigger covers the gap before the
 * absolute popover. (2) Horizontal padding + negative margin widens the hit box
 * leftward so diagonal paths toward the slider stay inside `.tile-remote-volume:hover`
 * without widening the flex row (negative margin). Life button keeps higher z-index for clicks.
 */
.tile-remote-volume {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
  box-sizing: border-box;
  padding-left: clamp(4rem, 36vw, 11rem);
  margin-left: clamp(-11rem, -36vw, -4rem);
  padding-bottom: 22px;
  margin-bottom: -22px;
}

.tile-remote-volume > .tile-menu.tile-menu--remote {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.tile-remote-volume__trigger {
  width: 24px;
  height: 24px;
  padding: 0;
  border-radius: 999px;
  border: 0;
  background: rgb(0 0 0 / 0.38);
  color: #f3f4f6;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.12s ease;
}

.tile-remote-volume__trigger:hover {
  filter: brightness(1.08);
  transform: scale(1.04);
}

.tile-remote-volume__ico {
  display: block;
  flex-shrink: 0;
}

.tile-remote-volume__dropdown {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition:
    opacity 0.12s ease,
    visibility 0.12s ease;
}

.tile-remote-volume:hover .tile-remote-volume__dropdown,
.tile-remote-volume:focus-within .tile-remote-volume__dropdown {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
}

.tile-remote-volume__dropdown.tile-menu__dropdown {
  top: calc(100% + 4px);
}

@media (max-width: 768px), (hover: none) {
  .tile-menu__life,
  .tile-menu-hoverable--remote,
  .tile-remote-volume {
    opacity: 1;
    pointer-events: auto;
  }
}

@media (min-width: 769px) and (hover: hover) {
  .tile-menu__life,
  .tile-menu-hoverable--remote,
  .tile-remote-volume {
    opacity: 0;
    pointer-events: none;
  }

  .tile:hover .tile-menu__life,
  .tile:focus-within .tile-menu__life,
  .tile:hover .tile-menu-hoverable--remote,
  .tile:focus-within .tile-menu-hoverable--remote,
  .tile:hover .tile-remote-volume,
  .tile:focus-within .tile-remote-volume {
    opacity: 1;
    pointer-events: auto;
  }
}

.tile-menu__dropdown {
  position: absolute;
  top: calc(100% + 8px);
  bottom: auto;
  right: 0;
  z-index: 60;
  min-width: 13rem;
  max-width: min(17rem, calc(100vw - 1.5rem));
  padding: 10px 12px 12px;
  border-radius: 8px;
  border: 1px solid rgb(0 0 0 / 0.45);
  background: #2b2d31;
  box-shadow:
    0 12px 32px rgb(0 0 0 / 0.55),
    0 0 0 1px rgb(255 255 255 / 0.04);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.tile-menu__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: #f2f3f5;
  margin-bottom: 0.5rem;
}

.tile-menu__label {
  font-weight: 700;
  letter-spacing: 0.02em;
}

.tile-menu__pct {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  font-size: 0.7rem;
  color: #949ba4;
}

.tile-menu__range {
  width: 100%;
  margin: 0;
  height: 5px;
  border-radius: 3px;
  accent-color: #5865f2;
  cursor: pointer;
}

.tile-menu__row--mafia-bg {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.55rem;
  margin-top: 0.65rem;
  margin-bottom: 0;
  padding-top: 0.65rem;
  border-top: 1px solid rgb(0 0 0 / 0.35);
}

.tile-menu__swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.tile-menu__swatch {
  width: 1.55rem;
  height: 1.55rem;
  padding: 0;
  border: 2px solid rgb(255 255 255 / 0.16);
  border-radius: 999px;
  cursor: pointer;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.12);
}

.tile-menu__swatch--dark {
  background: linear-gradient(135deg, #030712, #2b2d31);
}

.tile-menu__swatch--red {
  background: linear-gradient(135deg, #450a0a, #dc2626);
}

.tile-menu__swatch--violet {
  background: linear-gradient(135deg, #2e1065, #8b5cf6);
}

.tile-menu__swatch--gray {
  background: linear-gradient(135deg, #0f172a, #94a3b8);
}

.tile-menu__swatch--active,
.tile-menu__swatch:focus-visible {
  border-color: rgb(255 255 255 / 0.9);
  outline: none;
}

.tile-placeholder {
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: 14px;
  overflow: hidden;
  clip-path: inset(0 round 14px);
  background: #000;
  color: var(--text-h, #f3f4f6);
  border: 2px solid rgba(102, 56, 143, 0.65);
}

.tile-placeholder__main {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;
  min-height: 0;
  min-width: 0;
  pointer-events: none;
}

.tile-overlay--on-placeholder {
  z-index: 2;
}

.tile-placeholder-avatar {
  box-sizing: border-box;
  flex-shrink: 0;
  
  --tile-avatar-size: min(42cqmin, 32cqi, 7.5rem);
  width: var(--tile-avatar-size);
  height: var(--tile-avatar-size);
  min-width: 2.5rem;
  min-height: 2.5rem;
  border-radius: 50%;
  background: rgb(255 255 255 / 0.08);
  border: 1px solid rgb(255 255 255 / 0.14);
  color: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: clamp(0.75rem, 9cqmin, 1.4rem);
}

.tile-placeholder-avatar--img {
  display: block;
  object-fit: cover;
  padding: 0;
  flex-shrink: 0;
}

/*
 * Mobile (and reduced-motion) overrides: GPU-expensive effects sitting directly
 * over decoded video tiles cause noticeable heat / FPS drop on phones with 4-8
 * camera grids. Speaking-glow stays as a box-shadow ring (cheap layer); the
 * scale promotion and the tile menu's `backdrop-filter` are dropped.
 */
@media (max-width: 768px) {
  .tile--speaking .tile-video-wrap {
    transform: none;
  }
  .tile-menu {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    background: #232428;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tile--speaking .tile-video-wrap {
    transform: none;
    transition: none;
  }
}
</style>



