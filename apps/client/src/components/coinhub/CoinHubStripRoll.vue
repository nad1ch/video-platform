<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { dailySpinReelProgress } from '@/utils/coinHub/coinHubBezierEasing'
import { endTranslateX, mapSlotMachineProgress } from '@/utils/coinHub/coinHubStripMath'
import { getSpinRarityForLabel } from '@/utils/coinHub/coinHubRarity'
import type { SpinStripCell } from '@/utils/coinHub/coinHubStripMath'
import type { StripTickSpeed } from '@/utils/coinHub/coinHubAudioStub'
import { playStripTickAtSpeed, playWinStop } from '@/utils/coinHub/coinHubAudioStub'

const props = withDefaults(
  defineProps<{
    /** One label or structured cell per item (daily spin uses `SpinStripCell` from the reel builder). */
    cells: (string | SpinStripCell)[]
    landIndex: number
    itemWidthPx?: number
    durationMs?: number
    /** `lg` = wide cinematic reel (hero spin on Coin Hub). */
    size?: 'md' | 'lg'
    /**
     * In placeholder `—` state, show a slow infinite scroll of `idleBaseCells` (doubled) until
     * a real spin runs. Ignored while the RAF main roll is active.
     */
    enableIdleAutoplay?: boolean
    /** “Attract” values for the idle loop; duplicated for a seamless track. */
    idleBaseCells?: string[]
    /** After the reel stops on the prize, add extra read-a-boo on the winning cell. */
    highlightLandWin?: boolean
    /** Daily spin: long decel / heavy stop (cubic-bezier style), vs case-opening strip. */
    dailyAnticipationEasing?: boolean
  }>(),
  {
    itemWidthPx: 72,
    durationMs: 2800,
    size: 'md',
    enableIdleAutoplay: false,
    idleBaseCells: () => ['5', '8', '12', '20', '25', '50', '100'],
    highlightLandWin: false,
    dailyAnticipationEasing: false,
  },
)

type CoinHubStripProgressMeta = {
  /** Wall-clock time left in main roll before bounce. */
  remainingMainMs: number
  /** Raw time 0..1 (with friction pauses). Drives pre-win / tension UI. */
  rawU: number
  /** Scroll position 0..1 (eased, heavy late slowdown). */
  scrollPos: number
  preWin: boolean
  /** Last ~500ms of main segment — “heartbeat” window for parent. */
  heartbeat: boolean
  inMainPhase: boolean
}

const emit = defineEmits<{
  complete: []
  progress: [scrollPos: number, meta: CoinHubStripProgressMeta]
}>()

const viewportRef = ref<HTMLElement | null>(null)
/** Pause idle “attract” on hover (premium slot affordance). */
const idleHoverPause = ref(false)
const translateX = ref(0)
/** Scroll position 0..1 (eased); drives parallax. */
const spinT = ref(0)
/** Raw virtual time 0..1; drives marker, near-win glow, stutter. */
const rawProgressU = ref(0)
const isReelActive = ref(false)
const rowNudgeX = ref(0)

const viewportW = ref(360)

let raf = 0
let idleRaf = 0
let idleRunToken = 0
const IDLE_PX_PER_SEC = 24
let runToken = 0
let lastTickIndex = -1
let useReducedMotion = false

if (typeof window !== 'undefined' && window.matchMedia) {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  useReducedMotion = mq.matches
}

const isPlaceholderCells = computed(
  () => props.cells.length === 1 && props.cells[0] === '—',
)
const loopedIdleCells = computed(() => {
  const b = props.idleBaseCells.length > 0 ? props.idleBaseCells : ['5', '8', '12', '20', '25', '50', '100']
  // Five repeats: one period = len(b)×itemWidth for seamless RAF wrap.
  return [...b, ...b, ...b, ...b, ...b]
})
/** “Attract” track: parent keeps phase `idle` and placeholder; motion is RAF (no CSS loop jump). */
const showIdleStrip = computed(
  () => props.enableIdleAutoplay && isPlaceholderCells.value && !isReelActive.value,
)
const displayCells = computed(() => (showIdleStrip.value ? loopedIdleCells.value : props.cells))
const activeStripLength = computed(() => displayCells.value.length)
const effectiveLandIndex = computed(() => (showIdleStrip.value ? -1 : props.landIndex))
const rowStyle = computed(() => ({
  transform: `translate3d(${translateX.value + rowNudgeX.value}px,0,0)`,
}))

