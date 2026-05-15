import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Eat First parity guard for the cross-route timer-preset-select feature.
 * Mafia / Game Template are covered by
 * `packages/client-consistency/timerPresetSelectMafiaGameRoom.test.ts`.
 */

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../..')
function read(rel: string): string {
  return readFileSync(path.resolve(repoRoot, rel), 'utf8')
}

const protoClient = read('apps/client/src/eat-first/eatFirstWsProtocol.ts')
const tableState = read('apps/server/src/eatFirst/tableState.ts')
const schema = read('apps/server/src/signaling/clientMessageSchema.ts')
const messageHandlers = read('apps/server/src/signaling/messageHandlers.ts')
const socketServer = read('apps/server/src/signaling/socketServer.ts')
const shell = read('apps/client/src/stores/eatFirstCallShell.ts')
const signaling = read('apps/client/src/composables/useEatFirstCallSignaling.ts')
const strip = read('apps/client/src/eat-first/components/EatFirstCallTimerStrip.vue')
const page = read('apps/client/src/eat-first/pages/EatFirstCallPage.vue')
const callPage = read('apps/client/src/components/call/CallPage.vue')

describe('Eat First protocol + schema + server state + handler + join replay', () => {
  it('client protocol exports `timerPresetSelect: eat:timer-preset-select`', () => {
    expect(protoClient).toMatch(/timerPresetSelect:\s*'eat:timer-preset-select'/)
  })

  it('Zod schema includes a discriminated `eat:timer-preset-select` variant with bounded durationMs', () => {
    expect(schema).toMatch(
      /z\.literal\('eat:timer-preset-select'\)[\s\S]*?durationMs:\s*z\.number\(\)\.int\(\)\.min\(5_000\)\.max\(7_200_000\)/,
    )
  })

  it('EatFirstTableState carries selectedTimerDurationMs + setter + getter', () => {
    expect(tableState).toMatch(/selectedTimerDurationMs:\s*number\s*\|\s*null/)
    expect(tableState).toMatch(/setEatFirstSelectedTimerDurationMs/)
    expect(tableState).toMatch(/getEatFirstSelectedTimerDurationMs/)
  })

  it('socketServer dispatches the new case to handleEatFirstTimerPresetSelect', () => {
    expect(socketServer).toMatch(
      /case 'eat:timer-preset-select':[\s\S]*?handleEatFirstTimerPresetSelect\(socket, parsed\.data\.payload, deps\)/,
    )
  })

  it('handler gates on isEatFirstHostPeer, persists, and broadcasts eat:timer-preset-select', () => {
    const block = messageHandlers.match(
      /export async function handleEatFirstTimerPresetSelect[\s\S]*?broadcastServerMessageToRoom\(room,[\s\S]*?type:\s*'eat:timer-preset-select'[\s\S]*?\}\)\s*\n\}/,
    )
    expect(block, 'handleEatFirstTimerPresetSelect block not found').not.toBeNull()
    expect(block![0]).toMatch(/isEatFirstHostPeer\(room,\s*peer\)/)
    expect(block![0]).toMatch(/setEatFirstSelectedTimerDurationMs\(room\.id,\s*durationMs\)/)
  })

  it('Eat First join replay sends the preset to a late joiner when set', () => {
    expect(messageHandlers).toMatch(
      /getEatFirstSelectedTimerDurationMs\(room\.id\)[\s\S]*?type:\s*'eat:timer-preset-select'/,
    )
  })
})

describe('Eat First shell + signaling — inbound apply + event-bus bridge', () => {
  it('shell exposes selectedTimerDurationMs ref + setter', () => {
    expect(shell).toMatch(/const selectedTimerDurationMs\s*=\s*ref<number\s*\|\s*null>\(null\)/)
    expect(shell).toMatch(/function setEatFirstSelectedTimerDurationMs/)
  })

  it('signaling parses eat:timer-preset-select and writes the shell', () => {
    expect(signaling).toMatch(/EAT_FIRST_TIMER_PRESET_SELECT_SIGNAL\s*=\s*EatFirstWs\.timerPresetSelect/)
    expect(signaling).toMatch(/EAT_FIRST_TIMER_PRESET_SELECT_SIGNAL[\s\S]*?eatFirstShell\.setEatFirstSelectedTimerDurationMs/)
  })

  it('EatFirstCallTimerStrip accepts selectedTimerDurationMs prop + emits select-duration via the event bus', () => {
    expect(strip).toMatch(/selectedTimerDurationMs\?:\s*number\s*\|\s*null/)
    expect(strip).toMatch(/:selected-duration-ms="selectedTimerDurationMs"/)
    expect(strip).toMatch(/@select-duration="onSelectDuration"/)
    expect(strip).toMatch(/dispatchEatFirstTimerAction\(\{\s*action:\s*'timer-preset-select',\s*durationSec\s*\}\)/)
  })

  it('EatFirstCallPage passes the shell ref into the strip', () => {
    expect(page).toMatch(/:selected-timer-duration-ms="eatFirstSelectedTimerDurationMs"/)
    expect(page).toMatch(/selectedTimerDurationMs:\s*eatFirstSelectedTimerDurationMs/)
  })

  it('CallPage event bus translates timer-preset-select into eat:timer-preset-select WS frame', () => {
    expect(callPage).toMatch(
      /action === 'timer-preset-select'[\s\S]*?EatFirstWs\.timerPresetSelect[\s\S]*?payload:\s*\{\s*durationMs\s*\}/,
    )
  })
})
