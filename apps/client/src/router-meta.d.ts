import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    /** Stream shell header title — vue-i18n key (e.g. `routes.call`). */
    appTitleKey?: string
    /** @deprecated Prefer `appTitleKey` for localized titles. */
    appTitle?: string
    /** Який текст показувати у футері (`app.footerLine*` у i18n). */
    footerContext?: 'home' | 'wordle' | 'call' | 'eat'
  }
}
