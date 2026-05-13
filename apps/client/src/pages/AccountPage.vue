<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter, type RouteLocationRaw } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuth } from '@/composables/useAuth'
import { useProSubscription } from '@/composables/useProSubscription'
import { useCoinHubStore } from '@/stores/coinHub'
import AppLandingHeader from '@/pages/app/components/AppHeader.vue'
import LandingCloudBackdrop from '@/components/ui/LandingCloudBackdrop.vue'
import coinIcon from '@/assets/landing/coin-streamassist.png'
import mafiaHeaderLogo from '@/assets/mafia/ui/header-logo.svg'
import mafiaHeaderSettingsIcon from '@/assets/mafia/ui/header-settings.svg'

type TabKey = 'profile' | 'subscription' | 'settings'

type SettingsRow = {
  label: string
  sub: string
  value: string
  action: string
}

const auth = useAuth()
const router = useRouter()
const { locale } = useI18n()
const { refreshSubscription, isProActive: isProActiveSubscription, expiresAt: proExpiresAt } = useProSubscription()
const coinHub = useCoinHubStore()
const { balance: coinBalance } = storeToRefs(coinHub)

const activeTab = ref<TabKey>('profile')
const accountHeaderBrand = 'Stream Assist'
const accountHeaderTitle = 'ACCOUNT'
const headerCoinHubRoute = { name: 'coin-hub' } satisfies RouteLocationRaw
const accountRouteTo = { name: 'account' } satisfies RouteLocationRaw
const proHeaderLinkTo = { name: 'billing' } satisfies RouteLocationRaw