function easeOutQuad(t: number) {
  return 1 - (1 - t) * (1 - t)
}
function easeInCubic(t: number) {
  return t * t * t
}

function cancelRaf() {
  if (raf) {
    cancelAnimationFrame(raf)
    raf = 0
  }
}

function cancelIdleRaf() {
  if (idleRaf) {
    cancelAnimationFrame(idleRaf)
    idleRaf = 0
  }
}

function tickSpeedFromU(u: number): StripTickSpeed {
  if (u < 0.2) {
    return 'fast'
  }
  if (u < 0.5) {
    return 'cruise'
  }
  if (u < 0.85) {
    return 'decel'
  }
  return 'nearStop'
}

function startIdleRaf() {
  cancelIdleRaf()
  if (useReducedMotion) {
    return
  }
  if (!showIdleStrip.value) {
    return
  }
  const base =
    props.idleBaseCells.length > 0
      ? props.idleBaseCells
      : (['5', '8', '12', '20', '25', '50', '100'] as string[])
  const periodPx = base.length * props.itemWidthPx
  if (periodPx < 1) {
    return
  }
  idleRunToken += 1
  const my = idleRunToken
  let last = performance.now()
  function frame(now: number) {
    if (my !== idleRunToken) {
      return
    }
    if (!showIdleStrip.value || isReelActive.value) {
      cancelIdleRaf()
      return
    }
    if (idleHoverPause.value) {
      last = now
      idleRaf = requestAnimationFrame(frame)
      return
    }
    const dt = now - last
    last = now
    let x = translateX.value - (IDLE_PX_PER_SEC * dt) / 1000
    while (x <= -periodPx) {
      x += periodPx
    }
    translateX.value = x
    idleRaf = requestAnimationFrame(frame)
  }
  idleRaf = requestAnimationFrame(frame)
}

function syncViewportW() {
  const v = viewportRef.value
  if (v) {
    const w = v.getBoundingClientRect().width
    if (w >= 8) {
      viewportW.value = w
    }
  }
}

/** Per-cell “depth”: scale + opacity by distance to viewport center; blur at edges. */
function cellStyle(i: number): Record<string, string> {
  const w = props.itemWidthPx
  const tw = translateX.value
  const vw = viewportW.value
  const n = activeStripLength.value
  if (n < 2 || w <= 0 || vw < 8) {
    return {
      transform: 'scale(1) translateZ(0)',
      opacity: '1',
      filter: 'none',
    }
  }
  if (!isReelActive.value) {
    return {
      transform: 'scale(1) translateZ(0)',
      opacity: '1',
      filter: 'none',
    }
  }
  const cellLeft = i * w + tw
  const center = cellLeft + w * 0.5
  const dist = Math.abs(center - vw * 0.5)
  const fall = w * 2.1
  const f = Math.max(0, 1 - Math.min(1, dist / fall))
  const sc = 0.84 + 0.16 * f
  const op = 0.35 + 0.65 * f
  const bl = f > 0.92 ? 0 : (1 - f) * 0.32
  return {
    transform: `scale(${sc}) translateZ(0)`,
    opacity: String(op),
    filter: bl > 0.05 ? `blur(${bl.toFixed(2)}px)` : 'none',
  }
}

function currentCenterIndex(vw: number, x: number, w: number, n: number): number {
  if (n <= 0) {
    return 0
  }
  const j = Math.floor((vw * 0.5 - x) / w)
  return Math.max(0, Math.min(n - 1, j))
}

function progressEmitDone() {
  emit('progress', 1, {
    remainingMainMs: 0,
    rawU: 1,
    scrollPos: 1,
    preWin: false,
    heartbeat: false,
    inMainPhase: false,
  })
  emit('complete')
}

/** Single-cell idle: center the marker. Multi-cell: starting translate is 0; animation runs. */
async function applyStaticCenter() {
  isReelActive.value = false
  const v = viewportRef.value
  if (!v || props.cells.length === 0) {
    return
  }
  if (props.landIndex < 0 || props.landIndex >= props.cells.length) {
    return
  }
  await nextTick()
  await new Promise<void>((r) => requestAnimationFrame(() => r()))
  syncViewportW()
  let vw = viewportW.value
  if (vw < 8) {
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    syncViewportW()
    vw = viewportW.value
  }
  if (vw < 8) {
    translateX.value = 0
    return
  }
  translateX.value = endTranslateX(vw, props.itemWidthPx, props.landIndex)
  spinT.value = 0
  rawProgressU.value = 0
  rowNudgeX.value = 0
}

