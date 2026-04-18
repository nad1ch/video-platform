<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import heroSideAsset from '@/assets/landing-dev/hero-side.svg'
import callCardOne from '@/assets/landing-dev/call-card-1.svg'
import callCardTwo from '@/assets/landing-dev/call-card-2.svg'
import callCardThree from '@/assets/landing-dev/call-card-3.svg'
import bgBoltGlowLarge from '@/assets/landing-dev/bg-bolt-glow-large.svg'
import bgBoltGlowLargeTwo from '@/assets/landing-dev/bg-bolt-glow-large-2.svg'
import bgBoltGlowSmall from '@/assets/landing-dev/bg-bolt-glow-small.svg'
import bgBoltSharpLeft from '@/assets/landing-dev/bg-bolt-sharp-left.svg'
import bgBoltSharpRight from '@/assets/landing-dev/bg-bolt-sharp-right.svg'
import bgBoltSmall from '@/assets/landing-dev/bg-bolt-small.svg'
import eatFirstIcon from '@/assets/landing/eat-first.png'
import garticPhoneIcon from '@/assets/landing/gartic-phone.png'
import instagramIcon from '@/assets/landing/instagram.png'
import mafiaIcon from '@/assets/landing/mafia.png'
import spyIcon from '@/assets/landing/spy.png'
import telegramIcon from '@/assets/landing/telegram.png'
import tiktokIcon from '@/assets/landing/tiktok.png'
import twitchIcon from '@/assets/landing/twitch.png'
import whoTakeShitIcon from '@/assets/landing/who-take-shit.png'
import wordlivIcon from '@/assets/landing/wordliv.png'
import { persistLocale } from '@/eat-first/i18n/index.js'
import { STREAM_APP_BRAND_NAME, STREAMER_NICK, STREAMER_TWITCH_URL } from '@/eat-first/constants/brand.js'
import { getLandingScrollTopForHash } from '@/utils/landingAnchorScroll'
import { landingDesignPx as px } from '@/utils/landingDesignPx'
import { landingCosmicGlows as glows, landingCosmicSparkleDots as sparkleDots } from '@/utils/landingCosmicDecor'
import { useLandingCosmicParallax } from '@/composables/useLandingCosmicParallax'

const { locale } = useI18n()
const route = useRoute()
const router = useRouter()

const defaultWordleStreamer =
  (typeof import.meta.env.VITE_DEFAULT_STREAMER === 'string' && import.meta.env.VITE_DEFAULT_STREAMER.trim()) ||
  STREAMER_NICK

type PositionedBolt = {
  asset: string
  x: number
  y: number
  width: number
  height: number
  rotate: number
  opacity: number
  blur: number
}

type NavItem = {
  label: string
  href: string
}

type CallBannerCard = {
  asset: string
  style: Readonly<Record<string, string>>
}

type GameCard = {
  title: string
  icon: string
  to: { name: string; query?: Record<string, string>; params?: Record<string, string> }
  cardStyle: Readonly<Record<string, string>>
  labelStyle: Readonly<Record<string, string>>
  iconStyle: Readonly<Record<string, string>>
}

const authRoute = { path: '/app', query: { needLogin: '1' } } as const
const callRoute = { name: 'call' } as const
const homeRoute = { name: 'home' } as const

const navItems = Object.freeze([
  Object.freeze({ label: 'VideoCall', href: '#videocall', style: Object.freeze({ left: px(496.22) }) }),
  Object.freeze({ label: 'Games', href: '#games', style: Object.freeze({ left: px(583.97) }) }),
  Object.freeze({ label: 'Economy', href: '#economy', style: Object.freeze({ left: px(658.22) }) }),
  Object.freeze({ label: 'Safety', href: '#footer', style: Object.freeze({ left: px(738.47) }) }),
  Object.freeze({ label: 'Support', href: '#footer', style: Object.freeze({ left: px(804.47) }) }),
  Object.freeze({ label: 'Developers', href: '#footer', style: Object.freeze({ left: px(887.44) }) }),
] as readonly (NavItem & { style: Readonly<Record<string, string>> })[])

/** Labels match `eat-first` i18n locale codes (`VALID` in i18n/index.js includes pl, not es). */
const localeButtons = Object.freeze([
  Object.freeze({ code: 'en', label: 'English' }),
  Object.freeze({ code: 'de', label: 'German' }),
  Object.freeze({ code: 'uk', label: 'Ukrainian' }),
  Object.freeze({ code: 'pl', label: 'Polish' }),
] as const)

const heroLeftLineTops = [82.6, 95.98, 109.35, 122.73] as const
const heroLeftLineStyles = Object.freeze(
  heroLeftLineTops.map((top) =>
    Object.freeze({
      key: top,
      style: Object.freeze({ top: px(top) }),
    }),
  ),
)

const heroLineTop136_1 = Object.freeze({ top: px(136.1) })
const heroLineTop82_6 = Object.freeze({ top: px(82.6) })
const heroLineTop95_98 = Object.freeze({ top: px(95.98) })
const heroLineTop109_35 = Object.freeze({ top: px(109.35) })
const heroLineTop122_73 = Object.freeze({ top: px(122.73) })

