import { landingDesignPx as px } from '@/utils/landingDesignPx'

export type LandingCosmicDot = {
  x: number
  y: number
  size: number
  radius: number
}

export type LandingCosmicGlow = {
  x: number
  y: number
  width: number
  height: number
  background: string
  blur: number
  opacity?: number
  rotate?: number
}

const GLOW_BG_PURPLE_195 = 'rgba(124, 58, 237, 0.18)' as const
const GLOW_BG_BLUE_225 = 'rgba(96, 165, 250, 0.16)' as const
const GLOW_BG_VIOLET_195 = 'rgba(139, 92, 246, 0.16)' as const
const GLOW_BG_LAVENDER_SM = 'rgba(196, 181, 253, 0.22)' as const
const GLOW_BG_SKY = 'rgba(147, 197, 253, 0.22)' as const

const sparkleDotsRaw: LandingCosmicDot[] = [
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

/** Per-dot twinkle: unique duration/delay (deterministic) so stars don’t pulse in sync. */
export const landingCosmicSparkleDots = Object.freeze(
  sparkleDotsRaw.map((d, index) => {
    const dur = 2.05 + ((index * 47) % 215) / 100
    const delay = ((index * 277) % 9800) / 1000
    return Object.freeze({
      ...d,
      phase: index % 7,
      style: Object.freeze({
        left: px(d.x),
        top: px(d.y),
        width: px(d.size),
        height: px(d.size),
        borderRadius: px(d.radius),
        '--dot-dur': `${dur.toFixed(2)}s`,
        '--dot-delay': `${delay.toFixed(2)}s`,
      } as Record<string, string>),
    })
  }),
)

const glowsRaw: LandingCosmicGlow[] = [
  { x: 734, y: 90, width: 195, height: 195, background: GLOW_BG_PURPLE_195, blur: 45 },
  { x: 2083.28, y: 436, width: 195, height: 195, background: GLOW_BG_PURPLE_195, blur: 45 },
  { x: 466.28, y: 661.5, width: 195, height: 195, background: GLOW_BG_PURPLE_195, blur: 45 },
  { x: 419, y: 1871, width: 195, height: 195, background: GLOW_BG_PURPLE_195, blur: 45 },
  { x: 2426, y: 2572.09, width: 195, height: 195, background: GLOW_BG_PURPLE_195, blur: 45 },
  { x: 1826.25, y: 984, width: 195, height: 195, background: GLOW_BG_PURPLE_195, blur: 45 },
  { x: 628.5, y: 1332.75, width: 195, height: 195, background: GLOW_BG_PURPLE_195, blur: 45 },
  { x: 624.75, y: 1743.75, width: 195, height: 195, background: GLOW_BG_PURPLE_195, blur: 45 },
  { x: 1683, y: 135, width: 225, height: 225, background: GLOW_BG_BLUE_225, blur: 45 },
  { x: 66.48, y: 1068.84, width: 133.97, height: 133.97, background: GLOW_BG_BLUE_225, blur: 26.79, rotate: -23 },
  { x: 1593, y: 525, width: 195, height: 195, background: GLOW_BG_VIOLET_195, blur: 45 },
  { x: -24, y: 572.5, width: 195, height: 195, background: GLOW_BG_VIOLET_195, blur: 45 },
  { x: 972.75, y: 1326, width: 195, height: 195, background: GLOW_BG_VIOLET_195, blur: 45 },
  { x: 942, y: 1826.25, width: 195, height: 195, background: GLOW_BG_VIOLET_195, blur: 45 },
  { x: 989.25, y: 92.25, width: 56.25, height: 55.5, background: GLOW_BG_LAVENDER_SM, blur: 9 },
  { x: 2357.03, y: 445.75, width: 56.25, height: 55.5, background: GLOW_BG_LAVENDER_SM, blur: 9 },
  { x: 740.03, y: 791.25, width: 56.25, height: 55.5, background: GLOW_BG_LAVENDER_SM, blur: 9 },
  { x: 112.25, y: 1557.25, width: 56.25, height: 55.5, background: GLOW_BG_LAVENDER_SM, blur: 9 },
  { x: 2152.25, y: 2562.34, width: 56.25, height: 55.5, background: GLOW_BG_LAVENDER_SM, blur: 9 },
  { x: 1552.5, y: 854.25, width: 56.25, height: 55.5, background: GLOW_BG_LAVENDER_SM, blur: 9 },
  { x: 928.59, y: 1372.34, width: 52.03, height: 51.33, background: GLOW_BG_LAVENDER_SM, blur: 8.32 },
  { x: 1823.25, y: 373.5, width: 82.5, height: 78.75, background: GLOW_BG_LAVENDER_SM, blur: 9 },
  { x: 214, y: 220, width: 82.5, height: 78.75, background: GLOW_BG_LAVENDER_SM, blur: 9 },
  { x: 681.47, y: 1207.59, width: 74.25, height: 72.75, background: GLOW_BG_LAVENDER_SM, blur: 9 },
  { x: 2049.25, y: 1561.09, width: 74.25, height: 72.75, background: GLOW_BG_LAVENDER_SM, blur: 9 },
  { x: 420.03, y: 2544.34, width: 74.25, height: 72.75, background: GLOW_BG_LAVENDER_SM, blur: 9 },
  { x: 2076, y: 905, width: 74.25, height: 72.75, background: GLOW_BG_LAVENDER_SM, blur: 9 },
  { x: 774, y: 1665.75, width: 74.25, height: 72.75, background: GLOW_BG_LAVENDER_SM, blur: 9 },
  { x: 1753.5, y: 1534.5, width: 76.5, height: 69.75, background: GLOW_BG_LAVENDER_SM, blur: 9 },
  { x: 1668, y: 95.25, width: 82.5, height: 80.25, background: GLOW_BG_SKY, blur: 9 },
  { x: 873.75, y: 882, width: 82.5, height: 80.25, background: GLOW_BG_SKY, blur: 9 },
  { x: 2377.97, y: 1318.57, width: 197.97, height: 192.57, background: GLOW_BG_SKY, blur: 21.6 },
  { x: 624.53, y: 137.25, width: 82.5, height: 80.25, background: GLOW_BG_SKY, blur: 9 },
  { x: 227.75, y: 2211.25, width: 82.5, height: 80.25, background: GLOW_BG_SKY, blur: 9 },
  { x: 2267.75, y: 1772.59, width: 82.5, height: 80.25, background: GLOW_BG_SKY, blur: 9 },
  { x: 1581, y: 1345.5, width: 82.5, height: 80.25, background: GLOW_BG_SKY, blur: 9 },
  { x: 1577.25, y: 1756.5, width: 82.5, height: 80.25, background: GLOW_BG_SKY, blur: 9 },
  { x: 1511.25, y: 1029, width: 82.5, height: 80.25, background: GLOW_BG_SKY, blur: 9 },
]

/** Parallax first, then rotate — screen-space drift (vars set on canvas root). */
export const landingCosmicGlows = Object.freeze(
  glowsRaw.map((glow) =>
    Object.freeze({
      ...glow,
      style: Object.freeze({
        left: px(glow.x),
        top: px(glow.y),
        width: px(glow.width),
        height: px(glow.height),
        opacity: String(glow.opacity ?? 1),
        background: glow.background,
        filter: `blur(${px(glow.blur)})`,
        transform:
          glow.rotate !== undefined
            ? `translate3d(var(--landing-parallax-glow-x, 0px), var(--landing-parallax-glow-y, 0px), 0) rotate(${glow.rotate}deg)`
            : `translate3d(var(--landing-parallax-glow-x, 0px), var(--landing-parallax-glow-y, 0px), 0)`,
      }),
    }),
  ),
)
