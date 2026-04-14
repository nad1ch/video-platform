<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  open: { type: Boolean, default: false },
  /** join | controlHost | controlPlayer | overlay */
  tourKey: { type: String, default: '' },
})

const emit = defineEmits(['update:open', 'complete', 'dismiss-save'])

const { t, tm } = useI18n()

const ONBOARDING_EXPAND = 'eat-first-onboarding-expand'
const PAD = 10
const CARD_W = 360
const GAP = 14

const stepIndex = ref(0)
const saveDismiss = ref(true)

const hole = ref({
  active: false,
  top: 0,
  left: 0,
  width: 0,
  height: 0,
})

const cardStyle = ref({
  top: '50%',
  left: '50%',
  width: 'min(22.5rem, calc(100vw - 2rem))',
  transform: 'translate(-50%, -50%)',
})

const arrowClass = ref('')

const tourTitle = computed(() => {
  const k = props.tourKey
  if (!k) return ''
  return t(`onboarding.tours.${k}.title`)
})

const steps = computed(() => {
  const k = props.tourKey
  if (!k) return []
  const raw = tm(`onboarding.tours.${k}.steps`)
  if (!Array.isArray(raw)) return []
  return raw.map((item, i) => {
    if (item && typeof item === 'object') {
      return {
        title: String(item.title ?? ''),
        text: String(item.text ?? ''),
        target: item.target != null && String(item.target).trim() ? String(item.target).trim() : '',
        expandHost:
          item.expandHost != null && String(item.expandHost).trim()
            ? String(item.expandHost).trim()
            : '',
        key: `${k}-${i}`,
      }
    }
    return { title: '', text: '', target: '', expandHost: '', key: `${k}-${i}` }
  })
})

const total = computed(() => steps.value.length)
const currentStep = computed(() => steps.value[stepIndex.value] ?? null)
const isLast = computed(() => total.value > 0 && stepIndex.value >= total.value - 1)

let raf = 0
let scrollDoneTimer = null

function scrollPref() {
  if (typeof matchMedia === 'undefined') return 'smooth'
  return matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
}

function queryTargetEl(sel) {
  if (!sel || typeof document === 'undefined') return null
  return document.querySelector(`[data-onb="${CSS.escape(sel)}"]`)
}

function layoutCardNearHole() {
  const h = hole.value
  const vw = typeof window !== 'undefined' ? window.innerWidth : 800
  const vh = typeof window !== 'undefined' ? window.innerHeight : 600
  const w = Math.min(CARD_W, vw - 32)

  if (!h.active) {
    arrowClass.value = ''
    cardStyle.value = {
      top: '50%',
      left: '50%',
      width: `${w}px`,
      maxWidth: 'min(22.5rem, calc(100vw - 2rem))',
      transform: 'translate(-50%, -50%)',
    }
    return
  }

  const hb = h.top + h.height
  const estCardH = 280
  let top = hb + GAP
  let place = 'below'
  if (top + estCardH > vh - 12) {
    top = h.top - GAP - estCardH
    place = 'above'
  }
  if (top < 12) top = 12

  let left = h.left + h.width / 2 - w / 2
  left = Math.min(Math.max(14, left), vw - w - 14)

  arrowClass.value = place === 'below' ? 'coach-card--arrow-up' : 'coach-card--arrow-down'

  cardStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
    width: `${w}px`,
    maxWidth: 'min(22.5rem, calc(100vw - 2rem))',
    transform: 'none',
  }
}

function measureAndPlace() {
  if (typeof window === 'undefined') return
  const step = currentStep.value
  if (!props.open || !step) return

  if (!step.target) {
    hole.value = { active: false, top: 0, left: 0, width: 0, height: 0 }
    layoutCardNearHole()
    return
  }

  const el = queryTargetEl(step.target)
  if (!el) {
    hole.value = { active: false, top: 0, left: 0, width: 0, height: 0 }
    layoutCardNearHole()
    return
  }

  try {
    el.scrollIntoView({ block: 'center', behavior: scrollPref() })
  } catch {
    el.scrollIntoView()
  }

  const applyRect = () => {
    const r = el.getBoundingClientRect()
    hole.value = {
      active: true,
      top: r.top - PAD,
      left: r.left - PAD,
      width: r.width + PAD * 2,
      height: r.height + PAD * 2,
    }
    layoutCardNearHole()
  }

  if (scrollDoneTimer) clearTimeout(scrollDoneTimer)
  scrollDoneTimer = setTimeout(applyRect, scrollPref() === 'smooth' ? 380 : 0)
  requestAnimationFrame(applyRect)
}

function scheduleMeasure() {
  if (raf) cancelAnimationFrame(raf)
  raf = requestAnimationFrame(() => {
    raf = 0
    measureAndPlace()
  })
}

function dispatchExpandHost() {
  if (typeof window === 'undefined' || !props.open) return
  const ex = currentStep.value?.expandHost
  if (!ex) return
  window.dispatchEvent(
    new CustomEvent(ONBOARDING_EXPAND, {
      detail: { hostBlock: ex },
    }),
  )
}

