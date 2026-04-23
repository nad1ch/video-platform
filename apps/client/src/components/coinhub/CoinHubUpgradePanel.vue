<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import PremiumPlansModal from '@/components/coinhub/PremiumPlansModal.vue'
import '@/styles/coinhub-design-system.css'

withDefaults(
  defineProps<{
    /**
     * Beside the hero: premium upgrade card (md+). Default: section below boosts.
     */
    inlineWithHero?: boolean
  }>(),
  { inlineWithHero: false },
)

const { t } = useI18n()

const premiumModalOpen = ref(false)

const crownSrc = '/assets/coinhub/crown-premium.png'

function openPremiumModal() {
  premiumModalOpen.value = true
}
</script>

<template>
  <section
    v-if="inlineWithHero"
    class="upgrade-card min-w-0 md:min-h-0 md:h-full"
    :aria-label="t('coinHub.sectionSubscription')"
  >
    <div
      class="upgrade-card__noise"
      aria-hidden="true"
    />
    <div class="upgrade-card__content">
      <div class="upgrade-card__row">
        <div
          class="upgrade-card__icon"
          aria-hidden="true"
        >
          <img
            class="upgrade-card__crown"
            :src="crownSrc"
            alt=""
            width="64"
            height="64"
            loading="lazy"
            decoding="async"
          >
        </div>
        <div class="upgrade-card__text">
          <h3 class="upgrade-card__title">
            {{ t('coinHub.upgradeTitle') }}
          </h3>
          <p class="upgrade-card__desc">
            {{ t('coinHub.upgradeBody') }}
          </p>
        </div>
      </div>
      <button
        type="button"
        class="ch-coinhub-gold-cta ch-coinhub-gold-cta--label-light upgrade-card__cta"
        @click="openPremiumModal"
      >
        {{ t('coinHub.upgradeCta') }}
      </button>
    </div>
  </section>

  <section
    v-else
    class="coinhub-panel coinhub-panel--premium-upgrade coinhub-panel--tertiary ch-ds-card ch-ds-card--interactive min-w-0 overflow-hidden p-6 sm:p-8"
    :aria-label="t('coinHub.sectionSubscription')"
  >
    <div class="coinhub-upgrade flex flex-col gap-5">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        <div
          class="coinhub-upgrade__icon-shell flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl"
          aria-hidden="true"
        >
          <img
            class="h-16 w-16 object-contain"
            :src="crownSrc"
            alt=""
            width="64"
            height="64"
            loading="lazy"
            decoding="async"
          >
        </div>
        <div class="min-w-0 flex-1">
          <h2 class="ch-ds-text-section text-[24px] sm:text-[28px]">
            {{ t('coinHub.upgradeTitle') }}
          </h2>
          <p class="ch-ds-text-muted mt-2 text-sm leading-relaxed">
            {{ t('coinHub.upgradeBody') }}
          </p>
        </div>
      </div>
      <button
        type="button"
        class="ch-coinhub-gold-cta w-full max-w-md"
        @click="openPremiumModal"
      >
        {{ t('coinHub.upgradeCta') }}
      </button>
    </div>
  </section>

  <PremiumPlansModal v-model:open="premiumModalOpen" />
</template>

<style scoped>
/* —— Premium “Upgrade plan” card (hero column) —— */
.upgrade-card {
  position: relative;
  display: flex;
  flex-direction: column;
  border-radius: 22px;
  padding: 28px;
  overflow: hidden;
  border: 1px solid rgba(90, 70, 200, 0.45);
  background:
    radial-gradient(circle at 0% 0%, rgba(120, 60, 255, 0.25), transparent 60%),
    #0b0b1f;
  box-shadow:
    0 0 48px rgba(80, 50, 200, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.upgrade-card::before {
  content: '';
  position: absolute;
  inset: -35%;
  z-index: 0;
  background: radial-gradient(
    circle at 75% 40%,
    rgba(100, 60, 255, 0.2),
    transparent 58%
  );
  filter: blur(56px);
  pointer-events: none;
}

/* Subtle noise / film to reduce flat CG */
.upgrade-card__noise {
  position: absolute;
  inset: 0;
  z-index: 0;
  opacity: 0.055;
  pointer-events: none;
  border-radius: inherit;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  mix-blend-mode: overlay;
}

.upgrade-card__content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  justify-content: center;
  min-height: 0;
  gap: 1.5rem;
}

.upgrade-card__row {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr);
  align-items: start;
  gap: 1rem;
}

.upgrade-card__icon {
  position: relative;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.upgrade-card__icon::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background: radial-gradient(ellipse 80% 70% at 50% 0%, rgba(255, 255, 255, 0.2), transparent 55%);
  mix-blend-mode: screen;
  opacity: 0.65;
}

.upgrade-card__crown {
  position: relative;
  z-index: 1;
  width: 64px;
  height: 64px;
  object-fit: contain;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.35));
  border-radius: 16px;
  overflow: hidden;
}

.upgrade-card__text {
  min-width: 0;
}

.upgrade-card__title {
  margin: 0 0 0.6rem;
  font-size: clamp(1.4rem, 2.2vw, 1.75rem);
  font-weight: 800;
  line-height: 1.25;
  color: #fff;
  letter-spacing: -0.02em;
}

@media (min-width: 1024px) {
  .upgrade-card__title {
    font-size: 30px;
  }
}

.upgrade-card__desc {
  margin: 0;
  max-width: 26rem;
  font-size: 14px;
  line-height: 1.6;
  color: #e8e8ee;
}

/* CTA: shared .ch-coinhub-gold-cta from coinhub-design-system.css */
.upgrade-card__cta {
  width: 100%;
  max-width: 100%;
  grid-column: 1 / -1;
}

.coinhub-upgrade__icon-shell {
  position: relative;
  isolation: isolate;
  background: linear-gradient(145deg, #5b21b6 0%, #6d28d9 40%, #1e1b4b 100%);
  box-shadow:
    inset 0 0 32px rgba(192, 132, 252, 0.32),
    0 8px 28px rgba(100, 50, 200, 0.4);
  border: 1px solid rgba(200, 160, 255, 0.2);
  overflow: hidden;
}

.coinhub-upgrade__icon-shell::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(ellipse 80% 70% at 50% 0%, rgba(255, 255, 255, 0.18), transparent 55%);
  mix-blend-mode: screen;
  opacity: 0.6;
  pointer-events: none;
}
</style>
