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
    
    coinBalanceLabel: string
    authLoading?: boolean
    isAuthenticated?: boolean
    userName?: string
    userAvatar?: string
    profileTo?: RouteLocationRaw
    accountTo?: RouteLocationRaw
    showHelpButton?: boolean
    helpLabel?: string
    compact?: boolean
    mafiaMode?: boolean
    roomCenterMode?: boolean
    showCoin?: boolean
    showAuth?: boolean
    /** Mafia OBS browser source: hide header chrome and title; keep the left logo. */
    mafiaObsMinimalChrome?: boolean
    /**
     * Show the gold "PRO" pill linking to billing. Driven by
     * `useProSubscription().isProActive` from the layout. Hidden when
     * Pro is inactive — non-paying users do not see the pill at all.
     */
    isProActive?: boolean
    proLinkTo?: RouteLocationRaw
    
    proLabel?: string
  }>(),
  {
    title: '',
    authLoading: false,
    isAuthenticated: false,
    userName: '',
    userAvatar: '',
    profileTo: undefined,
    accountTo: undefined,
    showHelpButton: false,
    helpLabel: '',
    compact: false,
    mafiaMode: false,
    roomCenterMode: false,
    showCoin: true,
    showAuth: true,
    mafiaObsMinimalChrome: false,
    isProActive: false,
    proLinkTo: undefined,
    proLabel: '',
  },
)

const emit = defineEmits<{
  login: []
  logout: []
  openHelp: []
  coinClick: []
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
    :class="{
      'app-landing-header--compact': compact,
      'app-landing-header--mafia': mafiaMode,
      'app-landing-header--room-center': roomCenterMode,
      'app-landing-header--mafia-obs': mafiaObsMinimalChrome,
    }"
    :aria-label="t('app.headerAria')"
  >
    <div ref="headerInner" class="app-landing-header__inner">
      <div class="app-landing-header__bar">
        <RouterLink class="app-landing-header__brand" :to="{ name: 'home' }" :aria-label="brandName">
          <img class="app-landing-header__logo" :src="logoSrc" alt="" width="42" height="42" />
        </RouterLink>
        <span v-if="$slots['brand-extra']" class="app-landing-header__brand-extra">
          <slot name="brand-extra" />
        </span>

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
          <slot name="actions-start" />

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

          <!--
            Gold "PRO" pill — visible only when the user has an active Pro
            subscription. Routes to /app/billing so users can see expiry
            and renew. Driven by `useProSubscription().isProActive` from
            AppShellLayout, so it appears within ~20s of activation and
            disappears within ~20s of cancel/expiry (global notifier tick).
          -->
          <RouterLink
            v-if="isProActive && proLinkTo"
            :to="proLinkTo"
            class="app-landing-header__pro"
            :title="proLabel || 'StreamAssist Pro'"
            :aria-label="proLabel || 'StreamAssist Pro'"
          >
            <span class="app-landing-header__pro-crown" aria-hidden="true">👑</span>
            <span class="app-landing-header__pro-label">PRO</span>
          </RouterLink>

          <button
            v-if="showCoin"
            type="button"
            class="app-landing-header__coin"
            :aria-label="t('app.openCoinHub')"
            @click="$emit('coinClick')"
          >
            <span class="app-landing-header__coin-label">{{ coinBalanceLabel }}</span>
            <span class="app-landing-header__coin-icon" aria-hidden="true">
              <img class="app-landing-header__coin-img" :src="coinIcon" alt="" width="44" height="44" />
            </span>
          </button>

          <div
            v-if="showAuth"
            class="app-landing-header__auth sa-glass-button"
            :class="{ 'app-landing-header__auth--profile': isAuthenticated }"
            :aria-busy="authLoading"
          >
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
                  v-if="accountTo"
                  class="app-landing-header__profile-menu-item"
                  :to="accountTo"
                  role="menuitem"
                  @click="closeProfileMenu"
                >
                  {{ t('app.openAccount') }}
                </RouterLink>
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
  box-sizing: border-box;
  padding-top: 0.6rem;
  padding-bottom: 0;
  padding-left: clamp(1.35rem, 1.6vw, 1.55rem);
  /* Outer inset: mirror left chrome + 4px; inner bar uses its own right padding. */
  padding-right: calc(clamp(1.35rem, 1.6vw, 1.55rem) + 4px);
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
  padding-top: 0;
  padding-bottom: 0;
  padding-left: calc(1.1rem - 5px);
  padding-right: 14px;
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
  padding-right: 4px;
}

.app-landing-header--compact .app-landing-header__title {
  font-size: 1.55rem;
  line-height: 1;
}

