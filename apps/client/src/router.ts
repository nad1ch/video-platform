import {
  createRouter,
  createWebHistory,
  type RouteLocationGeneric,
  type RouterScrollBehavior,
} from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { registerEatFirstRouterGuards } from '@/eat-first/router.js'
import { STREAMER_NICK } from '@/eat-first/constants/brand.js'

/** Twitch login slug for `/wordle` → `/wordle/:streamer` redirect and default home link. */
const DEFAULT_WORDLE_STREAMER =
  (typeof import.meta.env.VITE_DEFAULT_STREAMER === 'string' && import.meta.env.VITE_DEFAULT_STREAMER.trim()) ||
  STREAMER_NICK

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'landing',
      component: () => import('./pages/LandingPage.vue'),
    },
    {
      path: '/app',
      component: () => import('./layouts/AppShellLayout.vue'),
      children: [
        {
          path: '',
          name: 'home',
          meta: { appTitleKey: 'routes.streamAssist', footerContext: 'home' },
          component: () => import('./pages/HomePage.vue'),
        },
        {
          path: 'call',
          name: 'call',
          meta: { appTitleKey: 'routes.call', footerContext: 'call', requiresAuth: true },
          component: () => import('./components/call/CallPage.vue'),
        },
        {
          path: 'wordle',
          name: 'wordle',
          redirect: { name: 'wordle-streamer', params: { streamer: DEFAULT_WORDLE_STREAMER } },
        },
        {
          path: 'wordle/:streamer',
          name: 'wordle-streamer',
          meta: { appTitleKey: 'routes.wordle', footerContext: 'wordle' },
          component: () => import('./pages/WordleStreamPage.vue'),
        },
        {
          path: 'eat',
          name: 'eat',
          meta: { footerContext: 'eat' },
          component: () => import('./pages/EatFirstPage.vue'),
        },
        {
          path: 'admin',
          meta: {
            requiresAdmin: true,
            appTitleKey: 'routes.admin',
            footerContext: 'home',
          },
          component: () => import('./admin/ui/AdminPage.vue'),
          children: [
            {
              path: '',
              name: 'admin-users',
              component: () => import('./admin/ui/AdminUsers.vue'),
            },
            {
              path: 'streamers',
              name: 'admin-streamers',
              component: () => import('./admin/ui/AdminStreamers.vue'),
            },
            {
              path: 'games',
              name: 'admin-games',
              component: () => import('./admin/ui/AdminGames.vue'),
            },
            {
              path: 'stats',
              name: 'admin-stats',
              component: () => import('./admin/ui/AdminStats.vue'),
            },
            {
              path: 'debug',
              name: 'admin-debug',
              component: () => import('./admin/ui/AdminDebug.vue'),
            },
          ],
        },
        /**
         * Short Wordle URL: `/app/:streamer` (legacy). Static segments above take precedence:
         * `call`, `wordle`, `wordle/:streamer`, `eat`, `admin` are reserved — a streamer slug matching
         * those first segments cannot use this short path (e.g. `/app/call` is the Call page, not Wordle for "call").
         */
        {
          path: ':streamer',
          name: 'app-streamer',
          meta: { appTitleKey: 'routes.wordle', footerContext: 'wordle' },
          component: () => import('./pages/WordleStreamPage.vue'),
        },
      ],
    },
    { path: '/call', redirect: '/app/call' },
    {
      path: '/wordle',
      redirect: () => ({ name: 'wordle-streamer', params: { streamer: DEFAULT_WORDLE_STREAMER } }),
    },
    {
      path: '/wordle/:streamer',
      redirect: (to) => ({
        path: `/app/wordle/${String(to.params.streamer)}`,
        query: to.query,
        hash: to.hash,
      }),
    },
    {
      path: '/eat',
      redirect: (to) => ({ path: '/app/eat', query: to.query, hash: to.hash }),
    },
    {
      path: '/eat/join',
      redirect: (to: RouteLocationGeneric) => ({
        path: '/app/eat',
        query: { ...to.query, view: 'join' },
      }),
    },
    {
      path: '/eat/admin',
      redirect: (to: RouteLocationGeneric) => ({
        path: '/app/eat',
        query: { ...to.query, view: 'admin' },
      }),
    },
    {
      path: '/eat/control',
      redirect: (to: RouteLocationGeneric) => ({
        path: '/app/eat',
        query: { ...to.query, view: 'control' },
      }),
    },
    {
      path: '/eat/overlay',
      redirect: (to: RouteLocationGeneric) => ({
        path: '/app/eat',
        query: { ...to.query, view: 'overlay' },
      }),
    },
    {
      path: '/admin/:pathMatch(.*)*',
      redirect: (to) => {
        const rest = to.path.replace(/^\/admin\/?/, '') || ''
        return {
          path: `/app/admin${rest ? `/${rest}` : ''}`,
          query: to.query,
          hash: to.hash,
        }
      },
    },
  ],
  scrollBehavior: ((to, from, savedPosition) => {
    if (!to.path.startsWith('/app/eat')) {
      if (savedPosition) return savedPosition
      // Landing uses fixed-canvas sections with ~0 in-flow height; LandingPage applies hash scroll.
      if (to.path === '/' && to.hash) return false
      return { top: 0 }
    }
    if (savedPosition) return savedPosition
    if (to.hash) return { el: to.hash, behavior: 'smooth' }
    if (from.path && to.path === from.path) return false
    return { top: 0, left: 0 }
  }) satisfies RouterScrollBehavior,
})

registerEatFirstRouterGuards(router)

function eatViewNeedsStreamAuth(query: Record<string, unknown>): boolean {
  const v = query.view
  const s = Array.isArray(v) ? v[0] : v
  return s === 'admin' || s === 'control'
}

router.beforeEach(async (to) => {
  if (to.meta.requiresAdmin) {
    const { ensureAuthLoaded, user } = useAuth()
    await ensureAuthLoaded()
    if (user.value?.role !== 'admin') {
      return { path: '/app' }
    }
  }

  const needMeta = Boolean(to.meta.requiresAuth)
  const needEatStaff = to.name === 'eat' && eatViewNeedsStreamAuth(to.query as Record<string, unknown>)
  if (!needMeta && !needEatStaff) {
    return true
  }

  const { ensureAuthLoaded, isAuthenticated } = useAuth()
  await ensureAuthLoaded()
  if (isAuthenticated.value) {
    return true
  }

  return {
    path: '/app',
    query: {
      needLogin: '1',
      authRedirect: to.fullPath,
    },
  }
})
