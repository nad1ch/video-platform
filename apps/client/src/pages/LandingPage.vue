<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { RouterLink } from 'vue-router'
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

const { locale } = useI18n()

const defaultWordleStreamer =
  (typeof import.meta.env.VITE_DEFAULT_STREAMER === 'string' && import.meta.env.VITE_DEFAULT_STREAMER.trim()) ||
  STREAMER_NICK

type PositionedDot = {
  x: number
  y: number
  size: number
  radius: number
}

type PositionedGlow = {
  x: number
  y: number
  width: number
  height: number
  background: string
  blur: number
  opacity?: number
  rotate?: number
}

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
  x: number
}

type CallBannerCard = {
  asset: string
  x: number
}

type GameCard = {
  title: string
  icon: string
  to: { name: string; query?: Record<string, string>; params?: Record<string, string> }
  x: number
  y: number
  width: number
  height: number
  labelX: number
  labelY: number
  labelWidth: number
  labelHeight: number
  iconX: number
  iconY: number
  iconWidth: number
  iconHeight: number
}

const navItems: NavItem[] = [
  { label: 'VideoCall', href: '#videocall', x: 496.22 },
  { label: 'Games', href: '#games', x: 583.97 },
  { label: 'Economy', href: '#economy', x: 658.22 },
  { label: 'Safety', href: '#footer', x: 738.47 },
  { label: 'Support', href: '#footer', x: 804.47 },
  { label: 'Developers', href: '#footer', x: 887.44 },
]

const localeButtons = [
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Germany' },
  { code: 'uk', label: 'Ukrainian' },
  { code: 'pl', label: 'Spanish' },
] as const

const heroLeftLineTops = [82.6, 95.98, 109.35, 122.73] as const

