import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Cross-file regression guards for the Eat First positional swap feature
 * (Choice A — Mafia / Game Template parity):
 *   - shell store carries `hostInteractionMode`, `hostSeatSwapSelectionPeerId`,
 *     `playersUpdateBroadcastPayload` + the `swapEatFirstSlotsInPlayerOrder` action
 *   - the action delegates to the pure helper and never mutates `slotByPeer`
 *   - CallPage's tile-click router routes swap-mode BEFORE speaking-mode
 *   - CallPage's `playersUpdateBroadcastPayload` watcher sends `EatFirstWs.playersUpdate`
 *   - Mafia / Game Template are NOT touched (their store shape is unchanged)
 */

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../..')
function read(rel: string): string {
  return readFileSync(path.resolve(repoRoot, rel), 'utf8')
}

const shell = read('apps/client/src/stores/eatFirstCallShell.ts')
const callPage = read('apps/client/src/components/call/CallPage.vue')
const helper = read('apps/client/src/eat-first/utils/eatFirstPlayerOrderSwap.ts')

describe('Eat First shell store — swap mode state + action', () => {
  it('exposes hostInteractionMode ref defaulting to idle', () => {
    expect(shell).toMatch(/hostInteractionMode\s*=\s*ref<'idle'\s*\|\s*'swap'>\('idle'\)/)
  })

  it('exposes hostSeatSwapSelectionPeerId ref defaulting to null', () => {
    expect(shell).toMatch(/hostSeatSwapSelectionPeerId\s*=\s*ref<string\s*\|\s*null>\(null\)/)
  })

  it('exposes playersUpdateBroadcastPayload ref + clearer for the outbound WS frame', () => {
    expect(shell).toMatch(
      /playersUpdateBroadcastPayload\s*=\s*ref<\{\s*playerOrder:\s*string\[\]\s*\}\s*\|\s*null>\(null\)/,
    )
    expect(shell).toMatch(/function clearPlayersUpdateBroadcastPayload/)
  })

  it('setHostInteractionMode is host-gated and mutually-exclusive with speakingMode', () => {
    expect(shell).toMatch(
      /function setHostInteractionMode\(mode:[\s\S]*?if \(!isEatFirstRoomHost\.value\) return[\s\S]*?hostInteractionMode\.value\s*=\s*mode[\s\S]*?if \(mode === 'swap'\)[\s\S]*?speakingMode\.value\s*=\s*false[\s\S]*?clearSpeakingNominationDraft\(\)/,
    )
  })

  it('toggleSpeakingMode clears swap mode when turning speaking ON (mutual exclusion)', () => {
    expect(shell).toMatch(
      /function toggleSpeakingMode\(\)[\s\S]*?speakingMode\.value\s*=\s*!speakingMode\.value[\s\S]*?Mutual exclusion[\s\S]*?hostInteractionMode\.value\s*=\s*'idle'[\s\S]*?hostSeatSwapSelectionPeerId\.value\s*=\s*null/,
    )
  })

  it('host-loss path clears hostInteractionMode + hostSeatSwapSelectionPeerId', () => {
    expect(shell).toMatch(
      /function setEatFirstCallShellHost[\s\S]*?hostInteractionMode\.value\s*=\s*'idle'[\s\S]*?hostSeatSwapSelectionPeerId\.value\s*=\s*null/,
    )
    expect(shell).toMatch(
      /function setEatFirstHostPeer[\s\S]*?hostInteractionMode\.value\s*=\s*'idle'[\s\S]*?hostSeatSwapSelectionPeerId\.value\s*=\s*null/,
    )
  })

  it('swapEatFirstSlotsInPlayerOrder is host-gated, delegates to the pure helper, and queues the broadcast', () => {
    expect(shell).toMatch(/function swapEatFirstSlotsInPlayerOrder\(slotA:\s*string,\s*slotB:\s*string\)/)
    expect(shell).toMatch(
      /function swapEatFirstSlotsInPlayerOrder[\s\S]*?if \(!isEatFirstRoomHost\.value\) return/,
    )
    expect(shell).toMatch(/swapEatFirstPlayerOrder\(currentOrder,\s*slotA,\s*slotB\)/)
    expect(shell).toMatch(/remapEatFirstSpeakingQueueForSwap\(speakingQueue\.value,\s*seatA,\s*seatB\)/)
    expect(shell).toMatch(/playersUpdateBroadcastPayload\.value\s*=\s*\{\s*playerOrder:/)
  })

  it('swap action source does NOT mutate slotByPeer / traitsBySlot / actionCardBySlot anywhere in the file', () => {
    // Whole-file guard: the shell has *no* slot-binding or trait/card mutation
    // path; the swap is positional-only by construction.
    const writeLikeSlotByPeer = /slotByPeer\.value\s*=/
    const writeLikeTraitsBySlot = /traitsBySlot[\s\S]{0,40}\.set\(/
    const writeLikeActionCardBySlot = /actionCardBySlot[\s\S]{0,40}\.set\(/
    // None of these write-shapes should be present in the shell store.
    expect(shell).not.toMatch(writeLikeSlotByPeer)
    expect(shell).not.toMatch(writeLikeTraitsBySlot)
    expect(shell).not.toMatch(writeLikeActionCardBySlot)
  })

  it('exports the new state + actions', () => {
    expect(shell).toMatch(/hostInteractionMode,/)
    expect(shell).toMatch(/hostSeatSwapSelectionPeerId,/)
    expect(shell).toMatch(/playersUpdateBroadcastPayload,/)
    expect(shell).toMatch(/setHostInteractionMode,/)
    expect(shell).toMatch(/setHostSeatSwapSelectionPeerId,/)
    expect(shell).toMatch(/swapEatFirstSlotsInPlayerOrder,/)
    expect(shell).toMatch(/clearPlayersUpdateBroadcastPayload,/)
  })
})

describe('CallPage tile-click router + playersUpdate broadcast watcher', () => {
  it('routes swap-mode BEFORE speaking-mode inside the EatFirst host branch', () => {
    const swapIdx = callPage.indexOf(`eatFirstShell.hostInteractionMode === 'swap'`)
    const speakingIdx = callPage.indexOf(`if (!eatFirstShell.speakingMode)`)
    expect(swapIdx, 'swap-mode branch not found').toBeGreaterThan(-1)
    expect(speakingIdx, 'speaking-mode branch not found').toBeGreaterThan(-1)
    expect(swapIdx).toBeLessThan(speakingIdx)
  })

  it('swap-mode branch reads slotByPeer to translate clicked peer to slot id', () => {
    expect(callPage).toMatch(/const slotForClicked\s*=\s*eatFirstSlotByPeer\.value\[clickedPeerId\]/)
    expect(callPage).toMatch(/const slotForPending\s*=\s*eatFirstSlotByPeer\.value\[pending\]/)
  })

  it('swap-mode branch implements select / deselect / commit', () => {
    expect(callPage).toMatch(/eatFirstShell\.setHostSeatSwapSelectionPeerId\(clickedPeerId\)/)
    expect(callPage).toMatch(/pending === clickedPeerId/)
    expect(callPage).toMatch(/eatFirstShell\.setHostSeatSwapSelectionPeerId\(null\)/)
    expect(callPage).toMatch(/eatFirstShell\.swapEatFirstSlotsInPlayerOrder\(slotForPending,\s*slotForClicked\)/)
  })

  it('declares a host-side `eat:players-update` broadcast watcher', () => {
    expect(callPage).toMatch(
      /watch\(\s*\(\)\s*=>\s*eatFirstShell\.playersUpdateBroadcastPayload[\s\S]*?EatFirstWs\.playersUpdate[\s\S]*?payload:\s*\{\s*playerOrder/,
    )
  })

  it('broadcast watcher gates on isEatFirstRoute, inCall, wsStatus, and host', () => {
    const watcher = callPage.match(
      /watch\(\s*\(\)\s*=>\s*eatFirstShell\.playersUpdateBroadcastPayload[\s\S]*?\}\s*,\s*\{\s*flush:\s*'post'\s*\}\s*,?\s*\)/,
    )
    expect(watcher, 'playersUpdateBroadcastPayload watcher not found').not.toBeNull()
    expect(watcher![0]).toMatch(/!isEatFirstRoute\.value/)
    expect(watcher![0]).toMatch(/!session\.inCall/)
    expect(watcher![0]).toMatch(/wsStatus\.value !== 'open'/)
    expect(watcher![0]).toMatch(/!eatFirstShell\.isEatFirstRoomHost/)
    expect(watcher![0]).toMatch(/eatFirstShell\.clearPlayersUpdateBroadcastPayload\(\)/)
  })
})

describe('Pure helper presence', () => {
  it('exports swapEatFirstPlayerOrder and remapEatFirstSpeakingQueueForSwap', () => {
    expect(helper).toMatch(/export function swapEatFirstPlayerOrder/)
    expect(helper).toMatch(/export function remapEatFirstSpeakingQueueForSwap/)
  })
})
