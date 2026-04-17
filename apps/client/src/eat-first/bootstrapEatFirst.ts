import { callableApiEnabled } from './api/callableApi.js'
import { ensureAnonymousAuth } from './services/authBootstrap.js'
import { createLogger } from '@/utils/logger'

const eatFirstBootstrapLog = createLogger('eat-first:bootstrap')

let authOnce = false

/** Anonymous Firebase sign-in when Cloud Functions are enabled (eat-first only). */
export async function bootstrapEatFirstAuthOnce(): Promise<void> {
  if (authOnce) return
  if (!callableApiEnabled()) return
  authOnce = true
  try {
    await ensureAnonymousAuth()
  } catch (e) {
    authOnce = false
    const code = e && typeof e === 'object' && 'code' in e ? String((e as { code?: string }).code) : ''
    eatFirstBootstrapLog.warn('Anonymous sign-in failed (needed for Cloud Functions).', code || e)
  }
}