function runAnimation() {
  cancelRaf()
  const v = viewportRef.value
  if (!v || props.cells.length < 2) {
    if (props.cells.length === 1) {
      void applyStaticCenter()
    }
    progressEmitDone()
    return
  }
  if (props.landIndex < 0 || props.landIndex >= props.cells.length) {
    progressEmitDone()
    return
  }
  const local = ++runToken
  syncViewportW()
  let vw = viewportW.value
  if (vw < 8) {
    requestAnimationFrame(() => {
      if (local !== runToken) {
        return
      }
      syncViewportW()
      const vw2 = viewportW.value
      if (vw2 < 8) {
        progressEmitDone()
        return
      }
      startRollAfterMeasure(local, vw2)
    })
    return
  }
  startRollAfterMeasure(local, vw)
}

function startRollAfterMeasure(local: number, vw: number) {
  if (local !== runToken) {
    return
  }
  cancelIdleRaf()
  idleRunToken += 1
  const w = props.itemWidthPx
  const endBase = endTranslateX(vw, w, props.landIndex)
  const jitter = useReducedMotion ? 0 : (Math.random() - 0.5) * 4
  const end = endBase + jitter
  const start = 0
  const baseDur = Math.max(2200, props.durationMs)
  const dur = useReducedMotion
    ? Math.min(700, baseDur)
    : baseDur + (Math.random() - 0.5) * 160
  isReelActive.value = true
  lastTickIndex = -1
  translateX.value = start
  spinT.value = 0
  rawProgressU.value = 0
  rowNudgeX.value = 0
  const nCells = props.cells.length
  const t0 = performance.now()
  let lastFrame = t0
  let virtualElapsed = 0

  function mainFrame(now: number) {
    if (local !== runToken) {
      return
    }
    virtualElapsed += now - lastFrame
    lastFrame = now
    const rawU = Math.min(1, virtualElapsed / dur)
    /* One smooth bezier for daily spin — do not compose with piecewise time remap
       (kinks felt like a sudden stop, then a slow “second” motion). */
    const scrollPos = useReducedMotion
      ? rawU
      : props.dailyAnticipationEasing
        ? dailySpinReelProgress(rawU)
        : mapSlotMachineProgress(rawU)
    const baseX = start + (end - start) * scrollPos
    const tensionDamp = scrollPos < 0.88 ? 1 : 0.35
    const tension =
      useReducedMotion || props.dailyAnticipationEasing
        ? 0
        : Math.sin(now * 0.011) * 0.55 * (1 - scrollPos) * 0.45 * tensionDamp
    rowNudgeX.value =
      useReducedMotion || props.dailyAnticipationEasing
        ? 0
        : Math.sin(now * 0.019 + (local % 5) * 0.1) * 0.3 * (1 - scrollPos)
    translateX.value = baseX + tension
    spinT.value = scrollPos
    rawProgressU.value = rawU
    const remainingMainMs = dur * (1 - rawU)
    const preWin = rawU >= 0.5
    const heartbeat = !useReducedMotion && rawU < 1 && remainingMainMs <= 500 && remainingMainMs >= 0
    emit('progress', scrollPos, {
      remainingMainMs,
      rawU,
      scrollPos,
      preWin,
      heartbeat,
      inMainPhase: true,
    })

    if (!useReducedMotion) {
      const j = currentCenterIndex(vw, baseX, w, nCells)
      if (j !== lastTickIndex) {
        lastTickIndex = j
        playStripTickAtSpeed(tickSpeedFromU(rawU), { preWin: rawU > 0.5 && rawU < 0.88 })
      }
    }
    if (rawU < 1) {
      raf = requestAnimationFrame(mainFrame)
    } else {
      translateX.value = end
      spinT.value = 1
      rawProgressU.value = 1
      raf = 0
      if (useReducedMotion) {
        isReelActive.value = false
        playWinStop()
        progressEmitDone()
        return
      }
      emit('progress', 1, {
        remainingMainMs: 0,
        rawU: 1,
        scrollPos: 1,
        preWin: true,
        heartbeat: false,
        inMainPhase: false,
      })
      runBounceOvershoot(local, end, vw, w, nCells)
    }
  }
  raf = requestAnimationFrame(mainFrame)
}

