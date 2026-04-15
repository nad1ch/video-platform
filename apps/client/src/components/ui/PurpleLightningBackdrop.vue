<template>
  <div
    class="purple-lightning-backdrop"
    :class="{ 'purple-lightning-backdrop--light': light }"
    aria-hidden="true"
  >
    <svg
      class="purple-lightning-backdrop__svg"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="purple-lightning-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="rgba(252, 248, 255, 0.98)" />
          <stop offset="32%" stop-color="rgba(216, 189, 255, 0.95)" />
          <stop offset="68%" stop-color="rgba(147, 112, 219, 0.88)" />
          <stop offset="100%" stop-color="rgba(91, 33, 182, 0.5)" />
        </linearGradient>
      </defs>

      <g v-for="(bolt, i) in bolts" :key="`lb-${i}-v${bolt.variantId}`" :transform="boltTransform(bolt)">
        <g
          class="purple-lightning-backdrop__bolt"
          :style="{
            '--bolt-dur': `${bolt.dur}s`,
            '--bolt-delay': `${bolt.delay}s`,
          }"
        >
          <path
            class="purple-lightning-backdrop__path purple-lightning-backdrop__path--main"
            :d="bolt.main"
            pathLength="1"
            fill="none"
            stroke="url(#purple-lightning-grad)"
            :stroke-width="bolt.swMain"
            stroke-linecap="round"
            stroke-linejoin="round"
            vector-effect="non-scaling-stroke"
          />
          <path
            class="purple-lightning-backdrop__path purple-lightning-backdrop__path--main-core"
            :d="bolt.main"
            pathLength="1"
            fill="none"
            stroke="rgba(255, 255, 255, 0.62)"
            :stroke-width="bolt.swCore"
            stroke-linecap="round"
            stroke-linejoin="round"
            vector-effect="non-scaling-stroke"
          />
          <path
            v-for="(br, j) in bolt.branches"
            :key="j"
            class="purple-lightning-backdrop__path purple-lightning-backdrop__path--branch"
            :style="{ '--branch-lag': `${bolt.branchLagBase + j * 0.052}s` }"
            :d="br"
            pathLength="1"
            fill="none"
            stroke="url(#purple-lightning-grad)"
            :stroke-width="bolt.swBranch"
            stroke-linecap="round"
            stroke-linejoin="round"
            vector-effect="non-scaling-stroke"
          />
          <path
            v-for="(br, j) in bolt.branches"
            :key="'c' + j"
            class="purple-lightning-backdrop__path purple-lightning-backdrop__path--branch-core"
            :style="{ '--branch-lag': `${bolt.branchLagBase + j * 0.052}s` }"
            :d="br"
            pathLength="1"
            fill="none"
            stroke="rgba(255, 255, 255, 0.42)"
            :stroke-width="bolt.swCore * 0.85"
            stroke-linecap="round"
            stroke-linejoin="round"
            vector-effect="non-scaling-stroke"
          />
        </g>
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  light?: boolean
}>()

/**
 * 10 різних форм у одному стилі: #0 — як раніше (оригінальний перший fork), інші — нові, але той самий «язик» zigzag + гілки.
 */
