import { onBeforeUnmount, nextTick, ref, shallowRef, watch, type Ref } from 'vue'
import { EatFirstWs } from '@/eat-first/eatFirstWsProtocol'
import type { useEatFirstCallShellStore } from '@/stores/eatFirstCallShell'

/**
 * Eat First inbound signaling dispatcher (extracted from CallPage).
 *
 * Owns the four reactive maps that the EatFirst tile / trait UI reads from:
 *   - `slotByPeer` (peerId → `pX` slot id, server-authoritative via
 *     `eat:trait-state-sync` / `eat:table-state-sync`)
 *   - `revealedBySlot` (slotId → traitKey set, "this trait is revealed")
 *   - `overridesBySlot` (slotId → traitKey → string, regenerated/overridden values)
 *   - `openedBySlot` (slotId → traitKey set, "the player opened this themselves",
 *     vs host-revealed)
 *
 * Plus the `applyingSpeakingQueueFromSignaling` flag CallPage's host-side
 * speaking-queue rebroadcast watcher uses to suppress its own echo.
 *
 * The composable also owns the `roomId`-keyed reset of the four maps and the
 * `subscribeSignalingMessage` lifecycle (subscribe + unsubscribe). It does
 * NOT own the cross-cutting effects that need other CallPage-scope deps:
 *
 *   - `attemptSlotClaim`: needs `route.query.game`, the per-game slot/token
 *     stores, the device id helper, and `sendSignalingMessage`. Passed as a
 *     callback so the existing implementation in CallPage stays put.
 *
 *   - `patchTraitForSlot`: writes to the EatFirst shell store; CallPage owns
 *     the canonical implementation. Passed as a callback so the composable
 *     does not assume the store layout.
 *
 *   - `onPlayerUsedActionCard`: builds an i18n toast and pushes to CallPage's
 *     `callToasts` ref. Passed as a callback so toast UI stays in CallPage.
 *
 * Behaviour preserved 1:1 from the inline `offEatFirstForceControls`
 * subscriber. Each `if (rec.type === ...)` branch is identical to the
 * original; the only structural change is the surrounding scope.
 */

type EatFirstShellStore = ReturnType<typeof useEatFirstCallShellStore>

type EatFirstTraitKey =
  | 'gender'
  | 'age'
  | 'profession'
  | 'health'
  | 'hobby'
  | 'phobia'
  | 'fact'
  | 'baggage'

const EAT_FIRST_TRAIT_ORDER: readonly EatFirstTraitKey[] = [
  'gender',
  'age',
  'profession',
  'health',
  'hobby',
  'phobia',
  'fact',
  'baggage',
]

const EAT_FIRST_HOST_UPDATED_SIGNAL = EatFirstWs.hostUpdated
const EAT_FIRST_FORCE_MUTE_ALL_SIGNAL = EatFirstWs.forceMuteAll
const EAT_FIRST_TRAIT_REVEALED_SIGNAL = EatFirstWs.traitRevealed
const EAT_FIRST_TRAIT_REGENERATED_SIGNAL = EatFirstWs.traitRegenerated
const EAT_FIRST_TRAIT_TYPE_REROLLED_SIGNAL = EatFirstWs.traitTypeRerolled
const EAT_FIRST_ACTION_CARD_REROLLED_SIGNAL = EatFirstWs.actionCardRerolled
const EAT_FIRST_ACTION_CARD_USED_SIGNAL = EatFirstWs.actionCardUsed
const EAT_FIRST_SPEAKING_QUEUE_UPDATE_SIGNAL = EatFirstWs.speakingQueueUpdate
const EAT_FIRST_TRAIT_STATE_SYNC_SIGNAL = EatFirstWs.traitStateSync
const EAT_FIRST_TABLE_STATE_SYNC_SIGNAL = EatFirstWs.tableStateSync
const EAT_FIRST_TIMER_PRESET_SELECT_SIGNAL = EatFirstWs.timerPresetSelect

