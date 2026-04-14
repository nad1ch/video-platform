import { ref } from 'vue'

const modalOpen = ref(false)
/** Path after OAuth (must start with `/`). */
const redirectAfterAuth = ref('/')

export function useStreamAuthModal() {
  function openStreamAuthModal(redirectPath = '/'): void {
    const p =
      typeof redirectPath === 'string' && redirectPath.startsWith('/') && !redirectPath.startsWith('//')
        ? redirectPath
        : '/'
    redirectAfterAuth.value = p
    modalOpen.value = true
  }

  function closeStreamAuthModal(): void {
    modalOpen.value = false
  }

  return {
    modalOpen,
    redirectAfterAuth,
    openStreamAuthModal,
    closeStreamAuthModal,
  }
}