const sparkleDots: PositionedDot[] = [
  { x: 678, y: 72, size: 3, radius: 1.5 },
  { x: 754.5, y: 159, size: 4.5, radius: 2.25 },
  { x: 892.5, y: 109.5, size: 3.75, radius: 1.875 },
  { x: 1649.25, y: 819.75, size: 3.75, radius: 1.875 },
  { x: 354.75, y: 539.75, size: 3.75, radius: 1.875 },
  { x: 378.75, y: 1409.75, size: 3.75, radius: 1.875 },
  { x: 388.75, y: 1052.75, size: 3.75, radius: 1.875 },
  { x: 309.75, y: 2053.75, size: 3.75, radius: 1.875 },
  { x: 252.75, y: 2404.75, size: 3.75, radius: 1.875 },
  { x: 2336.75, y: 2310.75, size: 3.75, radius: 1.875 },
  { x: 2330.75, y: 1777.75, size: 3.75, radius: 1.875 },
  { x: 2283.75, y: 1413.75, size: 3.75, radius: 1.875 },
  { x: 2336.75, y: 1086.75, size: 3.75, radius: 1.875 },
  { x: 839.11, y: 1388.29, size: 3.47, radius: 1.734 },
  { x: 1108.5, y: 88.5, size: 3.75, radius: 1.875 },
  { x: 1345.5, y: 64.5, size: 3.75, radius: 1.875 },
  { x: 1495.5, y: 99, size: 3, radius: 1.5 },
  { x: 1803, y: 82.5, size: 4.5, radius: 2.25 },
  { x: 693, y: 351, size: 3, radius: 1.5 },
  { x: 1845.75, y: 1049.25, size: 3, radius: 1.5 },
  { x: 606, y: 1601.25, size: 3, radius: 1.5 },
  { x: 843, y: 405, size: 3.75, radius: 1.875 },
  { x: 1023, y: 474, size: 3, radius: 1.5 },
  { x: 1191, y: 385.5, size: 3.75, radius: 1.875 },
  { x: 1491, y: 435, size: 3.75, radius: 1.875 },
  { x: 1713, y: 393, size: 3, radius: 1.5 },
  { x: 1884, y: 465, size: 3.75, radius: 1.875 },
  { x: 589.5, y: 185, size: 3.75, radius: 1.875 },
  { x: 613.5, y: 1055, size: 3.75, radius: 1.875 },
  { x: 623.5, y: 698, size: 3.75, radius: 1.875 },
  { x: 544.5, y: 1699, size: 3.75, radius: 1.875 },
  { x: 487.5, y: 2050, size: 3.75, radius: 1.875 },
  { x: 2571.5, y: 1956, size: 3.75, radius: 1.875 },
  { x: 2565.5, y: 1423, size: 3.75, radius: 1.875 },
  { x: 2518.5, y: 1059, size: 3.75, radius: 1.875 },
  { x: 2571.5, y: 732, size: 3.75, radius: 1.875 },
  { x: 760.5, y: 615, size: 3, radius: 1.5 },
  { x: -534, y: 335, size: 3, radius: 1.5 },
  { x: -510, y: 1205, size: 3, radius: 1.5 },
  { x: -500, y: 848, size: 3, radius: 1.5 },
  { x: -579, y: 1849, size: 3, radius: 1.5 },
  { x: -636, y: 2200, size: 3, radius: 1.5 },
  { x: 1448, y: 2106, size: 3, radius: 1.5 },
  { x: 1442, y: 1573, size: 3, radius: 1.5 },
  { x: 1395, y: 1209, size: 3, radius: 1.5 },
  { x: 1448, y: 882, size: 3, radius: 1.5 },
  { x: 978, y: 721.5, size: 3.75, radius: 1.875 },
  { x: -316.5, y: 441.5, size: 3.75, radius: 1.875 },
  { x: -292.5, y: 1311.5, size: 3.75, radius: 1.875 },
  { x: -282.5, y: 954.5, size: 3.75, radius: 1.875 },
  { x: -361.5, y: 1955.5, size: 3.75, radius: 1.875 },
  { x: -418.5, y: 2306.5, size: 3.75, radius: 1.875 },
  { x: 1665.5, y: 2212.5, size: 3.75, radius: 1.875 },
  { x: 1659.5, y: 1679.5, size: 3.75, radius: 1.875 },
  { x: 1612.5, y: 1315.5, size: 3.75, radius: 1.875 },
  { x: 1665.5, y: 988.5, size: 3.75, radius: 1.875 },
  { x: 1173, y: 585, size: 3, radius: 1.5 },
  { x: 1390.5, y: 630, size: 3.75, radius: 1.875 },
  { x: 96, y: 350, size: 3.75, radius: 1.875 },
  { x: 120, y: 1220, size: 3.75, radius: 1.875 },
  { x: 130, y: 863, size: 3.75, radius: 1.875 },
  { x: 51, y: 1864, size: 3.75, radius: 1.875 },
  { x: -6, y: 2215, size: 3.75, radius: 1.875 },
  { x: 2078, y: 2121, size: 3.75, radius: 1.875 },
  { x: 2072, y: 1588, size: 3.75, radius: 1.875 },
  { x: 2025, y: 1224, size: 3.75, radius: 1.875 },
  { x: 2078, y: 897, size: 3.75, radius: 1.875 },
  { x: 1156.12, y: 1359.85, size: 3.47, radius: 1.734 },
  { x: 1623, y: 577.5, size: 3, radius: 1.5 },
  { x: 1840.5, y: 645, size: 4.5, radius: 2.25 },
  { x: 546, y: 365, size: 4.5, radius: 2.25 },
  { x: 570, y: 1235, size: 4.5, radius: 2.25 },
  { x: 580, y: 878, size: 4.5, radius: 2.25 },
  { x: 501, y: 1879, size: 4.5, radius: 2.25 },
  { x: 444, y: 2230, size: 4.5, radius: 2.25 },
  { x: 2528, y: 2136, size: 4.5, radius: 2.25 },
  { x: 2522, y: 1603, size: 4.5, radius: 2.25 },
  { x: 2475, y: 1239, size: 4.5, radius: 2.25 },
  { x: 2528, y: 912, size: 4.5, radius: 2.25 },
  { x: 739.91, y: 1374.42, size: 4.16, radius: 2.08 },
]

