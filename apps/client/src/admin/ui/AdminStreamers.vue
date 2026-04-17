<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdminStreamersState } from '@/admin'
import { appConfirm } from '@/utils/appConfirm'

const { t, locale } = useI18n()

const {
  streamers,
  loading,
  saving,
  errorKey,
  databaseConfigured,
  slug,
  ownerId,
  ownersWithTwitch,
  refresh,
  createStreamer,
  removeStreamer: removeStreamerRequest,
} = useAdminStreamersState()

async function removeStreamer(id: string) {
  if (!appConfirm(t('adminPanel.streamersDeleteConfirm'))) {
    return
  }
  await removeStreamerRequest(id)
}

onMounted(() => {
  void refresh()
})

function formatUpdated() {
  try {
    return new Intl.DateTimeFormat(locale.value || undefined, { dateStyle: 'short', timeStyle: 'short' }).format(
      new Date(),
    )
  } catch {
    return new Date().toLocaleString()
  }
}
</script>

<template>
  <div class="admin-streamers max-w-3xl text-slate-100">
    <header class="mb-6">
      <h2 class="text-xl font-semibold tracking-tight text-white">{{ t('adminPanel.streamersTitle') }}</h2>
      <p class="mt-1 text-sm leading-relaxed text-slate-400">{{ t('adminPanel.streamersLead') }}</p>
    </header>

    <p v-if="loading" class="text-sm text-slate-400">{{ t('adminPanel.streamersLoading') }}</p>
    <p v-else-if="errorKey === 'forbidden'" class="text-sm text-amber-300">{{ t('adminPanel.usersForbidden') }}</p>
    <p v-else-if="errorKey === 'load'" class="text-sm text-rose-300">{{ t('adminPanel.streamersError') }}</p>
    <template v-else-if="!databaseConfigured">
      <p class="text-sm text-amber-200">{{ t('adminPanel.usersNoDb') }}</p>
      <p class="mt-1 text-xs text-slate-500">{{ t('adminPanel.usersNoDbHint') }}</p>
    </template>
    <template v-else>
      <p v-if="errorKey === 'save'" class="mb-4 text-sm text-rose-300">{{ t('adminPanel.streamersSaveError') }}</p>

      <form
        class="mb-8 flex flex-col gap-4 rounded-xl border border-slate-800/80 bg-slate-900/50 p-4 md:flex-row md:items-end"
        @submit.prevent="createStreamer"
      >
        <label class="flex min-w-0 flex-1 flex-col gap-1 text-sm">
          <span class="font-medium text-slate-300">{{ t('adminPanel.streamersSlugLabel') }}</span>
          <input
            v-model="slug"
            type="text"
            autocomplete="off"
            class="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-cyan-500/40 focus:ring-2"
            :placeholder="t('adminPanel.streamersSlugPlaceholder')"
          />
        </label>
        <label class="flex min-w-0 flex-1 flex-col gap-1 text-sm">
          <span class="font-medium text-slate-300">{{ t('adminPanel.streamersOwnerLabel') }}</span>
          <select
            v-model="ownerId"
            class="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-cyan-500/40 focus:ring-2"
          >
            <option disabled value="">{{ t('adminPanel.streamersOwnerPlaceholder') }}</option>
            <option v-for="o in ownersWithTwitch" :key="o.id" :value="o.id">
              {{ o.displayName }} — {{ t('adminPanel.streamersTwitchLinked') }}
            </option>
          </select>
        </label>
        <button
          type="submit"
          class="shrink-0 rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="saving || !slug.trim() || !ownerId"
        >
          {{ t('adminPanel.streamersCreate') }}
        </button>
      </form>

      <p v-if="ownersWithTwitch.length === 0" class="mb-4 text-xs text-slate-500">
        {{ t('adminPanel.streamersNoTwitchOwners') }}
      </p>

      <div class="mb-2 flex items-center justify-between gap-2">
        <h3 class="text-sm font-semibold text-slate-300">{{ t('adminPanel.streamersListTitle') }}</h3>
        <button
          type="button"
          class="text-xs font-medium text-cyan-400 hover:underline"
          :disabled="loading || saving"
          @click="refresh"
        >
          {{ t('adminPanel.streamersRefresh') }}
        </button>
      </div>

      <ul v-if="streamers.length === 0" class="rounded-lg border border-dashed border-slate-700/80 p-6 text-sm text-slate-500">
        {{ t('adminPanel.streamersEmpty') }}
      </ul>
      <ul v-else class="divide-y divide-slate-800/90 rounded-lg border border-slate-800/80 bg-slate-900/40">
        <li
          v-for="s in streamers"
          :key="s.id"
          class="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="min-w-0">
            <p class="font-mono font-semibold text-cyan-200">{{ s.name }}</p>
            <p class="truncate text-xs text-slate-500">
              id {{ s.id.slice(0, 12) }}… · Twitch {{ s.twitchId }}
              <span v-if="s.owner"> · {{ t('adminPanel.streamersOwnerShort') }} {{ s.owner.displayName }}</span>
            </p>
          </div>
          <button
            type="button"
            class="shrink-0 text-xs font-medium text-rose-400 hover:underline"
            :disabled="saving"
            @click="removeStreamer(s.id)"
          >
            {{ t('adminPanel.streamersDelete') }}
          </button>
        </li>
      </ul>

      <p class="mt-4 text-[11px] text-slate-600">{{ t('adminPanel.streamersHint') }} · {{ formatUpdated() }}</p>
    </template>
  </div>
</template>
