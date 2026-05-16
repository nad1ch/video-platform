<script setup lang="ts">
import { computed, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRoute } from 'vue-router'
import CallPage from '@/components/call/CallPage.vue'
import GameRoomPageShell from '@/components/game-room/GameRoomPageShell.vue'
import { useEatFirstCallStreamView } from '@/composables/eatFirstCallStreamView'
import EatFirstCallHostPanel from '@/eat-first/components/EatFirstCallHostPanel.vue'
import EatFirstCallTimerStrip from '@/eat-first/components/EatFirstCallTimerStrip.vue'
import { useEatFirstCallGameSnapshot } from '@/eat-first/composables/useEatFirstCallGameSnapshot'
import { normalizeDisplayName } from 'call-core'
import { efEnsureGame } from '@/eat-first/services/eatFirstTransport'
import { setPersistedGameId } from '@/eat-first/utils/persistedGameId.js'
import { useEatFirstCallShellStore } from '@/stores/eatFirstCallShell'
import { resolveEatFirstTimerStripModel } from '@/eat-first/utils/eatFirstTimerStripModel'
import { createLogger } from '@/utils/logger'

const log = createLogger('eat-first:call-page')

const route = useRoute()
const { isStreamView } = useEatFirstCallStreamView()
const eatFirstShell = useEatFirstCallShellStore()
const { eatFirstCallTimerFromTableSync, selectedTimerDurationMs: eatFirstSelectedTimerDurationMs } =
  storeToRefs(eatFirstShell)

const gameId = computed(() => {
  const g = route.query.game
  return typeof g === 'string' ? normalizeDisplayName(g) : ''
})

type EatFirstTraitKey =
  | 'gender'
  | 'age'
  | 'profession'
  | 'health'
  | 'hobby'
  | 'phobia'
  | 'fact'
  | 'baggage'

const { snapshot, room, display, speakingTimer, timerRoomFields, gamePhase } = useEatFirstCallGameSnapshot(
  gameId,
  isStreamView,
)

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
    const next = Array.isArray(po)
      ? (po as string[]).filter((x) => typeof x === 'string' && /^p([1-9]|1[01])$/i.test(x.trim())).map((x) => x.trim())
      : []
    const current = eatFirstShell.playerOrder
    if (next.length < 1) return
    // Signaling (`eat:table-state-sync` / `eat:trait-state-sync`) owns order after join; snapshot only seeds empty shell.
    if (current.length < 1) {
      eatFirstShell.setPlayerOrder(next)
    }
  },
  { immediate: true },
)

