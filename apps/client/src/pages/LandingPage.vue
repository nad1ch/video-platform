<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import { useI18n } from 'vue-i18n'
import twitchBrowseIllustration from '@/assets/landing/twitch-browse-illustration.svg'
import LandingCloudBackdrop from '@/components/ui/LandingCloudBackdrop.vue'
import AppFullPageLoader from '@/components/ui/AppFullPageLoader.vue'
import AppLandingFooterActions from '@/pages/app/components/AppLandingFooterActions.vue'
import AppGamesSection from '@/pages/app/components/AppGamesSection.vue'
import EconomySlotBanner from '@/pages/app/components/EconomySlotBanner.vue'
import { useAuth } from '@/composables/useAuth'
import { useLandingCosmicParallax } from '@/composables/useLandingCosmicParallax'
import avatarBeanieBody from '@/assets/landing/video-call/avatar-beanie-body.svg'
import avatarBeanieExpression from '@/assets/landing/video-call/avatar-beanie-expression.svg'
import avatarBeanieGlasses from '@/assets/landing/video-call/avatar-beanie-glasses.svg'
import avatarBeanieHat from '@/assets/landing/video-call/avatar-beanie-hat.svg'
import avatarBeanieHead from '@/assets/landing/video-call/avatar-beanie-head.svg'
import avatarBucketBody from '@/assets/landing/video-call/avatar-bucket-body.svg'
import avatarBucketExpression from '@/assets/landing/video-call/avatar-bucket-expression.svg'
import avatarBucketHalo from '@/assets/landing/video-call/avatar-bucket-halo.svg'
import avatarBucketHat from '@/assets/landing/video-call/avatar-bucket-hat.svg'
import avatarBucketHead from '@/assets/landing/video-call/avatar-bucket-head.svg'
import avatarCap from '@/assets/landing/video-call/avatar-cap.svg'
import avatarGlassesHat from '@/assets/landing/video-call/avatar-glasses-hat.svg'
import avatarHeadbandBody from '@/assets/landing/video-call/avatar-headband-body.svg'
import avatarHeadbandExpression from '@/assets/landing/video-call/avatar-headband-expression.svg'
import avatarHeadbandHair from '@/assets/landing/video-call/avatar-headband-hair.svg'
import avatarHeadbandHalo from '@/assets/landing/video-call/avatar-headband-halo.svg'
import avatarHeadbandHead from '@/assets/landing/video-call/avatar-headband-head.svg'
import avatarHeadbandMarks from '@/assets/landing/video-call/avatar-headband-marks.svg'
import avatarHeadphones from '@/assets/landing/video-call/avatar-headphones.svg'
import avatarHost from '@/assets/landing/video-call/avatar-host.svg'
import avatarSidecapBody from '@/assets/landing/video-call/avatar-sidecap-body.svg'
import avatarSidecapExpression from '@/assets/landing/video-call/avatar-sidecap-expression.svg'
import avatarSidecapHalo from '@/assets/landing/video-call/avatar-sidecap-halo.svg'
import avatarSidecapHat from '@/assets/landing/video-call/avatar-sidecap-hat.svg'
import avatarSidecapHead from '@/assets/landing/video-call/avatar-sidecap-head.svg'
import landingCameraIcon from '@/assets/landing/decor/landing-camera.svg'
import landingMegaphoneIcon from '@/assets/landing/decor/landing-megaphone.svg'
import landingMicrophoneIcon from '@/assets/landing/decor/landing-microphone.svg'
import landingMonitorIcon from '@/assets/landing/decor/landing-monitor.svg'
import eatFirstIcon from '@/assets/landing/eat-first.png'
import eatFirstIconWebp from '@/assets/landing/eat-first.webp'
import nadrawPhoneIcon from '@/assets/landing/nadraw-phone.png'
import nadrawPhoneIconWebp from '@/assets/landing/nadraw-phone.webp'
import instagramIcon from '@/assets/landing/instagram.png'
import mafiaIcon from '@/assets/landing/mafia.png'
import mafiaIconWebp from '@/assets/landing/mafia.webp'
import spyIcon from '@/assets/landing/spy.png'
import spyIconWebp from '@/assets/landing/spy.webp'
import telegramIcon from '@/assets/landing/telegram.png'
import tiktokIcon from '@/assets/landing/tiktok.png'
import twitchIcon from '@/assets/landing/twitch.png'
import nadleGameIcon from '@/assets/landing/nadle.png'
import nadleGameIconWebp from '@/assets/landing/nadle.webp'
import whoTakeShitIcon from '@/assets/landing/who-take-shit.png'
import { persistLocale } from '@/eat-first/i18n/index.js'
import {
  BRAND_LOGO_LIGHT_SVG,
  STREAMER_NICK,
  STREAMER_TWITCH_URL,
} from '@/eat-first/constants/brand.js'
import { getLandingScrollTopForHash } from '@/utils/landingAnchorScroll'
import { landingDesignPx as px } from '@/utils/landingDesignPx'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuth()

const defaultNadleStreamer =
  (typeof import.meta.env.VITE_DEFAULT_STREAMER === 'string' && import.meta.env.VITE_DEFAULT_STREAMER.trim()) ||
  STREAMER_NICK

type NavItem = {
  label: string
  href: string
}

type CallBannerCard = {
  id: string
  tone: 'violet' | 'indigo' | 'brown' | 'olive' | 'sand' | 'pink' | 'rose' | 'purple'
  layers: readonly CallBannerCardLayer[]
  style: Readonly<Record<string, string>>
}

type CallBannerCardLayer = {
  src: string
  className: string
}

type LandingGameCard = {
  id: string
  title: string
  to: RouteLocationRaw
  image: string
  imageWebp?: string
  ariaLabel: string
  tone?: 'violet' | 'amber' | 'green' | 'slate'
}

type LandingDecorIcon = {
  alt: string
  asset: string
  style: Readonly<Record<string, string>>
}

const authRouteLogin = { path: '/auth', query: { redirect: '/app', mode: 'login' as const } } as const
const callRoute = { name: 'call' } as const
const coinHubRoute = { name: 'coin-hub' } as const
const eatRoute = { name: 'eat', query: { view: 'join' } } satisfies RouteLocationRaw
const mafiaRoute = { name: 'mafia' } satisfies RouteLocationRaw
const landingFeedbackHref = 'mailto:feedback@streamassist.net?subject=StreamAssist%20feedback'
const landingPageLoading = ref(true)
const landingCanvasElement = ref<HTMLElement | null>(null)

let landingReadyTimer: number | undefined
let landingCanvasResizeObserver: ResizeObserver | undefined

useLandingCosmicParallax(landingCanvasElement)

const navItems = computed(
  () =>
    [
      { label: t('landing.navVideoCall'), href: '#videocall' },
      { label: t('landing.navGames'), href: '#games' },
      { label: t('landing.navEconomy'), href: '#economy' },
      { label: t('landing.navSafety'), href: '#footer' },
      { label: t('landing.navSupport'), href: '#footer' },
      { label: t('landing.navDevelopers'), href: '#footer' },
    ] as readonly NavItem[],
)

/** Labels match `eat-first` i18n locale codes (`VALID` in i18n/index.js includes pl, not es). */
const localeButtons = computed(() =>
  [
    { code: 'en', label: 'English' },
    { code: 'de', label: 'Deutsch' },
    { code: 'uk', label: 'Українська' },
    { code: 'pl', label: 'Polski' },
  ] as const,
)

const landingFooterLocaleOptions = computed(
  () => localeButtons.value.map((item) => ({ value: item.code, label: item.label })),
)

const landingCriticalImageSources = Object.freeze([
  BRAND_LOGO_LIGHT_SVG,
  twitchBrowseIllustration,
  avatarHost,
  avatarHeadbandHalo,
  avatarHeadbandBody,
  avatarHeadbandHead,
  avatarHeadbandHair,
  avatarHeadbandExpression,
  avatarHeadbandMarks,
  avatarHeadphones,
  avatarCap,
  eatFirstIcon,
  mafiaIcon,
  spyIcon,
  nadleGameIcon,
  nadrawPhoneIcon,
  landingCameraIcon,
  landingMegaphoneIcon,
  landingMicrophoneIcon,
  landingMonitorIcon,
] as const)

const callBannerCards = Object.freeze([
  Object.freeze({
    id: 'host',
    tone: 'violet',
    layers: Object.freeze([{ src: avatarHost, className: 'call-banner__avatar--host' }]),
    style: Object.freeze({ left: px(24.5), width: px(159) }),
  }),
  Object.freeze({
    id: 'headband',
    tone: 'indigo',
    layers: Object.freeze([
      { src: avatarHeadbandHalo, className: 'call-banner__avatar--headband-halo' },
      { src: avatarHeadbandBody, className: 'call-banner__avatar--headband-body' },
      { src: avatarHeadbandHead, className: 'call-banner__avatar--headband-head' },
      { src: avatarHeadbandHair, className: 'call-banner__avatar--headband-hair' },
      { src: avatarHeadbandExpression, className: 'call-banner__avatar--headband-expression' },
      { src: avatarHeadbandMarks, className: 'call-banner__avatar--headband-marks' },
    ]),
    style: Object.freeze({ left: px(193.5), width: px(160) }),
  }),
  Object.freeze({
    id: 'headphones',
    tone: 'brown',
    layers: Object.freeze([{ src: avatarHeadphones, className: 'call-banner__avatar--headphones' }]),
    style: Object.freeze({ left: px(363.5), width: px(160) }),
  }),
  Object.freeze({
    id: 'cap',
    tone: 'olive',
    layers: Object.freeze([{ src: avatarCap, className: 'call-banner__avatar--cap' }]),
    style: Object.freeze({ left: px(533.5), width: px(159) }),
  }),
  Object.freeze({
    id: 'bucket',
    tone: 'sand',
    layers: Object.freeze([
      { src: avatarBucketHalo, className: 'call-banner__avatar--bucket-halo' },
      { src: avatarBucketBody, className: 'call-banner__avatar--bucket-body' },
      { src: avatarBucketHead, className: 'call-banner__avatar--bucket-head' },
      { src: avatarBucketHat, className: 'call-banner__avatar--bucket-hat' },
      { src: avatarBucketExpression, className: 'call-banner__avatar--bucket-expression' },
    ]),
    style: Object.freeze({ left: px(24.5), width: px(159) }),
  }),
  Object.freeze({
    id: 'glasses-hat',
    tone: 'pink',
    layers: Object.freeze([{ src: avatarGlassesHat, className: 'call-banner__avatar--glasses-hat' }]),
    style: Object.freeze({ left: px(193.5), width: px(160) }),
  }),
  Object.freeze({
    id: 'beanie',
    tone: 'rose',
    layers: Object.freeze([
      { src: avatarBeanieBody, className: 'call-banner__avatar--beanie-body' },
      { src: avatarBeanieHead, className: 'call-banner__avatar--beanie-head' },
      { src: avatarBeanieHat, className: 'call-banner__avatar--beanie-hat' },
      { src: avatarBeanieGlasses, className: 'call-banner__avatar--beanie-glasses' },
      { src: avatarBeanieExpression, className: 'call-banner__avatar--beanie-expression' },
    ]),
    style: Object.freeze({ left: px(363.5), width: px(160) }),
  }),
  Object.freeze({
    id: 'sidecap',
    tone: 'purple',
    layers: Object.freeze([
      { src: avatarSidecapHalo, className: 'call-banner__avatar--sidecap-halo' },
      { src: avatarSidecapBody, className: 'call-banner__avatar--sidecap-body' },
      { src: avatarSidecapHead, className: 'call-banner__avatar--sidecap-head' },
      { src: avatarSidecapHat, className: 'call-banner__avatar--sidecap-hat' },
      { src: avatarSidecapExpression, className: 'call-banner__avatar--sidecap-expression' },
    ]),
    style: Object.freeze({ left: px(533.5), width: px(159) }),
  }),
] as readonly CallBannerCard[])

