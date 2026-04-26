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
    class="relative mx-auto flex h-full min-h-0 w-full max-w-[1400px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-[#12081d]/88 via-[#0b0614]/94 to-[#07040f]/98 text-slate-100 shadow-[0_24px_80px_rgba(5,1,14,0.45)] ring-1 ring-violet-300/10 before:pointer-events-none before:absolute before:inset-x-8 before:top-0 before:z-[2] before:h-px before:bg-gradient-to-r before:from-transparent before:via-violet-200/35 before:to-transparent md:flex-row"
  >
    <div
      class="pointer-events-none absolute inset-0 opacity-[0.1]"
      aria-hidden="true"
      style="
        background-image: radial-gradient(circle at 12% 0%, rgb(124 77 219) 0%, transparent 42%),
          radial-gradient(circle at 88% 70%, rgb(34 211 238) 0%, transparent 36%),
          radial-gradient(ellipse 120% 60% at 50% 100%, rgb(15 23 42 / 0.9) 0%, transparent 55%);
      "
    />
    <aside
      class="relative z-[1] flex shrink-0 flex-col border-b border-white/10 bg-gradient-to-b from-[#181026] via-[#10091c] to-[#0b0614] p-5 shadow-[inset_-1px_0_0_rgba(255,255,255,0.06)] md:h-full md:w-64 md:border-b-0 md:border-r md:p-6"
    >
      <p class="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        {{ t('adminPanel.sidebarBrand') }}
      </p>
      <h1 class="mb-1 text-lg font-semibold tracking-tight text-white">{{ t('adminPanel.sidebarTitle') }}</h1>
      <p class="mb-6 text-xs leading-relaxed text-slate-400/80">{{ t('adminPanel.sidebarHint') }}</p>
      <nav class="flex flex-row flex-wrap gap-2 md:flex-col" :aria-label="t('adminPanel.sectionsAria')">
        <RouterLink
          v-for="item in items"
          :key="item.name"
          :to="item.to"
          class="rounded-2xl px-3.5 py-2.5 text-sm font-medium text-slate-400 transition-all hover:bg-violet-400/10 hover:text-slate-100 hover:ring-1 hover:ring-violet-300/15"
          :class="{
            'bg-gradient-to-r from-violet-700/28 to-indigo-500/12 text-violet-50 ring-1 ring-violet-300/25 shadow-[0_0_28px_rgba(124,77,219,0.18)]': activeName === item.name,
          }"
        >
          {{ item.label }}
        </RouterLink>
      </nav>
    </aside>
    <section
      class="relative z-[1] min-h-0 min-w-0 flex-1 overflow-auto p-4 md:p-6 lg:p-8"
    >
      <div class="mx-auto min-h-full w-full max-w-[1180px] rounded-[24px] border border-white/10 bg-slate-950/35 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-[2px] md:p-6 lg:p-8">
        <RouterView v-slot="{ Component }">
          <Transition name="route-soft">
            <component :is="Component" v-if="Component" :key="route.path" />
          </Transition>
        </RouterView>
      </div>
    </section>
  </div>
</template>