export interface UseEatFirstCallSignalingDeps {
  subscribeSignalingMessage: (cb: (data: unknown) => void) => () => void
  selfPeerId: Ref<string | null | undefined>
  /** Used to wipe the four maps when the call session room id changes. */
  roomId: Ref<string | null | undefined>
  isEatFirstRoute: Ref<boolean>
  eatFirstShell: EatFirstShellStore
  micEnabled: Ref<boolean>
  toggleMic: () => Promise<void> | void
  /** CallPage-owned slot-claim helper (route + per-game token stores). */
  attemptSlotClaim: () => void
  /** CallPage-owned trait patcher (writes to `eatFirstShell.traitsBySlot`). */
  patchTraitForSlot: (slotId: string, traitKey: EatFirstTraitKey, value: string) => void
  /** Invoked on `eat:action-card-used` after host-only check + payload validation. */
  onPlayerUsedActionCard: (payload: { peerId: string; title: string }) => void
  /** Optional dev log target — composable only emits when DEV. */
  log?: { info: (msg: string, data: Record<string, unknown>) => void }
}

export interface UseEatFirstCallSignalingReturn {
  applyingSpeakingQueueFromSignaling: Ref<boolean>
  slotByPeer: Ref<Record<string, string>>
  revealedBySlot: Ref<Record<string, Record<string, boolean>>>
  overridesBySlot: Ref<Record<string, Record<string, string>>>
  openedBySlot: Ref<Record<string, Record<string, boolean>>>
}