const glows: PositionedGlow[] = [
  { x: 734, y: 90, width: 195, height: 195, background: 'rgba(124, 58, 237, 0.18)', blur: 45 },
  { x: 2083.28, y: 436, width: 195, height: 195, background: 'rgba(124, 58, 237, 0.18)', blur: 45 },
  { x: 466.28, y: 661.5, width: 195, height: 195, background: 'rgba(124, 58, 237, 0.18)', blur: 45 },
  { x: 419, y: 1871, width: 195, height: 195, background: 'rgba(124, 58, 237, 0.18)', blur: 45 },
  { x: 2426, y: 2572.09, width: 195, height: 195, background: 'rgba(124, 58, 237, 0.18)', blur: 45 },
  { x: 1826.25, y: 984, width: 195, height: 195, background: 'rgba(124, 58, 237, 0.18)', blur: 45 },
  { x: 628.5, y: 1332.75, width: 195, height: 195, background: 'rgba(124, 58, 237, 0.18)', blur: 45 },
  { x: 624.75, y: 1743.75, width: 195, height: 195, background: 'rgba(124, 58, 237, 0.18)', blur: 45 },
  { x: 1683, y: 135, width: 225, height: 225, background: 'rgba(96, 165, 250, 0.16)', blur: 45 },
  { x: 66.48, y: 1068.84, width: 133.97, height: 133.97, background: 'rgba(96, 165, 250, 0.16)', blur: 26.79, rotate: -23 },
  { x: 1593, y: 525, width: 195, height: 195, background: 'rgba(139, 92, 246, 0.16)', blur: 45 },
  { x: -24, y: 572.5, width: 195, height: 195, background: 'rgba(139, 92, 246, 0.16)', blur: 45 },
  { x: 972.75, y: 1326, width: 195, height: 195, background: 'rgba(139, 92, 246, 0.16)', blur: 45 },
  { x: 942, y: 1826.25, width: 195, height: 195, background: 'rgba(139, 92, 246, 0.16)', blur: 45 },
  { x: 989.25, y: 92.25, width: 56.25, height: 55.5, background: 'rgba(196, 181, 253, 0.22)', blur: 9 },
  { x: 2357.03, y: 445.75, width: 56.25, height: 55.5, background: 'rgba(196, 181, 253, 0.22)', blur: 9 },
  { x: 740.03, y: 791.25, width: 56.25, height: 55.5, background: 'rgba(196, 181, 253, 0.22)', blur: 9 },
  { x: 112.25, y: 1557.25, width: 56.25, height: 55.5, background: 'rgba(196, 181, 253, 0.22)', blur: 9 },
  { x: 2152.25, y: 2562.34, width: 56.25, height: 55.5, background: 'rgba(196, 181, 253, 0.22)', blur: 9 },
  { x: 1552.5, y: 854.25, width: 56.25, height: 55.5, background: 'rgba(196, 181, 253, 0.22)', blur: 9 },
  { x: 928.59, y: 1372.34, width: 52.03, height: 51.33, background: 'rgba(196, 181, 253, 0.22)', blur: 8.32 },
  { x: 1823.25, y: 373.5, width: 82.5, height: 78.75, background: 'rgba(196, 181, 253, 0.22)', blur: 9 },
  { x: 214, y: 220, width: 82.5, height: 78.75, background: 'rgba(196, 181, 253, 0.22)', blur: 9 },
  { x: 681.47, y: 1207.59, width: 74.25, height: 72.75, background: 'rgba(196, 181, 253, 0.22)', blur: 9 },
  { x: 2049.25, y: 1561.09, width: 74.25, height: 72.75, background: 'rgba(196, 181, 253, 0.22)', blur: 9 },
  { x: 420.03, y: 2544.34, width: 74.25, height: 72.75, background: 'rgba(196, 181, 253, 0.22)', blur: 9 },
  { x: 2076, y: 905, width: 74.25, height: 72.75, background: 'rgba(196, 181, 253, 0.22)', blur: 9 },
  { x: 774, y: 1665.75, width: 74.25, height: 72.75, background: 'rgba(196, 181, 253, 0.22)', blur: 9 },
  { x: 1753.5, y: 1534.5, width: 76.5, height: 69.75, background: 'rgba(196, 181, 253, 0.22)', blur: 9 },
  { x: 1668, y: 95.25, width: 82.5, height: 80.25, background: 'rgba(147, 197, 253, 0.22)', blur: 9 },
  { x: 873.75, y: 882, width: 82.5, height: 80.25, background: 'rgba(147, 197, 253, 0.22)', blur: 9 },
  { x: 2377.97, y: 1318.57, width: 197.97, height: 192.57, background: 'rgba(147, 197, 253, 0.22)', blur: 21.6 },
  { x: 624.53, y: 137.25, width: 82.5, height: 80.25, background: 'rgba(147, 197, 253, 0.22)', blur: 9 },
  { x: 227.75, y: 2211.25, width: 82.5, height: 80.25, background: 'rgba(147, 197, 253, 0.22)', blur: 9 },
  { x: 2267.75, y: 1772.59, width: 82.5, height: 80.25, background: 'rgba(147, 197, 253, 0.22)', blur: 9 },
  { x: 1581, y: 1345.5, width: 82.5, height: 80.25, background: 'rgba(147, 197, 253, 0.22)', blur: 9 },
  { x: 1577.25, y: 1756.5, width: 82.5, height: 80.25, background: 'rgba(147, 197, 253, 0.22)', blur: 9 },
  { x: 1511.25, y: 1029, width: 82.5, height: 80.25, background: 'rgba(147, 197, 253, 0.22)', blur: 9 },
]

