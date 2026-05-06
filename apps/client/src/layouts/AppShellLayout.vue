<script setup lang="ts">
import '@/eat-first/style.css'
import '@/eat-first/styles/theme.css'
import { storeToRefs } from 'pinia'
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterView, useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppLandingHeader from '@/pages/app/components/AppHeader.vue'
import AppLandingFooter from '@/pages/app/components/AppFooter.vue'
import { eatViewFromRoute, useSeoApp, useTheme } from '@/eat-first'
import { hostControlChromeStore } from '@/eat-first/composables/hostControlChrome.js'
import { persistLocale, LOCALE_OPTIONS } from '@/eat-first/i18n'
import {
  dismissOnboardingTour,
  isOnboardingDismissed,
  resolveOnboardingTourKeyFromRoute,
} from '@/eat-first/utils/onboardingStorage.js'
import { useAuth } from '@/composables/useAuth'
import { eatFirstStreamViewFromRoute, EAT_FIRST_OBS_URL_TOAST_EVENT } from '@/composables/eatFirstCallStreamView'
import {
  MAFIA_OBS_URL_TOAST_EVENT,
  MAFIA_SETTINGS_TOAST_EVENT,
  mafiaViewQueryIsView,
} from '@/composables/mafiaStreamViewRoute'
import {
  CALL_ROOM_DROPDOWN_HOST_ID,
  CALL_ROOM_POPOVER_PANEL_ID,
  useCallRoomHeaderJoinStore,
} from '@/stores/callRoomHeaderJoin'
import { redirectAdminToControlIfAuthed } from '@/eat-first/router.js'
import {
  BRAND_LOGO_LIGHT_SVG,
  STREAM_APP_BRAND_NAME,
} from '@/eat-first/constants/brand.js'
import '@/eat-first/styles/host-chrome.css'
import LandingCloudBackdrop from '@/components/ui/LandingCloudBackdrop.vue'
import AppLandingFooterActions from '@/pages/app/components/AppLandingFooterActions.vue'
import '@/eat-first/styles/motion.css'
import { useCoinHubStore } from '@/stores/coinHub'
import { useStreamAuthModal } from '@/composables/useStreamAuthModal'
import { useProSubscription } from '@/composables/useProSubscription'
import type { AuthMode } from '@/types/authMode'
import { normalizeDisplayName } from 'call-core'
import { useEatFirstCallShellStore } from '@/stores/eatFirstCallShell'
import { useMafiaGameStore } from '@/stores/mafiaGame'
import type { BackgroundItem, MafiaBackgroundItem, MafiaEliminationBackground } from '@/utils/mafiaGameTypes'
import mafiaHeaderCopyIcon from '@/assets/mafia/ui/header-copy.svg'
import mafiaHeaderLogo from '@/assets/mafia/ui/header-logo.svg'
import mafiaHeaderSettingsIcon from '@/assets/mafia/ui/header-settings.svg'

useSeoApp()

const OnboardingTourModal = defineAsyncComponent({
  loader: () => import('@/eat-first/ui/organisms/OnboardingTourModal.vue'),
  delay: 100,
  timeout: 10000,
})

const route = useRoute()
const router = useRouter()
const { t, locale } = useI18n()
const callRoomHeaderJoin = useCallRoomHeaderJoinStore()
const auth = useAuth()
const { openStreamAuthModal } = useStreamAuthModal()



const { isProActive: isProActiveSubscription, expiresAt: proExpiresAt } = useProSubscription()
const proHeaderLinkTo = { path: '/app/billing' } as const
const proHeaderLabel = computed(() => {
  const iso = proExpiresAt.value
  if (!iso) return 'StreamAssist Pro'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'StreamAssist Pro'
  const formatted = d.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
  return `StreamAssist Pro · до ${formatted}`
})
const coinHub = useCoinHubStore()
const { balance: coinHubBalance } = storeToRefs(coinHub)
const eatFirstShell = useEatFirstCallShellStore()
const mafiaGame = useMafiaGameStore()
const {
  isMafiaHost: isCurrentMafiaHost,
  oldMafiaMode: mafiaHeaderOldMode,
  deadBackgrounds: mafiaDeadBackgrounds,
  activeBackgroundId: mafiaActiveBackgroundId,
  pageBackgrounds: mafiaPageBackgrounds,
  appHubPageBackgrounds,
  forcedPageBackgroundId: mafiaForcedPageBackgroundId,
} = storeToRefs(mafiaGame)
const canEatFirstHost = computed(() => {
  return auth.user.value?.role === 'admin' || auth.user.value?.permissions?.includes('EAT_FIRST_OPERATOR') === true
})
const { theme, setTheme } = useTheme()

const isEatRoute = computed(() => route.path.startsWith('/app/eat'))
const isHomeRoute = computed(() => route.name === 'home')
const isCallRoute = computed(() => route.name === 'call')
const isMafiaRoute = computed(() => route.name === 'mafia')
const isCoinHubRoute = computed(() => route.name === 'coin-hub')
const isNadrawRoute = computed(() => route.name === 'nadraw-show')
const isBetaAccessRoute = computed(() => route.name === 'beta-access')
const isAdminRoute = computed(() => String(route.name ?? '').startsWith('admin-'))
const isHeavyVisualRoute = computed(() => isHomeRoute.value)
const shellShowsCoinBalance = computed(() => showChrome.value)


const isNadleStreamRoute = computed(
  () =>
    route.name === 'nadle-streamer' ||
    route.name === 'app-streamer' ||
    route.name === 'nadraw-show',
)

const currentEatView = computed(() => (isEatRoute.value ? eatViewFromRoute(route) : 'call'))

const isEatFirstCallGameView = computed(() => route.name === 'eat' && currentEatView.value === 'call')

const showChrome = computed(() => !isEatRoute.value || currentEatView.value !== 'overlay')
const showFooter = computed(
  () => showChrome.value && route.meta.footer !== false && !isEatFirstCallGameView.value,
)

const shellPageBackgroundChoices = computed(() =>
  isHomeRoute.value ? appHubPageBackgrounds.value : mafiaPageBackgrounds.value,
)

/** Stable page key: query changes should not create an empty transition gap. */
const routeTransitionKey = computed(() => String(route.name ?? route.path))

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

const eatBrand = computed(() => (hostChromeOn.value ? t('app.brandHost') : t('game.title')))

