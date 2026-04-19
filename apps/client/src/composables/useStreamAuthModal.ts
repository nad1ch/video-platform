import { useRouter } from 'vue-router'
import { safeOAuthRedirectPath } from '@/utils/safeOAuthRedirectPath'
import type { AuthMode } from '@/types/authMode'

/**
 * Opens the full-page auth flow (`/auth`) instead of a modal.
 * Keeps the same function name so callers stay unchanged.
 */
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

  /** @deprecated Page-based auth has no modal to close. */
  function closeStreamAuthModal(): void {}

  return {
    openStreamAuthModal,
    closeStreamAuthModal,
  }
}
