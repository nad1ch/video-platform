/**
 * Ключ адміна з URL (?key=...) має збігатися з цим значенням.
 * У продакшені задай VITE_ADMIN_KEY у .env (не коміть .env).
 */
export const ADMIN_KEY = String(import.meta.env.VITE_ADMIN_KEY ?? '123456').trim()

/** Режим пульта ведучого в URL без секрету: ?host=1 (замість role=admin&key=…). */
export const HOST_PANEL_QUERY_KEY = 'host'
export const HOST_PANEL_QUERY_VALUE = '1'
