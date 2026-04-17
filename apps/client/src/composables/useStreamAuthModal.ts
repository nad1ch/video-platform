import { ref } from 'vue'
import { safeOAuthRedirectPath } from '@/utils/safeOAuthRedirectPath'

const modalOpen = ref(false)
/** Path after OAuth (must start with `/`). */
const redirectAfterAuth = ref('/')

export function useStreamAuthModal() {
  function openStreamAuthModal(redirectPath = '/'): void {
    redirectAfterAuth.value = safeOAuthRedirectPath(redirectPath)
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
