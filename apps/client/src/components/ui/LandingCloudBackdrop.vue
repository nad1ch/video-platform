<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import cloudRoundedWideOne from '@/assets/landing/clouds/cloud-rounded-wide-1.png'
import cloudRoundedWideOneWebp from '@/assets/landing/clouds/cloud-rounded-wide-1.webp'
import cloudRoundedWideTwo from '@/assets/landing/clouds/cloud-rounded-wide-2.png'
import cloudRoundedWideTwoWebp from '@/assets/landing/clouds/cloud-rounded-wide-2.webp'
import cloudTransparentOne from '@/assets/landing/clouds/cloud-transparent-1.png'
import cloudTransparentOneWebp from '@/assets/landing/clouds/cloud-transparent-1.webp'
import cloudTransparentTwo from '@/assets/landing/clouds/cloud-transparent-2.png'
import cloudTransparentTwoWebp from '@/assets/landing/clouds/cloud-transparent-2.webp'
import cloudWideVolumetric from '@/assets/landing/clouds/cloud-wide-volumetric.png'
import cloudWideVolumetric768Webp from '@/assets/landing/clouds/cloud-wide-volumetric-768.webp'
import cloudWideVolumetricWebp from '@/assets/landing/clouds/cloud-wide-volumetric.webp'
import { landingDesignPx as px } from '@/utils/landingDesignPx'

const props = withDefaults(
  defineProps<{
    /** Full animation/blend mode for routes where the backdrop is a primary visual element. */
    active?: boolean
    variant?: 'landing' | 'app'
  }>(),
  { active: true, variant: 'landing' },
)

type CloudLayer = {
  id: string
  src: string
  webpSrc: string
  className: string
  width: number
  height: number
  priority: 'critical' | 'secondary'
  style: Readonly<Record<string, string>>
}

type StarDot = {
  id: string
  phase: number
  style: Readonly<Record<string, string>>
}

type AppStarDotRaw = readonly [xVw: number, yVh: number, size: number, alpha: number]

