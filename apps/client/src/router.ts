import { defineComponent } from 'vue'
import {
  createRouter,
  createWebHistory,
  type RouteLocationGeneric,
  type RouteRecordRaw,
  type RouterScrollBehavior,
} from 'vue-router'
import { useAuth, type AppUser } from '@/composables/useAuth'
import { registerEatFirstRouterGuards } from '@/eat-first/router.js'
import { installRouteNavLoadingGuards, releaseRouteNavLoading } from '@/routeNavLoading'
import { STREAMER_NICK } from '@/eat-first/constants/brand.js'
import { loadCheckersPage, loadEatFirstPage, loadMafiaPage, loadNadleStreamPage } from '@/routerRouteLoaders'


const DEFAULT_NADLE_STREAMER =
  (typeof import.meta.env.VITE_DEFAULT_STREAMER === 'string' && import.meta.env.VITE_DEFAULT_STREAMER.trim()) ||
  STREAMER_NICK


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
          path: 'verify-email',
          name: 'verify-email',
          meta: { appTitle: 'Verify your email', footerContext: 'home', requiresAuth: true },
          component: () => import('./pages/VerifyEmailPage.vue'),
        },
        {
          path: 'beta-access',
          name: 'beta-access',
          meta: { appTitleKey: 'betaAccess.routeTitle', footerContext: 'home', requiresAuth: true },
          component: () => import('./pages/BetaAccessPage.vue'),
        },
        {
          path: 'call',
          name: 'call',
          meta: {
            appTitleKey: 'routes.call',
            footerContext: 'call',
            footer: false,
            requiresAuth: true,
          },
          component: () => import('./components/call/CallPage.vue'),
        },
        {
          path: 'mafia',
          name: 'mafia',
          meta: {
            appTitleKey: 'routes.mafia',
            footerContext: 'call',
            footer: false,
            requiresAuth: true,
          },
          component: loadMafiaPage,
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
          component: loadNadleStreamPage,
        },
        {
          path: 'nadraw-show/:streamer',
          name: 'nadraw-show',
          meta: { appTitleKey: 'routes.nadrawShow', footerContext: 'home', footer: false },
          component: () => import('./pages/NadrawShowPage.vue'),
        },
        {
          path: 'checkers/:roomId',
          name: 'checkers',
          meta: { appTitle: 'Шашки', footerContext: 'home', footer: false },
          component: loadCheckersPage,
        },
        {
          path: 'eat',
          name: 'eat',
          meta: { footerContext: 'eat' },
          component: loadEatFirstPage,
        },
        {
          path: 'coin-hub',
          name: 'coin-hub',
          meta: { appTitleKey: 'routes.coinHub', footerContext: 'home' },
          component: () => import('./pages/CoinHubPage.vue'),
        },
        {
          path: 'billing',
          name: 'billing',
          meta: { appTitle: 'StreamAssist Pro', footerContext: 'home', requiresAuth: true },
          component: () => import('./pages/BillingPage.vue'),
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
            {
              path: 'billing',
              name: 'admin-billing',
              component: () => import('./admin/ui/AdminBilling.vue'),
            },
          ],
        },
        /**
         * Short URL: `/app/:streamer` (legacy). Static segments above take precedence:
         * `call`, `mafia`, `nadle`, `nadle/:streamer`, `nadraw-show/:streamer`, `checkers/:roomId`, `eat`, `coin-hub`, `billing`, `admin` are reserved — a streamer slug matching
         * those first segments cannot use this short path (e.g. `/app/call` is the Call page, not nadle for "call").
         */
        {
          path: ':streamer',
          name: 'app-streamer',
          meta: { appTitleKey: 'routes.nadle', footerContext: 'nadle' },
          component: loadNadleStreamPage,
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
        query: { ...to.query, view: 'call' },
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

function isMafiaObsViewRoute(to: RouteLocationGeneric): boolean {
  if (to.name !== 'mafia') {
    return false
  }
  const mode = (to.query as Record<string, unknown>).mode
  const value = Array.isArray(mode) ? mode[0] : mode
  return value === 'view'
}

const BETA_GATED_ROUTE_NAMES = new Set(['call', 'mafia', 'eat'])
const BETA_ACCESS_MODAL_BY_ROUTE_NAME = {
  call: 'video-call',
  mafia: 'mafia',
  eat: 'eat-first',
} as const

function routeNeedsBetaAccess(to: RouteLocationGeneric): boolean {
  return typeof to.name === 'string' && BETA_GATED_ROUTE_NAMES.has(to.name)
}

function betaAccessModalQueryValue(to: RouteLocationGeneric): string {
  const name = typeof to.name === 'string' ? to.name : ''
  return name in BETA_ACCESS_MODAL_BY_ROUTE_NAME
    ? BETA_ACCESS_MODAL_BY_ROUTE_NAME[name as keyof typeof BETA_ACCESS_MODAL_BY_ROUTE_NAME]
    : 'video-call'
}

function userHasBetaAccess(user: AppUser | null): boolean {
  if (!user) return false
  return user.role === 'admin' || user.roles?.includes('STREAMER') === true
}

function userNeedsEmailVerification(user: AppUser | null): boolean {
  return (
    typeof user?.email === 'string' &&
    user.email.length > 0 &&
    user.emailVerified === false
  )
}

function emailVerificationQuery(query: Record<string, unknown>): Record<string, string> {
  const next: Record<string, string> = {}
  const emailVerified = query.emailVerified
  const emailVerification = query.emailVerification
  if (emailVerified === '1') {
    next.emailVerified = '1'
  }
  if (emailVerification === 'failed') {
    next.emailVerification = 'failed'
  }
  return next
}

/**
 * When a guard returns a new location, vue-router may not run `afterEach` for the
 * superseded navigation — but `installRouteNavLoadingGuards` always bumped on
 * `beforeEach`. Without an explicit `release`, `App.vue`’s full-screen route loader
 * stays on (e.g. after redirect to `/auth`). Same for admin → `/app` redirect.
 */
router.beforeEach(async (to) => {
  const isAppRoute = to.path === '/app' || to.path.startsWith('/app/')
  const isVerifyEmailRoute = to.name === 'verify-email'
  if (isAppRoute) {
    const { ensureAuthLoaded, isAuthenticated, user } = useAuth()
    await ensureAuthLoaded()
    if (isAuthenticated.value && userNeedsEmailVerification(user.value) && !isVerifyEmailRoute) {
      releaseRouteNavLoading()
      return {
        name: 'verify-email',
        query: emailVerificationQuery(to.query as Record<string, unknown>),
      }
    }
    if (isAuthenticated.value && user.value?.emailVerified === true && isVerifyEmailRoute) {
      releaseRouteNavLoading()
      return {
        path: '/app',
        query: emailVerificationQuery(to.query as Record<string, unknown>),
      }
    }
  }

  if (to.meta.requiresAdmin) {
    const { ensureAuthLoaded, user } = useAuth()
    await ensureAuthLoaded()
    if (user.value?.role !== 'admin') {
      releaseRouteNavLoading()
      return { path: '/app' }
    }
  }

  const mafiaObsView = isMafiaObsViewRoute(to)
  const needMeta = Boolean(to.meta.requiresAuth) && !mafiaObsView
  const needEatStaff = to.name === 'eat' && eatViewNeedsStreamAuth(to.query as Record<string, unknown>)
  const needBetaAccess = routeNeedsBetaAccess(to) && !mafiaObsView
  if (!needMeta && !needEatStaff && !needBetaAccess) {
    return true
  }

  const { ensureAuthLoaded, isAuthenticated, user } = useAuth()
  await ensureAuthLoaded()
  if (!isAuthenticated.value) {
    releaseRouteNavLoading()
    return {
      path: '/auth',
      query: {
        redirect: to.fullPath,
        mode: 'login',
      },
    }
  }

  if (needBetaAccess && !userHasBetaAccess(user.value)) {
    releaseRouteNavLoading()
    return { name: 'home', query: { betaAccess: betaAccessModalQueryValue(to) } }
  }

  return true
})
