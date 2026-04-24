<script setup lang="ts">
defineProps<{
  brandName: string
  year: number
  feedbackHref: string
}>()
</script>

<template>
  <footer class="app-landing-footer">
    <div class="app-landing-footer__rights">
      <span class="app-landing-footer__brand">{{ brandName }}</span>
      <span class="app-landing-footer__copy">{{ year }} All rights reserved.</span>
    </div>

    <a class="app-landing-footer__feedback" :href="feedbackHref">
      Feedback
    </a>
  </footer>
</template>

<style scoped>
.app-landing-footer {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 4.6rem;
  padding: 1rem clamp(1.4rem, 2.2vw, 2.8rem);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(32, 20, 52, 0.68);
  color: #fff;
  -webkit-backdrop-filter: blur(18px);
  backdrop-filter: blur(18px);
}

.app-landing-footer__rights {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  background: rgba(81, 48, 116, 0.22);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
}

.app-landing-footer__brand {
  display: inline-flex;
  align-items: center;
  min-height: 1.5rem;
  padding: 0 0.8rem;
  border-radius: inherit;
  background: rgba(81, 48, 116, 0.6);
  font-family: var(--app-home-display, var(--sa-font-display, system-ui, sans-serif));
  font-size: 0.72rem;
  line-height: 1;
  white-space: nowrap;
}

.app-landing-footer__copy {
  min-width: 0;
  overflow: hidden;
  padding: 0 0.85rem;
  color: rgba(255, 255, 255, 0.82);
  font-size: 0.66rem;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-landing-footer__feedback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 8.7rem;
  min-height: 2.35rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  background: rgba(81, 48, 116, 0.62);
  color: #fff;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  font-size: 0.82rem;
  font-weight: 700;
  text-decoration: none;
  transition:
    background 0.18s ease,
    transform 0.18s ease;
}

.app-landing-footer__feedback:hover {
  background: rgba(102, 56, 143, 0.76);
  transform: translateY(-1px);
}

.app-landing-footer__feedback:focus-visible {
  outline: 2px solid rgba(255, 218, 68, 0.86);
  outline-offset: 3px;
}

@media (max-width: 640px) {
  .app-landing-footer {
    flex-direction: column;
    align-items: stretch;
    padding-block: 1.1rem;
  }

  .app-landing-footer__rights {
    justify-content: center;
  }

  .app-landing-footer__feedback {
    width: 100%;
  }
}

@media (min-width: 641px) and (max-width: 1200px) {
  .app-landing-footer {
    min-height: 5.2rem;
  }

  .app-landing-footer__feedback {
    min-width: 9.5rem;
    min-height: 2.55rem;
    font-size: 0.9rem;
  }
}
</style>
