<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppHeader from '@/components/ui/AppHeader.vue'
import AppFooter from '@/components/ui/AppFooter.vue'
import AppShellStreamNav from '@/components/ui/AppShellStreamNav.vue'
import AppShellChromeToolbar from '@/components/ui/AppShellChromeToolbar.vue'
import AppHeaderToolbar from '@/eat-first/ui/organisms/AppHeaderToolbar.vue'
import HostControlChromeBar from '@/eat-first/components/showdesk/HostControlChromeBar.vue'
import OnboardingTourModal from '@/eat-first/ui/organisms/OnboardingTourModal.vue'
import { useTheme } from '@/eat-first/composables/useTheme.js'
import { hostControlChromeStore } from '@/eat-first/composables/hostControlChrome.js'
import { persistLocale, LOCALE_OPTIONS } from '@/eat-first/i18n'
import { eatViewFromRoute } from '@/eat-first/eatFirstRouteUtils.js'
import {
  dismissOnboardingTour,
  isOnboardingDismissed,
  resolveOnboardingTourKeyFromRoute,
} from '@/eat-first/utils/onboardingStorage.js'
import { redirectAdminToControlIfAuthed } from '@/eat-first/router.js'
import {
  BRAND_LOGO_COMPACT_PNG,
  BRAND_LOGO_PNG,
  BRAND_LOGO_SVG_FALLBACK,
  STREAM_APP_BRAND_NAME,
} from '@/eat-first/constants/brand.js'
import '@/eat-first/styles/host-chrome.css'
import PurpleLightningBackdrop from '@/components/ui/PurpleLightningBackdrop.vue'

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const { theme, setTheme, toggleTheme } = useTheme()

const isEatRoute = computed(() => route.path.startsWith('/eat'))

const currentEatView = computed(() => (isEatRoute.value ? eatViewFromRoute(route) : 'join'))

const showChrome = computed(() => !isEatRoute.value || currentEatView.value !== 'overlay')

const streamTitle = computed(() => {
  void locale.value
  const key = route.meta.appTitleKey
  if (key === 'routes.streamAssist') {
    return STREAM_APP_BRAND_NAME
  }
  if (typeof key === 'string' && key.length > 0) {
    return t(key)
  }
  const m = route.meta.appTitle
  if (typeof m === 'string' && m.length > 0) {
    return m
  }
  return STREAM_APP_BRAND_NAME
})

const hostChromeOn = computed(() => hostControlChromeStore.active === true)

const votingGlow = computed(() =>
  Boolean(
    (hostControlChromeStore.gameRoom as { voting?: { active?: boolean } } | null | undefined)?.voting
      ?.active,
  ),
)

const eatBrand = computed(() => (hostChromeOn.value ? t('app.brandHost') : t('game.title')))

const headerTitle = computed(() => (isEatRoute.value ? eatBrand.value : streamTitle.value))

const eatHeaderClass = computed(() => ({
  'app-shell-header--host': hostChromeOn.value,
  'app-shell-header--vote-on': votingGlow.value,
}))

const localeMenuOptions = LOCALE_OPTIONS.map((o) => ({ value: o.code, label: o.label }))
const themeIcon = computed(() => (theme.value === 'dark' ? '☀️' : '🌙'))
const themeLabel = computed(() => (theme.value === 'dark' ? t('app.themeLight') : t('app.themeDark')))
const footerYear = new Date().getFullYear()

const streamShellBrandImg = ref(BRAND_LOGO_PNG)

function onStreamShellBrandImgError() {
  if (streamShellBrandImg.value === BRAND_LOGO_PNG) {
    streamShellBrandImg.value = BRAND_LOGO_COMPACT_PNG
    return
  }
  if (streamShellBrandImg.value === BRAND_LOGO_COMPACT_PNG) {
    streamShellBrandImg.value = BRAND_LOGO_SVG_FALLBACK
    return
  }
  streamShellBrandImg.value = ''
}

const streamBrandFallbackLetter = computed(() => {
  const s = String(headerTitle.value ?? '').trim()
  return (s[0] ?? 'S').toUpperCase()
})

const onboardingOpen = ref(false)
const onboardingTourKey = ref('')

const onboardingForRoute = computed(() => {
  if (!isEatRoute.value) return ''
  return resolveOnboardingTourKeyFromRoute(
    route as { path: string; query: Record<string, string | string[] | undefined | null> },
  )
})

function openOnboardingForCurrentRoute() {
  const k = onboardingForRoute.value
  if (!k) return
  onboardingTourKey.value = k
  onboardingOpen.value = true
}

function tryAutoOnboarding() {
  if (!isEatRoute.value) return
  const k = onboardingForRoute.value
  if (!k || isOnboardingDismissed(k)) return
  nextTick(() => {
    const again = onboardingForRoute.value
    if (!again || again !== k || isOnboardingDismissed(k)) return
    onboardingTourKey.value = k
    onboardingOpen.value = true
  })
}

