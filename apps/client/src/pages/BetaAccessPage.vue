<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AppButton from '@/components/ui/AppButton.vue'
import AppCard from '@/components/ui/AppCard.vue'

const { t } = useI18n()
const router = useRouter()

function goHome(): void {
  void router.push({ name: 'home' })
}
</script>

<template>
  <section class="beta-access-page" aria-labelledby="beta-access-title">
    <AppCard class="beta-access-page__card">
      <p class="beta-access-page__eyebrow">{{ t('betaAccess.eyebrow') }}</p>
      <h1 id="beta-access-title">{{ t('betaAccess.title') }}</h1>
      <p class="beta-access-page__body">{{ t('betaAccess.body') }}</p>
      <p class="beta-access-page__note">{{ t('betaAccess.note') }}</p>
      <AppButton class="beta-access-page__button" variant="primary" type="button" @click="goHome">
        {{ t('betaAccess.backHome') }}
      </AppButton>
    </AppCard>
  </section>
</template>

<style scoped>
.beta-access-page {
  box-sizing: border-box;
  display: grid;
  place-items: center;
  min-height: 100%;
  padding: clamp(2rem, 8vw, 4.5rem) 1rem;
}

.beta-access-page__card {
  position: relative;
  width: min(42rem, 100%);
  overflow: hidden;
  padding: clamp(1.4rem, 5vw, 2.4rem);
  text-align: center;
}

.beta-access-page__card::before {
  content: '';
  position: absolute;
  inset: -35% 16% auto;
  height: 12rem;
  border-radius: 999px;
  background: radial-gradient(circle, color-mix(in srgb, var(--sa-color-primary) 34%, transparent), transparent 68%);
  filter: blur(18px);
  opacity: 0.72;
  pointer-events: none;
}

.beta-access-page__eyebrow,
.beta-access-page__card h1,
.beta-access-page__body,
.beta-access-page__note,
.beta-access-page__button {
  position: relative;
}

.beta-access-page__eyebrow {
  margin: 0 0 0.65rem;
  color: var(--sa-color-primary);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.beta-access-page__card h1 {
  margin: 0;
  color: var(--sa-color-text-strong, var(--sa-color-text-main));
  font-size: clamp(1.65rem, 5vw, 2.45rem);
  line-height: 1.08;
}

.beta-access-page__body {
  margin: 1rem auto 0;
  max-width: 34rem;
  color: var(--sa-color-text-body);
  font-size: 1rem;
  line-height: 1.65;
}

.beta-access-page__note {
  margin: 0.85rem auto 0;
  max-width: 32rem;
  color: var(--sa-color-text-muted, var(--sa-color-text-body));
  font-size: 0.9rem;
  line-height: 1.55;
}

.beta-access-page__button {
  margin: 1.4rem auto 0;
}
</style>