function normalizedTraitValue(data: Record<string, unknown>, key: string): string {
  const chunk = data[key]
  if (typeof chunk === 'string') {
    return chunk.trim()
  }
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

function slotTraitsForPlayer(
  row: Record<string, unknown>,
  roomTraits: string[],
): Record<EatFirstTraitKey, string> | null {
  const fromRoom = parseRoomTraitLines(roomTraits)
  const profession = normalizedTraitValue(row, 'profession') || fromRoom.profession || ''
  const health = normalizedTraitValue(row, 'health') || fromRoom.health || ''
  const hobby = normalizedTraitValue(row, 'quirk') || fromRoom.hobby || ''
  const phobia = normalizedTraitValue(row, 'phobia') || fromRoom.phobia || ''
  const fact = normalizedTraitValue(row, 'fact') || fromRoom.fact || ''
  const baggage = normalizedTraitValue(row, 'luggage') || fromRoom.baggage || ''
  const age = typeof row.age === 'string' ? row.age.trim() : ''
  const gender = typeof row.gender === 'string' ? row.gender.trim() : ''
  const values = { gender, age, profession, health, hobby, phobia, fact, baggage }
  const complete = (Object.values(values) as string[]).every((v) => v.length > 0)
  return complete ? values : null
}

function actionCardFromRow(row: Record<string, unknown>): {
  title: string
  description: string
  templateId: string
  effectId: string
  used: boolean
} | null {
  const ac = row.activeCard
  if (!ac || typeof ac !== 'object' || Array.isArray(ac)) return null
  const r = ac as Record<string, unknown>
  const title = typeof r.title === 'string' ? r.title.trim() : ''
  const description = typeof r.description === 'string' ? r.description.trim() : ''
  const templateId = typeof r.templateId === 'string' ? r.templateId.trim() : ''
  const effectId = typeof r.effectId === 'string' ? r.effectId.trim() : ''
  const used = r.used === true
  if (title.length < 1 && templateId.length < 1) return null
  return { title, description, templateId, effectId, used }
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
    const nextSlot: Record<string, Record<EatFirstTraitKey, string>> = {}
    const nextActionCard: Record<
      string,
      { title: string; description: string; templateId: string; effectId: string; used: boolean }
    > = {}
    let lastUsed: { slotId: string; title: string; description: string } | null = null
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
      const structuredTraits = slotTraitsForPlayer(row, fromRoom)
      if (structuredTraits) {
        nextSlot[slotId] = structuredTraits
      }
      const ac = actionCardFromRow(row)
      if (ac) {
        nextActionCard[slotId] = ac
        if (ac.used && ac.title.length > 0) {
          lastUsed = { slotId, title: ac.title, description: ac.description }
        }
      }
    })
    if (Object.keys(nextSlot).length > 0 && Object.keys(eatFirstShell.traitsBySlot).length < 1) {
      eatFirstShell.setTraitsBySlot(nextSlot)
    }
    if (Object.keys(eatFirstShell.actionCardBySlot).length < 1 && Object.keys(nextActionCard).length > 0) {
      eatFirstShell.setActionCardBySlot(nextActionCard)
    }
    if (eatFirstShell.lastUsedActionCard == null && lastUsed != null) {
      eatFirstShell.setLastUsedActionCard(lastUsed)
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

/** Prefer signaling timer from `eat:table-state-sync`; snapshot fields only when shell has no timer. */
const eatFirstTimerStripModel = computed(() =>
  resolveEatFirstTimerStripModel({
    tableSyncTimer: eatFirstCallTimerFromTableSync.value,
    snapshotSpeakingTotalSec: speakingTimer.value,
    snapshotTimerFields: timerRoomFields.value,
  }),
)

onUnmounted(() => {
  eatFirstShell.setEatFirstCallShellHost(false)
  eatFirstShell.setEatFirstCallTimerFromTableSync(null)
})
</script>

<template>
  <!--
    Mafia-parity shell: `GameRoomPageShell` owns the flex layout, the
    `route-class` plus `--view-mode` / `--stream-view` modifier classes, and
    the call-tile hover override. Eat First-specific slots:
      stage      → <CallPage>
      host-panel → <EatFirstCallHostPanel> (host-only, hidden in `mode=view`)
      overlays   → <EatFirstCallTimerStrip> (visible in both modes;
                   `EatFirstCallTimerStrip` adapts via `:view-mode`)
    The host panel and timer strip are both `position: fixed`, so the slot
    order between them does not affect visual position.
  -->
  <GameRoomPageShell
    route-class="eat-first-call-page"
    :is-view-mode="isStreamView"
    :signaling-warning-visible="false"
    signaling-warning-text=""
  >
    <template #stage>
      <CallPage :eat-first-stream-view="isStreamView" />
    </template>
    <template #host-panel>
      <EatFirstCallHostPanel
        v-if="showHostPanel"
        :game-id="gameId"
        :host-display-seat="display.hostDisplaySeat"
        :player-count="display.playerCount"
        :game-phase="gamePhase"
        :timer-speaking-total-sec="eatFirstTimerStripModel.speakingTotalSec"
        :timer-started-at="eatFirstTimerStripModel.timerStartedAt"
        :timer-paused="eatFirstTimerStripModel.timerPaused"
        :timer-frozen-remaining-sec="eatFirstTimerStripModel.frozenRemainingSec"
      />
    </template>
    <template #overlays>
      <EatFirstCallTimerStrip
        :view-mode="isStreamView"
        :is-eat-first-host="showHostPanel"
        :speaking-total-sec="eatFirstTimerStripModel.speakingTotalSec"
        :timer-started-at="eatFirstTimerStripModel.timerStartedAt"
        :timer-paused="eatFirstTimerStripModel.timerPaused"
        :frozen-remaining-sec="eatFirstTimerStripModel.frozenRemainingSec"
        :game-id="gameId"
        :selected-timer-duration-ms="eatFirstSelectedTimerDurationMs"
      />
    </template>
  </GameRoomPageShell>
</template>
