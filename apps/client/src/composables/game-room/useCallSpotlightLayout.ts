import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  type ComputedRef,
  type Ref,
} from 'vue'

/**
 * Block 23 — pure layout composable extracted from `CallPage.vue` and
 * `GameTemplateCallPage.vue`. The two pages previously carried this
 * code byte-equivalently; both routes now consume the same composable.
 *
 * Scope: spotlight layout — desktop breakpoint detection, single-tile
 * vs pinned-tile derivation, visible-strip clamp at 6 slots, overflow
 * count + slot helpers, and `togglePin`. Store-free, protocol-free.
 *
 * `pinnedPeerId` is an **input** Ref owned by the page (it's also
 * mutated by the page-side "reset pin when peer leaves" watcher). The
 * composable's `togglePin` reads + writes through it.
 *
 * Cleanup: `onBeforeUnmount` removes the matchMedia listener and nulls
 * the cached `MediaQueryList` — matches the inline cleanup the pages
 * used to do.
 *
 * The composable does not import any store / protocol / call-core
 * module. It is template-style-free; CSS classes are applied by the
 * pages.
 */

const SPOTLIGHT_DESKTOP_MEDIA = '(min-width: 1024px)'
export const SPOTLIGHT_STRIP_VISIBLE_LIMIT = 6

export interface UseCallSpotlightLayoutOptions {
  /**
   * Ordered tiles, one row per tile, in current render order. Only the
   * `peerId` field is read.
   */
  orderedTiles: ComputedRef<Array<{ peerId: string }>> | Ref<Array<{ peerId: string }>>
  /**
   * Pinned peer ref owned by the page. `togglePin` mutates it. The
   * page is responsible for clearing it when the pinned peer leaves
   * (that watcher reads `tiles`, which is upstream of `orderedTiles`,
   * so it stays outside this composable).
   */
  pinnedPeerId: Ref<string | null>
}

export interface UseCallSpotlightLayoutApi {
  /**
   * Exposed so page-side `orderedTiles` computed (which we deliberately
   * do NOT extract in this block) can keep its existing read of the
   * desktop-breakpoint flag without re-creating a matchMedia listener.
   */
  spotlightDesktop: Ref<boolean>
  layoutMode: ComputedRef<'grid' | 'spotlight'>
  spotlightPeerId: ComputedRef<string | null>
  spotlightStripPeerIds: ComputedRef<string[]>
  spotlightVisibleStripPeerIds: ComputedRef<string[]>
  spotlightVisibleStripPeerIdSet: ComputedRef<Set<string>>
  spotlightOverflowCount: ComputedRef<number>
  spotlightOverflowTileStyle: ComputedRef<Record<string, string>>
  spotlightStripSlotForPeer: (peerId: string) => number
  isSpotlightStripPeerHidden: (peerId: string) => boolean
  togglePin: (peerId: string) => void
}

export function useCallSpotlightLayout(
  options: UseCallSpotlightLayoutOptions,
): UseCallSpotlightLayoutApi {
  const { orderedTiles, pinnedPeerId } = options

  const spotlightDesktop = ref(
    typeof window !== 'undefined' ? window.matchMedia(SPOTLIGHT_DESKTOP_MEDIA).matches : true,
  )
  let spotlightDesktopMediaQuery: MediaQueryList | null = null

  function syncSpotlightDesktop(ev?: MediaQueryListEvent): void {
    spotlightDesktop.value = ev?.matches ?? spotlightDesktopMediaQuery?.matches ?? true
  }

  const layoutMode = computed<'grid' | 'spotlight'>(() =>
    spotlightDesktop.value && (pinnedPeerId.value != null || orderedTiles.value.length === 1)
      ? 'spotlight'
      : 'grid',
  )

  const spotlightPeerId = computed(() => {
    if (pinnedPeerId.value != null) {
      return pinnedPeerId.value
    }
    return orderedTiles.value.length === 1 ? orderedTiles.value[0]?.peerId ?? null : null
  })

  const spotlightStripPeerIds = computed(() => {
    const main = spotlightPeerId.value
    return main == null
      ? []
      : orderedTiles.value.filter((tile) => tile.peerId !== main).map((tile) => tile.peerId)
  })

  const spotlightVisibleStripPeerIds = computed(() => {
    const ids = spotlightStripPeerIds.value
    if (ids.length > SPOTLIGHT_STRIP_VISIBLE_LIMIT) {
      return ids.slice(0, SPOTLIGHT_STRIP_VISIBLE_LIMIT - 1)
    }
    return ids.slice(0, SPOTLIGHT_STRIP_VISIBLE_LIMIT)
  })

  const spotlightVisibleStripPeerIdSet = computed(
    () => new Set(spotlightVisibleStripPeerIds.value),
  )

  const spotlightOverflowCount = computed(() =>
    Math.max(0, spotlightStripPeerIds.value.length - spotlightVisibleStripPeerIds.value.length),
  )

  const spotlightOverflowTileStyle = computed(() => ({
    '--call-page-spotlight-slot': String(SPOTLIGHT_STRIP_VISIBLE_LIMIT),
  }))

  function spotlightStripSlotForPeer(peerId: string): number {
    const index = spotlightVisibleStripPeerIds.value.indexOf(peerId)
    return index >= 0 ? index + 1 : 1
  }

  function isSpotlightStripPeerHidden(peerId: string): boolean {
    return (
      layoutMode.value === 'spotlight' &&
      peerId !== spotlightPeerId.value &&
      !spotlightVisibleStripPeerIdSet.value.has(peerId)
    )
  }

  function togglePin(peerId: string): void {
    if (!orderedTiles.value.some((tile) => tile.peerId === peerId)) {
      return
    }
    pinnedPeerId.value = pinnedPeerId.value === peerId ? null : peerId
  }

  onMounted(() => {
    if (typeof window === 'undefined') return
    spotlightDesktopMediaQuery = window.matchMedia(SPOTLIGHT_DESKTOP_MEDIA)
    syncSpotlightDesktop()
    spotlightDesktopMediaQuery.addEventListener('change', syncSpotlightDesktop)
  })

  onBeforeUnmount(() => {
    if (spotlightDesktopMediaQuery) {
      spotlightDesktopMediaQuery.removeEventListener('change', syncSpotlightDesktop)
      spotlightDesktopMediaQuery = null
    }
  })

  return {
    spotlightDesktop,
    layoutMode,
    spotlightPeerId,
    spotlightStripPeerIds,
    spotlightVisibleStripPeerIds,
    spotlightVisibleStripPeerIdSet,
    spotlightOverflowCount,
    spotlightOverflowTileStyle,
    spotlightStripSlotForPeer,
    isSpotlightStripPeerHidden,
    togglePin,
  }
}
