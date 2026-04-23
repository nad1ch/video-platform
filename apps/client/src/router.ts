import { defineComponent } from 'vue'
import {
  createRouter,
  createWebHistory,
  type RouteLocationGeneric,
  type RouteRecordRaw,
  type RouterScrollBehavior,
} from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { registerEatFirstRouterGuards } from '@/eat-first/router.js'
import { installRouteNavLoadingGuards, releaseRouteNavLoading } from '@/routeNavLoading'
import { STREAMER_NICK } from '@/eat-first/constants/brand.js'

/** Twitch login slug for `/nadle` → `/nadle/:streamer` redirect and default home link. */
const DEFAULT_NADLE_STREAMER =
  (typeof import.meta.env.VITE_DEFAULT_STREAMER === 'string' && import.meta.env.VITE_DEFAULT_STREAMER.trim()) ||
  STREAMER_NICK

/** Served as real HTML from `public/{slug}/index.html`. If the host returns SPA `index.html` instead, full-reload to that file. */
const SEO_MARKETING_SLUGS = ['video-calls-for-streamers', 'twitch-nadle-game', 'stream-overlay-tools'] as const

const seoMarketingPlaceholder = defineComponent({
  name: 'SeoMarketingPlaceholder',
  setup() {
    return () => null
  },
})

function seoMarketingStaticRoutes(): RouteRecordRaw[] {
  return SEO_MARKETING_SLUGS.flatMap((slug) => {
    const target = `/${slug}/index.html`
    const beforeEnter = (): false => {
      releaseRouteNavLoading()
      window.location.replace(target)
      return false
    }
    return [
      {
        path: `/${slug}`,
        name: `seo-marketing-${slug}`,
        beforeEnter,
        component: seoMarketingPlaceholder,
      },
      {
        path: `/${slug}/`,
        beforeEnter,
        component: seoMarketingPlaceholder,
      },
    ]
  })
}

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'landing',
      component: () => import('./pages/LandingPage.vue'),
    },
    {
      path: '/auth',
      name: 'auth',
      component: () => import('./pages/AuthPage.vue'),
    },
    ...seoMarketingStaticRoutes(),
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
          path: 'mafia',
          name: 'mafia',
          meta: { appTitleKey: 'routes.mafia', footerContext: 'call', requiresAuth: true },
          component: () => import('./pages/MafiaPage.vue'),
        },
        {
          path: 'nadle',
          name: 'nadle',
          redirect: { name: 'nadle-streamer', params: { streamer: DEFAULT_NADLE_STREAMER } },
        },
        {
          path: 'nadle/:streamer',
          name: 'nadle-streamer',
          meta: { appTitleKey: 'routes.nadle', footerContext: 'nadle' },
          component: () => import('./pages/NadleStreamPage.vue'),
        },
        {
          path: 'nadraw-show/:streamer',
          name: 'nadraw-show',
          meta: { appTitleKey: 'routes.nadrawShow', footerContext: 'home' },
          component: () => import('./pages/NadrawShowPage.vue'),
        },
        {
          path: 'eat',
          name: 'eat',
          meta: { footerContext: 'eat' },
          component: () => import('./pages/EatFirstPage.vue'),
        },
        {
          path: 'coin-hub',
          name: 'coin-hub',
          meta: { appTitleKey: 'routes.coinHub', footerContext: 'home' },
          component: () => import('./pages/CoinHubPage.vue'),
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
         * Short URL: `/app/:streamer` (legacy). Static segments above take precedence:
         * `call`, `mafia`, `nadle`, `nadle/:streamer`, `nadraw-show/:streamer`, `eat`, `coin-hub`, `admin` are reserved — a streamer slug matching
         * those first segments cannot use this short path (e.g. `/app/call` is the Call page, not nadle for "call").
         */
        {
          path: ':streamer',
          name: 'app-streamer',
          meta: { appTitleKey: 'routes.nadle', footerContext: 'nadle' },
          component: () => import('./pages/NadleStreamPage.vue'),
        },
      ],
    },
    { path: '/call', redirect: '/app/call' },
    {
      path: '/nadle',
      redirect: () => ({ name: 'nadle-streamer', params: { streamer: DEFAULT_NADLE_STREAMER } }),
    },
    {
      path: '/nadle/:streamer',
      redirect: (to) => ({
        path: `/app/nadle/${String(to.params.streamer)}`,
        query: to.query,
        hash: to.hash,
      }),
    },
    {
      path: '/nadraw-show/:streamer',
      redirect: (to) => ({
        path: `/app/nadraw-show/${String(to.params.streamer)}`,
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

installRouteNavLoadingGuards(router)
registerEatFirstRouterGuards(router)

function eatViewNeedsStreamAuth(query: Record<string, unknown>): boolean {
  const v = query.view
  const s = Array.isArray(v) ? v[0] : v
  return s === 'admin' || s === 'control'
}

/**
 * When a guard returns a new location, vue-router may not run `afterEach` for the
 * superseded navigation — but `installRouteNavLoadingGuards` always bumped on
 * `beforeEach`. Without an explicit `release`, `App.vue`’s full-screen route loader
 * stays on (e.g. after redirect to `/auth`). Same for admin → `/app` redirect.
 */
router.beforeEach(async (to) => {
  if (to.meta.requiresAdmin) {
    const { ensureAuthLoaded, user } = useAuth()
    await ensureAuthLoaded()
    if (user.value?.role !== 'admin') {
      releaseRouteNavLoading()
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

  releaseRouteNavLoading()
  return {
    path: '/auth',
    query: {
      redirect: to.fullPath,
      mode: 'login',
    },
  }
})
