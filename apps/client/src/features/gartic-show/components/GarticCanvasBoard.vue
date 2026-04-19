<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import type { GarticDrawToolMeta, RemoteDrawPayload } from '../orchestrator/useGarticShowOrchestrator'
import GarticToolbar from './GarticToolbar.vue'
import { GARTIC_BRUSH_SIZES, GARTIC_TOOLBAR_COLORS } from './garticToolbarConstants'

const BOARD_FILL = '#f5f2eb'

const props = defineProps<{
  canDraw: boolean
  /** Streamer drawing phases: show tool controls overlay. */
  showToolbar?: boolean
}>()

const emit = defineEmits<{
  drawStart: [strokeId: string, nx: number, ny: number, meta: GarticDrawToolMeta]
  drawMove: [strokeId: string, nx: number, ny: number, meta: GarticDrawToolMeta]
  drawEnd: [strokeId: string, nx: number, ny: number, meta: GarticDrawToolMeta]
}>()

const wrapRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
let ctx: CanvasRenderingContext2D | null = null
let activeStrokeId: string | null = null
let localLast: { x: number; y: number } | null = null
const remoteLast = new Map<string, { x: number; y: number }>()

const brushColor = ref<string>(GARTIC_TOOLBAR_COLORS[0])
const brushSize = ref<number>(GARTIC_BRUSH_SIZES[2])
const toolMode = ref<'draw' | 'erase'>('draw')

function toolMeta(): GarticDrawToolMeta {
  return {
    color: brushColor.value,
    lineWidth: brushSize.value,
    erase: toolMode.value === 'erase',
  }
}

function applyLocalStrokeStyle(m: GarticDrawToolMeta): void {
  if (!ctx) {
    return
  }
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (m.erase) {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.strokeStyle = 'rgba(0,0,0,1)'
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
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

/** Normalized 0–1 relative to the visible canvas element (matches backing-store CSS space after ctx scale). */
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

function onPointerDown(ev: PointerEvent): void {
  const canvas = canvasRef.value
  if (!props.canDraw || !canvas || !ctx) {
    return
  }
  const size = canvasCssPixelSize()
  if (!size) {
    return
  }
  canvas.setPointerCapture(ev.pointerId)
  const n = normFromEvent(ev)
  if (!n) {
    return
  }
  activeStrokeId = randomStrokeId()
  const meta = toolMeta()
  applyLocalStrokeStyle(meta)
  localLast = { x: n.nx * size.w, y: n.ny * size.h }
  emit('drawStart', activeStrokeId, n.nx, n.ny, meta)
}

function onPointerMove(ev: PointerEvent): void {
  if (!props.canDraw || !activeStrokeId || !ctx) {
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
  if (!props.canDraw || !activeStrokeId || !canvas) {
    activeStrokeId = null
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
  if (n && ctx && size && localLast) {
    const x = n.nx * size.w
    const y = n.ny * size.h
    const meta = toolMeta()
    applyLocalStrokeStyle(meta)
    ctx.beginPath()
    ctx.moveTo(localLast.x, localLast.y)
    ctx.lineTo(x, y)
    ctx.stroke()
    emit('drawEnd', activeStrokeId, n.nx, n.ny, meta)
  }
  activeStrokeId = null
  localLast = null
  resetComposite()
}

function clearBoard(): void {
  resizeCanvas()
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
  const x = p.x * w
  const y = p.y * h
  const lw = typeof p.lineWidth === 'number' ? p.lineWidth : 3
  const col = typeof p.color === 'string' ? p.color : '#111827'
  const erase = p.erase === true

  function prepStroke(): void {
    if (!ctx) {
      return
    }
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (erase) {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = 'rgba(0,0,0,1)'
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = col
    }
    ctx.lineWidth = lw
  }

  if (p.phase === 'start') {
    prepStroke()
    remoteLast.set(p.strokeId, { x, y })
    resetComposite()
    return
  }
  const last = remoteLast.get(p.strokeId)
  if (last) {
    prepStroke()
    ctx.beginPath()
    ctx.moveTo(last.x, last.y)
    ctx.lineTo(x, y)
    ctx.stroke()
  }
  remoteLast.set(p.strokeId, { x, y })
  if (p.phase === 'end') {
    remoteLast.delete(p.strokeId)
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
      resetComposite()
    }
  },
)
</script>

<template>
  <div
    ref="wrapRef"
    class="gartic-board-wrap absolute inset-0 h-full min-h-0 w-full overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-[#f5f2eb] via-[#efe8dd] to-[#e5ddd0] shadow-lg shadow-black/25 ring-1 ring-black/5 dark:border-white/10 dark:from-slate-800 dark:via-slate-800 dark:to-slate-900 dark:shadow-black/50 dark:ring-white/5"
    :class="{ 'cursor-crosshair': canDraw }"
  >
    <GarticToolbar
      v-if="showToolbar && canDraw"
      class="absolute left-1/2 top-3 z-30 flex -translate-x-1/2"
      :visible="true"
      :color="brushColor"
      :brush-size="brushSize"
      :mode="toolMode"
      @update:color="brushColor = $event"
      @update:brush-size="brushSize = $event"
      @update:mode="toolMode = $event"
    />
    <canvas
      ref="canvasRef"
      class="z-0 block touch-none"
      :class="
        showToolbar && canDraw
          ? 'absolute bottom-0 left-0 right-0 top-14 h-auto min-h-0 w-full'
          : 'absolute inset-0 h-full min-h-0 w-full'
      "
      aria-label="Drawing board"
      @pointerdown.prevent="onPointerDown"
      @pointermove.prevent="onPointerMove"
      @pointerup.prevent="onPointerUp"
      @pointercancel.prevent="onPointerUp"
    />
  </div>
</template>

<style scoped>
.gartic-board-wrap::before {
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
