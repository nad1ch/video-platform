<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

type LocaleOption = {
  value: string
  label: string
}

const props = withDefaults(
  defineProps<{
    brandName: string
    logoSrc: string
    coinHubTo: RouteLocationRaw
    /** Formatted balance (Coin Hub); placeholder when guest. */
    coinBalanceLabel: string
    locale: string
    localeOptions: LocaleOption[]
    authLoading?: boolean
    isAuthenticated?: boolean
    userName?: string
    userAvatar?: string
  }>(),
  {
    authLoading: false,
    isAuthenticated: false,
    userName: '',
    userAvatar: '',
  },
)

const emit = defineEmits<{
  login: []
  signup: []
  'update:locale': [value: string]
}>()

const hasUserAvatar = computed(() => props.userAvatar.trim().length > 0)
const userInitial = computed(() => {
  const s = props.userName.trim()
  return (s[0] ?? 'S').toUpperCase()
})
const displayName = computed(() => props.userName.trim())
const activeLocaleLabel = computed(
  () => props.localeOptions.find((option) => option.value === props.locale)?.label ?? props.localeOptions[0]?.label ?? 'English',
)

function selectLocale(value: string, event: MouseEvent) {
  emit('update:locale', value)
  const details = (event.currentTarget as HTMLElement | null)?.closest('details')
  details?.removeAttribute('open')
}
</script>

<template>
  <header class="app-landing-header" aria-label="StreamAssist">
    <div class="app-landing-header__bar">
      <RouterLink class="app-landing-header__brand" :to="{ name: 'home' }" :aria-label="brandName">
        <img class="app-landing-header__logo" :src="logoSrc" alt="" width="42" height="42" />
      </RouterLink>

      <details class="app-landing-header__locale">
        <summary class="app-landing-header__locale-trigger" aria-label="Choose language">
          <span>{{ activeLocaleLabel }}</span>
        </summary>
        <div class="app-landing-header__locale-list">
          <button
            v-for="option in localeOptions"
            :key="option.value"
            class="app-landing-header__locale-option"
            :class="{ 'app-landing-header__locale-option--active': option.value === locale }"
            type="button"
            @click="selectLocale(option.value, $event)"
          >
            {{ option.label }}
          </button>
        </div>
      </details>

      <RouterLink class="app-landing-header__title" :to="{ name: 'home' }">
        {{ brandName }}
      </RouterLink>

      <div class="app-landing-header__actions">
        <RouterLink class="app-landing-header__coin" :to="coinHubTo" aria-label="Open Coin Hub">
          <span class="app-landing-header__coin-label">{{ coinBalanceLabel }}</span>
          <span class="app-landing-header__coin-icon" aria-hidden="true" />
        </RouterLink>

        <div class="app-landing-header__auth" :aria-busy="authLoading">
          <span v-if="authLoading" class="app-landing-header__auth-loading">Loading</span>
          <span
            v-else-if="isAuthenticated"
            class="app-landing-header__user"
            :title="displayName || undefined"
          >
            <span class="app-landing-header__avatar" aria-hidden="true">
              <img
                v-if="hasUserAvatar"
                class="app-landing-header__avatar-img"
                :src="userAvatar"
                alt=""
                width="28"
                height="28"
              />
              <span v-else>{{ userInitial }}</span>
            </span>
            <span class="app-landing-header__user-name">{{ displayName || userInitial }}</span>
          </span>
          <span v-else class="app-landing-header__auth-buttons">
            <button type="button" class="app-landing-header__auth-link" @click="$emit('login')">
              Log In
            </button>
            <button
              type="button"
              class="app-landing-header__auth-link app-landing-header__auth-link--primary"
              @click="$emit('signup')"
            >
              Sign Up
            </button>
          </span>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-landing-header {
  position: relative;
  z-index: 3;
  padding: 0.9rem clamp(1.35rem, 1.6vw, 1.55rem) 0;
}

