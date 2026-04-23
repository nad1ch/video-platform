/**
 * Audio hooks for Coin Hub reel (stubs: wire Web Audio / assets later; DEV may log).
 */
import { createLogger } from '@/utils/logger'
import type { SpinRarity } from '@/utils/coinHub/coinHubRarity'

const log = createLogger('coinHubAudio')

let lastTick = 0

function devOnly(fn: () => void) {
  if (import.meta.env.DEV) {
    try {
      fn()
    } catch {
      /* ignore */
    }
  }
}

type TickOpts = { preWin?: boolean }

export type StripTickSpeed = 'fast' | 'cruise' | 'decel' | 'nearStop'

const SPEED_MIN_GAP_MS: Record<StripTickSpeed, number> = {
  fast: 22,
  cruise: 30,
  decel: 48,
  nearStop: 62,
}

function tickGap(speed: StripTickSpeed, preWin: boolean): number {
  if (preWin) {
    return 56
  }
  return SPEED_MIN_GAP_MS[speed]
}

/** Ticks by phase — faster = higher cadence cap (reel “roller” pass frequency). */
export function playStripTickAtSpeed(speed: StripTickSpeed, opts?: TickOpts) {
  const preWin = opts?.preWin === true
  const now = performance.now()
  const minGap = tickGap(speed, preWin)
  if (now - lastTick < minGap) {
    return
  }
  lastTick = now
  playReelClick(preWin, speed)
  devOnly(() => {
    log.debug(`strip tick (${speed}${preWin ? ', pre-win' : ''})`)
  })
}

/** @deprecated use playStripTickAtSpeed — bool API kept for a minimal call surface */
export function playStripTick(fast: boolean, opts?: TickOpts) {
  playStripTickAtSpeed(fast ? 'fast' : 'decel', opts)
}

/** One shot when the spin CTA is pressed (before server resolves). */
export function playSpinStart() {
  lastTick = 0
  devOnly(() => {
    log.debug('spin start (reel power-on)')
  })
}

export function playStripLand() {
  lastTick = 0
  const c = getWebAudioContext()
  if (c) {
    void resumeIfNeeded(c)
    playSineChime(c, 0, 180, 0.06, 0.12)
  }
  devOnly(() => {
    log.debug('strip land / click')
  })
}

/** Final settle thud (alias of land; separate hook for SFX pack). */
export function playWinStop() {
  playStripLand()
}

export function playStripResolving() {
  devOnly(() => {
    log.debug('strip resolving (server)')
  })
}

// —— Web Audio UI (Coin Hub) — one shared context, lazy init, safe if unsupported ——

let webCtx: AudioContext | null = null

function getWebAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') {
    return null
  }
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
  const C = w.AudioContext || w.webkitAudioContext
  if (!C) {
    return null
  }
  if (!webCtx) {
    try {
      webCtx = new C()
    } catch {
      return null
    }
  }
  return webCtx
}

async function resumeIfNeeded(c: AudioContext) {
  if (c.state === 'suspended') {
    try {
      await c.resume()
    } catch {
      /* ignore */
    }
  }
}

function playReelClick(preWin: boolean, speed: StripTickSpeed) {
  const c = getWebAudioContext()
  if (!c) {
    return
  }
  void resumeIfNeeded(c)
  const base =
    speed === 'fast' ? 420 : speed === 'cruise' ? 360 : speed === 'decel' ? 300 : 260
  const freq = preWin ? 340 : base
  const gain = preWin ? 0.04 : 0.055
  const t = c.currentTime
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = 'square'
  o.frequency.setValueAtTime(freq, t)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + 0.002)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.032)
  o.connect(g).connect(c.destination)
  o.start(t)
  o.stop(t + 0.04)
}

function playSineChime(
  c: AudioContext,
  delayFromNow: number,
  freq: number,
  durationSec: number,
  gain0: number,
) {
  const start = c.currentTime + delayFromNow
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = 'sine'
  o.frequency.setValueAtTime(freq, start)
  g.gain.setValueAtTime(0, start)
  g.gain.linearRampToValueAtTime(gain0, start + 0.006)
  g.gain.exponentialRampToValueAtTime(0.0009, start + durationSec)
  o.connect(g).connect(c.destination)
  o.start(start)
  o.stop(start + durationSec + 0.02)
}

/** Short click / tap (premium CTA, UI affordance). */
export function playUiClick() {
  const c = getWebAudioContext()
  if (!c) {
    return
  }
  void resumeIfNeeded(c)
  playSineChime(c, 0, 1020, 0.08, 0.1)
}

/**
 * Coin collect / reward (ascending chime, ~0.2s). Call when coins apply to the balance
 * (separate from UI click; safe to no-op if audio blocked).
 */
export function playCoinCollect() {
  const c = getWebAudioContext()
  if (!c) {
    return
  }
  void resumeIfNeeded(c)
  playSineChime(c, 0, 1040, 0.1, 0.1)
  playSineChime(c, 0.05, 1320, 0.1, 0.09)
  playSineChime(c, 0.1, 1680, 0.12, 0.07)
}

/** Stinger when the winning line settles (in addition to {@link playCoinCollect}). */
export function playWinByRarity(r: SpinRarity) {
  const c = getWebAudioContext()
  if (!c) {
    return
  }
  void resumeIfNeeded(c)
  if (r === 'common' || r === 'uncommon') {
    playSineChime(c, 0, 660, 0.09, 0.06)
    return
  }
  if (r === 'rare') {
    playSineChime(c, 0, 720, 0.1, 0.08)
    playSineChime(c, 0.06, 960, 0.08, 0.05)
    return
  }
  if (r === 'epic') {
    playSineChime(c, 0, 600, 0.12, 0.09)
    playSineChime(c, 0.07, 880, 0.12, 0.08)
    playSineChime(c, 0.14, 1200, 0.1, 0.06)
    return
  }
  /* legendary */
  playSineChime(c, 0, 520, 0.14, 0.1)
  playSineChime(c, 0.08, 780, 0.14, 0.1)
  playSineChime(c, 0.16, 1040, 0.16, 0.09)
  playSineChime(c, 0.24, 1320, 0.2, 0.07)
}
