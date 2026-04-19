/** Бренд каналу — одне джерело правди для посилань і логотипу. */
export const STREAMER_TWITCH_URL = 'https://www.twitch.tv/nad1ch'
export const STREAMER_NICK = 'nad1ch'
/** Текстовий wordmark застосунку — не локалізується. */
export const STREAM_APP_BRAND_NAME = 'StreamAssist'

/** Темний марк (вихідний файл `logo.dark.svg`) — для світлої теми UI (`public/brand/`). */
export const BRAND_LOGO_DARK_SVG = '/brand/logo-dark.svg'
/** Світлий марк (вихідний файл `logo.white.svg`) — для темної теми UI (`public/brand/`). */
export const BRAND_LOGO_LIGHT_SVG = '/brand/logo-light.svg'

/** @deprecated Використовуйте {@link BRAND_LOGO_DARK_SVG} / {@link BRAND_LOGO_LIGHT_SVG} з урахуванням теми. */
export const BRAND_LOGO_PNG = BRAND_LOGO_DARK_SVG
/** @deprecated Див. {@link BRAND_LOGO_LIGHT_SVG}. */
export const BRAND_LOGO_COMPACT_PNG = BRAND_LOGO_LIGHT_SVG
/** WebP за наявності згенерованого файлу; порожньо — у `<picture>` джерело не рендериться. */
export const BRAND_LOGO_WEBP = ''
/** @deprecated Резерв іншої теми — див. ланцюжок помилок у компонентах. */
export const BRAND_LOGO_SVG_FALLBACK = BRAND_LOGO_LIGHT_SVG
/** @deprecated використовуйте {@link BRAND_LOGO_DARK_SVG} / {@link BRAND_LOGO_LIGHT_SVG} */
export const BRAND_LOGO_SRC = BRAND_LOGO_DARK_SVG
