<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { useI18n } from 'vue-i18n'
import avatarBeanieBody from '@/assets/landing/video-call/avatar-beanie-body.svg'
import avatarBeanieExpression from '@/assets/landing/video-call/avatar-beanie-expression.svg'
import avatarBeanieGlasses from '@/assets/landing/video-call/avatar-beanie-glasses.svg'
import avatarBeanieHat from '@/assets/landing/video-call/avatar-beanie-hat.svg'
import avatarBeanieHead from '@/assets/landing/video-call/avatar-beanie-head.svg'
import avatarBucketBody from '@/assets/landing/video-call/avatar-bucket-body.svg'
import avatarBucketExpression from '@/assets/landing/video-call/avatar-bucket-expression.svg'
import avatarBucketHalo from '@/assets/landing/video-call/avatar-bucket-halo.svg'
import avatarBucketHat from '@/assets/landing/video-call/avatar-bucket-hat.svg'
import avatarBucketHead from '@/assets/landing/video-call/avatar-bucket-head.svg'
import avatarCap from '@/assets/landing/video-call/avatar-cap.svg'
import avatarGlassesHat from '@/assets/landing/video-call/avatar-glasses-hat.svg'
import avatarHeadbandBody from '@/assets/landing/video-call/avatar-headband-body.svg'
import avatarHeadbandExpression from '@/assets/landing/video-call/avatar-headband-expression.svg'
import avatarHeadbandHair from '@/assets/landing/video-call/avatar-headband-hair.svg'
import avatarHeadbandHalo from '@/assets/landing/video-call/avatar-headband-halo.svg'
import avatarHeadbandHead from '@/assets/landing/video-call/avatar-headband-head.svg'
import avatarHeadbandMarks from '@/assets/landing/video-call/avatar-headband-marks.svg'
import avatarHeadphones from '@/assets/landing/video-call/avatar-headphones.svg'
import avatarHost from '@/assets/landing/video-call/avatar-host.svg'
import avatarSidecapBody from '@/assets/landing/video-call/avatar-sidecap-body.svg'
import avatarSidecapExpression from '@/assets/landing/video-call/avatar-sidecap-expression.svg'
import avatarSidecapHalo from '@/assets/landing/video-call/avatar-sidecap-halo.svg'
import avatarSidecapHat from '@/assets/landing/video-call/avatar-sidecap-hat.svg'
import avatarSidecapHead from '@/assets/landing/video-call/avatar-sidecap-head.svg'

defineProps<{
  to: RouteLocationRaw
  authHint: string
}>()

const { t } = useI18n()

