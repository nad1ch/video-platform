<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { NadrawDrawToolMeta, RemoteDrawPayload } from '../orchestrator/useNadrawShowOrchestrator'
import NadrawToolbar from './NadrawToolbar.vue'
import { floodFillImageData, hexToRgb } from './nadrawCanvasOps'
import { NADRAW_BRUSH_SIZES, NADRAW_TOOLBAR_COLORS, type NadrawCanvasTool } from './nadrawToolbarConstants'

const BOARD_FILL = '#f5f2eb'

const props = defineProps<{
  canDraw: boolean
  /** Streamer drawing phases: show tool controls overlay. */
  showToolbar?: boolean
}>()

const { t } = useI18n()

const emit = defineEmits<{
  drawStart: [strokeId: string, nx: number, ny: number, meta: NadrawDrawToolMeta]
  drawMove: [strokeId: string, nx: number, ny: number, meta: NadrawDrawToolMeta]
  drawEnd: [strokeId: string, nx: number, ny: number, meta: NadrawDrawToolMeta]
}>()

const wrapRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let activeStrokeId: string | null = null
let localLast: { x: number; y: number } | null = null
const remoteLast = new Map<string, { x: number; y: number }>()

const brushColor = ref<string>(NADRAW_TOOLBAR_COLORS[0])
const brushSize = ref<number>(NADRAW_BRUSH_SIZES[3])
const canvasTool = ref<NadrawCanvasTool>('pencil')

let shapeSnapshot: ImageData | null = null
let shapeStartNorm: { nx: number; ny: number } | null = null
let shapeKind: 'rect' | 'ellipse' | null = null

/** Stroke paint color when erasing (sampled at stroke start); avoids transparent holes that show white behind the canvas. */
let localEraseStrokeStyle: string | null = null
const remoteEraseStrokeStyleById = new Map<string, string>()

const boardCursor = computed(() => {
  if (!props.canDraw) {
    return ''
  }
  if (canvasTool.value === 'fill') {
    return 'cursor-cell'
  }
  return 'cursor-crosshair'
})

function toolMeta(partial?: { op?: NadrawDrawToolMeta['op']; x2?: number; y2?: number }): NadrawDrawToolMeta {
  const erase = canvasTool.value === 'erase'
  return {
    color: brushColor.value,
    lineWidth: brushSize.value,
    erase,
    op: partial?.op,
    x2: partial?.x2,
    y2: partial?.y2,
  }
}

function rgbaCssFromBytes(r: number, g: number, b: number, a: number): string {
  return `rgba(${r},${g},${b},${a / 255})`
}

function boardFillRgbaCss(): string {
  const rgb = hexToRgb(BOARD_FILL)
  return rgb ? rgbaCssFromBytes(rgb.r, rgb.g, rgb.b, rgb.a) : 'rgba(245,242,235,1)'
}

/** Sample top-left pixel of canvas in device space (CSS coords × dpr). */
function sampleStrokeStyleAtCss(cssX: number, cssY: number): string {
  const canvas = canvasRef.value
  if (!canvas || !ctx) {
    return boardFillRgbaCss()
  }
  const dpr = window.devicePixelRatio || 1
  const deviceX = Math.min(canvas.width - 1, Math.max(0, Math.floor(cssX * dpr)))
  const deviceY = Math.min(canvas.height - 1, Math.max(0, Math.floor(cssY * dpr)))
  const id = ctx.getImageData(deviceX, deviceY, 1, 1)
  const tr = id.data[0]!
  const tg = id.data[1]!
  const tb = id.data[2]!
  const ta = id.data[3]!
  if (ta === 0) {
    return boardFillRgbaCss()
  }
  return rgbaCssFromBytes(tr, tg, tb, ta)
}

function applyLocalStrokeStyle(m: NadrawDrawToolMeta): void {
  if (!ctx) {
    return
  }
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (m.erase) {
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = localEraseStrokeStyle ?? boardFillRgbaCss()
  } else {
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = m.color
  }
  ctx.lineWidth = m.lineWidth
}

