<script setup lang="ts">
import cloudRoundedWideOne from '@/assets/landing/clouds/cloud-rounded-wide-1.png'
import cloudRoundedWideTwo from '@/assets/landing/clouds/cloud-rounded-wide-2.png'
import cloudTransparentOne from '@/assets/landing/clouds/cloud-transparent-1.png'
import cloudTransparentTwo from '@/assets/landing/clouds/cloud-transparent-2.png'
import cloudWideVolumetric from '@/assets/landing/clouds/cloud-wide-volumetric.png'

type CloudLayer = {
  id: string
  src: string
  className: string
  style: Readonly<Record<string, string>>
}

const cloudLayers = Object.freeze([
  Object.freeze({
    id: 'top-left-wide',
    src: cloudWideVolumetric,
    className: 'landing-cloud-backdrop__cloud--wide',
    style: Object.freeze({
      left: '-8rem',
      top: '-4.5rem',
      width: 'clamp(34rem, 48vw, 58rem)',
      opacity: '0.52',
    }),
  }),
  Object.freeze({
    id: 'top-right-transparent',
    src: cloudTransparentTwo,
    className: 'landing-cloud-backdrop__cloud--transparent',
    style: Object.freeze({
      right: '-10rem',
      top: '-3rem',
      width: 'clamp(34rem, 48vw, 58rem)',
      opacity: '0.44',
    }),
  }),
  Object.freeze({
    id: 'mid-band',
    src: cloudWideVolumetric,
    className: 'landing-cloud-backdrop__cloud--wide',
    style: Object.freeze({
      left: '8vw',
      top: '24%',
      width: 'clamp(36rem, 50vw, 60rem)',
      opacity: '0.26',
    }),
  }),
  Object.freeze({
    id: 'right-band',
    src: cloudRoundedWideOne,
    className: 'landing-cloud-backdrop__cloud--rounded',
    style: Object.freeze({
      right: '-7rem',
      top: '32%',
      width: 'clamp(32rem, 44vw, 54rem)',
      opacity: '0.36',
    }),
  }),
  Object.freeze({
    id: 'lower-left',
    src: cloudTransparentOne,
    className: 'landing-cloud-backdrop__cloud--transparent',
    style: Object.freeze({
      left: '-12rem',
      bottom: '-9rem',
      width: 'clamp(38rem, 52vw, 62rem)',
      opacity: '0.38',
    }),
  }),
  Object.freeze({
    id: 'lower-right',
    src: cloudRoundedWideTwo,
    className: 'landing-cloud-backdrop__cloud--rounded',
    style: Object.freeze({
      right: '-12rem',
      bottom: '-8rem',
      width: 'clamp(38rem, 52vw, 62rem)',
      opacity: '0.42',
    }),
  }),
] as readonly CloudLayer[])
</script>

<template>
  <div class="landing-cloud-backdrop" aria-hidden="true">
    <div class="landing-cloud-backdrop__gradient" />
    <img
      v-for="layer in cloudLayers"
      :key="layer.id"
      class="landing-cloud-backdrop__cloud"
      :class="layer.className"
      :src="layer.src"
      alt=""
      draggable="false"
      decoding="async"
      :style="layer.style"
    />
    <div class="landing-cloud-backdrop__stars" />
    <div class="landing-cloud-backdrop__veil" />
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
    radial-gradient(circle at 69% 4%, rgba(255, 153, 92, 0.12), transparent 24rem),
    radial-gradient(circle at 78% 62%, rgba(121, 69, 184, 0.52), transparent 42rem),
    radial-gradient(circle at 30% 49%, rgba(70, 35, 116, 0.42), transparent 36rem),
    linear-gradient(120deg, #0b0317 0%, rgba(74, 50, 116, 0.76) 100%);
}

.landing-cloud-backdrop__cloud {
  z-index: 1;
  height: auto;
  object-fit: contain;
  object-position: center;
  image-rendering: auto;
  filter: contrast(1.12) saturate(1.08);
  transform: translateZ(0);
  will-change: transform;
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

.landing-cloud-backdrop__stars {
  inset: 0;
  z-index: 2;
  opacity: 0.72;
  background-image:
    radial-gradient(circle at 3.5% 15%, rgba(255, 255, 255, 0.42) 0 1px, transparent 1.8px),
    radial-gradient(circle at 8.5% 72%, rgba(255, 255, 255, 0.22) 0 1px, transparent 1.8px),
    radial-gradient(circle at 18% 28%, rgba(255, 255, 255, 0.28) 0 1.2px, transparent 2px),
    radial-gradient(circle at 24% 66%, rgba(255, 255, 255, 0.2) 0 1px, transparent 1.7px),
    radial-gradient(circle at 38% 42%, rgba(255, 255, 255, 0.18) 0 1px, transparent 1.8px),
    radial-gradient(circle at 52% 82%, rgba(255, 255, 255, 0.24) 0 1.2px, transparent 2px),
    radial-gradient(circle at 64% 18%, rgba(255, 255, 255, 0.3) 0 1px, transparent 1.8px),
    radial-gradient(circle at 78% 45%, rgba(255, 255, 255, 0.2) 0 1px, transparent 1.8px),
    radial-gradient(circle at 88% 76%, rgba(255, 255, 255, 0.24) 0 1px, transparent 1.8px),
    radial-gradient(circle at 94% 22%, rgba(255, 255, 255, 0.3) 0 1px, transparent 1.8px);
}

.landing-cloud-backdrop__veil {
  inset: 0;
  z-index: 3;
  background:
    linear-gradient(180deg, rgba(11, 3, 23, 0.1) 0%, transparent 22%, transparent 70%, rgba(11, 3, 23, 0.14) 100%),
    radial-gradient(circle at center, transparent 0%, rgba(11, 3, 23, 0.2) 100%);
}

@media (max-width: 900px) {
  .landing-cloud-backdrop__cloud {
    width: min(78rem, 96vw) !important;
  }
}
</style>