const boltsRaw: PositionedBolt[] = [
  { asset: bgBoltSmall, x: 1142.96, y: 130.93, width: 67.25, height: 79.72, rotate: -16, opacity: 0.94, blur: 1.42 },
  { asset: bgBoltSharpRight, x: 2438.47, y: 238.25, width: 108.38, height: 79.33, rotate: 156, opacity: 0.96, blur: 0 },
  { asset: bgBoltSharpLeft, x: 1810.77, y: 2029, width: 108.38, height: 79.33, rotate: 24, opacity: 0.96, blur: 0 },
  { asset: bgBoltSmall, x: 898.64, y: 1845.14, width: 71.05, height: 84.22, rotate: -164, opacity: 0.92, blur: 1.5 },
  { asset: bgBoltGlowLarge, x: 863.81, y: 411.53, width: 135.69, height: 134.07, rotate: 18, opacity: 0.5, blur: 3.07 },
  { asset: bgBoltGlowLargeTwo, x: 1307.83, y: 2169.14, width: 135.69, height: 134.07, rotate: 162, opacity: 0.34, blur: 3.07 },
  { asset: bgBoltGlowLargeTwo, x: 2302.33, y: 2226.54, width: 135.69, height: 134.07, rotate: 162, opacity: 0.18, blur: 3.07 },
  { asset: bgBoltGlowSmall, x: 429, y: 372.4, width: 90.21, height: 112.94, rotate: -15, opacity: 0.94, blur: 3.07 },
  { asset: bgBoltGlowSmall, x: 246.42, y: 1420.07, width: 90.21, height: 112.94, rotate: 165, opacity: 0.82, blur: 3.07 },
  { asset: bgBoltGlowSmall, x: 2431.12, y: 2344.47, width: 90.21, height: 112.94, rotate: -165, opacity: 0.72, blur: 3.07 },
  { asset: bgBoltGlowSmall, x: 860.42, y: 1146.07, width: 90.21, height: 112.94, rotate: 165, opacity: 0.88, blur: 3.07 },
  { asset: bgBoltGlowSmall, x: 2254.42, y: 1422.07, width: 90.21, height: 112.94, rotate: 165, opacity: 0.72, blur: 3.07 },
  { asset: bgBoltGlowSmall, x: 235.38, y: 2464.5, width: 90.21, height: 112.94, rotate: 15, opacity: 0.82, blur: 3.07 },
]

const bolts = Object.freeze(
  boltsRaw.map((bolt) =>
    Object.freeze({
      ...bolt,
      style: Object.freeze({
        left: px(bolt.x),
        top: px(bolt.y),
        width: px(bolt.width),
        height: px(bolt.height),
        opacity: String(bolt.opacity),
        filter: `blur(${px(bolt.blur)})`,
        transform: `translate3d(var(--landing-parallax-bolt-x, 0px), var(--landing-parallax-bolt-y, 0px), 0) rotate(${bolt.rotate}deg)`,
      }),
    }),
  ),
)

const heroCards = Object.freeze([
  Object.freeze({
    variant: 'purple' as const,
    avatar: '#f5a875',
    body: '#2a2a2d',
    avatarStyle: Object.freeze({ background: '#f5a875' }),
    bodyStyle: Object.freeze({ background: '#2a2a2d' }),
  }),
  Object.freeze({
    variant: 'gray' as const,
    avatar: '#f5a875',
    body: '#2a2a2d',
    avatarStyle: Object.freeze({ background: '#f5a875' }),
    bodyStyle: Object.freeze({ background: '#2a2a2d' }),
  }),
  Object.freeze({
    variant: 'purple' as const,
    avatar: '#f0bf67',
    body: '#2a2a2d',
    avatarStyle: Object.freeze({ background: '#f0bf67' }),
    bodyStyle: Object.freeze({ background: '#2a2a2d' }),
  }),
  Object.freeze({
    variant: 'gray' as const,
    avatar: '#77b665',
    body: '#2a2a2d',
    avatarStyle: Object.freeze({ background: '#77b665' }),
    bodyStyle: Object.freeze({ background: '#2a2a2d' }),
  }),
])

const callBannerCards = Object.freeze([
  Object.freeze({ asset: callCardOne, style: Object.freeze({ left: px(14.35) }) }),
  Object.freeze({ asset: callCardTwo, style: Object.freeze({ left: px(156.29) }) }),
  Object.freeze({ asset: callCardThree, style: Object.freeze({ left: px(298.22) }) }),
  Object.freeze({ asset: callCardOne, style: Object.freeze({ left: px(440.16) }) }),
] as readonly CallBannerCard[])

