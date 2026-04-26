<script setup lang="ts">
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { useI18n } from 'vue-i18n'

withDefaults(
  defineProps<{
    to: RouteLocationRaw
    ariaLabel?: string
  }>(),
  {
    ariaLabel: '',
  },
)

const { t } = useI18n()
const slotLetters = Object.freeze(['T', 'W', 'I', 'T', 'C', 'H'] as const)
</script>

<template>
  <RouterLink class="economy-slot-banner" :to="to" :aria-label="ariaLabel || t('app.openCoinHub')">
    <span class="economy-slot-banner__frame">
      <span class="economy-slot-banner__title">{{ t('landing.economyCta') }}</span>

      <span class="economy-slot-banner__slot" aria-hidden="true">
        <span class="economy-slot-banner__jackpot">JACKPOT</span>

        <span class="economy-slot-banner__cells">
          <span v-for="letter in slotLetters" :key="letter" class="economy-slot-banner__cell">{{ letter }}</span>
        </span>

        <span class="economy-slot-banner__underbar economy-slot-banner__underbar--left" />
        <span class="economy-slot-banner__underbar economy-slot-banner__underbar--right" />
        <span class="economy-slot-banner__slot-bar" />
        <span class="economy-slot-banner__sparkle economy-slot-banner__sparkle--1" />
        <span class="economy-slot-banner__sparkle economy-slot-banner__sparkle--2" />
        <span class="economy-slot-banner__sparkle economy-slot-banner__sparkle--3" />
        <span class="economy-slot-banner__sparkle economy-slot-banner__sparkle--4" />
        <span class="economy-slot-banner__sparkle economy-slot-banner__sparkle--5" />
        <span class="economy-slot-banner__sparkle economy-slot-banner__sparkle--6" />
        <span class="economy-slot-banner__sparkle economy-slot-banner__sparkle--7" />
        <span class="economy-slot-banner__handle">
          <span class="economy-slot-banner__handle-stick" />
        </span>
      </span>
    </span>
  </RouterLink>
</template>

<style scoped>
.economy-slot-banner {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 1129.22 / 154.5;
  color: inherit;
  container-type: inline-size;
  cursor: pointer;
  text-decoration: none;
}

.economy-slot-banner__frame {
  --economy-slot-u: calc(100cqw / 1129.22);
  position: absolute;
  inset: 0;
  display: block;
  overflow: hidden;
  border: var(--app-home-card-border, 5px) solid #fff;
  border-radius: calc(var(--economy-slot-u) * 41.25);
  box-sizing: border-box;
  background: linear-gradient(166.6115811995453deg, rgba(124, 77, 219, 0.096) 0%, rgba(60, 36, 99, 0.094) 73.206%);
  transform-origin: center;
  transition: transform 0.18s ease;
}

.economy-slot-banner:hover .economy-slot-banner__frame {
  transform: translateY(-2px);
}

.economy-slot-banner:focus-visible {
  outline: 3px solid rgba(255, 218, 68, 0.86);
  outline-offset: calc(var(--economy-slot-u, 1px) * 8);
}

@media (prefers-reduced-motion: reduce) {
  .economy-slot-banner__frame {
    transition: none;
  }

  .economy-slot-banner:hover .economy-slot-banner__frame {
    transform: none;
  }
}

.economy-slot-banner__title {
  position: absolute;
  left: calc(var(--economy-slot-u) * 42.5);
  top: calc(var(--economy-slot-u) * 36.5);
  width: calc(var(--economy-slot-u) * 402);
  height: calc(var(--economy-slot-u) * 61);
  margin: 0;
  color: #fff;
  font-family: 'Climate Crisis', var(--sa-font-display);
  font-size: calc(var(--economy-slot-u) * 36);
  font-variation-settings: 'YEAR' 1979;
  font-weight: 400;
  letter-spacing: 0;
  line-height: calc(var(--economy-slot-u) * 58.5);
  text-align: left;
  text-rendering: geometricPrecision;
  text-transform: none;
  white-space: nowrap;
}

.economy-slot-banner__slot {
  position: absolute;
  left: calc(var(--economy-slot-u) * 654);
  top: calc(var(--economy-slot-u) * 9);
  display: block;
  width: calc(var(--economy-slot-u) * 429.19);
  height: calc(var(--economy-slot-u) * 97.03);
}

.economy-slot-banner__jackpot {
  position: absolute;
  left: calc(var(--economy-slot-u) * 122.34);
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: calc(var(--economy-slot-u) * 142.031);
  height: calc(var(--economy-slot-u) * 35.156);
  border: calc(var(--economy-slot-u) * 3.75) solid #7c4ddb;
  border-radius: calc(var(--economy-slot-u) * 18);
  box-sizing: border-box;
  background: rgba(255, 59, 48, 0.52);
  color: #fff;
  font-family: 'Arbutus', serif;
  font-size: calc(var(--economy-slot-u) * 19.5);
  line-height: 1;
  letter-spacing: 0.04em;
}

