import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Cross-route regression guards for the live timer-preset-select feature.
 * Verifies that the shared chip exposes the controlled prop + emit, and
 * that the Mafia and Game Template adapters / stores / signaling
 * composables / protocols are wired byte-for-byte to the same shape.
 * Eat First parity is covered by a parallel suite in
 * `packages/eat-first-consistency/timerPresetSelectEatFirst.test.ts`.
 */

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../..')
function read(rel: string): string {
  return readFileSync(path.resolve(repoRoot, rel), 'utf8')
}

const sharedChip = read('apps/client/src/components/game-call/GameTimerOverlay.vue')
const mafiaProtoServer = read('apps/server/src/signaling/mafiaWsProtocol.ts')
const mafiaProtoClient = read('apps/client/src/composables/mafiaWsProtocol.ts')
const gameRoomProtoServer = read('apps/server/src/signaling/gameRoomWsProtocol.ts')
const gameRoomProtoClient = read('apps/client/src/composables/gameRoomWsProtocol.ts')
const schema = read('apps/server/src/signaling/clientMessageSchema.ts')
const messageHandlers = read('apps/server/src/signaling/messageHandlers.ts')
const socketServer = read('apps/server/src/signaling/socketServer.ts')
const roomTs = read('apps/server/src/rooms/Room.ts')
const mafiaStore = read('apps/client/src/stores/mafiaGame.ts')
const gameRoomStore = read('apps/client/src/stores/gameTemplateGame.ts')
const mafiaSignaling = read('apps/client/src/composables/useMafiaHostSignaling.ts')
const gameRoomSignaling = read('apps/client/src/composables/useGameRoomHostSignaling.ts')
const mafiaOverlay = read('apps/client/src/components/mafia/MafiaOverlay.vue')
const gameTemplateOverlay = read('apps/client/src/components/game-template/GameTemplateOverlay.vue')

describe('GameTimerOverlay — controlled preset prop + emit', () => {
  it('declares the optional selectedDurationMs prop', () => {
    expect(sharedChip).toMatch(/selectedDurationMs\?:\s*number\s*\|\s*null/)
  })

  it('declares the select-duration emit with a durationMs payload', () => {
    expect(sharedChip).toMatch(/'select-duration':\s*\[durationMs:\s*number\]/)
  })

  it('routes both Start and the active-chip highlight through the resolved selected duration', () => {
    expect(sharedChip).toMatch(/const effectiveSelectedDurationMs\s*=\s*computed/)
    expect(sharedChip).toMatch(/emit\('start',\s*effectiveSelectedDurationMs\.value\)/)
    expect(sharedChip).toMatch(/'game-timer-overlay__preset--active':\s*effectiveSelectedDurationMs\s*===\s*ms/)
  })

  it('onSelectDuration writes the local ref AND emits to the adapter', () => {
    expect(sharedChip).toMatch(
      /function onSelectDuration[\s\S]*?selectedDurationMs\.value\s*=\s*ms[\s\S]*?emit\('select-duration',\s*ms\)/,
    )
  })
})

describe('Mafia protocol + schema + Room + handler + snapshot', () => {
  it('client and server protocol both export `timerPresetSelect: mafia:timer-preset-select`', () => {
    expect(mafiaProtoServer).toMatch(/timerPresetSelect:\s*'mafia:timer-preset-select'/)
    expect(mafiaProtoClient).toMatch(/timerPresetSelect:\s*'mafia:timer-preset-select'/)
  })

  it('Zod schema includes a discriminated `mafia:timer-preset-select` variant with bounded durationMs', () => {
    expect(schema).toMatch(
      /z\.literal\(MafiaWs\.timerPresetSelect\)[\s\S]*?durationMs:\s*z\.number\(\)\.int\(\)\.min\(5_000\)\.max\(7_200_000\)/,
    )
  })

  it('Room stores mafiaSelectedTimerDurationMs with getter and setter', () => {
    expect(roomTs).toMatch(/mafiaSelectedTimerDurationMs:\s*number\s*\|\s*null/)
    expect(roomTs).toMatch(/getMafiaSelectedTimerDurationMs\(\):\s*number\s*\|\s*null/)
    expect(roomTs).toMatch(/setMafiaSelectedTimerDurationMs\(durationMs:\s*number\s*\|\s*null\)/)
  })

  it('socketServer dispatches the new case to handleMafiaTimerPresetSelect', () => {
    expect(socketServer).toMatch(/case 'mafia:timer-preset-select':[\s\S]*?handleMafiaTimerPresetSelect\(socket, parsed\.data\.payload, deps\)/)
  })

  it('handler gates on isMafiaHostPeer, validates range, persists, and broadcasts', () => {
    const block = messageHandlers.match(
      /export function handleMafiaTimerPresetSelect[\s\S]*?broadcastServerMessageToRoom\(room,[\s\S]*?type:\s*MafiaWs\.timerPresetSelect[\s\S]*?\}\)\s*\n\}/,
    )
    expect(block, 'handleMafiaTimerPresetSelect block not found').not.toBeNull()
    expect(block![0]).toMatch(/isMafiaHostPeer\(room,\s*peer\)/)
    expect(block![0]).toMatch(/setMafiaSelectedTimerDurationMs\(durationMs\)/)
    expect(block![0]).toMatch(/durationMs:\s*z\.number|durationMs < 5_000 \|\| durationMs > 7_200_000/)
  })

  it('Mafia snapshot replay sends the preset to a late joiner when set', () => {
    expect(messageHandlers).toMatch(
      /room\.getMafiaSelectedTimerDurationMs\(\)[\s\S]*?type:\s*MafiaWs\.timerPresetSelect/,
    )
  })
})

