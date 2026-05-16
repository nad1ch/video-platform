import { computed, nextTick, onBeforeUnmount, shallowRef, watch, } from 'vue';
import { computeCallVideoGridLayout } from '@/components/call/callVideoGridLayout';
/**
 * Block 23 — pure layout composable extracted from `CallPage.vue` and
 * `GameTemplateCallPage.vue`. The two pages previously carried this
 * code byte-equivalently; both routes now consume the same composable.
 *
 * Scope: DOM-only FLIP animation + stage / grid size measurement.
 *   - Owns `stageRef`, `gridRef`, `stageSize`, the raw `Map<string, HTMLElement>`
 *     tile-wrap registry, the RAF / timer handles for the FLIP, and the
 *     two watchers that drive it.
 *   - Reads `orderedTiles` for the animation-key dependency, `layoutMode`
 *     and `spotlightPeerId` for the same purpose, and `dragPeerId` to
 *     skip the FLIP while a tile is being dragged.
 *   - Triggers `playTileLayoutFlip` on any change to the animation key
 *     (post-render measurement), and clears all flips when the tile
 *     order itself changes (covering the drag-drop reorder path which
 *     bypasses the animation key by design).
 *
 * Cleanup: `onBeforeUnmount` cancels the pending RAF and the post-FLIP
 * timer; matches the inline `if (typeof window !== 'undefined')`
 * cleanup the pages used to do.
 *
 * The composable is store-free, protocol-free, and never touches
 * `<ParticipantTile>` props or `streamVideoMemoDeps`. The `Map<string,
 * HTMLElement>` registry stays a *raw* `Map` (not `ref` / `reactive`)
 * exactly as the pages had it — wrapping it would make the FLIP timing
 * subtly different.
 *
 * Constants kept verbatim with the pages:
 *   - `GAP = 12`
 *   - `MIN_TILE_WIDTH = 180`
 *   - `GRID_CONTENT_INSET_PX = 12`
 *   - `TILE_LAYOUT_FLIP_MS = 220`
 *   - `TILE_LAYOUT_FLIP_EPSILON_PX = 0.5`
 */
