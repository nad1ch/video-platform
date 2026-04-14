import { createRouter, createWebHistory } from 'vue-router'
import CallPage from './components/call/CallPage.vue'
import WordleStreamPage from './pages/WordleStreamPage.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'call', component: CallPage },
    { path: '/wordle', name: 'wordle', component: WordleStreamPage },
  ],
})