const games = Object.freeze([
  Object.freeze({
    title: 'Who we\nshould\neat first',
    icon: eatFirstIcon,
    to: { name: 'eat', query: { view: 'join' } },
    cardStyle: Object.freeze({
      left: px(705),
      top: px(1283.37),
      width: px(352.5),
      height: px(144),
    }),
    labelStyle: Object.freeze({
      left: px(36.76),
      top: px(35.38),
      width: px(161.63),
      height: px(107.52),
    }),
    iconStyle: Object.freeze({
      left: px(203.25),
      top: px(25.67),
      width: px(95.03),
      height: px(95.03),
    }),
  } satisfies GameCard),
  Object.freeze({
    title: 'Mafia',
    icon: mafiaIcon,
    to: { name: 'home' },
    cardStyle: Object.freeze({
      left: px(1089.75),
      top: px(1282.62),
      width: px(352.5),
      height: px(144),
    }),
    labelStyle: Object.freeze({
      left: px(41.62),
      top: px(60.35),
      width: px(120.7),
      height: px(26.36),
    }),
    iconStyle: Object.freeze({
      left: px(180.36),
      top: px(13.87),
      width: px(119.31),
      height: px(119.31),
    }),
  } satisfies GameCard),
  Object.freeze({
    title: 'Spy',
    icon: spyIcon,
    to: { name: 'home' },
    cardStyle: Object.freeze({
      left: px(1473.75),
      top: px(1282.62),
      width: px(352.5),
      height: px(144),
    }),
    labelStyle: Object.freeze({
      left: px(52.72),
      top: px(60.35),
      width: px(120.7),
      height: px(26.36),
    }),
    iconStyle: Object.freeze({
      left: px(162.32),
      top: px(4.86),
      width: px(136.65),
      height: px(136.65),
    }),
  } satisfies GameCard),
  Object.freeze({
    title: 'Wordly',
    icon: wordlivIcon,
    to: { name: 'wordle-streamer', params: { streamer: defaultWordleStreamer } },
    cardStyle: Object.freeze({
      left: px(705),
      top: px(1455.87),
      width: px(352.5),
      height: px(144),
    }),
    labelStyle: Object.freeze({
      left: px(35.38),
      top: px(56.88),
      width: px(144.98),
      height: px(31.22),
    }),
    iconStyle: Object.freeze({
      left: px(199.78),
      top: px(17.34),
      width: px(108.21),
      height: px(108.21),
    }),
  } satisfies GameCard),
  Object.freeze({
    title: 'Gartic\nphone',
    icon: garticPhoneIcon,
    to: { name: 'home' },
    cardStyle: Object.freeze({
      left: px(1089.75),
      top: px(1455.12),
      width: px(352.5),
      height: px(144),
    }),
    labelStyle: Object.freeze({
      left: px(35.38),
      top: px(45.78),
      width: px(144.98),
      height: px(54.11),
    }),
    iconStyle: Object.freeze({
      left: px(193.54),
      top: px(18.73),
      width: px(108.21),
      height: px(108.21),
    }),
  } satisfies GameCard),
  Object.freeze({
    title: 'Who\ntake a\nshit',
    icon: whoTakeShitIcon,
    to: { name: 'home' },
    cardStyle: Object.freeze({
      left: px(1473.75),
      top: px(1455.87),
      width: px(352.5),
      height: px(144),
    }),
    labelStyle: Object.freeze({
      left: px(40.93),
      top: px(34.68),
      width: px(139.43),
      height: px(70.06),
    }),
    iconStyle: Object.freeze({
      left: px(189.37),
      top: px(23.59),
      width: px(93.65),
      height: px(93.65),
    }),
  } satisfies GameCard),
])

const socialLinks = Object.freeze([
  Object.freeze({
    alt: 'Instagram',
    icon: instagramIcon,
    href: 'https://www.instagram.com/',
    style: Object.freeze({
      left: px(884.25),
      top: px(2227.5),
      width: px(62.58),
      height: px(62.58),
    }),
  }),
  Object.freeze({
    alt: 'TikTok',
    icon: tiktokIcon,
    href: 'https://www.tiktok.com/',
    style: Object.freeze({
      left: px(993.94),
      top: px(2230.31),
      width: px(61.17),
      height: px(61.17),
    }),
  }),
  Object.freeze({
    alt: 'Telegram',
    icon: telegramIcon,
    href: 'https://telegram.org/',
    style: Object.freeze({
      left: px(1100.81),
      top: px(2227.5),
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
      top: px(2230.31),
      width: px(71.72),
      height: px(71.72),
    }),
  }),
])

const footerProduct = Object.freeze(['Product', 'Nitro', 'Status', 'Policies', 'Terms', 'Privacy', 'Cookie Settings'])
const footerAbout = Object.freeze(['About', 'Jobs', 'Brand', 'Newsroom', 'Developers'])

const slotLetters = Object.freeze(['T', 'W', 'I', 'T', 'C', 'H'] as const)

function syncDocumentTitle() {
  document.title = 'StreamAssist - where chat turns into the game'
}

type LandingLocaleCode = (typeof localeButtons)[number]['code']

async function selectLocale(code: LandingLocaleCode) {
  await persistLocale(code)
}

function landingPrefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function scrollLandingToHash(hash: string) {
  if (typeof window === 'undefined') return
  const top = getLandingScrollTopForHash(hash)
  window.scrollTo({ top, behavior: landingPrefersReducedMotion() ? 'auto' : 'smooth' })
}

function goLandingNav(href: string) {
  const hash = href.startsWith('#') ? href : `#${href}`
  void router.push({ path: '/', query: route.query, hash })
}

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

/** Layered scroll parallax (px) on decorative layers — shared with `LandingCosmicBackdrop`. */
const landingCanvasEl = ref<HTMLElement | null>(null)
useLandingCosmicParallax(landingCanvasEl)

onMounted(() => {
  syncDocumentTitle()
})
</script>