const headerTitle = computed(() => (isEatRoute.value ? eatBrand.value : streamTitle.value))
const appLandingHeaderBrand = computed(() =>
  isHomeRoute.value ||
  isAdminRoute.value ||
  isCallRoute.value ||
  isMafiaRoute.value ||
  isCoinHubRoute.value ||
  isNadrawRoute.value ||
  isBetaAccessRoute.value ||
  isEatRoute.value
    ? 'Stream Assist'
    : 'NADLE',
)
const appLandingFooterBrand = 'Nad1ch'
const appLandingFeedbackHref = 'https://docs.google.com/forms/d/e/1FAIpQLSdlLcJTCl7VIufeRmeZHsMD2h08kwwCkHZVMmQBNuN2Z3930Q/viewform?usp=header'
const appLandingCoinHubRoute = { name: 'coin-hub' } satisfies RouteLocationRaw
const appLandingHeaderCompact = computed(() => !isHomeRoute.value)
const appLandingLocaleLabelByCode: Record<string, string> = {
  en: 'English',
  de: 'Deutsch',
  uk: 'Українська',
  pl: 'Polski',
}
const appLandingLocaleMenuOrder = ['en', 'de', 'uk', 'pl']
const appLandingLocaleMenuOptions = computed(() =>
  appLandingLocaleMenuOrder
    .map((code) => LOCALE_OPTIONS.find((o) => o.code === code))
    .filter((o): o is (typeof LOCALE_OPTIONS)[number] => Boolean(o))
    .map((o) => ({
      value: o.code,
      label: appLandingLocaleLabelByCode[o.code] ?? o.label,
    })),
)
const appLandingHeaderCoinBalanceLabel = computed(() => {
  if (!auth.isAuthenticated.value) {
    return '—'
  }
  return new Intl.NumberFormat(locale.value, { maximumFractionDigits: 0 }).format(coinHubBalance.value)
})
const appLandingHeaderUserName = computed(() => auth.user.value?.displayName ?? '')
const appLandingHeaderUserAvatar = computed(() => auth.user.value?.avatar ?? '')
const appLandingProfileTo = computed<RouteLocationRaw | undefined>(() =>
  auth.user.value?.role === 'admin' ? { name: 'admin-users' } : undefined,
)
const emailVerificationSuccessFromRoute = computed(() => firstQueryValue(route.query.emailVerified) === '1')
const footerYear = new Date().getFullYear()

const onboardingOpen = ref(false)
const onboardingTourKey = ref('')
const economyComingSoonOpen = ref(false)

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

function openAppLandingAuth(mode: AuthMode) {
  openStreamAuthModal(route.fullPath || '/app', mode)
}

function logoutAppLanding(): void {
  void auth.logout()
}

function openEconomyComingSoon(): void {
  economyComingSoonOpen.value = true
}

function closeEconomyComingSoon(): void {
  economyComingSoonOpen.value = false
}

function firstQueryValue(value: unknown): string {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : ''
  }
  return typeof value === 'string' ? value : ''
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
  [() => route.fullPath, () => auth.loaded.value, () => auth.user.value?.role, () => auth.user.value?.permissions?.join('|')],
  () => {
    if (!isEatRoute.value || !auth.loaded.value) return
    redirectAdminToControlIfAuthed(router, route, canEatFirstHost.value)
  },
  { immediate: true },
)

watch(() => route.fullPath, tryAutoOnboarding, { immediate: true })

watch([isMafiaRoute, isEatFirstCallGameView], ([onMafia, eatCall]) => {
  if (!onMafia && !eatCall) {
    mafiaSettingsOpen.value = false
  }
})

watch(
  [() => auth.isAuthenticated.value, () => shellShowsCoinBalance.value],
  ([authed, showsBalance]) => {
    if (authed && showsBalance) {
      void coinHub.loadSnapshot({ background: true })
    }
  },
  { immediate: true },
)

onMounted(() => {
  setTheme(theme.value)
  void auth.ensureAuthLoaded()
  document.addEventListener('pointerdown', onDocumentPointerDownForMafiaSettings, true)
  document.addEventListener('keydown', onDocumentKeydownCloseMafiaSettings, true)
  window.addEventListener('resize', syncMafiaSettingsPopoverPosition, { passive: true })
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDownForMafiaSettings, true)
  document.removeEventListener('keydown', onDocumentKeydownCloseMafiaSettings, true)
  window.removeEventListener('resize', syncMafiaSettingsPopoverPosition)
})


const isMafiaViewMode = computed(() => mafiaViewQueryIsView(route.query.mode))

function mafiaQueryAsStringRecord(
  q: (typeof route)['query'],
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, v] of Object.entries(q)) {
    if (v == null) continue
    const s = Array.isArray(v) ? v[0] : v
    if (typeof s !== 'string' || s.trim() === '') continue
    out[key] = s
  }
  return out
}

const mafiaHeaderHasRoom = computed(() => {
  if (route.name !== 'mafia') {
    return false
  }
  return Boolean(mafiaQueryAsStringRecord(route.query).room)
})

const mafiaHeaderShowHostControls = computed(() => isMafiaRoute.value && isCurrentMafiaHost.value)
const eatFirstHeaderStreamView = computed(() => eatFirstStreamViewFromRoute(route))
const eatFirstHeaderShowHostControls = computed(
  () =>
    isEatFirstCallGameView.value &&
    eatFirstShell.isEatFirstRoomHost &&
    !eatFirstHeaderStreamView.value,
)
const eatFirstHeaderHasGame = computed(() => {
  if (!isEatFirstCallGameView.value) return false
  const g = route.query.game
  return typeof g === 'string' && normalizeDisplayName(g).trim().length > 0
})
const callOrMafiaShowVisualSettings = computed(
  () => isCallRoute.value || isMafiaRoute.value || isEatFirstCallGameView.value,
)

const showEatFirstOrMafiaDeadBackgroundSettings = computed(
  () =>
    (isMafiaRoute.value && isCurrentMafiaHost.value) ||
    (isEatFirstCallGameView.value &&
      eatFirstShell.isEatFirstRoomHost &&
      !eatFirstHeaderStreamView.value),
)
/** Gear next to logo whenever the `/app` shell header is visible (including `/app` home). */
const shellShowsHeaderSettingsGear = computed(() => showChrome.value)
const mafiaHeaderObsCopyLabel = computed(() => 'copy')
const mafiaSettingsOpen = ref(false)
const mafiaSettingsButtonRef = ref<HTMLElement | null>(null)
const mafiaSettingsPopoverRef = ref<HTMLElement | null>(null)
const mafiaSettingsPopoverStyle = ref<Record<string, string>>({})
const MAFIA_BACKGROUND_UPLOAD_MAX_BYTES = 5 * 1024 * 1024
const MAFIA_BACKGROUND_UPLOAD_TYPES: ReadonlySet<string> = new Set(['image/png', 'image/jpeg', 'image/webp'])

function toggleMafiaMode(): void {
  mafiaGame.setOldMafiaMode(!mafiaHeaderOldMode.value)
}

function closeMafiaSettings(): void {
  mafiaSettingsOpen.value = false
}

function onShellSettingsLocaleChange(code: string): void {
  void persistLocale(code)
}

function syncMafiaSettingsPopoverPosition(): void {
  const anchor = mafiaSettingsButtonRef.value
  if (!anchor) {
    mafiaSettingsPopoverStyle.value = {}
    return
  }
  const rect = anchor.getBoundingClientRect()
  const margin = 8
  const width = Math.min(284, Math.max(200, window.innerWidth - margin * 2))
  const left = Math.min(
    Math.max(margin, rect.left),
    Math.max(margin, window.innerWidth - width - margin),
  )
  mafiaSettingsPopoverStyle.value = {
    left: `${Math.round(left)}px`,
    top: `${Math.round(rect.bottom + 8)}px`,
  }
}

