<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'
import { useI18n } from 'vue-i18n'
import coinIcon from '@/assets/landing/coin-streamassist.png'

const props = withDefaults(
  defineProps<{
    brandName: string
    title?: string
    logoSrc: string
    coinHubTo: RouteLocationRaw
    /** Formatted balance (Coin Hub); placeholder when guest. */
    coinBalanceLabel: string
    authLoading?: boolean
    isAuthenticated?: boolean
    userName?: string
    userAvatar?: string
    profileTo?: RouteLocationRaw
    showHelpButton?: boolean
    helpLabel?: string
  }>(),
  {
    title: '',
    authLoading: false,
    isAuthenticated: false,
    userName: '',
    userAvatar: '',
    profileTo: undefined,
    showHelpButton: false,
    helpLabel: '',
  },
)

defineEmits<{
  login: []
  openHelp: []
}>()

const hasUserAvatar = computed(() => props.userAvatar.trim().length > 0)
const { t } = useI18n()
const userInitial = computed(() => {
  const s = props.userName.trim()
  return (s[0] ?? 'S').toUpperCase()
})
const displayName = computed(() => props.userName.trim())
const displayTitle = computed(() => props.title.trim() || props.brandName)
const userAvatarSrc = computed(() => avatarSizedUrl(props.userAvatar, 96))
const resolvedHelpLabel = computed(() => props.helpLabel.trim() || t('onboarding.openGuide'))
const profileMenuLabel = computed(() =>
  displayName.value ? t('app.openProfileMenuFor', { name: displayName.value }) : t('app.openProfileMenu'),
)
const profileActionLabel = computed(() => (props.profileTo ? t('app.openAdminPanel') : profileMenuLabel.value))

function avatarSizedUrl(rawUrl: string, size: number): string {
  const trimmed = rawUrl.trim()
  if (!trimmed) {
    return ''
  }
  if (trimmed.includes('googleusercontent.com')) {
    if (/=s\d+(?:-[a-z]+)?$/i.test(trimmed)) {
      return trimmed.replace(/=s\d+(?:-[a-z]+)?$/i, `=s${size}-c`)
    }
    return `${trimmed}${trimmed.includes('?') ? '&' : '?'}sz=${size}`
  }
  if (trimmed.includes('static-cdn.jtvnw.net')) {
    return trimmed.replace(/-\d+x\d+(\.[a-z0-9]+(?:\?.*)?)$/i, `-${size}x${size}$1`)
  }
  return trimmed
}
</script>

<template>
  <header class="app-landing-header" :aria-label="t('app.headerAria')">
    <div class="app-landing-header__bar">
      <RouterLink class="app-landing-header__brand" :to="{ name: 'home' }" :aria-label="brandName">
        <img class="app-landing-header__logo" :src="logoSrc" alt="" width="42" height="42" />
      </RouterLink>

      <div class="app-landing-header__center">
        <RouterLink class="app-landing-header__title" :to="{ name: 'home' }">
          {{ displayTitle }}
        </RouterLink>
        <span v-if="$slots.center" class="app-landing-header__center-extra">
          <slot name="center" />
        </span>
      </div>

      <div class="app-landing-header__actions">
        <button
          v-if="showHelpButton"
          type="button"
          class="app-landing-header__help"
          :title="resolvedHelpLabel"
          :aria-label="resolvedHelpLabel"
          @click="$emit('openHelp')"
        >
          ?
        </button>

        <RouterLink class="app-landing-header__coin" :to="coinHubTo" :aria-label="t('app.openCoinHub')">
          <span class="app-landing-header__coin-label">{{ coinBalanceLabel }}</span>
          <span class="app-landing-header__coin-icon" aria-hidden="true">
            <img class="app-landing-header__coin-img" :src="coinIcon" alt="" width="44" height="44" />
          </span>
        </RouterLink>

        <div class="app-landing-header__auth sa-glass-button" :aria-busy="authLoading">
          <span v-if="authLoading" class="app-landing-header__auth-loading">{{ t('app.loading') }}</span>
          <component
            :is="profileTo ? RouterLink : 'button'"
            v-else-if="isAuthenticated"
            v-bind="profileTo ? { to: profileTo } : { type: 'button' }"
            class="app-landing-header__user"
            :aria-label="profileActionLabel"
            :title="displayName || undefined"
          >
            <span class="app-landing-header__avatar" aria-hidden="true">
              <img
                v-if="hasUserAvatar"
                class="app-landing-header__avatar-img"
                :src="userAvatarSrc"
                alt=""
                width="28"
                height="28"
                loading="lazy"
                decoding="async"
                fetchpriority="low"
              />
              <span v-else>{{ userInitial }}</span>
            </span>
            <span class="app-landing-header__user-name">{{ displayName || userInitial }}</span>
          </component>
          <span v-else class="app-landing-header__auth-buttons">
            <button type="button" class="app-landing-header__auth-link" @click="$emit('login')">
              {{ t('app.logIn') }}
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
  padding: 0.6rem clamp(1.35rem, 1.6vw, 1.55rem) 0;
}