<template>
  <div class="landing page-stack">
    <div ref="landingCanvasEl" class="landing__canvas">
      <div v-once>
        <div class="landing__background" aria-hidden="true" />

        <p class="landing__wordmark landing__wordmark--1" aria-hidden="true">{{ STREAM_APP_BRAND_NAME }}</p>
        <p class="landing__wordmark landing__wordmark--2" aria-hidden="true">{{ STREAM_APP_BRAND_NAME }}</p>
        <p class="landing__wordmark landing__wordmark--3" aria-hidden="true">{{ STREAM_APP_BRAND_NAME }}</p>
        <p class="landing__wordmark landing__wordmark--4" aria-hidden="true">{{ STREAM_APP_BRAND_NAME }}</p>

        <span
          v-for="(dot, index) in sparkleDots"
          :key="`dot-${index}`"
          class="landing__dot"
          :class="`landing__dot--ph${dot.phase}`"
          :style="dot.style"
          aria-hidden="true"
        />

        <span
          v-for="(glow, index) in glows"
          :key="`glow-${index}`"
          class="landing__glow"
          :style="glow.style"
          aria-hidden="true"
        />

        <img
          v-for="(bolt, index) in bolts"
          :key="`bolt-${index}`"
          class="landing__bolt"
          :src="bolt.asset"
          alt=""
          :style="bolt.style"
          aria-hidden="true"
        />
      </div>

      <header class="landing-header">
        <div class="landing-header__brand">
          <span class="landing-header__brand-mark" aria-hidden="true">
            <span />
          </span>
          <p class="landing-header__brand-name">
            <span>Stream</span>
            <span>Assist</span>
          </p>
        </div>

        <a
          v-for="item in navItems"
          :key="item.label"
          class="landing-header__nav-link"
          :href="item.href"
          :style="item.style"
          @click.prevent="goLandingNav(item.href)"
        >
          {{ item.label }}
        </a>
      </header>

      <div class="landing-auth">
        <RouterLink class="landing-auth__link" :to="authRoute">Log In</RouterLink>
        <RouterLink class="landing-auth__link" :to="authRoute">Sing Up</RouterLink>
      </div>

      <section class="landing-hero" aria-label="Hero" v-once>
        <div class="landing-hero__screen" aria-hidden="true">
          <div class="landing-hero__screen-notch" />
          <div class="landing-hero__core">
            <div class="landing-hero__main-panel">
              <span class="landing-hero__live-pill" />

              <span
                v-for="line in heroLeftLineStyles"
                :key="`hero-left-${line.key}`"
                class="landing-hero__side-line landing-hero__side-line--left"
                :style="line.style"
              />
              <span
                class="landing-hero__side-line landing-hero__side-line--left landing-hero__side-line--blue"
                :style="heroLineTop136_1"
              />

              <span class="landing-hero__side-line landing-hero__side-line--right" :style="heroLineTop82_6" />
              <span
                class="landing-hero__side-line landing-hero__side-line--right landing-hero__side-line--yellow"
                :style="heroLineTop95_98"
              />
              <span class="landing-hero__side-line landing-hero__side-line--right" :style="heroLineTop109_35" />
              <span class="landing-hero__side-line landing-hero__side-line--right" :style="heroLineTop122_73" />
              <span class="landing-hero__side-line landing-hero__side-line--right" :style="heroLineTop136_1" />
            </div>

            <img class="landing-hero__side-asset" :src="heroSideAsset" alt="" />

            <div class="landing-hero__card-row">
              <article
                v-for="(card, index) in heroCards"
                :key="`hero-card-${index}`"
                class="landing-hero__mini-card"
                :class="{
                  'landing-hero__mini-card--purple': card.variant === 'purple',
                  'landing-hero__mini-card--gray': card.variant === 'gray',
                }"
              >
                <span class="landing-hero__mini-card-pill" />
                <span class="landing-hero__mini-card-avatar" :style="card.avatarStyle" />
                <span class="landing-hero__mini-card-line landing-hero__mini-card-line--white" />
                <span class="landing-hero__mini-card-line landing-hero__mini-card-line--violet" />
                <span class="landing-hero__mini-card-line" :style="card.bodyStyle" />
              </article>
            </div>
          </div>
        </div>

        <div class="landing-hero__copy">
          <h1 class="landing-hero__title landing-u-text-outline-heading">WHERE CHAT TURNS INTO THE GAME</h1>
          <p class="landing-hero__lead">
            Your stream isn&rsquo;t just something to watch &mdash; it&rsquo;s something to join.
            <br />
            Turn every moment into a shared experience with real-time chat, games, and video calls.
            <br />
            Interact, play, and connect with your audience like never before &mdash; all in one place, effortlessly.
          </p>
        </div>
      </section>

      <section id="videocall" class="landing-section landing-section--videocall">
        <h2 class="landing-section__title landing-u-text-outline-heading">VIDEOCALL</h2>
        <p class="landing-section__lead">Create private video rooms for games, challenges, and interactive sessions.</p>

        <RouterLink class="call-banner" :to="callRoute">
          <span class="call-banner__title landing-u-text-outline-cta">RUN THE SHOW</span>

          <span class="call-banner__cards">
            <img
              v-for="(card, index) in callBannerCards"
              :key="`call-card-${index}`"
              class="call-banner__card"
              :src="card.asset"
              alt=""
              :style="card.style"
            />
          </span>
        </RouterLink>
      </section>

      <section id="games" class="landing-section landing-section--games">
        <h2 class="landing-section__title landing-u-text-outline-heading">GAMES</h2>
        <p class="landing-section__lead">Play with friends, challenge others, or bring the action live to your audience.</p>

        <div class="games-grid">
          <RouterLink
            v-for="game in games"
            :key="game.title"
            :to="game.to"
            class="games-grid__card"
            :style="game.cardStyle"
          >
            <span class="games-grid__label landing-u-text-outline-game" :style="game.labelStyle">
              {{ game.title }}
            </span>
            <img
              class="games-grid__icon"
              :src="game.icon"
              :alt="game.title"
              width="128"
              height="128"
              loading="lazy"
              :style="game.iconStyle"
            />
          </RouterLink>
        </div>
      </section>

      <section id="economy" class="landing-section landing-section--economy">
        <h2 class="landing-section__title landing-u-text-outline-heading">ECONOMY</h2>
        <p class="landing-section__lead">
          Create your own in-stream economy with points, bonuses, and interactive mechanics that keep your audience
          coming back.
        </p>

        <div class="economy-banner">
          <span class="economy-banner__title landing-u-text-outline-cta">START EARNING</span>

          <div class="economy-banner__slot">
            <span class="economy-banner__jackpot">JACKPOT</span>

            <span class="economy-banner__cells">
              <span v-for="letter in slotLetters" :key="letter" class="economy-banner__cell">{{ letter }}</span>
            </span>

            <span class="economy-banner__slot-bar" />
            <span class="economy-banner__handle">
              <span class="economy-banner__handle-stick" />
            </span>
          </div>
        </div>
      </section>

      <footer id="footer" class="landing-footer">
        <div class="landing-footer__languages" role="group" aria-label="Interface language">
          <button
            v-for="item in localeButtons"
            :key="item.code"
            class="landing-footer__language"
            :class="{ 'landing-footer__language--active': locale === item.code }"
            type="button"
            @click="selectLocale(item.code)"
          >
            {{ item.label }}
          </button>
        </div>

        <div v-once>
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

          <RouterLink class="landing-footer__feedback" :to="homeRoute">Feedback</RouterLink>

          <div class="landing-footer__product">
            <p v-for="item in footerProduct" :key="item">{{ item }}</p>
          </div>

          <div class="landing-footer__about">
            <p v-for="item in footerAbout" :key="item">{{ item }}</p>
          </div>
        </div>
      </footer>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Arbutus&family=Climate+Crisis&family=Marmelad&display=swap');