function runBounceOvershoot(
  local: number,
  settle: number,
  vw: number,
  w: number,
  nCells: number,
) {
  if (local !== runToken) {
    return
  }
  const overshoot = useReducedMotion ? 3 : 8 + Math.random() * 7
  const upMs = useReducedMotion ? 40 : 80
  const downMs = useReducedMotion ? 50 : 120
  const tB = performance.now()

  function bounceFrame(now: number) {
    if (local !== runToken) {
      return
    }
    const e = now - tB
    if (e < upMs) {
      const u = e / upMs
      const k = easeOutQuad(u)
      translateX.value = settle + overshoot * k
      rowNudgeX.value = 0
    } else if (e < upMs + downMs) {
      const u = (e - upMs) / downMs
      const k = 1 - easeInCubic(u)
      translateX.value = settle + overshoot * k
    } else {
      translateX.value = settle
      rowNudgeX.value = 0
      isReelActive.value = false
      spinT.value = 0
      rawProgressU.value = 0
      playWinStop()
      emit('progress', 1, {
        remainingMainMs: 0,
        rawU: 1,
        scrollPos: 1,
        preWin: false,
        heartbeat: false,
        inMainPhase: false,
      })
      emit('complete')
      raf = 0
      return
    }
    if (!useReducedMotion) {
      const j = currentCenterIndex(vw, translateX.value, w, nCells)
      if (e >= upMs && e < upMs + 28 && j !== lastTickIndex) {
        lastTickIndex = j
        playStripTickAtSpeed('nearStop')
      }
    }
    raf = requestAnimationFrame(bounceFrame)
  }
  raf = requestAnimationFrame(bounceFrame)
}

watch(
  () => [props.cells, props.landIndex, props.itemWidthPx, props.enableIdleAutoplay] as const,
  () => {
    runToken += 1
    cancelRaf()
    if (props.enableIdleAutoplay && isPlaceholderCells.value) {
      isReelActive.value = false
      translateX.value = 0
      rowNudgeX.value = 0
      spinT.value = 0
      rawProgressU.value = 0
      void nextTick(() => {
        startIdleRaf()
      })
      return
    }
    if (props.cells.length <= 1) {
      void applyStaticCenter()
    } else {
      runAnimation()
    }
  },
  { deep: true, immediate: true },
)

function isSpinStripCell(c: string | SpinStripCell): c is SpinStripCell {
  return typeof c === 'object' && c !== null && 'display' in c
}

function stripCellDisplay(c: string | SpinStripCell): string {
  return isSpinStripCell(c) ? c.display : c
}

function stripCellRarity(c: string | SpinStripCell) {
  return isSpinStripCell(c) ? c.rarity : getSpinRarityForLabel(c)
}

function cellRarityClass(c: string | SpinStripCell) {
  return `coinhub-strip-roll__cell--rarity-${stripCellRarity(c)}`
}

function cellExtraClass(c: string | SpinStripCell) {
  if (!isSpinStripCell(c)) {
    return ''
  }
  const out: string[] = []
  if (c.kind === 'bonus' && c.bonusType) {
    out.push('coinhub-strip-roll__cell--bonus', `coinhub-strip-roll__cell--bonus-${c.bonusType}`)
  }
  if (c.nearMiss) {
    out.push('coinhub-strip-roll__cell--near-miss')
  }
  return out.join(' ')
}

function cellRowKey(c: string | SpinStripCell, i: number) {
  return isSpinStripCell(c) ? c.id : `strip-cell-${i}`
}

function onWindowResize() {
  syncViewportW()
}

onMounted(() => {
  if (typeof window === 'undefined') {
    return
  }
  syncViewportW()
  window.addEventListener('resize', onWindowResize, { passive: true })
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', onWindowResize)
  }
  runToken += 1
  cancelRaf()
  cancelIdleRaf()
})

const markerGlow = computed(() => {
  if (!isReelActive.value) {
    return 0.7
  }
  const u = rawProgressU.value
  const micro =
    typeof performance !== 'undefined' ? 0.04 * Math.sin(performance.now() * 0.004) : 0
  if (u > 0.72) {
    const k = (u - 0.72) / 0.28
    return Math.min(1.15, 0.48 + 0.62 * k + micro)
  }
  if (u > 0.55) {
    const k = (u - 0.55) / 0.17
    return 0.38 + 0.28 * k + micro
  }
  return 0.35 + 0.25 * u + micro
})

