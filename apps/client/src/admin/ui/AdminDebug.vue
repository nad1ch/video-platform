<script setup lang="ts">
import { computed, onMounted, ref, toRaw } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuth } from '@/composables/useAuth'

const { t } = useI18n()
const { user, loaded, refresh, ensureAuthLoaded } = useAuth()

const refreshing = ref(false)

const roleLine = computed(() => user.value?.role ?? t('adminPanel.sessionNotSignedIn'))

const rawAuthJson = computed(() => {
  const u = user.value
  if (!u) return 'null'
  try {
    return JSON.stringify(toRaw(u), null, 2)
  } catch {
    return String(u)
  }
})

async function doRefresh() {
  refreshing.value = true
  try {
    await refresh()
  } finally {
    refreshing.value = false
  }
}

onMounted(() => {
  void (async () => {
    await ensureAuthLoaded()
    await refresh()
  })()
})
</script>

<template>
  <div class="w-full min-w-0 space-y-5">
    <header class="flex flex-col gap-3 border-b border-slate-800/80 pb-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 class="text-xl font-semibold tracking-tight text-white">{{ t('adminPanel.sessionTitle') }}</h2>
        <p class="mt-1.5 max-w-xl text-sm leading-relaxed text-slate-400">{{ t('adminPanel.sessionLead') }}</p>
      </div>
      <button
        type="button"
        class="shrink-0 rounded-lg bg-cyan-950/80 px-3 py-2 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-700/50 hover:bg-cyan-900/80 disabled:opacity-50"
        :disabled="refreshing"
        @click="doRefresh"
      >
        {{ refreshing ? t('adminPanel.sessionRefreshing') : t('adminPanel.sessionRefresh') }}
      </button>
    </header>

    <div class="grid gap-3 sm:grid-cols-2">
      <div class="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 ring-1 ring-white/[0.03]">
        <p class="text-[11px] font-medium uppercase tracking-wide text-slate-500">{{ t('adminPanel.sessionAuthLoaded') }}</p>
        <p class="mt-1 font-mono text-sm text-slate-200">{{ loaded }}</p>
      </div>

      <div class="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 ring-1 ring-white/[0.03]">
        <p class="text-[11px] font-medium uppercase tracking-wide text-slate-500">{{ t('adminPanel.sessionCurrentUser') }}</p>
        <p class="mt-1 break-all font-mono text-sm text-slate-200">
          {{ user ? `${user.displayName} (${user.id})` : 'null' }}
        </p>
      </div>

      <div class="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 sm:col-span-2 ring-1 ring-white/[0.03]">
        <p class="text-[11px] font-medium uppercase tracking-wide text-slate-500">{{ t('adminPanel.sessionRole') }}</p>
        <p class="mt-1 font-mono text-sm text-amber-200/95">{{ roleLine }}</p>
      </div>

      <div class="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 sm:col-span-2 ring-1 ring-white/[0.03]">
        <p class="text-[11px] font-medium uppercase tracking-wide text-slate-500">{{ t('adminPanel.sessionRawJson') }}</p>
        <pre
          class="mt-2 max-h-80 overflow-auto rounded-lg bg-slate-950/90 p-3 text-xs leading-relaxed text-slate-300 ring-1 ring-slate-800"
          >{{ rawAuthJson }}</pre
        >
      </div>
    </div>
  </div>
</template>