const landingDecorIcons = Object.freeze([
  Object.freeze({
    alt: 'Camera',
    asset: landingCameraIcon,
    style: Object.freeze({
      left: px(557),
      top: px(694),
      width: px(127),
      height: px(96),
      transform: 'rotate(20deg)',
    }),
  }),
  Object.freeze({
    alt: 'Megaphone',
    asset: landingMegaphoneIcon,
    style: Object.freeze({
      left: px(1699),
      top: px(1091),
      width: px(137),
      height: px(134),
      transform: 'rotate(-12deg)',
    }),
  }),
  Object.freeze({
    alt: 'Microphone',
    asset: landingMicrophoneIcon,
    style: Object.freeze({
      left: px(618),
      top: px(1752),
      width: px(101),
      height: px(101),
      transform: 'rotate(4deg)',
    }),
  }),
  Object.freeze({
    alt: 'Monitor',
    asset: landingMonitorIcon,
    style: Object.freeze({
      left: px(1918),
      top: px(1921),
      width: px(132),
      height: px(102),
      transform: 'rotate(8deg)',
    }),
  }),
] as readonly LandingDecorIcon[])

const landingGameCards = computed<LandingGameCard[]>(() => [
  {
    id: 'eat-first',
    title: t('home.gameEatFirst'),
    to: eatRoute,
    image: eatFirstIcon,
    imageWebp: eatFirstIconWebp,
    ariaLabel: t('home.openEatFirst'),
    tone: 'amber',
  },
  {
    id: 'mafia',
    title: t('home.gameMafia'),
    to: mafiaRoute,
    image: mafiaIcon,
    imageWebp: mafiaIconWebp,
    ariaLabel: t('home.openMafia'),
    tone: 'slate',
  },
  {
    id: 'nadle',
    title: t('home.gameNadle'),
    to: { name: 'nadle-streamer', params: { streamer: defaultNadleStreamer } },
    image: nadleGameIcon,
    imageWebp: nadleGameIconWebp,
    ariaLabel: t('home.openNadle'),
    tone: 'green',
  },
  {
    id: 'nadraw',
    title: t('home.gameNadraw'),
    to: { name: 'nadraw-show', params: { streamer: defaultNadleStreamer } },
    image: nadrawPhoneIcon,
    imageWebp: nadrawPhoneIconWebp,
    ariaLabel: t('home.openNadraw'),
    tone: 'violet',
  },
  {
    id: 'spy',
    title: t('home.gameSpy'),
    to: mafiaRoute,
    image: spyIcon,
    imageWebp: spyIconWebp,
    ariaLabel: t('home.openSpy'),
    tone: 'slate',
  },
  {
    id: 'hot-seat',
    title: t('home.gameMic'),
    to: eatRoute,
    image: whoTakeShitIcon,
    ariaLabel: t('home.openHotSeat'),
    tone: 'amber',
  },
])

const socialLinks = Object.freeze([
  Object.freeze({
    alt: 'Instagram',
    icon: instagramIcon,
    href: 'https://www.instagram.com/nad1ch_/',
    style: Object.freeze({
      left: px(884.25),
      top: px(2233.56),
      width: px(62.58),
      height: px(62.58),
    }),
  }),
  Object.freeze({
    alt: 'TikTok',
    icon: tiktokIcon,
    href: 'https://www.tiktok.com/@nad1ch',
    style: Object.freeze({
      left: px(993.94),
      top: px(2234.27),
      width: px(61.17),
      height: px(61.17),
    }),
  }),
  Object.freeze({
    alt: 'Telegram',
    icon: telegramIcon,
    href: 'https://t.me/nad1ch_tgh',
    style: Object.freeze({
      left: px(1100.81),
      top: px(2229.7),
      width: px(70.31),
      height: px(70.31),
    }),
  }),
  Object.freeze({
    alt: 'Twitch',
    icon: twitchIcon,
    href: STREAMER_TWITCH_URL,
    style: Object.freeze({
      left: px(1233),
      top: px(2229),
      width: px(71.72),
      height: px(71.72),
    }),
  }),
])

const footerProduct = computed(() => [
  t('landing.footerProductTitle'),
  t('landing.footerNitro'),
  t('landing.footerStatus'),
  t('landing.footerPolicies'),
  t('landing.footerTerms'),
  t('landing.footerPrivacy'),
  t('landing.footerCookieSettings'),
])
const footerAbout = computed(() => [
  t('landing.footerAboutTitle'),
  t('landing.footerJobs'),
  t('landing.footerBrand'),
  t('landing.footerNewsroom'),
  t('landing.footerDevelopers'),
])

async function selectLocale(code: string) {
  await persistLocale(code)
}

const LANDING_FLOW_LAYOUT_MEDIA = '(max-width: 960px)'

function landingPrefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function landingUsesFlowLayout(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(LANDING_FLOW_LAYOUT_MEDIA).matches
}

function syncLandingBackdropUnit(): void {
  const canvas = landingCanvasElement.value
  if (typeof window === 'undefined' || canvas == null) return

  if (!landingUsesFlowLayout()) {
    canvas.style.removeProperty('--landing-backdrop-u')
    return
  }

  const width = canvas.clientWidth
  const height = canvas.scrollHeight
  if (width <= 0 || height <= 0) return

  canvas.style.setProperty('--landing-backdrop-u', `${Math.max(width / 2560, height / 2655)}px`)
}

function getLandingFlowScrollTop(hash: string): number | null {
  if (typeof window === 'undefined' || !landingUsesFlowLayout()) return null
  const target = document.querySelector<HTMLElement>(hash)
  if (target == null) return null
  const top = window.scrollY + target.getBoundingClientRect().top
  return Number.isFinite(top) ? Math.max(top - 16, 0) : null
}

function scrollLandingToHash(hash: string) {
  if (typeof window === 'undefined') return
  const top = getLandingFlowScrollTop(hash) ?? getLandingScrollTopForHash(hash)
  window.scrollTo({ top, behavior: landingPrefersReducedMotion() ? 'auto' : 'smooth' })
}

function goLandingNav(href: string) {
  const hash = href.startsWith('#') ? href : `#${href}`
  void router.push({ path: '/', query: route.query, hash })
}

async function goLandingAuth(): Promise<void> {
  await auth.ensureAuthLoaded()
  await router.push(auth.isAuthenticated.value ? { path: '/app' } : authRouteLogin)
}

function waitForLandingImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve()
    img.onerror = () => resolve()
    img.src = src
  })
}

function waitForLandingFonts(): Promise<void> {
  if (typeof document === 'undefined' || document.fonts == null) {
    return Promise.resolve()
  }
  return document.fonts.ready.then(() => undefined, () => undefined)
}

function waitForLandingTimeout(ms: number): Promise<void> {
  return new Promise((resolve) => {
    landingReadyTimer = window.setTimeout(resolve, ms)
  })
}

onMounted(() => {
  syncLandingBackdropUnit()
  if (typeof ResizeObserver !== 'undefined' && landingCanvasElement.value != null) {
    landingCanvasResizeObserver = new ResizeObserver(syncLandingBackdropUnit)
    landingCanvasResizeObserver.observe(landingCanvasElement.value)
  }
  window.addEventListener('resize', syncLandingBackdropUnit)

  void Promise.race([
    Promise.allSettled([
      waitForLandingFonts(),
      ...landingCriticalImageSources.map((src) => waitForLandingImage(src)),
    ]).then(() => undefined),
    waitForLandingTimeout(1400),
  ]).then(() => {
    void nextTick(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          landingPageLoading.value = false
        })
      })
    })
  })
})

onUnmounted(() => {
  if (landingReadyTimer !== undefined) {
    window.clearTimeout(landingReadyTimer)
  }
  landingCanvasResizeObserver?.disconnect()
  window.removeEventListener('resize', syncLandingBackdropUnit)
})

watch(
  () => route.hash,
  (hash) => {
    void nextTick(() => {
      if (!hash) return
      scrollLandingToHash(hash)
    })
  },
  { immediate: true },
)

</script>

<template>
  <div class="landing page-stack">
    <AppFullPageLoader :visible="landingPageLoading" :aria-label="t('landing.loadingAria')" label="" />

    <div ref="landingCanvasElement" class="landing__canvas">
      <LandingCloudBackdrop class="landing__background" />

      <div class="landing-wordmark-layer" aria-hidden="true">
        <p class="landing__wordmark landing__wordmark--1">StreamAssist</p>
        <p class="landing__wordmark landing__wordmark--2">StreamAssist</p>
        <p class="landing__wordmark landing__wordmark--3">StreamAssist</p>
        <p class="landing__wordmark landing__wordmark--4">StreamAssist</p>
      </div>

      <div class="landing-decor-icons" aria-hidden="true">
        <img
          v-for="icon in landingDecorIcons"
          :key="icon.alt"
          class="landing-decor-icons__item"
          :src="icon.asset"
          alt=""
          draggable="false"
          decoding="async"
          :style="icon.style"
        />
      </div>

      <header class="landing-topbar" :aria-label="t('landing.siteHeaderAria')">
        <div class="landing-topbar__start">
          <div class="landing-header__brand">
            <img
              class="landing-header__brand-mark"
              :src="BRAND_LOGO_LIGHT_SVG"
              alt=""
              width="81"
              height="104"
              decoding="async"
              fetchpriority="high"
            />
            <p class="landing-header__brand-name">
              <span>Stream</span>
              <span>Assist</span>
            </p>
          </div>
        </div>

        <nav class="landing-topbar__mid landing-header__nav" :aria-label="t('landing.primaryNavAria')">
          <a
            v-for="item in navItems"
            :key="item.label"
            class="landing-header__nav-link"
            :href="item.href"
            @click.prevent="goLandingNav(item.href)"
          >
            {{ item.label }}
          </a>
        </nav>

        <div class="landing-topbar__end landing-auth sa-glass-button" :aria-label="t('landing.accountAria')">
          <button type="button" class="landing-auth__link" @click="goLandingAuth">
            {{ t('landing.login') }}
          </button>
        </div>
      </header>

      <section class="landing-hero" :aria-label="t('landing.heroAria')">
        <div class="landing-hero__screen" aria-hidden="true">
          <img class="landing-hero__browse-illustration" :src="twitchBrowseIllustration" alt="" />
        </div>

        <div class="landing-hero__copy">
          <div class="landing-hero__headline">
            <h1 class="landing-hero__title landing-u-text-outline-heading">StreamAssist</h1>
            <p class="landing-hero__tagline landing-u-text-outline-heading">{{ t('landing.newHeroTagline') }}</p>
          </div>
          <p class="landing-hero__lead">
            {{ t('landing.newHeroLead') }}
          </p>
        </div>
      </section>

      <section id="videocall" class="landing-section landing-section--videocall">
        <h2 class="landing-section__title landing-u-text-outline-heading">{{ t('landing.videoCallTitle') }}</h2>
        <p class="landing-section__lead">
          {{ t('landing.videoCallLead') }}
        </p>

        <RouterLink class="call-banner" :class="{ 'call-banner--compact-title': locale === 'uk' }" :to="callRoute">
          <span class="call-banner__title landing-u-text-outline-cta">{{ t('landing.videoCallCta') }}</span>

          <span class="call-banner__cards">
            <span
              v-for="(card, index) in callBannerCards"
              :key="`call-card-${index}`"
              class="call-banner__card"
              :class="[`call-banner__card--${card.tone}`, `call-banner__card--${card.id}`]"
              :style="card.style"
            >
              <img
                v-for="layer in card.layers"
                :key="layer.className"
                class="call-banner__avatar-layer"
                :class="layer.className"
                :src="layer.src"
                alt=""
                loading="eager"
                decoding="async"
              />
            </span>
          </span>
        </RouterLink>
      </section>

      <section id="games" class="landing-section landing-section--games">
        <AppGamesSection class="landing-games-panel" :items="landingGameCards" :lead="t('landing.gamesLead')" />
      </section>

      <section id="economy" class="landing-section landing-section--economy">
        <h2 class="landing-section__title landing-u-text-outline-heading">{{ t('landing.economyTitle') }}</h2>
        <p class="landing-section__lead">
          {{ t('landing.economyLead') }}
        </p>

        <EconomySlotBanner class="economy-banner" :to="coinHubRoute" />
      </section>

      <footer id="footer" class="landing-footer" :aria-label="t('landing.siteFooterAria')">
        <nav class="landing-footer__seo" :aria-label="t('landing.guidesAria')">
          <a class="landing-footer__seo-link" href="/video-calls-for-streamers/">{{ t('landing.seoVideoCalls') }}</a>
          <a class="landing-footer__seo-link" href="/twitch-nadle-game/">{{ t('landing.seoNadle') }}</a>
          <a class="landing-footer__seo-link" href="/stream-overlay-tools/">{{ t('landing.seoOverlay') }}</a>
        </nav>
        <div class="landing-footer__panel">
          <AppLandingFooterActions
            class="landing-footer__locale-action"
            :locale="locale"
            :locale-options="landingFooterLocaleOptions"
            mode="locale"
            tone="light"
            @update:locale="selectLocale"
          />

          <div class="landing-footer__static">
            <div class="landing-footer__socials">
              <a
                v-for="item in socialLinks"
                :key="item.alt"
                class="landing-footer__social"
                :href="item.href"
                target="_blank"
                rel="noreferrer"
                :aria-label="item.alt"
                :style="item.style"
              >
                <img :src="item.icon" :alt="item.alt" width="128" height="128" loading="lazy" />
              </a>
            </div>

            <AppLandingFooterActions
              class="landing-footer__feedback-action"
              :feedback-href="landingFeedbackHref"
              mode="feedback"
              tone="light"
            />

            <div class="landing-footer__columns">
              <div class="landing-footer__product">
                <p v-for="item in footerProduct" :key="item">{{ item }}</p>
              </div>

              <div class="landing-footer__about">
                <p v-for="item in footerAbout" :key="item">{{ item }}</p>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  </div>
