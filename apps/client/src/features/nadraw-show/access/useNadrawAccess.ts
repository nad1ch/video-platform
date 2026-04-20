import { computed, type ComputedRef, type Ref } from 'vue'

export function useNadrawAccess(options: {
  sessionCanControl: Ref<boolean>
  authLoaded: ComputedRef<boolean>
  isAuthenticated: ComputedRef<boolean>
}): {
  showHostChrome: ComputedRef<boolean>
} {
  const { sessionCanControl, authLoaded, isAuthenticated } = options

  const showHostChrome = computed(
    () => authLoaded.value && isAuthenticated.value && sessionCanControl.value,
  )

  return { showHostChrome }
}