describe('Mafia store + signaling — host write + inbound apply + broadcast watcher', () => {
  it('store exposes mafiaSelectedTimerDurationMs ref + selectTimerPreset + applyMafiaTimerPresetSelectFromSignaling', () => {
    expect(mafiaStore).toMatch(/mafiaSelectedTimerDurationMs\s*=\s*ref<number\s*\|\s*null>\(null\)/)
    expect(mafiaStore).toMatch(/function selectTimerPreset\(durationMs:\s*number\)/)
    expect(mafiaStore).toMatch(/function applyMafiaTimerPresetSelectFromSignaling\(durationMs:\s*number\)/)
    expect(mafiaStore).toMatch(/timerPresetSelectBroadcastPayload\s*=\s*ref<number\s*\|\s*null>/)
  })

  it('store selectTimerPreset validates against MAFIA_TIMER_PRESET_MS and writes both refs', () => {
    const fnMatch = mafiaStore.match(/function selectTimerPreset\(durationMs:\s*number\)[\s\S]*?\n\s*\}/)
    expect(fnMatch, 'selectTimerPreset not found').not.toBeNull()
    expect(fnMatch![0]).toMatch(/MAFIA_TIMER_PRESET_MS\.includes/)
    expect(fnMatch![0]).toMatch(/mafiaSelectedTimerDurationMs\.value\s*=\s*ms/)
    expect(fnMatch![0]).toMatch(/timerPresetSelectBroadcastPayload\.value\s*=\s*ms/)
  })

  it('signaling parses mafia:timer-preset-select and applies it to the store', () => {
    expect(mafiaSignaling).toMatch(/function parseMafiaTimerPresetSelect/)
    expect(mafiaSignaling).toMatch(/mafia\.applyMafiaTimerPresetSelectFromSignaling\(presetParsed\)/)
  })

  it('signaling watches timerPresetSelectBroadcastPayload and sends MafiaWs.timerPresetSelect', () => {
    expect(mafiaSignaling).toMatch(
      /watch\(\s*timerPresetSelectBroadcastPayload[\s\S]*?MafiaWs\.timerPresetSelect[\s\S]*?payload:\s*\{\s*durationMs\s*\}/,
    )
  })

  it('adapter wires :selected-duration-ms and @select-duration on the shared chip', () => {
    expect(mafiaOverlay).toMatch(/:selected-duration-ms="mafiaSelectedTimerDurationMs"/)
    expect(mafiaOverlay).toMatch(/@select-duration="onSelectDuration"/)
    expect(mafiaOverlay).toMatch(/mafiaGame\.selectTimerPreset\(durationMs\)/)
  })
})

