import {
  createRouter,
  createWebHistory,
  type RouteLocationGeneric,
  type RouterScrollBehavior,
} from 'vue-router'
import { registerEatFirstRouterGuards } from '@/eat-first/router.js'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: () => import('./layouts/AppShellLayout.vue'),
      children: [
        {
          path: '',
          name: 'home',
          meta: { appTitle: 'StreamAssist', footerContext: 'home' },
          component: () => import('./pages/HomePage.vue'),
        },
        {
          path: 'call',
          name: 'call',
          meta: { appTitle: 'Video call', footerContext: 'call' },
          component: () => import('./components/call/CallPage.vue'),
        },
        {
          path: 'wordle',
          name: 'wordle',
          meta: { appTitle: 'Stream Wordle', footerContext: 'wordle' },
          component: () => import('./pages/WordleStreamPage.vue'),
        },
        {
          path: 'eat',
          name: 'eat',
          meta: { footerContext: 'eat' },
          component: () => import('./pages/EatFirstPage.vue'),
        },
      ],
    },
    {
      path: '/eat/join',
      redirect: (to: RouteLocationGeneric) => ({
        path: '/eat',
        query: { ...to.query, view: 'join' },
      }),
    },
    {
      path: '/eat/admin',
      redirect: (to: RouteLocationGeneric) => ({
        path: '/eat',
        query: { ...to.query, view: 'admin' },
      }),
    },
    {
      path: '/eat/control',
      redirect: (to: RouteLocationGeneric) => ({
        path: '/eat',
        query: { ...to.query, view: 'control' },
      }),
    },
    {
      path: '/eat/overlay',
      redirect: (to: RouteLocationGeneric) => ({
        path: '/eat',
        query: { ...to.query, view: 'overlay' },
      }),
    },
  ],
  scrollBehavior: ((to, from, savedPosition) => {
    if (!to.path.startsWith('/eat')) {
      if (savedPosition) return savedPosition
      return { top: 0 }
    }
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash, behavior: 'smooth' }
    if (from.path && to.path === from.path) return false
    return { top: 0, left: 0 }
  }) satisfies RouterScrollBehavior,
})

registerEatFirstRouterGuards(router)