</template>

<style scoped>
/* Display + body sans are loaded once in `index.html` to avoid route-level font races. */

.landing-u-text-outline-heading {
  line-height: 1.12;
  letter-spacing: 0.03em;
  text-rendering: geometricPrecision;
}

.landing-u-text-outline-cta {
  line-height: 1;
  letter-spacing: 0.02em;
  text-rendering: geometricPrecision;
}

.landing-u-text-outline-game {
  line-height: 1.1;
  letter-spacing: 0.02em;
  text-rendering: geometricPrecision;
}

.landing {
  min-height: 100vh;
  min-width: 0;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
  background: #0b0317;
  color: #fff;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.landing__canvas {
  --u: calc(100cqw / 2560);
  --landing-backdrop-u: var(--u);
  --landing-parallax-bg-x: 0px;
  --landing-parallax-bg-y: 0px;
  --landing-parallax-mid-x: 0px;
  --landing-parallax-mid-y: 0px;
  --landing-parallax-fg-x: 0px;
  --landing-parallax-fg-y: 0px;
  --landing-parallax-glow-x: 0px;
  --landing-parallax-glow-y: 0px;
  --landing-parallax-bolt-x: 0px;
  --landing-parallax-bolt-y: 0px;
  position: relative;
  flex-shrink: 0;
  width: min(100vw, 2560px);
  max-width: 2560px;
  height: auto;
  aspect-ratio: 2560 / 2655;
  min-height: calc(var(--u) * 2655);
  margin-inline: auto;
  container-type: inline-size;
  box-sizing: border-box;
  overflow: hidden;
  background: linear-gradient(119.10504159217813deg, #0b0317 0%, rgba(74, 50, 116, 0.69) 73.206%);
  text-rendering: optimizeLegibility;
}

.landing__background {
  --u: var(--landing-backdrop-u);
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: calc(100vw + 240px);
  transform: translate3d(calc(-50% + var(--landing-parallax-bg-x, 0px)), var(--landing-parallax-bg-y, 0px), 0);
  will-change: transform;
}

.landing-wordmark-layer {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}

.landing-decor-icons {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}

.landing-decor-icons__item {
  position: absolute;
  display: block;
  height: auto;
  object-fit: contain;
  opacity: 0.92;
  filter: drop-shadow(0 calc(var(--u) * 12) calc(var(--u) * 18) rgba(8, 2, 20, 0.22));
  transform-origin: center;
}

/*
 * Seven independent twinkle curves (opacity + phase). Floors stay >= ~0.26 so dots never
 * read as “gone”; extra key stops smooth ease-in-out between endpoints (no harsh pops).
 */
@keyframes landingDotPh0 {
  0%,
  100% {
    opacity: 0.28;
  }

  22% {
    opacity: 0.36;
  }

  45% {
    opacity: 0.5;
  }

  72% {
    opacity: 0.34;
  }
}

@keyframes landingDotPh1 {
  0%,
  100% {
    opacity: 0.38;
  }

  28% {
    opacity: 0.5;
  }

  55% {
    opacity: 0.72;
  }

  78% {
    opacity: 0.46;
  }
}

@keyframes landingDotPh2 {
  0%,
  100% {
    opacity: 0.3;
  }

  18% {
    opacity: 0.38;
  }

  35% {
    opacity: 0.56;
  }

  62% {
    opacity: 0.4;
  }
}

@keyframes landingDotPh3 {
  0%,
  100% {
    opacity: 0.48;
  }

  25% {
    opacity: 0.62;
  }

  50% {
    opacity: 0.8;
  }

  75% {
    opacity: 0.58;
  }
}

@keyframes landingDotPh4 {
  0%,
  100% {
    opacity: 0.26;
  }

  32% {
    opacity: 0.34;
  }

  65% {
    opacity: 0.46;
  }

  88% {
    opacity: 0.3;
  }
}

@keyframes landingDotPh5 {
  0%,
  100% {
    opacity: 0.34;
  }

  22% {
    opacity: 0.44;
  }

  42% {
    opacity: 0.6;
  }

  68% {
    opacity: 0.42;
  }
}

@keyframes landingDotPh6 {
  0%,
  100% {
    opacity: 0.42;
  }

  30% {
    opacity: 0.52;
  }

  58% {
    opacity: 0.66;
  }

  82% {
    opacity: 0.48;
  }
}

@keyframes landingBannerIdle {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(calc(var(--u) * -0.65));
  }
}

@keyframes app-call-host-greeting {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }

  30% {
    transform: translateY(-2.4%) rotate(-3deg);
  }

  62% {
    transform: translateY(-1%) rotate(3deg);
  }
}

@keyframes app-call-headband-halo-drift {
  0%,
  100% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }

  55% {
    transform: translateY(1.4%) scale(0.985);
    opacity: 0.9;
  }
}

@keyframes app-call-headband-body-sigh {
  0%,
  100% {
    transform: translateY(0);
  }

  55% {
    transform: translateY(1.6%);
  }
}

@keyframes app-call-headband-sad-nod {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }

  55% {
    transform: translateY(1.6%) rotate(-1.2deg);
  }
}

@keyframes app-call-headband-hair-droop {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }

  55% {
    transform: translateY(1.2%) rotate(-1deg);
  }
}

@keyframes app-call-headphones-beat {
  0%,
  100% {
    transform: translateY(0) rotate(0deg) scale(1);
  }

  26% {
    transform: translateY(-2%) rotate(-1.6deg) scale(1.01);
  }

  58% {
    transform: translateY(0.8%) rotate(1.4deg) scale(0.995);
  }
}

@keyframes app-call-cap-surprise {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }

  28% {
    transform: translateY(-3.2%) scale(1.025);
  }

  64% {
    transform: translateY(-0.8%) scale(1.005);
  }
}

@keyframes app-call-bucket-halo-steady {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }

  48% {
    transform: scale(1.018);
    opacity: 0.94;
  }
}

@keyframes app-call-bucket-body-brace {
  0%,
  100% {
    transform: translateY(0) scaleY(1);
  }

  45% {
    transform: translateY(0.8%) scaleY(0.992);
  }
}

@keyframes app-call-bucket-confident-nod {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }

  42% {
    transform: translateY(1%) rotate(1.6deg);
  }
}

@keyframes app-call-bucket-hat-tap {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }

  42% {
    transform: translateY(-1.4%) rotate(1.2deg);
  }
}

@keyframes app-call-glasses-hat-nervous {
  0%,
  100% {
    transform: translateX(0) translateY(0) rotate(0deg);
  }

  22% {
    transform: translateX(-1.6%) translateY(-0.6%) rotate(-1deg);
  }

  44% {
    transform: translateX(1.2%) translateY(0.2%) rotate(0.8deg);
  }

  68% {
    transform: translateX(-0.6%) translateY(-0.4%) rotate(-0.4deg);
  }
}

@keyframes app-call-beanie-body-chuckle {
  0%,
  100% {
    transform: translateY(0) scaleY(1);
  }

  45% {
    transform: translateY(0.9%) scaleY(0.992);
  }
}

@keyframes app-call-beanie-smile-bob {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }

  38% {
    transform: translateY(-1.2%) rotate(1deg);
  }

  76% {
    transform: translateY(-0.4%) rotate(-0.6deg);
  }
}

@keyframes app-call-beanie-hat-soft {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }

  38% {
    transform: translateY(-1.8%) rotate(1.2deg);
  }
}

@keyframes app-call-beanie-glasses-smile {
  0%,
  100% {
    transform: translateY(0);
  }

  45% {
    transform: translateY(-1.3%);
  }
}

@keyframes app-call-sidecap-halo-party {
  0%,
  100% {
    transform: translateX(0) scale(1);
    opacity: 1;
  }

  50% {
    transform: translateX(1.2%) scale(1.025);
    opacity: 0.92;
  }
}

@keyframes app-call-sidecap-body-groove {
  0%,
  100% {
    transform: translateX(0) translateY(0);
  }

  35% {
    transform: translateX(1.2%) translateY(-0.7%);
  }

  70% {
    transform: translateX(-1%) translateY(0.2%);
  }
}

@keyframes app-call-sidecap-playful-tilt {
  0%,
  100% {
    transform: translateX(0) translateY(0) rotate(0deg);
  }

  35% {
    transform: translateX(1.4%) translateY(-1.2%) rotate(1.2deg);
  }

  70% {
    transform: translateX(-1%) translateY(-0.3%) rotate(-0.8deg);
  }
}

@keyframes app-call-sidecap-hat-swing {
  0%,
  100% {
    transform: translateX(0) rotate(0deg);
  }

  35% {
    transform: translateX(1.8%) rotate(2deg);
  }

  70% {
    transform: translateX(-1%) rotate(-1deg);
  }
}

.landing__wordmark {
  position: absolute;
  margin: 0;
  font-family: 'Climate Crisis', var(--sa-font-display);
  font-size: calc(var(--u) * 143.91);
  line-height: 1.0047;
  letter-spacing: calc(var(--u) * 1.4391);
  color: rgba(255, 255, 255, 0.02);
  pointer-events: none;
  white-space: nowrap;
  font-variation-settings: 'YEAR' 1979;
}

.landing__wordmark--1 {
  left: calc(var(--u) * 559.41);
  top: calc(var(--u) * 2122.03);
  width: calc(var(--u) * 1440);
  filter: blur(calc(var(--u) * 4.148));
}

.landing__wordmark--2 {
  left: calc(var(--u) * 558);
  top: calc(var(--u) * 2242.97);
  width: calc(var(--u) * 1440);
  color: rgba(255, 255, 255, 0.05);
  filter: blur(calc(var(--u) * 4.5));
}

.landing__wordmark--3 {
  left: calc(var(--u) * 560.81);
  top: calc(var(--u) * 2365.31);
  width: calc(var(--u) * 1440);
  color: rgba(255, 255, 255, 0.1);
  filter: blur(calc(var(--u) * 3.727));
}

.landing__wordmark--4 {
  left: calc(var(--u) * 559.41);
  top: calc(var(--u) * 2489.06);
  width: calc(var(--u) * 1440);
  color: rgba(255, 255, 255, 0.2);
  filter: blur(calc(var(--u) * 2.18));
}

.landing__dot,
.landing__glow,
.landing__bolt {
  position: absolute;
  pointer-events: none;
}

.landing__dot {
  --dot-dur: 3s;
  --dot-delay: 0s;
  animation-timing-function: cubic-bezier(0.45, 0.05, 0.55, 0.95);
  animation-iteration-count: infinite;
  animation-duration: var(--dot-dur);
  animation-delay: var(--dot-delay);
  /* During delay, use first keyframe opacity — avoids a flash at full opacity before the twinkle starts. */
  animation-fill-mode: backwards;
  transform: translate3d(var(--landing-parallax-fg-x, 0px), var(--landing-parallax-fg-y, 0px), 0);
  will-change: transform;
}

.landing__dot--ph0 {
  background: rgba(255, 255, 255, 0.33);
  animation-name: landingDotPh0;
}

.landing__dot--ph1 {
  background: rgba(255, 255, 255, 0.46);
  animation-name: landingDotPh1;
}

.landing__dot--ph2 {
  background: rgba(255, 255, 255, 0.38);
  animation-name: landingDotPh2;
}

.landing__dot--ph3 {
  background: rgba(255, 255, 255, 0.5);
  animation-name: landingDotPh3;
}