watch(
  () => props.open,
  (v) => {
    if (v) {
      stepIndex.value = 0
      saveDismiss.value = true
      nextTick(() => {
        dispatchExpandHost()
        scheduleMeasure()
      })
    } else {
      hole.value = { active: false, top: 0, left: 0, width: 0, height: 0 }
    }
  },
)

watch(
  () => props.tourKey,
  () => {
    stepIndex.value = 0
    nextTick(scheduleMeasure)
  },
)

watch([stepIndex, () => props.tourKey, () => props.open], () => {
  if (!props.open) return
  nextTick(() => {
    dispatchExpandHost()
    scheduleMeasure()
  })
})

function onWinResizeScroll() {
  if (props.open) scheduleMeasure()
}

onMounted(() => {
  window.addEventListener('resize', onWinResizeScroll)
  window.addEventListener('scroll', onWinResizeScroll, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWinResizeScroll)
  window.removeEventListener('scroll', onWinResizeScroll, true)
  if (scrollDoneTimer) clearTimeout(scrollDoneTimer)
  if (raf) cancelAnimationFrame(raf)
})

function close() {
  emit('complete', { saveDismiss: saveDismiss.value })
  if (saveDismiss.value) emit('dismiss-save')
  emit('update:open', false)
}

function finish() {
  close()
}

function next() {
  if (isLast.value) {
    finish()
    return
  }
  stepIndex.value = Math.min(stepIndex.value + 1, Math.max(0, total.value - 1))
}

function back() {
  stepIndex.value = Math.max(0, stepIndex.value - 1)
}

const scrimTop = computed(() => {
  const h = hole.value
  if (!h.active) return { display: 'none' }
  return { top: 0, left: 0, right: 0, height: `${Math.max(0, h.top)}px` }
})
const scrimLeft = computed(() => {
  const h = hole.value
  if (!h.active) return { display: 'none' }
  return { top: `${h.top}px`, left: 0, width: `${Math.max(0, h.left)}px`, height: `${h.height}px` }
})
const scrimRight = computed(() => {
  const h = hole.value
  if (!h.active) return { display: 'none' }
  const vw = typeof window !== 'undefined' ? window.innerWidth : 0
  return {
    top: `${h.top}px`,
    left: `${h.left + h.width}px`,
    right: 0,
    height: `${h.height}px`,
  }
})
const scrimBottom = computed(() => {
  const h = hole.value
  if (!h.active) return { display: 'none' }
  const vh = typeof window !== 'undefined' ? window.innerHeight : 0
  return {
    top: `${h.top + h.height}px`,
    left: 0,
    right: 0,
    bottom: 0,
  }
})

