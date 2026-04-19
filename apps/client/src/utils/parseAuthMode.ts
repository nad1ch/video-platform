import type { AuthMode } from '@/types/authMode'

export function parseAuthMode(raw: unknown): AuthMode {
  const s = typeof raw === 'string' ? raw : 'login'
  if (s === 'signup' || s === 'forgot' || s === 'forgot-success' || s === 'login') {
    return s
  }
  return 'login'
}
