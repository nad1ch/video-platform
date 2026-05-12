<script setup lang="ts">
/**
 * GameCallTile — slot-based wrapper around `<ParticipantTile>`.
 *
 * Wraps the production `<ParticipantTile>` without modifying it. The
 * production tile is mounted with **minimal media-only props** (no Mafia
 * props), so its internal Mafia chrome stays inactive. A per-game overlay
 * layer is rendered as a SIBLING element absolutely positioned over the
 * tile root, fed via the `#overlay` slot.
 *
 * This is the reference design for future tile-overlay extraction in the
 * production CallPage:
 *   - the wrapper owns the tile-wrap box (the absolute-positioning context);
 *   - `ParticipantTile` handles webcam / mic / name / listen volume;
 *   - the slot owns the game-specific chrome (seat / role / life veneer /
 *     elimination mark / host life toggle / etc.).
 *
 * Phase 4 lab uses this pattern to validate that overlay state changes do
 * not cause `<StreamVideo>` patches — the overlay's reactivity surface is
 * fully decoupled from the tile's reactivity surface at the wrapper
 * boundary.
 */

import { computed } from 'vue'
import ParticipantTile from '@/components/call/ParticipantTile.vue'
import type { GameCallTileLike } from './gameCallShellContext'

const props = withDefaults(
  defineProps<{
    tile: GameCallTileLike
    sizeTier: 'sm' | 'md' | 'lg'
    /** Optional pass-through `rowSpeaking` flag from the page (default false). */
    rowSpeaking?: boolean
  }>(),
  {
    rowSpeaking: false,
  },
)

const tileKey = computed(() => props.tile.peerId || 'local-self')
</script>

<template>
  <!--
    Reuses production `call-page__tile-wrap` + `call-page__tile-inner`
    classes so the template page picks up the same per-tile box / radius /
    aspect rules as production `<CallPage>`. The `#overlay` slot is a
    sibling absolute-positioned layer on top — never inside the `v-memo`'d
    `<StreamVideo>` subtree of `<ParticipantTile>`.
  -->
  <div class="call-page__tile-wrap game-call-tile" :data-peer-id="tileKey">
    <!--
      Production tile: mounted with media-only props so the tile's internal
      Mafia chrome stays inactive. The wrapper's `#overlay` slot layers the
      game-specific chrome on top.
    -->
    <ParticipantTile
      class="call-page__tile-inner"
      :peer-id="tile.peerId"
      :display-name="tile.displayName"
      :stream="tile.stream"
      :is-local="tile.isLocal"
      :video-enabled="tile.videoEnabled"
      :audio-enabled="tile.audioEnabled"
      :play-rev="tile.playRev"
      :size-tier="sizeTier"
      :row-speaking="rowSpeaking"
      :remote-listen-volume="tile.remoteListenVolume"
      :remote-listen-muted="tile.remoteListenMuted"
      :raise-hand="Boolean(tile.handRaised)"
      :video-fill-cover="Boolean(tile.videoFillCover)"
      :video-presentation="tile.videoPresentation"
      :avatar-url="tile.avatarUrl ?? ''"
    />

    <!--
      Per-game overlay layer. `position: absolute; inset: 0; pointer-events: none`
      by default; the slot content can re-enable pointer events on the
      interactive sub-elements (e.g. host life toggle button).
    -->
    <div class="game-call-tile__overlay" aria-hidden="false">
      <slot name="overlay" :peer-id="tile.peerId" :tile="tile" :size-tier="sizeTier" />
    </div>
  </div>
</template>

<style scoped>
/*
 * `.call-page__tile-wrap` (production) provides position/radius/box rules
 * via CallPage.css; this scoped class only adds the overlay layer.
 */
.game-call-tile__overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
}

/*
 * Re-enable pointer events on interactive children of the overlay slot.
 * Use this class on buttons / inputs inside the overlay so they remain
 * clickable while the rest of the overlay stays click-through (which keeps
 * tile click-through behaviour intact for any future drag-to-reorder etc.).
 */
.game-call-tile__overlay :deep(.game-call-tile-overlay__interactive) {
  pointer-events: auto;
}
</style>
