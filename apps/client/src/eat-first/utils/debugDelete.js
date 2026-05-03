import { createLogger } from '@/utils/logger'

const deleteDebugLog = createLogger('eat-first:delete')




export function debugDelete(...args) {
  const on = String(import.meta.env.VITE_DEBUG_DELETE ?? '') === 'true'
  if (on) deleteDebugLog.info(...args)
}
