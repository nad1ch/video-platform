/** Бренд каналу — одне джерело правди для посилань і логотипу. */
export const STREAMER_TWITCH_URL = 'https://www.twitch.tv/nad1ch'
export const STREAMER_NICK = 'nad1ch'
/** Основний логотип — PNG з прозорістю (`public/brand/`). */
export const BRAND_LOGO_PNG = '/brand/nad1ch-stream-mark-transparent.png'
/** Другий крок у ланцюжку помилок завантаження (старий марк з суцільним тлом). */
export const BRAND_LOGO_COMPACT_PNG = '/brand/nad1ch-stream-mark-compact.png'
/** WebP за наявності згенерованого файлу; порожньо — у `<picture>` джерело не рендериться. */
export const BRAND_LOGO_WEBP = ''
/** Останній резерв — простий SVG-марк. */
export const BRAND_LOGO_SVG_FALLBACK = '/brand-nad1ch-transparent.svg'
/** @deprecated використовуйте BRAND_LOGO_PNG / picture + WEBP */
export const BRAND_LOGO_SRC = BRAND_LOGO_PNG