const previewTiles = [
  {
    id: 'host',
    tone: 'violet',
    layers: [{ src: avatarHost, className: 'app-call__avatar--host' }],
  },
  {
    id: 'headband',
    tone: 'indigo',
    layers: [
      { src: avatarHeadbandHalo, className: 'app-call__avatar--headband-halo' },
      { src: avatarHeadbandBody, className: 'app-call__avatar--headband-body' },
      { src: avatarHeadbandHead, className: 'app-call__avatar--headband-head' },
      { src: avatarHeadbandHair, className: 'app-call__avatar--headband-hair' },
      { src: avatarHeadbandExpression, className: 'app-call__avatar--headband-expression' },
      { src: avatarHeadbandMarks, className: 'app-call__avatar--headband-marks' },
    ],
  },
  {
    id: 'headphones',
    tone: 'brown',
    layers: [{ src: avatarHeadphones, className: 'app-call__avatar--headphones' }],
  },
  {
    id: 'cap',
    tone: 'olive',
    layers: [{ src: avatarCap, className: 'app-call__avatar--cap' }],
  },
  {
    id: 'bucket',
    tone: 'sand',
    layers: [
      { src: avatarBucketHalo, className: 'app-call__avatar--bucket-halo' },
      { src: avatarBucketBody, className: 'app-call__avatar--bucket-body' },
      { src: avatarBucketHead, className: 'app-call__avatar--bucket-head' },
      { src: avatarBucketHat, className: 'app-call__avatar--bucket-hat' },
      { src: avatarBucketExpression, className: 'app-call__avatar--bucket-expression' },
    ],
  },
  {
    id: 'glasses-hat',
    tone: 'pink',
    layers: [{ src: avatarGlassesHat, className: 'app-call__avatar--glasses-hat' }],
  },
  {
    id: 'beanie',
    tone: 'rose',
    layers: [
      { src: avatarBeanieBody, className: 'app-call__avatar--beanie-body' },
      { src: avatarBeanieHead, className: 'app-call__avatar--beanie-head' },
      { src: avatarBeanieHat, className: 'app-call__avatar--beanie-hat' },
      { src: avatarBeanieGlasses, className: 'app-call__avatar--beanie-glasses' },
      { src: avatarBeanieExpression, className: 'app-call__avatar--beanie-expression' },
    ],
  },
  {
    id: 'sidecap',
    tone: 'purple',
    layers: [
      { src: avatarSidecapHalo, className: 'app-call__avatar--sidecap-halo' },
      { src: avatarSidecapBody, className: 'app-call__avatar--sidecap-body' },
      { src: avatarSidecapHead, className: 'app-call__avatar--sidecap-head' },
      { src: avatarSidecapHat, className: 'app-call__avatar--sidecap-hat' },
      { src: avatarSidecapExpression, className: 'app-call__avatar--sidecap-expression' },
    ],
  },
] as const
</script>

<template>
  <section class="app-call app-call__panel" aria-labelledby="app-call-title">
    <h2 id="app-call-title" class="app-call__title">{{ t('home.sectionVideoCall') }}</h2>

    <RouterLink class="app-call__button" :to="to" :aria-label="authHint">
      <span class="app-call__button-title" aria-hidden="true">{{ t('home.sectionVideoCall') }}</span>
      <span class="app-call__screen" aria-hidden="true">
        <span
          v-for="tile in previewTiles"
          :key="tile.id"
          class="app-call__tile"
          :class="`app-call__tile--${tile.tone}`"
        >
          <img
            v-for="layer in tile.layers"
            :key="layer.className"
            class="app-call__avatar-layer"
            :class="layer.className"
            :src="layer.src"
            alt=""
            loading="lazy"
            decoding="async"
          />
        </span>
      </span>
    </RouterLink>
  </section>
</template>

<style scoped>
.app-call__panel {
  position: relative;
  display: block;
  max-width: 100%;
  aspect-ratio: 671 / 273;
  min-height: 0;
  padding: 0;
  overflow: visible;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: 1.8rem;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.035), transparent 34%),
    rgba(18, 8, 34, 0.015);
  color: #fff;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.24),
    inset 0 -1px 0 rgba(255, 255, 255, 0.08),
    0 14px 36px rgba(11, 3, 23, 0.34);
  -webkit-backdrop-filter: blur(3px);
  backdrop-filter: blur(3px);
}

.app-call__title {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.app-call__button {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border-radius: inherit;
  container-type: inline-size;
  --app-call-u: calc(100cqw / 671);
  background:
    linear-gradient(144.828deg, rgba(124, 77, 219, 0.144) 0%, rgba(60, 36, 99, 0.141) 73.206%),
    rgba(18, 8, 34, 0.14);
  color: inherit;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.24),
    inset 0 -1px 0 rgba(255, 255, 255, 0.08),
    0 14px 36px rgba(11, 3, 23, 0.34);
  text-decoration: none;
  transform-origin: center;
  transition:
    transform 0.18s ease,
    filter 0.18s ease;
}

.app-call__button:hover {
  transform: translateY(-3px);
  filter: drop-shadow(0 14px 32px rgba(6, 2, 18, 0.28));
}

.app-call__button:focus-visible {
  outline: 3px solid rgba(255, 218, 68, 0.86);
  outline-offset: 4px;
}