function resetComposite(): void {
  if (!ctx) {
    return
  }
  ctx.globalCompositeOperation = 'source-over'
}

function canvasCssPixelSize(): { w: number; h: number } | null {
  const canvas = canvasRef.value
  if (!canvas) {
    return null
  }
  const r = canvas.getBoundingClientRect()
  const w = r.width
  const h = r.height
  if (w < 1 || h < 1) {
    return null
  }
  return { w, h }
}

function resizeCanvas(): void {
  const canvas = canvasRef.value
  if (!canvas || !wrapRef.value) {
    return
  }
  const dpr = window.devicePixelRatio || 1
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  const r2 = canvas.getBoundingClientRect()
  const w = r2.width
  const h = r2.height
  if (w < 1 || h < 1) {
    return
  }
  canvas.width = Math.max(1, Math.round(w * dpr))
  canvas.height = Math.max(1, Math.round(h * dpr))
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  ctx = canvas.getContext('2d')
  if (!ctx) {
    return
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = BOARD_FILL
  ctx.fillRect(0, 0, w, h)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.globalCompositeOperation = 'source-over'
  remoteLast.clear()
  localLast = null
  shapeSnapshot = null
  shapeStartNorm = null
  shapeKind = null
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

function normFromEvent(ev: PointerEvent): { nx: number; ny: number } | null {
  const canvas = canvasRef.value
  if (!canvas) {
    return null
  }
  const r = canvas.getBoundingClientRect()
  if (r.width < 1 || r.height < 1) {
    return null
  }
  return {
    nx: clamp01((ev.clientX - r.left) / r.width),
    ny: clamp01((ev.clientY - r.top) / r.height),
  }
}

function randomStrokeId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `s-${Date.now()}-${Math.random().toString(16).slice(2)}`
  }
}

function saveShapeSnapshot(): void {
  const canvas = canvasRef.value
  if (!canvas || !ctx) {
    return
  }
  shapeSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height)
}

function restoreShapeSnapshot(): void {
  if (shapeSnapshot && ctx) {
    ctx.putImageData(shapeSnapshot, 0, 0)
  }
}

function clearShapeGesture(): void {
  shapeSnapshot = null
  shapeStartNorm = null
  shapeKind = null
}

/**
 * Bucket fill at normalized click (0–1): only contiguous pixels matching the seed color
 * (same as `sampleStrokeStyleAtCss`), so existing strokes stay visible as boundaries.
 */
function floodFillAtNormalized(nx: number, ny: number, colorHex: string): void {
  const canvas = canvasRef.value
  if (!canvas || !ctx) {
    return
  }
  const size = canvasCssPixelSize()
  if (!size) {
    return
  }
  const rgb = hexToRgb(colorHex)
  if (!rgb) {
    return
  }
  const dpr = window.devicePixelRatio || 1
  const cssX = nx * size.w
  const cssY = ny * size.h
  const seedX = Math.min(canvas.width - 1, Math.max(0, Math.floor(cssX * dpr)))
  const seedY = Math.min(canvas.height - 1, Math.max(0, Math.floor(cssY * dpr)))
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  floodFillImageData(imageData.data, canvas.width, canvas.height, seedX, seedY, rgb.r, rgb.g, rgb.b, rgb.a)
  ctx.putImageData(imageData, 0, 0)
}