const FORK_VARIANTS = [
  {
    main: 'M50 34 L48.2 42 L52 42 L47.5 52 L50.2 52 L46 64 L49 64 L44.5 76',
    branches: [
      'M47.5 52 L42 57 L40 60.5',
      'M52 42 L56.5 46.5 L58 51',
      'M50.2 52 L54.5 59 L52.5 64',
    ],
  },
  {
    main: 'M49 31 L51 39 L47.5 39 L50.5 49 L48 49 L51 61 L47.5 61 L50 75',
    branches: ['M50.5 49 L55 54 L54 58', 'M47.5 39 L43.5 43.5 L42 47', 'M48 49 L44.5 55 L45.5 59'],
  },
  {
    main: 'M51 33 L48.5 41 L52 41 L47 50 L50.5 50 L45.5 62 L49 62 L44 78',
    branches: ['M47 50 L41.5 54.5 L40 58', 'M52 41 L56.5 46 L58 50', 'M50.5 50 L55 57 L53 61'],
  },
  {
    main: 'M50 36 L49.5 44 L51.8 44 L48.5 54 L50.2 54 L47 66 L50 66 L46.5 80',
    branches: ['M48.5 54 L43 59 L41.5 63', 'M51.8 44 L56.2 49 L57.5 53', 'M50.2 54 L54.5 61 L52.5 65'],
  },
  {
    main: 'M49 35 L50.5 43 L47 43 L52 52 L49.3 52 L53.5 64 L50.3 64 L55 77',
    branches: ['M52 52 L57 57 L58.5 61', 'M47 43 L42.5 47.5 L41 51', 'M49.3 52 L45.5 58 L47 62'],
  },
  {
    main: 'M51 34 L47.8 42 L51.2 42 L46.5 51 L49.8 51 L44.8 63 L48.2 63 L43.2 76',
    branches: ['M46.5 51 L40.8 55.5 L39.2 59', 'M51.2 42 L56.2 47 L57.8 51', 'M49.8 51 L54.5 58 L52.8 62'],
  },
  {
    main: 'M50 32 L48 40 L51.5 40 L46.8 49 L50 49 L45.5 61 L48.5 61 L43.5 74',
    branches: ['M46.8 49 L41.2 53.5 L39.5 57', 'M51.5 40 L56 45 L57.5 49', 'M50 49 L54.5 56 L52.8 60'],
  },
  {
    main: 'M49 37 L51.2 45 L47.8 45 L52 54 L49 54 L54.2 66 L50.8 66 L56 79',
    branches: ['M52 54 L57.5 59 L59 63', 'M47.8 45 L43.5 49.5 L42 53', 'M49 54 L45 60 L46.5 64'],
  },
  {
    main: 'M51 35 L48.5 43 L51.8 43 L47.2 52 L50.5 52 L46 64 L49.5 64 L45 77',
    branches: ['M47.2 52 L41.5 56.5 L40 60', 'M51.8 43 L56.5 48 L58 52', 'M50.5 52 L55 59 L53 63'],
  },
  {
    main: 'M50 33 L49 41 L52.2 41 L48 50 L51 50 L47.5 62 L50 62 L46 76',
    branches: ['M48 50 L42.5 54.5 L41 58', 'M52.2 41 L57 46 L58.5 50', 'M51 50 L55.5 57 L53.5 61'],
  },
] as const

/** Геометричний центр блискавки в локальних координатах path (~середина стовбура) */
const BOLT_ANCHOR_X = 50
const BOLT_ANCHOR_Y = 56

type Bolt = {
  main: string
  branches: readonly string[]
  /** Центр блискавки в координатах viewBox 0–100 */
  cx: number
  cy: number
  rot: number
  sc: number
  swMain: number
  swBranch: number
  swCore: number
  dur: number
  delay: number
  branchLagBase: number
  /** 0..9 — індекс форми з FORK_VARIANTS */
  variantId: number
}

/** Детермінований RNG (стабільно між рендерами; «рандом» без накладань через сітку) */
function createRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

function shuffleInPlace(arr: number[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const t = arr[i]!
    arr[i] = arr[j]!
    arr[j] = t
  }
}

/**
 * Сітка 9×4 = 36 комірок: рівномірне покриття, одна блискавка на комірку → не перетинаються.
 * Порядок комірок і варіантів форм перемішані — хаотично, але без «пустих кутів».
 * Масштаб: базовий × множник 0.8…1.1 (природна варіація).
 */
function buildBolts(): Bolt[] {
  const COLS = 9
  const ROWS = 4
  const CELLS = COLS * ROWS
  const MARGIN = 4
  const areaW = 100 - 2 * MARGIN
  const areaH = 100 - 2 * MARGIN
  const cellW = areaW / COLS
  const cellH = areaH / ROWS

  const rngPos = createRng(0xc0dec001)
  const rngAnim = createRng(0x71ee5e02)

  const cellOrder = Array.from({ length: CELLS }, (_, i) => i)
  shuffleInPlace(cellOrder, rngPos)

  const variantPool: number[] = []
  for (let i = 0; i < 4; i++) {
    for (let v = 0; v < 10; v++) {
      variantPool.push(v)
    }
  }
  shuffleInPlace(variantPool, rngAnim)
  const variantForBolt = variantPool.slice(0, CELLS)

  const out: Bolt[] = []
  for (let k = 0; k < CELLS; k++) {
    const cell = cellOrder[k]!
    const col = cell % COLS
    const row = Math.floor(cell / COLS)
    const cellMidX = MARGIN + col * cellW + cellW * 0.5
    const cellMidY = MARGIN + row * cellH + cellH * 0.5
    const jitterMaxX = cellW * 0.18
    const jitterMaxY = cellH * 0.2
    const jx = (rngPos() - 0.5) * 2 * jitterMaxX
    const jy = (rngPos() - 0.5) * 2 * jitterMaxY
    const cx = clamp(cellMidX + jx, 6.5, 93.5)
    const cy = clamp(cellMidY + jy, 7.5, 92.5)

    const variantId = variantForBolt[k]!
    const shape = FORK_VARIANTS[variantId]!

    const rot = clamp(rngAnim() * 124 - 62, -56, 56)
    const scaleMul = 0.8 + rngAnim() * 0.3
    const baseSc = 0.3 + rngAnim() * 0.08
    const sc = baseSc * scaleMul

    const dur = 2.35 + rngAnim() * 3.15
    const delay = rngAnim() * 14.5
    const branchLagBase = 0.038 + rngAnim() * 0.055

    out.push({
      main: shape.main,
      branches: shape.branches,
      cx,
      cy,
      rot,
      sc,
      swMain: 1.38 + rngAnim() * 0.34,
      swBranch: 1.08 + rngAnim() * 0.3,
      swCore: 0.44 + rngAnim() * 0.16,
      dur,
      delay,
      branchLagBase,
      variantId,
    })
  }
  return out
}