const cloudLayers = Object.freeze([
  Object.freeze({
    id: 'top-left-wide',
    src: cloudWideVolumetric,
    webpSrc: cloudWideVolumetricWebp,
    className: 'landing-cloud-backdrop__cloud--wide',
    width: 1024,
    height: 512,
    priority: 'secondary',
    style: Object.freeze({
      left: px(-177),
      top: px(-33),
      width: px(1584),
      height: px(792),
      opacity: '0.41',
      transform: 'scaleX(-1)',
    }),
  }),
  Object.freeze({
    id: 'top-left-transparent',
    src: cloudTransparentOne,
    webpSrc: cloudTransparentOneWebp,
    className: 'landing-cloud-backdrop__cloud--transparent',
    width: 1024,
    height: 471,
    priority: 'secondary',
    style: Object.freeze({
      left: px(260),
      top: px(-472),
      width: px(928),
      height: px(427),
      opacity: '0.8',
      transform: 'rotate(0.21deg)',
    }),
  }),
  Object.freeze({
    id: 'top-right-wide',
    src: cloudWideVolumetric,
    webpSrc: cloudWideVolumetricWebp,
    className: 'landing-cloud-backdrop__cloud--wide',
    width: 1024,
    height: 512,
    priority: 'secondary',
    style: Object.freeze({
      left: px(1747),
      top: px(-104),
      width: px(1584),
      height: px(792),
      opacity: '0.41',
    }),
  }),
  Object.freeze({
    id: 'top-right-transparent',
    src: cloudTransparentTwo,
    webpSrc: cloudTransparentTwoWebp,
    className: 'landing-cloud-backdrop__cloud--transparent',
    width: 1024,
    height: 471,
    priority: 'secondary',
    style: Object.freeze({
      left: px(2202),
      top: px(-771),
      width: px(898),
      height: px(412),
      opacity: '0.67',
      transform: 'rotate(173.32deg) scaleY(-1)',
    }),
  }),
  Object.freeze({
    id: 'upper-right-band',
    src: cloudWideVolumetric,
    webpSrc: cloudWideVolumetricWebp,
    className: 'landing-cloud-backdrop__cloud--wide',
    width: 1024,
    height: 512,
    priority: 'secondary',
    style: Object.freeze({
      left: px(1191),
      top: px(355),
      width: px(1584),
      height: px(792),
      opacity: '0.41',
      transform: 'scaleX(-1)',
    }),
  }),
  Object.freeze({
    id: 'middle-band',
    src: cloudWideVolumetric,
    webpSrc: cloudWideVolumetricWebp,
    className: 'landing-cloud-backdrop__cloud--wide',
    width: 1024,
    height: 512,
    priority: 'critical',
    style: Object.freeze({
      left: px(356),
      top: px(500),
      width: px(1584),
      height: px(792),
      opacity: '0.41',
    }),
  }),
  Object.freeze({
    id: 'lower-left-band',
    src: cloudWideVolumetric,
    webpSrc: cloudWideVolumetricWebp,
    className: 'landing-cloud-backdrop__cloud--wide',
    width: 1024,
    height: 512,
    priority: 'secondary',
    style: Object.freeze({
      left: px(-235),
      top: px(908),
      width: px(1709),
      height: px(855),
      opacity: '0.41',
      transform: 'rotate(179.76deg) scaleY(-1)',
    }),
  }),
  Object.freeze({
    id: 'lower-left-deep',
    src: cloudWideVolumetric,
    webpSrc: cloudWideVolumetricWebp,
    className: 'landing-cloud-backdrop__cloud--wide',
    width: 1024,
    height: 512,
    priority: 'secondary',
    style: Object.freeze({
      left: px(-508),
      top: px(1277),
      width: px(1709),
      height: px(855),
      opacity: '0.41',
      transform: 'rotate(173.28deg) scaleY(-1)',
    }),
  }),
  Object.freeze({
    id: 'lower-right-rounded',
    src: cloudRoundedWideOne,
    webpSrc: cloudRoundedWideOneWebp,
    className: 'landing-cloud-backdrop__cloud--rounded',
    width: 1024,
    height: 512,
    priority: 'secondary',
    style: Object.freeze({
      left: px(1500),
      top: px(929),
      width: px(1620),
      height: px(810),
      opacity: '0.27',
    }),
  }),
  Object.freeze({
    id: 'bottom-left-rounded',
    src: cloudRoundedWideTwo,
    webpSrc: cloudRoundedWideTwoWebp,
    className: 'landing-cloud-backdrop__cloud--rounded',
    width: 1024,
    height: 512,
    priority: 'secondary',
    style: Object.freeze({
      left: px(-261),
      top: px(1980),
      width: px(1774),
      height: px(887),
      opacity: '0.25',
    }),
  }),
  Object.freeze({
    id: 'bottom-right-band',
    src: cloudWideVolumetric,
    webpSrc: cloudWideVolumetricWebp,
    className: 'landing-cloud-backdrop__cloud--wide',
    width: 1024,
    height: 512,
    priority: 'secondary',
    style: Object.freeze({
      left: px(1184),
      top: px(2000),
      width: px(1584),
      height: px(792),
      opacity: '0.41',
      transform: 'scaleX(-1)',
    }),
  }),
] as readonly CloudLayer[])

function appPx(value: number): string {
  return `calc(var(--app-backdrop-u) * ${value})`
}

function appBottomAnchoredTopPx(top: number, height: number): string {
  return `max(${appPx(top)}, calc(100vh - ${appPx(height)}))`
}