function toggleMafiaSettings(): void {
  mafiaSettingsOpen.value = !mafiaSettingsOpen.value
  if (mafiaSettingsOpen.value) {
    void nextTick(syncMafiaSettingsPopoverPosition)
  }
}

function onDocumentPointerDownForMafiaSettings(ev: PointerEvent): void {
  if (!mafiaSettingsOpen.value) {
    return
  }
  const target = ev.target
  if (!(target instanceof Node)) {
    return
  }
  if (mafiaSettingsButtonRef.value?.contains(target) || mafiaSettingsPopoverRef.value?.contains(target)) {
    return
  }
  closeMafiaSettings()
}

function onDocumentKeydownCloseMafiaSettings(ev: KeyboardEvent): void {
  if (!mafiaSettingsOpen.value || ev.key !== 'Escape') {
    return
  }
  closeMafiaSettings()
}

function showMafiaSettingsToast(text: string): void {
  window.dispatchEvent(new CustomEvent(MAFIA_SETTINGS_TOAST_EVENT, { detail: { text } }))
}

function selectMafiaDeadBackground(backgroundId: string): void {
  mafiaGame.setActiveDeadBackgroundId(backgroundId)
}

function onMafiaBackgroundCardKeydown(ev: KeyboardEvent, backgroundId: string): void {
  if (ev.key !== 'Enter' && ev.key !== ' ') {
    return
  }
  ev.preventDefault()
  selectMafiaDeadBackground(backgroundId)
}

function deleteMafiaDeadBackground(background: MafiaBackgroundItem): void {
  if (background.type !== 'custom') {
    return
  }
  mafiaGame.deleteCustomDeadBackground(background.id)
}

function onMafiaDeadBackgroundFileChange(ev: Event): void {
  const input = ev.target
  if (!(input instanceof HTMLInputElement)) {
    return
  }
  const file = input.files?.[0]
  input.value = ''
  if (!file) {
    return
  }
  if (!MAFIA_BACKGROUND_UPLOAD_TYPES.has(file.type)) {
    showMafiaSettingsToast(t('mafiaPage.backgroundUploadInvalidType'))
    return
  }
  if (file.size >= MAFIA_BACKGROUND_UPLOAD_MAX_BYTES) {
    showMafiaSettingsToast(t('mafiaPage.backgroundUploadTooLarge'))
    return
  }
  try {
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      const result = reader.result
      if (typeof result !== 'string' || mafiaGame.addCustomDeadBackground(result) == null) {
        showMafiaSettingsToast(t('mafiaPage.backgroundUploadFailed'))
      }
    }, { once: true })
    reader.addEventListener('error', () => {
      showMafiaSettingsToast(t('mafiaPage.backgroundUploadFailed'))
    }, { once: true })
    reader.readAsDataURL(file)
  } catch {
    showMafiaSettingsToast(t('mafiaPage.backgroundUploadFailed'))
  }
}

function onMafiaPageBackgroundFileChange(ev: Event): void {
  const input = ev.target
  if (!(input instanceof HTMLInputElement)) {
    return
  }
  const file = input.files?.[0]
  input.value = ''
  if (!isHomeRoute.value && mafiaForcedPageBackgroundId.value != null && isMafiaRoute.value && !isCurrentMafiaHost.value) {
    showMafiaSettingsToast(t('mafiaPage.pageBackgroundForcedByHost'))
    return
  }
  if (!file) {
    return
  }
  if (!MAFIA_BACKGROUND_UPLOAD_TYPES.has(file.type)) {
    showMafiaSettingsToast(t('mafiaPage.backgroundUploadInvalidType'))
    return
  }
  if (file.size >= MAFIA_BACKGROUND_UPLOAD_MAX_BYTES) {
    showMafiaSettingsToast(t('mafiaPage.backgroundUploadTooLarge'))
    return
  }
  try {
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      const result = reader.result
      if (typeof result !== 'string') {
        showMafiaSettingsToast(t('mafiaPage.backgroundUploadFailed'))
        return
      }
      const ok = isHomeRoute.value
        ? mafiaGame.addCustomAppHubPageBackground(result)
        : mafiaGame.addCustomPageBackground(result, isCallRoute.value)
      if (ok == null) {
        showMafiaSettingsToast(t('mafiaPage.backgroundUploadFailed'))
      }
    }, { once: true })
    reader.addEventListener('error', () => {
      showMafiaSettingsToast(t('mafiaPage.backgroundUploadFailed'))
    }, { once: true })
    reader.readAsDataURL(file)
  } catch {
    showMafiaSettingsToast(t('mafiaPage.backgroundUploadFailed'))
  }
}

function previewStyleForMafiaBackground(background: MafiaBackgroundItem): Record<string, string> {
  if (background.type === 'custom') {
    return { backgroundImage: `url(${JSON.stringify(background.url)})` }
  }
  const preset = background.id.replace(/^preset-/, '')
  if (preset === 'red') {
    return { background: 'radial-gradient(circle at 50% 34%, rgb(127 29 29 / 0.9), rgb(24 8 12) 66%, #050205)' }
  }
  if (preset === 'violet') {
    return { background: 'radial-gradient(circle at 50% 32%, rgb(88 28 135 / 0.88), rgb(24 12 45) 62%, #07030f)' }
  }
  if (preset === 'gray') {
    return { background: 'radial-gradient(circle at 50% 32%, rgb(71 85 105 / 0.86), rgb(17 24 39) 62%, #030712)' }
  }
  return { background: 'linear-gradient(135deg, #030712, #2b2d31)' }
}

function styleForMafiaPageBackground(background: BackgroundItem): Record<string, string> {
  if (background.type === 'custom') {
    return { backgroundImage: `url(${JSON.stringify(background.url)})` }
  }
  if (background.id === 'preset-page-violet') {
    return {
      background:
        'radial-gradient(circle at 15% 12%, rgb(124 58 237 / 0.7), transparent 46%), radial-gradient(circle at 82% 78%, rgb(76 29 149 / 0.72), transparent 48%), #080214',
    }
  }
  if (background.id === 'preset-page-night') {
    return {
      background:
        'radial-gradient(circle at 72% 24%, rgb(30 64 175 / 0.52), transparent 42%), radial-gradient(circle at 20% 84%, rgb(76 29 149 / 0.45), transparent 45%), #020617',
    }
  }
  return { background: 'linear-gradient(135deg, #070211, #12051f)' }
}

function labelForMafiaBackground(background: MafiaBackgroundItem): string {
  if (background.type === 'custom') {
    return t('mafiaPage.backgroundCustomLabel')
  }
  const preset = background.id.replace(/^preset-/, '') as MafiaEliminationBackground
  return t(`mafiaPage.eliminationBackground.${preset}`)
}

function labelForMafiaPageBackground(background: BackgroundItem): string {
  if (background.type === 'custom') {
    return t('mafiaPage.backgroundCustomLabel')
  }
  if (background.type === 'default') {
    return t('mafiaPage.pageBackgroundDefault')
  }
  return background.id === 'preset-page-night'
    ? t('mafiaPage.pageBackgroundNight')
    : t('mafiaPage.pageBackgroundViolet')
}

