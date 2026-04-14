import 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    /** Stream shell header title (eat routes use i18n brand instead). */
    appTitle?: string
  }
}