const appCloudLayers = Object.freeze([
  Object.freeze({
    id: 'app-left-rounded',
    src: cloudRoundedWideOne,
    webpSrc: cloudRoundedWideOneWebp,
    className: 'landing-cloud-backdrop__cloud--app-rounded',
    width: 1024,
    height: 512,
    priority: 'critical',
    style: Object.freeze({
      left: appPx(-697),
      top: appPx(-10),
      width: appPx(1384),
      height: appPx(692),
      opacity: '0.32',
    }),
  }),
  Object.freeze({
    id: 'app-bottom-wide',
    src: cloudWideVolumetric,
    webpSrc: cloudWideVolumetricWebp,
    className: 'landing-cloud-backdrop__cloud--app-wide',
    width: 1024,
    height: 512,
    priority: 'critical',
    style: Object.freeze({
      left: appPx(133),
      top: appBottomAnchoredTopPx(536, 416),
      width: appPx(832),
      height: appPx(416),
      opacity: '0.48',
      transform: 'rotate(2.35deg)',
    }),
  }),
  Object.freeze({
    id: 'app-upper-right-wide',
    src: cloudWideVolumetric,
    webpSrc: cloudWideVolumetricWebp,
    className: 'landing-cloud-backdrop__cloud--app-wide',
    width: 1024,
    height: 512,
    priority: 'critical',
    style: Object.freeze({
      left: appPx(916),
      top: appPx(44),
      width: appPx(832),
      height: appPx(416),
      opacity: '0.48',
      transform: 'rotate(173.31deg) scaleY(-1)',
    }),
  }),
] as readonly CloudLayer[])

const visibleCloudLayers = computed(() => (props.variant === 'app' ? appCloudLayers : cloudLayers))
const isAppBackdrop = computed(() => props.variant === 'app')
const starDotsRaw = [
  [2059, 142, 5, 0.36],
  [1862, 98, 5, 0.36],
  [1658, 157, 5, 0.84],
  [1583, 118, 4, 0.36],
  [1602, 179, 5, 0.36],
  [1083, 164, 4, 0.47],
  [1235, 186, 4, 0.47],
  [1413, 177, 4, 0.88],
  [1477, 104, 4, 0.47],
  [1634, 8, 5, 0.71],
  [1215, 99, 5, 0.47],
  [1188, 625, 5, 0.36],
  [1236, 680, 5, 0.36],
  [1210, 663, 5, 0.36],
  [1437, 640, 5, 0.36],
  [620, 652, 5, 0.47],
  [291, 620, 5, 0.47],
  [353, 711, 5, 0.47],
  [399, 860, 5, 0.47],
  [238, 811, 5, 1],
  [286, 914, 5, 0.47],
  [402, 1006, 5, 1],
  [516, 889, 5, 1],
  [533, 946, 5, 0.47],
  [55, 668, 5, 0.47],
  [121, 595, 5, 1],
  [60, 883, 5, 0.47],
  [159, 947, 5, 0.47],
  [2147, 1095, 5, 0.47],
  [2116, 1192, 5, 1],
  [1603, 1100, 5, 0.47],
  [1497, 1147, 5, 0.47],
  [1404, 1118, 5, 1],
  [1489, 1187, 5, 1],
  [1953, 1011, 5, 1],
  [1350, 1692, 5, 0.47],
  [1088, 1706, 5, 1],
  [1618, 1662, 5, 1],
  [1534, 1761, 5, 1],
  [1840, 1824, 5, 0.47],
  [1896, 1734, 5, 0.47],
  [1965, 1860, 5, 1],
  [1821, 1662, 5, 0.47],
  [2325, 2000, 5, 0.47],
  [2514, 1938, 5, 0.47],
  [2495, 2064, 5, 0.47],
  [2480, 2257, 5, 0.47],
  [1952, 2111, 5, 1],
  [1794, 2122, 5, 0.47],
  [1490, 2058, 5, 0.47],
  [1445, 2151, 5, 0.47],
  [1006, 2091, 5, 0.47],
  [1276, 2127, 5, 1],
  [548, 2120, 5, 0.47],
  [445, 2220, 5, 1],
  [211, 2070, 5, 1],
  [358, 2146, 5, 0.47],
  [445, 2337, 5, 0.47],
] as const

function appStarJitter(seed: number): number {
  return (((seed * 9301 + 49297) % 233280) / 233280) * 2 - 1
}

function buildAppStarDotsRaw(): readonly AppStarDotRaw[] {
  const columns = 11
  const rows = 6
  return Object.freeze(
    Array.from({ length: columns * rows }, (_, index): AppStarDotRaw => {
      const column = index % columns
      const row = Math.floor(index / columns)
      const xJitter = appStarJitter(index * 11 + 3) * 0.34
      const yJitter = appStarJitter(index * 17 + 7) * 0.3
      const x = ((column + 0.5 + xJitter) / columns) * 100
      const y = ((row + 0.5 + yJitter) / rows) * 100
      const size = index % 3 === 0 ? 5 : 4
      const alpha = 0.34 + ((index * 19) % 28) / 100
      return [Number(x.toFixed(2)), Number(y.toFixed(2)), size, Number(alpha.toFixed(2))]
    }),
  )
}