const ringStyle = computed(() => {
  const h = hole.value
  if (!h.active) return { display: 'none' }
  return {
    top: `${h.top}px`,
    left: `${h.left}px`,
    width: `${h.width}px`,
    height: `${h.height}px`,
  }
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open && tourKey && total > 0" class="coach" role="presentation" @keydown.escape.prevent="close">
      <div class="coach__scrim-coach" aria-hidden="true">
        <template v-if="hole.active">
          <div class="coach__band" :style="scrimTop" />
          <div class="coach__band" :style="scrimLeft" />
          <div class="coach__band" :style="scrimRight" />
          <div class="coach__band" :style="scrimBottom" />
        </template>
        <div v-else class="coach__scrim-full" />

        <div class="coach__ring" :style="ringStyle" aria-hidden="true" />

        <div
          class="coach-card"
          :class="arrowClass"
          role="dialog"
          aria-modal="true"
          :aria-label="tourTitle"
          :style="cardStyle"
          @click.stop
        >
          <div class="coach-card__chrome">
            <span class="coach-card__brand">{{ tourTitle }}</span>
            <button type="button" class="coach-card__x" :aria-label="t('onboarding.close')" @click="close">
              ×
            </button>
          </div>
          <p class="coach-card__progress">{{ t('onboarding.progress', { n: stepIndex + 1, total }) }}</p>
          <div v-if="currentStep" class="coach-card__body">
            <h3 class="coach-card__step-title">{{ currentStep.title }}</h3>
            <p class="coach-card__step-text">{{ currentStep.text }}</p>
          </div>
          <div class="coach-card__dots" aria-hidden="true">
            <span
              v-for="(_, i) in total"
              :key="i"
              class="coach-card__dot"
              :class="{ 'coach-card__dot--on': i === stepIndex }"
            />
          </div>
          <label class="coach-card__remember">
            <input v-model="saveDismiss" type="checkbox" />
            <span>{{ t('onboarding.dontShowAgain') }}</span>
          </label>
          <div class="coach-card__actions">
            <button type="button" class="coach-card__btn coach-card__btn--ghost" @click="close">
              {{ t('onboarding.close') }}
            </button>
            <div class="coach-card__nav">
              <button
                type="button"
                class="coach-card__btn coach-card__btn--ghost"
                :disabled="stepIndex <= 0"
                @click="back"
              >
                {{ t('onboarding.back') }}
              </button>
              <button type="button" class="coach-card__btn coach-card__btn--primary" @click="next">
                {{ isLast ? t('onboarding.done') : t('onboarding.next') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.coach {
  position: fixed;
  inset: 0;
  z-index: 11970;
  pointer-events: none;
}

.coach__scrim-coach {
  position: fixed;
  inset: 0;
  pointer-events: auto;
}

.coach__band {
  position: fixed;
  background: rgba(6, 8, 18, 0.72);
  pointer-events: auto;
  backdrop-filter: blur(2px);
}

.coach__scrim-full {
  position: fixed;
  inset: 0;
  background: rgba(6, 8, 18, 0.72);
  pointer-events: auto;
  backdrop-filter: blur(2px);
}

.coach__ring {
  position: fixed;
  pointer-events: none;
  border-radius: 14px;
  border: 2px solid rgba(192, 160, 255, 0.95);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.35),
    0 0 28px rgba(139, 92, 246, 0.45),
    inset 0 0 0 1px rgba(255, 255, 255, 0.12);
  z-index: 1;
  transition:
    top 0.32s cubic-bezier(0.22, 0.9, 0.36, 1),
    left 0.32s cubic-bezier(0.22, 0.9, 0.36, 1),
    width 0.32s cubic-bezier(0.22, 0.9, 0.36, 1),
    height 0.32s cubic-bezier(0.22, 0.9, 0.36, 1),
    opacity 0.2s ease;
}

.coach-card {
  position: fixed;
  z-index: 2;
  box-sizing: border-box;
  padding: 1rem 1.05rem 0.85rem;
  border-radius: 16px;
  background: linear-gradient(155deg, var(--bg-dropdown, rgba(28, 24, 40, 0.98)), var(--bg-card-solid, #1a1528));
  border: 1px solid rgba(167, 139, 250, 0.35);
  box-shadow:
    0 24px 64px rgba(0, 0, 0, 0.55),
    0 0 0 1px rgba(255, 255, 255, 0.06) inset;
  pointer-events: auto;
  transition:
    top 0.35s cubic-bezier(0.22, 0.9, 0.36, 1),
    left 0.35s cubic-bezier(0.22, 0.9, 0.36, 1),
    transform 0.35s cubic-bezier(0.22, 0.9, 0.36, 1),
    opacity 0.22s ease;
}

.coach-card--arrow-up::before {
  content: '';
  position: absolute;
  left: 50%;
  top: -8px;
  margin-left: -8px;
  border: 8px solid transparent;
  border-bottom-color: rgba(167, 139, 250, 0.45);
  filter: drop-shadow(0 -1px 0 rgba(0, 0, 0, 0.2));
}

.coach-card--arrow-down::before {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -8px;
  margin-left: -8px;
  border: 8px solid transparent;
  border-top-color: rgba(167, 139, 250, 0.45);
  filter: drop-shadow(0 1px 0 rgba(0, 0, 0, 0.2));
}

.coach-card__chrome {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}

.coach-card__brand {
  font-size: 0.58rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-cyan-strong, #7dd3fc);
}

.coach-card__x {
  flex-shrink: 0;
  width: 1.75rem;
  height: 1.75rem;
  margin: -0.35rem -0.4rem 0 0;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: var(--bg-muted-strong);
  color: var(--text-muted);
  font-size: 1.2rem;
  line-height: 1;
  cursor: pointer;
}

.coach-card__x:hover {
  color: var(--text-heading);
}

.coach-card__progress {
  margin: 0 0 0.55rem;
  font-size: 0.85rem;
  font-weight: 800;
  color: var(--text-heading);
}

.coach-card__body {
  margin-bottom: 0.65rem;
}

.coach-card__step-title {
  margin: 0 0 0.35rem;
  font-size: 0.78rem;
  font-weight: 800;
  color: var(--text-heading);
  line-height: 1.35;
}

.coach-card__step-text {
  margin: 0;
  font-size: 0.72rem;
  line-height: 1.5;
  color: var(--text-muted);
  white-space: pre-line;
}

.coach-card__dots {
  display: flex;
  gap: 5px;
  margin: 0 0 0.6rem;
}

.coach-card__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--bg-muted-strong);
  opacity: 0.45;
}

.coach-card__dot--on {
  opacity: 1;
  background: linear-gradient(135deg, #a78bfa, #6366f1);
  box-shadow: 0 0 10px rgba(129, 140, 248, 0.65);
}

.coach-card__remember {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  margin: 0 0 0.75rem;
  font-size: 0.62rem;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  line-height: 1.4;
}

.coach-card__remember input {
  margin-top: 0.1rem;
  flex-shrink: 0;
}

.coach-card__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.45rem;
}

.coach-card__nav {
  display: flex;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.coach-card__btn {
  padding: 0.38rem 0.65rem;
  border-radius: 10px;
  font-size: 0.66rem;
  font-weight: 700;
  cursor: pointer;
  border: 1px solid var(--border-input);
  background: var(--bg-card-soft);
  color: var(--text-body);
}

.coach-card__btn--primary {
  border-color: rgba(168, 85, 247, 0.45);
  background: linear-gradient(165deg, var(--btn-neon-top, #6d28d9), var(--btn-neon-bot, #4c1d95));
  color: var(--text-title, #faf5ff);
}

.coach-card__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
