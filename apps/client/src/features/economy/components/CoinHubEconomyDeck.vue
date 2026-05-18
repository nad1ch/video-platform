<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useEconomyStore } from '../state/economyStore'
import { useCasesStore } from '../state/casesStore'
import CaseCatalogCard from './CaseCatalogCard.vue'
import CaseOpenResultModal from './CaseOpenResultModal.vue'

/**
 * Coin Hub Economy Deck — the visible economy surface inside CoinHubPage.
 *
 * Composes the new Viewer Economy features (XP/level, typed pending rewards,
 * daily bonus claim, case catalog, predictions entry, transaction history)
 * into a single deck of `.ch-ds-card` sections that sit below the existing
 * CoinHub hero/spin/cases. Reuses `economyStore` and `casesStore` — no new
 * state owners.
 *
 * Visual language is the existing CoinHub design system (`.ch-ds-card`,
 * `.ch-ds-text-section`, purple/gold tokens). No new color palette.
 */

const economy = useEconomyStore()
const cases = useCasesStore()

const {
  wallet,
  walletLoading,
  walletError,
  claimAllInflight,
  claimDailyInflight,
  claimByIdInflight,
  lastActionError,
  lastClaimedAmount,
  transactions,
  transactionsLoading,
  transactionsHasMore,
} = storeToRefs(economy)
const {
  catalog: casesCatalog,
  catalogLoading: casesLoading,
  openingSlug,
  lastOpenResult,
} = storeToRefs(cases)

const xpBalance = computed(() => wallet.value?.xpBalance ?? 0)
const level = computed(() => wallet.value?.level ?? 0)
const currentLevelXp = computed(() => wallet.value?.currentLevelXp ?? 0)
const nextLevelXp = computed(() => wallet.value?.nextLevelXp ?? 0)
const progressPct = computed(() => {
  const p = wallet.value?.progressToNextLevel ?? 0
  return Math.round(Math.max(0, Math.min(1, p)) * 100)
})
const pendingRows = computed(() => wallet.value?.pending ?? [])
const hasPending = computed(() => pendingRows.value.length > 0)
const pendingCoins = computed(() => wallet.value?.pendingCoins ?? 0)
const pendingXp = computed(() => wallet.value?.pendingXp ?? 0)
const boost = computed(() => wallet.value?.boosts ?? null)
const hasBoost = computed(() => boost.value?.plan !== null && boost.value?.plan !== undefined)
const recentTransactions = computed(() => transactions.value.slice(0, 8))
const hasDailyPending = computed(() => pendingRows.value.some((r) => r.kind === 'daily'))

const flashMessage = ref<string | null>(null)
let flashTimer: ReturnType<typeof setTimeout> | null = null
function flash(text: string): void {
  flashMessage.value = text
  if (flashTimer) clearTimeout(flashTimer)
  flashTimer = setTimeout(() => {
    flashMessage.value = null
    flashTimer = null
  }, 4_000)
}

watch(lastClaimedAmount, (v) => {
  if (!v) return
  flash(`Зараховано +${v.coins} монет${v.xp > 0 ? `, +${v.xp} XP` : ''}`)
})

onMounted(() => {
  void economy.loadWallet()
  void economy.loadTransactions({ reset: true })
  void cases.loadCatalog()
})

async function onClaimAll(): Promise<void> {
  const ok = await economy.claimAll()
  if (ok) {
    void economy.loadTransactions({ reset: true })
  } else if (!lastActionError.value) {
    flash('Немає нагород для отримання')
  }
}
async function onClaimDaily(): Promise<void> {
  const r = await economy.claimDaily()
  if (r.granted) flash('Щоденний бонус додано в Pending')
  else if (r.alreadyClaimedToday) flash('Сьогодні бонус уже отримано')
}
async function onClaimRow(id: string): Promise<void> {
  const ok = await economy.claimById(id)
  if (ok) void economy.loadTransactions({ reset: true })
}
async function onOpenCatalogCase(slug: string): Promise<void> {
  const ok = await cases.openCase(slug)
  if (ok) {
    void economy.loadWallet({ silent: true })
    void economy.loadTransactions({ reset: true })
  }
}

const KIND_LABELS: Record<string, string> = {
  daily: 'Щоденний бонус',
  chat_activity: 'Активність у чаті',
  watch_time: 'Час перегляду',
  game_participation: 'Участь у грі',
  streak: 'Серія перемог',
  event: 'Подія',
  prediction_payout: 'Виплата прогнозу',
  subscription_chest: 'Скриня підписника',
  streamer_loyalty: 'Лояльність стрімеру',
  legacy: 'Стара система',
}
function labelFor(kind: string): string {
  return KIND_LABELS[kind] ?? kind
}