const bolts = buildBolts()

/**
 * Язик накреслений навколо (50,56). Правильний порядок: перенести язик у нуль → scale → rotate → поставити в (cx,cy).
 * Старий варіант translate(cx-50,…) rotate(…,50,56) scale(s) давав масштаб від (0,0) і зміщував усе вліво/обрізав справа.
 */
function boltTransform(b: Bolt): string {
  return `translate(${b.cx} ${b.cy}) rotate(${b.rot}) scale(${b.sc}) translate(-${BOLT_ANCHOR_X} -${BOLT_ANCHOR_Y})`
}
</script>

<style scoped>
.purple-lightning-backdrop {
  position: absolute;
  inset: 0;
  /* hidden + drop-shadow на <g> обрізає праву частину SVG у Chrome — «усі зліва» */
  overflow: visible;
  pointer-events: none;
  z-index: 0;
}

.purple-lightning-backdrop__svg {
  width: 100%;
  height: 100%;
  display: block;
  opacity: 0.96;
}

/* Стовбур: спочатку «прокреслюється», потім м’яко згасає */
.purple-lightning-backdrop__path--main,
.purple-lightning-backdrop__path--main-core {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  opacity: 0;
  animation: purple-bolt-draw var(--bolt-dur, 3.4s) cubic-bezier(0.33, 0.02, 0.25, 1) infinite;
  animation-delay: var(--bolt-delay, 0s);
}

.purple-lightning-backdrop__path--main-core {
  animation-name: purple-bolt-draw-core;
}

/* Відгалуження — з невеликим запізненням, ніби розряд «біжить» у боки */
.purple-lightning-backdrop__path--branch,
.purple-lightning-backdrop__path--branch-core {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  opacity: 0;
  animation: purple-bolt-draw-branch var(--bolt-dur, 3.4s) cubic-bezier(0.33, 0.02, 0.28, 1) infinite;
  animation-delay: calc(var(--bolt-delay, 0s) + var(--branch-lag, 0.08s));
}

.purple-lightning-backdrop__path--branch-core {
  animation-name: purple-bolt-draw-branch-core;
}

@keyframes purple-bolt-draw {
  0%,
  5% {
    stroke-dashoffset: 1;
    opacity: 0;
  }
  12% {
    opacity: 0.62;
  }
  22% {
    stroke-dashoffset: 0;
    opacity: 0.94;
  }
  38% {
    opacity: 0.78;
  }
  55% {
    opacity: 0.44;
  }
  72%,
  100% {
    stroke-dashoffset: 0;
    opacity: 0;
  }
}

@keyframes purple-bolt-draw-core {
  0%,
  5% {
    stroke-dashoffset: 1;
    opacity: 0;
  }
  14% {
    opacity: 0.58;
  }
  24% {
    stroke-dashoffset: 0;
    opacity: 0.82;
  }
  45% {
    opacity: 0.42;
  }
  68%,
  100% {
    stroke-dashoffset: 0;
    opacity: 0;
  }
}

@keyframes purple-bolt-draw-branch {
  0%,
  8% {
    stroke-dashoffset: 1;
    opacity: 0;
  }
  18% {
    opacity: 0.5;
  }
  30% {
    stroke-dashoffset: 0;
    opacity: 0.8;
  }
  48% {
    opacity: 0.54;
  }
  68%,
  100% {
    stroke-dashoffset: 0;
    opacity: 0;
  }
}

@keyframes purple-bolt-draw-branch-core {
  0%,
  10% {
    stroke-dashoffset: 1;
    opacity: 0;
  }
  22% {
    opacity: 0.4;
  }
  32% {
    stroke-dashoffset: 0;
    opacity: 0.62;
  }
  55% {
    opacity: 0.28;
  }
  72%,
  100% {
    stroke-dashoffset: 0;
    opacity: 0;
  }
}

.purple-lightning-backdrop--light .purple-lightning-backdrop__svg {
  opacity: 0.64;
}

@media (prefers-reduced-motion: reduce) {
  .purple-lightning-backdrop__path--main,
  .purple-lightning-backdrop__path--main-core,
  .purple-lightning-backdrop__path--branch,
  .purple-lightning-backdrop__path--branch-core {
    animation: none !important;
    opacity: 0 !important;
    stroke-dashoffset: 1 !important;
  }
}
</style>