.app-landing-header__bar {
  position: relative;
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
  min-height: 5rem;
  overflow: visible;
  padding: 0 1.6rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  background:
    linear-gradient(120deg, rgba(102, 56, 143, 0.3), rgba(59, 34, 96, 0.22)),
    rgba(18, 8, 34, 0.6);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 16px 56px rgba(11, 3, 23, 0.35);
  -webkit-backdrop-filter: blur(20px);
  backdrop-filter: blur(20px);
}

.app-landing-header__brand,
.app-landing-header__title,
.app-landing-header__coin {
  color: inherit;
  text-decoration: none;
}

.app-landing-header__brand {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3.25rem;
  height: 3.25rem;
  border-radius: 0;
}

.app-landing-header__logo {
  display: block;
  width: 2.45rem;
  height: 2.45rem;
  object-fit: contain;
}

.app-landing-header__locale {
  position: relative;
  z-index: 4;
  align-self: center;
  width: 7.9rem;
  height: 2.15rem;
}

.app-landing-header__locale[open] {
  z-index: 6;
}

.app-landing-header__locale-trigger {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 2.15rem;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 1.25rem;
  background: rgba(81, 48, 117, 0.52);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.12),
    0 12px 28px rgba(10, 3, 24, 0.22);
  color: #fff;
  cursor: pointer;
  list-style: none;
  -webkit-backdrop-filter: blur(18px);
  backdrop-filter: blur(18px);
}

.app-landing-header__locale-trigger::-webkit-details-marker {
  display: none;
}

.app-landing-header__locale-trigger::after {
  position: absolute;
  right: 1rem;
  top: 50%;
  width: 0.42rem;
  height: 0.42rem;
  border-right: 1px solid rgba(255, 255, 255, 0.78);
  border-bottom: 1px solid rgba(255, 255, 255, 0.78);
  content: '';
  transform: translateY(-66%) rotate(45deg);
}

.app-landing-header__locale-list {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 1;
  display: none;
  width: 100%;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 1.25rem;
  background: rgba(77, 55, 104, 0.5);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 18px 34px rgba(10, 3, 24, 0.3);
  -webkit-backdrop-filter: blur(18px);
  backdrop-filter: blur(18px);
}

.app-landing-header__locale[open] .app-landing-header__locale-list {
  display: grid;
}

.app-landing-header__locale-option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.45rem;
  border: 0;
  background: transparent;
  color: #fff;
  font: inherit;
  font-size: 0.95rem;
  line-height: 1;
  cursor: pointer;
}

.app-landing-header__locale-option--active {
  background: rgba(81, 48, 117, 0.6);
}

.app-landing-header__title {
  justify-self: center;
  min-width: 0;
  color: #fff;
  font-family: var(--app-home-display, var(--sa-font-display, system-ui, sans-serif));
  font-size: 2rem;
  font-weight: 800;
  line-height: 1.05;
  text-align: center;
  text-transform: uppercase;
  transform: none;
  text-shadow: 0 5px 16px rgba(0, 0, 0, 0.24);
  white-space: nowrap;
}

.app-landing-header__actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.65rem;
  min-width: 0;
  margin-right: 0.15rem;
}

.app-landing-header__coin {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.15rem;
  padding: 0 0 0 1rem;
  margin-right: 0.25rem;
  transform: translateX(-0.2rem);
  border: 1px solid rgba(255, 218, 68, 0.16);
  border-radius: 999px;
  background: rgba(255, 163, 108, 0.18);
  color: #ffda44;
  font-size: 0.82rem;
  font-weight: 800;
}