.app-landing-header__bar {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
  min-height: 4.5rem;
  overflow: visible;
  padding: 0 1.6rem;
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: 999px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.035), transparent 34%),
    rgba(18, 8, 34, 0.015);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.24),
    inset 0 -1px 0 rgba(255, 255, 255, 0.08),
    0 14px 36px rgba(11, 3, 23, 0.34);
  -webkit-backdrop-filter: blur(3px);
  backdrop-filter: blur(3px);
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

.app-landing-header__center {
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.7rem;
  justify-self: center;
  min-width: 0;
  max-width: min(42rem, calc(100vw - 25rem));
  transform: translate(-50%, -50%);
}

.app-landing-header__title {
  min-width: 0;
  overflow: hidden;
  color: #fff;
  font-family: var(--app-home-display, var(--sa-font-display, system-ui, sans-serif));
  font-size: 2rem;
  font-weight: 400;
  font-variation-settings: 'YEAR' 1979;
  line-height: 1.05;
  text-align: center;
  text-transform: uppercase;
  text-shadow: 0 5px 16px rgba(0, 0, 0, 0.24);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-landing-header__center-extra {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.app-landing-header__actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.65rem;
  min-width: 0;
  margin-right: 0.15rem;
}

.app-landing-header__help {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.15rem;
  height: 2.15rem;
  margin: 0;
  padding: 0;
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.16), transparent 46%),
    rgba(72, 42, 98, 0.82);
  color: rgba(255, 255, 255, 0.86);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.18),
    0 10px 22px rgba(10, 3, 24, 0.2);
  -webkit-backdrop-filter: blur(var(--app-home-glass-blur, 10px)) saturate(1.18);
  backdrop-filter: blur(var(--app-home-glass-blur, 10px)) saturate(1.18);
  cursor: pointer;
  font-family: var(--app-home-ui, var(--sa-font-main, system-ui), sans-serif);
  font-size: 1rem;
  font-weight: 800;
  line-height: 1;
}

.app-landing-header__help:hover,
.app-landing-header__help:focus-visible {
  background: rgba(91, 51, 125, 0.9);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.24);
}

.app-landing-header__coin {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.15rem;
  padding: 0 0 0 1rem;
  margin-right: 0.25rem;
  transform: translateX(-0.2rem);
  border: 1px solid rgba(255, 218, 68, 0.28);
  border-radius: 999px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.12), transparent 42%),
    rgba(255, 163, 108, 0.18);
  color: #ffda44;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    0 10px 22px rgba(11, 3, 23, 0.18);
  -webkit-backdrop-filter: blur(var(--app-home-glass-blur, 10px)) saturate(1.24);
  backdrop-filter: blur(var(--app-home-glass-blur, 10px)) saturate(1.24);
  font-family: var(--app-home-ui, var(--sa-font-main, system-ui, sans-serif));
  font-size: 0.82rem;
  font-weight: 400;
}

.app-landing-header__coin-icon {
  position: relative;
  display: inline-flex;
  width: 2.45rem;
  height: 2.45rem;
  margin: -0.22rem -0.2rem -0.22rem 0;
  flex-shrink: 0;
  border-radius: 999px;
  filter: drop-shadow(0 0 10px rgba(255, 218, 68, 0.22));
}

.app-landing-header__coin-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.app-landing-header__auth {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 8.8rem;
  min-height: 2.35rem;
  border-radius: 999px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.12), transparent 46%),
    rgba(81, 48, 116, 0.2);
  color: #fff;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.18),
    0 10px 22px rgba(10, 3, 24, 0.2);
  -webkit-backdrop-filter: blur(var(--app-home-glass-blur, 10px)) saturate(1.18);
  backdrop-filter: blur(var(--app-home-glass-blur, 10px)) saturate(1.18);
  font-family: var(--app-home-ui, var(--sa-font-main, system-ui), sans-serif);
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
  justify-content: center;
  width: 100%;
  padding: 0.18rem 0.4rem;
}

.app-landing-header__auth-link {
  min-height: 1.85rem;
  width: 100%;
  border: 0;
  border-radius: 999px;
  padding: 0 0.7rem;
  background: transparent;
  color: rgba(255, 255, 255, 0.78);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 400;
  cursor: pointer;
}

.app-landing-header__auth-link:hover,
.app-landing-header__auth-link:focus-visible {
  color: #fff;
}

.app-landing-header__auth-link:focus-visible,
.app-landing-header__help:focus-visible,
.app-landing-header__user:focus-visible,
.app-landing-header__coin:focus-visible,
.app-landing-header__brand:focus-visible,
.app-landing-header__title:focus-visible {
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
  min-height: 2.35rem;
  padding: 0 1rem 0 0.85rem;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  gap: 0.5rem;
  text-decoration: none;
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
  font-weight: 400;
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
  font-weight: 400;
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
    padding: 0.45rem clamp(0.8rem, 2vw, 1.25rem) 0;
  }

  .app-landing-header__bar {
    gap: 0.85rem;
    min-height: 4.4rem;
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
    transform: translate(-50%, -50%) scaleX(1.08);
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

  .app-landing-header__center {
    position: static;
    justify-self: start;
    max-width: 100%;
    transform: none;
  }

  .app-landing-header__title {
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