function strokeShapePreview(
  kind: 'rect' | 'ellipse',
  n0: { nx: number; ny: number },
  n1: { nx: number; ny: number },
): void {
  const size = canvasCssPixelSize()
  if (!ctx || !size) {
    return
  }
  restoreShapeSnapshot()
  const x0 = n0.nx * size.w
  const y0 = n0.ny * size.h
  const x1 = n1.nx * size.w
  const y1 = n1.ny * size.h
  const minX = Math.min(x0, x1)
  const minY = Math.min(y0, y1)
  const rw = Math.max(Math.abs(x1 - x0), 1)
  const rh = Math.max(Math.abs(y1 - y0), 1)
  ctx.save()
  ctx.setLineDash([5, 4])
  ctx.globalCompositeOperation = 'source-over'
  ctx.strokeStyle = brushColor.value
  ctx.lineWidth = brushSize.value
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (kind === 'rect') {
    ctx.strokeRect(minX, minY, rw, rh)
  } else {
    const cx = (x0 + x1) / 2
    const cy = (y0 + y1) / 2
    const rx = Math.max(rw / 2, 0.5)
    const ry = Math.max(rh / 2, 0.5)
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

function strokeShapeFinal(
  kind: 'rect' | 'ellipse',
  n0: { nx: number; ny: number },
  n1: { nx: number; ny: number },
): void {
  const size = canvasCssPixelSize()
  if (!ctx || !size) {
    return
  }
  restoreShapeSnapshot()
  const x0 = n0.nx * size.w
  const y0 = n0.ny * size.h
  const x1 = n1.nx * size.w
  const y1 = n1.ny * size.h
  const minX = Math.min(x0, x1)
  const minY = Math.min(y0, y1)
  const rw = Math.max(Math.abs(x1 - x0), 1)
  const rh = Math.max(Math.abs(y1 - y0), 1)
  ctx.save()
  ctx.setLineDash([])
  ctx.globalCompositeOperation = 'source-over'
  ctx.strokeStyle = brushColor.value
  ctx.lineWidth = brushSize.value
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (kind === 'rect') {
    ctx.strokeRect(minX, minY, rw, rh)
  } else {
    const cx = (x0 + x1) / 2
    const cy = (y0 + y1) / 2
    const rx = Math.max(rw / 2, 0.5)
    const ry = Math.max(rh / 2, 0.5)
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
  shapeSnapshot = null
}

function onPointerDown(ev: PointerEvent): void {
  const canvas = canvasRef.value
  if (!props.canDraw || !canvas || !ctx) {
    return
  }
  const size = canvasCssPixelSize()
  if (!size) {
    return
  }
  const n = normFromEvent(ev)
  if (!n) {
    return
  }

  if (canvasTool.value === 'fill') {
    canvas.setPointerCapture(ev.pointerId)
    floodFillAtNormalized(n.nx, n.ny, brushColor.value)
    emit('drawEnd', randomStrokeId(), n.nx, n.ny, toolMeta({ op: 'fill' }))
    try {
      canvas.releasePointerCapture(ev.pointerId)
    } catch {
      /* ignore */
    }
    return
  }

  if (canvasTool.value === 'rect' || canvasTool.value === 'ellipse') {
    canvas.setPointerCapture(ev.pointerId)
    saveShapeSnapshot()
    shapeStartNorm = { nx: n.nx, ny: n.ny }
    shapeKind = canvasTool.value
    activeStrokeId = randomStrokeId()
    return
  }

  canvas.setPointerCapture(ev.pointerId)
  activeStrokeId = randomStrokeId()
  const meta = toolMeta()
  if (meta.erase) {
    localEraseStrokeStyle = sampleStrokeStyleAtCss(n.nx * size.w, n.ny * size.h)
  } else {
    localEraseStrokeStyle = null
  }
  applyLocalStrokeStyle(meta)
  localLast = { x: n.nx * size.w, y: n.ny * size.h }
  emit('drawStart', activeStrokeId, n.nx, n.ny, meta)
}

function onPointerMove(ev: PointerEvent): void {
  if (!props.canDraw || !ctx) {
    return
  }
  const size = canvasCssPixelSize()
  if (!size) {
    return
  }
  const n = normFromEvent(ev)
  if (!n) {
    return
  }

  if (shapeStartNorm && shapeKind) {
    strokeShapePreview(shapeKind, shapeStartNorm, n)
    return
  }

  if (!activeStrokeId) {
    return
  }

  const x = n.nx * size.w
  const y = n.ny * size.h
  const meta = toolMeta()
  applyLocalStrokeStyle(meta)
  if (localLast) {
    ctx.beginPath()
    ctx.moveTo(localLast.x, localLast.y)
    ctx.lineTo(x, y)
    ctx.stroke()
  }
  localLast = { x, y }
  emit('drawMove', activeStrokeId, n.nx, n.ny, meta)
}

function onPointerUp(ev: PointerEvent): void {
  const canvas = canvasRef.value
  if (!props.canDraw || !canvas) {
    activeStrokeId = null
    localEraseStrokeStyle = null
    clearShapeGesture()
    resetComposite()
    return
  }
  try {
    canvas.releasePointerCapture(ev.pointerId)
  } catch {
    /* ignore */
  }

  const size = canvasCssPixelSize()
  const n = normFromEvent(ev)

  if (shapeStartNorm && shapeKind && n && activeStrokeId) {
    const startNx = shapeStartNorm.nx
    const startNy = shapeStartNorm.ny
    const kind = shapeKind
    const sid = activeStrokeId
    strokeShapeFinal(kind, shapeStartNorm, n)
    emit('drawEnd', sid, startNx, startNy, toolMeta({ op: kind, x2: n.nx, y2: n.ny }))
    shapeStartNorm = null
    shapeKind = null
    activeStrokeId = null
    resetComposite()
    return
  }

  if (!activeStrokeId || !ctx || !size || !n || !localLast) {
    activeStrokeId = null
    localLast = null
    localEraseStrokeStyle = null
    clearShapeGesture()
    resetComposite()
    return
  }

  const x = n.nx * size.w
  const y = n.ny * size.h
  const meta = toolMeta()
  applyLocalStrokeStyle(meta)
  ctx.beginPath()
  ctx.moveTo(localLast.x, localLast.y)
  ctx.lineTo(x, y)
  ctx.stroke()
  emit('drawEnd', activeStrokeId, n.nx, n.ny, meta)
  activeStrokeId = null
  localLast = null
  localEraseStrokeStyle = null
  resetComposite()
}

function clearBoard(): void {
  resizeCanvas()
}

function prepRemoteStroke(col: string, lw: number, erase: boolean, eraseStrokeStyle?: string): void {
  if (!ctx) {
    return
  }
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (erase) {
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = eraseStrokeStyle ?? boardFillRgbaCss()
  } else {
    ctx.globalCompositeOperation = 'source-over'
    ctx.strokeStyle = col
  }
  ctx.lineWidth = lw
}

function applyRemote(p: RemoteDrawPayload): void {
  const canvas = canvasRef.value
  if (!canvas || !ctx) {
    return
  }
  const size = canvasCssPixelSize()
  if (!size) {
    return
  }
  const w = size.w
  const h = size.h
  const op = p.op ?? 'stroke'

  if (op === 'fill' && p.phase === 'end' && !p.erase) {
    const col = typeof p.color === 'string' ? p.color : '#000000'
    floodFillAtNormalized(p.x, p.y, col)
    resetComposite()
    return
  }

  if (
    (op === 'rect' || op === 'ellipse') &&
    p.phase === 'end' &&
    typeof p.x2 === 'number' &&
    typeof p.y2 === 'number' &&
    !p.erase
  ) {
    const lw = typeof p.lineWidth === 'number' ? p.lineWidth : 3
    const col = typeof p.color === 'string' ? p.color : '#111827'
    const n0 = { nx: p.x, ny: p.y }
    const n1 = { nx: p.x2, ny: p.y2 }
    const x0 = n0.nx * w
    const y0 = n0.ny * h
    const x1 = n1.nx * w
    const y1 = n1.ny * h
    const minX = Math.min(x0, x1)
    const minY = Math.min(y0, y1)
    const rw = Math.max(Math.abs(x1 - x0), 1)
    const rh = Math.max(Math.abs(y1 - y0), 1)
    prepRemoteStroke(col, lw, false)
    ctx.setLineDash([])
    if (op === 'rect') {
      ctx.strokeRect(minX, minY, rw, rh)
    } else {
      const cx = (x0 + x1) / 2
      const cy = (y0 + y1) / 2
      const rx = Math.max(rw / 2, 0.5)
      const ry = Math.max(rh / 2, 0.5)
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    resetComposite()
    return
  }

  const x = p.x * w
  const y = p.y * h
  const lw = typeof p.lineWidth === 'number' ? p.lineWidth : 3
  const col = typeof p.color === 'string' ? p.color : '#111827'
  const erase = p.erase === true

  if (p.phase === 'start') {
    if (erase) {
      remoteEraseStrokeStyleById.set(p.strokeId, sampleStrokeStyleAtCss(x, y))
    } else {
      remoteEraseStrokeStyleById.delete(p.strokeId)
    }
    prepRemoteStroke(col, lw, erase, remoteEraseStrokeStyleById.get(p.strokeId))
    remoteLast.set(p.strokeId, { x, y })
    resetComposite()
    return
  }
  const last = remoteLast.get(p.strokeId)
  if (last) {
    prepRemoteStroke(col, lw, erase, remoteEraseStrokeStyleById.get(p.strokeId))
    ctx.beginPath()
    ctx.moveTo(last.x, last.y)
    ctx.lineTo(x, y)
    ctx.stroke()
  }
  remoteLast.set(p.strokeId, { x, y })
  if (p.phase === 'end') {
    remoteLast.delete(p.strokeId)
    remoteEraseStrokeStyleById.delete(p.strokeId)
  }
  resetComposite()
}

defineExpose({ clearBoard, applyRemote })

let ro: ResizeObserver | null = null

onMounted(() => {
  resizeCanvas()
  ro = new ResizeObserver(() => {
    resizeCanvas()
  })
  if (wrapRef.value) {
    ro.observe(wrapRef.value)
  }
  window.addEventListener('resize', resizeCanvas)
})

onUnmounted(() => {
  ro?.disconnect()
  ro = null
  window.removeEventListener('resize', resizeCanvas)
})

watch(
  () => props.canDraw,
  (v) => {
    if (!v) {
      activeStrokeId = null
      localLast = null
      localEraseStrokeStyle = null
      clearShapeGesture()
      resetComposite()
    }
  },
)
</script>

<template>
  <div
    ref="wrapRef"
    class="nadraw-board-wrap absolute inset-0 flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-[#f5f2eb] via-[#efe8dd] to-[#e5ddd0] shadow-lg shadow-black/25 ring-1 ring-black/5 dark:border-white/10 dark:from-slate-800 dark:via-slate-800 dark:to-slate-900 dark:shadow-black/50 dark:ring-white/5"
    :class="boardCursor"
  >
    <NadrawToolbar
      v-if="showToolbar && canDraw"
      class="relative z-30 mx-2 mt-1.5 shrink-0 sm:mx-3 sm:mt-2"
      :visible="true"
      :color="brushColor"
      :brush-size="brushSize"
      :tool="canvasTool"
      @update:color="brushColor = $event"
      @update:brush-size="brushSize = $event"
      @update:tool="canvasTool = $event"
    />
    <div
      v-if="$slots.hud"
      class="relative z-20 mx-2 mt-0.5 flex shrink-0 flex-col items-stretch gap-0 sm:mx-3 sm:mt-1"
    >
      <slot name="hud" />
    </div>
    <canvas
      ref="canvasRef"
      class="z-0 min-h-0 w-full flex-1 touch-none"
      :class="showToolbar && canDraw ? 'mt-0.5 sm:mt-1' : $slots.hud ? 'mt-0.5' : ''"
      :aria-label="t('nadrawShow.canvasTitle')"
      @pointerdown.prevent="onPointerDown"
      @pointermove.prevent="onPointerMove"
      @pointerup.prevent="onPointerUp"
      @pointercancel.prevent="onPointerUp"
    />
  </div>
</template>

<style scoped>
.nadraw-board-wrap::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: inherit;
  pointer-events: none;
  opacity: 0.045;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
}
</style>
