<script setup lang="ts">
import { computed, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import CallPage from '@/components/call/CallPage.vue'
import { useEatFirstCallStreamView } from '@/composables/eatFirstCallStreamView'
import EatFirstCallHostPanel from '@/eat-first/components/EatFirstCallHostPanel.vue'
import EatFirstCallTimerStrip from '@/eat-first/components/EatFirstCallTimerStrip.vue'
import { useEatFirstCallGameSnapshot } from '@/eat-first/composables/useEatFirstCallGameSnapshot'
import { normalizeDisplayName } from 'call-core'
import { efEnsureGame } from '@/eat-first/services/eatFirstTransport'
import { setPersistedGameId } from '@/eat-first/utils/persistedGameId.js'
import { useEatFirstCallShellStore } from '@/stores/eatFirstCallShell'
import { createLogger } from '@/utils/logger'

const log = createLogger('eat-first:call-page')

const route = useRoute()
const { t } = useI18n()
const { isStreamView } = useEatFirstCallStreamView()
const eatFirstShell = useEatFirstCallShellStore()

const gameId = computed(() => {
  const g = route.query.game
  return typeof g === 'string' ? normalizeDisplayName(g) : ''
})

const { snapshot, room, display, speakingTimer, timerRoomFields, gamePhase } = useEatFirstCallGameSnapshot(gameId)

watch(
  () => gameId.value,
  (gid) => {
    eatFirstShell.setGameId(gid)
    if (!gid) {
      return
    }
    setPersistedGameId(gid)
    void efEnsureGame(gid).catch((e) => {
      log.warn('ensure game failed', e)
    })
  },
  { immediate: true },
)

watch(
  () => room.value.playerOrder,
  (po) => {
    eatFirstShell.setPlayerOrder(Array.isArray(po) ? (po as string[]) : [])
  },
  { immediate: true },
)

function normalizedTraitValue(data: Record<string, unknown>, key: string): string {
  const chunk = data[key]
  if (!chunk || typeof chunk !== 'object' || Array.isArray(chunk)) return ''
  const value = (chunk as { value?: unknown }).value
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeLegacyTraitText(input: string): string {
  const raw = String(input ?? '').trim()
  if (!raw) return ''
  const table: Record<string, string> = {
    Engineer: 'Професія: інженер',
    Teacher: 'Професія: вчитель',
    Doctor: 'Професія: лікар',
    Musician: 'Професія: музикант',
    Muscian: 'Професія: музикант',
    Designer: 'Професія: дизайнер',
    Athlete: 'Професія: спортсмен',
    Cook: 'Професія: кухар',
    Pilot: 'Професія: пілот',
    'Phobia: heights': 'Фобія: висота',
    'Phobia: darkness': 'Фобія: темрява',
    'Health: asthma': 'Здоров’я: астма',
    'Health: allergies': 'Здоров’я: алергія',
    'Luggage: toolkit': 'Багаж: набір інструментів',
    'Luggage: first-aid kit': 'Багаж: аптечка',
    'Fact: speaks 4 languages': 'Факт: говорить 4 мовами',
    'Fact: survived shipwreck': 'Факт: пережив кораблетрощу',
    'Quirk: never lies': 'Особливість: ніколи не бреше',
    'Quirk: sleepwalker': 'Особливість: говорить уві сні',
  }
  return table[raw] ?? raw
}

function parseRoomTraitLines(lines: string[]): Partial<Record<'profession' | 'health' | 'hobby' | 'phobia' | 'fact' | 'baggage', string>> {
  const out: Partial<Record<'profession' | 'health' | 'hobby' | 'phobia' | 'fact' | 'baggage', string>> = {}
  const map: Array<{ key: 'profession' | 'health' | 'hobby' | 'phobia' | 'fact' | 'baggage'; re: RegExp }> = [
    { key: 'profession', re: /^(професія|профессия|profession)\s*[:：-]\s*/i },
    { key: 'health', re: /^(здоров['’`]?я|здоровье|health)\s*[:：-]\s*/i },
    { key: 'hobby', re: /^(хобі|хобби|hobby|особливість|quirk)\s*[:：-]\s*/i },
    { key: 'phobia', re: /^(фобія|фобия|phobia)\s*[:：-]\s*/i },
    { key: 'fact', re: /^(факт|fact)\s*[:：-]\s*/i },
    { key: 'baggage', re: /^(багаж|luggage|bag)\s*[:：-]\s*/i },
  ]
  for (const line of lines) {
    const raw = normalizeLegacyTraitText(line)
    for (const row of map) {
      if (row.re.test(raw)) {
        out[row.key] = raw.replace(row.re, '').trim()
      }
    }
  }
  return out
}

function seatTraitsForPlayer(row: Record<string, unknown>, roomTraits: string[]): string[] {
  const fromRoom = parseRoomTraitLines(roomTraits)
  const profession = normalizedTraitValue(row, 'profession') || fromRoom.profession || 'Невідомо'
  const health = normalizedTraitValue(row, 'health') || fromRoom.health || 'Невідомо'
  const hobby = normalizedTraitValue(row, 'quirk') || fromRoom.hobby || 'Невідомо'
  const phobia = normalizedTraitValue(row, 'phobia') || fromRoom.phobia || 'Невідомо'
  const fact = normalizedTraitValue(row, 'fact') || fromRoom.fact || 'Невідомо'
  const baggage = normalizedTraitValue(row, 'luggage') || fromRoom.baggage || 'Невідомо'
  const age = typeof row.age === 'string' && row.age.trim().length > 0 ? row.age.trim() : 'Невідомо'
  const gender = typeof row.gender === 'string' && row.gender.trim().length > 0 ? row.gender.trim() : 'Невідомо'
  return [
    `Стать: ${gender}`,
    `Вік: ${age}`,
    `${t('traits.profession')}: ${profession}`,
    `${t('traits.health')}: ${health}`,
    `${t('traits.hobby')}: ${hobby}`,
    `${t('traits.phobia')}: ${phobia}`,
    `${t('traits.fact')}: ${fact}`,
    `${t('traits.luggage')}: ${baggage}`,
  ]
}

watch(
  () => [snapshot.value?.players, room.value.playerOrder] as const,
  ([playersRaw, orderRaw]) => {
    const roomTraitsRaw =
      room.value.callTraitsBySeat && typeof room.value.callTraitsBySeat === 'object' && !Array.isArray(room.value.callTraitsBySeat)
        ? (room.value.callTraitsBySeat as Record<string, unknown>)
        : null
    const players = Array.isArray(playersRaw) ? playersRaw : []
    const order = Array.isArray(orderRaw)
      ? orderRaw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      : []
    const byId = new Map<string, Record<string, unknown>>()
    for (const row of players) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) continue
      const id = typeof (row as { id?: unknown }).id === 'string' ? String((row as { id?: unknown }).id).trim() : ''
      if (!id) continue
      byId.set(id, row as Record<string, unknown>)
    }
    const next: Record<number, string[]> = {}
    order.forEach((slotId, index) => {
      const row = byId.get(slotId)
      if (!row) return
      const fromRoom = (() => {
        if (roomTraitsRaw == null) return []
        const seatRow = roomTraitsRaw[String(index + 1)]
        if (!Array.isArray(seatRow)) return []
        return seatRow
          .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
          .map((x) => normalizeLegacyTraitText(x))
      })()
      next[index + 1] = seatTraitsForPlayer(row, fromRoom)
    })
    if (Object.keys(next).length > 0) {
      eatFirstShell.setTraitsBySeat(next)
    }
  },
  { immediate: true },
)

watch(
  () => room.value.callTraitsBySeat,
  (raw) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return
    const normalized: Record<number, string[]> = {}
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const seat = Number(k)
      if (!Number.isFinite(seat) || seat < 1 || !Array.isArray(v)) continue
      normalized[seat] = v
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((x) => normalizeLegacyTraitText(x))
    }
    if (Object.keys(normalized).length > 0) {
      eatFirstShell.setTraitsBySeat(normalized)
    }
  },
  { immediate: true },
)

watch(
  () => display.value.playerCount,
  (count) => {
    eatFirstShell.setPlayerCount(count)
  },
  { immediate: true },
)

const showHostPanel = computed(() => !isStreamView.value && eatFirstShell.isEatFirstRoomHost)

onUnmounted(() => {
  eatFirstShell.setEatFirstCallShellHost(false)
})
</script>

<template>
  <div
    class="eat-first-call-page"
    data-eat-first-call="1"
    :class="{ 'eat-first-call-page--stream-view': isStreamView }"
  >
    <div class="eat-first-call-page__call">
      <CallPage :eat-first-stream-view="isStreamView" />
    </div>
    <EatFirstCallTimerStrip
      :view-mode="isStreamView"
      :is-eat-first-host="showHostPanel"
      :speaking-total-sec="speakingTimer"
      :timer-started-at="timerRoomFields.startedAt"
      :timer-paused="timerRoomFields.paused"
      :frozen-remaining-sec="timerRoomFields.frozenRemainingSec"
    />
    <EatFirstCallHostPanel
      v-if="showHostPanel"
      :game-id="gameId"
      :host-display-seat="display.hostDisplaySeat"
      :player-count="display.playerCount"
      :game-phase="gamePhase"
    />
  </div>
</template>

<style scoped>
.eat-first-call-page {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: 100%;
  overflow: hidden;
}

.eat-first-call-page__call {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

@media (hover: hover) {
  .eat-first-call-page :deep(.call-page__tile-wrap:hover:not(.call-page__tile-wrap--pinned)) {
    z-index: 50;
  }
}
</style>