const bolts: PositionedBolt[] = [
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

const heroCards = [
  { variant: 'purple', avatar: '#f5a875', body: '#2a2a2d' },
  { variant: 'gray', avatar: '#f5a875', body: '#2a2a2d' },
  { variant: 'purple', avatar: '#f0bf67', body: '#2a2a2d' },
  { variant: 'gray', avatar: '#77b665', body: '#2a2a2d' },
] as const

const callBannerCards: CallBannerCard[] = [
  { asset: callCardOne, x: 14.35 },
  { asset: callCardTwo, x: 156.29 },
  { asset: callCardThree, x: 298.22 },
  { asset: callCardOne, x: 440.16 },
]

const games = computed<GameCard[]>(() => [
  {
    title: 'Who we\nshould\neat first',
    icon: eatFirstIcon,
    to: { name: 'eat', query: { view: 'join' } },
    x: 705,
    y: 1283.37,
    width: 352.5,
    height: 144,
    labelX: 36.76,
    labelY: 35.38,
    labelWidth: 161.63,
    labelHeight: 107.52,
    iconX: 203.25,
    iconY: 25.67,
    iconWidth: 95.03,
    iconHeight: 95.03,
  },
  {
    title: 'Mafia',
    icon: mafiaIcon,
    to: { name: 'home' },
    x: 1089.75,
    y: 1282.62,
    width: 352.5,
    height: 144,
    labelX: 41.62,
    labelY: 60.35,
    labelWidth: 120.7,
    labelHeight: 26.36,
    iconX: 180.36,
    iconY: 13.87,
    iconWidth: 119.31,
    iconHeight: 119.31,
  },
  {
    title: 'Spy',
    icon: spyIcon,
    to: { name: 'home' },
    x: 1473.75,
    y: 1282.62,
    width: 352.5,
    height: 144,
    labelX: 52.72,
    labelY: 60.35,
    labelWidth: 120.7,
    labelHeight: 26.36,
    iconX: 162.32,
    iconY: 4.86,
    iconWidth: 136.65,
    iconHeight: 136.65,
  },
  {
    title: 'Wordly',
    icon: wordlivIcon,
    to: { name: 'wordle-streamer', params: { streamer: defaultWordleStreamer } },
    x: 705,
    y: 1455.87,
    width: 352.5,
    height: 144,
    labelX: 35.38,
    labelY: 56.88,
    labelWidth: 144.98,
    labelHeight: 31.22,
    iconX: 199.78,
    iconY: 17.34,
    iconWidth: 108.21,
    iconHeight: 108.21,
  },
  {
    title: 'Gartic\nphone',
    icon: garticPhoneIcon,
    to: { name: 'home' },
    x: 1089.75,
    y: 1455.12,
    width: 352.5,
    height: 144,
    labelX: 35.38,
    labelY: 45.78,
    labelWidth: 144.98,
    labelHeight: 54.11,
    iconX: 193.54,
    iconY: 18.73,
    iconWidth: 108.21,
    iconHeight: 108.21,
  },
  {
    title: 'Who\ntake a\nshit',
    icon: whoTakeShitIcon,
    to: { name: 'home' },
    x: 1473.75,
    y: 1455.87,
    width: 352.5,
    height: 144,
    labelX: 40.93,
    labelY: 34.68,
    labelWidth: 139.43,
    labelHeight: 70.06,
    iconX: 189.37,
    iconY: 23.59,
    iconWidth: 93.65,
    iconHeight: 93.65,
  },
])

const socialLinks = [
  { alt: 'Instagram', icon: instagramIcon, href: 'https://www.instagram.com/', x: 884.25, y: 2227.5, w: 62.58, h: 62.58, opacity: 0.7 },
  { alt: 'TikTok', icon: tiktokIcon, href: 'https://www.tiktok.com/', x: 993.94, y: 2230.31, w: 61.17, h: 61.17, opacity: 0.7 },
  { alt: 'Telegram', icon: telegramIcon, href: 'https://telegram.org/', x: 1100.81, y: 2227.5, w: 70.31, h: 70.31, opacity: 1 },
  { alt: 'Twitch', icon: twitchIcon, href: STREAMER_TWITCH_URL, x: 1233, y: 2230.31, w: 71.72, h: 71.72, opacity: 1 },
] as const

const footerProduct = ['Product', 'Nitro', 'Status', 'Policies', 'Terms', 'Privacy', 'Cookie Settings']
const footerAbout = ['About', 'Jobs', 'Brand', 'Newsroom', 'Developers']

const slotLetters = ['T', 'W', 'I', 'T', 'C', 'H'] as const

function px(value: number) {
  return `calc(var(--u) * ${value})`
}

function syncDocumentTitle() {
  document.title = 'StreamAssist - where chat turns into the game'
}

function selectLocale(code: 'en' | 'de' | 'uk' | 'pl') {
  persistLocale(code)
}

onMounted(() => {
  syncDocumentTitle()
})

watch(locale, () => {
  syncDocumentTitle()
})
</script>

<template>
  <div class="landing page-stack">
    <div class="landing__canvas">
      <div class="landing__background" aria-hidden="true" />

      <p class="landing__wordmark landing__wordmark--1" aria-hidden="true">{{ STREAM_APP_BRAND_NAME }}</p>
      <p class="landing__wordmark landing__wordmark--2" aria-hidden="true">{{ STREAM_APP_BRAND_NAME }}</p>
      <p class="landing__wordmark landing__wordmark--3" aria-hidden="true">{{ STREAM_APP_BRAND_NAME }}</p>
      <p class="landing__wordmark landing__wordmark--4" aria-hidden="true">{{ STREAM_APP_BRAND_NAME }}</p>

      <span
        v-for="(dot, index) in sparkleDots"
        :key="`dot-${index}`"
        class="landing__dot"
        :style="{
          left: px(dot.x),
          top: px(dot.y),
          width: px(dot.size),
          height: px(dot.size),
          borderRadius: px(dot.radius),
        }"
        aria-hidden="true"
      />

      <span
        v-for="(glow, index) in glows"
        :key="`glow-${index}`"
        class="landing__glow"
        :style="{
          left: px(glow.x),
          top: px(glow.y),
          width: px(glow.width),
          height: px(glow.height),
          opacity: glow.opacity ?? 1,
          background: glow.background,
          filter: `blur(${px(glow.blur)})`,
          transform: glow.rotate ? `rotate(${glow.rotate}deg)` : undefined,
        }"
        aria-hidden="true"
      />

      <img
        v-for="(bolt, index) in bolts"
        :key="`bolt-${index}`"
        class="landing__bolt"
        :src="bolt.asset"
        alt=""
        :style="{
          left: px(bolt.x),
          top: px(bolt.y),
          width: px(bolt.width),
          height: px(bolt.height),
          opacity: bolt.opacity,
          filter: `blur(${px(bolt.blur)})`,
          transform: `rotate(${bolt.rotate}deg)`,
        }"
        aria-hidden="true"
      />

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
          :style="{ left: px(item.x) }"
        >
          {{ item.label }}
        </a>
      </header>

      <div class="landing-auth">
        <RouterLink class="landing-auth__link" :to="{ path: '/app', query: { needLogin: '1' } }">Log In</RouterLink>
        <RouterLink class="landing-auth__link" :to="{ path: '/app', query: { needLogin: '1' } }">Sing Up</RouterLink>
      </div>

      <section class="landing-hero" aria-label="Hero">
        <div class="landing-hero__screen" aria-hidden="true">
          <div class="landing-hero__screen-notch" />
          <div class="landing-hero__core">
            <div class="landing-hero__main-panel">
              <span class="landing-hero__live-pill" />

              <span
                v-for="top in heroLeftLineTops"
                :key="`hero-left-${top}`"
                class="landing-hero__side-line landing-hero__side-line--left"
                :style="{ top: px(top) }"
              />
              <span
                class="landing-hero__side-line landing-hero__side-line--left landing-hero__side-line--blue"
                :style="{ top: px(136.1) }"
              />

              <span class="landing-hero__side-line landing-hero__side-line--right" :style="{ top: px(82.6) }" />
              <span
                class="landing-hero__side-line landing-hero__side-line--right landing-hero__side-line--yellow"
                :style="{ top: px(95.98) }"
              />
              <span class="landing-hero__side-line landing-hero__side-line--right" :style="{ top: px(109.35) }" />
              <span class="landing-hero__side-line landing-hero__side-line--right" :style="{ top: px(122.73) }" />
              <span class="landing-hero__side-line landing-hero__side-line--right" :style="{ top: px(136.1) }" />
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
                <span class="landing-hero__mini-card-avatar" :style="{ background: card.avatar }" />
                <span class="landing-hero__mini-card-line landing-hero__mini-card-line--white" />
                <span class="landing-hero__mini-card-line landing-hero__mini-card-line--violet" />
                <span class="landing-hero__mini-card-line" :style="{ background: card.body }" />
              </article>
            </div>
          </div>
        </div>

        <div class="landing-hero__copy">
          <h1 class="landing-hero__title">WHERE CHAT TURNS INTO THE GAME</h1>
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
        <h2 class="landing-section__title">VIDEOCALL</h2>
        <p class="landing-section__lead">Create private video rooms for games, challenges, and interactive sessions.</p>

        <RouterLink class="call-banner" :to="{ name: 'call' }">
          <span class="call-banner__title">RUN THE SHOW</span>

          <span class="call-banner__cards">
            <img
              v-for="(card, index) in callBannerCards"
              :key="`call-card-${index}`"
              class="call-banner__card"
              :src="card.asset"
              alt=""
              :style="{ left: px(card.x) }"
            />
          </span>
        </RouterLink>
      </section>

      <section id="games" class="landing-section landing-section--games">
        <h2 class="landing-section__title">GAMES</h2>
        <p class="landing-section__lead">Play with friends, challenge others, or bring the action live to your audience.</p>

        <div class="games-grid">
          <RouterLink
            v-for="game in games"
            :key="game.title"
            :to="game.to"
            class="games-grid__card"
            :style="{ left: px(game.x), top: px(game.y), width: px(game.width), height: px(game.height) }"
          >
            <span
              class="games-grid__label"
              :style="{
                left: px(game.labelX),
                top: px(game.labelY),
                width: px(game.labelWidth),
                height: px(game.labelHeight),
              }"
            >
              {{ game.title }}
            </span>
            <img
              class="games-grid__icon"
              :src="game.icon"
              :alt="game.title"
              loading="lazy"
              :style="{
                left: px(game.iconX),
                top: px(game.iconY),
                width: px(game.iconWidth),
                height: px(game.iconHeight),
              }"
            />
          </RouterLink>
        </div>
      </section>

      <section id="economy" class="landing-section landing-section--economy">
        <h2 class="landing-section__title">ECONOMY</h2>
        <p class="landing-section__lead">
          Create your own in-stream economy with points, bonuses, and interactive mechanics that keep your audience
          coming back.
        </p>

        <div class="economy-banner">
          <span class="economy-banner__title">START EARNING</span>

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

        <a
          v-for="item in socialLinks"
          :key="item.alt"
          class="landing-footer__social"
          :href="item.href"
          target="_blank"
          rel="noreferrer"
          :aria-label="item.alt"
          :style="{
            left: px(item.x),
            top: px(item.y),
            width: px(item.w),
            height: px(item.h),
            opacity: item.opacity,
          }"
        >
          <img :src="item.icon" :alt="item.alt" loading="lazy" />
        </a>

        <RouterLink class="landing-footer__feedback" :to="{ name: 'home' }">Feedback</RouterLink>

        <div class="landing-footer__product">
          <p v-for="item in footerProduct" :key="item">{{ item }}</p>
        </div>

        <div class="landing-footer__about">
          <p v-for="item in footerAbout" :key="item">{{ item }}</p>
        </div>
      </footer>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Arbutus&family=Climate+Crisis&family=Marmelad&display=swap');