.landing__dot--ph4 {
  background: rgba(255, 255, 255, 0.28);
  animation-name: landingDotPh4;
}

.landing__dot--ph5 {
  background: rgba(255, 255, 255, 0.41);
  animation-name: landingDotPh5;
}

.landing__dot--ph6 {
  background: rgba(255, 255, 255, 0.36);
  animation-name: landingDotPh6;
}

.landing__glow {
  border-radius: 999px;
  mix-blend-mode: screen;
  transform-origin: center;
}

.landing__bolt {
  object-fit: contain;
  transform-origin: center;
}

.landing-topbar {
  position: absolute;
  left: calc(var(--u) * 540);
  right: calc(var(--u) * 570);
  top: calc(var(--u) * 21);
  min-height: calc(var(--u) * 61.5);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: calc(var(--u) * 12);
  box-sizing: border-box;
  z-index: 3;
}

.landing-topbar__start {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
}

.landing-topbar__mid {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.landing-topbar__end {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
}

.landing-header__brand {
  position: relative;
  left: auto;
  top: auto;
  width: calc(var(--u) * 190);
  height: calc(var(--u) * 60);
  overflow: visible;
}

.landing-header__brand-mark {
  position: absolute;
  left: calc(var(--u) * -12);
  top: calc(var(--u) * 2.25);
  width: auto;
  height: calc(var(--u) * 55);
  max-width: calc(var(--u) * 46);
  object-fit: contain;
  object-position: left center;
  display: block;
  pointer-events: none;
}

.landing-header__brand-name {
  position: absolute;
  left: calc(var(--u) * 38);
  top: calc(var(--u) * 11.5);
  margin: 0;
  display: grid;
  font-family: var(--sa-font-display);
  font-size: calc(var(--u) * 13.8);
  line-height: calc(var(--u) * 15);
}

.landing-header__nav {
  position: relative;
  inset: auto;
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
  gap: calc(var(--u) * 40);
  min-width: 0;
}

.landing-header__nav-link {
  position: relative;
  top: auto;
  left: auto;
  flex: 0 0 auto;
  color: #fff;
  font-family: 'Marmelad', sans-serif;
  font-size: calc(var(--u) * 17.25);
  font-weight: 600;
  line-height: 1;
  text-decoration: none;
  transition: opacity 0.16s ease;
}

.landing-header__nav-link:hover,
.landing-header__nav-link:focus-visible {
  opacity: 0.72;
}

.landing-auth {
  position: relative;
  left: auto;
  top: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: calc(var(--u) * 142);
  height: calc(var(--u) * 39.38);
  border-radius: calc(var(--u) * 19.5);
  border-color: rgba(255, 255, 255, 0.45);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.78)),
    rgba(255, 255, 255, 0.82);
  overflow: hidden;
  z-index: 2;
  align-self: center;
  transition:
    transform 0.22s ease,
    box-shadow 0.22s ease,
    filter 0.22s ease;
}

.landing-auth::before {
  opacity: 0.58;
}

.landing-auth__link {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: 0;
  border: 0;
  appearance: none;
  background: transparent;
  color: #111827;
  cursor: pointer;
  font-family: 'Marmelad', sans-serif;
  font-size: calc(var(--u) * 13.5);
  line-height: 1;
  text-decoration: none;
  white-space: nowrap;
  transition:
    background 0.28s ease,
    color 0.28s ease;
}

.landing-auth:hover,
.landing-auth:focus-within {
  transform: translateY(-1px);
  box-shadow:
    0 10px 24px rgba(10, 3, 24, 0.2),
    0 0 0 1px rgba(255, 255, 255, 0.26);
  filter: brightness(0.94);
}

.landing-auth:hover .landing-auth__link,
.landing-auth:focus-within .landing-auth__link {
  color: #090313;
}

.landing-hero__screen {
  position: absolute;
  left: calc(var(--u) * 707.06);
  top: calc(var(--u) * 213.75);
  width: calc(var(--u) * 651);
  height: calc(var(--u) * 375);
  border-radius: calc(var(--u) * 34);
  background: transparent;
}

.landing-hero__screen::before {
  content: '';
  position: absolute;
  left: calc(var(--u) * 15.14);
  top: calc(var(--u) * 38.71);
  width: calc(var(--u) * 114.86);
  height: calc(var(--u) * 317.83);
  border-radius: calc(var(--u) * 7.87);
  background: #1f1f23;
  z-index: 1;
  display: none;
}

.landing-hero__screen::after {
  content: '';
  position: absolute;
  left: calc(var(--u) * 24.19);
  top: calc(var(--u) * 46.97);
  width: calc(var(--u) * 54.68);
  height: calc(var(--u) * 9.44);
  border-radius: calc(var(--u) * 7.87);
  background: #e7e7e8;
  z-index: 2;
  display: none;
}

.landing-hero__browse-illustration {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  image-rendering: auto;
  shape-rendering: geometricPrecision;
  text-rendering: geometricPrecision;
  transform: translateZ(0);
  backface-visibility: hidden;
}

.landing-hero__core {
  position: absolute;
  left: calc(var(--u) * 9.63);
  top: calc(var(--u) * 9.6);
  width: calc(var(--u) * 629.36);
  height: calc(var(--u) * 354.02);
  border-radius: calc(var(--u) * 31.5);
  overflow: hidden;
  background: #0e0e10;
}

.landing-hero__core::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  width: calc(var(--u) * 629.36);
  height: calc(var(--u) * 22.03);
  border-radius: calc(var(--u) * 7.87);
  background: #7c4ddb;
  z-index: 1;
}

