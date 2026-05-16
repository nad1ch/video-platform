/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, onMounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuth } from '@/composables/useAuth';
import { refreshBillingConfig, useBillingConfig } from '@/composables/useBillingConfig';
import { useProSubscription } from '@/composables/useProSubscription';
import { useCoinHubStore } from '@/stores/coinHub';
import AppLandingHeader from '@/pages/app/components/AppHeader.vue';
import LandingCloudBackdrop from '@/components/ui/LandingCloudBackdrop.vue';
import coinIcon from '@/assets/landing/coin-streamassist.png';
import mafiaHeaderLogo from '@/assets/mafia/ui/header-logo.svg';
import mafiaHeaderSettingsIcon from '@/assets/mafia/ui/header-settings.svg';
const auth = useAuth();
const router = useRouter();
const { locale } = useI18n();
const { refreshSubscription, isProActive: isProActiveSubscription, expiresAt: proExpiresAt, billingEmail: subscriptionBillingEmail, } = useProSubscription();
const billingConfig = useBillingConfig();
/** Strikethrough anchor for Pro marketing; must match `BillingPage.vue`. */
const PRO_OLD_PRICE_LABEL = '599';
const coinHub = useCoinHubStore();
const { balance: coinBalance } = storeToRefs(coinHub);
const activeTab = ref('profile');
const accountHeaderBrand = 'Stream Assist';
const accountHeaderTitle = 'ACCOUNT';
const headerCoinHubRoute = { name: 'coin-hub' };
const accountRouteTo = { name: 'account' };
const proHeaderLinkTo = { name: 'billing' };
const user = computed(() => auth.user.value);
const isHeaderAuthLoading = computed(() => !auth.loaded.value);
const isAuthenticated = computed(() => auth.isAuthenticated.value);
const streamer = computed(() => user.value?.streamer ?? null);
const displayName = computed(() => {
    const trimmed = user.value?.displayName?.trim();
    if (trimmed)
        return trimmed;
    const twitch = streamer.value?.username?.trim();
    if (twitch)
        return twitch;
    return '—';
});
const headerUserAvatar = computed(() => user.value?.avatar ?? '');
const userInitial = computed(() => {
    const raw = displayName.value.trim();
    if (!raw || raw === '—')
        return '?';
    return raw[0].toUpperCase();
});
const settingsBillingEmailLabel = computed(() => {
    const fromApi = subscriptionBillingEmail.value?.trim();
    if (fromApi)
        return fromApi;
    return 'Не вказано';
});
const proPriceAmount = computed(() => billingConfig.config.value?.amountUah ?? null);
const proPriceDurationLabel = computed(() => {
    const days = billingConfig.config.value?.durationDays;
    if (!days)
        return null;
    if (days === 30)
        return 'місяць';
    return `${days} днів`;
});
const isProPricingUnavailable = computed(() => !billingConfig.loading.value && !billingConfig.isReady.value);
const isEmailVerified = computed(() => user.value?.emailVerified === true);
const providerKind = computed(() => user.value?.provider ?? (user.value == null ? 'twitch' : null));
const hasStreamerProfile = computed(() => user.value == null ||
    Boolean(streamer.value) ||
    user.value?.roles?.includes('STREAMER') === true ||
    providerKind.value === 'twitch');
