import { createPinia } from 'pinia'
import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { initAudioPlaybackUnlock } from './features/room/audioPlaybackUnlock'

initAudioPlaybackUnlock()

createApp(App).use(createPinia()).mount('#app')