.landing-hero__main-panel {
  position: absolute;
  left: calc(var(--u) * 125.87);
  top: calc(var(--u) * 29.11);
  width: calc(var(--u) * 354.015);
  height: calc(var(--u) * 149.473);
  border-radius: calc(var(--u) * 7.867);
  overflow: hidden;
  background: linear-gradient(143.8224117268618deg, #7c4ddb 0%, #281538 73.206%);
  z-index: 2;
}

.landing-hero__screen-notch {
  position: absolute;
  left: calc(var(--u) * 236.01);
  top: calc(var(--u) * 3.15);
  width: calc(var(--u) * 165.21);
  height: calc(var(--u) * 15.73);
  border: calc(var(--u) * 0.79) solid #3a3a3d;
  box-sizing: border-box;
  border-radius: calc(var(--u) * 7.87);
  background: #0e0e10;
  z-index: 2;
}

.landing-hero__screen-notch::after {
  content: '';
  position: absolute;
  left: calc(var(--u) * 318.7);
  top: calc(var(--u) * 2.63);
  width: calc(var(--u) * 47.2);
  height: calc(var(--u) * 11.45);
  border-radius: calc(var(--u) * 7.87);
  background: #fff;
}

.landing-hero__live-pill {
  position: absolute;
  left: calc(var(--u) * 6.29);
  top: calc(var(--u) * 5.9);
  width: calc(var(--u) * 47.202);
  height: calc(var(--u) * 12.587);
  border-radius: calc(var(--u) * 7.867);
  background: #ff3b30;
}

.landing-hero__side-line {
  position: absolute;
  width: calc(var(--u) * 27.535);
  height: calc(var(--u) * 4.72);
  border-radius: calc(var(--u) * 2.36);
  background: #9ca3af;
}

.landing-hero__side-line--left {
  left: calc(var(--u) * 7.47);
}

.landing-hero__side-line--right {
  left: calc(var(--u) * 319.01);
}

.landing-hero__side-line--blue {
  background: #60a5fa;
}

.landing-hero__side-line--yellow {
  background: #fde68a;
}

.landing-hero__side-asset {
  position: absolute;
  left: calc(var(--u) * 491.69);
  top: calc(var(--u) * 29.11);
  width: calc(var(--u) * 129.806);
  height: calc(var(--u) * 149.473);
  z-index: 2;
}

.landing-hero__card-row {
  position: absolute;
  left: calc(var(--u) * 129.02);
  top: calc(var(--u) * 214.77);
  display: flex;
  gap: calc(var(--u) * 7.865);
  z-index: 2;
}

.landing-hero__mini-card {
  width: calc(var(--u) * 113.285);
  height: calc(var(--u) * 118.005);
  position: relative;
}

.landing-hero__mini-card::before {
  content: '';
  position: absolute;
  inset: 0 auto auto 0;
  width: 100%;
  height: calc(var(--u) * 63.723);
  border-radius: calc(var(--u) * 7.867);
}

.landing-hero__mini-card--purple::before {
  background: linear-gradient(135.74726373321334deg, #8b5cf6 0%, #241333 73.206%);
}

.landing-hero__mini-card--gray::before {
  background: linear-gradient(135.74726373321334deg, #2c2c2c 0%, #4b5563 73.206%);
}

.landing-hero__mini-card-pill {
  position: absolute;
  left: calc(var(--u) * 3.93);
  top: calc(var(--u) * 3.93);
  width: calc(var(--u) * 43.269);
  height: calc(var(--u) * 11.801);
  border-radius: calc(var(--u) * 7.867);
  background: #ff3b30;
}

.landing-hero__mini-card-avatar {
  position: absolute;
  left: 0;
  top: calc(var(--u) * 70.02);
  width: calc(var(--u) * 18.094);
  height: calc(var(--u) * 18.094);
  border-radius: 999px;
  box-shadow: inset 0 calc(var(--u) * -1.5) calc(var(--u) * 4) rgba(255, 255, 255, 0.25);
}

.landing-hero__mini-card-line {
  position: absolute;
  left: calc(var(--u) * 22.81);
  height: calc(var(--u) * 6.294);
  border-radius: calc(var(--u) * 6.294);
}

.landing-hero__mini-card-line--white {
  top: calc(var(--u) * 70.02);
  width: calc(var(--u) * 40.908);
  background: #fff;
}

.landing-hero__mini-card-line--violet {
  top: calc(var(--u) * 79.46);
  width: calc(var(--u) * 31.075);
  background: #8b5cf6;
}

.landing-hero__mini-card-line:last-child {
  top: calc(var(--u) * 88.5);
  width: calc(var(--u) * 33.041);
}

.landing-hero__copy {
  position: absolute;
  left: calc(var(--u) * 1385.25);
  top: calc(var(--u) * 212.25);
  width: calc(var(--u) * 444);
  height: calc(var(--u) * 402.75);
}

.landing-hero__headline {
  position: static;
}

.landing-hero__title,
.landing-hero__tagline,
.landing-section__title,
.call-banner__title {
  margin: 0;
  font-family: var(--sa-font-display);
  font-weight: 400;
  text-transform: uppercase;
}

.landing-hero__title {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

.landing-hero__tagline {
  position: absolute;
  left: calc(var(--u) * 4.5);
  top: 0;
  width: calc(var(--u) * 474.75);
  font-size: calc(var(--u) * 45);
  line-height: calc(var(--u) * 58.5);
}

.landing-hero__lead,
.landing-section__lead,
.landing-footer__locale-action,
.landing-footer__feedback-action,
.landing-footer__product,
.landing-footer__about,
.landing-auth__link {
  font-family: 'Marmelad', sans-serif;
}

.landing-hero__lead {
  position: absolute;
  left: calc(var(--u) * 3.84);
  top: calc(var(--u) * 192.75);
  width: calc(var(--u) * 423);
  margin: 0;
  font-size: calc(var(--u) * 18);
  line-height: 1.62;
  color: #e6e9ff;
  opacity: 0.92;
}

.landing-section {
  position: static;
}

.landing-section__title {
  position: absolute;
  transform: none;
  font-size: calc(var(--u) * 45);
  line-height: calc(var(--u) * 54);
  text-align: center;
  margin-bottom: calc(var(--u) * 16);
}

.landing-section__lead {
  position: absolute;
  margin: 0;
  transform: none;
  font-size: calc(var(--u) * 18);
  line-height: calc(var(--u) * 28.5);
  text-align: center;
  color: #e6e9ff;
  opacity: 0.88;
}

.landing-section--videocall .landing-section__title {
  left: calc(var(--u) * 707.06);
  top: calc(var(--u) * 736.81);
  width: calc(var(--u) * 1124.25);
}

.landing-section--videocall .landing-section__lead {
  left: calc(var(--u) * 909.47);
  top: calc(var(--u) * 804.81);
  width: calc(var(--u) * 743.25);
}

.call-banner {
  position: absolute;
  left: calc(var(--u) * 707.06);
  top: calc(var(--u) * 856.31);
  width: calc(var(--u) * 1124.25);
  height: calc(var(--u) * 154.5);
  display: block;
  border-radius: calc(var(--u) * 41.25);
  border: calc(var(--u) * 7.5) solid #fff;
  box-sizing: border-box;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.07), transparent 38%),
    radial-gradient(circle at 68% 50%, rgba(124, 77, 219, 0.22), transparent 36%),
    linear-gradient(166.6115811995453deg, rgba(124, 77, 219, 0.12) 0%, rgba(38, 18, 64, 0.18) 73.206%);
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    inset 0 -1px 0 rgba(255, 255, 255, 0.06),
    0 calc(var(--u) * 14) calc(var(--u) * 32) rgba(8, 2, 20, 0.24);
  transition:
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.call-banner:hover {
  transform: translateY(calc(var(--u) * -2));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.24),
    inset 0 -1px 0 rgba(255, 255, 255, 0.08),
    0 calc(var(--u) * 18) calc(var(--u) * 38) rgba(8, 2, 20, 0.3);
}

.call-banner__title {
  position: absolute;
  left: calc(var(--u) * 39.5);
  top: calc(var(--u) * 36.5);
  width: calc(var(--u) * 378);
  height: calc(var(--u) * 60);
  margin: 0;
  font-family: 'Climate Crisis', var(--sa-font-display);
  font-size: calc(var(--u) * 36);
  font-variation-settings: 'YEAR' 1979;
  font-weight: 400;
  letter-spacing: 0;
  line-height: calc(var(--u) * 58.5);
  text-align: left;
  text-transform: none;
  white-space: nowrap;
}

.call-banner--compact-title .call-banner__title {
  width: calc(var(--u) * 348);
  font-size: calc(var(--u) * 30);
  letter-spacing: calc(var(--u) * -0.45);
}

.call-banner__cards {
  position: absolute;
  left: calc(var(--u) * 392);
  top: calc(var(--u) * 5.25);
  width: calc(var(--u) * 708);
  height: calc(var(--u) * 120);
  border: 0;
  border-radius: calc(var(--u) * 28);
  background: transparent;
  box-shadow: none;
  z-index: 1;
}

.call-banner__card {
  position: absolute;
  top: calc(var(--u) * 17.5);
  display: block;
  height: calc(var(--u) * 91);
  overflow: hidden;
  border: calc(var(--u) * 1) solid rgba(255, 255, 255, 0.28);
  border-radius: calc(var(--u) * 14);
  box-sizing: border-box;
  filter: drop-shadow(0 calc(var(--u) * 8) calc(var(--u) * 8) rgba(8, 2, 20, 0.2));
  transform-origin: center;
  transition:
    box-shadow 0.22s ease,
    transform 0.22s ease;
}

.call-banner__card:hover {
  transform: scale(1.018);
  box-shadow: 0 calc(var(--u) * 6) calc(var(--u) * 16) rgba(4, 1, 12, 0.2);
}

.call-banner__card:nth-child(n + 5) {
  display: none;
}

.call-banner__card::before,
.call-banner__card::after {
  position: absolute;
  z-index: 2;
  height: calc(var(--u) * 4.86);
  border-radius: 999px;
  content: '';
}

.call-banner__card::before {
  left: 6.15%;
  bottom: 9.55%;
  width: 16.88%;
  background: #f2f4ff;
}

.call-banner__card::after {
  right: 6.95%;
  top: 7.45%;
  width: 13.9%;
  background: #6e72f8;
}

.call-banner__card--violet {
  background: rgba(108, 36, 185, 0.66);
}

.call-banner__card--indigo {
  background: rgba(79, 26, 200, 0.75);
}

.call-banner__card--brown {
  background: #704e3a;
}

.call-banner__card--olive {
  background: rgba(143, 157, 83, 0.51);
}

.call-banner__card--sand {
  background: rgba(246, 192, 92, 0.35);
}

.call-banner__card--pink {
  background: rgba(244, 124, 255, 0.42);
}

.call-banner__card--rose {
  background: rgba(208, 90, 90, 0.46);
}

.call-banner__card--purple {
  background: rgba(139, 92, 246, 0.51);
}

.call-banner__avatar-layer {
  position: absolute;
  z-index: 1;
  display: block;
  max-width: none;
  object-fit: contain;
  pointer-events: none;
  transform-origin: center bottom;
}

.call-banner__card--host:hover .call-banner__avatar--host {
  animation: app-call-host-greeting 0.78s ease-in-out infinite;
}

.call-banner__card--headband:hover .call-banner__avatar--headband-halo {
  animation: app-call-headband-halo-drift 1.05s ease-in-out infinite;
}

.call-banner__card--headband:hover .call-banner__avatar--headband-body {
  animation: app-call-headband-body-sigh 0.92s ease-in-out infinite;
}

.call-banner__card--headband:hover .call-banner__avatar--headband-head,
.call-banner__card--headband:hover .call-banner__avatar--headband-expression,
.call-banner__card--headband:hover .call-banner__avatar--headband-marks {
  animation: app-call-headband-sad-nod 0.92s ease-in-out infinite;
}

.call-banner__card--headband:hover .call-banner__avatar--headband-hair {
  animation: app-call-headband-hair-droop 0.92s ease-in-out infinite;
}

.call-banner__card--headphones:hover .call-banner__avatar--headphones {
  animation: app-call-headphones-beat 0.62s ease-in-out infinite;
}

.call-banner__card--cap:hover .call-banner__avatar--cap {
  animation: app-call-cap-surprise 0.72s ease-in-out infinite;
}

.call-banner__card--bucket:hover .call-banner__avatar--bucket-halo {
  animation: app-call-bucket-halo-steady 0.86s ease-in-out infinite;
}

.call-banner__card--bucket:hover .call-banner__avatar--bucket-body {
  animation: app-call-bucket-body-brace 0.82s ease-in-out infinite;
}

.call-banner__card--bucket:hover .call-banner__avatar--bucket-head,
.call-banner__card--bucket:hover .call-banner__avatar--bucket-expression {
  animation: app-call-bucket-confident-nod 0.82s ease-in-out infinite;
}

.call-banner__card--bucket:hover .call-banner__avatar--bucket-hat {
  animation: app-call-bucket-hat-tap 0.82s ease-in-out infinite;
}

.call-banner__card--glasses-hat:hover .call-banner__avatar--glasses-hat {
  animation: app-call-glasses-hat-nervous 0.68s ease-in-out infinite;
}

.call-banner__card--beanie:hover .call-banner__avatar--beanie-body {
  animation: app-call-beanie-body-chuckle 0.74s ease-in-out infinite;
}

.call-banner__card--beanie:hover .call-banner__avatar--beanie-head,
.call-banner__card--beanie:hover .call-banner__avatar--beanie-expression {
  animation: app-call-beanie-smile-bob 0.74s ease-in-out infinite;
}

.call-banner__card--beanie:hover .call-banner__avatar--beanie-hat {
  animation: app-call-beanie-hat-soft 0.74s ease-in-out infinite;
}

.call-banner__card--beanie:hover .call-banner__avatar--beanie-glasses {
  animation: app-call-beanie-glasses-smile 0.74s ease-in-out infinite;
}

.call-banner__card--sidecap:hover .call-banner__avatar--sidecap-halo {
  animation: app-call-sidecap-halo-party 0.7s ease-in-out infinite;
}

.call-banner__card--sidecap:hover .call-banner__avatar--sidecap-body {
  animation: app-call-sidecap-body-groove 0.7s ease-in-out infinite;
}

.call-banner__card--sidecap:hover .call-banner__avatar--sidecap-head,
.call-banner__card--sidecap:hover .call-banner__avatar--sidecap-expression {
  animation: app-call-sidecap-playful-tilt 0.7s ease-in-out infinite;
}

.call-banner__card--sidecap:hover .call-banner__avatar--sidecap-hat {
  animation: app-call-sidecap-hat-swing 0.7s ease-in-out infinite;
}

.call-banner__avatar--host,
.call-banner__avatar--headphones,
.call-banner__avatar--cap,
.call-banner__avatar--glasses-hat {
  height: 113%;
}

.call-banner__avatar--host {
  left: 24.82%;
  top: 2.38%;
  width: 54.61%;
}

.call-banner__avatar--headphones {
  left: 24.11%;
  top: 2.38%;
  width: 56.74%;
}

.call-banner__avatar--cap {
  left: 24.82%;
  top: 2.38%;
  width: 53.4%;
}

.call-banner__avatar--glasses-hat {
  left: 23.4%;
  top: 2.5%;
  width: 53.2%;
}

.call-banner__avatar--headband-halo {
  left: 22.7%;
  top: 2.38%;
  width: 54.95%;
  height: 90.44%;
  z-index: 0;
}

.call-banner__avatar--headband-body {
  left: 36.16%;
  top: 69.31%;
  width: 29.1%;
  height: 49.74%;
}

.call-banner__avatar--headband-head {
  left: 35.09%;
  top: 26.8%;
  width: 30.17%;
  height: 50.65%;
}

.call-banner__avatar--headband-hair {
  left: 34.55%;
  top: 21.37%;
  width: 33.94%;
  height: 36.18%;
}

.call-banner__avatar--headband-expression {
  left: 41.8%;
  top: 49.8%;
  width: 17.3%;
  height: 19.6%;
}

.call-banner__avatar--headband-marks {
  left: 39.95%;
  top: 57.9%;
  width: 20.2%;
  height: 4%;
}

.call-banner__avatar--bucket-halo,
.call-banner__avatar--sidecap-halo {
  z-index: 0;
}

.call-banner__avatar--bucket-halo {
  left: 22.2%;
  top: 2.5%;
  width: 54.4%;
  height: 94%;
}

.call-banner__avatar--bucket-body {
  left: 36.74%;
  top: 72.99%;
  width: 28.26%;
  height: 50.76%;
}

.call-banner__avatar--bucket-head {
  left: 35.61%;
  top: 28.82%;
  width: 29.87%;
  height: 52.63%;
}

.call-banner__avatar--bucket-hat {
  left: 33%;
  top: 13.78%;
  width: 35.09%;
  height: 39.48%;
}

.call-banner__avatar--bucket-expression {
  left: 40.92%;
  top: 54.2%;
  width: 16%;
  height: 16.41%;
}

.call-banner__avatar--beanie-body {
  left: 24.82%;
  top: 2.5%;
  width: 53.19%;
  height: 115.81%;
}

.call-banner__avatar--beanie-head {
  left: 36.82%;
  top: 27.32%;
  width: 29.2%;
  height: 51.47%;
}

.call-banner__avatar--beanie-hat {
  left: 36.3%;
  top: 19.96%;
  width: 30.24%;
  height: 23.9%;
}

.call-banner__avatar--beanie-glasses {
  left: 39.25%;
  top: 45.39%;
  width: 24.3%;
  height: 14.4%;
}

.call-banner__avatar--beanie-expression {
  left: 44.12%;
  top: 50.29%;
  width: 15.64%;
  height: 21.8%;
}

.call-banner__avatar--sidecap-halo {
  left: 22.76%;
  top: 2.5%;
  width: 53.84%;
  height: 93%;
}

.call-banner__avatar--sidecap-body {
  left: 34.95%;
  top: 70.41%;
  width: 31.2%;
  height: 52.09%;
}

.call-banner__avatar--sidecap-head {
  left: 35.41%;
  top: 26.69%;
  width: 29.55%;
  height: 52.09%;
}

.call-banner__avatar--sidecap-hat {
  left: 28.15%;
  top: 18.31%;
  width: 36.29%;
  height: 33.4%;
}

.call-banner__avatar--sidecap-expression {
  left: 41.1%;
  top: 49.3%;
  width: 17%;
  height: 22%;
}

.landing-section--games .landing-section__title {
  left: calc(var(--u) * 1162.5);
  top: calc(var(--u) * 1162.97);
  width: calc(var(--u) * 246.75);
}

.landing-section--games .landing-section__lead {
  left: calc(var(--u) * 927.66);
  top: calc(var(--u) * 1231.97);
  width: calc(var(--u) * 743.25);
}

.games-grid {
  position: static;
}

.landing-games-panel {
  position: absolute;
  left: calc(var(--u) * 700.03);
  top: calc(var(--u) * 1154);
  width: calc(var(--u) * 1130);
  height: calc(var(--u) * 454);
  --app-home-card-border: calc(var(--u) * 7.5);
  --app-home-display: var(--sa-font-display);
  --app-home-glass-blur: calc(var(--u) * 1);
}

.landing-games-panel :deep(.app-games__panel) {
  height: 100%;
  min-height: 0;
  padding: 0;
  overflow: visible;
  border: 0;
  background: transparent;
  box-shadow: none;
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}

.landing-games-panel :deep(.app-games__title) {
  margin: 0 0 calc(var(--u) * 14);
  font-size: calc(var(--u) * 45);
  line-height: calc(var(--u) * 54);
  text-shadow: none;
}

.landing-games-panel :deep(.app-games__lead) {
  margin: 0 0 calc(var(--u) * 23);
  width: 100%;
  max-width: calc(var(--u) * 743.25);
  margin-inline: auto;
  font-family: 'Marmelad', sans-serif;
  font-size: calc(var(--u) * 18);
  line-height: calc(var(--u) * 28.5);
  color: #e6e9ff;
  opacity: 0.88;
}

.landing-games-panel :deep(.app-games__grid) {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-rows: repeat(2, calc(var(--u) * 144));
  flex: 0 0 auto;
  gap: calc(var(--u) * 28.5) calc(var(--u) * 32.25);
}

.landing-games-panel :deep(.app-game-card) {
  min-height: 0;
  padding: 0 calc(var(--u) * 36);
  border-radius: calc(var(--u) * 37.5);
  grid-template-columns: minmax(0, 1fr) calc(var(--u) * 118);
  column-gap: calc(var(--u) * 14);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.006) 36%, transparent 70%),
    radial-gradient(circle at 64% 22%, rgba(176, 123, 255, 0.04), transparent calc(var(--u) * 130)),
    linear-gradient(120deg, rgba(124, 77, 219, 0.014) 0%, rgba(60, 36, 99, 0.024) 100%),
    rgba(42, 21, 73, 0.025);
}

