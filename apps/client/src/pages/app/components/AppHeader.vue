<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
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
    compact?: boolean
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
    compact: false,
  },
)

const emit = defineEmits<{
  login: []
  logout: []
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
const profileActionLabel = computed(() => profileMenuLabel.value)
const headerWrapper = ref<HTMLElement | null>(null)
const headerInner = ref<HTMLElement | null>(null)
const profileMenuRoot = ref<HTMLElement | null>(null)
const profileMenuOpen = ref(false)
const profileMenuId = 'app-landing-profile-menu'

let headerResizeObserver: ResizeObserver | undefined
let headerResizeFrame = 0

function syncHeaderHeight(): void {
  if (!headerWrapper.value || !headerInner.value) {
    return
  }
  headerWrapper.value.style.height = `${headerInner.value.offsetHeight}px`
}

function scheduleHeaderHeightSync(): void {
  if (typeof window === 'undefined') {
    syncHeaderHeight()
    return
  }
  if (headerResizeFrame) {
    window.cancelAnimationFrame(headerResizeFrame)
  }
  headerResizeFrame = window.requestAnimationFrame(() => {
    headerResizeFrame = 0
    syncHeaderHeight()
  })
}

onMounted(() => {
  void nextTick(() => {
    syncHeaderHeight()
    if (typeof ResizeObserver === 'undefined' || !headerInner.value) {
      return
    }
    headerResizeObserver = new ResizeObserver(scheduleHeaderHeightSync)
    headerResizeObserver.observe(headerInner.value)
  })
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onDocumentKeydown, true)
})

onUnmounted(() => {
  headerResizeObserver?.disconnect()
  if (headerResizeFrame && typeof window !== 'undefined') {
    window.cancelAnimationFrame(headerResizeFrame)
  }
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onDocumentKeydown, true)
})

watch(
  () => props.isAuthenticated,
  (authenticated) => {
    if (!authenticated) {
      closeProfileMenu()
    }
  },
)

function closeProfileMenu(): void {
  profileMenuOpen.value = false
}

function toggleProfileMenu(): void {
  profileMenuOpen.value = !profileMenuOpen.value
}

function onDocumentClick(event: MouseEvent): void {
  if (!profileMenuOpen.value) {
    return
  }
  const target = event.target
  if (target instanceof Node && profileMenuRoot.value?.contains(target)) {
    return
  }
  closeProfileMenu()
}

function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    closeProfileMenu()
  }
}

function onProfileLogout(): void {
  closeProfileMenu()
  emit('logout')
}

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
  <header
    ref="headerWrapper"
    class="app-landing-header"
    :class="{ 'app-landing-header--compact': compact }"
    :aria-label="t('app.headerAria')"
  >
    <div ref="headerInner" class="app-landing-header__inner">
      <div class="app-landing-header__bar">
        <RouterLink class="app-landing-header__brand" :to="{ name: 'home' }" :aria-label="brandName">
          <img class="app-landing-header__logo" :src="logoSrc" alt="" width="42" height="42" />
        </RouterLink>

        <div class="app-landing-header__center">
          <RouterLink class="app-landing-header__title" :to="{ name: 'home' }">
            <span class="app-landing-header__title-frame">
              <Transition name="app-landing-header-title" mode="out-in">
                <span :key="displayTitle" class="app-landing-header__title-text">{{ displayTitle }}</span>
              </Transition>
            </span>
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
            <div v-else-if="isAuthenticated" ref="profileMenuRoot" class="app-landing-header__profile">
              <button
                type="button"
                class="app-landing-header__user"
                :aria-controls="profileMenuId"
                :aria-expanded="profileMenuOpen"
                aria-haspopup="menu"
                :aria-label="profileActionLabel"
                :title="displayName || undefined"
                @click.stop="toggleProfileMenu"
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
              </button>
              <div
                v-if="profileMenuOpen"
                :id="profileMenuId"
                class="app-landing-header__profile-menu"
                role="menu"
              >
                <RouterLink
                  v-if="profileTo"
                  class="app-landing-header__profile-menu-item"
                  :to="profileTo"
                  role="menuitem"
                  @click="closeProfileMenu"
                >
                  {{ t('app.openAdminPanel') }}
                </RouterLink>
                <button
                  type="button"
                  class="app-landing-header__profile-menu-item"
                  role="menuitem"
                  @click="onProfileLogout"
                >
                  {{ t('app.authLogout') }}
                </button>
              </div>
            </div>
            <span v-else class="app-landing-header__auth-buttons">
              <button type="button" class="app-landing-header__auth-link" @click="$emit('login')">
                {{ t('app.logIn') }}
              </button>
            </span>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.app-landing-header {
  position: relative;
  z-index: 3;
  overflow: visible;
  transition: height 0.34s cubic-bezier(0.22, 1, 0.36, 1);
  will-change: height;
}

.app-landing-header__inner {
  width: 100%;
  padding: 0.6rem clamp(1.35rem, 1.6vw, 1.55rem) 0;
  box-sizing: border-box;
  transition: padding 0.34s cubic-bezier(0.22, 1, 0.36, 1);
}

.app-landing-header__bar {
  position: relative;
  isolation: isolate;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
  min-height: 4.5rem;
  overflow: visible;
  padding: 0 1.1rem;
  border: 1px solid rgba(255, 255, 255, 0.11);
  border-radius: 999px;
  background: rgba(18, 8, 34, 0.015);
  transform: translateZ(0);
  transition:
    min-height 0.34s cubic-bezier(0.22, 1, 0.36, 1),
    padding 0.34s cubic-bezier(0.22, 1, 0.36, 1),
    border-radius 0.34s cubic-bezier(0.22, 1, 0.36, 1);
}

