<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, RouterView, useRoute } from 'vue-router'

const route = useRoute()
const { t } = useI18n()

const items = computed(() => [
  { name: 'admin-users' as const, label: t('adminPanel.navUsers'), to: '/app/admin' },
  { name: 'admin-streamers' as const, label: t('adminPanel.navStreamers'), to: '/app/admin/streamers' },
  { name: 'admin-games' as const, label: t('adminPanel.navGames'), to: '/app/admin/games' },
  { name: 'admin-stats' as const, label: t('adminPanel.navStats'), to: '/app/admin/stats' },
  { name: 'admin-debug' as const, label: t('adminPanel.navSession'), to: '/app/admin/debug' },
])

const activeName = computed(() => String(route.name ?? ''))
</script>

<template>
  <div
    class="relative flex min-h-[calc(100dvh-8.5rem)] w-full min-w-0 max-w-none flex-col overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-br from-slate-950 via-[#0c1222] to-slate-900/95 text-slate-100 shadow-2xl shadow-black/50 ring-1 ring-white/[0.06] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:z-[2] before:h-px before:bg-gradient-to-r before:from-transparent before:via-cyan-400/35 before:to-transparent md:flex-row"
  >
    <div
      class="pointer-events-none absolute inset-0 opacity-[0.09]"
      aria-hidden="true"
      style="
        background-image: radial-gradient(circle at 12% 0%, rgb(34 211 238) 0%, transparent 42%),
          radial-gradient(circle at 88% 70%, rgb(99 102 241) 0%, transparent 38%),
          radial-gradient(ellipse 120% 60% at 50% 100%, rgb(15 23 42 / 0.9) 0%, transparent 55%);
      "
    />
    <aside
      class="relative z-[1] flex shrink-0 flex-col border-b border-slate-800/80 bg-slate-900/85 p-4 backdrop-blur-md md:w-60 md:border-b-0 md:border-r md:p-5 lg:w-64"
    >
      <p class="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        {{ t('adminPanel.sidebarBrand') }}
      </p>
      <h1 class="mb-1 text-lg font-semibold tracking-tight text-white">{{ t('adminPanel.sidebarTitle') }}</h1>
      <p class="mb-5 text-xs leading-relaxed text-slate-500">{{ t('adminPanel.sidebarHint') }}</p>
      <nav class="flex flex-row flex-wrap gap-2 md:flex-col md:gap-1" aria-label="Admin sections">
        <RouterLink
          v-for="item in items"
          :key="item.name"
          :to="item.to"
          class="rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-all hover:bg-slate-800/90 hover:text-slate-100"
          :class="{
            'bg-gradient-to-r from-cyan-950/80 to-indigo-950/50 text-cyan-50 ring-1 ring-cyan-500/35 shadow-md shadow-cyan-950/20': activeName === item.name,
          }"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
    </aside>
    <section
      class="relative z-[1] min-h-0 min-w-0 flex-1 overflow-auto border-t border-transparent bg-slate-950/75 p-4 backdrop-blur-sm md:border-t-0 md:border-l md:border-slate-800/40 md:p-6 lg:p-8"
    >
      <RouterView v-slot="{ Component }">
        <Transition name="route-soft">
          <component :is="Component" v-if="Component" :key="route.path" />
        </Transition>
      </RouterView>
    </section>
  </div>
</template>