.landing {
  min-height: 100vh;
  overflow-x: clip;
  background: #0b0317;
  color: #fff;
}

.landing__canvas {
  --u: calc(100cqw / 2560);
  position: relative;
  width: min(100vw, 1024px);
  aspect-ratio: 2560 / 2655;
  min-height: calc(var(--u) * 2655);
  margin-inline: auto;
  container-type: inline-size;
  overflow: hidden;
  background: linear-gradient(119.10504159217813deg, #0b0317 0%, rgba(74, 50, 116, 0.69) 73.206%);
}

.landing__background {
  position: absolute;
  inset: 0;
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
  background: rgba(255, 255, 255, 0.4);
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
  line-height: calc(var(--u) * 58.5);
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
  line-height: calc(var(--u) * 28.5);
  color: #e6e9ff;
}

.landing-section {
  position: static;
}

.landing-section__title {
  position: absolute;
  transform: none;
  font-size: calc(var(--u) * 45);
  line-height: calc(var(--u) * 58.5);
  text-align: center;
}

.landing-section__lead {
  position: absolute;
  margin: 0;
  transform: none;
  font-size: calc(var(--u) * 18);
  line-height: calc(var(--u) * 28.5);
  text-align: center;
  color: #e6e9ff;
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
}

.call-banner__title {
  position: absolute;
  left: calc(var(--u) * 32.34);
  top: calc(var(--u) * 35.25);
  font-size: calc(var(--u) * 40.5);
  line-height: calc(var(--u) * 58.5);
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
}

.games-grid__label {
  position: absolute;
  z-index: 1;
  white-space: pre-line;
  font-family: 'Climate Crisis', sans-serif;
  font-size: calc(var(--u) * 22.2);
  line-height: calc(var(--u) * 23.58);
  text-transform: uppercase;
}

.games-grid__icon {
  position: absolute;
  z-index: 1;
  object-fit: contain;
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
  border-radius: calc(var(--u) * 41.25);
  background: linear-gradient(120deg, rgba(124, 77, 219, 0.48) 0%, rgba(60, 36, 99, 0.47) 100%);
  box-shadow: 0 calc(var(--u) * 13.5) calc(var(--u) * 30) rgba(0, 0, 0, 0.18);
  outline: calc(var(--u) * 7.5) solid #fff;
  outline-offset: calc(var(--u) * -7.5);
  overflow: hidden;
}

.economy-banner__title {
  position: absolute;
  left: calc(var(--u) * 49.22);
  top: calc(var(--u) * 35.06);
  font-size: calc(var(--u) * 40.5);
  line-height: calc(var(--u) * 58.5);
}

.economy-banner__slot {
  position: absolute;
  left: calc(var(--u) * 662.35);
  top: calc(var(--u) * 18.28);
  width: calc(var(--u) * 429.19);
  height: calc(var(--u) * 97.03);
}

.economy-banner__jackpot {
  position: absolute;
  left: calc(var(--u) * 122.34);
  top: 0;
  width: calc(var(--u) * 142.031);
  height: calc(var(--u) * 35.156);
  display: flex;
  align-items: center;
  justify-content: center;
  border: calc(var(--u) * 3.75) solid #7c4ddb;
  box-sizing: border-box;
  border-radius: calc(var(--u) * 18);
  background: rgba(255, 59, 48, 0.58);
  font-family: 'Arbutus', serif;
  font-size: calc(var(--u) * 19.5);
  line-height: 1;
}

.economy-banner__cells {
  position: absolute;
  left: 0;
  top: calc(var(--u) * 22.87);
  display: grid;
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

.landing-footer__languages {
  position: absolute;
  left: calc(var(--u) * 700.03);
  top: calc(var(--u) * 2227.5);
  width: calc(var(--u) * 116.72);
  height: calc(var(--u) * 156.09);
  border-radius: calc(var(--u) * 19.5);
  background: rgba(255, 255, 255, 0.45);
}

.landing-footer__language {
  position: absolute;
  border: 0;
  padding: 0;
  background: transparent;
  color: #111827;
  font-size: calc(var(--u) * 18);
  text-align: left;
  cursor: pointer;
  z-index: 1;
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

.landing-footer__language.landing-footer__language--active {
  left: 0;
  top: calc(var(--u) * -2.81);
  width: calc(var(--u) * 117);
  height: calc(var(--u) * 46.5);
  padding-left: calc(var(--u) * 26.44);
  border-radius: calc(var(--u) * 19.5);
  background: #fff;
  display: flex;
  align-items: center;
}

.landing-footer__social {
  position: absolute;
  display: block;
}

.landing-footer__social img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.landing-footer__feedback {
  position: absolute;
  left: calc(var(--u) * 1376.44);
  top: calc(var(--u) * 2230.31);
  width: calc(var(--u) * 160.59);
  height: calc(var(--u) * 46.5);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: calc(var(--u) * 19.5);
  background: #fff;
  color: #111827;
  font-size: calc(var(--u) * 18);
  text-decoration: none;
}

.landing-footer__product,
.landing-footer__about {
  position: absolute;
  margin: 0;
  font-size: calc(var(--u) * 18);
  color: #fff;
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
}

@media (max-width: 640px) {
  .landing {
    overflow-x: auto;
  }

  .landing__canvas {
    width: 100vw;
  }
}
</style>
