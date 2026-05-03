import { useRouter } from 'vue-router'
import { safeOAuthRedirectPath } from '@/utils/safeOAuthRedirectPath'
import type { AuthMode } from '@/types/authMode'





export function useStreamAuthModal() {
  const router = useRouter()

  function openStreamAuthModal(redirectPath = '/app', mode: AuthMode = 'login'): void {
    void router.push({
      path: '/auth',
      query: {
        redirect: safeOAuthRedirectPath(redirectPath),
        mode,
      },
    })
  }

  
  function closeStreamAuthModal(): void {}

  return {
    openStreamAuthModal,
    closeStreamAuthModal,
  }
}