describe('Game Template protocol + schema + Room + handler + snapshot', () => {
  it('client and server protocol both export `timerPresetSelect: gameroom:timer-preset-select`', () => {
    expect(gameRoomProtoServer).toMatch(/timerPresetSelect:\s*'gameroom:timer-preset-select'/)
    expect(gameRoomProtoClient).toMatch(/timerPresetSelect:\s*'gameroom:timer-preset-select'/)
  })

  it('Zod schema includes a discriminated `gameroom:timer-preset-select` variant', () => {
    expect(schema).toMatch(
      /z\.literal\(GameRoomWs\.timerPresetSelect\)[\s\S]*?durationMs:\s*z\.number\(\)\.int\(\)\.min\(5_000\)/,
    )
  })

  it('Room stores gameRoomSelectedTimerDurationMs', () => {
    expect(roomTs).toMatch(/gameRoomSelectedTimerDurationMs:\s*number\s*\|\s*null/)
    expect(roomTs).toMatch(/getGameRoomSelectedTimerDurationMs\(\)/)
    expect(roomTs).toMatch(/setGameRoomSelectedTimerDurationMs\(/)
  })

  it('socketServer dispatches the new case to handleGameRoomTimerPresetSelect', () => {
    expect(socketServer).toMatch(/case 'gameroom:timer-preset-select':[\s\S]*?handleGameRoomTimerPresetSelect\(socket, parsed\.data\.payload, deps\)/)
  })

  it('handler gates on isGameRoomHostPeer and broadcasts gameroom:timer-preset-select', () => {
    const block = messageHandlers.match(
      /export function handleGameRoomTimerPresetSelect[\s\S]*?broadcastServerMessageToRoom\(room,[\s\S]*?type:\s*GameRoomWs\.timerPresetSelect[\s\S]*?\}\)\s*\n\}/,
    )
    expect(block, 'handleGameRoomTimerPresetSelect block not found').not.toBeNull()
    expect(block![0]).toMatch(/isGameRoomHostPeer\(room,\s*peer\)/)
    expect(block![0]).toMatch(/setGameRoomSelectedTimerDurationMs\(durationMs\)/)
  })

  it('Game Template snapshot replay sends the preset to a late joiner when set', () => {
    expect(messageHandlers).toMatch(
      /room\.getGameRoomSelectedTimerDurationMs\(\)[\s\S]*?type:\s*GameRoomWs\.timerPresetSelect/,
    )
  })
})

describe('Game Template store + signaling — host write + inbound apply + broadcast watcher', () => {
  it('store exposes selectedTimerDurationMs ref + selectTimerPreset + applyTimerPresetSelectFromSignaling', () => {
    expect(gameRoomStore).toMatch(/selectedTimerDurationMs\s*=\s*ref<number\s*\|\s*null>\(null\)/)
    expect(gameRoomStore).toMatch(/function selectTimerPreset\(durationMs:\s*number\)/)
    expect(gameRoomStore).toMatch(/function applyTimerPresetSelectFromSignaling\(durationMs:\s*number\)/)
    expect(gameRoomStore).toMatch(/timerPresetSelectBroadcastPayload\s*=\s*ref<number\s*\|\s*null>/)
  })

  it('store selectTimerPreset validates against GAME_ROOM_TIMER_PRESET_MS', () => {
    const fnMatch = gameRoomStore.match(/function selectTimerPreset\(durationMs:\s*number\)[\s\S]*?\n\s*\}/)
    expect(fnMatch, 'selectTimerPreset not found').not.toBeNull()
    expect(fnMatch![0]).toMatch(/GAME_ROOM_TIMER_PRESET_MS\.includes/)
  })

  it('signaling parses gameroom:timer-preset-select and applies it', () => {
    expect(gameRoomSignaling).toMatch(/function parseGameRoomTimerPresetSelect/)
    expect(gameRoomSignaling).toMatch(/gameStore\.applyTimerPresetSelectFromSignaling\(presetParsed\)/)
  })

  it('signaling watches timerPresetSelectBroadcastPayload and sends GameRoomWs.timerPresetSelect', () => {
    expect(gameRoomSignaling).toMatch(
      /watch\(\s*timerPresetSelectBroadcastPayload[\s\S]*?GameRoomWs\.timerPresetSelect[\s\S]*?payload:\s*\{\s*durationMs\s*\}/,
    )
  })

  it('adapter wires :selected-duration-ms and @select-duration on the shared chip', () => {
    expect(gameTemplateOverlay).toMatch(/:selected-duration-ms="selectedTimerDurationMs"/)
    expect(gameTemplateOverlay).toMatch(/@select-duration="onSelectDuration"/)
    expect(gameTemplateOverlay).toMatch(/gameStore\.selectTimerPreset\(durationMs\)/)
  })
})
