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

function onLocaleChange(event: Event) {
  const el = event.target as HTMLSelectElement | null
  if (!el) return
  emit('update:locale', el.value)
}
</script>

<template>
  <header class="app-landing-header" aria-label="StreamAssist">
    <div class="app-landing-header__bar">
      <RouterLink class="app-landing-header__brand" :to="{ name: 'home' }" :aria-label="brandName">
        <img class="app-landing-header__logo" :src="logoSrc" alt="" width="42" height="42" />
      </RouterLink>

      <label class="app-landing-header__locale">
        <span class="sr-only">Language</span>
        <select class="app-landing-header__locale-select" :value="locale" @change="onLocaleChange">
          <option v-for="option in localeOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <RouterLink class="app-landing-header__title" :to="{ name: 'home' }">
        {{ brandName }}
      </RouterLink>

      <div class="app-landing-header__actions">
        <RouterLink class="app-landing-header__coin" :to="coinHubTo" aria-label="Open Coin Hub">
          <span class="app-landing-header__coin-label">Coin Hub</span>
          <span class="app-landing-header__coin-icon" aria-hidden="true" />
        </RouterLink>

        <div class="app-landing-header__auth" :aria-busy="authLoading">
          <span v-if="authLoading" class="app-landing-header__auth-loading">Loading</span>
          <span
            v-else-if="isAuthenticated"
            class="app-landing-header__user"
            :title="userName"
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
            <span class="app-landing-header__user-name">{{ userName }}</span>
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
  padding: clamp(0.75rem, 1.8vw, 1.15rem) clamp(0.85rem, 2vw, 1.5rem) 0;
}

.app-landing-header__bar {
  position: relative;
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  align-items: center;
  gap: clamp(0.6rem, 1.4vw, 1rem);
  min-height: 4.25rem;
  padding: 0.55rem clamp(0.75rem, 2vw, 1.5rem);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  background:
    linear-gradient(120deg, rgba(102, 56, 143, 0.3), rgba(59, 34, 96, 0.22)),
    rgba(18, 8, 34, 0.6);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 16px 56px rgba(11, 3, 23, 0.35);
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
  width: 2.9rem;
  height: 2.9rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}

.app-landing-header__logo {
  display: block;
  width: 2rem;
  height: 2rem;
  object-fit: contain;
}

.app-landing-header__locale {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.app-landing-header__locale::after {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  width: 0.42rem;
  height: 0.42rem;
  border-right: 1px solid rgba(255, 255, 255, 0.75);
  border-bottom: 1px solid rgba(255, 255, 255, 0.75);
  content: '';
  pointer-events: none;
  transform: translateY(-66%) rotate(45deg);
}

.app-landing-header__locale-select {
  width: 7.25rem;
  min-height: 2.25rem;
  appearance: none;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 1.2rem;
  padding: 0 1.8rem 0 0.9rem;
  background: rgba(102, 56, 143, 0.45);
  color: #fff;
  font: inherit;
  font-size: 0.78rem;
  line-height: 1;
  cursor: pointer;
}

.app-landing-header__locale-select option {
  color: #111827;
}

.app-landing-header__title {
  justify-self: center;
  min-width: 0;
  color: #fff;
  font-family: var(--sa-font-display, system-ui, sans-serif);
  font-size: 1.85rem;
  font-weight: 700;
  line-height: 1.05;
  text-align: center;
  text-transform: uppercase;
  text-shadow: 0 5px 16px rgba(0, 0, 0, 0.24);
  white-space: nowrap;
}

.app-landing-header__actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.65rem;
  min-width: 0;
}

.app-landing-header__coin {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 2.25rem;
  padding: 0.18rem 0.2rem 0.18rem 0.85rem;
  border: 1px solid rgba(255, 218, 68, 0.16);
  border-radius: 999px;
  background: rgba(255, 163, 108, 0.18);
  color: #ffda44;
  font-size: 0.76rem;
  font-weight: 800;
}

.app-landing-header__coin-icon {
  position: relative;
  display: inline-flex;
  width: 1.85rem;
  height: 1.85rem;
  flex-shrink: 0;
  border-radius: 999px;
  background: linear-gradient(135deg, #ffda44, #ffa733 58%, #cc7400);
  box-shadow:
    inset -0.35rem 0 0 rgba(204, 116, 0, 0.34),
    0 0 18px rgba(255, 218, 68, 0.24);
}

.app-landing-header__coin-icon::after {
  position: absolute;
  inset: 0.42rem;
  border-radius: inherit;
  border: 2px solid rgba(238, 135, 0, 0.78);
  content: '';
}

.app-landing-header__auth {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 8.75rem;
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
.app-landing-header__locale-select:focus-visible {
  outline: 2px solid rgba(255, 218, 68, 0.78);
  outline-offset: 3px;
}

.app-landing-header__auth-link--primary {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.app-landing-header__user {
  gap: 0.45rem;
  max-width: 12rem;
  padding: 0.25rem 0.65rem 0.25rem 0.3rem;
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
  font-size: 0.76rem;
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
