import { createPinia } from 'pinia'
import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { initAudioPlaybackUnlock } from 'call-core'

initAudioPlaybackUnlock()

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.mount('#app')