/** Gold center line — strong bloom + rim (reads as the “real” reel marker). */
const markerStyle = computed(() => {
  const g = markerGlow.value
  const rim = 0.55 + 0.38 * g
  const a = 0.42 + 0.28 * g
  return {
    boxShadow: `
      0 0 28px rgba(250, 204, 21, 0.88),
      0 0 52px rgba(250, 195, 70, 0.45),
      0 0 0 1px rgba(255, 220, 130, ${rim.toFixed(2)}),
      0 0 ${(6 + 5 * g).toFixed(1)}px 2px rgba(255, 190, 60, ${Math.min(0.72, a).toFixed(2)}),
      inset 0 1px 0 rgba(255, 255, 255, ${(0.28 + 0.2 * g).toFixed(2)})
    `
      .replace(/\s+/g, ' ')
      .trim(),
  }
})
</script>

<template>
  <div
    ref="viewportRef"
    :class="[
      'coinhub-strip-roll relative w-full overflow-hidden rounded-md border',
      size === 'lg' ? 'coinhub-strip-roll--lg min-h-[6.75rem] sm:min-h-[7.5rem]' : 'min-h-[5.5rem]',
    ]"
    :style="{
      '--ch-spin-t': String(spinT),
      '--ch-raw-u': String(rawProgressU),
      '--ch-marker-glow': String(markerGlow),
    }"
    @mouseenter="idleHoverPause = true"
    @mouseleave="idleHoverPause = false"
  >
    <div
      class="coinhub-strip-roll__noise pointer-events-none absolute inset-0 z-[25] mix-blend-overlay opacity-[0.035]"
      aria-hidden="true"
    />
    <div
      class="coinhub-strip-roll__toplight pointer-events-none absolute inset-x-0 top-0 z-[1] h-[32%]"
      aria-hidden="true"
    />
    <div
      class="coinhub-strip-roll__depth pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-1/2"
      aria-hidden="true"
    />
    <div
      class="absolute inset-0 flex items-stretch"
      role="presentation"
    >
      <div
        :class="['coinhub-strip-roll__row coinhub-strip-roll__reel-track flex h-full will-change-transform']"
        :style="rowStyle"
      >
        <div
          v-for="(c, i) in displayCells"
          :key="cellRowKey(c, i)"
          :class="[
            'coinhub-strip-roll__cell flex shrink-0 select-none items-center justify-center border-r border-slate-900/50',
            cellRarityClass(c),
            cellExtraClass(c),
            i === effectiveLandIndex
              ? 'coinhub-strip-roll__cell--land text-amber-100'
              : 'text-slate-300/95',
            i === effectiveLandIndex && highlightLandWin && !isReelActive && 'coinhub-strip-roll__cell--win-punch',
            size === 'lg' && 'coinhub-strip-roll__cell--lg',
            isReelActive && 'coinhub-strip-roll__cell--parallax',
          ]"
          :style="{ width: `${itemWidthPx}px`, ...cellStyle(i) }"
        >
          <span
            :class="[
              'coinhub-strip-roll__chip inline-flex min-w-[2.5rem] justify-center rounded-md px-1.5 py-0.5 text-center font-extrabold tabular-nums',
              size === 'lg' ? 'text-base sm:text-lg' : 'text-sm sm:text-base',
              i === effectiveLandIndex && 'coinhub-strip-roll__chip--gold',
              isSpinStripCell(c) && c.kind === 'bonus' && 'coinhub-strip-roll__chip--bonus',
            ]"
          >{{ stripCellDisplay(c) }}</span>
        </div>
      </div>
    </div>
    <div
      class="coinhub-strip-roll__fog coinhub-strip-roll__fog--l pointer-events-none absolute inset-y-0 left-0 z-[12] w-[18%] max-w-[4.5rem]"
      aria-hidden="true"
    />
    <div
      class="coinhub-strip-roll__fog coinhub-strip-roll__fog--r pointer-events-none absolute inset-y-0 right-0 z-[12] w-[18%] max-w-[4.5rem]"
      aria-hidden="true"
    />
    <div
      :class="[
        'coinhub-strip-roll__marker pointer-events-none absolute top-0 z-[18] h-full w-[3px] sm:w-1',
        isReelActive && 'coinhub-strip-roll__marker--live',
        isReelActive && rawProgressU > 0.5 && 'coinhub-strip-roll__marker--anticipate',
        isReelActive && rawProgressU > 0.85 && 'coinhub-strip-roll__marker--near-win',
        highlightLandWin && !isReelActive && 'coinhub-strip-roll__marker--settled-win',
      ]"
      :style="markerStyle"
      aria-hidden="true"
    />
    <div
      :class="[
        'coinhub-strip-roll__marker-cap pointer-events-none absolute top-0 z-[19] h-2 w-3 -translate-y-px sm:h-2.5 sm:w-3.5',
        isReelActive && 'coinhub-strip-roll__marker-cap--live',
        isReelActive && rawProgressU > 0.5 && 'coinhub-strip-roll__marker-cap--jitter',
        isReelActive && rawProgressU > 0.85 && 'coinhub-strip-roll__marker-cap--near-win',
        highlightLandWin && !isReelActive && 'coinhub-strip-roll__marker-cap--settled-win',
      ]"
      aria-hidden="true"
    />
  </div>
