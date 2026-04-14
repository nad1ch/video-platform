/**
 * Логи ланцюжка видалення гравця. Лише якщо в .env задати VITE_DEBUG_DELETE=true (не шумить у dev).
 */
export function debugDelete(...args) {
  const on = String(import.meta.env.VITE_DEBUG_DELETE ?? '') === 'true'
  if (on) console.info('[eat-first:delete]', ...args)
}
