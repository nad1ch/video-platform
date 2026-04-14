import { callableApiEnabled } from './services/callableApi.js'
import { ensureAnonymousAuth } from './services/authBootstrap.js'

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
    console.warn(
      '[eat-first] Anonymous sign-in failed (needed for Cloud Functions).',
      code || e,
    )
  }
}