.app-landing-header__bar::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: inherit;
  pointer-events: none;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.035), transparent 34%),
    rgba(18, 8, 34, 0.015);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.24),
    inset 0 -1px 0 rgba(255, 255, 255, 0.08),
    0 14px 36px rgba(11, 3, 23, 0.34);
  -webkit-backdrop-filter: blur(3px);
  backdrop-filter: blur(3px);
  transform: translateZ(0);
}

.app-landing-header--compact .app-landing-header__bar {
  min-height: calc(4.5rem - 20px);
}

.app-landing-header__brand,
.app-landing-header__title,
.app-landing-header__coin {
  color: inherit;
  text-decoration: none;
}

.app-landing-header__brand {
  position: relative;
  z-index: 1;
  grid-column: 1;
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
  pointer-events: none;
  transform: translate(-50%, -50%);
}

.app-landing-header__title {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 2.1rem;
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
  pointer-events: none;
  white-space: nowrap;
}

.app-landing-header__title-frame {
  position: relative;
  display: grid;
  align-items: center;
  min-height: 2.1rem;
  min-width: 0;
}

.app-landing-header__title-text {
  grid-area: 1 / 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.app-landing-header-title-enter-active,
.app-landing-header-title-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}

.app-landing-header-title-enter-from,
.app-landing-header-title-leave-to {
  opacity: 0;
  transform: translateY(0.15rem);
}

.app-landing-header-title-leave-active {
  position: absolute;
}

.app-landing-header__center-extra {
  position: relative;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  pointer-events: auto;
}

.app-landing-header__center-extra :deep(*) {
  pointer-events: auto;
}

.app-landing-header__center-extra :deep(.app-shell-call-room-anchor) {
  position: relative;
  z-index: 10;
  display: inline-flex;
}

.app-landing-header__center-extra :deep(.app-shell-call-join-room) {
  position: relative;
  z-index: 1;
  pointer-events: auto;
}

.app-landing-header__actions {
  position: relative;
  z-index: 1;
  grid-column: 3;
  justify-self: end;
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
  font-family: var(--app-home-counter, 'Coda Caption', var(--sa-font-display, system-ui, sans-serif));
  font-size: 0.78rem;
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
  filter: drop-shadow(0 0 10px rgba(255, 218, 68, 0.22));
}

.app-landing-header__coin-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.app-landing-header__auth {
  position: relative;
  z-index: 30;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 8.8rem;
  min-height: 2.35rem;
  overflow: visible;
  border-color: rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  background: rgba(81, 48, 116, 0.24);
  color: #fff;
  box-shadow: 0 10px 22px rgba(10, 3, 24, 0.2);
  -webkit-backdrop-filter: blur(var(--app-home-glass-blur, 10px)) saturate(1.18);
  backdrop-filter: blur(var(--app-home-glass-blur, 10px)) saturate(1.18);
  font-family: var(--app-home-ui, var(--sa-font-main, system-ui), sans-serif);
}

.app-landing-header__auth::before {
  display: none;
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

.app-landing-header__profile {
  position: relative;
  z-index: 2;
  width: 100%;
  min-width: 0;
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

.app-landing-header__profile-menu {
  position: absolute;
  top: calc(100% + 0.55rem);
  right: 0;
  z-index: 1000;
  display: grid;
  min-width: 10.5rem;
  overflow: hidden;
  padding: 0.35rem;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 1rem;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.13), transparent 42%),
    rgba(28, 15, 48, 0.94);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.16),
    0 18px 38px rgba(8, 3, 20, 0.34);
  -webkit-backdrop-filter: blur(var(--app-home-glass-blur, 10px)) saturate(1.18);
  backdrop-filter: blur(var(--app-home-glass-blur, 10px)) saturate(1.18);
}

.app-landing-header__profile-menu-item {
  display: flex;
  align-items: center;
  min-height: 2rem;
  width: 100%;
  padding: 0 0.75rem;
  border: 0;
  border-radius: 0.7rem;
  background: transparent;
  color: rgba(255, 255, 255, 0.82);
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  line-height: 1.2;
  text-align: left;
  text-decoration: none;
  white-space: nowrap;
}

.app-landing-header__profile-menu-item:hover,
.app-landing-header__profile-menu-item:focus-visible {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.app-landing-header__profile-menu-item:focus-visible {
  outline: 2px solid rgba(255, 218, 68, 0.78);
  outline-offset: 2px;
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
  .app-landing-header__inner {
    padding: 0.45rem clamp(0.8rem, 2vw, 1.25rem) 0;
  }

  .app-landing-header__bar {
    gap: 0.85rem;
    min-height: 4.4rem;
    padding: 0 1rem;
  }

  .app-landing-header--compact .app-landing-header__bar {
    min-height: calc(4.4rem - 20px);
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
    transform: none;
    pointer-events: auto;
  }
}

@media (max-width: 640px) {
  .app-landing-header__inner {
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

@media (prefers-reduced-motion: reduce) {
  .app-landing-header {
    transition: none;
    will-change: auto;
  }

  .app-landing-header__inner,
  .app-landing-header__bar {
    transition: none;
  }
}
</style>