.app-landing-header--compact .app-landing-header__logo {
  width: 2.12rem;
  height: 2.12rem;
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
  grid-row: 1;
  display: inline-flex;
  align-items: center;
  justify-content: start;
  width: 3rem;
  height: 3.25rem;
  border-radius: 0;
}

.app-landing-header__brand-extra {
  position: relative;
  z-index: 1;
  grid-column: 1;
  grid-row: 1;
  display: inline-flex;
  align-items: center;
  justify-content: start;
  margin-left: 3rem;
  pointer-events: auto;
}

/* Games (mafia / eat-first call): tuck gear closer to the logo only here. */
.app-landing-header--mafia .app-landing-header__brand-extra {
  margin-left: calc(3rem - 10px);
}

/* Mafia OBS (`mode=view`): no pill chrome or title; logo stays in the same horizontal inset. */
.app-landing-header--mafia-obs .app-landing-header__bar {
  display: flex;
  flex-direction: row;
  align-items: center;
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.app-landing-header--mafia-obs .app-landing-header__bar::before {
  display: none;
}

.app-landing-header--mafia-obs .app-landing-header__center,
.app-landing-header--mafia-obs .app-landing-header__actions {
  display: none;
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


.app-landing-header__pro {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  height: 2.15rem;
  padding: 0 0.7rem 0 0.55rem;
  border-radius: 999px;
  text-decoration: none;
  font-weight: 800;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  color: #1a0f02;
  background: linear-gradient(135deg, #fff7ed, #fde68a 35%, #fbbf24 65%, #f59e0b);
  border: 1px solid rgba(255, 200, 80, 0.9);
  box-shadow:
    0 0 0 1px rgba(255, 220, 140, 0.35),
    0 0 22px rgba(255, 200, 80, 0.55),
    0 0 36px rgba(255, 160, 40, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
  transition:
    transform 0.2s ease,
    filter 0.2s ease,
    box-shadow 0.2s ease;
  animation: app-header-pro-pulse 3.2s ease-in-out infinite;
  flex-shrink: 0;
  white-space: nowrap;
}

.app-landing-header__pro:hover,
.app-landing-header__pro:focus-visible {
  transform: translateY(-1px);
  filter: brightness(1.06);
  box-shadow:
    0 0 0 1px rgba(255, 240, 200, 0.5),
    0 0 30px rgba(255, 220, 100, 0.75),
    0 0 50px rgba(255, 180, 60, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.app-landing-header__pro:focus-visible {
  outline: 2px solid rgba(255, 230, 160, 0.9);
  outline-offset: 2px;
}

.app-landing-header__pro-crown {
  display: inline-block;
  font-size: 0.92rem;
  line-height: 1;
  filter: drop-shadow(0 0 4px rgba(255, 220, 130, 0.55));
}

.app-landing-header__pro-label {
  display: inline-block;
  line-height: 1;
}

@keyframes app-header-pro-pulse {
  0%,
  100% {
    box-shadow:
      0 0 0 1px rgba(255, 220, 140, 0.35),
      0 0 22px rgba(255, 200, 80, 0.5),
      0 0 32px rgba(255, 160, 40, 0.26),
      inset 0 1px 0 rgba(255, 255, 255, 0.6);
  }
  50% {
    box-shadow:
      0 0 0 1px rgba(255, 240, 200, 0.45),
      0 0 32px rgba(255, 220, 110, 0.75),
      0 0 48px rgba(255, 180, 60, 0.42),
      inset 0 1px 0 rgba(255, 255, 255, 0.7);
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-landing-header__pro {
    animation: none;
    transition: filter 0.2s ease;
  }

  .app-landing-header__pro:hover,
  .app-landing-header__pro:focus-visible {
    transform: none;
  }
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
  cursor: pointer;
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

.app-landing-header__auth--profile {
  width: auto;
  min-width: 0;
}

.app-landing-header__auth--profile .app-landing-header__user {
  gap: 0.38rem;
  padding: 0 0.65rem 0 0.55rem;
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
  width: max-content;
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
  width: auto;
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

/*
 * Center the title text on the bar while keeping the room pill to its right:
 * the cluster is positioned by half-width, so nudge right by (room + gap) / 2.
 * Room pill width matches `.app-shell-call-join-room`.
 */
.app-landing-header--room-center .app-landing-header__center {
  gap: 8px;
  transform: translate(calc(-50% + (5.85rem + 8px) / 2), -50%);
}

.app-landing-header--mafia .app-landing-header__actions {
  gap: 8px;
  /*
   * Pull the whole right cluster left inside the bar only (same inset idea as
   * `.app-landing-header__inner` padding-top). Does not change bar border-box size.
   */
  margin-right: 0.6rem;
}

/* Mafia toggle+copy or Eat First copy: nudge host controls row 2px right (slot lives in AppShellLayout). */
.app-landing-header--mafia .app-landing-header__actions :deep(.app-shell-mafia-host-controls:first-child),
.app-landing-header--mafia .app-landing-header__actions :deep(.app-shell-mafia-copy:first-child) {
  margin-left: 2px;
}

.app-landing-header--mafia .app-landing-header__auth--profile .app-landing-header__user {
  box-sizing: border-box;
  padding-left: 0.6rem;
  padding-right: 0.6rem;
}

.app-landing-header--mafia .app-landing-header__auth-buttons {
  min-height: 2.35rem;
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
    padding-top: 0.45rem;
    padding-bottom: 0;
    padding-left: clamp(0.8rem, 2vw, 1.25rem);
    padding-right: calc(clamp(0.8rem, 2vw, 1.25rem) + 4px);
  }

  .app-landing-header--mafia .app-landing-header__actions {
    margin-right: 0.45rem;
  }

  .app-landing-header__bar {
    gap: 0.85rem;
    min-height: 4.4rem;
    padding-top: 0;
    padding-bottom: 0;
    padding-left: calc(1rem - 5px);
    padding-right: 14px;
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

  .app-landing-header--mafia .app-landing-header__brand-extra {
    margin-left: calc(3.2rem - 10px);
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

  .app-landing-header__auth--profile {
    min-width: 0;
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

  .app-landing-header--room-center .app-landing-header__center {
    position: absolute;
    left: 50%;
    top: 50%;
    justify-self: unset;
    max-width: min(42rem, calc(100vw - 8rem));
    gap: 8px;
    transform: translate(calc(-50% + (5.85rem + 8px) / 2), -50%);
  }

  .app-landing-header__title {
    font-size: 1.35rem;
    transform: none;
    pointer-events: auto;
  }
}

@media (max-width: 640px) {
  .app-landing-header__inner {
    padding-left: 0.65rem;
    padding-right: calc(0.65rem + 4px);
  }

  .app-landing-header__bar {
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.4rem;
    min-height: 3.5rem;
    padding-top: 0.45rem;
    padding-bottom: 0.45rem;
    padding-left: calc(0.55rem - 5px);
    padding-right: 14px;
    border-radius: 999px;
  }

  .app-landing-header--compact .app-landing-header__bar {
    min-height: 3.5rem;
  }

  .app-landing-header__brand {
    width: 2.45rem;
    height: 2.45rem;
  }

  .app-landing-header__logo {
    width: 2.1rem;
    height: 2.1rem;
  }

  .app-landing-header__brand-extra,
  .app-landing-header__center {
    display: none;
  }

  .app-landing-header__actions {
    grid-column: 2;
    justify-self: end;
    justify-content: flex-end;
    gap: 0.35rem;
    width: auto;
    max-width: 100%;
    margin-right: 0;
  }

  .app-landing-header__title {
    display: none;
  }

  .app-landing-header__help {
    width: 1.95rem;
    height: 1.95rem;
  }

  .app-landing-header__coin {
    min-height: 2rem;
    padding-left: 0.5rem;
    margin-right: 0;
    transform: none;
    gap: 0.22rem;
    font-size: 0.72rem;
  }

  .app-landing-header__coin-icon {
    width: 2rem;
    height: 2rem;
    margin: -0.1rem -0.1rem -0.1rem 0;
  }

  .app-landing-header__coin-label {
    display: inline-block;
    max-width: 3.8rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .app-landing-header__auth {
    min-width: 0;
    min-height: 2rem;
  }

  .app-landing-header__auth-buttons {
    min-height: 2rem;
    padding: 0.12rem 0.18rem;
  }

  .app-landing-header__auth--profile {
    min-width: 0;
  }

  .app-landing-header__auth-link {
    min-height: 1.72rem;
    padding-inline: 0.56rem;
    font-size: 0.72rem;
  }

  .app-landing-header__user {
    max-width: min(9rem, 46vw);
    min-height: 2rem;
    padding: 0 0.45rem 0 0.38rem;
    gap: 0.34rem;
  }

  .app-landing-header__avatar {
    width: 1.55rem;
    height: 1.55rem;
  }

  .app-landing-header__user-name {
    max-width: 100%;
    font-size: 0.76rem;
  }

  .app-landing-header--mafia .app-landing-header__actions {
    margin-right: 0.45rem;
  }

  .app-landing-header--mafia .app-landing-header__auth--profile .app-landing-header__user {
    padding-left: 0.45rem;
    padding-right: 0.45rem;
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
