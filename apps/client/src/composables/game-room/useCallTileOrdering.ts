import { computed, type ComputedRef, type Ref } from 'vue'
import { type CallTile } from 'call-core'
import { pinHostPeerToEndOfOrder } from '@/utils/gameHostOrdering'
import { resolveHostPeerIdForGrid } from '@/components/call/callTileOrderRules'
import {
  buildFallbackOrderedTiles,
  buildHostLastOrderedTiles,
} from './callTileOrdering'

/**
 * Block 26 — `orderedTiles` + `orderedGridRows` + `isTileRowSpeaking`
 * extracted from `CallPage.vue` and `GameTemplateCallPage.vue`. The two
 * pages' `orderedTiles` computeds differed only by:
 *
 *   - the store-backed "display numbering order" + "explicit host"
 *     reads (Mafia: `mafiaGameStore.*`; Game Template: `gameStore.*`)
 *   - the optional EatFirst slot branch (CallPage only)
 *
 * The shared algorithm — host-last extras tail plus a stable sort —
 * lives in `./callTileOrdering` as a pure helper. This composable wires
 * the helper to Vue refs and to the route-specific policy.
 *
 * Ordering precedence:
 *
 *   1. `customOrdering()` — invoked first on every compute. If it
 *      returns a non-null tile list, that becomes `orderedTiles`. This
 *      is the override hook for routes (EatFirst) whose ordering does
 *      not fit the host-last shape.
 *   2. `hostLastPolicy.isActive` true → the host-last branch (display
 *      numbering order + `pinHostPeerToEndOfOrder` + extras fold).
 *   3. Otherwise → the fallback branch (`tileOrder` + spotlight pin).
 *
 * `orderedGridRows` is derived from the chosen `orderedTiles` and the
 * injected `peerDisplayName(peerId)` resolver (which is route-aware via
 * `useCallDisplayNames` policy). `isTileRowSpeaking` is the same
 * 6-line check both pages had — local tile reads
 * `localTileSpeaking.value`, remote tiles match against the two
 * active-speaker refs.
 *
 * This composable does not import any Mafia / GameRoom / EatFirst
 * store, protocol, or composable. All route-specific behavior is
 * injected.
 */

export interface CallTileGridRow {
  tile: CallTile
  displayName: string
}

export interface UseCallTileOrderingHostLastPolicy {
  /**
   * True only when the host-last ordering branch applies. Mafia passes
   * `isMafiaRoute`; Game Template passes `isGameRoomRoute`.
   */
  isActive: ComputedRef<boolean> | Ref<boolean>
  /**
   * Returns the route-specific display numbering order built from the
   * current `tileOrder`. Mafia delegates to
   * `mafiaGameStore.getDisplayNumberingOrder`; Game Template delegates
   * to `gameStore.getDisplayNumberingOrder`. The store-side signatures
   * take/return mutable `string[]`; the composable only reads, so the
   * looser type is fine.
   */
  getDisplayNumberingOrder: (tileOrder: string[]) => string[]
  /**
   * Returns the route-specific explicit host peer id (trimmed) or `''`.
   * Mafia reads `mafiaGameStore.mafiaHostPeerId`; Game Template reads
   * `gameStore.hostPeerId`.
   */
  getExplicitHostPeerId: () => string
}

export interface UseCallTileOrderingOptions {
  tiles: Ref<readonly CallTile[]>
  tileOrder: Ref<readonly string[]>
  pinnedPeerId: Ref<string | null>
  /**
   * Spotlight-desktop flag getter from `useCallSpotlightLayout`. Read
   * by the fallback branch to decide whether the pinned peer is hoisted
   * to the front of the sort. Taken as a thunk (rather than as a
   * `Ref<boolean>`) so the composable can be wired BEFORE the spotlight
   * composable in the setup script — `useCallSpotlightLayout` consumes
   * `orderedTiles` as one of its inputs, so the page-side instantiation
   * order is `useCallTileOrdering → useCallSpotlightLayout` and the
   * spotlight ref is captured here via closure.
   */
  getSpotlightActive: () => boolean
  /**
   * Resolves the display name to render in `<ParticipantTile>` for the
   * given peer. The pages get this from `useCallDisplayNames`. Called
   * lazily inside `orderedGridRows`; the composable does not cache it.
   */
  peerDisplayName: (peerId: string) => string
  /**
   * Reactive flag for the local tile speaking ring (driven by
   * `useLocalTileSpeakingVisual` upstream).
   */
  localTileSpeaking: Ref<boolean>
  /** VAD-derived active speaker peer id. */
  activeSpeakerPeerId: Ref<string | null>
  /** Server-authoritative active speaker peer id. */
  serverActiveSpeakerPeerId: Ref<string | null>
  /** Mafia / Game Template host-last policy. */
  hostLastPolicy: UseCallTileOrderingHostLastPolicy
  /**
   * Optional pre-ordering hook. Returns `null` to fall through to the
   * host-last / fallback branches. CallPage uses this to slot the
   * EatFirst route's `eatFirstShell.playerOrder`-driven ordering in
   * without modifying the shared composable.
   */
  customOrdering?: () => readonly CallTile[] | null
}

export interface UseCallTileOrderingApi {
  orderedTiles: ComputedRef<CallTile[]>
  orderedGridRows: ComputedRef<CallTileGridRow[]>
  isTileRowSpeaking: (row: CallTileGridRow) => boolean
}

export function useCallTileOrdering(
  options: UseCallTileOrderingOptions,
): UseCallTileOrderingApi {
  const {
    tiles,
    tileOrder,
    pinnedPeerId,
    getSpotlightActive,
    peerDisplayName,
    localTileSpeaking,
    activeSpeakerPeerId,
    serverActiveSpeakerPeerId,
    hostLastPolicy,
    customOrdering,
  } = options

  const orderedTiles = computed<CallTile[]>(() => {
    const list = tiles.value.slice()

    if (customOrdering) {
      const custom = customOrdering()
      if (custom !== null && custom !== undefined) {
        return [...custom]
      }
    }

    if (hostLastPolicy.isActive.value && list.length > 0) {
      const base = hostLastPolicy.getDisplayNumberingOrder([...tileOrder.value])
      const explicitHostPeerId = hostLastPolicy.getExplicitHostPeerId()
      const hostPidForGrid = resolveHostPeerIdForGrid(explicitHostPeerId, base)
      const order =
        hostPidForGrid.length > 0
          ? pinHostPeerToEndOfOrder(base, hostPidForGrid)
          : base.slice()
      return buildHostLastOrderedTiles(list, order, hostPidForGrid)
    }

    return buildFallbackOrderedTiles(
      list,
      tileOrder.value,
      pinnedPeerId.value,
      getSpotlightActive(),
    )
  })

  const orderedGridRows = computed<CallTileGridRow[]>(() =>
    orderedTiles.value.map((tile) => ({
      tile,
      displayName: peerDisplayName(tile.peerId),
    })),
  )

  function isTileRowSpeaking(row: CallTileGridRow): boolean {
    if (row.tile.isLocal) {
      return localTileSpeaking.value
    }
    const pid = row.tile.peerId
    return pid === activeSpeakerPeerId.value || pid === serverActiveSpeakerPeerId.value
  }

  return {
    orderedTiles,
    orderedGridRows,
    isTileRowSpeaking,
  }
}
