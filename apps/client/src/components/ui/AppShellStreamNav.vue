<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <nav class="stream-nav" :aria-label="t('app.navAria')">
    <RouterLink
      class="stream-nav__icon"
      :to="{ name: 'home' }"
      :aria-label="t('app.navHome')"
      :title="t('app.navHome')"
    >
      <svg
        class="stream-nav__svg"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="1.75"
        stroke="currentColor"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path
          d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
        />
      </svg>
    </RouterLink>
    <div class="stream-nav__links">
      <RouterLink class="stream-nav__link" :to="{ name: 'wordle' }">Wordle</RouterLink>
      <span
        class="stream-nav__link stream-nav__link--soon"
        :title="t('app.navEatDisabledTitle')"
        :aria-label="t('app.navEatDisabledAria')"
      >
        Eat
      </span>
      <span
        class="stream-nav__link stream-nav__link--soon"
        :title="t('app.navCallSoonTitle')"
        :aria-label="t('app.navCallSoonAria')"
      >
        Call
      </span>
    </div>
  </nav>
</template>

<style scoped>
.stream-nav {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  flex-shrink: 0;
  min-width: 0;
}

.stream-nav__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border-radius: var(--ui-radius-md, 8px);
  border: 1px solid var(--border-subtle, var(--sa-color-border));
  background: var(--bg-muted, color-mix(in srgb, var(--sa-color-surface-raised) 75%, transparent));
  color: var(--text-heading, var(--sa-color-text-main));
  text-decoration: none;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    color 0.15s ease;
}

.stream-nav__icon:hover,
.stream-nav__icon.router-link-active {
  border-color: var(--border-strong, var(--sa-color-primary-border));
  background: var(--bg-muted-strong, color-mix(in srgb, var(--sa-color-surface) 88%, transparent));
  color: var(--text-title, var(--sa-color-primary));
}

.stream-nav__icon:focus-visible {
  outline: 2px solid var(--border-cyan-strong, var(--sa-color-primary));
  outline-offset: 2px;
}

.stream-nav__svg {
  width: 1.125rem;
  height: 1.125rem;
  flex-shrink: 0;
  display: block;
  pointer-events: none;
}

.stream-nav__links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.35rem;
}

.stream-nav__link {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-decoration: none;
  padding: 0.2rem 0.45rem;
  border-radius: 6px;
  border: 1px solid var(--border-subtle, var(--sa-color-border));
  background: var(--bg-card-soft, color-mix(in srgb, var(--sa-color-surface) 80%, transparent));
  color: var(--text-secondary, var(--sa-color-text-muted));
  transition:
    border-color 0.15s ease,
    color 0.15s ease;
}

.stream-nav__link:hover,
.stream-nav__link.router-link-active,
.stream-nav__link.stream-nav__link--active {
  border-color: var(--border-strong, var(--sa-color-primary-border));
  color: var(--text-title, var(--sa-color-primary));
}

.stream-nav__link:focus-visible {
  outline: 2px solid var(--border-cyan-strong, var(--sa-color-primary));
  outline-offset: 2px;
}

.stream-nav__link--soon {
  cursor: not-allowed;
  opacity: 0.45;
  pointer-events: none;
  border-style: dashed;
  color: var(--text-muted, var(--sa-color-text-muted));
}

.stream-nav__link--soon:hover {
  border-color: var(--border-subtle, var(--sa-color-border));
  color: var(--text-muted, var(--sa-color-text-muted));
}
</style>
