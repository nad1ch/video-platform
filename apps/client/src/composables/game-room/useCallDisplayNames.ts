import { computed, shallowRef, type ComputedRef, type Ref, type ShallowRef } from 'vue'
import {
  buildCallParticipantMap,
  buildDisplayNameUiMap,
  normalizeDisplayName,
  resolvePeerDisplayNameForUi,
  type ParticipantTileInput,
} from 'call-core'
import {
  loadCallTileLocalDisplayOverrides,
  saveCallTileLocalDisplayOverrides,
} from '@/utils/callTileLocalDisplayNames'

/**
 * Block 25 — pure display-name composable extracted from `CallPage.vue` and
 * `GameTemplateCallPage.vue`. Both routes carried this code structurally
 * identically, with four route-specific differences that are now isolated
 * behind a policy injection:
 *
 *   - `isRouteActive`        : `isMafiaRoute` vs `isGameRoomRoute`
 *   - `isHost`               : `mafiaGameStore.isMafiaHost` vs `gameStore.isGameRoomHost`
 *   - `nicknameOverrides`    : Mafia server-broadcast nickname Ref vs
 *                              Game Template server-broadcast nickname Ref
 *   - `sendPlayerNameUpdate` : wraps `MafiaWs.playerNameUpdate` vs
 *                              `GameRoomWs.playerNameUpdate` send-side
 *
 * Scope:
 *   - `participantsByPeerId`    — built via `buildCallParticipantMap`
 *   - `displayNameUiByPeerId`   — built via `buildDisplayNameUiMap`
 *   - `localTileDisplayOverrides` — LS-persisted user-edited names
 *   - `canEditTileDisplayName`  — host bit OR self OR local-tile bit
 *   - `onCommitLocalTileDisplayName` — emit-handler for
 *     `<ParticipantTile @commit-local-display-name>`
 *   - `peerDisplayName`         — resolves a peer's display name with the
 *     priority: local override → route-specific nickname → derived label
 *   - `peerAvatarFallbackName`  — derived label only (never the local override)
 *
 * Policy boundary:
 *   - `nicknameOverrides` is page-owned because the page's route-specific
 *     WS handler (e.g. mafia `playerNicknameUpdate`) ALSO writes to it
 *     when the server broadcasts the change. The composable reads it
 *     here and writes the optimistic-update inside `onCommitLocalTileDisplayName`.
 *
 * The composable does NOT import any Mafia / GameRoom store, protocol,
 * or composable. All route-specific behavior is injected.
 */

export interface UseCallDisplayNamesOptions {
  /** Live tile list from `useCallOrchestrator`. */
  tiles: Ref<readonly ParticipantTileInput[]>
  /** Remote display-name map from `useCallOrchestrator`. */
  remoteDisplayNames: Ref<Record<string, string>>
  /** Self peer id from `storeToRefs(session)` (call-core defaults to a non-empty tab-scoped id). */
  selfPeerId: Ref<string>
  /** Self display name from `storeToRefs(session)` (call-core defaults to `'You'`). */
  selfDisplayName: Ref<string>
  /**
   * Policy bits the composable cannot derive on its own.
   */
  policy: {
    /**
     * True only when the user is on the route that owns the
     * server-broadcast nickname map. False short-circuits both the
     * server-broadcast-write branch in `onCommitLocalTileDisplayName`
     * and the nickname-priority branch in `peerDisplayName`.
     */
    isRouteActive: ComputedRef<boolean> | Ref<boolean>
    /**
     * Host bit. Hosts can edit any tile; non-hosts may only edit their
     * own tile or any local tile.
     */
    isHost: ComputedRef<boolean> | Ref<boolean>
    /**
     * Page-owned nickname overrides ref. The composable writes the
     * optimistic local update; the page's route-specific WS handler
     * writes the server-broadcast value.
     */
    nicknameOverrides: Ref<Record<string, string>>
    /**
     * Send the server-side player-name-update message. The page wraps
     * the route-specific WS message type (`MafiaWs.playerNameUpdate` or
     * `GameRoomWs.playerNameUpdate`).
     */
    sendPlayerNameUpdate: (peerId: string, displayName: string) => void
  }
}

export interface UseCallDisplayNamesApi {
  participantsByPeerId: ComputedRef<ReturnType<typeof buildCallParticipantMap>>
  displayNameUiByPeerId: ComputedRef<ReturnType<typeof buildDisplayNameUiMap>>
  /**
   * LS-persisted user-edited names. The page mutates this directly from
   * two places (server-broadcast clear, tile-set-change prune), so it is
   * exposed as a writable shallowRef — same shape and mutation style the
   * pages used inline.
   */
  localTileDisplayOverrides: ShallowRef<Record<string, string>>
  canEditTileDisplayName: (peerId: string) => boolean
  onCommitLocalTileDisplayName: (payload: { peerId: string; name: string | null }) => void
  peerDisplayName: (peerId: string) => string
  peerAvatarFallbackName: (peerId: string) => string
}

