<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useEconomyStore } from '../state/economyStore'
import EconomyBalanceCards from '../components/EconomyBalanceCards.vue'
import EconomyPendingList from '../components/EconomyPendingList.vue'
import EconomyTransactionsTable from '../components/EconomyTransactionsTable.vue'

const store = useEconomyStore()
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
  transactionsKind,
} = storeToRefs(store)

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
  flash(`Claimed +${v.coins} coins${v.xp > 0 ? `, +${v.xp} XP` : ''}`)
})

onMounted(() => {
  void store.loadWallet()
  void store.loadTransactions({ reset: true })
})

async function onClaimAll(): Promise<void> {
  const ok = await store.claimAll()
  if (ok) {
    void store.loadTransactions({ reset: true })
  } else if (!lastActionError.value) {
    flash('Nothing to claim')
  }
}

async function onClaimDaily(): Promise<void> {
  const r = await store.claimDaily()
  if (r.granted) flash('Daily reward added to pending')
  else if (r.alreadyClaimedToday) flash('Daily already claimed today')
}

async function onClaimRow(id: string): Promise<void> {
  const ok = await store.claimById(id)
  if (ok) void store.loadTransactions({ reset: true })
}

function onKindChange(kind: 'all' | 'coin' | 'xp'): void {
  void store.loadTransactions({ kind, reset: true })
}

const hasPending = computed(() => (wallet.value?.pending?.length ?? 0) > 0)
const initialLoading = computed(() => walletLoading.value && !wallet.value)
</script>

<template>
  <main class="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 py-6 text-slate-100">
    <header class="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
      <div>
        <p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-300/70">
          Viewer Economy
        </p>
        <h1 class="text-2xl font-semibold tracking-tight text-white">Wallet</h1>
      </div>
      <p class="text-xs text-slate-400">
        Server is the source of truth. All balances and rewards are decided server-side.
      </p>
    </header>

    <div
      v-if="flashMessage"
      class="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100"
    >
      {{ flashMessage }}
    </div>

    <div
      v-if="walletError"
      class="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-100"
    >
      Could not load wallet ({{ walletError.code }}). {{ walletError.message }}
      <button
        type="button"
        class="ml-2 underline underline-offset-2 hover:text-white"
        @click="store.loadWallet()"
      >
        Retry
      </button>
    </div>

    <EconomyBalanceCards :wallet="wallet" :loading="initialLoading" />

    <section class="flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#0c0719]/60 p-4">
      <div class="flex flex-wrap items-center gap-3">
        <button
          type="button"
          class="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2 text-sm font-semibold text-amber-950 shadow-[0_10px_30px_rgba(251,191,36,0.25)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="claimAllInflight || !hasPending"
          @click="onClaimAll"
        >
          {{ claimAllInflight ? 'Claiming…' : `Claim all (${wallet?.pendingCoins ?? 0})` }}
        </button>
        <button
          type="button"
          class="rounded-full border border-violet-300/40 bg-violet-400/10 px-4 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-400/20 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="claimDailyInflight"
          @click="onClaimDaily"
        >
          {{ claimDailyInflight ? 'Working…' : 'Claim daily' }}
        </button>
        <span v-if="lastActionError" class="text-xs text-rose-300">
          {{ lastActionError.code }} · {{ lastActionError.message }}
        </span>
      </div>
      <p class="text-xs text-slate-400">
        Daily creates a pending reward; press “Claim all” to credit it to your wallet.
      </p>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">Pending rewards</h2>
      <EconomyPendingList
        :pending="wallet?.pending ?? []"
        :busy-by-id="claimByIdInflight"
        @claim="onClaimRow"
      />
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">History</h2>
      <EconomyTransactionsTable
        :rows="transactions"
        :loading="transactionsLoading"
        :has-more="transactionsHasMore"
        :kind="transactionsKind"
        @load-more="store.loadTransactions()"
        @kind-change="onKindChange"
      />
    </section>
  </main>
</template>