</template>

<style scoped>
.coinhub-strip-roll {
  border: 1px solid rgba(255, 255, 255, 0.1);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.06) 0%, rgba(255, 255, 255, 0.015) 100%),
    radial-gradient(80% 90% at 50% 0%, rgba(124, 58, 237, 0.12) 0%, transparent 55%),
    rgba(18, 21, 40, 0.88);
  backdrop-filter: blur(22px);
  -webkit-backdrop-filter: blur(22px);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    inset 0 0 48px rgba(124, 58, 237, 0.2),
    inset 0 4px 28px rgba(0, 0, 0, 0.78),
    inset 0 -8px 24px rgba(0, 0, 0, 0.45),
    0 16px 48px rgba(0, 0, 0, 0.68),
    0 0 48px -14px rgba(124, 58, 237, 0.28);
}
.coinhub-strip-roll__noise {
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.35'/%3E%3C/svg%3E");
  background-size: 180px 180px;
  pointer-events: none;
}
.coinhub-strip-roll--lg {
  border-color: rgba(22, 24, 34, 0.98);
  box-shadow:
    inset 0 5px 32px rgba(0, 0, 0, 0.9),
    inset 0 1px 0 rgba(255, 255, 255, 0.06),
    inset 0 -4px 20px rgba(0, 0, 0, 0.58);
}
.coinhub-strip-roll__toplight {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, transparent 82%);
  opacity: 0.38;
  mix-blend-mode: screen;
  pointer-events: none;
}
.coinhub-strip-roll__depth {
  background: linear-gradient(0deg, rgba(0, 0, 0, 0.45) 0%, transparent 75%);
  pointer-events: none;
}
.coinhub-strip-roll__glow {
  background: radial-gradient(ellipse 80% 90% at 50% 50%, rgba(80, 40, 140, 0.28) 0%, transparent 70%);
  opacity: 0.9;
  mix-blend-mode: screen;
}
.coinhub-strip-roll__fog--l {
  background: linear-gradient(90deg, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0.2) 45%, transparent 100%);
  opacity: 0.9;
}
.coinhub-strip-roll__fog--r {
  background: linear-gradient(270deg, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0.2) 45%, transparent 100%);
  opacity: 0.9;
}
.coinhub-strip-roll__reel-track {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  will-change: transform;
  backface-visibility: hidden;
}
.coinhub-strip-roll__cell {
  background: linear-gradient(180deg, rgba(16, 20, 44, 0.92) 0%, rgba(5, 6, 16, 0.98) 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  filter: contrast(1.02);
  transition: transform 0.05s linear, opacity 0.05s linear;
  will-change: transform, filter, opacity;
}
.coinhub-strip-roll--lg .coinhub-strip-roll__cell {
  background: linear-gradient(180deg, rgba(20, 24, 52, 0.95) 0%, rgba(4 5 12 / 0.98) 100%);
  box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.04), inset 0 -1px 0 rgba(0, 0, 0, 0.35);
}
.coinhub-strip-roll__cell--rarity-common {
  opacity: 0.9;
  background: linear-gradient(180deg, rgba(24, 18, 48, 0.92) 0%, rgba(8, 6, 20, 0.98) 100%);
  box-shadow:
    inset 0 0 0 1px rgba(100, 80, 180, 0.22),
    0 0 10px rgba(80, 50, 160, 0.12);
}
.coinhub-strip-roll__cell--rarity-uncommon {
  box-shadow:
    inset 0 0 0 1px rgba(120, 200, 255, 0.3),
    0 0 10px rgba(120, 200, 255, 0.2);
  border-color: rgba(120, 200, 255, 0.22);
}
.coinhub-strip-roll__cell--rarity-legendary:not(.coinhub-strip-roll__cell--land) {
  animation: ch-legendary-shimmer 2.2s ease-in-out infinite;
}
@keyframes ch-legendary-shimmer {
  0%,
  100% {
    box-shadow:
      0 0 18px rgba(255, 200, 80, 0.45),
      inset 0 0 0 1px rgba(255, 200, 100, 0.15);
  }
  50% {
    box-shadow:
      0 0 28px rgba(255, 220, 120, 0.65),
      0 0 48px rgba(255, 180, 40, 0.25),
      inset 0 0 0 1px rgba(255, 220, 140, 0.22);
  }
}
.coinhub-strip-roll__cell--near-miss {
  z-index: 0;
  animation: ch-near-miss-pulse 0.75s ease-in-out infinite alternate;
}
@keyframes ch-near-miss-pulse {
  0% {
    filter: brightness(1);
  }
  100% {
    filter: brightness(1.14);
  }
}
.coinhub-strip-roll__cell--bonus {
  background: linear-gradient(180deg, rgba(30, 28, 56, 0.95) 0%, rgba(10, 12, 28, 0.98) 100%);
}
.coinhub-strip-roll__chip--bonus {
  min-width: 2.25rem;
  font-size: 1.05em;
  line-height: 1.1;
}
.coinhub-strip-roll__cell--rarity-rare {
  box-shadow:
    inset 0 0 0 1px rgba(140, 80, 255, 0.45),
    0 0 18px rgba(140, 80, 255, 0.28);
  border-color: rgba(140, 80, 255, 0.35);
}
.coinhub-strip-roll__cell--rarity-epic {
  box-shadow:
    0 0 20px rgba(255, 100, 200, 0.38),
    inset 0 0 0 1px rgba(255, 140, 200, 0.35);
  border-color: rgba(255, 100, 200, 0.35);
}
.coinhub-strip-roll__cell--rarity-legendary {
  background: linear-gradient(180deg, rgba(50, 40, 20, 0.95) 0%, rgba(30, 18, 8, 0.98) 100%);
  box-shadow:
    0 0 20px rgba(255, 200, 80, 0.5),
    inset 0 0 12px -2px rgba(255, 200, 100, 0.18);
}
.coinhub-strip-roll__cell--land {
  background: linear-gradient(180deg, rgba(45, 36, 12, 0.75) 0%, rgba(12, 10, 4, 0.95) 100%);
  box-shadow:
    0 0 20px rgba(255, 200, 80, 0.45),
    0 0 56px rgba(255, 200, 80, 0.22),
    inset 0 0 18px -4px rgba(255, 190, 60, 0.22),
    inset 0 0 0 1px rgba(255, 200, 90, 0.14);
  z-index: 1;
}
.coinhub-strip-roll__cell--win-punch {
  transform: scale(1.1) !important;
  z-index: 3;
  box-shadow:
    0 0 32px rgba(255, 200, 80, 0.85),
    inset 0 0 12px rgba(255, 255, 255, 0.2) !important;
  animation: ch-win-cell-pop 0.5s ease-out both;
}
@keyframes ch-win-cell-pop {
  0% {
    transform: scale(0.88);
  }
  55% {
    transform: scale(1.14);
  }
  100% {
    transform: scale(1.1);
  }
}
.coinhub-strip-roll__cell--land.coinhub-strip-roll__cell--lg {
  box-shadow:
    inset 0 0 22px -3px rgba(255, 190, 60, 0.22),
    inset 0 0 0 1px rgba(255, 210, 120, 0.16);
}
.coinhub-strip-roll__chip--gold {
  background: linear-gradient(180deg, #facc15 0%, #f59e0b 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 1px 0 rgba(0, 0, 0, 0.65));
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.1) inset;
  border: 1px solid rgba(255, 200, 80, 0.2);
  border-radius: 0.4rem;
}
.coinhub-strip-roll--lg .coinhub-strip-roll__chip--gold {
  filter: drop-shadow(0 1px 0 rgba(0, 0, 0, 0.6));
}
.coinhub-strip-roll__marker {
  left: 50%;
  transform: translate3d(-50%, 0, 0);
  background: linear-gradient(180deg, rgba(253, 230, 138, 0.95) 0%, rgba(245, 158, 11, 0.98) 45%, rgba(180, 83, 9, 0.95) 100%);
  transition: filter 0.08s linear;
  will-change: transform, box-shadow, filter;
}
@keyframes ch-marker-shake {
  0% {
    transform: translate3d(calc(-50% - 0.45px), 0, 0);
  }
  100% {
    transform: translate3d(calc(-50% + 0.45px), 0, 0);
  }
}
.coinhub-strip-roll__marker--live {
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.55)) drop-shadow(0 0 5px rgba(255, 210, 100, 0.45));
}
.coinhub-strip-roll__marker--anticipate {
  animation:
    ch-marker-breathe 0.4s ease-in-out infinite,
    ch-marker-shake 0.1s ease-in-out infinite alternate;
}
.coinhub-strip-roll__marker--near-win {
  animation: ch-marker-near 0.38s ease-in-out infinite alternate;
}
.coinhub-strip-roll__marker--settled-win {
  animation: ch-marker-win-snap 0.65s ease-out both;
}
@keyframes ch-marker-near {
  0% {
    filter: drop-shadow(0 0 8px rgba(255, 210, 90, 0.65));
  }
  100% {
    filter: drop-shadow(0 0 20px rgba(255, 230, 140, 0.95)) drop-shadow(0 0 32px rgba(255, 180, 50, 0.55));
  }
}
@keyframes ch-marker-win-snap {
  0% {
    filter: drop-shadow(0 0 6px rgba(255, 200, 80, 0.5));
  }
  40% {
    filter: drop-shadow(0 0 28px rgba(255, 240, 200, 0.95)) drop-shadow(0 0 48px rgba(255, 200, 60, 0.75));
  }
  100% {
    filter: drop-shadow(0 0 12px rgba(255, 210, 100, 0.75)) drop-shadow(0 0 4px rgba(0, 0, 0, 0.45));
  }
}
@keyframes ch-marker-breathe {
  0%,
  100% {
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.55)) drop-shadow(0 0 3px rgba(255, 200, 90, 0.45))
      drop-shadow(0 0 14px rgba(250, 200, 80, 0.32));
  }
  50% {
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.55)) drop-shadow(0 0 6px rgba(255, 220, 120, 0.55))
      drop-shadow(0 0 22px rgba(250, 200, 80, 0.45));
  }
}
.coinhub-strip-roll__marker-cap {
  left: 50%;
  border-radius: 2px 2px 0 0;
  background: linear-gradient(180deg, rgb(255 250 220) 0%, rgb(251 191 36) 100%);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
  transform: translate3d(-50%, -1px, 0);
  will-change: transform;
}
.coinhub-strip-roll__marker-cap--jitter {
  animation: ch-marker-cap-shake 0.1s ease-in-out infinite alternate;
}
@keyframes ch-marker-cap-shake {
  0% {
    transform: translate3d(calc(-50% - 0.45px), -1px, 0);
  }
  100% {
    transform: translate3d(calc(-50% + 0.45px), -1px, 0);
  }
}
.coinhub-strip-roll__marker-cap--live {
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.45) inset,
    0 0 16px rgba(250, 204, 21, 0.55);
}
.coinhub-strip-roll__marker-cap--near-win {
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.5) inset,
    0 0 22px rgba(255, 220, 100, 0.75);
}
.coinhub-strip-roll__marker-cap--settled-win {
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.55) inset,
    0 0 28px rgba(255, 210, 80, 0.85);
  animation: ch-marker-cap-win 0.55s ease-out both;
}
@keyframes ch-marker-cap-win {
  0% {
    transform: translate3d(-50%, -1px, 0) scale(1);
  }
  50% {
    transform: translate3d(-50%, -1px, 0) scale(1.12);
  }
  100% {
    transform: translate3d(-50%, -1px, 0) scale(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .coinhub-strip-roll__cell--rarity-legendary:not(.coinhub-strip-roll__cell--land),
  .coinhub-strip-roll__cell--near-miss {
    animation: none !important;
  }
  .coinhub-strip-roll__cell--win-punch {
    animation: none !important;
    transform: scale(1.06) !important;
  }
  .coinhub-strip-roll__marker--near-win,
  .coinhub-strip-roll__marker--settled-win,
  .coinhub-strip-roll__marker-cap--settled-win {
    animation: none !important;
  }
}
</style>
