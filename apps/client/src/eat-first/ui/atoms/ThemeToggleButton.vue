<script setup>
defineProps({
  label: { type: String, required: true },
  icon: { type: String, required: true },
})
const emit = defineEmits(['click'])
</script>

<template>
  <button
    type="button"
    class="theme-toggle"
    :title="label"
    :aria-label="label"
    @click="emit('click')"
  >
    {{ icon }}
  </button>
</template>
