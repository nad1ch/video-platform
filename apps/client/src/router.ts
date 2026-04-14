import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('./pages/HomePage.vue'),
    },
    {
      path: '/call',
      name: 'call',
      component: () => import('./components/call/CallPage.vue'),
    },
    {
      path: '/wordle',
      name: 'wordle',
      component: () => import('./pages/WordleStreamPage.vue'),
    },
    {
      path: '/eat',
      name: 'eat',
      component: () => import('./pages/EatFirstPage.vue'),
    },
  ],
})
