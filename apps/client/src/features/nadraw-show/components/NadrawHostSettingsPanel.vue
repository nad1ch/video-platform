<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const emit = defineEmits<{
  clearCanvas: []
}>()

const { t } = useI18n()
</script>

<template>
  <div class="w-full border-t border-white/10 bg-slate-950/35 px-2 pb-2 pt-2">
    <button
      type="button"
      class="sa-chip-btn flex w-full !min-h-[2.65rem] !justify-center !py-3 !text-[0.78rem] !font-extrabold !tracking-wide text-[color:var(--text-heading,#f1f5f9)]"
      @click="emit('clearCanvas')"
    >
      {{ t('nadrawShow.clearCanvas') }}
    </button>
  </div>
</template>
