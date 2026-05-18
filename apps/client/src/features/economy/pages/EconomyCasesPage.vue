<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useCasesStore } from '../state/casesStore'
import { useEconomyStore } from '../state/economyStore'
import CaseCatalogCard from '../components/CaseCatalogCard.vue'
import CaseOpenResultModal from '../components/CaseOpenResultModal.vue'

const cases = useCasesStore()
const economy = useEconomyStore()
const { catalog, catalogLoading, catalogError, openingSlug, openError, lastOpenResult } =
  storeToRefs(cases)

onMounted(() => {
  void cases.loadCatalog()
})

async function onOpen(slug: string): Promise<void> {
  const ok = await cases.openCase(slug)
  if (ok) {
    // Refresh wallet snapshot so the wallet page reflects new balance/XP.
    void economy.loadWallet({ silent: true })
  }
}

const hasCatalog = computed(() => catalog.value.length > 0)
const showSkeleton = computed(() => catalogLoading.value && catalog.value.length === 0)
</script>

<template>
  <main class="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-4 py-6 text-slate-100">
    <header class="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
      <div>
        <p class="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-300/70">
          Viewer Economy
        </p>
        <h1 class="text-2xl font-semibold tracking-tight text-white">Cases</h1>
      </div>
      <p class="text-xs text-slate-400">
        Server picks the reward. Every case has a guaranteed minimum.
      </p>
    </header>

    <div
      v-if="catalogError"
      class="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-100"
    >
      Could not load case catalog ({{ catalogError.code }}). {{ catalogError.message }}
      <button
        type="button"
        class="ml-2 underline underline-offset-2 hover:text-white"
        @click="cases.loadCatalog()"
      >
        Retry
      </button>
    </div>

    <div
      v-if="openError"
      class="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-100"
    >
      Could not open case ({{ openError.code }}). {{ openError.message }}
    </div>

    <div v-if="showSkeleton" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="i in 3"
        :key="i"
        class="h-44 animate-pulse rounded-2xl border border-white/5 bg-white/[0.03]"
      />
    </div>

    <p
      v-else-if="!hasCatalog && !catalogError"
      class="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-slate-400"
    >
      No cases available right now. Cases drop from streamer events.
    </p>

    <div v-else class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <CaseCatalogCard
        v-for="c in catalog"
        :key="c.slug"
        :entry="c"
        :busy="openingSlug === c.slug"
        @open="onOpen"
      />
    </div>

    <CaseOpenResultModal :result="lastOpenResult" @close="cases.clearLastResult()" />
  </main>
</template>