const mafiaResolvedPageBackground = computed(() =>
  isHomeRoute.value ? mafiaGame.resolvedAppHubPageBackgroundItem() : mafiaGame.resolvedPageBackgroundItem(),
)
const mafiaPageBackgroundStyle = computed(() => {
  const background = mafiaResolvedPageBackground.value
  if (background.type === 'default') {
    return undefined
  }
  return styleForMafiaPageBackground(background)
})

function isMafiaBackgroundSelected(background: MafiaBackgroundItem): boolean {
  return mafiaActiveBackgroundId.value === background.id
}

function isMafiaPageBackgroundSelected(background: BackgroundItem): boolean {
  const resolved = isHomeRoute.value
    ? mafiaGame.resolvedAppHubPageBackgroundItem()
    : mafiaGame.resolvedPageBackgroundItem()
  return resolved.id === background.id
}

function isMafiaBackgroundDeleteVisible(background: MafiaBackgroundItem): boolean {
  return background.type === 'custom'
}

function isMafiaPageBackgroundDeleteVisible(background: BackgroundItem): boolean {
  return background.type === 'custom'
}

function onMafiaBackgroundDeleteClick(ev: MouseEvent, background: MafiaBackgroundItem): void {
  ev.stopPropagation()
  deleteMafiaDeadBackground(background)
}

function onMafiaBackgroundDeleteKeydown(ev: KeyboardEvent, background: MafiaBackgroundItem): void {
  if (ev.key !== 'Enter' && ev.key !== ' ') {
    return
  }
  ev.preventDefault()
  ev.stopPropagation()
  deleteMafiaDeadBackground(background)
}

function selectMafiaPageBackground(backgroundId: string): void {
  if (isHomeRoute.value) {
    mafiaGame.selectAppHubPageBackground(backgroundId)
    return
  }
  if (mafiaForcedPageBackgroundId.value != null && isMafiaRoute.value && !isCurrentMafiaHost.value) {
    showMafiaSettingsToast(t('mafiaPage.pageBackgroundForcedByHost'))
    return
  }
  mafiaGame.selectPageBackground(backgroundId, isCallRoute.value)
}

function onMafiaPageBackgroundCardKeydown(ev: KeyboardEvent, backgroundId: string): void {
  if (ev.key !== 'Enter' && ev.key !== ' ') {
    return
  }
  ev.preventDefault()
  selectMafiaPageBackground(backgroundId)
}

function deleteMafiaPageBackground(background: BackgroundItem): void {
  if (background.type !== 'custom') {
    return
  }
  if (isHomeRoute.value) {
    mafiaGame.deleteCustomAppHubPageBackground(background.id)
    return
  }
  mafiaGame.deleteCustomPageBackground(background.id, isCallRoute.value)
}

function onMafiaPageBackgroundDeleteClick(ev: MouseEvent, background: BackgroundItem): void {
  ev.stopPropagation()
  deleteMafiaPageBackground(background)
}

function onMafiaPageBackgroundDeleteKeydown(ev: KeyboardEvent, background: BackgroundItem): void {
  if (ev.key !== 'Enter' && ev.key !== ' ') {
    return
  }
  ev.preventDefault()
  ev.stopPropagation()
  deleteMafiaPageBackground(background)
}

function onMafiaForcePageBackgroundChange(ev: Event): void {
  const input = ev.target
  if (!(input instanceof HTMLInputElement)) {
    return
  }
  mafiaGame.setPageBackgroundForcedForRoom(input.checked, isCallRoute.value)
}

function isMafiaBackgroundActiveLabel(background: MafiaBackgroundItem): string {
  return isMafiaBackgroundSelected(background)
    ? t('mafiaPage.backgroundSelected')
    : t('mafiaPage.backgroundSelect')
}

function mafiaBackgroundAriaLabel(background: MafiaBackgroundItem): string {
  return `${labelForMafiaBackground(background)}. ${isMafiaBackgroundActiveLabel(background)}`
}

function mafiaPageBackgroundAriaLabel(background: BackgroundItem): string {
  return `${labelForMafiaPageBackground(background)}. ${
    isMafiaPageBackgroundSelected(background) ? t('mafiaPage.backgroundSelected') : t('mafiaPage.backgroundSelect')
  }`
}

function mafiaBackgroundDeleteAriaLabel(background: MafiaBackgroundItem): string {
  return t('mafiaPage.backgroundDeleteLabel', { name: labelForMafiaBackground(background) })
}

function mafiaPageBackgroundDeleteAriaLabel(background: BackgroundItem): string {
  return t('mafiaPage.backgroundDeleteLabel', { name: labelForMafiaPageBackground(background) })
}

function mafiaBackgroundUploadAriaLabel(): string {
  return t('mafiaPage.deadBackgroundUpload')
}

function mafiaBackgroundDeleteTitle(background: MafiaBackgroundItem): string {
  return mafiaBackgroundDeleteAriaLabel(background)
}

function mafiaBackgroundCardRole(background: MafiaBackgroundItem | BackgroundItem): 'option' {
  void background
  return 'option'
}

function mafiaBackgroundCardTabIndex(): number {
  return 0
}

function mafiaBackgroundCardAriaSelected(background: MafiaBackgroundItem): boolean {
  return isMafiaBackgroundSelected(background)
}

function mafiaBackgroundCardClass(background: MafiaBackgroundItem): Record<string, boolean> {
  return {
    'app-shell-mafia-bg-card--selected': isMafiaBackgroundSelected(background),
    'app-shell-mafia-bg-card--custom': background.type === 'custom',
  }
}

function mafiaPageBackgroundCardClass(background: BackgroundItem): Record<string, boolean> {
  return {
    'app-shell-mafia-bg-card--selected': isMafiaPageBackgroundSelected(background),
    'app-shell-mafia-bg-card--custom': background.type === 'custom',
  }
}

function mafiaBackgroundDeleteClass(): string {
  return 'app-shell-mafia-bg-card__delete'
}

function mafiaBackgroundUploadClass(): string {
  return 'app-shell-mafia-bg-card app-shell-mafia-bg-card--upload'
}

function mafiaBackgroundUploadInputId(): string {
  return 'app-shell-mafia-dead-background-upload'
}

function mafiaPageBackgroundUploadInputId(): string {
  return isHomeRoute.value ? 'app-shell-app-hub-page-bg-upload' : 'app-shell-mafia-page-background-upload'
}

function mafiaBackgroundUploadAccept(): string {
  return 'image/png,image/jpeg,image/webp'
}

async function copyMafiaObsViewUrl(): Promise<void> {
  if (route.name !== 'mafia') {
    return
  }
  const room = mafiaQueryAsStringRecord(route.query).room
  if (typeof room !== 'string' || room.length < 1) {
    return
  }
  const next = { ...mafiaQueryAsStringRecord(route.query), mode: 'view' as const }
  const viewUrl = `${window.location.origin}/app/mafia?${new URLSearchParams(next).toString()}`
  try {
    await navigator.clipboard.writeText(viewUrl)
  } catch {
    /* clipboard may be denied */
  }
  window.dispatchEvent(new CustomEvent(MAFIA_OBS_URL_TOAST_EVENT))
}