const user = computed(() => auth.user.value)
const isHeaderAuthLoading = computed(() => !auth.loaded.value)
const isAuthenticated = computed(() => auth.isAuthenticated.value)
const streamer = computed(() => user.value?.streamer ?? null)
const displayName = computed(() => user.value?.displayName?.trim() || 'ramadan160')
const headerUserAvatar = computed(() => user.value?.avatar ?? '')
const userInitial = computed(() => (displayName.value.trim()[0] || 'R').toUpperCase())
const userEmail = computed(() => user.value?.email?.trim() || 'nad1ch@streamassist.gg')
const isEmailVerified = computed(() => user.value?.emailVerified === true)
const providerKind = computed(() => user.value?.provider ?? (user.value == null ? 'twitch' : null))
const hasStreamerProfile = computed(
  () =>
    user.value == null ||
    Boolean(streamer.value) ||
    user.value?.roles?.includes('STREAMER') === true ||
    providerKind.value === 'twitch',
)
const providerLabel = computed(() => {
  switch (providerKind.value) {
    case 'twitch':
      return 'Twitch'
    case 'google':
      return 'Google'
    case 'apple':
      return 'Apple'
    case 'email':
      return 'Email'
    default:
      return 'Email'
  }
})
const streamHandle = computed(() => streamer.value?.username || displayName.value)
const streamTier = computed(() => {
  const tier = streamer.value?.tier || streamer.value?.broadcasterType
  if (!tier) return 'Affiliate'
  return tier[0]?.toUpperCase() + tier.slice(1)
})
const streamFollowersLabel = computed(() =>
  new Intl.NumberFormat('uk-UA').format(streamer.value?.followersCount ?? 12345),
)
const avgOnlineLabel = computed(() => streamer.value?.avgOnline7d ?? 102)
const coinBalanceLabel = computed(() => new Intl.NumberFormat('uk-UA').format(coinBalance.value))
const headerCoinBalanceLabel = computed(() => (isAuthenticated.value ? coinBalanceLabel.value : '—'))
const accountProfileTo = computed<RouteLocationRaw | undefined>(() =>
  user.value?.role === 'admin' ? { name: 'admin-users' } : undefined,
)
const proHeaderLabel = computed(() => {
  const iso = proExpiresAt.value
  if (!iso) return 'StreamAssist Pro'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'StreamAssist Pro'
  const formatted = date.toLocaleDateString(locale.value, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
  return `StreamAssist Pro · до ${formatted}`
})

const activeNavTop = computed(() => {
  if (activeTab.value === 'subscription') return 59
  if (activeTab.value === 'settings') return 102
  return 16
})

const settingsRows = computed<SettingsRow[]>(() => [
  {
    label: 'Email для рахунків',
    sub: 'сповіщення про оплати й продовження підписки',
    value: userEmail.value,
    action: 'Змінити',
  },
  {
    label: `${providerLabel.value} підключено`,
    sub: hasStreamerProfile.value
      ? 'основний провайдер входу · стрімерська автентифікація · з 14 бер. 2024'
      : 'основний провайдер входу · з 14 бер. 2024',
    value: hasStreamerProfile.value ? `@${streamHandle.value}` : displayName.value,
    action: 'Налаштувати',
  },
  {
    label: 'Мова інтерфейсу',
    sub: 'впливає на повідомлення та email-листи',
    value: 'Українська',
    action: 'Змінити',
  },
  {
    label: 'Сповіщення',
    sub: 'live alerts, фоловери, transaction events',
    value: 'Email · Push',
    action: 'Налаштувати',
  },
  {
    label: 'OBS оверлеї',
    sub: 'URL для додавання у Browser Source',
    value: '3 активні',
    action: 'Скопіювати',
  },
])

const basicFeatures = ['3 години відеодзвінків', 'Закриті ігри', 'Підтримка']
const plusFeatures = ['12 годин відеодзвінків', 'OBS оверлеї', 'Усі ігри та режими', 'Пріоритетна підтримка']
const proFeatures = [
  'Безлімітні відеодзвінки',
  'OBS оверлеї',
  'Усі ігри та режими',
  'Розширений набір ігрових інструментів стрімера',
  'Пріоритетна підтримка',
]

function setTab(tab: TabKey): void {
  activeTab.value = tab
}

async function onLogout(): Promise<void> {
  await auth.logout()
}

function onHeaderLogin(): void {
  void router.push({
    name: 'auth',
    query: { redirect: '/app/account', mode: 'login' },
  })
}

function onPlanCta(plan: 'basic' | 'plus' | 'pro'): void {
  if (plan === 'basic') return
  void router.push({ name: 'billing' })
}

function onOpenStream(): void {
  void router.push({ name: 'nadle-streamer', params: { streamer: streamHandle.value } })
}

onMounted(() => {
  void refreshSubscription()
  void coinHub.loadSnapshot({ background: true })
})
</script>

<template>
  <main class="account-page">
    <LandingCloudBackdrop class="account-cloud-backdrop" variant="app" :active="true" />

    <AppLandingHeader
      class="account-shared-header"
      :auth-loading="isHeaderAuthLoading"
      :brand-name="accountHeaderBrand"
      :coin-balance-label="headerCoinBalanceLabel"
      :compact="true"
      :coin-hub-to="headerCoinHubRoute"
      :is-authenticated="isAuthenticated"
      :is-pro-active="isProActiveSubscription"
      :logo-src="mafiaHeaderLogo"
      :mafia-mode="true"
      :profile-to="accountProfileTo"
      :account-to="accountRouteTo"
      :pro-link-to="proHeaderLinkTo"
      :pro-label="proHeaderLabel"
      :show-auth="true"
      :show-coin="false"
      :title="accountHeaderTitle"
      :user-avatar="headerUserAvatar"
      :user-name="displayName"
      @login="onHeaderLogin"
      @logout="onLogout"
    >
      <template #brand-extra>
        <button
          type="button"
          class="account-mafia-settings"
          title="Налаштування акаунту"
          aria-label="Налаштування акаунту"
          @click="setTab('settings')"
        >
          <img class="account-mafia-settings__icon" :src="mafiaHeaderSettingsIcon" alt="" aria-hidden="true" />
        </button>
      </template>
    </AppLandingHeader>

    <section class="account-frame" aria-label="Account">
      <aside class="account-rail" :class="{ 'account-rail--compact': !hasStreamerProfile }">
        <div class="account-avatar" aria-hidden="true">
          <div class="account-avatar__inner">
            <span>{{ userInitial }}</span>
          </div>
        </div>

        <p class="account-rail__name">{{ displayName }}</p>

        <div class="account-chips" :class="{ 'account-chips--streamer': hasStreamerProfile }">
          <span class="account-chip account-chip--provider">
            <span class="account-chip__dot" aria-hidden="true"></span>
            {{ providerLabel }}
          </span>
          <span v-if="hasStreamerProfile" class="account-chip account-chip--streamer">★ Стрімер</span>
          <span v-if="isEmailVerified" class="account-chip account-chip--verified">✓</span>
        </div>

        <div v-if="hasStreamerProfile" class="account-stream">
          <div class="account-stream__head">
            <span class="account-stream__mark" aria-hidden="true"></span>
            <span>@{{ streamHandle }}</span>
          </div>
          <div class="account-stream__stats">
            <div class="account-stream__cell">
              <span class="account-stream__label">ФОЛОВЕРИ</span>
              <span class="account-stream__value">{{ streamFollowersLabel }}</span>
            </div>
            <div class="account-stream__cell">
              <span class="account-stream__label">ТИР</span>
              <span class="account-stream__value">{{ streamTier }}</span>
            </div>
          </div>
          <button type="button" class="account-stream__button" @click="onOpenStream">
            Сторінка каналу →
          </button>
        </div>

        <div class="account-rail__divider" aria-hidden="true"></div>

        <nav class="account-nav" aria-label="Account sections">
          <div class="account-nav__active" :style="{ top: `${activeNavTop}px` }" aria-hidden="true"></div>

          <button type="button" class="account-nav__item" :class="{ 'is-active': activeTab === 'profile' }" @click="setTab('profile')">
            <span class="account-nav__icon account-nav__icon--dot" aria-hidden="true">●</span>
            <span>Профіль</span>
          </button>
          <button
            type="button"
            class="account-nav__item account-nav__item--subscription"
            :class="{ 'is-active': activeTab === 'subscription' }"
            @click="setTab('subscription')"
          >
            <span class="account-nav__icon" aria-hidden="true">
              <svg viewBox="0 0 16 12">
                <path d="M1.5 3.3 4.4 6.6 8 1.2l3.6 5.4 2.9-3.3-2 7.5h-9l-2-7.5Z" />
              </svg>
            </span>
            <span>Підписка</span>
          </button>
          <button
            type="button"
            class="account-nav__item account-nav__item--settings"
            :class="{ 'is-active': activeTab === 'settings' }"
            @click="setTab('settings')"
          >
            <span class="account-nav__icon" aria-hidden="true">
              <svg viewBox="0 0 16 16">
                <circle cx="8" cy="8" r="2.2" />
                <path d="M8 1.7v2M8 12.3v2M1.7 8h2M12.3 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" />
              </svg>
            </span>
            <span>Налаштування</span>
          </button>
          <button type="button" class="account-nav__item account-nav__item--security is-disabled" disabled>
            <span class="account-nav__icon" aria-hidden="true">
              <svg viewBox="0 0 16 16">
                <path d="M8 1.5 13.3 3.6v4.1c0 3.1-2.2 5.2-5.3 6.8-3.1-1.6-5.3-3.7-5.3-6.8V3.6L8 1.5Z" />
              </svg>
            </span>
            <span>Безпека</span>
          </button>
          <button type="button" class="account-nav__item account-nav__item--wallet is-disabled" disabled>
            <span class="account-nav__icon" aria-hidden="true">
              <svg viewBox="0 0 16 14">
                <rect x="1.4" y="2.4" width="13.2" height="9.2" rx="1.5" />
                <path d="M1.4 5h13.2M10.4 8.8h2" />
              </svg>
            </span>
            <span>Гаманець</span>
          </button>
          <button type="button" class="account-nav__item account-nav__item--stream is-disabled" disabled>
            <span class="account-nav__icon" aria-hidden="true">
              <svg viewBox="0 0 16 16">
                <path d="M4 2.3 12.8 8 4 13.7V2.3Z" />
              </svg>
            </span>
            <span>Стрім</span>
          </button>
        </nav>

        <button type="button" class="account-logout" @click="onLogout">Вийти з акаунту</button>
      </aside>

      <template v-if="activeTab === 'profile'">
        <article class="plan-card plan-card--plus">
          <h2 class="plan-card__name">PLUS</h2>
          <span class="plan-card__currency">₴</span>
          <span class="plan-card__old">299</span>
          <span class="plan-card__strike" aria-hidden="true"></span>
          <span class="plan-card__price"><span>99</span> / місяць</span>
          <button type="button" class="plan-card__button" @click="onPlanCta('plus')">Покращити</button>
        </article>

        <article class="plan-card plan-card--pro">
          <h2 class="plan-card__name">PRO</h2>
          <span class="plan-card__crown" aria-hidden="true">
            <svg viewBox="0 0 54 40">
              <path d="M4 11 14.5 22.5 27 4l12.5 18.5L50 11l-4 25H8L4 11Z" />
            </svg>
          </span>
          <span class="plan-card__currency">₴</span>
          <span class="plan-card__old">599</span>
          <span class="plan-card__strike" aria-hidden="true"></span>
          <span class="plan-card__price"><span>299</span> / місяць</span>
          <button type="button" class="plan-card__button" @click="onPlanCta('pro')">Покращити</button>
        </article>

        <article class="info-card info-card--balance">
          <img class="account-balance-coin" :src="coinIcon" alt="" aria-hidden="true" />
          <h2 class="info-card__title">Баланс монет</h2>
          <p class="info-card__balance">{{ coinBalanceLabel }}</p>
          <p class="info-card__copy">
            монет на твоєму рахунку — використовуй у Coin Hub на бусти, скіни та переваги в іграх
          </p>
          <div class="info-card__divider" aria-hidden="true"></div>
          <p class="info-card__meta">сер.онлайн 7д · {{ avgOnlineLabel }}</p>
          <button type="button" class="info-card__link" @click="router.push({ name: 'coin-hub' })">
            Перейти в Coin Hub →
          </button>
        </article>

        <article class="info-card info-card--activity">
          <span class="bolt-icon" aria-hidden="true">
            <svg viewBox="0 0 18 24">
              <path d="M10 1 2 13h6L7 23l9-13h-6l0-9Z" />
            </svg>
          </span>
          <h2 class="info-card__title">Твоя активність</h2>
          <div class="activity-grid">
            <div class="activity-cell">
              <span>ЗІГРАНО ІГОР</span>
              <strong>87</strong>
            </div>
            <div class="activity-cell">
              <span>УЛЮБЛЕНА</span>
              <strong>Мафія</strong>
            </div>
            <div class="activity-cell">
              <span>ЧАС У ПЛАТФОРМІ</span>
              <strong>42 год</strong>
            </div>
            <div class="activity-cell">
              <span>УЧАСНИК З</span>
              <strong>бер. 2024</strong>
            </div>
          </div>
          <div class="info-card__divider" aria-hidden="true"></div>
          <p class="info-card__meta">останній вхід · 2 год тому</p>
          <button type="button" class="info-card__link" @click="router.push({ name: 'home' })">
            До каталогу ігор →
          </button>
        </article>

        <section class="settings-card settings-card--profile" aria-label="Account settings">
          <div v-for="(row, index) in settingsRows" :key="row.label" class="settings-row" :class="{ 'settings-row--last': index === settingsRows.length - 1 }">
            <div class="settings-row__main">
              <h3>{{ row.label }}</h3>
              <p>{{ row.sub }}</p>
            </div>
            <div class="settings-row__side">
              <span>{{ row.value }}</span>
              <button type="button">{{ row.action }}</button>
            </div>
          </div>
        </section>
      </template>

      <template v-else-if="activeTab === 'settings'">
        <section class="settings-card settings-card--full" aria-label="Account settings">
          <div v-for="(row, index) in settingsRows" :key="row.label" class="settings-row" :class="{ 'settings-row--last': index === settingsRows.length - 1 }">
            <div class="settings-row__main">
              <h3>{{ row.label }}</h3>
              <p>{{ row.sub }}</p>
            </div>
            <div class="settings-row__side">
              <span>{{ row.value }}</span>
              <button type="button">{{ row.action }}</button>
            </div>
          </div>
        </section>
      </template>

      <template v-else>
        <article class="wide-plan wide-plan--basic">
          <h2>BASIC</h2>
          <ul>
            <li v-for="feature in basicFeatures" :key="feature"><span></span>{{ feature }}</li>
          </ul>
          <span class="wide-plan__currency">₴</span>
          <span class="wide-plan__price"><strong>0</strong> / місяць</span>
        </article>

        <article class="wide-plan wide-plan--plus">
          <h2>PLUS</h2>
          <ul>
            <li v-for="feature in plusFeatures" :key="feature"><span></span>{{ feature }}</li>
          </ul>
          <span class="wide-plan__currency">₴</span>
          <span class="wide-plan__old">299</span>
          <span class="wide-plan__strike" aria-hidden="true"></span>
          <span class="wide-plan__price"><strong>99</strong> / місяць</span>
          <button type="button" @click="onPlanCta('plus')">Покращити</button>
        </article>

        <article class="wide-plan wide-plan--pro">
          <h2>PRO</h2>
          <span class="wide-plan__crown" aria-hidden="true">
            <svg viewBox="0 0 54 40">
              <path d="M4 11 14.5 22.5 27 4l12.5 18.5L50 11l-4 25H8L4 11Z" />
            </svg>
          </span>
          <ul>
            <li v-for="feature in proFeatures" :key="feature"><span></span>{{ feature }}</li>
          </ul>
          <span class="wide-plan__currency">₴</span>
          <span class="wide-plan__old">599</span>
          <span class="wide-plan__strike" aria-hidden="true"></span>
          <span class="wide-plan__price"><strong>299</strong> / місяць</span>
          <button type="button" @click="onPlanCta('pro')">Покращити</button>
        </article>
      </template>
    </section>
  </main>
</template>

<style scoped>
.account-page {
  --account-display: 'Climate Crisis', var(--sa-font-display, system-ui, sans-serif);
  --account-ui: 'Marmelad', var(--sa-font-main, system-ui, sans-serif);
  --account-sans: 'Inter', var(--sa-font-main, system-ui, sans-serif);
  --account-header-height: 72px;
  --account-content-gap: 18px;
  box-sizing: border-box;
  position: relative;
  isolation: isolate;
  height: 100svh;
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: var(--account-content-gap);
  padding: 0 0 var(--account-content-gap);
  overflow: auto;
  background:
    radial-gradient(circle at 50% -10%, rgb(88 28 135 / 0.24), transparent 34rem),
    #060013;
  color: #fff;
  font-family: var(--account-ui);
}

.account-cloud-backdrop {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.account-shared-header {
  position: relative;
  z-index: 1;
  width: 100%;
  flex: 0 0 auto;
}

.account-mafia-settings {
  width: 2.35rem;
  height: 2.35rem;
  display: inline-grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
}

.account-mafia-settings:hover,
.account-mafia-settings:focus-visible {
  background: rgb(255 255 255 / 0.08);
  outline: none;
}

.account-mafia-settings__icon {
  width: 1.45rem;
  height: 1.45rem;
  display: block;
}

.account-frame {
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  width: 1280px;
  height: max(765px, calc(100svh - var(--account-header-height) - var(--account-content-gap) - var(--account-content-gap)));
  overflow: hidden;
  border-radius: 24px;
}

.plan-card__crown svg,
.wide-plan__crown svg,
.bolt-icon svg,
.account-nav__icon svg {
  display: block;
  width: 100%;
  height: 100%;
}

.account-balance-coin {
  position: absolute;
  left: 23px;
  top: 22px;
  width: 26px;
  height: 26px;
  display: block;
  object-fit: contain;
  filter: drop-shadow(0 0 10px rgb(255 190 51 / 0.34));
}

.account-rail {
  position: absolute;
  left: 18px;
  top: 0;
  width: 358px;
  height: 100%;
  overflow: hidden;
  border-radius: 30px;
  background:
    linear-gradient(90deg, rgb(102 56 143 / 0.2), rgb(102 56 143 / 0.2)),
    linear-gradient(180deg, rgb(255 255 255 / 0.011), rgb(255 255 255 / 0.004) 50%, rgb(255 255 255 / 0.005));
  box-shadow:
    0 18px 48px rgb(8 4 22 / 0.45),
    inset 0 1px 0 rgb(255 255 255 / 0.08);
  -webkit-backdrop-filter: blur(14px) saturate(1.12);
  backdrop-filter: blur(14px) saturate(1.12);
}

.account-avatar {
  position: absolute;
  left: 139px;
  top: 28px;
  width: 80px;
  height: 80px;
  overflow: hidden;
  border-radius: 40px;
  background: linear-gradient(150deg, #7c3aed 32%, #a855f7 54%, #c084fc 72%, #4c1d95 91%, #7c3aed 105%);
  box-shadow: 0 0 24px rgb(124 58 237 / 0.35);
}

.account-avatar__inner {
  position: absolute;
  left: 2px;
  top: 2px;
  width: 76px;
  height: 76px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 38px;
  background: linear-gradient(45deg, #2a1a5a 15%, #0b0a1f 85%);
}

.account-avatar__inner span {
  color: #e9d5ff;
  font-family: var(--account-display);
  font-size: 30px;
  font-weight: 400;
  font-variation-settings: 'YEAR' 1979;
  line-height: 1;
}

.account-rail__name {
  position: absolute;
  left: 0;
  right: 0;
  top: 122px;
  margin: 0;
  color: #fff;
  font-family: var(--account-ui);
  font-size: 18px;
  line-height: 21px;
  text-align: center;
}

.account-chips {
  position: absolute;
  left: 83px;
  top: 153px;
  width: 192px;
  height: 23px;
  display: flex;
  justify-content: center;
  gap: 6px;
}

.account-chip {
  box-sizing: border-box;
  height: 23px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 19px;
  padding: 0 10px;
  font-family: var(--account-sans);
  font-size: 11px;
  font-weight: 600;
  line-height: 13px;
  white-space: nowrap;
}

.account-chip--provider {
  min-width: 70px;
  border: 1px solid rgb(145 70 255 / 0.4);
  background: rgb(145 70 255 / 0.16);
  color: #d6c0ff;
}

.account-chip--streamer {
  min-width: 80px;
  border: 1px solid rgb(251 191 36 / 0.35);
  background: rgb(251 191 36 / 0.1);
  color: #fde68a;
}

.account-chip--verified {
  width: 30px;
  min-width: 30px;
  padding: 0;
  border: 1px solid rgb(52 211 153 / 0.36);
  background: rgb(52 211 153 / 0.12);
  color: #a7f3d0;
}

.account-chip__dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  background: #8b5cf6;
  clip-path: polygon(50% 0, 100% 30%, 100% 74%, 50% 100%, 0 74%, 0 30%);
}

.account-stream {
  position: absolute;
  left: 24px;
  top: 220px;
  width: 310px;
  height: 140px;
  box-sizing: border-box;
  overflow: hidden;
  border: 4px solid rgb(145 70 255 / 0.3);
  border-radius: 30px;
  background:
    radial-gradient(ellipse at center, rgb(145 70 255 / 0.18), rgb(145 70 255 / 0) 65%),
    linear-gradient(90deg, rgb(20 14 46 / 0.45), rgb(20 14 46 / 0.45)),
    linear-gradient(180deg, rgb(255 255 255 / 0.04), rgb(255 255 255 / 0.01));
  box-shadow:
    0 0 20px rgb(124 58 237 / 0.18),
    inset 0 1px 0 rgb(255 255 255 / 0.08);
}

.account-stream__head {
  position: absolute;
  left: 20px;
  top: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #fff;
  font-family: var(--account-sans);
  font-size: 14px;
  font-weight: 700;
  line-height: 17px;
}

.account-stream__mark {
  width: 10px;
  height: 12px;
  border-radius: 2px;
  background: #8b5cf6;
  clip-path: polygon(50% 0, 100% 30%, 100% 76%, 50% 100%, 0 76%, 0 30%);
}

.account-stream__stats {
  position: absolute;
  left: 15px;
  top: 33px;
  width: 282px;
  display: grid;
  grid-template-columns: 136px 136px;
  column-gap: 10px;
}

.account-stream__cell {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding-left: 5px;
}

.account-stream__cell + .account-stream__cell {
  padding-left: 34px;
}

.account-stream__label {
  color: rgb(255 255 255 / 0.45);
  font-family: var(--account-ui);
  font-size: 12px;
  line-height: 18px;
  letter-spacing: 0.08em;
}

.account-stream__value {
  color: #fff;
  font-family: var(--account-ui);
  font-size: 16px;
  line-height: 20px;
}

.account-stream__button {
  position: absolute;
  left: 14px;
  top: 92px;
  width: 278px;
  height: 29px;
  border: 1px solid rgb(211 180 255 / 0.32);
  border-radius: 30px;
  background: rgb(145 70 255 / 0.14);
  color: #d6c0ff;
  cursor: pointer;
  font-family: var(--account-ui);
  font-size: 13px;
  line-height: 16px;
  transition: background 0.15s ease, color 0.15s ease;
}

.account-stream__button:hover {
  background: rgb(145 70 255 / 0.22);
  color: #fff;
}

.account-rail__divider {
  position: absolute;
  left: 24px;
  top: 359px;
  width: 310px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgb(255 255 255 / 0.1), transparent);
}

.account-nav {
  position: absolute;
  left: 24px;
  top: 378px;
  width: 310px;
  height: 285px;
  overflow: hidden;
}

.account-nav__active {
  position: absolute;
  left: 0;
  width: 310px;
  height: 41px;
  box-sizing: border-box;
  border: 1px solid rgb(124 58 237 / 0.42);
  border-radius: 24px;
  background: linear-gradient(180deg, rgb(124 58 237 / 0.22), rgb(124 58 237 / 0.1));
  pointer-events: none;
  transition: top 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}

.account-nav__item {
  position: absolute;
  left: 0;
  width: 310px;
  height: 41px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: #fff;
  cursor: pointer;
  font-family: var(--account-ui);
  font-size: 14px;
  line-height: 17px;
  text-align: left;
}

.account-nav__item:hover:not(.is-disabled) {
  background: rgb(255 255 255 / 0.025);
}

.account-nav__item.is-disabled {
  color: rgb(255 255 255 / 0.4);
  cursor: default;
}

.account-nav__item:nth-of-type(1) {
  top: 16px;
}

.account-nav__item--subscription {
  top: 59px;
}

.account-nav__item--settings {
  top: 102px;
}

.account-nav__item--security {
  top: 146px;
}

.account-nav__item--wallet {
  top: 189px;
}

.account-nav__item--stream {
  top: 232px;
}

.account-nav__item span:last-child {
  position: absolute;
  left: 35px;
  top: 10px;
  white-space: nowrap;
}

.account-nav__item:nth-of-type(1) span:last-child {
  left: 34px;
  top: 12px;
}

.account-nav__item--settings span:last-child {
  top: 10px;
}

.account-nav__item--security span:last-child {
  left: 36px;
  top: 13px;
}

.account-nav__item--wallet span:last-child {
  left: 36px;
  top: 11px;
}

.account-nav__item--stream span:last-child {
  left: 37px;
  top: 10px;
}

.account-nav__icon {
  position: absolute;
  left: 12px;
  top: 13px;
  width: 15px;
  height: 15px;
  color: currentColor;
}

.account-nav__icon svg {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.account-nav__icon--dot {
  left: 13px;
  top: 12px;
  font-size: 13px;
  line-height: 16px;
}

.account-logout {
  position: absolute;
  left: 25px;
  bottom: 23px;
  width: 310px;
  height: 36px;
  border: 1px solid rgb(244 63 94 / 0.45);
  border-radius: 34px;
  background: linear-gradient(180deg, rgb(244 63 94 / 0.23), rgb(244 63 94 / 0.21));
  color: #fca5a5;
  cursor: pointer;
  font-family: var(--account-ui);
  font-size: 14px;
  font-weight: 400;
  line-height: 16px;
}

.account-logout:hover {
  color: #fff;
  background: linear-gradient(180deg, rgb(244 63 94 / 0.32), rgb(244 63 94 / 0.24));
}

.account-rail--compact .account-rail__divider {
  top: 211px;
}

.account-rail--compact .account-nav {
  top: 209px;
}

.plan-card {
  position: absolute;
  top: 0;
  width: 422px;
  height: 157px;
  box-sizing: border-box;
  overflow: hidden;
  border-width: 4px;
  border-style: solid;
  border-radius: 30px;
}

.plan-card--plus {
  left: 397px;
  border-color: #c861ff;
  background:
    linear-gradient(90deg, rgb(102 56 143 / 0.54), rgb(102 56 143 / 0.54)),
    linear-gradient(180deg, rgb(255 255 255 / 0.01), rgb(255 255 255 / 0.002) 60%, rgb(255 255 255 / 0.004));
}

.plan-card--pro {
  left: 840px;
  border-color: #fbbf24;
  background:
    linear-gradient(90deg, rgb(255 218 68 / 0.24), rgb(255 218 68 / 0.24)),
    linear-gradient(180deg, rgb(255 255 255 / 0.01), rgb(255 255 255 / 0.002) 60%, rgb(255 255 255 / 0.004));
}

.plan-card__name {
  position: absolute;
  left: 33px;
  top: 61px;
  margin: 0;
  color: #fff;
  font-family: var(--account-display);
  font-size: 36px;
  font-weight: 400;
  font-variation-settings: 'YEAR' 1979;
  line-height: 18px;
  letter-spacing: 0;
}

.plan-card--plus .plan-card__name {
  text-shadow: -1px 3px 4px #c861ff;
}

.plan-card--pro .plan-card__name {
  text-shadow: -1px 3px 4px #ffda44;
}

.plan-card__crown {
  position: absolute;
  left: 126px;
  top: 9px;
  width: 65px;
  height: 61px;
  color: #ffda44;
  transform: rotate(35.57deg) skewX(-0.36deg);
}

.plan-card__crown path,
.wide-plan__crown path {
  fill: #fff7d6;
  stroke: #f59e0b;
  stroke-width: 3px;
  stroke-linejoin: round;
  filter: drop-shadow(0 0 3px rgb(255 190 51 / 0.8));
}

.plan-card__currency {
  position: absolute;
  left: 227px;
  top: 9px;
  width: 20px;
  height: 42px;
  font-family: 'Coda Caption', 'Noto Sans', sans-serif;
  font-size: 40px;
  font-weight: 800;
  line-height: 42px;
}

.plan-card--plus .plan-card__currency {
  color: #c861ff;
}

.plan-card--pro .plan-card__currency {
  color: #ffbe33;
}

.plan-card__old {
  position: absolute;
  left: 261px;
  top: 12px;
  color: rgb(255 255 255 / 0.46);
  font-family: 'Marhey', var(--account-ui);
  font-size: 16px;
  font-weight: 300;
  line-height: 32px;
}

.plan-card__strike {
  position: absolute;
  left: 256px;
  top: 26px;
  width: 42px;
  height: 1px;
  background: rgb(255 255 255 / 0.54);
}

.plan-card__price {
  position: absolute;
  left: 257px;
  top: 29px;
  width: 140px;
  height: 32px;
  color: #fff;
  font-family: var(--account-ui);
  font-size: 20px;
  line-height: 32px;
  white-space: nowrap;
}

.plan-card__price span {
  font-family: 'Marhey', var(--account-ui);
  font-weight: 300;
}

.plan-card__button {
  position: absolute;
  left: 219px;
  top: 74px;
  width: 169px;
  height: 51px;
  border-width: 2px;
  border-style: solid;
  border-radius: 28px;
  color: #fff;
  cursor: pointer;
  font-family: var(--account-display);
  font-size: 16px;
  font-weight: 400;
  font-variation-settings: 'YEAR' 1979;
  line-height: 21px;
  letter-spacing: 0;
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.5);
}

.plan-card--plus .plan-card__button {
  border-color: #c861ff;
  background: linear-gradient(16.8deg, rgb(192 132 252 / 0.65) 14.8%, rgb(200 97 255 / 0.65) 85.2%);
  box-shadow:
    0 0 22px 8px rgb(200 97 255 / 0.46),
    inset 0 1px 0 rgb(255 255 255 / 0.5);
}

.plan-card--pro .plan-card__button {
  border-color: #ffda44;
  background: linear-gradient(16.8deg, rgb(255 216 107 / 0.65) 14.8%, rgb(255 199 69 / 0.65) 85.2%);
  box-shadow:
    0 0 23px 8px rgb(255 200 80 / 0.35),
    inset 0 1px 0 rgb(255 255 255 / 0.5);
}

.plan-card__button:hover,
.wide-plan button:hover {
  filter: brightness(1.08);
}

.info-card {
  position: absolute;
  top: 177px;
  height: 232px;
  overflow: hidden;
  border-radius: 30px;
  background:
    linear-gradient(90deg, rgb(102 56 143 / 0.2), rgb(102 56 143 / 0.2)),
    linear-gradient(180deg, rgb(255 255 255 / 0.011), rgb(255 255 255 / 0.004) 50%, rgb(255 255 255 / 0.005));
  box-shadow:
    0 18px 48px rgb(8 4 22 / 0.45),
    inset 0 1px 0 rgb(255 255 255 / 0.08);
}

.info-card--balance {
  left: 404px;
  width: 415px;
}

.info-card--activity {
  left: 840px;
  width: 422px;
}

.info-card__title {
  position: absolute;
  margin: 0;
  color: #fff;
  font-family: var(--account-ui);
  font-size: 16px;
  font-weight: 400;
  line-height: 19px;
  letter-spacing: 0;
}

.info-card--balance .info-card__title {
  left: 58px;
  top: 25px;
}

.info-card--activity .info-card__title {
  left: 56px;
  top: 27px;
}

.info-card__balance {
  position: absolute;
  left: 26px;
  top: 55px;
  margin: 0;
  background: linear-gradient(180deg, #fde68a 0%, #f59e0b 100%);
  background-clip: text;
  color: transparent;
  font-family: var(--account-display);
  font-size: 40px;
  font-weight: 400;
  font-variation-settings: 'YEAR' 1979;
  line-height: 53px;
  letter-spacing: 0;
  -webkit-background-clip: text;
}

.info-card__copy {
  position: absolute;
  left: 26px;
  top: 121px;
  width: 370px;
  margin: 0;
  color: rgb(255 255 255 / 0.6);
  font-family: var(--account-ui);
  font-size: 14px;
  line-height: 1.55;
}

.info-card__divider {
  position: absolute;
  height: 1px;
  background: rgb(255 255 255 / 0.07);
}

.info-card--balance .info-card__divider {
  left: 26px;
  top: 180px;
  width: 370px;
}

.info-card--activity .info-card__divider {
  left: 24px;
  top: 180px;
  width: 374px;
}

.info-card__meta {
  position: absolute;
  margin: 0;
  color: rgb(255 255 255 / 0.45);
  font-family: var(--account-ui);
  font-size: 13px;
  line-height: 16px;
  white-space: nowrap;
}

.info-card--balance .info-card__meta {
  left: 26px;
  top: 196px;
}

.info-card--activity .info-card__meta {
  left: 24px;
  top: 196px;
}

.info-card__link {
  position: absolute;
  padding: 0;
  border: 0;
  background: transparent;
  color: #c084fc;
  cursor: pointer;
  font-family: var(--account-ui);
  font-size: 14px;
  line-height: 17px;
  white-space: nowrap;
}

.info-card__link:hover,
.settings-row__side button:hover {
  color: #d8b4fe;
}

.info-card--balance .info-card__link {
  left: 247px;
  top: 195px;
}

.info-card--activity .info-card__link {
  left: 269px;
  top: 195px;
}

.bolt-icon {
  position: absolute;
  left: 26px;
  top: 24px;
  width: 18px;
  height: 22px;
}

.bolt-icon path {
  fill: #c084fc;
  stroke: rgb(192 132 252 / 0.6);
  stroke-width: 1px;
}

.activity-grid {
  position: absolute;
  left: 24px;
  top: 71px;
  width: 374px;
  display: grid;
  grid-template-columns: 178px 178px;
  gap: 14px 18px;
}

.activity-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.activity-cell span {
  color: rgb(255 255 255 / 0.45);
  font-family: var(--account-ui);
  font-size: 12px;
  line-height: 14px;
  letter-spacing: 0.1em;
}

.activity-cell strong {
  color: #fff;
  font-family: var(--account-ui);
  font-size: 18px;
  font-weight: 400;
  line-height: 21px;
}

.settings-card {
  position: absolute;
  left: 404px;
  width: 858px;
  box-sizing: border-box;
  overflow: hidden;
  border-radius: 30px;
  padding: 8px 28px;
  background:
    linear-gradient(90deg, rgb(102 56 143 / 0.2), rgb(102 56 143 / 0.2)),
    linear-gradient(180deg, rgb(255 255 255 / 0.011), rgb(255 255 255 / 0.004) 50%, rgb(255 255 255 / 0.005));
  box-shadow:
    0 18px 48px rgb(8 4 22 / 0.45),
    inset 0 1px 0 rgb(255 255 255 / 0.08);
}

.settings-card--profile {
  top: 429px;
  height: calc(100% - 429px);
}

.settings-card--full {
  top: 0;
  height: 100%;
}

.settings-row {
  display: flex;
  align-items: center;
  gap: 20px;
  min-height: 64px;
  box-sizing: border-box;
  border-bottom: 1px solid rgb(255 255 255 / 0.06);
}

.settings-card--profile .settings-row,
.settings-card--full .settings-row {
  height: calc((100% - 16px) / 5);
}

.settings-row--last {
  border-bottom: 0;
}

.settings-row__main {
  min-width: 0;
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.settings-row__main h3 {
  margin: 0;
  color: #fff;
  font-family: var(--account-sans);
  font-size: 13px;
  font-weight: 600;
  line-height: 16px;
}

.settings-row__main p {
  margin: 0;
  overflow: hidden;
  color: rgb(255 255 255 / 0.5);
  font-family: var(--account-ui);
  font-size: 12px;
  line-height: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-row__side {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 24px;
  white-space: nowrap;
}

.settings-row__side span {
  color: rgb(255 255 255 / 0.68);
  font-family: var(--account-ui);
  font-size: 13px;
  line-height: 16px;
}

.settings-row__side button {
  padding: 0;
  border: 0;
  background: transparent;
  color: #c084fc;
  cursor: pointer;
  font-family: var(--account-sans);
  font-size: 12px;
  font-weight: 600;
  line-height: 15px;
}

.wide-plan {
  position: absolute;
  left: 404px;
  width: 858px;
  height: 176px;
  box-sizing: border-box;
  overflow: hidden;
  border-width: 4px;
  border-style: solid;
  border-radius: 30px;
}

.wide-plan--basic {
  top: 0;
  border-color: rgb(255 255 255 / 0.82);
  background:
    linear-gradient(90deg, rgb(102 56 143 / 0.08), rgb(102 56 143 / 0.08)),
    linear-gradient(180deg, rgb(255 255 255 / 0.01), rgb(255 255 255 / 0.002) 60%, rgb(255 255 255 / 0.004));
}

.wide-plan--plus {
  top: 198px;
  border-color: #c861ff;
  background:
    linear-gradient(90deg, rgb(102 56 143 / 0.54), rgb(102 56 143 / 0.54)),
    linear-gradient(180deg, rgb(255 255 255 / 0.01), rgb(255 255 255 / 0.002) 60%, rgb(255 255 255 / 0.004));
}

.wide-plan--pro {
  top: 396px;
  border-color: #fbbf24;
  background:
    linear-gradient(90deg, rgb(255 218 68 / 0.12), rgb(255 218 68 / 0.12)),
    linear-gradient(180deg, rgb(255 255 255 / 0.05), rgb(255 255 255 / 0.012) 60%, rgb(255 255 255 / 0.02));
  box-shadow:
    0 22px 56px rgb(8 4 22 / 0.55),
    0 0 36px rgb(255 200 80 / 0.18),
    inset 0 1px 0 rgb(255 255 255 / 0.1);
}

.wide-plan h2 {
  position: absolute;
  left: 38px;
  top: 62px;
  margin: 0;
  color: #fff;
  font-family: var(--account-display);
  font-size: 36px;
  font-weight: 400;
  font-variation-settings: 'YEAR' 1979;
  line-height: 42px;
  letter-spacing: 0;
  text-shadow: -1px 3px 4px rgb(200 97 255 / 0.75);
}

.wide-plan--pro h2 {
  left: 50px;
  top: 68px;
  text-shadow: -1px 3px 4px #ffda44;
}

.wide-plan__crown {
  position: absolute;
  left: 137px;
  top: 14px;
  width: 65px;
  height: 61px;
  transform: rotate(35.57deg) skewX(-0.36deg);
}

.wide-plan ul {
  position: absolute;
  left: 268px;
  top: 50%;
  width: 380px;
  margin: 0;
  padding: 0;
  list-style: none;
  color: rgb(255 255 255 / 0.94);
  font-family: var(--account-ui);
  font-size: 14px;
  line-height: 21px;
  transform: translateY(-50%);
}

.wide-plan--basic ul {
  left: 268px;
}

.wide-plan--pro ul {
  top: 50%;
}

.wide-plan li {
  position: relative;
  padding-left: 24px;
}

.wide-plan li span {
  position: absolute;
  left: 0;
  top: 7px;
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: currentColor;
}

.wide-plan--plus li span {
  top: 3px;
  width: 16px;
  height: 17px;
  border-radius: 0;
  background: #c861ff;
  clip-path: polygon(45% 0, 100% 0, 60% 45%, 100% 45%, 30% 100%, 50% 55%, 0 55%);
}

.wide-plan--pro li span {
  top: 5px;
  width: 18px;
  height: 13px;
  border-radius: 0;
  background: linear-gradient(135deg, #fde68a, #f59e0b);
  clip-path: polygon(4% 30%, 25% 60%, 50% 12%, 75% 60%, 96% 30%, 88% 100%, 12% 100%);
}

.wide-plan__currency {
  position: absolute;
  left: 666px;
  top: 34px;
  color: #c861ff;
  font-family: 'Coda Caption', 'Noto Sans', sans-serif;
  font-size: 40px;
  font-weight: 800;
  line-height: 42px;
}

.wide-plan--basic .wide-plan__currency {
  top: 59px;
  color: #f3ddff;
}

.wide-plan--pro .wide-plan__currency {
  left: 671px;
  top: 34px;
  color: #ffbe33;
}

.wide-plan__old {
  position: absolute;
  left: 700px;
  top: 30px;
  color: rgb(255 255 255 / 0.46);
  font-family: 'Marhey', var(--account-ui);
  font-size: 16px;
  font-weight: 300;
  line-height: 32px;
}

.wide-plan--pro .wide-plan__old {
  left: 705px;
  top: 30px;
}

.wide-plan__strike {
  position: absolute;
  left: 695px;
  top: 44px;
  width: 42px;
  height: 1px;
  background: rgb(255 255 255 / 0.54);
}

.wide-plan--pro .wide-plan__strike {
  left: 700px;
  top: 44px;
}

.wide-plan__price {
  position: absolute;
  left: 696px;
  top: 51px;
  color: #fff;
  font-family: var(--account-ui);
  font-size: 20px;
  line-height: 32px;
  white-space: nowrap;
}

.wide-plan--basic .wide-plan__price {
  top: 69px;
}

.wide-plan--pro .wide-plan__price {
  left: 701px;
  top: 51px;
}

.wide-plan__price strong {
  font-family: 'Marhey', var(--account-ui);
  font-weight: 300;
}

.wide-plan button {
  position: absolute;
  left: 658px;
  top: 87px;
  width: 169px;
  height: 51px;
  border: 2px solid #c861ff;
  border-radius: 28px;
  background: linear-gradient(16.8deg, rgb(192 132 252 / 0.65) 14.8%, rgb(200 97 255 / 0.65) 85.2%);
  color: #fff;
  cursor: pointer;
  font-family: var(--account-display);
  font-size: 16px;
  font-weight: 400;
  font-variation-settings: 'YEAR' 1979;
  line-height: 21px;
  box-shadow:
    0 0 22px 8px rgb(200 97 255 / 0.46),
    inset 0 1px 0 rgb(255 255 255 / 0.5);
}

.wide-plan--pro button {
  left: 662px;
  top: 87px;
  border-color: #ffda44;
  background: linear-gradient(16.8deg, rgb(255 216 107 / 0.65) 14.8%, rgb(255 199 69 / 0.65) 85.2%);
  box-shadow:
    0 0 23px 8px rgb(255 200 80 / 0.35),
    inset 0 1px 0 rgb(255 255 255 / 0.5);
}

@media (max-width: 1320px) {
  .account-page {
    --account-content-gap: clamp(14px, 2vw, 18px);
    height: auto;
    min-height: 100svh;
    align-items: center;
    justify-content: flex-start;
    padding: 0 clamp(12px, 2vw, 20px) var(--account-content-gap);
    overflow-x: hidden;
  }

  .account-frame {
    width: min(100%, 1280px);
    height: auto;
    min-height: 0;
    display: grid;
    grid-template-columns: 358px minmax(0, 1fr) minmax(0, 1fr);
    gap: 20px;
    overflow: visible;
    border-radius: 0;
  }

  .account-frame > * {
    min-width: 0;
  }

  .account-rail,
  .plan-card,
  .info-card,
  .settings-card,
  .wide-plan {
    position: relative;
    left: auto;
    top: auto;
    width: 100%;
    box-sizing: border-box;
  }

  .account-rail {
    grid-column: 1;
    grid-row: 1 / span 3;
    height: auto;
    min-height: 765px;
  }

  .plan-card--plus {
    grid-column: 2;
    grid-row: 1;
  }

  .plan-card--pro {
    grid-column: 3;
    grid-row: 1;
  }

  .info-card--balance {
    grid-column: 2;
    grid-row: 2;
  }

  .info-card--activity {
    grid-column: 3;
    grid-row: 2;
  }

  .settings-card--profile {
    grid-column: 2 / 4;
    grid-row: 3;
    height: auto;
    min-height: 336px;
  }

  .settings-card--full {
    grid-column: 2 / 4;
    grid-row: 1 / span 3;
    height: auto;
    min-height: 560px;
  }

  .wide-plan {
    grid-column: 2 / 4;
  }

  .wide-plan--basic {
    grid-row: 1;
  }

  .wide-plan--plus {
    grid-row: 2;
  }

  .wide-plan--pro {
    grid-row: 3;
  }
}

@media (max-width: 1240px) {
  .account-frame {
    max-width: 980px;
    grid-template-columns: minmax(318px, 358px) minmax(0, 1fr);
  }

  .account-rail {
    grid-column: 1;
    grid-row: 1 / span 5;
  }

  .plan-card--plus,
  .plan-card--pro,
  .info-card--balance,
  .info-card--activity,
  .settings-card--profile,
  .settings-card--full,
  .wide-plan {
    grid-column: 2;
  }

  .plan-card--plus,
  .wide-plan--basic {
    grid-row: 1;
  }

  .plan-card--pro,
  .wide-plan--plus {
    grid-row: 2;
  }

  .info-card--balance,
  .wide-plan--pro {
    grid-row: 3;
  }

  .info-card--activity {
    grid-row: 4;
  }

  .settings-card--profile,
  .settings-card--full {
    grid-row: 5;
  }

  .settings-card--full {
    grid-row: 1 / span 5;
    min-height: 520px;
  }

  .wide-plan {
    height: auto;
    min-height: 176px;
    display: grid;
    grid-template-columns: minmax(150px, 190px) minmax(0, 1fr) minmax(150px, 170px);
    grid-template-rows: repeat(3, auto);
    align-items: center;
    column-gap: 18px;
    padding: 24px 28px;
  }

  .wide-plan h2,
  .wide-plan ul,
  .wide-plan__currency,
  .wide-plan__old,
  .wide-plan__strike,
  .wide-plan__price,
  .wide-plan button {
    position: static;
    left: auto;
    top: auto;
    width: auto;
    height: auto;
    transform: none;
  }

  .wide-plan h2 {
    grid-column: 1;
    grid-row: 1 / 4;
    align-self: center;
    line-height: 1;
  }

  .wide-plan__crown {
    left: 120px;
    top: 20px;
    width: 52px;
    height: 40px;
  }

  .wide-plan ul {
    grid-column: 2;
    grid-row: 1 / 4;
    align-self: center;
    font-size: 14px;
    line-height: 1.45;
  }

  .wide-plan__currency {
    grid-column: 3;
    grid-row: 1;
    align-self: end;
    justify-self: start;
    min-width: 150px;
    font-size: 32px;
    line-height: 1;
  }

  .wide-plan__old {
    grid-column: 3;
    grid-row: 1;
    align-self: start;
    justify-self: end;
    min-width: 150px;
    text-align: right;
    text-decoration: line-through;
  }

  .wide-plan__strike {
    display: none;
  }

  .wide-plan__price {
    grid-column: 3;
    grid-row: 2;
    justify-self: end;
    min-width: 150px;
    line-height: 1.35;
    text-align: right;
  }

  .wide-plan button {
    grid-column: 3;
    grid-row: 3;
    width: 100%;
    min-height: 44px;
    margin-top: 10px;
  }
}

@media (max-width: 860px) {
  .account-frame {
    max-width: 640px;
    grid-template-columns: minmax(0, 1fr);
  }

  .account-rail,
  .plan-card--plus,
  .plan-card--pro,
  .info-card--balance,
  .info-card--activity,
  .settings-card--profile,
  .settings-card--full,
  .wide-plan {
    grid-column: 1;
  }

  .account-rail {
    grid-row: 1;
    justify-self: center;
    width: min(358px, 100%);
    min-height: 765px;
  }

  .plan-card--plus,
  .wide-plan--basic,
  .settings-card--full {
    grid-row: 2;
  }

  .plan-card--pro,
  .wide-plan--plus {
    grid-row: 3;
  }

  .info-card--balance,
  .wide-plan--pro {
    grid-row: 4;
  }

  .info-card--activity {
    grid-row: 5;
  }

  .settings-card--profile {
    grid-row: 6;
  }
}

@media (min-width: 561px) and (max-width: 860px) {
  .plan-card {
    height: auto;
    min-height: 142px;
    display: grid;
    grid-template-columns: minmax(145px, 1fr) minmax(196px, auto);
    grid-template-rows: auto auto;
    align-items: center;
    gap: 8px 18px;
    padding: 24px 34px;
  }

  .plan-card__name,
  .plan-card__currency,
  .plan-card__old,
  .plan-card__strike,
  .plan-card__price,
  .plan-card__button {
    position: static;
    left: auto;
    top: auto;
    height: auto;
    transform: none;
  }

  .plan-card__name {
    grid-column: 1;
    grid-row: 1 / 3;
    align-self: center;
    line-height: 1;
  }

  .plan-card__crown {
    left: 116px;
    top: 16px;
    width: 54px;
    height: 42px;
  }

  .plan-card__currency {
    grid-column: 2;
    grid-row: 1;
    justify-self: end;
    align-self: end;
    width: 196px;
    font-size: 38px;
    line-height: 1;
  }

  .plan-card__old {
    grid-column: 2;
    grid-row: 1;
    justify-self: end;
    align-self: start;
    width: 156px;
    text-align: left;
    text-decoration: line-through;
  }

  .plan-card__strike {
    display: none;
  }

  .plan-card__price {
    grid-column: 2;
    grid-row: 1;
    justify-self: end;
    align-self: end;
    width: 156px;
    font-size: 20px;
    line-height: 1.35;
    text-align: left;
  }

  .plan-card__button {
    grid-column: 2;
    grid-row: 2;
    justify-self: end;
    width: 169px;
    min-height: 48px;
  }

  .info-card {
    height: auto;
    min-height: 208px;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px 10px;
    padding: 24px 34px 20px;
  }

  .account-balance-coin,
  .bolt-icon,
  .info-card__title,
  .info-card__balance,
  .info-card__copy,
  .info-card__divider,
  .info-card__meta,
  .info-card__link,
  .activity-grid {
    position: static;
    left: auto;
    top: auto;
    width: auto;
    height: auto;
  }

  .account-balance-coin {
    width: 26px;
    height: 26px;
  }

  .bolt-icon {
    width: 18px;
    height: 22px;
  }

  .info-card__title {
    grid-column: 2 / -1;
    align-self: center;
  }

  .info-card__balance,
  .info-card__copy,
  .info-card__divider,
  .activity-grid {
    grid-column: 1 / -1;
  }

  .info-card__balance {
    line-height: 1.15;
  }

  .info-card__copy {
    width: 100%;
    max-width: none;
    line-height: 1.55;
  }

  .info-card__divider {
    width: 100%;
  }

  .info-card__meta {
    grid-column: 1 / 3;
    min-width: 0;
    white-space: normal;
  }

  .info-card__link {
    grid-column: 3;
    justify-self: end;
    text-align: right;
    white-space: normal;
  }

  .activity-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px 18px;
  }
}

@media (max-width: 560px) {
  .account-page {
    --account-content-gap: 14px;
    padding-inline: clamp(10px, 3.2vw, 14px);
  }

  .account-frame {
    gap: 14px;
  }

  .account-rail {
    width: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 20px;
    overflow: hidden;
    border-radius: 24px;
  }

  .account-avatar,
  .account-rail__name,
  .account-chips,
  .account-stream,
  .account-rail__divider,
  .account-nav,
  .account-logout {
    position: static;
    left: auto;
    top: auto;
    right: auto;
    bottom: auto;
    width: 100%;
  }

  .account-avatar {
    position: relative;
    width: 72px;
    height: 72px;
    flex: 0 0 auto;
  }

  .account-avatar__inner {
    inset: 2px;
    width: auto;
    height: auto;
  }

  .account-rail__name {
    line-height: 1.25;
    text-align: center;
  }

  .account-chips {
    height: auto;
    flex-wrap: wrap;
    align-items: center;
  }

  .account-stream {
    height: auto;
    display: grid;
    gap: 12px;
    padding: 14px;
    border-radius: 22px;
  }

  .account-stream__head,
  .account-stream__stats,
  .account-stream__button {
    position: static;
    width: auto;
    height: auto;
  }

  .account-stream__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: 12px;
  }

  .account-stream__cell,
  .account-stream__cell + .account-stream__cell {
    padding-left: 0;
  }

  .account-stream__button {
    min-height: 34px;
  }

  .account-rail__divider {
    height: 1px;
  }

  .account-nav {
    height: auto;
    display: grid;
    gap: 2px;
    overflow: visible;
  }

  .account-nav__active {
    display: none;
  }

  .account-nav__item {
    position: relative;
    top: auto;
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    height: 41px;
    padding: 0 12px;
    border-radius: 20px;
  }

  .account-nav__item.is-active:not(.is-disabled) {
    border: 1px solid rgb(124 58 237 / 0.42);
    background: linear-gradient(180deg, rgb(124 58 237 / 0.22), rgb(124 58 237 / 0.1));
  }

  .account-nav__item span:last-child,
  .account-nav__item:nth-of-type(1) span:last-child,
  .account-nav__item--settings span:last-child,
  .account-nav__item--security span:last-child,
  .account-nav__item--wallet span:last-child,
  .account-nav__item--stream span:last-child,
  .account-nav__icon,
  .account-nav__icon--dot {
    position: static;
    left: auto;
    top: auto;
  }

  .account-nav__icon,
  .account-nav__icon--dot {
    width: 15px;
    height: 15px;
    flex: 0 0 auto;
  }

  .account-nav__icon--dot {
    font-size: 13px;
    line-height: 15px;
  }

  .account-logout {
    height: 40px;
    margin-top: 2px;
  }

  .account-rail--compact .account-rail__divider,
  .account-rail--compact .account-nav {
    top: auto;
  }

  .plan-card,
  .info-card,
  .settings-card,
  .wide-plan {
    border-radius: 24px;
  }

  .plan-card {
    height: auto;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px 14px;
    padding: 22px;
  }

  .plan-card__name,
  .plan-card__currency,
  .plan-card__old,
  .plan-card__strike,
  .plan-card__price,
  .plan-card__button {
    position: static;
    left: auto;
    top: auto;
    width: auto;
    height: auto;
  }

  .plan-card__name {
    grid-column: 1;
    grid-row: 1 / 3;
    align-self: center;
    line-height: 1;
  }

  .plan-card__crown {
    left: 92px;
    top: 15px;
    width: 48px;
    height: 36px;
  }

  .plan-card__currency {
    grid-column: 2;
    grid-row: 2;
    align-self: center;
    justify-self: start;
    min-width: 136px;
    font-size: 28px;
    line-height: 1;
  }

  .plan-card__old {
    grid-column: 2;
    grid-row: 1;
    align-self: start;
    justify-self: end;
    min-width: 136px;
    text-align: right;
    text-decoration: line-through;
  }

  .plan-card__strike {
    display: none;
  }

  .plan-card__price {
    grid-column: 2;
    grid-row: 2;
    justify-self: end;
    min-width: 136px;
    font-size: 18px;
    line-height: 1.35;
    text-align: right;
  }

  .plan-card__button {
    grid-column: 1 / -1;
    grid-row: 3;
    width: 100%;
    min-height: 48px;
    margin-top: 8px;
  }

  .info-card {
    height: auto;
    min-height: 0;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 12px 10px;
    padding: 22px;
  }

  .account-balance-coin,
  .bolt-icon,
  .info-card__title,
  .info-card__balance,
  .info-card__copy,
  .info-card__divider,
  .info-card__meta,
  .info-card__link,
  .activity-grid {
    position: static;
    left: auto;
    top: auto;
    width: auto;
    height: auto;
  }

  .account-balance-coin,
  .bolt-icon {
    align-self: center;
  }

  .account-balance-coin {
    width: 26px;
    height: 26px;
  }

  .bolt-icon {
    width: 18px;
    height: 22px;
  }

  .info-card__title {
    align-self: center;
  }

  .info-card__balance,
  .info-card__copy,
  .info-card__divider,
  .activity-grid {
    grid-column: 1 / -1;
  }

  .info-card__balance {
    font-size: clamp(32px, 10vw, 40px);
    line-height: 1.15;
  }

  .info-card__copy {
    line-height: 1.5;
  }

  .info-card__divider {
    width: 100%;
    margin-top: 2px;
  }

  .info-card__meta {
    white-space: normal;
  }

  .info-card__link {
    justify-self: end;
    text-align: right;
    white-space: normal;
  }

  .activity-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .settings-card {
    height: auto;
    min-height: 0;
    padding: 10px 18px;
    overflow: hidden;
  }

  .settings-card--profile,
  .settings-card--full {
    height: auto;
    min-height: 0;
  }

  .settings-row,
  .settings-card--profile .settings-row,
  .settings-card--full .settings-row {
    height: auto;
    min-height: 0;
    align-items: flex-start;
    padding: 14px 0;
  }

  .settings-row {
    flex-direction: column;
    gap: 8px;
  }

  .settings-row__main p {
    white-space: normal;
    line-height: 1.35;
  }

  .settings-row__side {
    width: 100%;
    justify-content: space-between;
    gap: 12px;
    white-space: normal;
  }

  .settings-row__side span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .settings-row__side button {
    flex: 0 0 auto;
  }

  .wide-plan {
    height: auto;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 14px;
    padding: 22px;
  }

  .wide-plan h2,
  .wide-plan ul,
  .wide-plan__currency,
  .wide-plan__old,
  .wide-plan__strike,
  .wide-plan__price,
  .wide-plan button {
    position: static;
    left: auto;
    top: auto;
    width: auto;
    height: auto;
    transform: none;
  }

  .wide-plan h2 {
    line-height: 1;
  }

  .wide-plan__crown {
    left: 104px;
    top: 14px;
    width: 48px;
    height: 36px;
  }

  .wide-plan ul {
    font-size: 14px;
    line-height: 1.45;
  }

  .wide-plan__old {
    text-decoration: line-through;
  }

  .wide-plan__strike {
    display: none;
  }

  .wide-plan button {
    width: 100%;
    min-height: 48px;
  }
}

@media (max-width: 380px) {
  .activity-grid,
  .account-stream__stats {
    grid-template-columns: minmax(0, 1fr);
  }

  .plan-card,
  .info-card,
  .settings-card,
  .wide-plan,
  .account-rail {
    border-radius: 20px;
  }
}
</style>