/* Optional: add `<link rel="preload" as="style">` for this font URL in `index.html` to shorten critical path (keep @import until then). */

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
  justify-content: flex-start;
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
  --u: 1px;
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
  left: 50%;
  flex-shrink: 0;
  width: 2560px;
  height: auto;
  aspect-ratio: 2560 / 2655;
  min-height: calc(var(--u) * 2655);
  overflow: hidden;
  transform: translateX(-50%);
  background: linear-gradient(119.10504159217813deg, #0b0317 0%, rgba(74, 50, 116, 0.69) 73.206%);
  text-rendering: optimizeLegibility;
}

.landing__background {
  position: absolute;
  inset: 0;
  transform: translate3d(var(--landing-parallax-bg-x, 0px), var(--landing-parallax-bg-y, 0px), 0);
  will-change: transform;
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

.landing__wordmark {
  position: absolute;
  margin: 0;
  font-family: 'Climate Crisis', sans-serif;
  font-size: calc(var(--u) * 143.91);
  line-height: calc(var(--u) * 192.3);
  letter-spacing: calc(var(--u) * 1.4391);
  color: rgba(255, 255, 255, 0.02);
  pointer-events: none;
  white-space: nowrap;
  font-variation-settings: 'YEAR' 1979;
  transform: translate3d(var(--landing-parallax-mid-x, 0px), var(--landing-parallax-mid-y, 0px), 0);
  will-change: transform;
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

.landing-header {
  position: absolute;
  left: calc(var(--u) * 583.5);
  top: calc(var(--u) * 21);
  width: calc(var(--u) * 1387.5);
  height: calc(var(--u) * 61.5);
}

.landing-header__brand {
  position: absolute;
  left: 0;
  top: 0;
  width: calc(var(--u) * 165);
  height: calc(var(--u) * 52.5);
  overflow: visible;
}

.landing-header__brand-mark {
  position: absolute;
  left: calc(var(--u) * 0);
  top: calc(var(--u) * 0);
  width: calc(var(--u) * 24);
  height: calc(var(--u) * 24);
  transform: translate(calc(var(--u) * -15), calc(var(--u) * 2.25)) scale(3.375, 3);
  transform-origin: top left;
}

.landing-header__brand-mark::before,
.landing-header__brand-mark::after,
.landing-header__brand-mark span,
.landing-header__brand-mark span::before {
  content: '';
  position: absolute;
  border-radius: 999px;
  background: #fff;
}

.landing-header__brand-mark::before {
  inset: calc(var(--u) * 3) calc(var(--u) * 10) calc(var(--u) * 3) 0;
}

.landing-header__brand-mark::after {
  inset: calc(var(--u) * 10) 0 calc(var(--u) * 10) calc(var(--u) * 10);
}

.landing-header__brand-mark span {
  inset: calc(var(--u) * 2) calc(var(--u) * 10);
}

.landing-header__brand-mark span::before {
  width: 100%;
  height: 100%;
  transform: rotate(55deg);
}

.landing-header__brand-name {
  position: absolute;
  left: calc(var(--u) * 42);
  top: calc(var(--u) * 10.5);
  margin: 0;
  display: grid;
  font-family: 'Climate Crisis', sans-serif;
  font-size: calc(var(--u) * 12);
  line-height: calc(var(--u) * 12.6);
}

.landing-header__nav-link {
  position: absolute;
  top: calc(var(--u) * 17.16);
  color: #fff;
  font-family: 'Marmelad', sans-serif;
  font-size: calc(var(--u) * 12.75);
  line-height: 1;
  text-decoration: none;
  transition: opacity 0.16s ease;
}

.landing-header__nav-link:hover,
.landing-header__nav-link:focus-visible {
  opacity: 0.72;
}

.landing-auth {
  position: absolute;
  left: calc(var(--u) * 1865.81);
  top: calc(var(--u) * 30.94);
  width: calc(var(--u) * 82.969);
  height: calc(var(--u) * 67.5);
  border-radius: calc(var(--u) * 19.5);
  background: rgba(255, 255, 255, 0.45);
  overflow: hidden;
  z-index: 2;
}

.landing-auth::before {
  content: '';
  position: absolute;
  inset: 0 auto auto 0;
  width: calc(var(--u) * 82.969);
  height: calc(var(--u) * 39.38);
  border-radius: calc(var(--u) * 19.5);
  background: #fff;
}

.landing-auth__link {
  position: absolute;
  z-index: 1;
  color: #111827;
  font-family: 'Marmelad', sans-serif;
  font-size: calc(var(--u) * 13.5);
  line-height: 1;
  text-decoration: none;
}

.landing-auth__link:first-child {
  left: calc(var(--u) * 20.25);
  top: calc(var(--u) * 10.5);
}

.landing-auth__link:last-child {
  left: calc(var(--u) * 16.5);
  top: calc(var(--u) * 43.5);
}

.landing-hero__screen {
  position: absolute;
  left: calc(var(--u) * 707.06);
  top: calc(var(--u) * 213.75);
  width: calc(var(--u) * 648.64);
  height: calc(var(--u) * 372.6);
  border-radius: calc(var(--u) * 37.5);
  background: #fff;
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

.landing-hero__title,
.landing-section__title,
.call-banner__title,
.economy-banner__title {
  margin: 0;
  font-family: 'Climate Crisis', sans-serif;
  font-weight: 400;
  text-transform: uppercase;
}

.landing-hero__title {
  position: absolute;
  left: calc(var(--u) * 4.5);
  top: 0;
  width: calc(var(--u) * 474.75);
  font-size: calc(var(--u) * 45);
}

.landing-hero__lead,
.landing-section__lead,
.landing-footer__language,
.landing-footer__product,
.landing-footer__about,
.landing-footer__feedback,
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
  left: calc(var(--u) * 1086.56);
  top: calc(var(--u) * 745.31);
  width: calc(var(--u) * 387.75);
}

.landing-section--videocall .landing-section__lead {
  left: calc(var(--u) * 909.47);
  top: calc(var(--u) * 812.81);
  width: calc(var(--u) * 743.25);
}

.call-banner {
  position: absolute;
  left: calc(var(--u) * 707.06);
  top: calc(var(--u) * 856.31);
  width: calc(var(--u) * 1124.25);
  height: calc(var(--u) * 154.5);
  display: flex;
  align-items: center;
  border-radius: calc(var(--u) * 41.25);
  background:
    radial-gradient(circle at calc(var(--u) * 195) calc(var(--u) * 13.5), rgba(139, 92, 246, 0.14) 0, rgba(139, 92, 246, 0.14) calc(var(--u) * 45), transparent calc(var(--u) * 90)),
    radial-gradient(circle at calc(var(--u) * 240) calc(var(--u) * 72), rgba(124, 77, 219, 0.12) 0, rgba(124, 77, 219, 0.12) calc(var(--u) * 41.25), transparent calc(var(--u) * 82.5)),
    linear-gradient(120deg, rgba(124, 77, 219, 0.48) 0%, rgba(60, 36, 99, 0.47) 100%);
  box-shadow: 0 calc(var(--u) * 13.5) calc(var(--u) * 30) rgba(0, 0, 0, 0.18);
  outline: calc(var(--u) * 7.5) solid #fff;
  outline-offset: calc(var(--u) * -7.5);
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  animation: landingBannerIdle 11s ease-in-out infinite;
  transition:
    box-shadow 0.3s ease,
    filter 0.3s ease;
}

.call-banner:hover {
  box-shadow:
    0 calc(var(--u) * 13.5) calc(var(--u) * 36) rgba(0, 0, 0, 0.26),
    0 0 calc(var(--u) * 22) rgba(255, 255, 255, 0.14);
}

.call-banner__title {
  position: relative;
  flex-shrink: 0;
  margin: 0;
  margin-left: calc(var(--u) * 32.34);
  font-size: calc(var(--u) * 40.5);
}

.call-banner__cards {
  position: absolute;
  left: calc(var(--u) * 523.13);
  top: calc(var(--u) * 26.81);
  width: calc(var(--u) * 570.94);
  height: calc(var(--u) * 97.28);
  border-radius: calc(var(--u) * 12.76);
  background: #3c2463;
  z-index: 1;
}

.call-banner__card {
  position: absolute;
  top: calc(var(--u) * 14.36);
  width: calc(var(--u) * 118.02);
  height: calc(var(--u) * 70.17);
  object-fit: contain;
  transition:
    transform 0.2s ease,
    filter 0.2s ease;
}

.call-banner__card:hover {
  transform: translateY(calc(var(--u) * -4));
  filter: drop-shadow(0 calc(var(--u) * 10) calc(var(--u) * 14) rgba(0, 0, 0, 0.35));
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

.games-grid__card {
  position: absolute;
  display: block;
  border-radius: calc(var(--u) * 37.5);
  background:
    radial-gradient(circle at calc(var(--u) * 180.36) calc(var(--u) * 12.49), rgba(139, 92, 246, 0.14) 0, rgba(139, 92, 246, 0.14) calc(var(--u) * 41.62), transparent calc(var(--u) * 83.24)),
    radial-gradient(circle at calc(var(--u) * 221.98) calc(var(--u) * 66.59), rgba(124, 77, 219, 0.12) 0, rgba(124, 77, 219, 0.12) calc(var(--u) * 38.15), transparent calc(var(--u) * 76.3)),
    linear-gradient(120deg, rgba(124, 77, 219, 0.42) 0%, rgba(60, 36, 99, 0.72) 100%);
  box-shadow: 0 calc(var(--u) * 12.486165046691895) calc(var(--u) * 27.747032165527344) rgba(0, 0, 0, 0.18);
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
  font-family: 'Climate Crisis', sans-serif;
  font-size: calc(var(--u) * 22.2);
  text-transform: uppercase;
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
  left: calc(var(--u) * 1107.94);
  top: calc(var(--u) * 1759.22);
  width: calc(var(--u) * 407.25);
}

.landing-section--economy .landing-section__lead {
  left: calc(var(--u) * 726);
  top: calc(var(--u) * 1819.88);
  width: calc(var(--u) * 1074.38);
}

.economy-banner {
  position: absolute;
  left: calc(var(--u) * 700.03);
  top: calc(var(--u) * 1860.47);
  width: calc(var(--u) * 1129.22);
  height: calc(var(--u) * 154.5);
  display: flex;
  align-items: center;
  border-radius: calc(var(--u) * 41.25);
  background: linear-gradient(120deg, rgba(124, 77, 219, 0.48) 0%, rgba(60, 36, 99, 0.47) 100%);
  box-shadow: 0 calc(var(--u) * 13.5) calc(var(--u) * 30) rgba(0, 0, 0, 0.18);
  outline: calc(var(--u) * 7.5) solid #fff;
  outline-offset: calc(var(--u) * -7.5);
  overflow: hidden;
  animation: landingBannerIdle 12.5s ease-in-out infinite;
  animation-delay: 1.2s;
  transition: box-shadow 0.3s ease;
}

.economy-banner:hover {
  box-shadow:
    0 calc(var(--u) * 13.5) calc(var(--u) * 30) rgba(0, 0, 0, 0.18),
    0 0 calc(var(--u) * 40) rgba(160, 120, 255, 0.28);
}

.economy-banner__title {
  position: relative;
  flex-shrink: 0;
  margin: 0;
  margin-left: calc(var(--u) * 49.22);
  font-size: calc(var(--u) * 40.5);
}

.economy-banner__slot {
  position: absolute;
  left: calc(var(--u) * 662.35);
  top: calc(var(--u) * 18.28);
  width: calc(var(--u) * 429.19);
  height: calc(var(--u) * 97.03);
  transform: translateY(calc(var(--u) * 2));
}

.economy-banner__jackpot {
  position: absolute;
  left: calc(var(--u) * 122.34);
  top: 0;
  z-index: 1;
  width: calc(var(--u) * 142.031);
  height: calc(var(--u) * 35.156);
  display: flex;
  align-items: center;
  justify-content: center;
  border: calc(var(--u) * 3.75) solid #7c4ddb;
  box-sizing: border-box;
  border-radius: calc(var(--u) * 18);
  background: rgba(255, 59, 48, 0.52);
  font-family: 'Arbutus', serif;
  font-size: calc(var(--u) * 19.5);
  line-height: 1;
  letter-spacing: 0.04em;
}

.economy-banner__cells {
  position: absolute;
  left: 0;
  top: calc(var(--u) * 22.87);
  display: grid;
  z-index: 0;
  grid-template-columns:
    calc(var(--u) * 58.479)
    calc(var(--u) * 61.5)
    calc(var(--u) * 58.8)
    calc(var(--u) * 58.8)
    calc(var(--u) * 58.5)
    calc(var(--u) * 58.5);
  overflow: hidden;
  width: calc(var(--u) * 391.5);
  height: calc(var(--u) * 70.5);
  border: calc(var(--u) * 4.5) solid #66388f;
  box-sizing: border-box;
  border-radius: calc(var(--u) * 18);
  background: #c9d6ff;
}

.economy-banner__cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-right: calc(var(--u) * 0.75) solid #b3c2f5;
  background: #f7f8ff;
  color: rgba(87, 38, 130, 0.77);
  font-family: 'Arbutus', serif;
  font-size: calc(var(--u) * 40.5);
  line-height: 1;
}

.economy-banner__cell:last-child {
  border-right: 0;
}

.economy-banner__slot-bar {
  position: absolute;
  left: calc(var(--u) * 143.25);
  top: calc(var(--u) * 85.12);
  width: calc(var(--u) * 105);
  height: calc(var(--u) * 21);
  border: calc(var(--u) * 2.25) solid #fff;
  box-sizing: border-box;
  border-radius: calc(var(--u) * 10.5);
  background: rgba(60, 36, 99, 0.62);
}

.economy-banner__handle {
  position: absolute;
  left: calc(var(--u) * 409.21);
  top: calc(var(--u) * 30.94);
  width: calc(var(--u) * 19.688);
  height: calc(var(--u) * 66.094);
  border-radius: calc(var(--u) * 9);
  background: rgba(150, 131, 180, 0.63);
}

.economy-banner__handle::before {
  content: '';
  position: absolute;
  left: calc(var(--u) * -1.4);
  top: calc(var(--u) * -30.94);
  width: calc(var(--u) * 22.5);
  height: calc(var(--u) * 22.5);
  border-radius: 999px;
  background: radial-gradient(circle at 35% 35%, #ff786b, #d83c34 65%);
}

.economy-banner__handle-stick {
  position: absolute;
  left: calc(var(--u) * 6.28);
  top: calc(var(--u) * -16.32);
  width: calc(var(--u) * 6);
  height: calc(var(--u) * 43.5);
  border-radius: calc(var(--u) * 3);
  background: #1a1133;
}

.landing-footer {
  position: relative;
  background: linear-gradient(to top, rgba(20, 10, 40, 0.8), transparent);
  pointer-events: none;
}

.landing-footer > * {
  pointer-events: auto;
}

.landing-footer__languages {
  position: absolute;
  left: calc(var(--u) * 700.03);
  top: calc(var(--u) * 2227.5);
  width: calc(var(--u) * 140);
  height: calc(var(--u) * 156.09);
  box-sizing: border-box;
  border-radius: calc(var(--u) * 20);
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.landing-footer__language {
  position: absolute;
  border: 0;
  padding: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  font-size: calc(var(--u) * 18);
  text-align: left;
  cursor: pointer;
  z-index: 1;
  border-radius: calc(var(--u) * 14);
  transition:
    background 0.22s ease,
    color 0.22s ease,
    box-shadow 0.22s ease;
}

.landing-footer__language:nth-child(1) {
  left: calc(var(--u) * 26.44);
  top: calc(var(--u) * 9.84);
}

.landing-footer__language:nth-child(2) {
  left: calc(var(--u) * 22.69);
  top: calc(var(--u) * 53.44);
}

.landing-footer__language:nth-child(3) {
  left: calc(var(--u) * 19.69);
  top: calc(var(--u) * 86.44);
}

.landing-footer__language:nth-child(4) {
  left: calc(var(--u) * 23.44);
  top: calc(var(--u) * 119.44);
}

.landing-footer__language:hover:not(.landing-footer__language--active) {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.landing-footer__language.landing-footer__language--active {
  left: 0;
  top: calc(var(--u) * -2.81);
  width: calc(var(--u) * 117);
  height: calc(var(--u) * 46.5);
  padding-left: calc(var(--u) * 26.44);
  border-radius: calc(var(--u) * 14);
  background: #ffffff;
  color: #1a1a1a;
  font-weight: 500;
  display: flex;
  align-items: center;
  box-shadow: 0 calc(var(--u) * 2) calc(var(--u) * 8) rgba(0, 0, 0, 0.12);
}

.landing-footer__language.landing-footer__language--active:hover {
  background: #ffffff;
  color: #1a1a1a;
}

.landing-footer__social {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
}

.landing-footer__social img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: 0.45;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
}

.landing-footer__social:hover img {
  opacity: 1;
  transform: translateY(calc(var(--u) * -3)) scale(1.1);
}

.landing-footer__feedback {
  position: absolute;
  left: calc(var(--u) * 1376.44);
  top: calc(var(--u) * 2230.31);
  min-width: calc(var(--u) * 160.59);
  height: calc(var(--u) * 46.5);
  padding: calc(var(--u) * 10) calc(var(--u) * 22);
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: #ffffff;
  color: #1a1a1a;
  font-size: calc(var(--u) * 18);
  font-weight: 500;
  text-decoration: none;
  opacity: 1;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.landing-footer__feedback:hover {
  transform: translateY(calc(var(--u) * -2));
  box-shadow: 0 calc(var(--u) * 8) calc(var(--u) * 20) rgba(0, 0, 0, 0.25);
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
}

</style>

<style>
  /* Landing only: viewport “camera” crops the fixed canvas; no horizontal page scroll. */
  body:has(.landing) {
    overflow-x: hidden;
  }
</style>