const appStarDotsRaw = buildAppStarDotsRaw()

function starDotsFromRaw(
  raw: readonly (readonly [number, number, number, number])[],
  toPx: (value: number) => string,
  idPrefix: string,
): readonly StarDot[] {
  return Object.freeze(
    raw.map(([x, y, size, alpha], index) => {
      const duration = 2.8 + ((index * 37) % 240) / 100
      const delay = -(((index * 611) % 9200) / 1000)
      return Object.freeze({
        id: `${idPrefix}-star-${index}`,
        phase: index % 5,
        style: Object.freeze({
          left: toPx(x),
          top: toPx(y),
          width: toPx(size),
          height: toPx(size),
          borderRadius: toPx(14),
          '--star-alpha': String(alpha),
          '--star-dur': `${duration.toFixed(2)}s`,
          '--star-delay': `${delay.toFixed(2)}s`,
        } as Record<string, string>),
      })
    }),
  ) as readonly StarDot[]
}

const starDots = starDotsFromRaw(starDotsRaw, px, 'landing')
const appBackdropViewport = ref({ width: 0, height: 0 })

function syncAppBackdropViewport(): void {
  if (typeof window === 'undefined') {
    return
  }
  appBackdropViewport.value = {
    width: window.innerWidth,
    height: window.innerHeight,
  }
}

function appStarClearsClouds(xVw: number, yVh: number, size: number): boolean {
  const { width, height } = appBackdropViewport.value
  if (width <= 0 || height <= 0) {
    return true
  }

  const unit = Math.min(width / 1440, height / 748)
  const x = (width * xVw) / 100
  const y = (height * yVh) / 100
  const pad = size * unit * 0.5 + Math.max(14, unit * 34)
  const bottomCloudTop = Math.max(unit * 536, height - unit * 416)
  const cloudZones = [
    { left: unit * -697, top: unit * -10, width: unit * 1384, height: unit * 692, cx: 0.24, cy: 0.3, rx: 0.3, ry: 0.34 },
    { left: unit * -697, top: unit * -10, width: unit * 1384, height: unit * 692, cx: 0.46, cy: 0.48, rx: 0.46, ry: 0.42 },
    { left: unit * -697, top: unit * -10, width: unit * 1384, height: unit * 692, cx: 0.66, cy: 0.7, rx: 0.26, ry: 0.22 },
    { left: unit * 133, top: bottomCloudTop, width: unit * 832, height: unit * 416, cx: 0.32, cy: 0.46, rx: 0.38, ry: 0.3 },
    { left: unit * 133, top: bottomCloudTop, width: unit * 832, height: unit * 416, cx: 0.56, cy: 0.66, rx: 0.48, ry: 0.36 },
    { left: unit * 916, top: unit * 44, width: unit * 832, height: unit * 416, cx: 0.36, cy: 0.5, rx: 0.44, ry: 0.42 },
    { left: unit * 916, top: unit * 44, width: unit * 832, height: unit * 416, cx: 0.64, cy: 0.34, rx: 0.34, ry: 0.3 },
  ] as const

  return cloudZones.every((zone) => {
    const centerX = zone.left + zone.width * zone.cx
    const centerY = zone.top + zone.height * zone.cy
    const radiusX = zone.width * zone.rx + pad
    const radiusY = zone.height * zone.ry + pad
    const normalizedX = (x - centerX) / radiusX
    const normalizedY = (y - centerY) / radiusY
    return normalizedX * normalizedX + normalizedY * normalizedY > 1
  })
}