async function copyEatFirstCallObsUrl(): Promise<void> {
  if (!isEatFirstCallGameView.value) {
    return
  }
  const g = route.query.game
  const gameId = typeof g === 'string' ? normalizeDisplayName(g).trim() : ''
  if (!gameId) {
    return
  }
  const viewUrl = `${window.location.origin}/app/eat?${new URLSearchParams({ game: gameId, mode: 'view' }).toString()}`
  try {
    await navigator.clipboard.writeText(viewUrl)
  } catch {
    /* clipboard may be denied */
  }
  window.dispatchEvent(new CustomEvent(EAT_FIRST_OBS_URL_TOAST_EVENT))
}
</script>

<template>
  <div class="app-shell-layout eat-first-root page-stack" :data-theme="theme">
    <LandingCloudBackdrop
      v-if="isHeavyVisualRoute"
      class="app-shell-layout__backdrop"
      variant="app"
      :active="true"
    />
    <div
      v-if="showChrome && mafiaPageBackgroundStyle"
      class="app-shell-mafia-page-background"
      :style="mafiaPageBackgroundStyle"
      aria-hidden="true"
    />
    <div class="app-shell-layout__body app-layout">
      <AppLandingHeader
        v-if="showChrome"
        :auth-loading="!auth.loaded.value"
        :brand-name="appLandingHeaderBrand"
        :coin-balance-label="appLandingHeaderCoinBalanceLabel"
        :compact="appLandingHeaderCompact"
        :coin-hub-to="appLandingCoinHubRoute"
        :help-label="t('onboarding.openGuide')"
        :is-authenticated="auth.isAuthenticated.value"
        :is-pro-active="isProActiveSubscription"
        :pro-link-to="proHeaderLinkTo"
        :pro-label="proHeaderLabel"
        :logo-src="isMafiaRoute || isEatFirstCallGameView ? mafiaHeaderLogo : BRAND_LOGO_LIGHT_SVG"
        :mafia-mode="isMafiaRoute || isEatFirstCallGameView"
        :profile-to="appLandingProfileTo"
        :show-help-button="isEatRoute && Boolean(onboardingForRoute)"
        :show-coin="true"
        :title="headerTitle"
        :user-prefix="
          (isMafiaRoute && isCurrentMafiaHost) ||
          (isEatFirstCallGameView && eatFirstShell.isEatFirstRoomHost && !eatFirstHeaderStreamView)
            ? 'host'
            : ''
        "
        :user-avatar="appLandingHeaderUserAvatar"
        :user-name="appLandingHeaderUserName"
        @open-help="openOnboardingForCurrentRoute"
        @coin-click="openEconomyComingSoon"
        @login="openAppLandingAuth('login')"
        @logout="logoutAppLanding"
      >
        <template v-if="shellShowsHeaderSettingsGear" #brand-extra>
          <div class="app-shell-mafia-settings-wrap">
            <button
              ref="mafiaSettingsButtonRef"
              type="button"
              class="app-shell-mafia-settings"
              :title="t('app.shellSettings')"
              :aria-label="t('app.shellSettings')"
              :aria-expanded="mafiaSettingsOpen"
              aria-haspopup="menu"
              @click.stop="toggleMafiaSettings"
            >
              <img class="app-shell-mafia-settings__icon" :src="mafiaHeaderSettingsIcon" alt="" aria-hidden="true" />
            </button>
            <Teleport to="body">
            <div
              v-if="mafiaSettingsOpen"
              ref="mafiaSettingsPopoverRef"
              class="app-shell-mafia-settings-popover"
              :style="mafiaSettingsPopoverStyle"
              @click.stop
            >
              <div class="app-shell-mafia-settings-popover__locale-shell">
                <AppLandingFooterActions
                  mode="locale"
                  tone="glass"
                  :locale="locale"
                  :locale-options="appLandingLocaleMenuOptions"
                  popover-locale-stick
                  @update:locale="onShellSettingsLocaleChange"
                />
              </div>
              <p
                class="app-shell-mafia-settings-popover__title app-shell-mafia-settings-popover__title--page"
              >
                {{ t('mafiaPage.pageBackgroundTitle') }}
              </p>
              <label v-if="isMafiaRoute && isCurrentMafiaHost" class="app-shell-mafia-force-bg">
                <input
                  type="checkbox"
                  :checked="mafiaForcedPageBackgroundId != null"
                  @change="onMafiaForcePageBackgroundChange"
                />
                <span>{{ t('mafiaPage.pageBackgroundApplyAll') }}</span>
              </label>
              <div class="app-shell-mafia-bg-gallery" role="listbox" :aria-label="t('mafiaPage.pageBackgroundTitle')">
                <div
                  v-for="background in shellPageBackgroundChoices"
                  :key="background.id"
                  class="app-shell-mafia-bg-card"
                  :class="mafiaPageBackgroundCardClass(background)"
                  :role="mafiaBackgroundCardRole(background)"
                  :tabindex="mafiaBackgroundCardTabIndex()"
                  :aria-selected="isMafiaPageBackgroundSelected(background)"
                  :aria-label="mafiaPageBackgroundAriaLabel(background)"
                  @click="selectMafiaPageBackground(background.id)"
                  @keydown="onMafiaPageBackgroundCardKeydown($event, background.id)"
                >
                  <span class="app-shell-mafia-bg-card__preview" :style="styleForMafiaPageBackground(background)" />
                  <span class="app-shell-mafia-bg-card__label">{{ labelForMafiaPageBackground(background) }}</span>
                  <span
                    v-if="isMafiaPageBackgroundDeleteVisible(background)"
                    :class="mafiaBackgroundDeleteClass()"
                    role="button"
                    tabindex="0"
                    :title="mafiaPageBackgroundDeleteAriaLabel(background)"
                    :aria-label="mafiaPageBackgroundDeleteAriaLabel(background)"
                    @click="onMafiaPageBackgroundDeleteClick($event, background)"
                    @keydown="onMafiaPageBackgroundDeleteKeydown($event, background)"
                  >
                    ×
                  </span>
                </div>
                <label :class="mafiaBackgroundUploadClass()" :for="mafiaPageBackgroundUploadInputId()">
                  <span class="app-shell-mafia-bg-card__plus" aria-hidden="true">+</span>
                  <span class="app-shell-mafia-bg-card__label">{{ t('mafiaPage.pageBackgroundUpload') }}</span>
                  <input
                    :id="mafiaPageBackgroundUploadInputId()"
                    type="file"
                    :accept="mafiaBackgroundUploadAccept()"
                    :aria-label="t('mafiaPage.pageBackgroundUpload')"
                    @change="onMafiaPageBackgroundFileChange"
                  />
                </label>
              </div>
              <template v-if="callOrMafiaShowVisualSettings">
              <p
                v-if="showEatFirstOrMafiaDeadBackgroundSettings"
                class="app-shell-mafia-settings-popover__title"
              >
                {{ t('mafiaPage.eliminationBackgroundDefault') }}
              </p>
              <div
                v-if="showEatFirstOrMafiaDeadBackgroundSettings"
                class="app-shell-mafia-bg-gallery"
                role="listbox"
                :aria-label="t('mafiaPage.eliminationBackgroundDefault')"
              >
                <div
                  v-for="background in mafiaDeadBackgrounds"
                  :key="background.id"
                  class="app-shell-mafia-bg-card"
                  :class="mafiaBackgroundCardClass(background)"
                  :role="mafiaBackgroundCardRole(background)"
                  :tabindex="mafiaBackgroundCardTabIndex()"
                  :aria-selected="mafiaBackgroundCardAriaSelected(background)"
                  :aria-label="mafiaBackgroundAriaLabel(background)"
                  @click="selectMafiaDeadBackground(background.id)"
                  @keydown="onMafiaBackgroundCardKeydown($event, background.id)"
                >
                  <span class="app-shell-mafia-bg-card__preview" :style="previewStyleForMafiaBackground(background)" />
                  <span class="app-shell-mafia-bg-card__label">{{ labelForMafiaBackground(background) }}</span>
                  <span
                    v-if="isMafiaBackgroundDeleteVisible(background)"
                    :class="mafiaBackgroundDeleteClass()"
                    role="button"
                    tabindex="0"
                    :title="mafiaBackgroundDeleteTitle(background)"
                    :aria-label="mafiaBackgroundDeleteAriaLabel(background)"
                    @click="onMafiaBackgroundDeleteClick($event, background)"
                    @keydown="onMafiaBackgroundDeleteKeydown($event, background)"
                  >
                    ×
                  </span>
                </div>
                <label :class="mafiaBackgroundUploadClass()" :for="mafiaBackgroundUploadInputId()">
                  <span class="app-shell-mafia-bg-card__plus" aria-hidden="true">+</span>
                  <span class="app-shell-mafia-bg-card__label">{{ t('mafiaPage.deadBackgroundUpload') }}</span>
                  <input
                    :id="mafiaBackgroundUploadInputId()"
                    type="file"
                    :accept="mafiaBackgroundUploadAccept()"
                    :aria-label="mafiaBackgroundUploadAriaLabel()"
                    @change="onMafiaDeadBackgroundFileChange"
                  />
                </label>
              </div>
              </template>
            </div>
            </Teleport>
          </div>
        </template>
        <template v-if="isCallRoute || isMafiaRoute || isEatFirstCallGameView" #center>
          <div :id="CALL_ROOM_DROPDOWN_HOST_ID" class="app-shell-call-room-anchor">
            <button
              type="button"
              class="app-shell-call-join-room"
              :aria-expanded="callRoomHeaderJoin.roomPopoverOpen"
              aria-haspopup="dialog"
              :aria-controls="CALL_ROOM_POPOVER_PANEL_ID"
              @click.stop="callRoomHeaderJoin.toggleRoomPopover()"
            >
              {{ t('callPage.headerJoinRoom') }}
            </button>
          </div>
        </template>
        <template v-if="mafiaHeaderShowHostControls || eatFirstHeaderShowHostControls" #actions-start>
          <template v-if="mafiaHeaderShowHostControls">
            <button
              type="button"
              class="app-shell-mafia-toggle"
              :class="{ 'app-shell-mafia-toggle--new': !mafiaHeaderOldMode }"
              :aria-pressed="!mafiaHeaderOldMode"
              aria-label="old / new"
              title="old / new"
              @click="toggleMafiaMode"
            >
              <span>{{ mafiaHeaderOldMode ? 'old' : 'new' }}</span>
            </button>
            <button
              v-if="mafiaHeaderHasRoom"
              type="button"
              class="app-shell-mafia-copy"
              :class="{ 'stream-nav__link--active': isMafiaViewMode }"
              :title="mafiaHeaderObsCopyLabel"
              :aria-label="mafiaHeaderObsCopyLabel"
              @click="copyMafiaObsViewUrl"
            >
              <img class="app-shell-mafia-copy__icon" :src="mafiaHeaderCopyIcon" alt="" aria-hidden="true" />
              <span>{{ mafiaHeaderObsCopyLabel }}</span>
            </button>
          </template>
          <button
            v-if="eatFirstHeaderShowHostControls && eatFirstHeaderHasGame"
            type="button"
            class="app-shell-mafia-copy"
            :class="{ 'stream-nav__link--active': eatFirstHeaderStreamView }"
            :title="t('eatFirstCall.copyEatCallObs')"
            :aria-label="t('eatFirstCall.copyEatCallObs')"
            @click="copyEatFirstCallObsUrl"
          >
            <img class="app-shell-mafia-copy__icon" :src="mafiaHeaderCopyIcon" alt="" aria-hidden="true" />
            <span>{{ t('eatFirstCall.copyEatCallObs') }}</span>
          </button>
        </template>
      </AppLandingHeader>

      <main class="app-shell-main" :class="{ 'app-shell-main--full': !showChrome }">
        <div
          class="app-shell-main__viewport"
          :class="{
            'app-shell-main__viewport--chrome': showChrome,
            'app-shell-main__viewport--nadle': isNadleStreamRoute,
          }"
        >
          <div class="app-shell-route-stack">
            <RouterView v-slot="{ Component }">
              <Transition name="route-soft">
                <component :is="Component" v-if="Component" :key="routeTransitionKey" />
              </Transition>
            </RouterView>
          </div>
        </div>
      </main>

      <AppLandingFooter
        v-if="showFooter"
        :brand-name="appLandingFooterBrand"
        :feedback-href="appLandingFeedbackHref"
        :locale="locale"
        :locale-options="appLandingLocaleMenuOptions"
        :year="footerYear"
        @update:locale="persistLocale"
      />

      <OnboardingTourModal
        v-if="isEatRoute"
        v-model:open="onboardingOpen"
        :tour-key="onboardingTourKey"
        @dismiss-save="onOnboardingDismissSave"
      />

      <p v-if="emailVerificationSuccessFromRoute" class="app-shell-email-status" role="status">
        Email verified. Your account email is now verified.
      </p>

      <Teleport to="body">
        <div
          v-if="economyComingSoonOpen"
          class="app-shell-economy-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="app-shell-economy-modal-title"
          @click.self="closeEconomyComingSoon"
        >
          <div class="app-shell-economy-modal__card">
            <button
              type="button"
              class="app-shell-economy-modal__close"
              aria-label="Close"
              title="Close"
              @click="closeEconomyComingSoon"
            >
              ×
            </button>
            <p class="app-shell-economy-modal__eyebrow">Economy</p>
            <h2 id="app-shell-economy-modal-title">Coming soon</h2>
            <p>Coin economy is being prepared. Your balance is visible for now, and actions will open soon.</p>
          </div>
        </div>
      </Teleport>
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