.app-call__button-title {
  position: absolute;
  left: 50%;
  top: 5%;
  z-index: 2;
  display: block;
  width: 100%;
  overflow: visible;
  color: #fff;
  font-family: var(--app-home-display, var(--sa-font-display, system-ui, sans-serif));
  font-size: clamp(1rem, 3.47cqw, 1.46rem);
  font-weight: 400;
  font-variation-settings: 'YEAR' 1979;
  line-height: 1.12;
  text-align: center;
  text-transform: uppercase;
  text-shadow: 0 3.884px 3.884px rgba(0, 0, 0, 0.25);
  transform: translateX(-50%);
  white-space: nowrap;
}

.app-call__screen {
  position: absolute;
  left: calc(var(--app-call-u) * 13);
  top: calc(var(--app-call-u) * 54);
  z-index: 1;
  display: block;
  width: calc(var(--app-call-u) * 641);
  height: calc(var(--app-call-u) * 206);
  overflow: hidden;
  border: var(--app-home-card-border, 5px) solid rgba(255, 255, 255, 0.96);
  border-radius: 1.8rem;
  box-sizing: border-box;
  background:
    linear-gradient(150.078deg, rgba(124, 77, 219, 0.096) 0%, rgba(60, 36, 99, 0.094) 73.206%),
    rgba(36, 17, 58, 0.2);
}

.app-call__tile {
  position: absolute;
  display: block;
  width: 22.44%;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.28);
  border-radius: 0.88rem;
  box-sizing: border-box;
}

.app-call__tile::before,
.app-call__tile::after {
  position: absolute;
  z-index: 2;
  height: calc(var(--app-call-u) * 4.86);
  border-radius: 999px;
  content: '';
}

.app-call__tile::before {
  left: 6.15%;
  bottom: 9.55%;
  width: 16.88%;
  background: #f2f4ff;
}

.app-call__tile::after {
  right: 6.95%;
  top: 7.45%;
  width: 13.9%;
  background: #6e72f8;
}

.app-call__tile:nth-child(-n + 4) {
  top: calc(var(--app-call-u) * 18);
  height: calc(var(--app-call-u) * 84.97);
}

.app-call__tile:nth-child(n + 5) {
  top: calc(var(--app-call-u) * 113.08);
  height: calc(var(--app-call-u) * 80.92);
}

.app-call__tile:nth-child(1),
.app-call__tile:nth-child(5) {
  left: calc(var(--app-call-u) * 18);
}

.app-call__tile:nth-child(2),
.app-call__tile:nth-child(6) {
  left: calc(var(--app-call-u) * 171.04);
}

.app-call__tile:nth-child(3),
.app-call__tile:nth-child(7) {
  left: calc(var(--app-call-u) * 325.1);
}

.app-call__tile:nth-child(4),
.app-call__tile:nth-child(8) {
  left: calc(var(--app-call-u) * 478.14);
}

.app-call__tile--violet {
  background: rgba(108, 36, 185, 0.66);
}

.app-call__tile--indigo {
  background: rgba(79, 26, 200, 0.75);
}

.app-call__tile--brown {
  background: #704e3a;
}

.app-call__tile--olive {
  background: rgba(143, 157, 83, 0.51);
}

.app-call__tile--sand {
  background: rgba(246, 192, 92, 0.35);
}

.app-call__tile--pink {
  background: rgba(244, 124, 255, 0.42);
}

.app-call__tile--rose {
  background: rgba(208, 90, 90, 0.46);
}

.app-call__tile--purple {
  background: rgba(139, 92, 246, 0.51);
}

.app-call__avatar-layer {
  position: absolute;
  z-index: 1;
  display: block;
  max-width: none;
  object-fit: contain;
}

.app-call__avatar--host,
.app-call__avatar--headphones,
.app-call__avatar--cap,
.app-call__avatar--glasses-hat {
  height: 113%;
}