const appStarDots = computed(() =>
  Object.freeze(
    appStarDotsRaw.flatMap(([x, y, size, alpha], index) => {
      if (!appStarClearsClouds(x, y, size)) {
        return []
      }
      const duration = 2.8 + ((index * 37) % 240) / 100
      const delay = -(((index * 611) % 9200) / 1000)
      return [
        Object.freeze({
          id: `app-star-${index}`,
          phase: index % 5,
          style: Object.freeze({
            left: `${x}vw`,
            top: `${y}vh`,
            width: appPx(size),
            height: appPx(size),
            borderRadius: appPx(14),
            '--star-alpha': String(alpha),
            '--star-dur': `${duration.toFixed(2)}s`,
            '--star-delay': `${delay.toFixed(2)}s`,
          } as Record<string, string>),
        }),
      ]
    }),
  ) as readonly StarDot[],
)
const visibleStarDots = computed(() => (isAppBackdrop.value ? appStarDots.value : starDots))

const pageVisible = ref(true)
const secondaryCloudsReady = ref(false)
const loadedCloudIds = ref<ReadonlySet<string>>(new Set())
const backdropActive = computed(() => props.active && pageVisible.value)

function syncPageVisible(): void {
  pageVisible.value = typeof document === 'undefined' || document.visibilityState !== 'hidden'
}

function ensureMainCloudPreload(): void {
  if (typeof document === 'undefined') {
    return
  }
  if (document.querySelector(`link[rel="preload"][href="${cloudWideVolumetricWebp}"]`)) {
    return
  }
  const link = document.createElement('link')
  link.rel = 'preload'
  link.as = 'image'
  link.href = cloudWideVolumetricWebp
  link.type = 'image/webp'
  ;(link as HTMLLinkElement & { fetchPriority?: string }).fetchPriority = 'high'
  document.head.append(link)
}

function shouldLoadCloudLayer(layer: CloudLayer): boolean {
  return layer.priority === 'critical' || secondaryCloudsReady.value
}

ensureMainCloudPreload()

function webpSrcsetForCloudLayer(layer: CloudLayer): string {
  if (layer.id === 'middle-band') {
    return `${cloudWideVolumetric768Webp} 768w, ${cloudWideVolumetricWebp} 1024w`
  }
  return layer.webpSrc
}

function sizesForCloudLayer(layer: CloudLayer): string | undefined {
  if (layer.id === 'middle-band') {
    return '(max-width: 900px) 100vw, 824px'
  }
  return undefined
}

function isCloudLayerLoaded(id: string): boolean {
  return loadedCloudIds.value.has(id)
}

function markCloudLayerLoaded(id: string): void {
  if (loadedCloudIds.value.has(id)) {
    return
  }
  const next = new Set(loadedCloudIds.value)
  next.add(id)
  loadedCloudIds.value = next
}

onMounted(() => {
  syncPageVisible()
  syncAppBackdropViewport()
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', syncPageVisible)
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', syncAppBackdropViewport)
  }
  window.setTimeout(() => {
    secondaryCloudsReady.value = true
  }, 350)
})

onUnmounted(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', syncPageVisible)
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', syncAppBackdropViewport)
  }
})
</script>

<template>
  <div
    class="landing-cloud-backdrop"
    :class="[
      `landing-cloud-backdrop--${variant}`,
      { 'landing-cloud-backdrop--inactive': !backdropActive },
    ]"
    aria-hidden="true"
  >
    <div class="landing-cloud-backdrop__gradient" />
    <div class="landing-cloud-backdrop__stars">
      <span
        v-for="star in visibleStarDots"
        :key="star.id"
        class="landing-cloud-backdrop__star"
        :class="`landing-cloud-backdrop__star--ph${star.phase}`"
        :style="star.style"
      />
    </div>
    <picture
      v-for="layer in visibleCloudLayers"
      :key="layer.id"
      class="landing-cloud-backdrop__cloud"
      :class="[
        layer.className,
        {
          'landing-cloud-backdrop__cloud--loaded': isCloudLayerLoaded(layer.id),
          'landing-cloud-backdrop__cloud--visible': shouldLoadCloudLayer(layer),
        },
      ]"
      :style="layer.style"
    >
      <source :srcset="webpSrcsetForCloudLayer(layer)" :sizes="sizesForCloudLayer(layer)" type="image/webp" />
      <img
        :src="layer.src"
        alt=""
        :width="layer.width"
        :height="layer.height"
        :loading="layer.priority === 'critical' ? 'eager' : 'lazy'"
        :fetchpriority="layer.priority === 'critical' ? 'high' : 'low'"
        draggable="false"
        decoding="async"
        @load="markCloudLayerLoaded(layer.id)"
      />
    </picture>
    <div v-if="!isAppBackdrop" class="landing-cloud-backdrop__veil" />
  </div>