.landing-games-panel :deep(.app-game-card__title) {
  font-size: calc(var(--u) * 18);
  line-height: 1.06;
}

.landing-games-panel :deep(.app-game-card__visual) {
  height: calc(var(--u) * 108);
}

.games-grid__card {
  position: absolute;
  display: block;
  border-radius: calc(var(--u) * 37.5);
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.006) 36%, transparent 70%),
    radial-gradient(circle at calc(var(--u) * 180.36) calc(var(--u) * 12.49), rgba(172, 119, 255, 0.04) 0, rgba(172, 119, 255, 0.02) calc(var(--u) * 62), transparent calc(var(--u) * 116)),
    radial-gradient(circle at calc(var(--u) * 221.98) calc(var(--u) * 66.59), rgba(124, 77, 219, 0.035) 0, rgba(124, 77, 219, 0.018) calc(var(--u) * 58), transparent calc(var(--u) * 108)),
    linear-gradient(120deg, rgba(124, 77, 219, 0.014) 0%, rgba(60, 36, 99, 0.024) 100%),
    rgba(42, 21, 73, 0.025);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.26),
    inset 0 -1px 0 rgba(255, 255, 255, 0.08),
    0 calc(var(--u) * 12.486165046691895) calc(var(--u) * 27.747032165527344) rgba(0, 0, 0, 0.18);
  backdrop-filter: blur(calc(var(--u) * 1)) saturate(1.02);
  -webkit-backdrop-filter: blur(calc(var(--u) * 1)) saturate(1.02);
  outline: calc(var(--u) * 7.5) solid #fff;
  outline-offset: calc(var(--u) * -3.75);
  overflow: hidden;
  color: inherit;
  text-decoration: none;
  cursor: pointer;
  transition:
    transform 0.25s ease,
    box-shadow 0.25s ease,
    filter 0.25s ease;
}

.games-grid__card:hover {
  transform: translateY(calc(var(--u) * -6)) scale(1.02);
  box-shadow: 0 calc(var(--u) * 16) calc(var(--u) * 30) rgba(0, 0, 0, 0.35);
}

.games-grid__label {
  position: absolute;
  z-index: 1;
  white-space: pre-line;
  font-family: var(--sa-font-display);
  font-size: calc(var(--u) * 18);
  text-transform: uppercase;
  max-width: calc(100% - calc(var(--u) * 125));
  box-sizing: border-box;
}

.games-grid__icon {
  position: absolute;
  z-index: 1;
  object-fit: contain;
  transition: transform 0.25s ease;
}

.games-grid__card:hover .games-grid__icon {
  transform: rotate(-5deg) scale(1.1);
}

.landing-section--economy .landing-section__title {
  left: calc(var(--u) * 700.03);
  top: calc(var(--u) * 1740.97);
  width: calc(var(--u) * 1129.22);
}

.landing-section--economy .landing-section__lead {
  left: calc(var(--u) * 726);
  top: calc(var(--u) * 1808.97);
  width: calc(var(--u) * 1074.38);
}

.economy-banner {
  position: absolute;
  left: calc(var(--u) * 700.03);
  top: calc(var(--u) * 1860.47);
  width: calc(var(--u) * 1129.22);
  height: calc(var(--u) * 154.5);
  --economy-slot-title-scale: 30;
}