.app-landing-header__coin-icon {
  position: relative;
  display: inline-flex;
  width: 2.45rem;
  height: 2.45rem;
  margin: -0.22rem -0.2rem -0.22rem 0;
  flex-shrink: 0;
  border-radius: 999px;
  background: linear-gradient(135deg, #ffda44, #ffa733 58%, #cc7400);
  box-shadow:
    inset -0.35rem 0 0 rgba(204, 116, 0, 0.34),
    0 0 18px rgba(255, 218, 68, 0.24);
}

.app-landing-header__coin-icon::after {
  position: absolute;
  inset: 0.55rem;
  border-radius: inherit;
  border: 2px solid rgba(238, 135, 0, 0.78);
  content: '';
}

.app-landing-header__auth {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 8.8rem;
  min-height: 2.35rem;
  border-radius: 999px;
  background: rgba(102, 56, 143, 0.48);
  color: #fff;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.app-landing-header__auth-loading {
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.76rem;
}

.app-landing-header__auth-buttons,
.app-landing-header__user {
  display: inline-flex;
  align-items: center;
  min-width: 0;
}

.app-landing-header__auth-buttons {
  gap: 0.15rem;
  padding: 0.18rem;
}

.app-landing-header__auth-link {
  min-height: 1.85rem;
  border: 0;
  border-radius: 999px;
  padding: 0 0.7rem;
  background: transparent;
  color: rgba(255, 255, 255, 0.78);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
}

.app-landing-header__auth-link:hover,
.app-landing-header__auth-link:focus-visible {
  color: #fff;
}

.app-landing-header__auth-link:focus-visible,
.app-landing-header__coin:focus-visible,
.app-landing-header__brand:focus-visible,
.app-landing-header__title:focus-visible,
.app-landing-header__locale-trigger:focus-visible,
.app-landing-header__locale-option:focus-visible {
  outline: 2px solid rgba(255, 218, 68, 0.78);
  outline-offset: 3px;
}

.app-landing-header__auth-link--primary {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.app-landing-header__user {
  justify-content: flex-start;
  width: 100%;
  max-width: 12.5rem;
  padding: 0 1rem 0 0.85rem;
  gap: 0.5rem;
}

.app-landing-header__avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 999px;
  background: linear-gradient(135deg, #8b5cf6, #1a1133);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 900;
}

.app-landing-header__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.app-landing-header__user-name {
  min-width: 0;
  overflow: hidden;
  font-size: 0.82rem;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sr-only {
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

@media (max-width: 1200px) {
  .app-landing-header {
    padding: 0.75rem clamp(0.8rem, 2vw, 1.25rem) 0;
  }

  .app-landing-header__bar {
    gap: 0.85rem;
    min-height: 4.9rem;
    padding: 0 1rem;
  }

  .app-landing-header__brand {
    width: 3.2rem;
    height: 3.2rem;
  }

  .app-landing-header__logo {
    width: 2.55rem;
    height: 2.55rem;
  }

  .app-landing-header__title {
    font-size: 2rem;
    transform: scaleX(1.08);
  }

  .app-landing-header__locale {
    width: 8.9rem;
  }

  .app-landing-header__actions {
    gap: 0.7rem;
  }

  .app-landing-header__coin {
    min-height: 2.15rem;
    padding-left: 1rem;
    font-size: 0.82rem;
  }

  .app-landing-header__coin-icon {
    width: 2.55rem;
    height: 2.55rem;
  }

  .app-landing-header__auth {
    min-width: 8.6rem;
    min-height: 2.4rem;
  }

  .app-landing-header__user-name {
    font-size: 0.82rem;
  }
}

@media (max-width: 900px) {
  .app-landing-header__bar {
    grid-template-columns: auto minmax(0, 1fr) auto;
    border-radius: 1.65rem;
  }

  .app-landing-header__locale {
    display: none;
  }

  .app-landing-header__title {
    justify-self: start;
    font-size: 1.35rem;
    transform: none;
  }
}

@media (max-width: 640px) {
  .app-landing-header {
    padding-inline: 0.65rem;
  }

  .app-landing-header__bar {
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.55rem;
    padding: 0.55rem 0.7rem;
  }

  .app-landing-header__actions {
    grid-column: 1 / -1;
    justify-content: space-between;
    width: 100%;
  }

  .app-landing-header__title {
    font-size: 1.1rem;
  }

  .app-landing-header__auth {
    min-width: min(12rem, 56vw);
  }

  .app-landing-header__coin-label {
    max-width: 5.4rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