.app-shell-layout__backdrop {
  position: fixed;
  inset: 0;
  z-index: 0;
}

.app-shell-mafia-page-background {
  position: fixed;
  inset: 0;
  z-index: 0;
  background-position: center;
  background-size: cover;
  pointer-events: none;
}

.app-shell-layout__body {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.app-shell-main {
  --app-shell-content-x: clamp(1.35rem, 1.6vw, 1.55rem);
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.app-shell-main__viewport {
  box-sizing: border-box;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.app-shell-main__viewport--chrome {
  padding-inline: var(--app-shell-content-x);
}

.app-shell-main--full {
  flex: 1;
  min-height: 100vh;
}

.app-shell-email-status {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 12000;
  max-width: min(360px, calc(100vw - 2rem));
  margin: 0;
  padding: 0.72rem 0.9rem;
  border: 1px solid color-mix(in srgb, #22c55e 45%, var(--border-subtle, #334155));
  border-radius: 14px;
  background: color-mix(in srgb, #22c55e 13%, var(--bg-card-soft, rgb(15 23 42 / 0.94)));
  color: #bbf7d0;
  box-shadow: 0 12px 32px rgb(0 0 0 / 0.28);
  font-family: var(--app-home-ui, var(--sa-font-main, system-ui), sans-serif);
  font-size: 0.9rem;
  line-height: 1.35;
}

.app-shell-economy-modal {
  position: fixed;
  inset: 0;
  z-index: 13000;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgb(3 7 18 / 0.56);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
}

.app-shell-economy-modal__card {
  position: relative;
  box-sizing: border-box;
  width: min(420px, 100%);
  padding: 1.35rem;
  border: 1px solid color-mix(in srgb, #f59e0b 42%, rgb(255 255 255 / 0.16));
  border-radius: 20px;
  background:
    radial-gradient(circle at 80% 0%, rgb(245 158 11 / 0.18), transparent 42%),
    rgb(18 8 34 / 0.96);
  color: #f8fafc;
  box-shadow: 0 24px 60px rgb(0 0 0 / 0.42);
  text-align: center;
}

.app-shell-economy-modal__card h2 {
  margin: 0;
  color: #ffda44;
  font-family: var(--app-home-display, var(--sa-font-display, system-ui, sans-serif));
  font-size: clamp(1.8rem, 6vw, 2.6rem);
  font-weight: 400;
  font-variation-settings: 'YEAR' 1979;
  text-transform: uppercase;
}

.app-shell-economy-modal__card p {
  margin: 0.65rem 0 0;
  color: rgb(248 250 252 / 0.78);
  line-height: 1.45;
}

.app-shell-economy-modal__eyebrow {
  color: #ffda44 !important;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.app-shell-economy-modal__close {
  position: absolute;
  top: 0.7rem;
  right: 0.7rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.08);
  color: rgb(255 255 255 / 0.9);
  cursor: pointer;
  font-size: 1.35rem;
  line-height: 1;
}


.app-shell-route-stack {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.app-shell-route-stack :deep(> *) {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
}

.app-shell-route-stack :deep(.route-soft-enter-active),
.app-shell-route-stack :deep(.route-soft-leave-active) {
  transition: opacity 0.2s ease;
}

.app-shell-route-stack :deep(.route-soft-enter-active) {
  position: relative;
  z-index: 0;
}

.app-shell-route-stack :deep(.route-soft-leave-active) {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}

.app-shell-route-stack :deep(.route-soft-enter-from),
.app-shell-route-stack :deep(.route-soft-leave-to) {
  opacity: 0;
}

.app-shell-route-stack :deep(.route-soft-enter-to),
.app-shell-route-stack :deep(.route-soft-leave-from) {
  opacity: 1;
}

.app-shell-stream-brand__mark-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  border-radius: 0;
  border: none;
  background: transparent;
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
  background: transparent;
  font-family: var(--font-display, var(--sa-font-display));
  font-size: 0.8rem;
  font-weight: 800;
  color: var(--text-heading, var(--sa-color-text-main));
}

.app-shell-header__stream-center {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.45rem 0.65rem;
  max-width: 100%;
  min-width: 0;
}

.app-shell-call-room-anchor {
  position: relative;
  z-index: 120;
  display: inline-flex;
  align-items: center;
  max-width: 100%;
}

.app-shell-call-join-room {
  flex-shrink: 0;
  margin: 0;
  padding: 0.32rem 0.72rem;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--sa-color-primary, #a78bfa) 55%, var(--sa-color-border, #334155));
  background: color-mix(in srgb, var(--sa-color-primary, #a78bfa) 38%, rgb(15 16 20 / 0.5));
  color: var(--sa-color-text-on-primary, #f8fafc);
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  cursor: pointer;
  line-height: 1.2;
  font-family: inherit;
}

.app-shell-call-join-room:hover:not(:disabled) {
  filter: brightness(1.08);
}

.app-shell-call-join-room:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}

@keyframes app-shell-mafia-settings-spin {
  to {
    transform: rotate(360deg);
  }
}

.app-shell-mafia-settings,
.app-shell-mafia-toggle,
.app-shell-mafia-copy {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 33px;
  color: #fff;
  cursor: pointer;
  font-family: var(--app-home-display, var(--sa-font-display, system-ui, sans-serif));
  font-size: 10px;
  font-weight: 400;
  font-variation-settings: 'YEAR' 1979;
  line-height: 1;
  text-transform: lowercase;
  letter-spacing: 0;
  transition:
    filter 0.16s ease,
    transform 0.16s ease;
}

.app-shell-mafia-settings:hover,
.app-shell-mafia-toggle:hover,
.app-shell-mafia-copy:hover {
  filter: brightness(1.08);
}

.app-shell-mafia-settings:focus-visible,
.app-shell-mafia-toggle:focus-visible,
.app-shell-mafia-copy:focus-visible {
  outline: 2px solid rgb(255 255 255 / 0.8);
  outline-offset: 2px;
}

.app-shell-mafia-settings {
  width: 31px;
  height: 31px;
  background: transparent;
}

.app-shell-mafia-settings-wrap {
  position: relative;
  display: inline-flex;
}

.app-shell-mafia-settings__icon {
  display: block;
  width: 31px;
  height: 31px;
  object-fit: contain;
  transform-origin: center;
}

.app-shell-mafia-settings:hover .app-shell-mafia-settings__icon,
.app-shell-mafia-settings:focus-visible .app-shell-mafia-settings__icon {
  animation: app-shell-mafia-settings-spin 0.85s linear infinite;
}

.app-shell-mafia-settings-popover {
  position: fixed;
  z-index: 12080;
  box-sizing: border-box;
  width: min(284px, calc(100vw - 16px));
  padding: 10px 10px;
  overflow: visible;
  border: 1px solid rgb(255 255 255 / 0.12);
  border-radius: 12px;
  background: rgb(18 8 34 / 0.94);
  box-shadow: 0 14px 32px rgb(0 0 0 / 0.4);
}

.app-shell-mafia-settings-popover__locale-shell {
  box-sizing: border-box;
  width: 100%;
  margin-bottom: 8px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgb(255 255 255 / 0.1);
}

.app-shell-mafia-settings-popover__locale-shell :deep(.app-landing-footer-actions) {
  justify-content: center;
}

.app-shell-mafia-settings-popover__locale-shell :deep(.app-landing-footer-actions--locale),
.app-shell-mafia-settings-popover__locale-shell :deep(.app-landing-footer-actions__locale) {
  width: 100%;
  max-width: 100%;
}

.app-shell-mafia-settings-popover__title {
  margin: 0 24px 8px 0;
  color: rgb(255 255 255 / 0.82);
  font-family: var(--app-home-ui, var(--sa-font-main, system-ui), sans-serif);
  font-size: 11px;
  line-height: 1.2;
}

.app-shell-mafia-settings-popover__title--page {
  margin-top: 8px;
}

.app-shell-mafia-force-bg {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0 0 8px;
  color: rgb(255 255 255 / 0.8);
  font-family: var(--app-home-ui, var(--sa-font-main, system-ui), sans-serif);
  font-size: 10px;
  line-height: 1.2;
  cursor: pointer;
}

.app-shell-mafia-force-bg input {
  width: 13px;
  height: 13px;
  margin: 0;
  accent-color: #8b5cf6;
}

.app-shell-mafia-bg-gallery {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.app-shell-mafia-bg-card {
  position: relative;
  box-sizing: border-box;
  min-width: 0;
  min-height: 74px;
  padding: 5px;
  border: 1px solid rgb(255 255 255 / 0.14);
  border-radius: 10px;
  background: rgb(255 255 255 / 0.06);
  color: #fff;
  cursor: pointer;
  user-select: none;
  transform: translateY(0) scale(1);
  transition:
    background 0.16s ease,
    border-color 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.16s ease;
}

.app-shell-mafia-bg-card:hover {
  border-color: rgb(255 255 255 / 0.34);
  background: rgb(255 255 255 / 0.1);
  transform: translateY(-1px) scale(1.015);
  box-shadow: 0 8px 16px rgb(0 0 0 / 0.18);
}

.app-shell-mafia-bg-card:focus-visible,
.app-shell-mafia-bg-card--selected {
  outline: none;
  border-color: rgb(255 255 255 / 0.92);
  box-shadow:
    inset 0 0 0 1px rgb(255 255 255 / 0.26),
    0 0 12px rgb(168 85 247 / 0.22);
}

.app-shell-mafia-bg-card__preview {
  display: block;
  height: 44px;
  border-radius: 7px;
  background-color: #050205;
  background-position: center;
  background-size: cover;
}

.app-shell-mafia-bg-card__label {
  display: block;
  max-width: 100%;
  margin-top: 5px;
  overflow: hidden;
  color: rgb(255 255 255 / 0.84);
  font-family: var(--app-home-ui, var(--sa-font-main, system-ui), sans-serif);
  font-size: 10px;
  line-height: 1.1;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-shell-mafia-bg-card__delete {
  position: absolute;
  top: 2px;
  right: 2px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: rgb(0 0 0 / 0.62);
  color: #fff;
  cursor: pointer;
  font-size: 15px;
  line-height: 1;
  transition:
    background 0.16s ease,
    transform 0.16s ease;
}

.app-shell-mafia-bg-card__delete:hover {
  background: rgb(169 45 47 / 0.82);
  transform: scale(1.08);
}

.app-shell-mafia-bg-card__delete:focus-visible {
  outline: 2px solid rgb(255 255 255 / 0.82);
  outline-offset: 1px;
}

.app-shell-mafia-bg-card--upload {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-style: dashed;
}

.app-shell-mafia-bg-card__plus {
  color: rgb(255 255 255 / 0.92);
  font-size: 24px;
  line-height: 1;
}

@media (prefers-reduced-motion: reduce) {
  .app-shell-mafia-bg-card,
  .app-shell-mafia-bg-card__delete {
    transition: none;
  }

  .app-shell-mafia-bg-card:hover,
  .app-shell-mafia-bg-card__delete:hover {
    transform: none;
  }
}

.app-shell-mafia-bg-card--upload input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.app-shell-mafia-toggle {
  position: relative;
  width: 67px;
  height: 31px;
  overflow: hidden;
  background: rgb(139 92 246 / 0.14);
  transform: scale(1);
  transform-origin: center;
  transition:
    background 0.28s ease,
    transform 0.24s cubic-bezier(0.22, 1, 0.36, 1);
}

.app-shell-mafia-toggle:hover {
  transform: scale(1.025);
}

.app-shell-mafia-toggle:active {
  transform: scale(0.985);
}

.app-shell-mafia-toggle::before {
  content: '';
  position: absolute;
  left: 2px;
  top: 2px;
  width: 63px;
  height: 27px;
  border-radius: 15.535px;
  background: rgb(221 35 35 / 0.09);
  transition: background 0.28s ease;
}

.app-shell-mafia-toggle::after {
  content: '';
  position: absolute;
  left: 2px;
  top: 2px;
  width: 27px;
  height: 27px;
  border-radius: 15.535px;
  background: rgb(255 13 13 / 0.22);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.08),
    0 4px 10px rgb(0 0 0 / 0.16);
  transition:
    background 0.28s ease,
    box-shadow 0.28s ease,
    transform 0.34s cubic-bezier(0.22, 1.28, 0.36, 1);
}

.app-shell-mafia-toggle--new::before {
  background: rgb(100 246 92 / 0.14);
}

.app-shell-mafia-toggle--new::after {
  background: rgb(100 246 92 / 0.22);
  transform: translateX(36px);
}

.app-shell-mafia-toggle span {
  position: relative;
  z-index: 1;
  transform: translateX(12px);
  transition:
    color 0.24s ease,
    transform 0.34s cubic-bezier(0.22, 1.28, 0.36, 1);
}

.app-shell-mafia-toggle--new span {
  transform: translateX(-12px);
}

.app-shell-mafia-copy {
  position: relative;
  width: 76px;
  height: 31px;
  justify-content: flex-start;
  padding-left: 8px;
  background: rgb(139 92 246 / 0.14);
}

.app-shell-mafia-copy__icon {
  position: absolute;
  right: 6px;
  top: 5px;
  display: block;
  width: 21px;
  height: 21px;
  object-fit: contain;
}


.app-shell-header__stream-center .stream-nav__link {
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
  flex-shrink: 0;
}

.app-shell-header__stream-center .stream-nav__link:hover,
.app-shell-header__stream-center .stream-nav__link.stream-nav__link--active {
  border-color: var(--border-strong, var(--sa-color-primary-border));
  color: var(--text-title, var(--sa-color-primary));
}

.app-shell-header__stream-center .stream-nav__link:focus-visible {
  outline: 2px solid var(--border-cyan-strong, var(--sa-color-primary));
  outline-offset: 2px;
}

.app-shell-header__stream-center .stream-nav__link--btn {
  cursor: pointer;
  font: inherit;
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

@media (max-width: 1200px) {
  .app-shell-main {
    --app-shell-content-x: clamp(0.8rem, 2vw, 1.25rem);
  }
}

@media (max-width: 640px) {
  .app-shell-main {
    --app-shell-content-x: 0.65rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-shell-mafia-settings:hover .app-shell-mafia-settings__icon,
  .app-shell-mafia-settings:focus-visible .app-shell-mafia-settings__icon {
    animation: none;
  }
}
</style>