.landing-footer__seo {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

.landing-footer__seo-link {
  font-family: 'Marmelad', sans-serif;
  font-size: calc(var(--u) * 15.75);
  line-height: 1.35;
  color: #c4b5fd;
  text-decoration: underline;
  text-underline-offset: calc(var(--u) * 2);
}

.landing-footer__seo-link:hover,
.landing-footer__seo-link:focus-visible {
  color: #f5f3ff;
}

.landing-footer__panel,
.landing-footer__static,
.landing-footer__socials,
.landing-footer__columns {
  display: contents;
}

.landing-footer {
  position: relative;
  background: none;
  pointer-events: none;
}

.landing-footer > * {
  pointer-events: auto;
}

.landing-footer__locale-action,
.landing-footer__feedback-action {
  position: absolute;
  top: calc(var(--u) * 2242.28);
  z-index: 7;
  --app-landing-footer-action-height: calc(var(--u) * 45);
  --app-landing-footer-action-font-size: calc(var(--u) * 15);
  --app-landing-footer-action-radius: calc(var(--u) * 22.5);
  --app-landing-footer-locale-list-radius: calc(var(--u) * 19.5);
  --app-landing-footer-action-border: rgba(255, 255, 255, 0.96);
  --app-landing-footer-locale-border: rgba(255, 255, 255, 0.96);
  --app-landing-footer-locale-list-border: rgba(255, 255, 255, 0.28);
  --app-landing-footer-feedback-bg: #fff;
  --app-landing-footer-locale-bg: #fff;
  --app-landing-footer-feedback-hover-bg: #fff;
  --app-landing-footer-locale-hover-bg: #fff;
  --app-landing-footer-locale-hover-border: rgba(255, 255, 255, 0.96);
  --app-landing-footer-locale-list-bg: rgba(255, 255, 255, 0.62);
  --app-landing-footer-action-color: #17131d;
  --app-landing-footer-locale-option-color: #17131d;
  --app-landing-footer-locale-option-hover-bg: rgba(255, 255, 255, 0.78);
  --app-landing-footer-locale-option-hover-color: #17131d;
  --app-landing-footer-action-drop-shadow: rgba(10, 3, 24, 0.12);
  --app-landing-footer-hover-drop-shadow: rgba(10, 3, 24, 0.12);
}

.landing-footer__locale-action {
  left: calc(var(--u) * 700.03);
  --app-landing-footer-locale-width: calc(var(--u) * 148);
}

.landing-footer__feedback-action {
  left: calc(var(--u) * 1340.94);
  --app-landing-footer-feedback-width: calc(var(--u) * 148);
}

.landing-footer__locale-action,
.landing-footer__feedback-action {
  transition: transform 0.2s ease;
}

.landing-footer__locale-action:hover,
.landing-footer__locale-action:focus-within,
.landing-footer__feedback-action:hover,
.landing-footer__feedback-action:focus-within {
  transform: translateY(calc(var(--u) * -3)) scale(1.04);
}

.landing-footer__social {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
}

.landing-footer__social img {
  width: 84%;
  height: 84%;
  object-fit: contain;
  opacity: 1;
  filter: brightness(0) invert(1);
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.landing-footer__social:hover img {
  opacity: 1;
  transform: translateY(calc(var(--u) * -3)) scale(1.1);
}

.landing-footer__product,
.landing-footer__about {
  position: absolute;
  margin: 0;
  font-size: calc(var(--u) * 18);
  color: rgba(255, 255, 255, 0.6);
}

.landing-footer__product {
  left: calc(var(--u) * 1598.63);
  top: calc(var(--u) * 2233.13);
  width: calc(var(--u) * 140.625);
  line-height: calc(var(--u) * 36);
  letter-spacing: calc(var(--u) * 0.18);
}

.landing-footer__about {
  left: calc(var(--u) * 1728);
  top: calc(var(--u) * 2199.38);
  width: calc(var(--u) * 125.25);
  padding-top: calc(var(--u) * 34.5);
  line-height: calc(var(--u) * 34.5);
}

.landing-footer__product p,
.landing-footer__about p {
  margin: 0;
  transition: color 0.2s ease;
  cursor: default;
}

.landing-footer__product p:hover,
.landing-footer__about p:hover {
  color: #ffffff;
}

@media (max-width: 1599px) {
  .landing-auth {
    height: calc(var(--u) * 39.375);
    border-radius: calc(var(--u) * 19.5);
    overflow: hidden;
  }

  .landing-auth::before {
    width: auto;
    height: auto;
  }
}

/*
 * Desktop artboard: keep side gutters visually stable while the central designed blocks scale up.
 * The source frame has wide empty edges, so the rendered canvas grows faster than the viewport.
 */
@media (min-width: 961px) {
  .landing__canvas {
    width: max(1515px, calc((100vw - 300px) * 2));
    max-width: none;
  }
}

/* Narrow desktop / large tablet landscape: header mark reads oversized vs nav; scale whole lockup. */
@media (min-width: 961px) and (max-width: 1280px) {
  .landing__canvas {
    width: max(1580px, calc((100vw - 280px) * 2.05));
  }

  .landing-header__brand {
    transform: scale(0.86);
    transform-origin: left center;
  }
}

@media (max-width: 960px) {
  .landing__canvas {
    --landing-section-gutter: clamp(22px, 4vw, 30px);
    --landing-panel-width: 681px;
    width: 100%;
    aspect-ratio: auto;
    min-height: 100vh;
    padding: 21px var(--landing-section-gutter) 152px;
  }

  .landing__background {
    width: calc((var(--landing-backdrop-u) * 2560) + 240px);
  }

  .landing-decor-icons {
    --u: var(--landing-backdrop-u);
    left: 50%;
    right: auto;
    width: calc(var(--landing-backdrop-u) * 2560);
    transform: translateX(-50%);
  }

  .landing__bolt {
    display: none;
  }

  .landing-decor-icons__item {
    opacity: 0.88;
  }

  .landing__wordmark {
    left: 50%;
    width: min(calc(100% - (var(--landing-section-gutter) * 2)), 761px);
    font-size: clamp(32px, 9.9vw, 76.078px);
    line-height: 1.153;
    transform: translateX(-50%);
    will-change: auto;
  }

  .landing__wordmark--1 {
    top: auto;
    bottom: 202px;
  }

  .landing__wordmark--2 {
    top: auto;
    bottom: 138px;
  }

  .landing__wordmark--3 {
    top: auto;
    bottom: 72px;
  }

  .landing__wordmark--4 {
    top: auto;
    bottom: 6px;
  }

  .landing-topbar,
  .landing-auth,
  .landing-hero,
  .landing-section,
  .landing-footer {
    position: relative;
    left: auto;
    top: auto;
  }

  .landing-topbar {
    right: auto;
    width: 100%;
    min-height: 54px;
    height: auto;
    margin-bottom: 40px;
    padding: 0;
    gap: clamp(6px, 1.8vw, 14px);
  }

  .landing-header__brand {
    --u: 0.72px;
    width: 100px;
    height: 34px;
  }

  .landing-header__brand-mark {
    height: calc(var(--u) * 40);
    max-width: calc(var(--u) * 34);
    transform: translate(calc(var(--u) * -8.5), calc(var(--u) * 1.75));
  }

  .landing-header__brand-name {
    left: calc(var(--u) * 28);
    top: calc(var(--u) * 7.5);
    font-size: clamp(9px, 2.35vw, 10.5px);
    line-height: 1.12;
  }

  .landing-header__nav {
    position: relative;
    inset: auto;
    flex: 1 1 auto;
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: center;
    gap: clamp(6px, 1.4vw, 12px);
    min-width: 0;
    padding: 0;
    overflow-x: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .landing-header__nav::-webkit-scrollbar {
    display: none;
  }

  .landing-header__nav-link {
    position: relative;
    top: 0;
    left: auto !important;
    font-size: clamp(8px, 1.45vw, 10px);
    line-height: 1;
    white-space: nowrap;
  }

  .landing-auth {
    position: relative;
    top: auto;
    right: auto;
    left: auto;
    width: 83px;
    height: 39px;
    border-radius: 19.5px;
    border-color: rgba(255, 255, 255, 0.45);
    background:
      linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(255, 255, 255, 0.78)),
      rgba(255, 255, 255, 0.82);
    flex-shrink: 0;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.2),
      0 10px 24px rgba(10, 3, 24, 0.14);
  }

  .landing-auth::before {
    width: auto;
    height: auto;
    border-radius: inherit;
  }

  .landing-auth__link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    color: #111827;
    font-size: 13.5px;
  }

  .landing-auth__link:first-child {
    left: auto;
    top: auto;
    transform: none;
  }

  .landing-hero {
    display: grid;
    justify-items: center;
    gap: 18px;
    margin-bottom: 72px;
  }

  .landing-hero__copy {
    display: contents;
  }

  .landing-hero__headline {
    order: 1;
    position: relative;
    display: grid;
    gap: 0;
    max-width: 530px;
    justify-items: center;
    text-align: center;
  }

  .landing-hero__tagline,
  .landing-hero__lead {
    position: static;
    left: auto;
    top: auto;
    width: auto;
    height: auto;
    margin: 0;
    text-align: center;
  }

  .landing-hero__tagline {
    font-size: 32px;
    line-height: 41.133px;
    max-width: 530px;
  }

  .landing-hero__lead {
    order: 3;
    max-width: 551px;
    font-size: 12px;
    line-height: 25.397px;
  }

  .landing-hero__screen {
    order: 2;
    position: relative;
    left: auto;
    top: auto;
    width: min(100%, 594px);
    height: auto;
    aspect-ratio: 651 / 375;
    margin-inline: auto;
    overflow: hidden;
    border-radius: calc(var(--u) * 37.5);
    container-type: inline-size;
    --u: calc(100cqw / 648.64);
  }

  .landing-section {
    display: grid;
    justify-items: center;
    width: min(100%, var(--landing-panel-width));
    gap: 8px;
    margin-inline: auto;
    margin-top: 0;
  }

  .landing-section__title,
  .landing-section__lead {
    position: static;
    left: auto;
    top: auto;
    width: 100%;
    margin: 0;
    max-width: 42rem;
    text-align: center;
  }

  .landing-section__title {
    font-size: 32px;
    line-height: 51.806px;
  }

  .landing-section__lead {
    max-width: 663px;
    font-size: 12px;
    line-height: 25.35px;
  }

  .landing-section--videocall .landing-section__title,
  .landing-section--videocall .landing-section__lead,
  .landing-section--games .landing-section__title,
  .landing-section--games .landing-section__lead,
  .landing-section--economy .landing-section__title,
  .landing-section--economy .landing-section__lead {
    left: auto;
    top: auto;
    width: 100%;
  }

  .landing-section--videocall {
    margin-top: 42px;
  }

  .landing-section--games {
    margin-top: 84px;
  }

  .landing-section--economy {
    margin-top: 92px;
  }

  .call-banner {
    --u: calc(100cqw / 1124.25);
    position: relative;
    left: auto;
    top: auto;
    width: min(100%, var(--landing-panel-width));
    height: auto;
    aspect-ratio: 1124.25 / 360;
    margin-top: 0;
    padding: 0;
    display: block;
    box-sizing: border-box;
    container-type: inline-size;
    border-radius: calc(var(--u) * 41.25);
    border-width: calc(var(--u) * 7.5);
  }

  .call-banner__title,
  .call-banner__cards {
    --u: calc(100cqw / 1124.25);
  }

  .call-banner__title {
    display: none;
  }

  .call-banner__cards {
    --app-call-u: calc(100cqw / 641);
    position: absolute;
    left: calc(var(--u) * 42);
    top: 50%;
    width: calc(var(--u) * 1040);
    height: calc(var(--u) * 334);
    display: block;
    padding: 0;
    margin: 0;
    overflow: hidden;
    container-type: inline-size;
    border-radius: calc(var(--u) * 24);
    transform: translateY(calc(-50% + calc(var(--u) * 6)));
  }

  .call-banner__card {
    position: absolute;
    display: block;
    width: 22.44% !important;
    height: auto;
    aspect-ratio: auto;
    border-radius: calc(var(--app-call-u) * 14);
  }

  .call-banner__card:nth-child(n + 5) {
    display: block;
  }

  .call-banner__card:nth-child(-n + 4) {
    top: calc(var(--app-call-u) * 11);
    height: calc(var(--app-call-u) * 84.97);
  }

  .call-banner__card:nth-child(n + 5) {
    top: calc(var(--app-call-u) * 106.08);
    height: calc(var(--app-call-u) * 80.92);
  }

  .call-banner__card:nth-child(1),
  .call-banner__card:nth-child(5) {
    left: calc(var(--app-call-u) * 18) !important;
  }

  .call-banner__card:nth-child(2),
  .call-banner__card:nth-child(6) {
    left: calc(var(--app-call-u) * 171.04) !important;
  }

  .call-banner__card:nth-child(3),
  .call-banner__card:nth-child(7) {
    left: calc(var(--app-call-u) * 325.1) !important;
  }

  .call-banner__card:nth-child(4),
  .call-banner__card:nth-child(8) {
    left: calc(var(--app-call-u) * 478.14) !important;
  }

  .games-grid {
    position: relative;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 21px 25px;
    width: min(100%, var(--landing-panel-width));
    margin-top: 0;
    justify-content: center;
  }

  .landing-games-panel {
    position: relative;
    left: auto;
    top: auto;
    width: min(100%, var(--landing-panel-width));
    height: auto;
    --app-home-card-border: 6.689px;
    --app-home-glass-blur: 0.9px;
  }

  .landing-games-panel :deep(.app-games__panel) {
    height: auto;
    min-height: 0;
    padding: 0;
    overflow: visible;
  }

  .landing-games-panel :deep(.app-games__title) {
    margin: 0 0 8px;
    font-size: 32px;
    line-height: 51.806px;
  }

  .landing-games-panel :deep(.app-games__lead) {
    margin: 0 0 8px;
    max-width: 663px;
    margin-inline: auto;
    font-size: 12px;
    line-height: 25.35px;
    text-align: center;
  }

  .landing-games-panel :deep(.app-games__grid) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: none;
    gap: 21px 25px;
  }

  .landing-games-panel :deep(.app-game-card) {
    min-height: 128px;
    padding: 0 18px;
    border-radius: 33.445px;
    grid-template-columns: minmax(0, 1fr) min(88px, 24vw);
    column-gap: 10px;
  }

  .landing-games-panel :deep(.app-game-card__title) {
    font-size: clamp(11px, 2.6vw, 17px);
    line-height: 1.06;
  }

  .landing-games-panel :deep(.app-game-card__visual) {
    height: min(88px, 24vw);
  }

  .games-grid__card {
    position: relative;
    left: auto !important;
    top: auto !important;
    width: 100% !important;
    height: auto !important;
    min-height: 128px;
    box-sizing: border-box;
    border-radius: 33.445px;
    border: 6.689px solid #fff;
    background:
      linear-gradient(135deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.006) 36%, transparent 70%),
      radial-gradient(circle at 64% 22%, rgba(176, 123, 255, 0.04), transparent 130px),
      linear-gradient(120deg, rgba(124, 77, 219, 0.014) 0%, rgba(60, 36, 99, 0.024) 100%),
      rgba(42, 21, 73, 0.025);
    backdrop-filter: blur(0.9px) saturate(1.02);
    -webkit-backdrop-filter: blur(0.9px) saturate(1.02);
  }

  .games-grid__label {
    left: 18px !important;
    top: 50% !important;
    width: auto !important;
    max-width: min(calc(100% - 108px), 9.5rem) !important;
    height: auto !important;
    transform: translateY(-50%);
    font-size: clamp(11px, 2.6vw, 17px);
    line-height: 1.06;
  }

  .games-grid__icon {
    top: 50% !important;
    right: 14px;
    left: auto !important;
    width: min(88px, 24vw) !important;
    height: auto !important;
    transform: translateY(-50%);
  }

  .games-grid__card:hover .games-grid__icon {
    transform: translateY(-50%) rotate(-5deg) scale(1.1);
  }

  .games-grid__card:nth-child(1) { order: 1; }
  .games-grid__card:nth-child(2) { order: 2; }
  .games-grid__card:nth-child(3) { order: 5; }
  .games-grid__card:nth-child(4) { order: 3; }
  .games-grid__card:nth-child(5) { order: 4; }
  .games-grid__card:nth-child(6) { order: 6; }

  .landing-section--economy .landing-section__lead {
    max-width: 524px;
  }

  .economy-banner {
    position: relative;
    left: auto;
    top: auto;
    width: min(100%, var(--landing-panel-width));
    height: auto;
    aspect-ratio: 1129.22 / 154.5;
    margin-top: 0;
  }

  .landing-footer {
    margin-top: 88px;
    padding-bottom: 0;
  }

  .landing-footer__seo {
    display: none;
  }

  .landing-footer__panel {
    display: grid;
    width: min(100%, var(--landing-panel-width));
    margin: 0 auto;
    grid-template-columns: minmax(0, 1fr) auto auto minmax(0, 1fr) auto;
    grid-template-areas:
      '. socials socials . columns'
      '. locale feedback . columns';
    align-items: start;
    gap: 16px clamp(14px, 3vw, 28px);
  }

  .landing-footer__static {
    display: contents;
  }

  .landing-footer__locale-action {
    grid-area: locale;
    position: relative;
    left: auto;
    top: auto;
    align-self: start;
    justify-self: start;
    --app-landing-footer-action-height: 40px;
    --app-landing-footer-action-font-size: 13px;
    --app-landing-footer-locale-width: 112px;
  }

  .landing-footer__feedback-action {
    grid-area: feedback;
    position: relative;
    left: auto;
    top: auto;
    align-self: start;
    justify-self: start;
    --app-landing-footer-action-height: 40px;
    --app-landing-footer-action-font-size: 13px;
    --app-landing-footer-feedback-width: 112px;
  }

  .landing-footer__socials {
    grid-area: socials;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-wrap: wrap;
    gap: 28px;
    width: auto;
    justify-self: center;
  }

  .landing-footer__social {
    position: relative;
    left: auto !important;
    top: auto !important;
    width: 44px !important;
    height: 44px !important;
  }

  .landing-footer__social img {
    opacity: 1;
    filter: brightness(0) invert(1);
  }

  .landing-footer__columns {
    grid-area: columns;
    display: grid;
    grid-template-columns: repeat(2, auto);
    gap: 14px clamp(18px, 4vw, 34px);
    width: auto;
    max-width: none;
    margin: 0;
    justify-content: start;
    justify-self: end;
    align-self: start;
  }

  .landing-footer__product,
  .landing-footer__about {
    position: relative;
    left: auto;
    top: auto;
    width: auto;
    padding-top: 0;
    font-size: 10px;
    line-height: 2;
  }
}

@media (max-width: 800px) {
  .landing__canvas {
    --landing-section-gutter: clamp(18px, 4.5vw, 26px);
    --landing-panel-width: 681px;
    padding-inline: var(--landing-section-gutter);
    padding-bottom: 136px;
  }

  .landing-topbar {
    gap: 10px;
  }

  .landing-header__nav {
    gap: clamp(4px, 1.2vw, 10px);
  }

  .games-grid {
    gap: 18px;
  }

  .landing-footer__panel {
    gap: 18px 18px;
  }

  .landing-footer__socials {
    gap: 22px;
  }

  .landing-footer__social {
    width: 38px !important;
    height: 38px !important;
  }

  .landing__wordmark {
    width: min(calc(100% - (var(--landing-section-gutter) * 2)), 620px);
    font-size: clamp(30px, 8.4vw, 60px);
  }
}