const providerLabel = computed(() => {
    switch (providerKind.value) {
        case 'twitch':
            return 'Twitch';
        case 'google':
            return 'Google';
        case 'apple':
            return 'Apple';
        case 'email':
            return 'Email';
        default:
            return 'Email';
    }
});
const streamHandle = computed(() => streamer.value?.username || displayName.value);
const streamTier = computed(() => {
    const tier = streamer.value?.tier || streamer.value?.broadcasterType;
    if (!tier)
        return 'Affiliate';
    return tier[0]?.toUpperCase() + tier.slice(1);
});
const streamFollowersLabel = computed(() => new Intl.NumberFormat('uk-UA').format(streamer.value?.followersCount ?? 12345));
const avgOnlineLabel = computed(() => streamer.value?.avgOnline7d ?? 102);
const coinBalanceLabel = computed(() => new Intl.NumberFormat('uk-UA').format(coinBalance.value));
const headerCoinBalanceLabel = computed(() => (isAuthenticated.value ? coinBalanceLabel.value : '—'));
const accountProfileTo = computed(() => user.value?.role === 'admin' ? { name: 'admin-users' } : undefined);
const proHeaderLabel = computed(() => {
    const iso = proExpiresAt.value;
    if (!iso)
        return 'StreamAssist Pro';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime()))
        return 'StreamAssist Pro';
    const formatted = date.toLocaleDateString(locale.value, {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });
    return `StreamAssist Pro · до ${formatted}`;
});
const activeNavTop = computed(() => {
    if (activeTab.value === 'subscription')
        return 59;
    if (activeTab.value === 'settings')
        return 102;
    return 16;
});
const settingsRows = computed(() => [
    {
        label: 'Email для рахунків',
        sub: 'сповіщення про оплати й продовження підписки',
        value: settingsBillingEmailLabel.value,
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
]);
const basicFeatures = ['3 години відеодзвінків', 'Закриті ігри', 'Підтримка'];
const plusFeatures = ['12 годин відеодзвінків', 'OBS оверлеї', 'Усі ігри та режими', 'Пріоритетна підтримка'];
const proFeatures = [
    'Безлімітні відеодзвінки',
    'OBS оверлеї',
    'Усі ігри та режими',
    'Розширений набір ігрових інструментів стрімера',
    'Пріоритетна підтримка',
];
function setTab(tab) {
    activeTab.value = tab;
}
async function onLogout() {
    await auth.logout();
}
function onHeaderLogin() {
    void router.push({
        name: 'auth',
        query: { redirect: '/app/account', mode: 'login' },
    });
}
function onPlanCta(plan) {
    if (plan === 'basic')
        return;
    void router.push({ name: 'billing' });
}
function onOpenStream() {
    void router.push({ name: 'nadle-streamer', params: { streamer: streamHandle.value } });
}
onMounted(() => {
    void refreshSubscription();
    void refreshBillingConfig();
    void coinHub.loadSnapshot({ background: true });
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['account-mafia-settings']} */ ;
/** @type {__VLS_StyleScopedClasses['account-mafia-settings']} */ ;
/** @type {__VLS_StyleScopedClasses['account-avatar__inner']} */ ;
/** @type {__VLS_StyleScopedClasses['account-stream__cell']} */ ;
/** @type {__VLS_StyleScopedClasses['account-stream__cell']} */ ;
/** @type {__VLS_StyleScopedClasses['account-stream__button']} */ ;
/** @type {__VLS_StyleScopedClasses['account-nav__item']} */ ;
/** @type {__VLS_StyleScopedClasses['account-nav__item']} */ ;
/** @type {__VLS_StyleScopedClasses['is-disabled']} */ ;
/** @type {__VLS_StyleScopedClasses['account-nav__item']} */ ;
/** @type {__VLS_StyleScopedClasses['account-nav__item']} */ ;
/** @type {__VLS_StyleScopedClasses['account-nav__item']} */ ;
/** @type {__VLS_StyleScopedClasses['account-nav__item--settings']} */ ;
/** @type {__VLS_StyleScopedClasses['account-nav__item--security']} */ ;
/** @type {__VLS_StyleScopedClasses['account-nav__item--wallet']} */ ;
/** @type {__VLS_StyleScopedClasses['account-nav__item--stream']} */ ;
/** @type {__VLS_StyleScopedClasses['account-nav__icon']} */ ;
/** @type {__VLS_StyleScopedClasses['account-nav__icon']} */ ;
/** @type {__VLS_StyleScopedClasses['account-logout']} */ ;
/** @type {__VLS_StyleScopedClasses['account-rail__divider']} */ ;
/** @type {__VLS_StyleScopedClasses['account-rail--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['account-nav']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card--plus']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card__name']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card__name']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card__crown']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card__crown']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan__crown']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card--plus']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card__currency']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card__currency']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card__price']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card__price-loading']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card--plus']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card__button']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card__button']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card__button']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card--balance']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__title']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card--activity']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__title']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card--balance']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__divider']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card--activity']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__divider']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card--balance']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__meta']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card--activity']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__meta']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__link']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card--balance']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__link']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card--activity']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__link']} */ ;
/** @type {__VLS_StyleScopedClasses['bolt-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['bolt-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['activity-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['activity-cell']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-card--profile']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-row']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-card--full']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-row']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-row__main']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-row__main']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-row__side']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-row__side']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-row__side']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan__crown']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan--basic']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan--plus']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan--basic']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan__currency']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan__currency']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan__old']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan__strike']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan--basic']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan__price']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan__price']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan__price']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan__price-loading']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['account-page']} */ ;
/** @type {__VLS_StyleScopedClasses['account-frame']} */ ;
/** @type {__VLS_StyleScopedClasses['account-frame']} */ ;
/** @type {__VLS_StyleScopedClasses['account-rail']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-card']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan']} */ ;
/** @type {__VLS_StyleScopedClasses['account-rail']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card--plus']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card--balance']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card--activity']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-card--profile']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-card--full']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan--basic']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan--plus']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['account-frame']} */ ;
/** @type {__VLS_StyleScopedClasses['account-rail']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card--plus']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card--balance']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card--activity']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-card--profile']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-card--full']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card--plus']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan--basic']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan--plus']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card--balance']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card--activity']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-card--profile']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-card--full']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-card--full']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan__currency']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan__old']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan__strike']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan__price']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan__crown']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan__currency']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan__old']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan__strike']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan__price']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan']} */ ;
/** @type {__VLS_StyleScopedClasses['account-frame']} */ ;
/** @type {__VLS_StyleScopedClasses['account-rail']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card--plus']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card--balance']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card--activity']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-card--profile']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-card--full']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan']} */ ;
/** @type {__VLS_StyleScopedClasses['account-rail']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card--plus']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan--basic']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-card--full']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan--plus']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card--balance']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan--pro']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card--activity']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-card--profile']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card__name']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card__currency']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card__old']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card__strike']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card__price']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card__button']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card__name']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card__crown']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card__currency']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card__old']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card__strike']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card__price']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card__button']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card']} */ ;
/** @type {__VLS_StyleScopedClasses['account-balance-coin']} */ ;
/** @type {__VLS_StyleScopedClasses['bolt-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__title']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__balance']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__copy']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__divider']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__meta']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__link']} */ ;
/** @type {__VLS_StyleScopedClasses['activity-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['account-balance-coin']} */ ;
/** @type {__VLS_StyleScopedClasses['bolt-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__title']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__balance']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__copy']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__divider']} */ ;
/** @type {__VLS_StyleScopedClasses['activity-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__balance']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__copy']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__divider']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__meta']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__link']} */ ;
/** @type {__VLS_StyleScopedClasses['activity-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['account-page']} */ ;
/** @type {__VLS_StyleScopedClasses['account-frame']} */ ;
/** @type {__VLS_StyleScopedClasses['account-rail']} */ ;
/** @type {__VLS_StyleScopedClasses['account-avatar']} */ ;
/** @type {__VLS_StyleScopedClasses['account-rail__name']} */ ;
/** @type {__VLS_StyleScopedClasses['account-chips']} */ ;
/** @type {__VLS_StyleScopedClasses['account-stream']} */ ;
/** @type {__VLS_StyleScopedClasses['account-rail__divider']} */ ;
/** @type {__VLS_StyleScopedClasses['account-nav']} */ ;
/** @type {__VLS_StyleScopedClasses['account-logout']} */ ;
/** @type {__VLS_StyleScopedClasses['account-avatar']} */ ;
/** @type {__VLS_StyleScopedClasses['account-avatar__inner']} */ ;
/** @type {__VLS_StyleScopedClasses['account-rail__name']} */ ;
/** @type {__VLS_StyleScopedClasses['account-chips']} */ ;
/** @type {__VLS_StyleScopedClasses['account-stream']} */ ;
/** @type {__VLS_StyleScopedClasses['account-stream__head']} */ ;
/** @type {__VLS_StyleScopedClasses['account-stream__stats']} */ ;
/** @type {__VLS_StyleScopedClasses['account-stream__button']} */ ;
/** @type {__VLS_StyleScopedClasses['account-stream__stats']} */ ;
/** @type {__VLS_StyleScopedClasses['account-stream__cell']} */ ;
/** @type {__VLS_StyleScopedClasses['account-stream__cell']} */ ;
/** @type {__VLS_StyleScopedClasses['account-stream__cell']} */ ;
/** @type {__VLS_StyleScopedClasses['account-stream__button']} */ ;
/** @type {__VLS_StyleScopedClasses['account-rail__divider']} */ ;
/** @type {__VLS_StyleScopedClasses['account-nav']} */ ;
/** @type {__VLS_StyleScopedClasses['account-nav__active']} */ ;
/** @type {__VLS_StyleScopedClasses['account-nav__item']} */ ;
/** @type {__VLS_StyleScopedClasses['account-nav__item']} */ ;
/** @type {__VLS_StyleScopedClasses['is-disabled']} */ ;
/** @type {__VLS_StyleScopedClasses['account-nav__item']} */ ;
/** @type {__VLS_StyleScopedClasses['account-nav__item']} */ ;
/** @type {__VLS_StyleScopedClasses['account-nav__item--settings']} */ ;
/** @type {__VLS_StyleScopedClasses['account-nav__item--security']} */ ;
/** @type {__VLS_StyleScopedClasses['account-nav__item--wallet']} */ ;
/** @type {__VLS_StyleScopedClasses['account-nav__item--stream']} */ ;
/** @type {__VLS_StyleScopedClasses['account-nav__icon']} */ ;
/** @type {__VLS_StyleScopedClasses['account-nav__icon--dot']} */ ;
/** @type {__VLS_StyleScopedClasses['account-nav__icon']} */ ;
/** @type {__VLS_StyleScopedClasses['account-nav__icon--dot']} */ ;
/** @type {__VLS_StyleScopedClasses['account-nav__icon--dot']} */ ;
/** @type {__VLS_StyleScopedClasses['account-logout']} */ ;
/** @type {__VLS_StyleScopedClasses['account-rail--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['account-rail__divider']} */ ;
/** @type {__VLS_StyleScopedClasses['account-rail--compact']} */ ;
/** @type {__VLS_StyleScopedClasses['account-nav']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-card']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card__name']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card__currency']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card__old']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card__strike']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card__price']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card__button']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card__name']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card__crown']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card__currency']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card__old']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card__strike']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card__price']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card__button']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card']} */ ;
/** @type {__VLS_StyleScopedClasses['account-balance-coin']} */ ;
/** @type {__VLS_StyleScopedClasses['bolt-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__title']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__balance']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__copy']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__divider']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__meta']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__link']} */ ;
/** @type {__VLS_StyleScopedClasses['activity-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['account-balance-coin']} */ ;
/** @type {__VLS_StyleScopedClasses['bolt-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['account-balance-coin']} */ ;
/** @type {__VLS_StyleScopedClasses['bolt-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__title']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__balance']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__copy']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__divider']} */ ;
/** @type {__VLS_StyleScopedClasses['activity-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__balance']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__copy']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__divider']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__meta']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card__link']} */ ;
/** @type {__VLS_StyleScopedClasses['activity-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-card']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-card--profile']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-card--full']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-row']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-card--profile']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-row']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-card--full']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-row']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-row']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-row__main']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-row__side']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-row__side']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-row__side']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan__currency']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan__old']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan__strike']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan__price']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan__crown']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan__old']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan__strike']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan']} */ ;
/** @type {__VLS_StyleScopedClasses['activity-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['account-stream__stats']} */ ;
/** @type {__VLS_StyleScopedClasses['plan-card']} */ ;
/** @type {__VLS_StyleScopedClasses['info-card']} */ ;
/** @type {__VLS_StyleScopedClasses['settings-card']} */ ;
/** @type {__VLS_StyleScopedClasses['wide-plan']} */ ;
/** @type {__VLS_StyleScopedClasses['account-rail']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.main, __VLS_intrinsics.main)({
    ...{ class: "account-page" },
});
/** @type {__VLS_StyleScopedClasses['account-page']} */ ;
const __VLS_0 = LandingCloudBackdrop;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    ...{ class: "account-cloud-backdrop" },
    variant: "app",
    active: (true),
}));
const __VLS_2 = __VLS_1({
    ...{ class: "account-cloud-backdrop" },
    variant: "app",
    active: (true),
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['account-cloud-backdrop']} */ ;
const __VLS_5 = AppLandingHeader || AppLandingHeader;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    ...{ 'onLogin': {} },
    ...{ 'onLogout': {} },
    ...{ class: "account-shared-header" },
    authLoading: (__VLS_ctx.isHeaderAuthLoading),
    brandName: (__VLS_ctx.accountHeaderBrand),
    coinBalanceLabel: (__VLS_ctx.headerCoinBalanceLabel),
    compact: (true),
    coinHubTo: (__VLS_ctx.headerCoinHubRoute),
    isAuthenticated: (__VLS_ctx.isAuthenticated),
    isProActive: (__VLS_ctx.isProActiveSubscription),
    logoSrc: (__VLS_ctx.mafiaHeaderLogo),
    mafiaMode: (true),
    profileTo: (__VLS_ctx.accountProfileTo),
    accountTo: (__VLS_ctx.accountRouteTo),
    proLinkTo: (__VLS_ctx.proHeaderLinkTo),
    proLabel: (__VLS_ctx.proHeaderLabel),
    showAuth: (true),
    showCoin: (false),
    title: (__VLS_ctx.accountHeaderTitle),
    userAvatar: (__VLS_ctx.headerUserAvatar),
    userName: (__VLS_ctx.displayName),
}));
const __VLS_7 = __VLS_6({
    ...{ 'onLogin': {} },
    ...{ 'onLogout': {} },
    ...{ class: "account-shared-header" },
    authLoading: (__VLS_ctx.isHeaderAuthLoading),
    brandName: (__VLS_ctx.accountHeaderBrand),
    coinBalanceLabel: (__VLS_ctx.headerCoinBalanceLabel),
    compact: (true),
    coinHubTo: (__VLS_ctx.headerCoinHubRoute),
    isAuthenticated: (__VLS_ctx.isAuthenticated),
    isProActive: (__VLS_ctx.isProActiveSubscription),
    logoSrc: (__VLS_ctx.mafiaHeaderLogo),
    mafiaMode: (true),
    profileTo: (__VLS_ctx.accountProfileTo),
    accountTo: (__VLS_ctx.accountRouteTo),
    proLinkTo: (__VLS_ctx.proHeaderLinkTo),
    proLabel: (__VLS_ctx.proHeaderLabel),
    showAuth: (true),
    showCoin: (false),
    title: (__VLS_ctx.accountHeaderTitle),
    userAvatar: (__VLS_ctx.headerUserAvatar),
    userName: (__VLS_ctx.displayName),
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
let __VLS_10;
const __VLS_11 = ({ login: {} },
    { onLogin: (__VLS_ctx.onHeaderLogin) });
const __VLS_12 = ({ logout: {} },
    { onLogout: (__VLS_ctx.onLogout) });
/** @type {__VLS_StyleScopedClasses['account-shared-header']} */ ;
const { default: __VLS_13 } = __VLS_8.slots;
{
    const { 'brand-extra': __VLS_14 } = __VLS_8.slots;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.setTab('settings');
                // @ts-ignore
                [isHeaderAuthLoading, accountHeaderBrand, headerCoinBalanceLabel, headerCoinHubRoute, isAuthenticated, isProActiveSubscription, mafiaHeaderLogo, accountProfileTo, accountRouteTo, proHeaderLinkTo, proHeaderLabel, accountHeaderTitle, headerUserAvatar, displayName, onHeaderLogin, onLogout, setTab,];
            } },
        type: "button",
        ...{ class: "account-mafia-settings" },
        title: "Налаштування акаунту",
        'aria-label': "Налаштування акаунту",
    });
    /** @type {__VLS_StyleScopedClasses['account-mafia-settings']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
        ...{ class: "account-mafia-settings__icon" },
        src: (__VLS_ctx.mafiaHeaderSettingsIcon),
        alt: "",
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['account-mafia-settings__icon']} */ ;
    // @ts-ignore
    [mafiaHeaderSettingsIcon,];
}
// @ts-ignore
[];
var __VLS_8;
var __VLS_9;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "account-frame" },
    'aria-label': "Account",
});
/** @type {__VLS_StyleScopedClasses['account-frame']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.aside, __VLS_intrinsics.aside)({
    ...{ class: "account-rail" },
    ...{ class: ({ 'account-rail--compact': !__VLS_ctx.hasStreamerProfile }) },
});
/** @type {__VLS_StyleScopedClasses['account-rail']} */ ;
/** @type {__VLS_StyleScopedClasses['account-rail--compact']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "account-avatar" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['account-avatar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "account-avatar__inner" },
});
/** @type {__VLS_StyleScopedClasses['account-avatar__inner']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.userInitial);
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "account-rail__name" },
});
/** @type {__VLS_StyleScopedClasses['account-rail__name']} */ ;
(__VLS_ctx.displayName);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "account-chips" },
    ...{ class: ({ 'account-chips--streamer': __VLS_ctx.hasStreamerProfile }) },
});
/** @type {__VLS_StyleScopedClasses['account-chips']} */ ;
/** @type {__VLS_StyleScopedClasses['account-chips--streamer']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "account-chip account-chip--provider" },
});
/** @type {__VLS_StyleScopedClasses['account-chip']} */ ;
/** @type {__VLS_StyleScopedClasses['account-chip--provider']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "account-chip__dot" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['account-chip__dot']} */ ;
(__VLS_ctx.providerLabel);
if (__VLS_ctx.hasStreamerProfile) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "account-chip account-chip--streamer" },
    });
    /** @type {__VLS_StyleScopedClasses['account-chip']} */ ;
    /** @type {__VLS_StyleScopedClasses['account-chip--streamer']} */ ;
}
if (__VLS_ctx.isEmailVerified) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "account-chip account-chip--verified" },
    });
    /** @type {__VLS_StyleScopedClasses['account-chip']} */ ;
    /** @type {__VLS_StyleScopedClasses['account-chip--verified']} */ ;
}
if (__VLS_ctx.hasStreamerProfile) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "account-stream" },
    });
    /** @type {__VLS_StyleScopedClasses['account-stream']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "account-stream__head" },
    });
    /** @type {__VLS_StyleScopedClasses['account-stream__head']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "account-stream__mark" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['account-stream__mark']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    (__VLS_ctx.streamHandle);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "account-stream__stats" },
    });
    /** @type {__VLS_StyleScopedClasses['account-stream__stats']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "account-stream__cell" },
    });
    /** @type {__VLS_StyleScopedClasses['account-stream__cell']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "account-stream__label" },
    });
    /** @type {__VLS_StyleScopedClasses['account-stream__label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "account-stream__value" },
    });
    /** @type {__VLS_StyleScopedClasses['account-stream__value']} */ ;
    (__VLS_ctx.streamFollowersLabel);
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "account-stream__cell" },
    });
    /** @type {__VLS_StyleScopedClasses['account-stream__cell']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "account-stream__label" },
    });
    /** @type {__VLS_StyleScopedClasses['account-stream__label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "account-stream__value" },
    });
    /** @type {__VLS_StyleScopedClasses['account-stream__value']} */ ;
    (__VLS_ctx.streamTier);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.onOpenStream) },
        type: "button",
        ...{ class: "account-stream__button" },
    });
    /** @type {__VLS_StyleScopedClasses['account-stream__button']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "account-rail__divider" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['account-rail__divider']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.nav, __VLS_intrinsics.nav)({
    ...{ class: "account-nav" },
    'aria-label': "Account sections",
});
/** @type {__VLS_StyleScopedClasses['account-nav']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "account-nav__active" },
    ...{ style: ({ top: `${__VLS_ctx.activeNavTop}px` }) },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['account-nav__active']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.setTab('profile');
            // @ts-ignore
            [displayName, setTab, hasStreamerProfile, hasStreamerProfile, hasStreamerProfile, hasStreamerProfile, userInitial, providerLabel, isEmailVerified, streamHandle, streamFollowersLabel, streamTier, onOpenStream, activeNavTop,];
        } },
    type: "button",
    ...{ class: "account-nav__item" },
    ...{ class: ({ 'is-active': __VLS_ctx.activeTab === 'profile' }) },
});
/** @type {__VLS_StyleScopedClasses['account-nav__item']} */ ;
/** @type {__VLS_StyleScopedClasses['is-active']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "account-nav__icon account-nav__icon--dot" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['account-nav__icon']} */ ;
/** @type {__VLS_StyleScopedClasses['account-nav__icon--dot']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.setTab('subscription');
            // @ts-ignore
            [setTab, activeTab,];
        } },
    type: "button",
    ...{ class: "account-nav__item account-nav__item--subscription" },
    ...{ class: ({ 'is-active': __VLS_ctx.activeTab === 'subscription' }) },
});
/** @type {__VLS_StyleScopedClasses['account-nav__item']} */ ;
/** @type {__VLS_StyleScopedClasses['account-nav__item--subscription']} */ ;
/** @type {__VLS_StyleScopedClasses['is-active']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "account-nav__icon" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['account-nav__icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    viewBox: "0 0 16 12",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M1.5 3.3 4.4 6.6 8 1.2l3.6 5.4 2.9-3.3-2 7.5h-9l-2-7.5Z",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.setTab('settings');
            // @ts-ignore
            [setTab, activeTab,];
        } },
    type: "button",
    ...{ class: "account-nav__item account-nav__item--settings" },
    ...{ class: ({ 'is-active': __VLS_ctx.activeTab === 'settings' }) },
});
/** @type {__VLS_StyleScopedClasses['account-nav__item']} */ ;
/** @type {__VLS_StyleScopedClasses['account-nav__item--settings']} */ ;
/** @type {__VLS_StyleScopedClasses['is-active']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "account-nav__icon" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['account-nav__icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    viewBox: "0 0 16 16",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
    cx: "8",
    cy: "8",
    r: "2.2",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M8 1.7v2M8 12.3v2M1.7 8h2M12.3 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    type: "button",
    ...{ class: "account-nav__item account-nav__item--security is-disabled" },
    disabled: true,
});
/** @type {__VLS_StyleScopedClasses['account-nav__item']} */ ;
/** @type {__VLS_StyleScopedClasses['account-nav__item--security']} */ ;
/** @type {__VLS_StyleScopedClasses['is-disabled']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "account-nav__icon" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['account-nav__icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    viewBox: "0 0 16 16",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M8 1.5 13.3 3.6v4.1c0 3.1-2.2 5.2-5.3 6.8-3.1-1.6-5.3-3.7-5.3-6.8V3.6L8 1.5Z",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    type: "button",
    ...{ class: "account-nav__item account-nav__item--wallet is-disabled" },
    disabled: true,
});
/** @type {__VLS_StyleScopedClasses['account-nav__item']} */ ;
/** @type {__VLS_StyleScopedClasses['account-nav__item--wallet']} */ ;
/** @type {__VLS_StyleScopedClasses['is-disabled']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "account-nav__icon" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['account-nav__icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    viewBox: "0 0 16 14",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
    x: "1.4",
    y: "2.4",
    width: "13.2",
    height: "9.2",
    rx: "1.5",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M1.4 5h13.2M10.4 8.8h2",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    type: "button",
    ...{ class: "account-nav__item account-nav__item--stream is-disabled" },
    disabled: true,
});
/** @type {__VLS_StyleScopedClasses['account-nav__item']} */ ;
/** @type {__VLS_StyleScopedClasses['account-nav__item--stream']} */ ;
/** @type {__VLS_StyleScopedClasses['is-disabled']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "account-nav__icon" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['account-nav__icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
    viewBox: "0 0 16 16",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.path)({
    d: "M4 2.3 12.8 8 4 13.7V2.3Z",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.onLogout) },
    type: "button",
    ...{ class: "account-logout" },
});
/** @type {__VLS_StyleScopedClasses['account-logout']} */ ;
if (__VLS_ctx.activeTab === 'profile') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
        ...{ class: "plan-card plan-card--plus" },
    });
    /** @type {__VLS_StyleScopedClasses['plan-card']} */ ;
    /** @type {__VLS_StyleScopedClasses['plan-card--plus']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
        ...{ class: "plan-card__name" },
    });
    /** @type {__VLS_StyleScopedClasses['plan-card__name']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "plan-card__currency" },
    });
    /** @type {__VLS_StyleScopedClasses['plan-card__currency']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "plan-card__old" },
    });
    /** @type {__VLS_StyleScopedClasses['plan-card__old']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "plan-card__strike" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['plan-card__strike']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "plan-card__price" },
    });
    /** @type {__VLS_StyleScopedClasses['plan-card__price']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeTab === 'profile'))
                    return;
                __VLS_ctx.onPlanCta('plus');
                // @ts-ignore
                [onLogout, activeTab, activeTab, onPlanCta,];
            } },
        type: "button",
        ...{ class: "plan-card__button" },
    });
    /** @type {__VLS_StyleScopedClasses['plan-card__button']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
        ...{ class: "plan-card plan-card--pro" },
    });
    /** @type {__VLS_StyleScopedClasses['plan-card']} */ ;
    /** @type {__VLS_StyleScopedClasses['plan-card--pro']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
        ...{ class: "plan-card__name" },
    });
    /** @type {__VLS_StyleScopedClasses['plan-card__name']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "plan-card__crown" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['plan-card__crown']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        viewBox: "0 0 54 40",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        d: "M4 11 14.5 22.5 27 4l12.5 18.5L50 11l-4 25H8L4 11Z",
    });
    if (__VLS_ctx.proPriceAmount && __VLS_ctx.proPriceDurationLabel) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "plan-card__currency" },
        });
        /** @type {__VLS_StyleScopedClasses['plan-card__currency']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "plan-card__old" },
        });
        /** @type {__VLS_StyleScopedClasses['plan-card__old']} */ ;
        (__VLS_ctx.PRO_OLD_PRICE_LABEL);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "plan-card__strike" },
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['plan-card__strike']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "plan-card__price" },
        });
        /** @type {__VLS_StyleScopedClasses['plan-card__price']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.proPriceAmount);
        (__VLS_ctx.proPriceDurationLabel);
    }
    else if (__VLS_ctx.isProPricingUnavailable) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "plan-card__price-unavailable" },
        });
        /** @type {__VLS_StyleScopedClasses['plan-card__price-unavailable']} */ ;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "plan-card__price-loading" },
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['plan-card__price-loading']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeTab === 'profile'))
                    return;
                __VLS_ctx.onPlanCta('pro');
                // @ts-ignore
                [onPlanCta, proPriceAmount, proPriceAmount, proPriceDurationLabel, proPriceDurationLabel, PRO_OLD_PRICE_LABEL, isProPricingUnavailable,];
            } },
        type: "button",
        ...{ class: "plan-card__button" },
    });
    /** @type {__VLS_StyleScopedClasses['plan-card__button']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
        ...{ class: "info-card info-card--balance" },
    });
    /** @type {__VLS_StyleScopedClasses['info-card']} */ ;
    /** @type {__VLS_StyleScopedClasses['info-card--balance']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
        ...{ class: "account-balance-coin" },
        src: (__VLS_ctx.coinIcon),
        alt: "",
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['account-balance-coin']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
        ...{ class: "info-card__title" },
    });
    /** @type {__VLS_StyleScopedClasses['info-card__title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "info-card__balance" },
    });
    /** @type {__VLS_StyleScopedClasses['info-card__balance']} */ ;
    (__VLS_ctx.coinBalanceLabel);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "info-card__copy" },
    });
    /** @type {__VLS_StyleScopedClasses['info-card__copy']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "info-card__divider" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['info-card__divider']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "info-card__meta" },
    });
    /** @type {__VLS_StyleScopedClasses['info-card__meta']} */ ;
    (__VLS_ctx.avgOnlineLabel);
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeTab === 'profile'))
                    return;
                __VLS_ctx.router.push({ name: 'coin-hub' });
                // @ts-ignore
                [coinIcon, coinBalanceLabel, avgOnlineLabel, router,];
            } },
        type: "button",
        ...{ class: "info-card__link" },
    });
    /** @type {__VLS_StyleScopedClasses['info-card__link']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
        ...{ class: "info-card info-card--activity" },
    });
    /** @type {__VLS_StyleScopedClasses['info-card']} */ ;
    /** @type {__VLS_StyleScopedClasses['info-card--activity']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "bolt-icon" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['bolt-icon']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        viewBox: "0 0 18 24",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        d: "M10 1 2 13h6L7 23l9-13h-6l0-9Z",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
        ...{ class: "info-card__title" },
    });
    /** @type {__VLS_StyleScopedClasses['info-card__title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "activity-grid" },
    });
    /** @type {__VLS_StyleScopedClasses['activity-grid']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "activity-cell" },
    });
    /** @type {__VLS_StyleScopedClasses['activity-cell']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "activity-cell" },
    });
    /** @type {__VLS_StyleScopedClasses['activity-cell']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "activity-cell" },
    });
    /** @type {__VLS_StyleScopedClasses['activity-cell']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "activity-cell" },
    });
    /** @type {__VLS_StyleScopedClasses['activity-cell']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "info-card__divider" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['info-card__divider']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "info-card__meta" },
    });
    /** @type {__VLS_StyleScopedClasses['info-card__meta']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.activeTab === 'profile'))
                    return;
                __VLS_ctx.router.push({ name: 'home' });
                // @ts-ignore
                [router,];
            } },
        type: "button",
        ...{ class: "info-card__link" },
    });
    /** @type {__VLS_StyleScopedClasses['info-card__link']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "settings-card settings-card--profile" },
        'aria-label': "Account settings",
    });
    /** @type {__VLS_StyleScopedClasses['settings-card']} */ ;
    /** @type {__VLS_StyleScopedClasses['settings-card--profile']} */ ;
    for (const [row, index] of __VLS_vFor((__VLS_ctx.settingsRows))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (row.label),
            ...{ class: "settings-row" },
            ...{ class: ({ 'settings-row--last': index === __VLS_ctx.settingsRows.length - 1 }) },
        });
        /** @type {__VLS_StyleScopedClasses['settings-row']} */ ;
        /** @type {__VLS_StyleScopedClasses['settings-row--last']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "settings-row__main" },
        });
        /** @type {__VLS_StyleScopedClasses['settings-row__main']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
        (row.label);
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        (row.sub);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "settings-row__side" },
        });
        /** @type {__VLS_StyleScopedClasses['settings-row__side']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (row.value);
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            type: "button",
        });
        (row.action);
        // @ts-ignore
        [settingsRows, settingsRows,];
    }
}
else if (__VLS_ctx.activeTab === 'settings') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
        ...{ class: "settings-card settings-card--full" },
        'aria-label': "Account settings",
    });
    /** @type {__VLS_StyleScopedClasses['settings-card']} */ ;
    /** @type {__VLS_StyleScopedClasses['settings-card--full']} */ ;
    for (const [row, index] of __VLS_vFor((__VLS_ctx.settingsRows))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (row.label),
            ...{ class: "settings-row" },
            ...{ class: ({ 'settings-row--last': index === __VLS_ctx.settingsRows.length - 1 }) },
        });
        /** @type {__VLS_StyleScopedClasses['settings-row']} */ ;
        /** @type {__VLS_StyleScopedClasses['settings-row--last']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "settings-row__main" },
        });
        /** @type {__VLS_StyleScopedClasses['settings-row__main']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({});
        (row.label);
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        (row.sub);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "settings-row__side" },
        });
        /** @type {__VLS_StyleScopedClasses['settings-row__side']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (row.value);
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            type: "button",
        });
        (row.action);
        // @ts-ignore
        [activeTab, settingsRows, settingsRows,];
    }
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
        ...{ class: "wide-plan wide-plan--basic" },
    });
    /** @type {__VLS_StyleScopedClasses['wide-plan']} */ ;
    /** @type {__VLS_StyleScopedClasses['wide-plan--basic']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({});
    for (const [feature] of __VLS_vFor((__VLS_ctx.basicFeatures))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (feature),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (feature);
        // @ts-ignore
        [basicFeatures,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "wide-plan__currency" },
    });
    /** @type {__VLS_StyleScopedClasses['wide-plan__currency']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "wide-plan__price" },
    });
    /** @type {__VLS_StyleScopedClasses['wide-plan__price']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
        ...{ class: "wide-plan wide-plan--plus" },
    });
    /** @type {__VLS_StyleScopedClasses['wide-plan']} */ ;
    /** @type {__VLS_StyleScopedClasses['wide-plan--plus']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({});
    for (const [feature] of __VLS_vFor((__VLS_ctx.plusFeatures))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (feature),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (feature);
        // @ts-ignore
        [plusFeatures,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "wide-plan__currency" },
    });
    /** @type {__VLS_StyleScopedClasses['wide-plan__currency']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "wide-plan__old" },
    });
    /** @type {__VLS_StyleScopedClasses['wide-plan__old']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "wide-plan__strike" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['wide-plan__strike']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "wide-plan__price" },
    });
    /** @type {__VLS_StyleScopedClasses['wide-plan__price']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeTab === 'profile'))
                    return;
                if (!!(__VLS_ctx.activeTab === 'settings'))
                    return;
                __VLS_ctx.onPlanCta('plus');
                // @ts-ignore
                [onPlanCta,];
            } },
        type: "button",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.article, __VLS_intrinsics.article)({
        ...{ class: "wide-plan wide-plan--pro" },
    });
    /** @type {__VLS_StyleScopedClasses['wide-plan']} */ ;
    /** @type {__VLS_StyleScopedClasses['wide-plan--pro']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "wide-plan__crown" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['wide-plan__crown']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
        viewBox: "0 0 54 40",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
        d: "M4 11 14.5 22.5 27 4l12.5 18.5L50 11l-4 25H8L4 11Z",
    });
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({});
    for (const [feature] of __VLS_vFor((__VLS_ctx.proFeatures))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (feature),
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (feature);
        // @ts-ignore
        [proFeatures,];
    }
    if (__VLS_ctx.proPriceAmount && __VLS_ctx.proPriceDurationLabel) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "wide-plan__currency" },
        });
        /** @type {__VLS_StyleScopedClasses['wide-plan__currency']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "wide-plan__old" },
        });
        /** @type {__VLS_StyleScopedClasses['wide-plan__old']} */ ;
        (__VLS_ctx.PRO_OLD_PRICE_LABEL);
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "wide-plan__strike" },
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['wide-plan__strike']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "wide-plan__price" },
        });
        /** @type {__VLS_StyleScopedClasses['wide-plan__price']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
        (__VLS_ctx.proPriceAmount);
        (__VLS_ctx.proPriceDurationLabel);
    }
    else if (__VLS_ctx.isProPricingUnavailable) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "wide-plan__price-unavailable" },
        });
        /** @type {__VLS_StyleScopedClasses['wide-plan__price-unavailable']} */ ;
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "wide-plan__price-loading" },
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['wide-plan__price-loading']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.activeTab === 'profile'))
                    return;
                if (!!(__VLS_ctx.activeTab === 'settings'))
                    return;
                __VLS_ctx.onPlanCta('pro');
                // @ts-ignore
                [onPlanCta, proPriceAmount, proPriceAmount, proPriceDurationLabel, proPriceDurationLabel, PRO_OLD_PRICE_LABEL, isProPricingUnavailable,];
            } },
        type: "button",
    });
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
