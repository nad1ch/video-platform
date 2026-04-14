import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    /** Stream shell header title (eat routes use i18n brand instead). */
    appTitle?: string
    /** Який текст показувати у футері (`app.footerLine*` у i18n). */
    footerContext?: 'home' | 'wordle' | 'call' | 'eat'
  }
}