@media (max-width: 560px) {
  .landing__canvas {
    --landing-section-gutter: 12px;
    --landing-panel-width: 426px;
    padding: 14px var(--landing-section-gutter) 88px;
  }

  .landing__wordmark {
    width: min(calc(100% - (var(--landing-section-gutter) * 2)), 296px);
    font-size: clamp(27px, 8.8vw, 36px);
    line-height: 1.153;
  }

  .landing__wordmark--1 {
    bottom: 74px;
  }

  .landing__wordmark--2 {
    bottom: 54px;
  }

  .landing__wordmark--3 {
    bottom: 34px;
  }

  .landing__wordmark--4 {
    bottom: 14px;
  }

  .landing-topbar {
    min-height: 48px;
    margin-bottom: 34px;
    align-items: center;
  }

  /*
   * <=560px: absolute + negative mark offset clipped off-screen; switch to flex + no horizontal nudge.
   */
  .landing-topbar__start {
    flex: 0 1 auto;
    min-width: 0;
    max-width: min(50vw, 136px);
  }

  .landing-header__brand {
    --u: 0.72px;
    position: relative;
    display: flex;
    align-items: center;
    gap: clamp(1px, 0.45vw, 3px);
    width: auto;
    max-width: 100%;
    min-width: 0;
    height: auto;
    min-height: 26px;
    overflow: visible;
  }

  .landing-header__brand-mark {
    position: relative;
    left: auto;
    top: auto;
    flex: 0 0 auto;
    width: auto;
    height: clamp(17px, 5vw, 23px);
    max-width: clamp(17px, 5vw, 23px);
    object-fit: contain;
    object-position: left center;
    transform: none;
  }

  .landing-header__brand-name {
    position: relative;
    left: auto;
    top: auto;
    flex: 1 1 auto;
    min-width: 0;
    margin: 0;
    font-size: clamp(6.5px, 2.65vw, 9px);
    line-height: 1.08;
  }

  .landing-header__nav {
    justify-content: center;
    gap: clamp(3px, 1.1vw, 8px);
  }

  .landing-header__nav-link {
    font-size: clamp(6px, 1.85vw, 8px);
  }

  .landing-auth {
    top: auto;
    right: auto;
    width: clamp(64px, 17vw, 88px);
    height: clamp(24px, 5.6vw, 32px);
    border-radius: 999px;
  }

  .landing-auth__link {
    font-size: clamp(7px, 2.2vw, 10px);
  }

  .landing-hero {
    gap: 12px;
    margin-bottom: 58px;
  }

  .landing-hero__tagline {
    max-width: min(100%, 360px);
    font-size: clamp(22px, 6.6vw, 28px);
    line-height: clamp(29.135px, 8vw, 36px);
  }

  .landing-hero__screen {
    width: min(100%, var(--landing-panel-width));
    max-width: 426px;
  }

  .landing-hero__lead {
    max-width: min(100%, 256px);
    font-size: clamp(8px, 1.95vw, 10px);
    line-height: clamp(17.58px, 4vw, 20px);
  }

  .landing-section {
    gap: 6px;
  }

  .landing-section--videocall {
    margin-top: 34px;
  }

  .landing-section--games {
    margin-top: 56px;
  }

  .landing-section--economy {
    margin-top: 60px;
  }

  .landing-section__title {
    font-size: clamp(22px, 6.6vw, 28px);
    line-height: 1.55;
  }

  .landing-section__lead {
    max-width: min(100%, 263px);
    font-size: clamp(8px, 1.95vw, 10px);
    line-height: clamp(10px, 3vw, 16px);
  }

  .call-banner {
    width: min(100%, var(--landing-panel-width));
    padding: 0;
    border-radius: calc(var(--u) * 41.25);
    border-width: calc(var(--u) * 7.5);
    gap: 0;
  }

  .call-banner__cards {
    display: block;
    gap: 0;
    width: calc(var(--u) * 1040);
    padding: 0;
    border-radius: calc(var(--u) * 24);
  }

  .call-banner__title {
    font-size: calc(var(--u) * 36);
  }

  .games-grid {
    grid-template-columns: 1fr;
    width: min(100%, var(--landing-panel-width));
    gap: 14px;
    margin-top: 0;
  }

  .landing-games-panel {
    width: min(100%, var(--landing-panel-width));
    --app-home-card-border: 3.5px;
  }

  .landing-games-panel :deep(.app-games__title) {
    font-size: clamp(22px, 6.6vw, 28px);
    line-height: 1.55;
    margin-bottom: 6px;
  }

  .landing-games-panel :deep(.app-games__lead) {
    margin-bottom: 6px;
    max-width: min(100%, 263px);
    margin-inline: auto;
    font-size: clamp(8px, 1.95vw, 10px);
    line-height: clamp(10px, 3vw, 16px);
    text-align: center;
  }

  .landing-games-panel :deep(.app-games__grid) {
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .landing-games-panel :deep(.app-game-card) {
    min-height: clamp(66px, 20vw, 96px);
    padding: 0 16px !important;
    border-radius: 24px;
    grid-template-columns: minmax(0, 1fr) min(72px, 22vw);
    border-width: var(--app-home-card-border) !important;
  }

  .landing-games-panel :deep(.app-game-card__title) {
    font-size: clamp(11px, 3.8vw, 16px) !important;
  }

  .landing-games-panel :deep(.app-game-card__visual) {
    height: min(72px, 22vw) !important;
  }

  .games-grid__card {
    min-height: clamp(66px, 20vw, 96px);
    border-radius: 24px;
    border-width: 3.5px;
  }

  .games-grid__label {
    left: 16px !important;
    width: auto !important;
    max-width: min(calc(100% - 96px), 10rem) !important;
    font-size: clamp(11px, 3.8vw, 16px);
    line-height: 1.06;
  }

  .games-grid__icon {
    right: 12px;
    width: min(72px, 22vw) !important;
  }

  .games-grid__card:nth-child(1) { order: 1; }
  .games-grid__card:nth-child(2) { order: 4; }
  .games-grid__card:nth-child(3) { order: 3; }
  .games-grid__card:nth-child(4) { order: 2; }
  .games-grid__card:nth-child(5) { order: 5; }
  .games-grid__card:nth-child(6) { order: 6; }

  .economy-banner {
    width: min(100%, var(--landing-panel-width));
  }

  .landing-footer {
    margin-top: 64px;
  }

  .landing-footer__panel {
    width: min(100%, var(--landing-panel-width));
    grid-template-columns: minmax(0, 1fr) auto auto minmax(0, 1fr) auto;
    grid-template-areas:
      '. socials socials . columns'
      '. locale feedback . columns';
    gap: 12px 10px;
    align-items: start;
  }

  .landing-footer__locale-action {
    --app-landing-footer-action-height: 26px;
    --app-landing-footer-action-font-size: 10.5px;
    --app-landing-footer-locale-width: 78px;
  }

  .landing-footer__feedback-action {
    --app-landing-footer-action-height: 26px;
    --app-landing-footer-action-font-size: 10.5px;
    --app-landing-footer-feedback-width: 78px;
  }

  .landing-footer__columns {
    width: auto;
    max-width: none;
    margin: 0;
    grid-template-columns: repeat(2, auto);
    gap: 10px 14px;
    justify-self: end;
  }

  .landing-footer__product,
  .landing-footer__about {
    font-size: 8px;
    line-height: 1.7;
  }

  .landing-footer__socials {
    justify-content: center;
    gap: 16px;
  }

  .landing-footer__social {
    width: 26px !important;
    height: 26px !important;
  }
}

@media (max-width: 430px) {
  .landing__canvas {
    --landing-panel-width: 296px;
    padding-bottom: 84px;
  }

  .landing__wordmark {
    width: 296px;
    font-size: clamp(26px, 8.4vw, 31px);
  }

  .landing__wordmark--1 {
    bottom: 58px;
  }

  .landing__wordmark--2 {
    bottom: 42px;
  }

  .landing__wordmark--3 {
    bottom: 26px;
  }

  .landing__wordmark--4 {
    bottom: 10px;
  }

  .landing-topbar {
    min-height: 44px;
    margin-bottom: 32px;
  }

  .landing-header__nav {
    gap: 4px;
  }

  .landing-header__nav-link {
    font-size: clamp(5.5px, 1.7vw, 6.5px);
  }

  .landing-auth {
    width: 58px;
    height: 22px;
  }

  .landing-auth__link {
    font-size: 6.4px;
  }

  .landing-hero__headline {
    width: 242px;
  }

  .landing-hero__tagline {
    max-width: 242px;
    font-size: 18px;
    line-height: 23px;
  }

  .landing-hero__screen {
    max-width: 296px;
  }

  .landing-hero__lead,
  .landing-section__lead {
    max-width: 244px;
    font-size: 8px;
    line-height: 14px;
  }

  .landing-section {
    gap: 5px;
  }

  .landing-section__title {
    font-size: 18px;
    line-height: 28px;
  }

  .call-banner {
    padding: 0;
    gap: 0;
    border-radius: calc(var(--u) * 41.25);
    border-width: calc(var(--u) * 7.5);
  }

  .call-banner__cards {
    gap: 0;
    padding: 0;
    border-radius: calc(var(--u) * 30);
  }

  .call-banner__title {
    font-size: calc(var(--u) * 36);
  }

  .games-grid {
    gap: 12px;
  }

  .landing-games-panel :deep(.app-games__grid) {
    gap: 12px;
  }

  .landing-games-panel :deep(.app-games__title) {
    margin-bottom: 5px;
  }

  .landing-games-panel :deep(.app-games__lead) {
    margin-bottom: 5px;
  }

  .landing-games-panel :deep(.app-game-card) {
    min-height: 74px !important;
    padding: 0 12px !important;
    border-radius: 20px;
    grid-template-columns: minmax(0, 1fr) min(52px, 20vw);
    --app-home-card-border: 3px;
    border-width: var(--app-home-card-border) !important;
  }

  .landing-games-panel :deep(.app-game-card__title) {
    font-size: clamp(10px, 3.2vw, 12.5px) !important;
    line-height: 1.05;
  }

  .landing-games-panel :deep(.app-game-card__visual) {
    height: min(52px, 20vw) !important;
  }

  .games-grid__card {
    min-height: 74px;
    border-radius: 20px;
    border-width: 3px;
  }

  .games-grid__label {
    left: 12px !important;
    width: auto !important;
    max-width: min(calc(100% - 80px), 7.5rem) !important;
    font-size: clamp(10px, 3.2vw, 12.5px);
    line-height: 1.05;
  }

  .games-grid__icon {
    right: 10px;
    width: min(52px, 20vw) !important;
  }

  .economy-banner {
    width: min(100%, var(--landing-panel-width));
  }

  .landing-footer {
    margin-top: 58px;
  }

  .landing-footer__panel {
    grid-template-columns: auto minmax(0, 1fr) auto minmax(0, 1fr) auto;
    grid-template-areas:
      'locale . socials . columns'
      'feedback . socials . columns';
    gap: 8px 10px;
    align-items: start;
  }

  .landing-footer__locale-action {
    --app-landing-footer-action-height: 22px;
    --app-landing-footer-action-font-size: 8.5px;
    --app-landing-footer-locale-width: 68px;
  }

  .landing-footer__feedback-action {
    --app-landing-footer-action-height: 22px;
    --app-landing-footer-action-font-size: 8.5px;
    --app-landing-footer-feedback-width: 68px;
  }

  .landing-footer__socials {
    display: grid;
    grid-template-columns: repeat(2, 26px);
    gap: 10px 14px;
    justify-content: center;
    align-items: center;
    justify-self: center;
    margin-top: 4px;
  }

  .landing-footer__social {
    width: 26px !important;
    height: 26px !important;
  }

  .landing-footer__columns {
    gap: 8px 10px;
  }

  .landing-footer__product,
  .landing-footer__about {
    font-size: 7px;
    line-height: 1.55;
  }
}

@media (prefers-reduced-motion: reduce) {
  .landing__dot {
    animation: none;
    transform: none;
    will-change: auto;
  }

  .landing__wordmark {
    transform: none;
    will-change: auto;
  }

  .landing__background {
    transform: none;
    will-change: auto;
  }

  .call-banner,
  .economy-banner {
    animation: none;
  }

  .call-banner__card,
  .call-banner__avatar-layer {
    animation: none;
    transition: none;
  }

  .call-banner__card:hover {
    transform: none;
  }
}

</style>

<style>
  /* Landing only: viewport “camera” crops the fixed canvas; no horizontal page scroll. */
  body:has(.landing) {
    overflow-x: hidden;
  }
</style>
