import { createPinia } from 'pinia'
import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { initAudioPlaybackUnlock } from 'call-core'

initAudioPlaybackUnlock()

createApp(App).use(createPinia()).mount('#app')