.app-call__avatar--host {
  left: 24.82%;
  top: 2.38%;
  width: 54.61%;
}

.app-call__avatar--headphones {
  left: 24.11%;
  top: 2.38%;
  width: 56.74%;
}

.app-call__avatar--cap {
  left: 24.82%;
  top: 2.38%;
  width: 53.4%;
}

.app-call__avatar--glasses-hat {
  left: 23.4%;
  top: 2.5%;
  width: 53.2%;
}

.app-call__avatar--headband-halo,
.app-call__avatar--bucket-halo,
.app-call__avatar--sidecap-halo {
  z-index: 0;
}

.app-call__avatar--headband-halo {
  left: 22.7%;
  top: 2.38%;
  width: 54.95%;
  height: 90.44%;
}

.app-call__avatar--headband-body {
  left: 36.16%;
  top: 69.31%;
  width: 29.1%;
  height: 49.74%;
}

.app-call__avatar--headband-head {
  left: 35.09%;
  top: 26.8%;
  width: 30.17%;
  height: 50.65%;
}

.app-call__avatar--headband-hair {
  left: 34.55%;
  top: 21.37%;
  width: 33.94%;
  height: 36.18%;
}

.app-call__avatar--headband-expression {
  left: 41.8%;
  top: 49.8%;
  width: 17.3%;
  height: 19.6%;
}

.app-call__avatar--headband-marks {
  left: 39.95%;
  top: 57.9%;
  width: 20.2%;
  height: 4%;
}

.app-call__avatar--bucket-halo {
  left: 22.2%;
  top: 2.5%;
  width: 54.4%;
  height: 94%;
}

.app-call__avatar--bucket-body {
  left: 36.74%;
  top: 72.99%;
  width: 28.26%;
  height: 50.76%;
}

.app-call__avatar--bucket-head {
  left: 35.61%;
  top: 28.82%;
  width: 29.87%;
  height: 52.63%;
}

.app-call__avatar--bucket-hat {
  left: 33%;
  top: 13.78%;
  width: 35.09%;
  height: 39.48%;
}

.app-call__avatar--bucket-expression {
  left: 40.92%;
  top: 54.2%;
  width: 16%;
  height: 16.41%;
}

.app-call__avatar--beanie-body {
  left: 24.82%;
  top: 2.5%;
  width: 53.19%;
  height: 115.81%;
}

.app-call__avatar--beanie-head {
  left: 36.82%;
  top: 27.32%;
  width: 29.2%;
  height: 51.47%;
}

.app-call__avatar--beanie-hat {
  left: 36.3%;
  top: 19.96%;
  width: 30.24%;
  height: 23.9%;
}

.app-call__avatar--beanie-glasses {
  left: 39.25%;
  top: 45.39%;
  width: 24.3%;
  height: 14.4%;
}

.app-call__avatar--beanie-expression {
  left: 44.12%;
  top: 50.29%;
  width: 15.64%;
  height: 21.8%;
}

.app-call__avatar--sidecap-halo {
  left: 22.76%;
  top: 2.5%;
  width: 53.84%;
  height: 93%;
}

.app-call__avatar--sidecap-body {
  left: 34.95%;
  top: 70.41%;
  width: 31.2%;
  height: 52.09%;
}

.app-call__avatar--sidecap-head {
  left: 35.41%;
  top: 26.69%;
  width: 29.55%;
  height: 52.09%;
}

.app-call__avatar--sidecap-hat {
  left: 28.15%;
  top: 18.31%;
  width: 36.29%;
  height: 33.4%;
}

.app-call__avatar--sidecap-expression {
  left: 41.1%;
  top: 49.3%;
  width: 17%;
  height: 22%;
}

@media (max-width: 580px) {
  .app-call__button-title {
    font-size: clamp(0.92rem, 5.4vw, 1.12rem);
    line-height: 1.12;
  }

  .app-call__screen {
    border-radius: 1.25rem;
  }
}
</style>
