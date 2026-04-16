import { createPinia } from 'pinia'
import { createApp } from 'vue'
import 'ui-theme'
import '@/eat-first/style.css'
import '@/eat-first/styles/theme.css'
import './style.css'
import './tailwind.css'
import App from './App.vue'
import { router } from './router'
import { initAudioPlaybackUnlock } from 'call-core'
import { i18n } from '@/eat-first/i18n'
import { initAnalytics } from '@/eat-first/analytics/bootstrap.js'
import { ensureMetaDescription } from '@/eat-first/constants/seo.js'

initAudioPlaybackUnlock()
ensureMetaDescription()
initAnalytics()

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(i18n)
app.use(router)
app.mount('#app')