function fmtExpiresIn(iso: string): string {
  const ms = Date.parse(iso) - Date.now()
  if (!Number.isFinite(ms) || ms <= 0) return 'закінчилось'
  const m = Math.floor(ms / 60_000)
  if (m < 60) return `${m} хв`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} год`
  const d = Math.floor(h / 24)
  return `${d} дн`
}

function fmtTxTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('uk-UA', { dateStyle: 'short', timeStyle: 'short' })
}
function fmtDelta(delta: number): string {
  if (delta > 0) return `+${delta.toLocaleString('uk-UA')}`
  return delta.toLocaleString('uk-UA')
}
function deltaTextClass(delta: number): string {
  if (delta > 0) return 'text-emerald-300'
  if (delta < 0) return 'text-rose-300'
  return 'text-slate-400'
}
</script>

<template>
  <div class="coinhub-econ-deck flex w-full min-w-0 flex-col gap-6 px-4">
    <!-- Flash + errors -->
    <div
      v-if="flashMessage"
      class="ch-ds-card flex items-center gap-3 px-4 py-3 text-sm text-amber-100"
      role="status"
    >
      <span aria-hidden="true">✦</span>
      <span>{{ flashMessage }}</span>
    </div>

    <div
      v-if="walletError"
      class="ch-ds-card flex items-center justify-between gap-3 px-4 py-3 text-sm text-rose-200"
      role="alert"
    >
      <span>Не вдалося завантажити баланс: {{ walletError.message }}</span>
      <button
        type="button"
        class="rounded-full border border-rose-300/40 bg-rose-400/10 px-3 py-1 text-xs font-semibold text-rose-100 hover:bg-rose-400/20"
        @click="economy.loadWallet()"
      >
        Повторити
      </button>
    </div>

    <!-- XP / Level / Boost -->
    <section
      class="ch-ds-card ch-ds-card--interactive flex flex-col gap-5 p-6 sm:p-8"
      :aria-label="'Прогрес'"
    >
      <header class="flex items-end justify-between gap-3">
        <div>
          <p class="ch-ds-text-label text-xs font-semibold uppercase tracking-[0.22em] text-violet-300/80">
            Прогрес
          </p>
          <h2 class="ch-ds-text-section mt-1 text-[24px] sm:text-[28px]">
            XP та рівень
          </h2>
        </div>
        <div v-if="hasBoost" class="text-right">
          <p class="ch-ds-text-label text-[11px] uppercase tracking-[0.18em] text-emerald-300/70">
            Активний буст
          </p>
          <p class="mt-0.5 text-sm font-semibold text-emerald-200">
            {{ boost?.plan }} · ×{{ boost?.coinsMultiplier.toFixed(2) }} монет / ×{{
              boost?.xpMultiplier.toFixed(2)
            }} XP
          </p>
        </div>
      </header>

      <div class="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div>
          <p class="text-[64px] font-bold leading-none tabular-nums text-white drop-shadow-[0_0_24px_rgba(168,85,247,0.35)] sm:text-[72px]">
            {{ level }}
          </p>
          <p class="mt-1 text-xs uppercase tracking-[0.16em] text-violet-200/60">
            Рівень
          </p>
        </div>
        <div class="flex flex-col justify-end gap-1 text-right">
          <p class="text-[28px] font-semibold tabular-nums text-amber-200 drop-shadow-[0_0_16px_rgba(250,204,21,0.25)]">
            {{ xpBalance.toLocaleString('uk-UA') }}
          </p>
          <p class="text-[11px] uppercase tracking-[0.16em] text-amber-200/60">
            XP всього
          </p>
        </div>
      </div>

      <div class="flex flex-col gap-1.5">
        <div class="flex items-end justify-between text-xs text-slate-300 tabular-nums">
          <span>{{ currentLevelXp.toLocaleString('uk-UA') }} XP</span>
          <span class="text-slate-100">{{ progressPct }}%</span>
          <span>{{ nextLevelXp.toLocaleString('uk-UA') }} XP</span>
        </div>
        <div class="relative h-3 w-full overflow-hidden rounded-full bg-[#100620]/80 ring-1 ring-violet-400/15">
          <div
            class="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-amber-400 shadow-[0_0_18px_rgba(168,85,247,0.55)] transition-[width] duration-500"
            :style="{ width: `${progressPct}%` }"
          />
        </div>
      </div>
    </section>

    <!-- Pending rewards + Claim all -->
    <section
      class="ch-ds-card flex flex-col gap-4 p-6 sm:p-8"
      :aria-label="'Очікують отримання'"
    >
      <header class="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
        <div>
          <p class="ch-ds-text-label text-xs font-semibold uppercase tracking-[0.22em] text-violet-300/80">
            Очікують
          </p>
          <h2 class="ch-ds-text-section mt-1 text-[24px] sm:text-[28px]">
            Нагороди до отримання
          </h2>
          <p class="ch-ds-text-muted mt-1.5 text-sm">
            Чат, ігри, прогнози, події — все накопичується тут, доки ти не натиснеш «Забрати».
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <button
            type="button"
            class="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2 text-sm font-semibold text-amber-950 shadow-[0_10px_30px_rgba(251,191,36,0.25)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="claimAllInflight || !hasPending"
            @click="onClaimAll"
          >
            <span v-if="claimAllInflight">Зараховуємо…</span>
            <span v-else>
              Забрати все ({{ pendingCoins.toLocaleString('uk-UA') }})
            </span>
          </button>
          <button
            type="button"
            class="rounded-full border border-violet-300/40 bg-violet-400/10 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-400/20 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="claimDailyInflight || hasDailyPending"
            :title="hasDailyPending ? 'Щоденний бонус уже в списку' : 'Отримати щоденний бонус'"
            @click="onClaimDaily"
          >
            <span v-if="claimDailyInflight">Працюємо…</span>
            <span v-else-if="hasDailyPending">Щоденний бонус готовий</span>
            <span v-else>Щоденний бонус</span>
          </button>
        </div>
      </header>

      <p
        v-if="hasPending"
        class="text-xs text-slate-400 tabular-nums"
      >
        Всього: <span class="text-amber-200 font-semibold">+{{ pendingCoins.toLocaleString('uk-UA') }}</span>
        монет ·
        <span class="text-violet-200 font-semibold">+{{ pendingXp.toLocaleString('uk-UA') }}</span>
        XP
      </p>

      <ul
        v-if="hasPending"
        class="divide-y divide-white/5 rounded-2xl border border-white/10 bg-[#0c0719]/70"
      >
        <li
          v-for="row in pendingRows"
          :key="row.id"
          class="flex items-center justify-between gap-3 px-4 py-3"
        >
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-slate-100">{{ labelFor(row.kind) }}</p>
            <p class="mt-0.5 text-[11px] text-slate-400 tabular-nums">
              <span v-if="row.coinAmount > 0">+{{ row.coinAmount.toLocaleString('uk-UA') }} монет</span>
              <span v-if="row.coinAmount > 0 && row.xpAmount > 0"> · </span>
              <span v-if="row.xpAmount > 0">+{{ row.xpAmount.toLocaleString('uk-UA') }} XP</span>
              <span class="ml-2 text-slate-500">згоряє через {{ fmtExpiresIn(row.expiresAt) }}</span>
            </p>
          </div>
          <button
            type="button"
            class="shrink-0 rounded-full border border-amber-300/40 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-100 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-50"
            :disabled="claimByIdInflight === row.id"
            @click="onClaimRow(row.id)"
          >
            {{ claimByIdInflight === row.id ? '…' : 'Забрати' }}
          </button>
        </li>
      </ul>

      <p
        v-else-if="!walletLoading"
        class="rounded-2xl border border-white/5 bg-[#0c0719]/40 px-4 py-6 text-center text-sm text-slate-400"
      >
        Поки нічого не очікує. Спілкуйся в чаті, бери участь в іграх та подіях — нагороди з'являться тут.
      </p>

      <p v-else class="text-center text-sm text-slate-500">Завантаження…</p>

      <p v-if="lastActionError" class="text-xs text-rose-300">
        {{ lastActionError.code }} · {{ lastActionError.message }}
      </p>
    </section>

    <!-- Cases catalog (only if backend has rows) -->
    <section
      v-if="casesCatalog.length > 0 || casesLoading"
      class="ch-ds-card flex flex-col gap-4 p-6 sm:p-8"
      :aria-label="'Каталог скринь'"
    >
      <header class="flex flex-col gap-1">
        <p class="ch-ds-text-label text-xs font-semibold uppercase tracking-[0.22em] text-violet-300/80">
          Каталог
        </p>
        <h2 class="ch-ds-text-section mt-1 text-[24px] sm:text-[28px]">
          Скрині
        </h2>
        <p class="ch-ds-text-muted mt-1.5 text-sm">
          Сервер обирає винагороду. Кожна скриня має гарантований мінімум.
        </p>
      </header>
      <div v-if="casesLoading && casesCatalog.length === 0" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="i in 3"
          :key="`case-skel-${i}`"
          class="h-44 animate-pulse rounded-2xl border border-white/5 bg-white/[0.03]"
        />
      </div>
      <div v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <CaseCatalogCard
          v-for="c in casesCatalog"
          :key="c.slug"
          :entry="c"
          :busy="openingSlug === c.slug"
          @open="onOpenCatalogCase"
        />
      </div>
    </section>

    <!-- Predictions entry -->
    <section
      class="ch-ds-card flex flex-col gap-4 p-6 sm:p-8"
      :aria-label="'Прогнози'"
    >
      <header class="flex flex-col gap-1">
        <p class="ch-ds-text-label text-xs font-semibold uppercase tracking-[0.22em] text-violet-300/80">
          На стрімах
        </p>
        <h2 class="ch-ds-text-section mt-1 text-[24px] sm:text-[28px]">
          Прогнози
        </h2>
        <p class="ch-ds-text-muted mt-1.5 text-sm">
          Внутрішні прогнози на зароблені монети. Без реальних грошей, без виведення.
        </p>
      </header>
      <div class="rounded-2xl border border-white/10 bg-[#0c0719]/60 p-5">
        <p class="text-sm text-slate-300">
          Прогнози створюються стрімером і доступні в межах конкретного стріму.
          Відкрий сторінку улюбленого стрімера, щоб приєднатися — твоя ставка та винагорода завжди
          обчислюються на сервері.
        </p>
        <p class="mt-2 text-xs text-slate-500">
          Шлях: <span class="font-mono text-slate-300">/app/predictions/&lt;нік стрімера&gt;</span>
        </p>
      </div>
    </section>

    <!-- Recent transactions -->
    <section
      class="ch-ds-card flex flex-col gap-4 p-6 sm:p-8"
      :aria-label="'Історія'"
    >
      <header class="flex items-end justify-between gap-3">
        <div>
          <p class="ch-ds-text-label text-xs font-semibold uppercase tracking-[0.22em] text-violet-300/80">
            Історія
          </p>
          <h2 class="ch-ds-text-section mt-1 text-[24px] sm:text-[28px]">
            Останні операції
          </h2>
        </div>
        <button
          v-if="transactionsHasMore && recentTransactions.length > 0"
          type="button"
          class="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="transactionsLoading"
          @click="economy.loadTransactions()"
        >
          {{ transactionsLoading ? 'Завантажуємо…' : 'Більше' }}
        </button>
      </header>

      <div class="overflow-hidden rounded-2xl border border-white/10 bg-[#0c0719]/70">
        <ul class="divide-y divide-white/5">
          <li
            v-for="row in recentTransactions"
            :key="`${row.kind}:${row.id}`"
            class="flex items-center justify-between gap-3 px-4 py-2.5"
          >
            <div class="min-w-0 flex-1">
              <p class="text-sm text-slate-200">
                <span class="font-semibold uppercase tracking-[0.14em] text-slate-400">{{ row.kind }}</span>
                <span class="ml-2">{{ row.source }}</span>
                <span v-if="row.sourceRef" class="ml-1 text-slate-500">· {{ row.sourceRef }}</span>
              </p>
              <p class="mt-0.5 text-[11px] text-slate-500 tabular-nums">{{ fmtTxTime(row.createdAt) }}</p>
            </div>
            <p
              class="shrink-0 text-sm font-semibold tabular-nums"
              :class="deltaTextClass(row.delta)"
            >
              {{ fmtDelta(row.delta) }}
            </p>
          </li>
          <li
            v-if="!transactionsLoading && recentTransactions.length === 0"
            class="px-4 py-6 text-center text-sm text-slate-500"
          >
            Поки немає операцій.
          </li>
          <li
            v-else-if="transactionsLoading && recentTransactions.length === 0"
            class="px-4 py-6 text-center text-sm text-slate-500"
          >
            Завантажуємо історію…
          </li>
        </ul>
      </div>
    </section>

    <CaseOpenResultModal :result="lastOpenResult" @close="cases.clearLastResult()" />
  </div>
</template>

<style scoped>
.coinhub-econ-deck {
  margin: 0 auto;
  max-width: 1300px;
}
</style>
