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
import {
  loadCheckersPage,
  loadEatFirstPage,
  loadGameTemplatePage,
  loadMafiaPage,
  loadNadleStreamPage,
} from '@/routerRouteLoaders'


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
          /**
           * Production Mafia route. Owned by `MafiaPage` + the shared
           * `<CallPage>` orchestrator, the Mafia store, and the `mafia:*`
           * WS protocol. Do NOT add an alias here — `/app/game-template`
           * is now a fully separate route record below so its page tree
           * (page wrapper, host panel, overlay, host actions bar,
           * speaking queue bar, and a forked `GameTemplateCallPage`) can
           * evolve independently of Mafia.
           */
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
          /**
           * Game Template route — a forked / duplicated copy of the Mafia
           * page stack mounted under `/app/game-template`. Initially 1:1
           * behaviorally and visually with `/app/mafia`; future game
           * scaffolding lives here without touching production Mafia.
           *
           * Frontend files are forked and renamed under `GameTemplate*`;
           * the WS protocol and signaling room prefix (`mafia:<base>`)
           * are intentionally still shared with Mafia for now so the
           * existing backend continues to work end-to-end. A generic
           * `gameroom:` namespace is a future server-side step.
           */
          path: 'game-template',
          name: 'game-template',
          meta: {
            appTitleKey: 'routes.gameTemplate',
            footerContext: 'call',
            footer: false,
            requiresAuth: true,
          },
          component: loadGameTemplatePage,
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
          path: 'wallet',
          name: 'economy-wallet',
          meta: { appTitle: 'Wallet', footerContext: 'home', requiresAuth: true },
          component: () => import('./features/economy/pages/EconomyWalletPage.vue'),
        },
        {
          path: 'cases',
          name: 'economy-cases',
          meta: { appTitle: 'Cases', footerContext: 'home', requiresAuth: true },
          component: () => import('./features/economy/pages/EconomyCasesPage.vue'),
        },
        {
          path: 'predictions/:streamerId',
          name: 'economy-predictions',
          meta: { appTitle: 'Predictions', footerContext: 'home', requiresAuth: true },
          component: () => import('./features/economy/pages/EconomyPredictionsPage.vue'),
        },
        {
          path: 'streamer/:streamerId/economy',
          name: 'economy-streamer-settings',
          meta: { appTitle: 'Streamer economy', footerContext: 'home', requiresAuth: true },
          component: () => import('./features/economy/pages/EconomyStreamerSettingsPage.vue'),
        },
        {
          path: 'billing',
          name: 'billing',
          meta: { appTitle: 'Stream Assist Pro', footerContext: 'home', requiresAuth: true },
          component: () => import('./pages/BillingPage.vue'),
        },
        {
          path: 'account',
          name: 'account',
          meta: { appTitle: 'Акаунт', footerContext: 'home', requiresAuth: true, chromeless: true },
          component: () => import('./pages/AccountPage.vue'),
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
            {
              path: 'diagnostics',
              name: 'admin-diagnostics',
              component: () => import('./admin/ui/AdminDiagnostics.vue'),
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
        query: eatGameOnlyQuery(to.query as Record<string, unknown>),
      }),
    },
    {
      path: '/eat/admin',
      redirect: (to: RouteLocationGeneric) => ({
        path: '/app/eat',
        query: eatGameOnlyQuery(to.query as Record<string, unknown>),
      }),
    },
    {
      path: '/eat/control',
      redirect: (to: RouteLocationGeneric) => ({
        path: '/app/eat',
        query: eatGameOnlyQuery(to.query as Record<string, unknown>),
      }),
    },
    {
      path: '/eat/overlay',
      redirect: (to: RouteLocationGeneric) => ({
        path: '/app/eat',
        query: { ...eatGameOnlyQuery(to.query as Record<string, unknown>), mode: 'view' },
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

/**
 * Build a query object containing only the safe `game` carry-over for the
 * top-level `/eat/*` legacy redirects. Drops any legacy query keys
 * (`view`, `host`, `player`, `token`, `mode`) so the canonical URL stays
 * clean; callers can layer canonical keys (e.g. `mode: 'view'`) on top.
 */
function eatGameOnlyQuery(query: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  const raw = query.game
  const value = Array.isArray(raw) ? raw[0] : raw
  if (typeof value === 'string' && value.trim().length > 0) {
    out.game = value.trim()
  }
  return out
}

const LEGACY_EAT_VIEW_VALUES = new Set(['overlay', 'control', 'admin'])

/**
 * Normalize legacy `/app/eat` query params to the canonical surface:
 * - `view=overlay` → `mode=view` (canonical OBS receive-only)
 * - `view=control` / `view=admin` → drop `view` (no panel left to render)
 * - `host=…` / `player=…` / `token=…` (legacy admin/control/personal-overlay) → drop
 * Returns `null` when the URL is already canonical so we don't loop on `replace`.
 */
function normalizeEatLegacyQuery(
  to: RouteLocationGeneric,
): { path: string; query: Record<string, string> } | null {
  if (to.name !== 'eat') return null
  const query = to.query as Record<string, unknown>

  const rawView = Array.isArray(query.view) ? query.view[0] : query.view
  const view = typeof rawView === 'string' ? rawView.toLowerCase() : ''
  const isLegacyView = LEGACY_EAT_VIEW_VALUES.has(view)
  const hasLegacyView = isLegacyView || view === 'call' || view === 'join' || view.length > 0
  const hasLegacyHost = 'host' in query
  const hasLegacyPlayer = 'player' in query
  const hasLegacyToken = 'token' in query
  if (!hasLegacyView && !hasLegacyHost && !hasLegacyPlayer && !hasLegacyToken) {
    return null
  }

  const next: Record<string, string> = eatGameOnlyQuery(query)

  if (isLegacyView) {
    if (view === 'overlay') {
      next.mode = 'view'
    }
    // view=control / view=admin → drop view entirely (panel removed).
  } else {
    // For unknown/call/join view values: preserve any existing canonical `mode`
    // (e.g. someone passed `?mode=view&view=call`) but drop `view`.
    const rawMode = Array.isArray(query.mode) ? query.mode[0] : query.mode
    if (typeof rawMode === 'string' && rawMode.length > 0) {
      next.mode = rawMode
    }
  }

  // Preserve email-verification carry-over (used by the verify-email gate).
  for (const k of ['emailVerified', 'emailVerification'] as const) {
    const v = query[k]
    if (typeof v === 'string' && v.length > 0) {
      next[k] = v
    }
  }

  return { path: '/app/eat', query: next }
}

function isMafiaObsViewRoute(to: RouteLocationGeneric): boolean {
  if (to.name !== 'mafia' && to.name !== 'game-template') {
    return false
  }
  const mode = (to.query as Record<string, unknown>).mode
  const value = Array.isArray(mode) ? mode[0] : mode
  return value === 'view'
}

function isEatFirstObsViewRoute(to: RouteLocationGeneric): boolean {
  if (to.name !== 'eat') {
    return false
  }
  const mode = (to.query as Record<string, unknown>).mode
  const value = Array.isArray(mode) ? mode[0] : mode
  return value === 'view'
}

const BETA_GATED_ROUTE_NAMES = new Set(['call', 'mafia', 'game-template', 'eat'])
const BETA_ACCESS_MODAL_BY_ROUTE_NAME = {
  call: 'video-call',
  mafia: 'mafia',
  'game-template': 'mafia',
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
  /**
   * Legacy Eat First panel cleanup: the old `view=overlay|control|admin`
   * surface (and `host=…` / `player=…` / `token=…` query params) is gone.
   * Normalize before any auth/beta check so the rest of the guard sees the
   * canonical URL.
   */
  const eatLegacyRedirect = normalizeEatLegacyQuery(to)
  if (eatLegacyRedirect != null) {
    releaseRouteNavLoading()
    return eatLegacyRedirect
  }

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

  const obsView = isMafiaObsViewRoute(to) || isEatFirstObsViewRoute(to)
  const needMeta = Boolean(to.meta.requiresAuth) && !obsView
  const needBetaAccess = routeNeedsBetaAccess(to) && !obsView
  if (!needMeta && !needBetaAccess) {
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