export function useEatFirstCallSignaling(
  deps: UseEatFirstCallSignalingDeps,
): UseEatFirstCallSignalingReturn {
  const {
    subscribeSignalingMessage,
    selfPeerId,
    roomId,
    isEatFirstRoute,
    eatFirstShell,
    micEnabled,
    toggleMic,
    attemptSlotClaim,
    patchTraitForSlot,
    onPlayerUsedActionCard,
    log,
  } = deps

  /** Suppress host echo when applying `eat:speaking-queue-update` from the server. */
  const applyingSpeakingQueueFromSignaling = ref(false)

  /**
   * Eat First trait state is keyed by **slotId** (`p1..p11`), not peerId.
   * Server-side `revealedBySlot`/`overridesBySlot`/`openedBySlot` is the source
   * of truth; on a hard refresh the new peer rebinds via `eat:slot-claim` and
   * the same reveal/override state re-attaches to it.
   */
  const revealedBySlot = shallowRef<Record<string, Record<string, boolean>>>({})
  const overridesBySlot = shallowRef<Record<string, Record<string, string>>>({})
  const openedBySlot = shallowRef<Record<string, Record<string, boolean>>>({})

  /**
   * Server-authoritative `peerId → slotId` map and `playerOrder` in
   * `eat:trait-state-sync` / `eat:table-state-sync`. Replaces the old
   * `eatFirstSeatByPeer` (which derived seat from local tile index and made
   * every client see only the first player's traits).
   */
  const slotByPeer = shallowRef<Record<string, string>>({})

  watch(
    () => roomId.value,
    () => {
      revealedBySlot.value = {}
      overridesBySlot.value = {}
      openedBySlot.value = {}
      slotByPeer.value = {}
    },
  )

  const off = subscribeSignalingMessage((data) => {
    if (!isEatFirstRoute.value) {
      return
    }
    const rec = data as { type?: unknown; payload?: unknown }
    if (rec.type === 'room-state') {
      attemptSlotClaim()
      return
    }
    if (rec.type === EAT_FIRST_HOST_UPDATED_SIGNAL) {
      const payload =
        rec.payload != null && typeof rec.payload === 'object'
          ? (rec.payload as Record<string, unknown>)
          : null
      const hostPeerId = typeof payload?.hostPeerId === 'string' ? payload.hostPeerId.trim() : ''
      const selfId = typeof selfPeerId.value === 'string' ? selfPeerId.value.trim() : ''
      eatFirstShell.setEatFirstHostPeer(hostPeerId || null, selfId || null)
      return
    }
    if (rec.type === EAT_FIRST_SPEAKING_QUEUE_UPDATE_SIGNAL) {
      const payload =
        rec.payload != null && typeof rec.payload === 'object'
          ? (rec.payload as Record<string, unknown>)
          : null
      const raw = payload?.speakingQueue
      applyingSpeakingQueueFromSignaling.value = true
      eatFirstShell.applySpeakingQueueFromSignaling(Array.isArray(raw) ? raw : [])
      void nextTick(() => {
        applyingSpeakingQueueFromSignaling.value = false
      })
      return
    }
    if (rec.type === EAT_FIRST_TABLE_STATE_SYNC_SIGNAL) {
      const payload =
        rec.payload != null && typeof rec.payload === 'object'
          ? (rec.payload as Record<string, unknown>)
          : null
      if (!payload) return
      overridesBySlot.value = {}
      const playerOrderRaw = Array.isArray(payload.playerOrder) ? payload.playerOrder : []
      const nextPlayerOrder = playerOrderRaw
        .filter((x): x is string => typeof x === 'string' && /^p([1-9]|1[01])$/i.test(x.trim()))
        .map((x) => x.trim())
      if (nextPlayerOrder.length > 0) {
        eatFirstShell.setPlayerOrder(nextPlayerOrder)
      }
      const slotByPeerRaw =
        payload.slotByPeer && typeof payload.slotByPeer === 'object' && !Array.isArray(payload.slotByPeer)
          ? (payload.slotByPeer as Record<string, unknown>)
          : {}
      const nextSlotByPeer: Record<string, string> = {}
      for (const [peerId, slotUnknown] of Object.entries(slotByPeerRaw)) {
        if (typeof slotUnknown !== 'string') continue
        const slot = slotUnknown.trim()
        if (!/^p([1-9]|1[01])$/i.test(slot)) continue
        nextSlotByPeer[peerId] = slot
      }
      slotByPeer.value = nextSlotByPeer
      const traitsBySlotRaw =
        payload.traitsBySlot && typeof payload.traitsBySlot === 'object' && !Array.isArray(payload.traitsBySlot)
          ? (payload.traitsBySlot as Record<string, unknown>)
          : {}
      const mergedTraitsBySlot: Record<string, Record<EatFirstTraitKey, string>> = { ...eatFirstShell.traitsBySlot }
      for (const [slotId, rowUnknown] of Object.entries(traitsBySlotRaw)) {
        if (!/^p([1-9]|1[01])$/i.test(String(slotId).trim())) continue
        if (!rowUnknown || typeof rowUnknown !== 'object' || Array.isArray(rowUnknown)) continue
        const row = rowUnknown as Record<string, unknown>
        const normalized = {} as Record<EatFirstTraitKey, string>
        let complete = true
        for (const key of EAT_FIRST_TRAIT_ORDER) {
          const value = typeof row[key] === 'string' ? row[key].trim() : ''
          if (value.length < 1) {
            complete = false
            break
          }
          normalized[key] = value
        }
        if (complete) mergedTraitsBySlot[slotId.trim()] = normalized
      }
      eatFirstShell.setTraitsBySlot(mergedTraitsBySlot)
      const actionCardBySlotRaw =
        payload.actionCardBySlot &&
        typeof payload.actionCardBySlot === 'object' &&
        !Array.isArray(payload.actionCardBySlot)
          ? (payload.actionCardBySlot as Record<string, unknown>)
          : {}
      const mergedActionCardBySlot: Record<
        string,
        { title: string; description: string; templateId: string; effectId: string; used: boolean }
      > = { ...eatFirstShell.actionCardBySlot }
      for (const [slotId, rowUnknown] of Object.entries(actionCardBySlotRaw)) {
        if (!/^p([1-9]|1[01])$/i.test(String(slotId).trim())) continue
        if (!rowUnknown || typeof rowUnknown !== 'object' || Array.isArray(rowUnknown)) continue
        const row = rowUnknown as Record<string, unknown>
        const title = typeof row.title === 'string' ? row.title.trim() : ''
        const description = typeof row.description === 'string' ? row.description.trim() : ''
        const templateId = typeof row.templateId === 'string' ? row.templateId.trim() : ''
        const effectId = typeof row.effectId === 'string' ? row.effectId.trim() : ''
        const used = row.used === true
        if (title.length < 1 && templateId.length < 1) continue
        mergedActionCardBySlot[slotId.trim()] = { title, description, templateId, effectId, used }
      }
      eatFirstShell.setActionCardBySlot(mergedActionCardBySlot)
      const lastUsedRaw =
        payload.lastUsedActionCard &&
        typeof payload.lastUsedActionCard === 'object' &&
        !Array.isArray(payload.lastUsedActionCard)
          ? (payload.lastUsedActionCard as Record<string, unknown>)
          : null
      if (lastUsedRaw) {
        const slotId = typeof lastUsedRaw.slotId === 'string' ? lastUsedRaw.slotId.trim() : ''
        const title = typeof lastUsedRaw.title === 'string' ? lastUsedRaw.title.trim() : ''
        const description = typeof lastUsedRaw.description === 'string' ? lastUsedRaw.description.trim() : ''
        if (slotId.length > 0 && title.length > 0) {
          eatFirstShell.setLastUsedActionCard({ slotId, title, description })
        } else {
          eatFirstShell.setLastUsedActionCard(null)
        }
      } else {
        eatFirstShell.setLastUsedActionCard(null)
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'forceMuteAllActive')) {
        // Server-authoritative `forceMuteAllActive` is mirrored into the shell
        // store so host tabs, reloads, late joiners, and OBS reflect the same
        // state. Audit parity finding B (no longer a local-only ref).
        eatFirstShell.setForceMuteAllActiveFromSignaling(payload.forceMuteAllActive === true)
      }
      if (Object.prototype.hasOwnProperty.call(payload, 'timer')) {
        const timerRaw = payload.timer
        let nextCallTimer: { startedAt: number; durationMs: number; isRunning: boolean } | null = null
        if (timerRaw === null) {
          nextCallTimer = null
        } else if (timerRaw && typeof timerRaw === 'object' && !Array.isArray(timerRaw)) {
          const tr = timerRaw as Record<string, unknown>
          const startedAt = typeof tr.startedAt === 'number' ? tr.startedAt : Number.NaN
          const duration = typeof tr.duration === 'number' ? tr.duration : Number.NaN
          if (
            tr.isRunning === true &&
            Number.isFinite(startedAt) &&
            Number.isFinite(duration) &&
            duration >= 5000 &&
            duration <= 7_200_000
          ) {
            nextCallTimer = { startedAt, durationMs: duration, isRunning: true }
          }
        }
        eatFirstShell.setEatFirstCallTimerFromTableSync(nextCallTimer)
      }
      const revealedRaw =
        payload.revealedTraitsBySlot &&
        typeof payload.revealedTraitsBySlot === 'object' &&
        !Array.isArray(payload.revealedTraitsBySlot)
          ? (payload.revealedTraitsBySlot as Record<string, unknown>)
          : {}
      const openedRaw =
        payload.openedByBySlot && typeof payload.openedByBySlot === 'object' && !Array.isArray(payload.openedByBySlot)
          ? (payload.openedByBySlot as Record<string, unknown>)
          : {}
      const nextRevealedBySlot: Record<string, Record<string, boolean>> = {}
      for (const [slotId, keysUnknown] of Object.entries(revealedRaw)) {
        if (!Array.isArray(keysUnknown)) continue
        const row: Record<string, boolean> = {}
        for (const key of keysUnknown) {
          if (typeof key === 'string' && key.trim().length > 0) row[key.trim()] = true
        }
        if (Object.keys(row).length > 0) nextRevealedBySlot[slotId] = row
      }
      const nextOpenedBySlot: Record<string, Record<string, boolean>> = {}
      for (const [slotId, rowUnknown] of Object.entries(openedRaw)) {
        if (!rowUnknown || typeof rowUnknown !== 'object' || Array.isArray(rowUnknown)) continue
        const row = rowUnknown as Record<string, unknown>
        const out: Record<string, boolean> = {}
        for (const [traitKey, openedBy] of Object.entries(row)) {
          if (openedBy === 'player' || openedBy === 'host') out[traitKey] = true
        }
        if (Object.keys(out).length > 0) nextOpenedBySlot[slotId] = out
      }
      revealedBySlot.value = nextRevealedBySlot
      openedBySlot.value = nextOpenedBySlot
      attemptSlotClaim()
      return
    }
    if (rec.type === EAT_FIRST_TRAIT_STATE_SYNC_SIGNAL) {
      const payload =
        rec.payload != null && typeof rec.payload === 'object'
          ? (rec.payload as Record<string, unknown>)
          : null
      if (!payload) return
      const traitSyncPlayerOrderRaw = Array.isArray(payload.playerOrder) ? payload.playerOrder : []
      const traitSyncPlayerOrder = traitSyncPlayerOrderRaw
        .filter((x): x is string => typeof x === 'string' && /^p([1-9]|1[01])$/i.test(x.trim()))
        .map((x) => x.trim())
      if (traitSyncPlayerOrder.length > 0) {
        eatFirstShell.setPlayerOrder(traitSyncPlayerOrder)
      }
      const revealedRaw =
        payload.revealedBySlot && typeof payload.revealedBySlot === 'object' && !Array.isArray(payload.revealedBySlot)
          ? (payload.revealedBySlot as Record<string, unknown>)
          : {}
      const overridesRaw =
        payload.overridesBySlot && typeof payload.overridesBySlot === 'object' && !Array.isArray(payload.overridesBySlot)
          ? (payload.overridesBySlot as Record<string, unknown>)
          : {}
      const openedRaw =
        payload.openedBySlot && typeof payload.openedBySlot === 'object' && !Array.isArray(payload.openedBySlot)
          ? (payload.openedBySlot as Record<string, unknown>)
          : {}
      const slotByPeerRaw =
        payload.slotByPeer && typeof payload.slotByPeer === 'object' && !Array.isArray(payload.slotByPeer)
          ? (payload.slotByPeer as Record<string, unknown>)
          : {}
      const nextSlotByPeer: Record<string, string> = {}
      for (const [peerId, slotUnknown] of Object.entries(slotByPeerRaw)) {
        if (typeof slotUnknown !== 'string') continue
        const slot = slotUnknown.trim()
        if (slot.length < 1) continue
        nextSlotByPeer[peerId] = slot
      }
      slotByPeer.value = nextSlotByPeer
      if (import.meta.env.DEV) {
        log?.info('[eat-first:slot-map:update]', {
          selfPeerId: selfPeerId.value,
          selfSlotId: selfPeerId.value ? nextSlotByPeer[selfPeerId.value] ?? null : null,
        })
      }
      const nextRevealedBySlot: Record<string, Record<string, boolean>> = {}
      const nextOverridesBySlot: Record<string, Record<string, string>> = {}
      const nextOpenedBySlot: Record<string, Record<string, boolean>> = {}
      for (const [slotId, keysUnknown] of Object.entries(revealedRaw)) {
        if (!Array.isArray(keysUnknown)) continue
        const row: Record<string, boolean> = {}
        for (const k of keysUnknown) {
          if (typeof k === 'string' && k.trim().length > 0) {
            row[k.trim()] = true
          }
        }
        if (Object.keys(row).length > 0) nextRevealedBySlot[slotId] = row
      }
      for (const [slotId, rowUnknown] of Object.entries(overridesRaw)) {
        if (!rowUnknown || typeof rowUnknown !== 'object' || Array.isArray(rowUnknown)) continue
        const row = rowUnknown as Record<string, unknown>
        const out: Record<string, string> = {}
        for (const [k, v] of Object.entries(row)) {
          if (typeof k === 'string' && k.trim().length > 0 && typeof v === 'string' && v.trim().length > 0) {
            out[k.trim()] = v.trim()
          }
        }
        if (Object.keys(out).length > 0) nextOverridesBySlot[slotId] = out
      }
      for (const [slotId, keysUnknown] of Object.entries(openedRaw)) {
        if (!Array.isArray(keysUnknown)) continue
        const row: Record<string, boolean> = {}
        for (const k of keysUnknown) {
          if (typeof k === 'string' && k.trim().length > 0) {
            row[k.trim()] = true
          }
        }
        if (Object.keys(row).length > 0) nextOpenedBySlot[slotId] = row
      }
      revealedBySlot.value = nextRevealedBySlot
      overridesBySlot.value = nextOverridesBySlot
      openedBySlot.value = nextOpenedBySlot
      return
    }
    if (rec.type === EAT_FIRST_TRAIT_REVEALED_SIGNAL) {
      const payload =
        rec.payload != null && typeof rec.payload === 'object'
          ? (rec.payload as Record<string, unknown>)
          : null
      const slotId = typeof payload?.slotId === 'string' ? payload.slotId.trim() : ''
      const traitKey = typeof payload?.traitKey === 'string' ? payload.traitKey.trim() : ''
      const openedBy = payload?.openedBy === 'host' ? 'host' : 'player'
      const closed = payload?.closed === true
      if (!slotId || !traitKey) return
      if (closed) {
        const prevRevealed = revealedBySlot.value[slotId]
        if (prevRevealed && prevRevealed[traitKey]) {
          const nextRow = { ...prevRevealed }
          delete nextRow[traitKey]
          const next = { ...revealedBySlot.value }
          if (Object.keys(nextRow).length > 0) next[slotId] = nextRow
          else delete next[slotId]
          revealedBySlot.value = next
        }
        const prevOpened = openedBySlot.value[slotId]
        if (prevOpened && prevOpened[traitKey]) {
          const nextRow = { ...prevOpened }
          delete nextRow[traitKey]
          const next = { ...openedBySlot.value }
          if (Object.keys(nextRow).length > 0) next[slotId] = nextRow
          else delete next[slotId]
          openedBySlot.value = next
        }
        return
      }
      revealedBySlot.value = {
        ...revealedBySlot.value,
        [slotId]: { ...(revealedBySlot.value[slotId] ?? {}), [traitKey]: true },
      }
      if (openedBy === 'player') {
        openedBySlot.value = {
          ...openedBySlot.value,
          [slotId]: { ...(openedBySlot.value[slotId] ?? {}), [traitKey]: true },
        }
      }
      return
    }
    if (rec.type === EAT_FIRST_TRAIT_REGENERATED_SIGNAL) {
      const payload =
        rec.payload != null && typeof rec.payload === 'object'
          ? (rec.payload as Record<string, unknown>)
          : null
      const slotId = typeof payload?.slotId === 'string' ? payload.slotId.trim() : ''
      const traitKey = typeof payload?.traitKey === 'string' ? payload.traitKey.trim() : ''
      const value = typeof payload?.value === 'string' ? payload.value.trim() : ''
      if (!slotId || !traitKey || !value) return
      patchTraitForSlot(slotId, traitKey as EatFirstTraitKey, value)
      overridesBySlot.value = {
        ...overridesBySlot.value,
        [slotId]: { ...(overridesBySlot.value[slotId] ?? {}), [traitKey]: value },
      }
      return
    }
    if (rec.type === EAT_FIRST_TRAIT_TYPE_REROLLED_SIGNAL) {
      const payload =
        rec.payload != null && typeof rec.payload === 'object'
          ? (rec.payload as Record<string, unknown>)
          : null
      const traitKey = typeof payload?.traitKey === 'string' ? payload.traitKey.trim() : ''
      const valuesBySlotRaw =
        payload?.valuesBySlot &&
        typeof payload.valuesBySlot === 'object' &&
        !Array.isArray(payload.valuesBySlot)
          ? (payload.valuesBySlot as Record<string, unknown>)
          : null
      if (!traitKey || !valuesBySlotRaw) return
      const next = { ...overridesBySlot.value }
      for (const [slotId, valueUnknown] of Object.entries(valuesBySlotRaw)) {
        if (typeof valueUnknown !== 'string') continue
        const value = valueUnknown.trim()
        if (value.length < 1) continue
        patchTraitForSlot(slotId, traitKey as EatFirstTraitKey, value)
        next[slotId] = { ...(next[slotId] ?? {}), [traitKey]: value }
      }
      overridesBySlot.value = next
      return
    }
    if (rec.type === EAT_FIRST_ACTION_CARD_REROLLED_SIGNAL) {
      const payload =
        rec.payload != null && typeof rec.payload === 'object'
          ? (rec.payload as Record<string, unknown>)
          : null
      const slotId = typeof payload?.slotId === 'string' ? payload.slotId.trim() : ''
      const card =
        payload?.card && typeof payload.card === 'object' && !Array.isArray(payload.card)
          ? (payload.card as Record<string, unknown>)
          : null
      if (!slotId || !card) return
      const title = typeof card.title === 'string' ? card.title : ''
      const description = typeof card.description === 'string' ? card.description : ''
      const templateId = typeof card.templateId === 'string' ? card.templateId : ''
      const effectId = typeof card.effectId === 'string' ? card.effectId : ''
      const used = card.used === true
      eatFirstShell.setActionCardForSlot(slotId, { title, description, templateId, effectId, used })
      return
    }
    if (rec.type === EAT_FIRST_ACTION_CARD_USED_SIGNAL) {
      if (!eatFirstShell.isEatFirstRoomHost) return
      const payload =
        rec.payload != null && typeof rec.payload === 'object'
          ? (rec.payload as Record<string, unknown>)
          : null
      const peerId = typeof payload?.peerId === 'string' ? payload.peerId.trim() : ''
      const title = typeof payload?.title === 'string' ? payload.title.trim() : ''
      if (!peerId || title.length < 1) return
      onPlayerUsedActionCard({ peerId, title })
      return
    }
    if (rec.type === EAT_FIRST_TIMER_PRESET_SELECT_SIGNAL) {
      const payload =
        rec.payload != null && typeof rec.payload === 'object'
          ? (rec.payload as Record<string, unknown>)
          : null
      const ms = payload?.durationMs
      if (typeof ms === 'number' && Number.isFinite(ms)) {
        eatFirstShell.setEatFirstSelectedTimerDurationMs(Math.floor(ms))
      }
      return
    }
    if (rec.type !== EAT_FIRST_FORCE_MUTE_ALL_SIGNAL || rec.payload == null || typeof rec.payload !== 'object') return
    const payload = rec.payload as Record<string, unknown>
    const muted = payload.muted !== false
    // Update the server-authoritative store flag for every peer (including the
    // host's own tab) so reloaded host tabs and OBS reflect the toggle state
    // without waiting on the next `eat:table-state-sync`. Audit parity B.
    eatFirstShell.setForceMuteAllActiveFromSignaling(muted)
    if (eatFirstShell.isEatFirstRoomHost) return
    /**
     * Audit RB2: only flip the local mic OFF when the host enforces mute.
     * Auto-unmuting on `muted: false` is inconsistent with hard-mute
     * semantics (a per-peer kick may still have the user `forcedAudioMuted`
     * server-side) and also breaks the user's own choice to stay muted
     * after the room-wide mute lifts. Mafia / GameRoom use the same rule:
     * server `force-peer-mic muted: false` is a UI-hint clear, not an
     * auto-unmute. The player must opt back in manually.
     */
    if (muted && micEnabled.value) {
      void toggleMic()
    }
  })

  onBeforeUnmount(off)

  return {
    applyingSpeakingQueueFromSignaling,
    slotByPeer,
    revealedBySlot,
    overridesBySlot,
    openedBySlot,
  }
}