export const GAP = 12;
export const MIN_TILE_WIDTH = 180;
export const GRID_CONTENT_INSET_PX = 12;
export const TILE_LAYOUT_FLIP_MS = 220;
export const TILE_LAYOUT_FLIP_EPSILON_PX = 0.5;
export function useCallTileLayoutFlip(options) {
    const { stageRef, gridRef, orderedTiles, layoutMode, spotlightPeerId, dragPeerId } = options;
    const stageSize = shallowRef({ width: 0, height: 0 });
    /**
     * Raw (non-reactive) `Map<string, HTMLElement>` registry — wrapping
     * this in `ref`/`reactive` would change FLIP timing because every
     * `set`/`delete` would schedule a Vue effect run. Tests on both
     * routes verified this stays a plain `Map`.
     */
    const tileWrapEls = new Map();
    let tileLayoutFlipTimer = null;
    let tileLayoutFlipRaf = 0;
    function getGrid(n, width, height) {
        return computeCallVideoGridLayout(n, width, height, {
            gapPx: GAP,
            minTileWidthPx: MIN_TILE_WIDTH,
            contentInsetPx: GRID_CONTENT_INSET_PX,
        });
    }
    function setTileWrapRef(peerId, el) {
        if (el instanceof HTMLElement) {
            tileWrapEls.set(peerId, el);
            return;
        }
        tileWrapEls.delete(peerId);
    }
    watch(stageRef, (el, _prev, onCleanup) => {
        if (!el) {
            return;
        }
        const update = () => {
            const rect = el.getBoundingClientRect();
            if (typeof getComputedStyle === 'undefined') {
                stageSize.value = { width: rect.width, height: rect.height };
                return;
            }
            const cs = getComputedStyle(el);
            const pl = parseFloat(cs.paddingLeft) || 0;
            const pr = parseFloat(cs.paddingRight) || 0;
            const pt = parseFloat(cs.paddingTop) || 0;
            const pb = parseFloat(cs.paddingBottom) || 0;
            stageSize.value = {
                width: Math.max(0, rect.width - pl - pr),
                height: Math.max(0, rect.height - pt - pb),
            };
        };
        update();
        if (typeof ResizeObserver === 'undefined') {
            return;
        }
        const ro = new ResizeObserver(update);
        ro.observe(el);
        onCleanup(() => {
            ro.disconnect();
        });
    }, { immediate: true, flush: 'post' });
    const tileLayoutAnimationKey = computed(() => [
        layoutMode.value,
        spotlightPeerId.value ?? '',
        orderedTiles.value.map((tile) => tile.peerId).join(','),
        Math.round(stageSize.value.width),
        Math.round(stageSize.value.height),
    ].join('|'));
    function readTileRects() {
        const rects = new Map();
        for (const [peerId, el] of tileWrapEls) {
            rects.set(peerId, el.getBoundingClientRect());
        }
        return rects;
    }
    function clearTileFlip(el) {
        el.classList.remove('call-page__tile-wrap--flip-prepare', 'call-page__tile-wrap--flipping');
        el.style.removeProperty('--tile-flip-x');
        el.style.removeProperty('--tile-flip-y');
        el.style.removeProperty('--tile-flip-scale-x');
        el.style.removeProperty('--tile-flip-scale-y');
    }
    function clearAllTileFlips() {
        if (typeof window !== 'undefined') {
            window.cancelAnimationFrame(tileLayoutFlipRaf);
            if (tileLayoutFlipTimer != null) {
                window.clearTimeout(tileLayoutFlipTimer);
                tileLayoutFlipTimer = null;
            }
        }
        for (const el of tileWrapEls.values()) {
            clearTileFlip(el);
        }
    }
    function playTileLayoutFlip(firstRects) {
        if (typeof window === 'undefined') {
            return;
        }
        window.cancelAnimationFrame(tileLayoutFlipRaf);
        if (tileLayoutFlipTimer != null) {
            window.clearTimeout(tileLayoutFlipTimer);
            tileLayoutFlipTimer = null;
        }
        void nextTick(() => {
            const animated = [];
            for (const [peerId, lastEl] of tileWrapEls) {
                const first = firstRects.get(peerId);
                if (!first) {
                    continue;
                }
                const last = lastEl.getBoundingClientRect();
                if (first.width <= 0 || first.height <= 0 || last.width <= 0 || last.height <= 0) {
                    continue;
                }
                const dx = first.left - last.left;
                const dy = first.top - last.top;
                const sx = first.width / last.width;
                const sy = first.height / last.height;
                const moved = Math.abs(dx) > TILE_LAYOUT_FLIP_EPSILON_PX || Math.abs(dy) > TILE_LAYOUT_FLIP_EPSILON_PX;
                const resized = Math.abs(1 - sx) > 0.01 || Math.abs(1 - sy) > 0.01;
                if (!moved && !resized) {
                    continue;
                }
                lastEl.classList.add('call-page__tile-wrap--flip-prepare');
                lastEl.style.setProperty('--tile-flip-x', `${dx}px`);
                lastEl.style.setProperty('--tile-flip-y', `${dy}px`);
                lastEl.style.setProperty('--tile-flip-scale-x', String(sx));
                lastEl.style.setProperty('--tile-flip-scale-y', String(sy));
                animated.push(lastEl);
            }
            if (animated.length === 0) {
                return;
            }
            void gridRef.value?.offsetWidth;
            tileLayoutFlipRaf = window.requestAnimationFrame(() => {
                for (const el of animated) {
                    el.classList.remove('call-page__tile-wrap--flip-prepare');
                    el.classList.add('call-page__tile-wrap--flipping');
                    el.style.setProperty('--tile-flip-x', '0px');
                    el.style.setProperty('--tile-flip-y', '0px');
                    el.style.setProperty('--tile-flip-scale-x', '1');
                    el.style.setProperty('--tile-flip-scale-y', '1');
                }
                tileLayoutFlipTimer = window.setTimeout(() => {
                    for (const el of animated) {
                        clearTileFlip(el);
                    }
                    tileLayoutFlipTimer = null;
                }, TILE_LAYOUT_FLIP_MS + 60);
            });
        });
    }
    watch(tileLayoutAnimationKey, () => {
        if (dragPeerId.value != null) {
            return;
        }
        const firstRects = readTileRects();
        if (firstRects.size > 0) {
            playTileLayoutFlip(firstRects);
        }
    }, { flush: 'pre' });
    watch(() => orderedTiles.value.map((tile) => tile.peerId).join('|'), () => {
        clearAllTileFlips();
    }, { flush: 'pre' });
    onBeforeUnmount(() => {
        if (typeof window !== 'undefined') {
            window.cancelAnimationFrame(tileLayoutFlipRaf);
            if (tileLayoutFlipTimer != null) {
                window.clearTimeout(tileLayoutFlipTimer);
                tileLayoutFlipTimer = null;
            }
        }
    });
    return {
        stageSize,
        tileLayoutAnimationKey,
        setTileWrapRef,
        getGrid,
    };
}