export function useCallDisplayNames(
  options: UseCallDisplayNamesOptions,
): UseCallDisplayNamesApi {
  const { tiles, remoteDisplayNames, selfPeerId, selfDisplayName, policy } = options

  const participantsByPeerId = computed(() =>
    buildCallParticipantMap(tiles.value, { ...remoteDisplayNames.value }, selfPeerId.value),
  )

  const displayNameUiByPeerId = computed(() =>
    buildDisplayNameUiMap(participantsByPeerId.value, {
      selfPeerId: selfPeerId.value,
      selfDisplayName: selfDisplayName.value,
    }),
  )

  const localTileDisplayOverrides = shallowRef<Record<string, string>>(
    loadCallTileLocalDisplayOverrides(),
  )

  function canEditTileDisplayName(peerId: string): boolean {
    const id = typeof peerId === 'string' ? peerId.trim() : ''
    if (!id) {
      return false
    }
    const selfId = typeof selfPeerId.value === 'string' ? selfPeerId.value.trim() : ''
    const isLocalTile = tiles.value.some((x) => x.peerId === id && x.isLocal)
    if (policy.isRouteActive.value) {
      return policy.isHost.value || (selfId.length > 0 && id === selfId) || isLocalTile
    }
    return (selfId.length > 0 && id === selfId) || isLocalTile
  }

  function onCommitLocalTileDisplayName(payload: { peerId: string; name: string | null }): void {
    const id = typeof payload.peerId === 'string' ? payload.peerId.trim() : ''
    if (!id) {
      return
    }
    if (!canEditTileDisplayName(id)) {
      return
    }
    const t = payload.name != null ? normalizeDisplayName(payload.name).slice(0, 64) : ''
    if (policy.isRouteActive.value) {
      policy.sendPlayerNameUpdate(id, t)
      // Optimistic UI update: server will broadcast the same value (or clear) back.
      // Without this, the label snaps back to the old value until the WS roundtrip completes.
      const next = { ...policy.nicknameOverrides.value }
      if (!t) {
        delete next[id]
      } else {
        next[id] = t
      }
      policy.nicknameOverrides.value = next
      // Server-authoritative nickname overrides; avoid a stale local override
      // shadowing the optimistic / server nickname.
      if (Object.prototype.hasOwnProperty.call(localTileDisplayOverrides.value, id)) {
        const cleaned = { ...localTileDisplayOverrides.value }
        delete cleaned[id]
        localTileDisplayOverrides.value = cleaned
        saveCallTileLocalDisplayOverrides(cleaned)
      }
      return
    }
    const next = { ...localTileDisplayOverrides.value }
    if (!t) {
      delete next[id]
    } else {
      next[id] = t
    }
    localTileDisplayOverrides.value = next
    saveCallTileLocalDisplayOverrides(next)
  }

  function peerDisplayName(peerId: string): string {
    const o = localTileDisplayOverrides.value[peerId]
    if (typeof o === 'string' && normalizeDisplayName(o)) {
      return normalizeDisplayName(o).slice(0, 64)
    }
    if (policy.isRouteActive.value) {
      const n = policy.nicknameOverrides.value[peerId]
      if (typeof n === 'string' && normalizeDisplayName(n)) {
        return normalizeDisplayName(n).slice(0, 64)
      }
    }
    const participants = participantsByPeerId.value
    const opts = {
      selfPeerId: selfPeerId.value,
      selfDisplayName: selfDisplayName.value,
    }
    const hit = displayNameUiByPeerId.value.get(peerId)
    if (hit !== undefined) {
      return hit
    }
    return resolvePeerDisplayNameForUi(peerId, participants, opts)
  }

  function peerAvatarFallbackName(peerId: string): string {
    const participants = participantsByPeerId.value
    const opts = {
      selfPeerId: selfPeerId.value,
      selfDisplayName: selfDisplayName.value,
    }
    const hit = displayNameUiByPeerId.value.get(peerId)
    if (hit !== undefined) {
      return hit
    }
    return resolvePeerDisplayNameForUi(peerId, participants, opts)
  }

  return {
    participantsByPeerId,
    displayNameUiByPeerId,
    localTileDisplayOverrides,
    canEditTileDisplayName,
    onCommitLocalTileDisplayName,
    peerDisplayName,
    peerAvatarFallbackName,
  }
}