.economy-slot-banner__cells {
  position: absolute;
  left: 0;
  top: calc(var(--economy-slot-u) * 22.87);
  z-index: 0;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  overflow: hidden;
  width: calc(var(--economy-slot-u) * 391.5);
  height: calc(var(--economy-slot-u) * 70.5);
  border: calc(var(--economy-slot-u) * 4.5) solid #66388f;
  border-radius: calc(var(--economy-slot-u) * 18);
  box-sizing: border-box;
  background: #c9d6ff;
}

.economy-slot-banner__cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-right: calc(var(--economy-slot-u) * 0.75) solid #b3c2f5;
  background: #f7f8ff;
  color: rgba(87, 38, 130, 0.77);
  font-family: 'Arbutus', serif;
  font-size: calc(var(--economy-slot-u) * 40.5);
  line-height: 1;
}

.economy-slot-banner__cell:last-child {
  border-right: 0;
}

.economy-slot-banner__underbar {
  position: absolute;
  top: calc(var(--economy-slot-u) * 112.5);
  width: calc(var(--economy-slot-u) * 33);
  height: calc(var(--economy-slot-u) * 6);
  border-radius: calc(var(--economy-slot-u) * 3);
  background: rgba(255, 59, 48, 0.51);
}

.economy-slot-banner__underbar--left {
  left: calc(var(--economy-slot-u) * 87.19);
}

.economy-slot-banner__underbar--right {
  left: calc(var(--economy-slot-u) * 277.69);
}

.economy-slot-banner__slot-bar {
  position: absolute;
  left: calc(var(--economy-slot-u) * 143.25);
  top: calc(var(--economy-slot-u) * 85.12);
  width: calc(var(--economy-slot-u) * 105);
  height: calc(var(--economy-slot-u) * 21);
  border: calc(var(--economy-slot-u) * 2.25) solid #fff;
  border-radius: calc(var(--economy-slot-u) * 10.5);
  box-sizing: border-box;
  background: rgba(60, 36, 99, 0.62);
}

.economy-slot-banner__sparkle {
  position: absolute;
  width: calc(var(--economy-slot-u) * 2.249);
  height: calc(var(--economy-slot-u) * 2.249);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.62);
  transform: rotate(-5deg);
}

.economy-slot-banner__sparkle--1 {
  left: calc(var(--economy-slot-u) * 128.14);
  top: calc(var(--economy-slot-u) * -16.87);
}

.economy-slot-banner__sparkle--2 {
  left: calc(var(--economy-slot-u) * 157.68);
  top: calc(var(--economy-slot-u) * 2.38);
  opacity: 0.56;
}

.economy-slot-banner__sparkle--3 {
  left: calc(var(--economy-slot-u) * 187.25);
  top: calc(var(--economy-slot-u) * 75.51);
  opacity: 0.5;
}

.economy-slot-banner__sparkle--4 {
  left: calc(var(--economy-slot-u) * 216.79);
  top: calc(var(--economy-slot-u) * 94.76);
}

.economy-slot-banner__sparkle--5 {
  left: calc(var(--economy-slot-u) * 246.33);
  top: calc(var(--economy-slot-u) * 113.94);
  width: calc(var(--economy-slot-u) * 3.001);
  height: calc(var(--economy-slot-u) * 3.001);
}

.economy-slot-banner__sparkle--6 {
  left: calc(var(--economy-slot-u) * 350.11);
  top: calc(var(--economy-slot-u) * 26.62);
  opacity: 0.56;
}

.economy-slot-banner__sparkle--7 {
  left: calc(var(--economy-slot-u) * 379.65);
  top: calc(var(--economy-slot-u) * 45.87);
}

.economy-slot-banner__handle {
  position: absolute;
  left: calc(var(--economy-slot-u) * 409.21);
  top: calc(var(--economy-slot-u) * 30.94);
  width: calc(var(--economy-slot-u) * 19.688);
  height: calc(var(--economy-slot-u) * 66.094);
  border-radius: calc(var(--economy-slot-u) * 9);
  background: rgba(150, 131, 180, 0.63);
}

.economy-slot-banner__handle::before {
  position: absolute;
  left: calc(var(--economy-slot-u) * -1.4);
  top: calc(var(--economy-slot-u) * -30.94);
  width: calc(var(--economy-slot-u) * 22.5);
  height: calc(var(--economy-slot-u) * 22.5);
  border-radius: 999px;
  background: radial-gradient(circle at 35% 35%, #ff786b, #d83c34 65%);
  content: '';
}

.economy-slot-banner__handle-stick {
  position: absolute;
  left: calc(var(--economy-slot-u) * 6.28);
  top: calc(var(--economy-slot-u) * -16.32);
  width: calc(var(--economy-slot-u) * 6);
  height: calc(var(--economy-slot-u) * 43.5);
  border-radius: calc(var(--economy-slot-u) * 3);
  background: #1a1133;
}
</style>