</template>

<style scoped>
.landing-cloud-backdrop {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: #0b0317;
  user-select: none;
}

.landing-cloud-backdrop--inactive {
  opacity: 0.82;
}

.landing-cloud-backdrop__gradient,
.landing-cloud-backdrop__stars,
.landing-cloud-backdrop__veil,
.landing-cloud-backdrop__cloud {
  position: absolute;
  pointer-events: none;
}

.landing-cloud-backdrop__gradient {
  inset: 0;
  background:
    radial-gradient(circle at 76% 48%, rgba(84, 56, 132, 0.38), transparent calc(var(--u) * 1180)),
    radial-gradient(circle at 60% 6%, rgba(62, 35, 103, 0.42), transparent calc(var(--u) * 620)),
    linear-gradient(119.10504159217813deg, #0b0317 0%, rgba(74, 50, 116, 0.69) 73.206%);
}

.landing-cloud-backdrop--app {
  --app-backdrop-u: min(calc(100vw / 1440), calc(100vh / 748));
  --u: var(--app-backdrop-u);
  background: #0c041b;
}

.landing-cloud-backdrop--app.landing-cloud-backdrop--inactive {
  opacity: 1;
}

.landing-cloud-backdrop--app .landing-cloud-backdrop__gradient {
  background: linear-gradient(138.02298923369693deg, rgb(12, 4, 27) 17.598%, rgba(11, 5, 23, 0.69) 73.206%);
}

.landing-cloud-backdrop__cloud {
  z-index: 2;
  image-rendering: auto;
  filter: contrast(1.03) saturate(1.02);
  opacity: 0;
  transition: opacity 0.3s ease;
}

.landing-cloud-backdrop__cloud--visible {
  opacity: 1;
}

.landing-cloud-backdrop__cloud::before {
  position: absolute;
  inset: 0;
  z-index: 0;
  content: '';
  background:
    radial-gradient(ellipse at 50% 58%, rgba(120, 80, 200, 0.24) 0%, rgba(120, 80, 200, 0.12) 34%, transparent 72%),
    radial-gradient(ellipse at 38% 42%, rgba(255, 255, 255, 0.08) 0%, transparent 52%);
  filter: blur(calc(var(--u) * 12));
  opacity: 0.4;
  transition: opacity 0.3s ease;
}

.landing-cloud-backdrop__cloud--loaded::before {
  opacity: 0.1;
}

.landing-cloud-backdrop__cloud img {
  position: relative;
  z-index: 1;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: bottom center;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.landing-cloud-backdrop__cloud--loaded img {
  opacity: 1;
}

.landing-cloud-backdrop--inactive:not(.landing-cloud-backdrop--app) .landing-cloud-backdrop__cloud {
  filter: none;
  transform: none !important;
}

.landing-cloud-backdrop__cloud--wide {
  mix-blend-mode: screen;
}

.landing-cloud-backdrop__cloud--transparent {
  mix-blend-mode: lighten;
}

.landing-cloud-backdrop__cloud--rounded {
  mix-blend-mode: screen;
}

.landing-cloud-backdrop__cloud--app-wide,
.landing-cloud-backdrop__cloud--app-rounded {
  filter: contrast(1.22) saturate(1.38) brightness(1.12) hue-rotate(8deg)
    drop-shadow(0 0 calc(var(--app-backdrop-u) * 18) rgba(93, 55, 180, 0.16));
  mix-blend-mode: normal;
}

.landing-cloud-backdrop--app .landing-cloud-backdrop__cloud::before {
  display: none;
}

.landing-cloud-backdrop--inactive .landing-cloud-backdrop__cloud--wide,
.landing-cloud-backdrop--inactive .landing-cloud-backdrop__cloud--transparent,
.landing-cloud-backdrop--inactive .landing-cloud-backdrop__cloud--rounded {
  mix-blend-mode: normal;
}

.landing-cloud-backdrop__stars {
  inset: 0;
  z-index: 1;
}

.landing-cloud-backdrop--app .landing-cloud-backdrop__stars {
  z-index: 0;
}

.landing-cloud-backdrop__star {
  --star-alpha: 0.47;
  --star-dur: 3.4s;
  --star-delay: 0s;
  position: absolute;
  background: rgba(255, 255, 255, var(--star-alpha));
  box-shadow: 0 0 calc(var(--u) * 3) rgba(255, 255, 255, 0.14);
  opacity: var(--star-alpha);
}

.landing-cloud-backdrop__star--ph1,
.landing-cloud-backdrop__star--ph3 {
  animation-duration: var(--star-dur);
  animation-delay: var(--star-delay);
  animation-fill-mode: both;
  animation-iteration-count: infinite;
  animation-name: landingCloudStarTwinkleSoft;
  animation-timing-function: ease-in-out;
}

.landing-cloud-backdrop__star--ph1 {
  animation-name: landingCloudStarTwinkleSoft;
}

.landing-cloud-backdrop__star--ph3 {
  animation-name: landingCloudStarBlink;
}

.landing-cloud-backdrop--app .landing-cloud-backdrop__star {
  animation-duration: var(--star-dur);
  animation-delay: var(--star-delay);
  animation-fill-mode: both;
  animation-iteration-count: infinite;
  animation-timing-function: ease-in-out;
}

.landing-cloud-backdrop--app .landing-cloud-backdrop__star--ph0 {
  animation-name: landingCloudStarTwinkleSoft;
}

.landing-cloud-backdrop--app .landing-cloud-backdrop__star--ph1 {
  animation-name: landingCloudStarTwinkle;
}

.landing-cloud-backdrop--app .landing-cloud-backdrop__star--ph2 {
  animation-name: landingCloudStarTwinkleBright;
}

.landing-cloud-backdrop--app .landing-cloud-backdrop__star--ph3 {
  animation-name: landingCloudStarBlink;
}

.landing-cloud-backdrop--app .landing-cloud-backdrop__star--ph4 {
  animation-name: landingCloudStarTwinkleSlow;
}

.landing-cloud-backdrop--inactive .landing-cloud-backdrop__star {
  animation: none !important;
  box-shadow: none;
  opacity: 0.28;
}

.landing-cloud-backdrop__veil {
  inset: 0;
  z-index: 3;
  background:
    linear-gradient(180deg, rgba(11, 3, 23, 0.1) 0%, transparent 22%, transparent 70%, rgba(11, 3, 23, 0.14) 100%),
    radial-gradient(circle at center, transparent 0%, rgba(11, 3, 23, 0.2) 100%);
}

@keyframes landingCloudStarTwinkle {
  0%,
  100% {
    opacity: 0.35;
  }

  40% {
    opacity: 1;
  }

  70% {
    opacity: 0.2;
  }
}

@keyframes landingCloudStarTwinkleSoft {
  0%,
  100% {
    opacity: 0.2;
  }

  48% {
    opacity: 0.74;
  }
}

@keyframes landingCloudStarTwinkleBright {
  0%,
  100% {
    opacity: 0.48;
  }

  38% {
    opacity: 1;
  }

  78% {
    opacity: 0.28;
  }
}

@keyframes landingCloudStarBlink {
  0%,
  18%,
  100% {
    opacity: 0;
  }

  42%,
  68% {
    opacity: 0.86;
  }
}

@keyframes landingCloudStarTwinkleSlow {
  0%,
  100% {
    opacity: 0.3;
  }

  55% {
    opacity: 0.82;
  }
}

@media (max-width: 900px) {
  .landing-cloud-backdrop__veil {
    background:
      linear-gradient(180deg, rgba(11, 3, 23, 0.06) 0%, transparent 26%, transparent 72%, rgba(11, 3, 23, 0.12) 100%),
      radial-gradient(circle at center, transparent 0%, rgba(11, 3, 23, 0.16) 100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .landing-cloud-backdrop__star {
    animation: none;
  }
}
</style>