function onOnboardingDismissSave() {
  const k = onboardingTourKey.value
  if (k) dismissOnboardingTour(k)
}

watch(
  () => route.fullPath,
  () => {
    if (isEatRoute.value) {
      redirectAdminToControlIfAuthed(router, route)
    }
  },
  { immediate: true },
)

watch(() => route.fullPath, tryAutoOnboarding, { immediate: true })

onMounted(() => {
  setTheme(theme.value)
})
</script>

<template>
  <div class="app-shell-layout eat-first-root page-stack" :data-theme="theme">
    <PurpleLightningBackdrop :light="theme === 'light'" />
    <div class="app-shell-layout__body app-layout">
      <AppHeader
        v-if="showChrome"
        :header-class="isEatRoute ? eatHeaderClass : undefined"
        :title="headerTitle"
      >
        <template v-if="isEatRoute" #brand>
          <RouterLink
            class="app-shell-brand app-shell-brand--with-mark app-shell-stream-brand"
            :to="{ name: 'home' }"
            :title="headerTitle"
            :aria-label="`${t('app.navHome')} · ${headerTitle}`"
          >
            <span v-if="streamShellBrandImg" class="app-shell-stream-brand__mark-wrap">
              <img
                class="app-shell-stream-brand__mark"
                :src="streamShellBrandImg"
                width="22"
                height="22"
                alt=""
                decoding="async"
                fetchpriority="low"
                @error="onStreamShellBrandImgError"
              />
            </span>
            <span v-else class="app-shell-stream-brand__mark-fallback" aria-hidden="true">{{
              streamBrandFallbackLetter
            }}</span>
            <span class="app-shell-brand__title app-shell-stream-brand__title">{{ headerTitle }}</span>
          </RouterLink>
        </template>
        <template #start>
          <AppShellStreamNav />
        </template>
        <template v-if="!isEatRoute" #center>
          <RouterLink
            class="app-shell-stream-centered-title"
            :to="{ name: 'home' }"
            :title="headerTitle"
            :aria-label="`${t('app.navHome')} · ${headerTitle}`"
          >
            {{ headerTitle }}
          </RouterLink>
        </template>
        <template #end>
          <AppHeaderToolbar
            v-if="isEatRoute"
            :locale-menu-options="localeMenuOptions"
            :model-locale="locale"
            :theme-icon="themeIcon"
            :theme-label="themeLabel"
            :show-onboarding-guide="Boolean(onboardingForRoute)"
            @update:locale="persistLocale"
            @toggle-theme="toggleTheme"
            @open-onboarding="openOnboardingForCurrentRoute"
          />
          <AppShellChromeToolbar v-else />
        </template>
        <template v-if="isEatRoute && hostChromeOn" #below>
          <div class="app-shell-header__host-stack">
            <p
              v-if="hostControlChromeStore.summaryLine"
              class="app-shell-host-summary"
              role="status"
              :title="hostControlChromeStore.summaryLine"
            >
              <span class="app-shell-host-summary__inner">{{ hostControlChromeStore.summaryLine }}</span>
            </p>
            <HostControlChromeBar />
          </div>
        </template>
      </AppHeader>

      <main class="app-shell-main" :class="{ 'app-shell-main--full': !showChrome }">
        <div
          class="app-shell-main__viewport"
          :class="{ 'app-shell-main__viewport--chrome': showChrome }"
        >
          <RouterView />
        </div>
      </main>

      <AppFooter v-if="showChrome" :year="footerYear" />

      <OnboardingTourModal
        v-if="isEatRoute"
        v-model:open="onboardingOpen"
        :tour-key="onboardingTourKey"
        @dismiss-save="onOnboardingDismissSave"
      />
    </div>
  </div>
</template>

<style scoped>
.page-stack {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-shell-layout {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.app-shell-layout__body {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.app-shell-main--full {
  flex: 1;
  min-height: 100vh;
}

.app-shell-stream-brand__mark-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0.12rem;
  border-radius: 9px;
  border: 1px solid var(--border-subtle, var(--sa-color-border));
  background: var(--logo-pad-bg, color-mix(in srgb, var(--sa-color-primary) 28%, var(--sa-color-bg-deep)));
  line-height: 0;
  box-sizing: border-box;
}

.app-shell-stream-brand__mark {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.app-shell-stream-brand__mark-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 9px;
  border: 1px solid var(--border-subtle, var(--sa-color-border));
  background: var(--logo-pad-bg, color-mix(in srgb, var(--sa-color-primary) 28%, var(--sa-color-bg-deep)));
  font-family: var(--font-display, var(--sa-font-display));
  font-size: 0.8rem;
  font-weight: 800;
  color: var(--text-heading, var(--sa-color-text-main));
}

@media (max-width: 420px) {
  .app-shell-stream-brand__title {
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
}
</style>
