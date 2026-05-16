/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import '@/eat-first/style.css';
import '@/eat-first/styles/theme.css';
import { storeToRefs } from 'pinia';
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import AppLandingHeader from '@/pages/app/components/AppHeader.vue';
import AppLandingFooter from '@/pages/app/components/AppFooter.vue';
import { eatViewFromRoute, useSeoApp, useTheme } from '@/eat-first';
import { persistLocale, LOCALE_OPTIONS } from '@/eat-first/i18n';
import { dismissOnboardingTour, isOnboardingDismissed, resolveOnboardingTourKeyFromRoute, } from '@/eat-first/utils/onboardingStorage.js';
import { useAuth } from '@/composables/useAuth';
import { eatFirstStreamViewFromRoute, EAT_FIRST_OBS_URL_TOAST_EVENT } from '@/composables/eatFirstCallStreamView';
import { MAFIA_OBS_URL_TOAST_EVENT, MAFIA_SETTINGS_TOAST_EVENT, mafiaViewQueryIsView, } from '@/composables/mafiaStreamViewRoute';
import { GAME_ROOM_OBS_URL_TOAST_EVENT } from '@/composables/gameRoomStreamViewRoute';
import { CALL_ROOM_DROPDOWN_HOST_ID, CALL_ROOM_POPOVER_PANEL_ID, useCallRoomHeaderJoinStore, } from '@/stores/callRoomHeaderJoin';
import { BRAND_LOGO_LIGHT_SVG, STREAM_APP_BRAND_NAME, } from '@/eat-first/constants/brand.js';
import '@/eat-first/styles/host-chrome.css';
import LandingCloudBackdrop from '@/components/ui/LandingCloudBackdrop.vue';
import EconomyComingSoonModal from '@/pages/app/components/EconomyComingSoonModal.vue';
import AppLandingFooterActions from '@/pages/app/components/AppLandingFooterActions.vue';
import '@/eat-first/styles/motion.css';
import { useCoinHubStore } from '@/stores/coinHub';
import { useStreamAuthModal } from '@/composables/useStreamAuthModal';
import { useProSubscription } from '@/composables/useProSubscription';
import { normalizeDisplayName } from 'call-core';
import { useEatFirstCallShellStore } from '@/stores/eatFirstCallShell';
import { useMafiaGameStore } from '@/stores/mafiaGame';
import { useGameTemplateGameStore } from '@/stores/gameTemplateGame';
import mafiaHeaderCopyIcon from '@/assets/mafia/ui/header-copy.svg';
import mafiaHeaderLogo from '@/assets/mafia/ui/header-logo.svg';
import mafiaHeaderSettingsIcon from '@/assets/mafia/ui/header-settings.svg';
useSeoApp();
const OnboardingTourModal = defineAsyncComponent({
    loader: () => import('@/eat-first/ui/organisms/OnboardingTourModal.vue'),
    delay: 100,
    timeout: 10000,
});
const route = useRoute();
const { t, locale } = useI18n();
const callRoomHeaderJoin = useCallRoomHeaderJoinStore();
const auth = useAuth();
const { openStreamAuthModal } = useStreamAuthModal();
const { isProActive: isProActiveSubscription, expiresAt: proExpiresAt } = useProSubscription();
const proHeaderLinkTo = { path: '/app/billing' };
const proHeaderLabel = computed(() => {
    const iso = proExpiresAt.value;
    if (!iso)
        return 'StreamAssist Pro';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return 'StreamAssist Pro';
    const formatted = d.toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    });
    return `StreamAssist Pro · до ${formatted}`;
});
const coinHub = useCoinHubStore();
const { balance: coinHubBalance } = storeToRefs(coinHub);
const eatFirstShell = useEatFirstCallShellStore();
const mafiaGame = useMafiaGameStore();
const { isMafiaHost: isCurrentMafiaHost, oldMafiaMode: mafiaHeaderOldMode, deadBackgrounds: mafiaDeadBackgrounds, activeBackgroundId: mafiaActiveBackgroundId, pageBackgrounds: mafiaPageBackgrounds, appHubPageBackgrounds, forcedPageBackgroundId: mafiaForcedPageBackgroundId, } = storeToRefs(mafiaGame);
/**
 * Phase 3C: parallel host detection for the Game Template generic stack.
 * The generic store is fully independent of the Mafia store, so the user
 * can be a host on `/app/game-template` while being a non-host on
 * `/app/mafia` (and vice versa).
 */
const gameTemplateGame = useGameTemplateGameStore();
const { isGameRoomHost: isCurrentGameTemplateHost } = storeToRefs(gameTemplateGame);
const { theme, setTheme } = useTheme();
const isEatRoute = computed(() => route.path.startsWith('/app/eat'));
const isHomeRoute = computed(() => route.name === 'home');
const isCallRoute = computed(() => route.name === 'call');
/**
 * Phase 3C: `isMafiaRoute` reverted to STRICT `route.name === 'mafia'`.
 * `/app/game-template` now has its own generic GameRoom stack — Mafia-
 * specific surfaces (background galleries, old/new mode toggle, Mafia
 * settings popover content) must NOT appear there. A separate
 * `isGameTemplateRoute` predicate gates the surfaces that should appear
 * on either route (room chip, logo, OBS copy button); a combined
 * `isMafiaLikeShellRoute` is exposed for that shared chrome.
 */
const isMafiaRoute = computed(() => route.name === 'mafia');
const isGameTemplateRoute = computed(() => route.name === 'game-template');
const isMafiaLikeShellRoute = computed(() => isMafiaRoute.value || isGameTemplateRoute.value);
const isCoinHubRoute = computed(() => route.name === 'coin-hub');
const isNadrawRoute = computed(() => route.name === 'nadraw-show');
const isBetaAccessRoute = computed(() => route.name === 'beta-access');
const isBillingRoute = computed(() => route.name === 'billing');
const isAccountRoute = computed(() => route.name === 'account');
const isAdminRoute = computed(() => String(route.name ?? '').startsWith('admin-'));
const isHeavyVisualRoute = computed(() => isHomeRoute.value ||
    isBillingRoute.value ||
    isAccountRoute.value ||
    isNadrawRoute.value ||
    route.name === 'nadle-streamer' ||
    route.name === 'app-streamer' ||
    route.name === 'checkers');
/** Hide header coin chip on interactive game routes (Coin Hub page keeps its own balance UI). */
const APP_SHELL_HIDE_HEADER_COIN_ROUTE_NAMES = new Set([
    'call',
    'mafia',
    'game-template',
    'nadle-streamer',
    'app-streamer',
    'nadraw-show',
    'checkers',
    'eat',
]);
const appShellHeaderHidesCoinChip = computed(() => typeof route.name === 'string' && APP_SHELL_HIDE_HEADER_COIN_ROUTE_NAMES.has(route.name));
const appLandingHeaderShowCoin = computed(() => !appShellHeaderHidesCoinChip.value);
const isNadleStreamRoute = computed(() => route.name === 'nadle-streamer' ||
    route.name === 'app-streamer' ||
    route.name === 'nadraw-show');
const isNadleGameRoute = computed(() => route.name === 'nadle-streamer' || route.name === 'app-streamer');
const currentEatView = computed(() => (isEatRoute.value ? eatViewFromRoute(route) : 'call'));
const isEatFirstCallGameView = computed(() => route.name === 'eat' && currentEatView.value === 'call');
const showChrome = computed(() => (!isEatRoute.value || currentEatView.value !== 'overlay') && route.meta.chromeless !== true);
const showFooter = computed(() => showChrome.value &&
    route.meta.footer !== false &&
    !isEatFirstCallGameView.value &&
    !isNadleGameRoute.value);
const shellPageBackgroundChoices = computed(() => isHomeRoute.value ? appHubPageBackgrounds.value : mafiaPageBackgrounds.value);
/** Stable page key: query changes should not create an empty transition gap. */
const routeTransitionKey = computed(() => String(route.name ?? route.path));
const streamTitle = computed(() => {
    void locale.value;
    const key = route.meta.appTitleKey;
    if (key === 'routes.streamAssist') {
        return STREAM_APP_BRAND_NAME;
    }
    if (typeof key === 'string' && key.length > 0) {
        return t(key);
    }
    const m = route.meta.appTitle;
    if (typeof m === 'string' && m.length > 0) {
        return m;
    }
    return STREAM_APP_BRAND_NAME;
});
/**
 * Host-control showdesk chrome has been removed alongside the legacy
 * `view=control` panel. The brand stays on the player/viewer title.
 */
const eatBrand = computed(() => t('game.title'));
const headerTitle = computed(() => (isEatRoute.value ? eatBrand.value : streamTitle.value));
const appLandingHeaderBrand = computed(() => isHomeRoute.value ||
    isAdminRoute.value ||
    isCallRoute.value ||
    isMafiaRoute.value ||
    isGameTemplateRoute.value ||
    isCoinHubRoute.value ||
    isNadrawRoute.value ||
    isBetaAccessRoute.value ||
    isEatRoute.value
    ? 'Stream Assist'
    : 'NADLE');
const appLandingFooterBrand = 'Nad1ch';
const appLandingFeedbackHref = 'https://docs.google.com/forms/d/e/1FAIpQLSdlLcJTCl7VIufeRmeZHsMD2h08kwwCkHZVMmQBNuN2Z3930Q/viewform?usp=header';
const appLandingCoinHubRoute = { name: 'coin-hub' };
const appLandingHeaderCompact = computed(() => !isHomeRoute.value);
const appLandingLocaleLabelByCode = {
    en: 'English',
    de: 'Deutsch',
    uk: 'Українська',
    pl: 'Polski',
};
const appLandingLocaleMenuOrder = ['en', 'de', 'uk', 'pl'];
const appLandingLocaleMenuOptions = computed(() => appLandingLocaleMenuOrder
    .map((code) => LOCALE_OPTIONS.find((o) => o.code === code))
    .filter((o) => Boolean(o))
    .map((o) => ({
    value: o.code,
    label: appLandingLocaleLabelByCode[o.code] ?? o.label,
})));
const appLandingHeaderCoinBalanceLabel = computed(() => {
    if (!auth.isAuthenticated.value) {
        return '—';
    }
    return new Intl.NumberFormat(locale.value, { maximumFractionDigits: 0 }).format(coinHubBalance.value);
});
const appLandingHeaderUserName = computed(() => auth.user.value?.displayName ?? '');
const appLandingHeaderUserAvatar = computed(() => auth.user.value?.avatar ?? '');
const appLandingProfileTo = computed(() => auth.user.value?.role === 'admin' ? { name: 'admin-users' } : undefined);
const appLandingAccountTo = computed(() => auth.isAuthenticated.value ? { name: 'account' } : undefined);
const emailVerificationSuccessFromRoute = computed(() => firstQueryValue(route.query.emailVerified) === '1');
const footerYear = new Date().getFullYear();
const onboardingOpen = ref(false);
const onboardingTourKey = ref('');
const economyComingSoonOpen = ref(false);
const onboardingForRoute = computed(() => {
    if (!isEatRoute.value)
        return '';
    return resolveOnboardingTourKeyFromRoute(route);
});
function openOnboardingForCurrentRoute() {
    const k = onboardingForRoute.value;
    if (!k)
        return;
    onboardingTourKey.value = k;
    onboardingOpen.value = true;
}
function openAppLandingAuth(mode) {
    openStreamAuthModal(route.fullPath || '/app', mode);
}
function logoutAppLanding() {
    void auth.logout();
}
function openEconomyComingSoon() {
    economyComingSoonOpen.value = true;
}
function closeEconomyComingSoon() {
    economyComingSoonOpen.value = false;
}
function firstQueryValue(value) {
    if (Array.isArray(value)) {
        return typeof value[0] === 'string' ? value[0] : '';
    }
    return typeof value === 'string' ? value : '';
}
function tryAutoOnboarding() {
    if (!isEatRoute.value)
        return;
    const k = onboardingForRoute.value;
    if (!k || isOnboardingDismissed(k))
        return;
    nextTick(() => {
        const again = onboardingForRoute.value;
        if (!again || again !== k || isOnboardingDismissed(k))
            return;
        onboardingTourKey.value = k;
        onboardingOpen.value = true;
    });
}
function onOnboardingDismissSave() {
    const k = onboardingTourKey.value;
    if (k)
        dismissOnboardingTour(k);
}
watch(() => route.fullPath, tryAutoOnboarding, { immediate: true });
watch([isMafiaLikeShellRoute, isEatFirstCallGameView], ([onMafiaLike, eatCall]) => {
    if (!onMafiaLike && !eatCall) {
        mafiaSettingsOpen.value = false;
    }
});
watch(
/**
 * Fetch the CoinHub snapshot from the shell only when the header coin
 * chip is actually visible. Game/call routes hide the chip via
 * `APP_SHELL_HIDE_HEADER_COIN_ROUTE_NAMES`, so on those routes a
 * shell-level snapshot fetch was wasted network — the standalone
 * `/app/coin-hub` page still loads its own snapshot.
 */
[() => auth.isAuthenticated.value, () => appLandingHeaderShowCoin.value], ([authed, showsCoinChip]) => {
    if (authed && showsCoinChip) {
        void coinHub.loadSnapshot({ background: true });
    }
}, { immediate: true });
onMounted(() => {
    setTheme(theme.value);
    void auth.ensureAuthLoaded();
    document.addEventListener('pointerdown', onDocumentPointerDownForMafiaSettings, true);
    document.addEventListener('keydown', onDocumentKeydownCloseMafiaSettings, true);
    window.addEventListener('resize', syncMafiaSettingsPopoverPosition, { passive: true });
});
onBeforeUnmount(() => {
    document.removeEventListener('pointerdown', onDocumentPointerDownForMafiaSettings, true);
    document.removeEventListener('keydown', onDocumentKeydownCloseMafiaSettings, true);
    window.removeEventListener('resize', syncMafiaSettingsPopoverPosition);
});
const isMafiaViewMode = computed(() => mafiaViewQueryIsView(route.query.mode));
/**
 * Phase 3C: widened to cover `/app/game-template?mode=view` too. The
 * underlying `isMafiaViewMode` predicate is purely `route.query.mode === 'view'`,
 * so the only change is the route gate. Mafia OBS view behaviour is
 * unchanged when `route.name === 'mafia'`.
 */
const hideMafiaObsHeaderControls = computed(() => isMafiaLikeShellRoute.value && isMafiaViewMode.value);
function mafiaQueryAsStringRecord(q) {
    const out = {};
    for (const [key, v] of Object.entries(q)) {
        if (v == null)
            continue;
        const s = Array.isArray(v) ? v[0] : v;
        if (typeof s !== 'string' || s.trim() === '')
            continue;
        out[key] = s;
    }
    return out;
}
const mafiaHeaderHasRoom = computed(() => {
    // Widened for the Game Template fork: the room chip on `/app/game-template`
    // shares the Mafia behaviour 1:1 (same query, same copy-OBS contract).
    if (route.name !== 'mafia' && route.name !== 'game-template') {
        return false;
    }
    return Boolean(mafiaQueryAsStringRecord(route.query).room);
});
const mafiaHeaderShowHostControls = computed(() => isMafiaRoute.value && isCurrentMafiaHost.value);
/**
 * Phase 3C: parallel host-controls predicate for the Game Template
 * generic stack. Used to gate the OBS-copy button so it remains visible
 * on `/app/game-template` when the user is the generic game-room host.
 * The Mafia-only "old/new" mode toggle is intentionally NOT shared.
 */
const gameTemplateHeaderShowHostControls = computed(() => isGameTemplateRoute.value && isCurrentGameTemplateHost.value);
const mafiaLikeHeaderShowHostControls = computed(() => mafiaHeaderShowHostControls.value || gameTemplateHeaderShowHostControls.value);
const eatFirstHeaderStreamView = computed(() => eatFirstStreamViewFromRoute(route));
const eatFirstHeaderShowHostControls = computed(() => isEatFirstCallGameView.value &&
    eatFirstShell.isEatFirstRoomHost &&
    !eatFirstHeaderStreamView.value);
const eatFirstHeaderHasGame = computed(() => {
    if (!isEatFirstCallGameView.value)
        return false;
    const g = route.query.game;
    return typeof g === 'string' && normalizeDisplayName(g).trim().length > 0;
});
const callOrMafiaShowVisualSettings = computed(() => isCallRoute.value || isMafiaRoute.value || isEatFirstCallGameView.value);
const showEatFirstOrMafiaDeadBackgroundSettings = computed(() => (isMafiaRoute.value && isCurrentMafiaHost.value) ||
    (isEatFirstCallGameView.value &&
        eatFirstShell.isEatFirstRoomHost &&
        !eatFirstHeaderStreamView.value));
/** Gear next to logo whenever the `/app` shell header is visible (including `/app` home). */
const shellShowsHeaderSettingsGear = computed(() => showChrome.value);
const mafiaHeaderObsCopyLabel = computed(() => 'copy');
const mafiaHeaderRoomLabel = computed(() => 'room');
const mafiaSettingsOpen = ref(false);
const obsGuideOpen = ref(false);
const obsGuideUrl = ref('');
const mafiaSettingsButtonRef = ref(null);
const mafiaSettingsPopoverRef = ref(null);
const mafiaSettingsPopoverStyle = ref({});
const MAFIA_BACKGROUND_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const MAFIA_BACKGROUND_UPLOAD_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
function toggleMafiaMode() {
    mafiaGame.setOldMafiaMode(!mafiaHeaderOldMode.value);
}
function closeMafiaSettings() {
    mafiaSettingsOpen.value = false;
}
function closeObsGuide() {
    obsGuideOpen.value = false;
}
function onShellSettingsLocaleChange(code) {
    void persistLocale(code);
}
function syncMafiaSettingsPopoverPosition() {
    const anchor = mafiaSettingsButtonRef.value;
    if (!anchor) {
        mafiaSettingsPopoverStyle.value = {};
        return;
    }
    const rect = anchor.getBoundingClientRect();
    const margin = 8;
    const width = Math.min(284, Math.max(200, window.innerWidth - margin * 2));
    const left = Math.min(Math.max(margin, rect.left), Math.max(margin, window.innerWidth - width - margin));
    mafiaSettingsPopoverStyle.value = {
        left: `${Math.round(left)}px`,
        top: `${Math.round(rect.bottom + 8)}px`,
    };
}
function toggleMafiaSettings() {
    mafiaSettingsOpen.value = !mafiaSettingsOpen.value;
    if (mafiaSettingsOpen.value) {
        void nextTick(syncMafiaSettingsPopoverPosition);
    }
}
function onDocumentPointerDownForMafiaSettings(ev) {
    if (!mafiaSettingsOpen.value) {
        return;
    }
    const target = ev.target;
    if (!(target instanceof Node)) {
        return;
    }
    if (mafiaSettingsButtonRef.value?.contains(target) || mafiaSettingsPopoverRef.value?.contains(target)) {
        return;
    }
    closeMafiaSettings();
}
function onDocumentKeydownCloseMafiaSettings(ev) {
    if (!mafiaSettingsOpen.value || ev.key !== 'Escape') {
        return;
    }
    closeMafiaSettings();
}
function showMafiaSettingsToast(text) {
    window.dispatchEvent(new CustomEvent(MAFIA_SETTINGS_TOAST_EVENT, { detail: { text } }));
}
function selectMafiaDeadBackground(backgroundId) {
    mafiaGame.setActiveDeadBackgroundId(backgroundId);
}
function onMafiaBackgroundCardKeydown(ev, backgroundId) {
    if (ev.key !== 'Enter' && ev.key !== ' ') {
        return;
    }
    ev.preventDefault();
    selectMafiaDeadBackground(backgroundId);
}
function deleteMafiaDeadBackground(background) {
    if (background.type !== 'custom') {
        return;
    }
    mafiaGame.deleteCustomDeadBackground(background.id);
}
function onMafiaDeadBackgroundFileChange(ev) {
    const input = ev.target;
    if (!(input instanceof HTMLInputElement)) {
        return;
    }
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
        return;
    }
    if (!MAFIA_BACKGROUND_UPLOAD_TYPES.has(file.type)) {
        showMafiaSettingsToast(t('mafiaPage.backgroundUploadInvalidType'));
        return;
    }
    if (file.size >= MAFIA_BACKGROUND_UPLOAD_MAX_BYTES) {
        showMafiaSettingsToast(t('mafiaPage.backgroundUploadTooLarge'));
        return;
    }
    try {
        const reader = new FileReader();
        reader.addEventListener('load', () => {
            const result = reader.result;
            if (typeof result !== 'string' || mafiaGame.addCustomDeadBackground(result) == null) {
                showMafiaSettingsToast(t('mafiaPage.backgroundUploadFailed'));
            }
        }, { once: true });
        reader.addEventListener('error', () => {
            showMafiaSettingsToast(t('mafiaPage.backgroundUploadFailed'));
        }, { once: true });
        reader.readAsDataURL(file);
    }
    catch {
        showMafiaSettingsToast(t('mafiaPage.backgroundUploadFailed'));
    }
}
function onMafiaPageBackgroundFileChange(ev) {
    const input = ev.target;
    if (!(input instanceof HTMLInputElement)) {
        return;
    }
    const file = input.files?.[0];
    input.value = '';
    if (!isHomeRoute.value && mafiaForcedPageBackgroundId.value != null && isMafiaRoute.value && !isCurrentMafiaHost.value) {
        showMafiaSettingsToast(t('mafiaPage.pageBackgroundForcedByHost'));
        return;
    }
    if (!file) {
        return;
    }
    if (!MAFIA_BACKGROUND_UPLOAD_TYPES.has(file.type)) {
        showMafiaSettingsToast(t('mafiaPage.backgroundUploadInvalidType'));
        return;
    }
    if (file.size >= MAFIA_BACKGROUND_UPLOAD_MAX_BYTES) {
        showMafiaSettingsToast(t('mafiaPage.backgroundUploadTooLarge'));
        return;
    }
    try {
        const reader = new FileReader();
        reader.addEventListener('load', () => {
            const result = reader.result;
            if (typeof result !== 'string') {
                showMafiaSettingsToast(t('mafiaPage.backgroundUploadFailed'));
                return;
            }
            const ok = isHomeRoute.value
                ? mafiaGame.addCustomAppHubPageBackground(result)
                : mafiaGame.addCustomPageBackground(result, isCallRoute.value);
            if (ok == null) {
                showMafiaSettingsToast(t('mafiaPage.backgroundUploadFailed'));
            }
        }, { once: true });
        reader.addEventListener('error', () => {
            showMafiaSettingsToast(t('mafiaPage.backgroundUploadFailed'));
        }, { once: true });
        reader.readAsDataURL(file);
    }
    catch {
        showMafiaSettingsToast(t('mafiaPage.backgroundUploadFailed'));
    }
}
function previewStyleForMafiaBackground(background) {
    if (background.type === 'custom') {
        return { backgroundImage: `url(${JSON.stringify(background.url)})` };
    }
    const preset = background.id.replace(/^preset-/, '');
    if (preset === 'red') {
        return { background: 'radial-gradient(circle at 50% 34%, rgb(127 29 29 / 0.9), rgb(24 8 12) 66%, #050205)' };
    }
    if (preset === 'violet') {
        return { background: 'radial-gradient(circle at 50% 32%, rgb(88 28 135 / 0.88), rgb(24 12 45) 62%, #07030f)' };
    }
    if (preset === 'gray') {
        return { background: 'radial-gradient(circle at 50% 32%, rgb(71 85 105 / 0.86), rgb(17 24 39) 62%, #030712)' };
    }
    return { background: 'linear-gradient(135deg, #030712, #2b2d31)' };
}
function styleForMafiaPageBackground(background) {
    if (background.type === 'custom') {
        return { backgroundImage: `url(${JSON.stringify(background.url)})` };
    }
    if (background.id === 'preset-page-violet') {
        return {
            background: 'radial-gradient(circle at 15% 12%, rgb(124 58 237 / 0.7), transparent 46%), radial-gradient(circle at 82% 78%, rgb(76 29 149 / 0.72), transparent 48%), #080214',
        };
    }
    if (background.id === 'preset-page-night') {
        return {
            background: 'radial-gradient(circle at 72% 24%, rgb(30 64 175 / 0.52), transparent 42%), radial-gradient(circle at 20% 84%, rgb(76 29 149 / 0.45), transparent 45%), #020617',
        };
    }
    return { background: 'linear-gradient(135deg, #070211, #12051f)' };
}
function labelForMafiaBackground(background) {
    if (background.type === 'custom') {
        return t('mafiaPage.backgroundCustomLabel');
    }
    const preset = background.id.replace(/^preset-/, '');
    return t(`mafiaPage.eliminationBackground.${preset}`);
}
function labelForMafiaPageBackground(background) {
    if (background.type === 'custom') {
        return t('mafiaPage.backgroundCustomLabel');
    }
    if (background.type === 'default') {
        return t('mafiaPage.pageBackgroundDefault');
    }
    return background.id === 'preset-page-night'
        ? t('mafiaPage.pageBackgroundNight')
        : t('mafiaPage.pageBackgroundViolet');
}
const mafiaResolvedPageBackground = computed(() => isHomeRoute.value ? mafiaGame.resolvedAppHubPageBackgroundItem() : mafiaGame.resolvedPageBackgroundItem());
const mafiaPageBackgroundStyle = computed(() => {
    const background = mafiaResolvedPageBackground.value;
    if (background.type === 'default') {
        return undefined;
    }
    return styleForMafiaPageBackground(background);
});
function isMafiaBackgroundSelected(background) {
    return mafiaActiveBackgroundId.value === background.id;
}
function isMafiaPageBackgroundSelected(background) {
    const resolved = isHomeRoute.value
        ? mafiaGame.resolvedAppHubPageBackgroundItem()
        : mafiaGame.resolvedPageBackgroundItem();
    return resolved.id === background.id;
}
function isMafiaBackgroundDeleteVisible(background) {
    return background.type === 'custom';
}
function isMafiaPageBackgroundDeleteVisible(background) {
    return background.type === 'custom';
}
function onMafiaBackgroundDeleteClick(ev, background) {
    ev.stopPropagation();
    deleteMafiaDeadBackground(background);
}
function onMafiaBackgroundDeleteKeydown(ev, background) {
    if (ev.key !== 'Enter' && ev.key !== ' ') {
        return;
    }
    ev.preventDefault();
    ev.stopPropagation();
    deleteMafiaDeadBackground(background);
}
function selectMafiaPageBackground(backgroundId) {
    if (isHomeRoute.value) {
        mafiaGame.selectAppHubPageBackground(backgroundId);
        return;
    }
    if (mafiaForcedPageBackgroundId.value != null && isMafiaRoute.value && !isCurrentMafiaHost.value) {
        showMafiaSettingsToast(t('mafiaPage.pageBackgroundForcedByHost'));
        return;
    }
    mafiaGame.selectPageBackground(backgroundId, isCallRoute.value);
}
function onMafiaPageBackgroundCardKeydown(ev, backgroundId) {
    if (ev.key !== 'Enter' && ev.key !== ' ') {
        return;
    }
    ev.preventDefault();
    selectMafiaPageBackground(backgroundId);
}
function deleteMafiaPageBackground(background) {
    if (background.type !== 'custom') {
        return;
    }
    if (isHomeRoute.value) {
        mafiaGame.deleteCustomAppHubPageBackground(background.id);
        return;
    }
    mafiaGame.deleteCustomPageBackground(background.id, isCallRoute.value);
}
function onMafiaPageBackgroundDeleteClick(ev, background) {
    ev.stopPropagation();
    deleteMafiaPageBackground(background);
}
function onMafiaPageBackgroundDeleteKeydown(ev, background) {
    if (ev.key !== 'Enter' && ev.key !== ' ') {
        return;
    }
    ev.preventDefault();
    ev.stopPropagation();
    deleteMafiaPageBackground(background);
}
function onMafiaForcePageBackgroundChange(ev) {
    const input = ev.target;
    if (!(input instanceof HTMLInputElement)) {
        return;
    }
    mafiaGame.setPageBackgroundForcedForRoom(input.checked, isCallRoute.value);
}
function isMafiaBackgroundActiveLabel(background) {
    return isMafiaBackgroundSelected(background)
        ? t('mafiaPage.backgroundSelected')
        : t('mafiaPage.backgroundSelect');
}
function mafiaBackgroundAriaLabel(background) {
    return `${labelForMafiaBackground(background)}. ${isMafiaBackgroundActiveLabel(background)}`;
}
function mafiaPageBackgroundAriaLabel(background) {
    return `${labelForMafiaPageBackground(background)}. ${isMafiaPageBackgroundSelected(background) ? t('mafiaPage.backgroundSelected') : t('mafiaPage.backgroundSelect')}`;
}
function mafiaBackgroundDeleteAriaLabel(background) {
    return t('mafiaPage.backgroundDeleteLabel', { name: labelForMafiaBackground(background) });
}
function mafiaPageBackgroundDeleteAriaLabel(background) {
    return t('mafiaPage.backgroundDeleteLabel', { name: labelForMafiaPageBackground(background) });
}
function mafiaBackgroundUploadAriaLabel() {
    return t('mafiaPage.deadBackgroundUpload');
}
function mafiaBackgroundDeleteTitle(background) {
    return mafiaBackgroundDeleteAriaLabel(background);
}
function mafiaBackgroundCardRole(background) {
    void background;
    return 'option';
}
function mafiaBackgroundCardTabIndex() {
    return 0;
}
function mafiaBackgroundCardAriaSelected(background) {
    return isMafiaBackgroundSelected(background);
}
function mafiaBackgroundCardClass(background) {
    return {
        'app-shell-mafia-bg-card--selected': isMafiaBackgroundSelected(background),
        'app-shell-mafia-bg-card--custom': background.type === 'custom',
    };
}
function mafiaPageBackgroundCardClass(background) {
    return {
        'app-shell-mafia-bg-card--selected': isMafiaPageBackgroundSelected(background),
        'app-shell-mafia-bg-card--custom': background.type === 'custom',
    };
}
function mafiaBackgroundDeleteClass() {
    return 'app-shell-mafia-bg-card__delete';
}
function mafiaBackgroundUploadClass() {
    return 'app-shell-mafia-bg-card app-shell-mafia-bg-card--upload';
}
function mafiaBackgroundUploadInputId() {
    return 'app-shell-mafia-dead-background-upload';
}
function mafiaPageBackgroundUploadInputId() {
    return isHomeRoute.value ? 'app-shell-app-hub-page-bg-upload' : 'app-shell-mafia-page-background-upload';
}
function mafiaBackgroundUploadAccept() {
    return 'image/png,image/jpeg,image/webp';
}
async function copyMafiaObsViewUrl() {
    // Widened for the Game Template fork: the OBS copy button on
    // `/app/game-template` builds `/app/game-template?...&mode=view`. Mafia
    // keeps emitting `/app/mafia?...&mode=view`. Same toast event for both.
    if (route.name !== 'mafia' && route.name !== 'game-template') {
        return;
    }
    const room = mafiaQueryAsStringRecord(route.query).room;
    if (typeof room !== 'string' || room.length < 1) {
        return;
    }
    const next = { ...mafiaQueryAsStringRecord(route.query), mode: 'view' };
    const basePath = route.name === 'game-template' ? '/app/game-template' : '/app/mafia';
    const viewUrl = `${window.location.origin}${basePath}?${new URLSearchParams(next).toString()}`;
    obsGuideUrl.value = viewUrl;
    obsGuideOpen.value = true;
    try {
        await navigator.clipboard.writeText(viewUrl);
    }
    catch {
        /* clipboard may be denied */
    }
    // Route-aware toast event: `/app/mafia` keeps dispatching the legacy
    // Mafia event (CallPage.vue listens for it); `/app/game-template`
    // dispatches the generic event that GameTemplateCallPage.vue listens
    // for. Without this split, the in-call "OBS URL copied" toast never
    // appeared on the game-template route after Phase 3C — clipboard +
    // modal still worked, but the toast listener never fired.
    const toastEventName = route.name === 'game-template'
        ? GAME_ROOM_OBS_URL_TOAST_EVENT
        : MAFIA_OBS_URL_TOAST_EVENT;
    window.dispatchEvent(new CustomEvent(toastEventName));
}
async function copyEatFirstCallObsUrl() {
    if (!isEatFirstCallGameView.value) {
        return;
    }
    const g = route.query.game;
    const gameId = typeof g === 'string' ? normalizeDisplayName(g).trim() : '';
    if (!gameId) {
        return;
    }
    const viewUrl = `${window.location.origin}/app/eat?${new URLSearchParams({ game: gameId, mode: 'view' }).toString()}`;
    obsGuideUrl.value = viewUrl;
    obsGuideOpen.value = true;
    try {
        await navigator.clipboard.writeText(viewUrl);
    }
    catch {
        /* clipboard may be denied */
    }
    window.dispatchEvent(new CustomEvent(EAT_FIRST_OBS_URL_TOAST_EVENT));
}
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['app-shell-obs-guide__size-line']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-obs-guide__size-line']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-route-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-route-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-route-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-route-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['route-soft-enter-active']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-route-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['route-soft-leave-active']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-route-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-route-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-route-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-route-stack']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-call-join-room']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-call-join-room']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-call-join-room--mafia']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-settings']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-copy']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-settings']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-copy']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-settings']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-settings']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-settings__icon']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-settings']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-settings__icon']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-settings-popover__locale-shell']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-settings-popover__locale-shell']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-settings-popover__locale-shell']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-force-bg']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-bg-card']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-bg-card']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-bg-card__delete']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-bg-card__delete']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-bg-card']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-bg-card__delete']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-bg-card']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-bg-card__delete']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-bg-card--upload']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-toggle--new']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-toggle']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-toggle--new']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-copy']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-copy']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-header__stream-center']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-header__stream-center']} */ ;
/** @type {__VLS_StyleScopedClasses['stream-nav__link']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-header__stream-center']} */ ;
/** @type {__VLS_StyleScopedClasses['stream-nav__link']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-header__stream-center']} */ ;
/** @type {__VLS_StyleScopedClasses['stream-nav__link']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-header__stream-center']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-main']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-main']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-settings']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-settings__icon']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-settings']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-mafia-settings__icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "app-shell-layout eat-first-root page-stack" },
    'data-theme': (__VLS_ctx.theme),
});
/** @type {__VLS_StyleScopedClasses['app-shell-layout']} */ ;
/** @type {__VLS_StyleScopedClasses['eat-first-root']} */ ;
/** @type {__VLS_StyleScopedClasses['page-stack']} */ ;
if (__VLS_ctx.isHeavyVisualRoute) {
    const __VLS_0 = LandingCloudBackdrop;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        ...{ class: "app-shell-layout__backdrop" },
        variant: "app",
        active: (true),
    }));
    const __VLS_2 = __VLS_1({
        ...{ class: "app-shell-layout__backdrop" },
        variant: "app",
        active: (true),
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    /** @type {__VLS_StyleScopedClasses['app-shell-layout__backdrop']} */ ;
}
if (__VLS_ctx.showChrome && __VLS_ctx.mafiaPageBackgroundStyle) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ...{ class: "app-shell-mafia-page-background" },
        ...{ style: (__VLS_ctx.mafiaPageBackgroundStyle) },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['app-shell-mafia-page-background']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "app-shell-layout__body app-layout" },
});
/** @type {__VLS_StyleScopedClasses['app-shell-layout__body']} */ ;
/** @type {__VLS_StyleScopedClasses['app-layout']} */ ;
if (__VLS_ctx.showChrome) {
    const __VLS_5 = AppLandingHeader || AppLandingHeader;
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
        ...{ 'onOpenHelp': {} },
        ...{ 'onCoinClick': {} },
        ...{ 'onLogin': {} },
        ...{ 'onLogout': {} },
        authLoading: (!__VLS_ctx.auth.loaded.value),
        brandName: (__VLS_ctx.appLandingHeaderBrand),
        coinBalanceLabel: (__VLS_ctx.appLandingHeaderCoinBalanceLabel),
        compact: (__VLS_ctx.appLandingHeaderCompact),
        coinHubTo: (__VLS_ctx.appLandingCoinHubRoute),
        helpLabel: (__VLS_ctx.t('onboarding.openGuide')),
        isAuthenticated: (__VLS_ctx.auth.isAuthenticated.value),
        isProActive: (__VLS_ctx.isProActiveSubscription),
        proLinkTo: (__VLS_ctx.proHeaderLinkTo),
        proLabel: (__VLS_ctx.proHeaderLabel),
        logoSrc: (__VLS_ctx.isMafiaLikeShellRoute || __VLS_ctx.isEatFirstCallGameView ? __VLS_ctx.mafiaHeaderLogo : __VLS_ctx.BRAND_LOGO_LIGHT_SVG),
        mafiaMode: (__VLS_ctx.isMafiaLikeShellRoute || __VLS_ctx.isEatFirstCallGameView),
        profileTo: (__VLS_ctx.appLandingProfileTo),
        accountTo: (__VLS_ctx.appLandingAccountTo),
        roomCenterMode: (__VLS_ctx.isCallRoute || __VLS_ctx.isMafiaLikeShellRoute || __VLS_ctx.isEatFirstCallGameView),
        showHelpButton: (__VLS_ctx.isEatRoute && !__VLS_ctx.isEatFirstCallGameView && Boolean(__VLS_ctx.onboardingForRoute)),
        showCoin: (__VLS_ctx.appLandingHeaderShowCoin),
        showAuth: (!__VLS_ctx.hideMafiaObsHeaderControls),
        mafiaObsMinimalChrome: (__VLS_ctx.hideMafiaObsHeaderControls),
        title: (__VLS_ctx.headerTitle),
        userAvatar: (__VLS_ctx.appLandingHeaderUserAvatar),
        userName: (__VLS_ctx.appLandingHeaderUserName),
    }));
    const __VLS_7 = __VLS_6({
        ...{ 'onOpenHelp': {} },
        ...{ 'onCoinClick': {} },
        ...{ 'onLogin': {} },
        ...{ 'onLogout': {} },
        authLoading: (!__VLS_ctx.auth.loaded.value),
        brandName: (__VLS_ctx.appLandingHeaderBrand),
        coinBalanceLabel: (__VLS_ctx.appLandingHeaderCoinBalanceLabel),
        compact: (__VLS_ctx.appLandingHeaderCompact),
        coinHubTo: (__VLS_ctx.appLandingCoinHubRoute),
        helpLabel: (__VLS_ctx.t('onboarding.openGuide')),
        isAuthenticated: (__VLS_ctx.auth.isAuthenticated.value),
        isProActive: (__VLS_ctx.isProActiveSubscription),
        proLinkTo: (__VLS_ctx.proHeaderLinkTo),
        proLabel: (__VLS_ctx.proHeaderLabel),
        logoSrc: (__VLS_ctx.isMafiaLikeShellRoute || __VLS_ctx.isEatFirstCallGameView ? __VLS_ctx.mafiaHeaderLogo : __VLS_ctx.BRAND_LOGO_LIGHT_SVG),
        mafiaMode: (__VLS_ctx.isMafiaLikeShellRoute || __VLS_ctx.isEatFirstCallGameView),
        profileTo: (__VLS_ctx.appLandingProfileTo),
        accountTo: (__VLS_ctx.appLandingAccountTo),
        roomCenterMode: (__VLS_ctx.isCallRoute || __VLS_ctx.isMafiaLikeShellRoute || __VLS_ctx.isEatFirstCallGameView),
        showHelpButton: (__VLS_ctx.isEatRoute && !__VLS_ctx.isEatFirstCallGameView && Boolean(__VLS_ctx.onboardingForRoute)),
        showCoin: (__VLS_ctx.appLandingHeaderShowCoin),
        showAuth: (!__VLS_ctx.hideMafiaObsHeaderControls),
        mafiaObsMinimalChrome: (__VLS_ctx.hideMafiaObsHeaderControls),
        title: (__VLS_ctx.headerTitle),
        userAvatar: (__VLS_ctx.appLandingHeaderUserAvatar),
        userName: (__VLS_ctx.appLandingHeaderUserName),
    }, ...__VLS_functionalComponentArgsRest(__VLS_6));
    let __VLS_10;
    const __VLS_11 = ({ openHelp: {} },
        { onOpenHelp: (__VLS_ctx.openOnboardingForCurrentRoute) });
    const __VLS_12 = ({ coinClick: {} },
        { onCoinClick: (__VLS_ctx.openEconomyComingSoon) });
    const __VLS_13 = ({ login: {} },
        { onLogin: (...[$event]) => {
                if (!(__VLS_ctx.showChrome))
                    return;
                __VLS_ctx.openAppLandingAuth('login');
                // @ts-ignore
                [theme, isHeavyVisualRoute, showChrome, showChrome, mafiaPageBackgroundStyle, mafiaPageBackgroundStyle, auth, auth, appLandingHeaderBrand, appLandingHeaderCoinBalanceLabel, appLandingHeaderCompact, appLandingCoinHubRoute, t, isProActiveSubscription, proHeaderLinkTo, proHeaderLabel, isMafiaLikeShellRoute, isMafiaLikeShellRoute, isMafiaLikeShellRoute, isEatFirstCallGameView, isEatFirstCallGameView, isEatFirstCallGameView, isEatFirstCallGameView, mafiaHeaderLogo, BRAND_LOGO_LIGHT_SVG, appLandingProfileTo, appLandingAccountTo, isCallRoute, isEatRoute, onboardingForRoute, appLandingHeaderShowCoin, hideMafiaObsHeaderControls, hideMafiaObsHeaderControls, headerTitle, appLandingHeaderUserAvatar, appLandingHeaderUserName, openOnboardingForCurrentRoute, openEconomyComingSoon, openAppLandingAuth,];
            } });
    const __VLS_14 = ({ logout: {} },
        { onLogout: (__VLS_ctx.logoutAppLanding) });
    const { default: __VLS_15 } = __VLS_8.slots;
    if (__VLS_ctx.shellShowsHeaderSettingsGear && !__VLS_ctx.hideMafiaObsHeaderControls) {
        {
            const { 'brand-extra': __VLS_16 } = __VLS_8.slots;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "app-shell-mafia-settings-wrap" },
            });
            /** @type {__VLS_StyleScopedClasses['app-shell-mafia-settings-wrap']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.toggleMafiaSettings) },
                ref: "mafiaSettingsButtonRef",
                type: "button",
                ...{ class: "app-shell-mafia-settings" },
                title: (__VLS_ctx.t('app.shellSettings')),
                'aria-label': (__VLS_ctx.t('app.shellSettings')),
                'aria-expanded': (__VLS_ctx.mafiaSettingsOpen),
                'aria-haspopup': "menu",
            });
            /** @type {__VLS_StyleScopedClasses['app-shell-mafia-settings']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
                ...{ class: "app-shell-mafia-settings__icon" },
                src: (__VLS_ctx.mafiaHeaderSettingsIcon),
                alt: "",
                'aria-hidden': "true",
            });
            /** @type {__VLS_StyleScopedClasses['app-shell-mafia-settings__icon']} */ ;
            let __VLS_17;
            /** @ts-ignore @type { | typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
            Teleport;
            // @ts-ignore
            const __VLS_18 = __VLS_asFunctionalComponent1(__VLS_17, new __VLS_17({
                to: "body",
            }));
            const __VLS_19 = __VLS_18({
                to: "body",
            }, ...__VLS_functionalComponentArgsRest(__VLS_18));
            const { default: __VLS_22 } = __VLS_20.slots;
            if (__VLS_ctx.mafiaSettingsOpen) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ onClick: () => { } },
                    ref: "mafiaSettingsPopoverRef",
                    ...{ class: "app-shell-mafia-settings-popover" },
                    ...{ style: (__VLS_ctx.mafiaSettingsPopoverStyle) },
                });
                /** @type {__VLS_StyleScopedClasses['app-shell-mafia-settings-popover']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "app-shell-mafia-settings-popover__locale-shell" },
                });
                /** @type {__VLS_StyleScopedClasses['app-shell-mafia-settings-popover__locale-shell']} */ ;
                const __VLS_23 = AppLandingFooterActions;
                // @ts-ignore
                const __VLS_24 = __VLS_asFunctionalComponent1(__VLS_23, new __VLS_23({
                    ...{ 'onUpdate:locale': {} },
                    mode: "locale",
                    tone: "glass",
                    locale: (__VLS_ctx.locale),
                    localeOptions: (__VLS_ctx.appLandingLocaleMenuOptions),
                    popoverLocaleStick: true,
                }));
                const __VLS_25 = __VLS_24({
                    ...{ 'onUpdate:locale': {} },
                    mode: "locale",
                    tone: "glass",
                    locale: (__VLS_ctx.locale),
                    localeOptions: (__VLS_ctx.appLandingLocaleMenuOptions),
                    popoverLocaleStick: true,
                }, ...__VLS_functionalComponentArgsRest(__VLS_24));
                let __VLS_28;
                const __VLS_29 = ({ 'update:locale': {} },
                    { 'onUpdate:locale': (__VLS_ctx.onShellSettingsLocaleChange) });
                var __VLS_26;
                var __VLS_27;
                __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                    ...{ class: "app-shell-mafia-settings-popover__title app-shell-mafia-settings-popover__title--page" },
                });
                /** @type {__VLS_StyleScopedClasses['app-shell-mafia-settings-popover__title']} */ ;
                /** @type {__VLS_StyleScopedClasses['app-shell-mafia-settings-popover__title--page']} */ ;
                (__VLS_ctx.t('mafiaPage.pageBackgroundTitle'));
                if (__VLS_ctx.isMafiaRoute && __VLS_ctx.isCurrentMafiaHost) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                        ...{ class: "app-shell-mafia-force-bg" },
                    });
                    /** @type {__VLS_StyleScopedClasses['app-shell-mafia-force-bg']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                        ...{ onChange: (__VLS_ctx.onMafiaForcePageBackgroundChange) },
                        type: "checkbox",
                        checked: (__VLS_ctx.mafiaForcedPageBackgroundId != null),
                    });
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                    (__VLS_ctx.t('mafiaPage.pageBackgroundApplyAll'));
                }
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "app-shell-mafia-bg-gallery" },
                    role: "listbox",
                    'aria-label': (__VLS_ctx.t('mafiaPage.pageBackgroundTitle')),
                });
                /** @type {__VLS_StyleScopedClasses['app-shell-mafia-bg-gallery']} */ ;
                for (const [background] of __VLS_vFor((__VLS_ctx.shellPageBackgroundChoices))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                        ...{ onClick: (...[$event]) => {
                                if (!(__VLS_ctx.showChrome))
                                    return;
                                if (!(__VLS_ctx.shellShowsHeaderSettingsGear && !__VLS_ctx.hideMafiaObsHeaderControls))
                                    return;
                                if (!(__VLS_ctx.mafiaSettingsOpen))
                                    return;
                                __VLS_ctx.selectMafiaPageBackground(background.id);
                                // @ts-ignore
                                [t, t, t, t, t, hideMafiaObsHeaderControls, logoutAppLanding, shellShowsHeaderSettingsGear, toggleMafiaSettings, mafiaSettingsOpen, mafiaSettingsOpen, mafiaHeaderSettingsIcon, mafiaSettingsPopoverStyle, locale, appLandingLocaleMenuOptions, onShellSettingsLocaleChange, isMafiaRoute, isCurrentMafiaHost, onMafiaForcePageBackgroundChange, mafiaForcedPageBackgroundId, shellPageBackgroundChoices, selectMafiaPageBackground,];
                            } },
                        ...{ onKeydown: (...[$event]) => {
                                if (!(__VLS_ctx.showChrome))
                                    return;
                                if (!(__VLS_ctx.shellShowsHeaderSettingsGear && !__VLS_ctx.hideMafiaObsHeaderControls))
                                    return;
                                if (!(__VLS_ctx.mafiaSettingsOpen))
                                    return;
                                __VLS_ctx.onMafiaPageBackgroundCardKeydown($event, background.id);
                                // @ts-ignore
                                [onMafiaPageBackgroundCardKeydown,];
                            } },
                        key: (background.id),
                        ...{ class: "app-shell-mafia-bg-card" },
                        ...{ class: (__VLS_ctx.mafiaPageBackgroundCardClass(background)) },
                        role: (__VLS_ctx.mafiaBackgroundCardRole(background)),
                        tabindex: (__VLS_ctx.mafiaBackgroundCardTabIndex()),
                        'aria-selected': (__VLS_ctx.isMafiaPageBackgroundSelected(background)),
                        'aria-label': (__VLS_ctx.mafiaPageBackgroundAriaLabel(background)),
                    });
                    /** @type {__VLS_StyleScopedClasses['app-shell-mafia-bg-card']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
                        ...{ class: "app-shell-mafia-bg-card__preview" },
                        ...{ style: (__VLS_ctx.styleForMafiaPageBackground(background)) },
                    });
                    /** @type {__VLS_StyleScopedClasses['app-shell-mafia-bg-card__preview']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "app-shell-mafia-bg-card__label" },
                    });
                    /** @type {__VLS_StyleScopedClasses['app-shell-mafia-bg-card__label']} */ ;
                    (__VLS_ctx.labelForMafiaPageBackground(background));
                    if (__VLS_ctx.isMafiaPageBackgroundDeleteVisible(background)) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                            ...{ onClick: (...[$event]) => {
                                    if (!(__VLS_ctx.showChrome))
                                        return;
                                    if (!(__VLS_ctx.shellShowsHeaderSettingsGear && !__VLS_ctx.hideMafiaObsHeaderControls))
                                        return;
                                    if (!(__VLS_ctx.mafiaSettingsOpen))
                                        return;
                                    if (!(__VLS_ctx.isMafiaPageBackgroundDeleteVisible(background)))
                                        return;
                                    __VLS_ctx.onMafiaPageBackgroundDeleteClick($event, background);
                                    // @ts-ignore
                                    [mafiaPageBackgroundCardClass, mafiaBackgroundCardRole, mafiaBackgroundCardTabIndex, isMafiaPageBackgroundSelected, mafiaPageBackgroundAriaLabel, styleForMafiaPageBackground, labelForMafiaPageBackground, isMafiaPageBackgroundDeleteVisible, onMafiaPageBackgroundDeleteClick,];
                                } },
                            ...{ onKeydown: (...[$event]) => {
                                    if (!(__VLS_ctx.showChrome))
                                        return;
                                    if (!(__VLS_ctx.shellShowsHeaderSettingsGear && !__VLS_ctx.hideMafiaObsHeaderControls))
                                        return;
                                    if (!(__VLS_ctx.mafiaSettingsOpen))
                                        return;
                                    if (!(__VLS_ctx.isMafiaPageBackgroundDeleteVisible(background)))
                                        return;
                                    __VLS_ctx.onMafiaPageBackgroundDeleteKeydown($event, background);
                                    // @ts-ignore
                                    [onMafiaPageBackgroundDeleteKeydown,];
                                } },
                            ...{ class: (__VLS_ctx.mafiaBackgroundDeleteClass()) },
                            role: "button",
                            tabindex: "0",
                            title: (__VLS_ctx.mafiaPageBackgroundDeleteAriaLabel(background)),
                            'aria-label': (__VLS_ctx.mafiaPageBackgroundDeleteAriaLabel(background)),
                        });
                    }
                    // @ts-ignore
                    [mafiaBackgroundDeleteClass, mafiaPageBackgroundDeleteAriaLabel, mafiaPageBackgroundDeleteAriaLabel,];
                }
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    ...{ class: (__VLS_ctx.mafiaBackgroundUploadClass()) },
                    for: (__VLS_ctx.mafiaPageBackgroundUploadInputId()),
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "app-shell-mafia-bg-card__plus" },
                    'aria-hidden': "true",
                });
                /** @type {__VLS_StyleScopedClasses['app-shell-mafia-bg-card__plus']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "app-shell-mafia-bg-card__label" },
                });
                /** @type {__VLS_StyleScopedClasses['app-shell-mafia-bg-card__label']} */ ;
                (__VLS_ctx.t('mafiaPage.pageBackgroundUpload'));
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    ...{ onChange: (__VLS_ctx.onMafiaPageBackgroundFileChange) },
                    id: (__VLS_ctx.mafiaPageBackgroundUploadInputId()),
                    type: "file",
                    accept: (__VLS_ctx.mafiaBackgroundUploadAccept()),
                    'aria-label': (__VLS_ctx.t('mafiaPage.pageBackgroundUpload')),
                });
                if (__VLS_ctx.callOrMafiaShowVisualSettings) {
                    if (__VLS_ctx.showEatFirstOrMafiaDeadBackgroundSettings) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                            ...{ class: "app-shell-mafia-settings-popover__title" },
                        });
                        /** @type {__VLS_StyleScopedClasses['app-shell-mafia-settings-popover__title']} */ ;
                        (__VLS_ctx.t('mafiaPage.eliminationBackgroundDefault'));
                    }
                    if (__VLS_ctx.showEatFirstOrMafiaDeadBackgroundSettings) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                            ...{ class: "app-shell-mafia-bg-gallery" },
                            role: "listbox",
                            'aria-label': (__VLS_ctx.t('mafiaPage.eliminationBackgroundDefault')),
                        });
                        /** @type {__VLS_StyleScopedClasses['app-shell-mafia-bg-gallery']} */ ;
                        for (const [background] of __VLS_vFor((__VLS_ctx.mafiaDeadBackgrounds))) {
                            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                                ...{ onClick: (...[$event]) => {
                                        if (!(__VLS_ctx.showChrome))
                                            return;
                                        if (!(__VLS_ctx.shellShowsHeaderSettingsGear && !__VLS_ctx.hideMafiaObsHeaderControls))
                                            return;
                                        if (!(__VLS_ctx.mafiaSettingsOpen))
                                            return;
                                        if (!(__VLS_ctx.callOrMafiaShowVisualSettings))
                                            return;
                                        if (!(__VLS_ctx.showEatFirstOrMafiaDeadBackgroundSettings))
                                            return;
                                        __VLS_ctx.selectMafiaDeadBackground(background.id);
                                        // @ts-ignore
                                        [t, t, t, t, mafiaBackgroundUploadClass, mafiaPageBackgroundUploadInputId, mafiaPageBackgroundUploadInputId, onMafiaPageBackgroundFileChange, mafiaBackgroundUploadAccept, callOrMafiaShowVisualSettings, showEatFirstOrMafiaDeadBackgroundSettings, showEatFirstOrMafiaDeadBackgroundSettings, mafiaDeadBackgrounds, selectMafiaDeadBackground,];
                                    } },
                                ...{ onKeydown: (...[$event]) => {
                                        if (!(__VLS_ctx.showChrome))
                                            return;
                                        if (!(__VLS_ctx.shellShowsHeaderSettingsGear && !__VLS_ctx.hideMafiaObsHeaderControls))
                                            return;
                                        if (!(__VLS_ctx.mafiaSettingsOpen))
                                            return;
                                        if (!(__VLS_ctx.callOrMafiaShowVisualSettings))
                                            return;
                                        if (!(__VLS_ctx.showEatFirstOrMafiaDeadBackgroundSettings))
                                            return;
                                        __VLS_ctx.onMafiaBackgroundCardKeydown($event, background.id);
                                        // @ts-ignore
                                        [onMafiaBackgroundCardKeydown,];
                                    } },
                                key: (background.id),
                                ...{ class: "app-shell-mafia-bg-card" },
                                ...{ class: (__VLS_ctx.mafiaBackgroundCardClass(background)) },
                                role: (__VLS_ctx.mafiaBackgroundCardRole(background)),
                                tabindex: (__VLS_ctx.mafiaBackgroundCardTabIndex()),
                                'aria-selected': (__VLS_ctx.mafiaBackgroundCardAriaSelected(background)),
                                'aria-label': (__VLS_ctx.mafiaBackgroundAriaLabel(background)),
                            });
                            /** @type {__VLS_StyleScopedClasses['app-shell-mafia-bg-card']} */ ;
                            __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
                                ...{ class: "app-shell-mafia-bg-card__preview" },
                                ...{ style: (__VLS_ctx.previewStyleForMafiaBackground(background)) },
                            });
                            /** @type {__VLS_StyleScopedClasses['app-shell-mafia-bg-card__preview']} */ ;
                            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                                ...{ class: "app-shell-mafia-bg-card__label" },
                            });
                            /** @type {__VLS_StyleScopedClasses['app-shell-mafia-bg-card__label']} */ ;
                            (__VLS_ctx.labelForMafiaBackground(background));
                            if (__VLS_ctx.isMafiaBackgroundDeleteVisible(background)) {
                                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                                    ...{ onClick: (...[$event]) => {
                                            if (!(__VLS_ctx.showChrome))
                                                return;
                                            if (!(__VLS_ctx.shellShowsHeaderSettingsGear && !__VLS_ctx.hideMafiaObsHeaderControls))
                                                return;
                                            if (!(__VLS_ctx.mafiaSettingsOpen))
                                                return;
                                            if (!(__VLS_ctx.callOrMafiaShowVisualSettings))
                                                return;
                                            if (!(__VLS_ctx.showEatFirstOrMafiaDeadBackgroundSettings))
                                                return;
                                            if (!(__VLS_ctx.isMafiaBackgroundDeleteVisible(background)))
                                                return;
                                            __VLS_ctx.onMafiaBackgroundDeleteClick($event, background);
                                            // @ts-ignore
                                            [mafiaBackgroundCardRole, mafiaBackgroundCardTabIndex, mafiaBackgroundCardClass, mafiaBackgroundCardAriaSelected, mafiaBackgroundAriaLabel, previewStyleForMafiaBackground, labelForMafiaBackground, isMafiaBackgroundDeleteVisible, onMafiaBackgroundDeleteClick,];
                                        } },
                                    ...{ onKeydown: (...[$event]) => {
                                            if (!(__VLS_ctx.showChrome))
                                                return;
                                            if (!(__VLS_ctx.shellShowsHeaderSettingsGear && !__VLS_ctx.hideMafiaObsHeaderControls))
                                                return;
                                            if (!(__VLS_ctx.mafiaSettingsOpen))
                                                return;
                                            if (!(__VLS_ctx.callOrMafiaShowVisualSettings))
                                                return;
                                            if (!(__VLS_ctx.showEatFirstOrMafiaDeadBackgroundSettings))
                                                return;
                                            if (!(__VLS_ctx.isMafiaBackgroundDeleteVisible(background)))
                                                return;
                                            __VLS_ctx.onMafiaBackgroundDeleteKeydown($event, background);
                                            // @ts-ignore
                                            [onMafiaBackgroundDeleteKeydown,];
                                        } },
                                    ...{ class: (__VLS_ctx.mafiaBackgroundDeleteClass()) },
                                    role: "button",
                                    tabindex: "0",
                                    title: (__VLS_ctx.mafiaBackgroundDeleteTitle(background)),
                                    'aria-label': (__VLS_ctx.mafiaBackgroundDeleteAriaLabel(background)),
                                });
                            }
                            // @ts-ignore
                            [mafiaBackgroundDeleteClass, mafiaBackgroundDeleteTitle, mafiaBackgroundDeleteAriaLabel,];
                        }
                        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                            ...{ class: (__VLS_ctx.mafiaBackgroundUploadClass()) },
                            for: (__VLS_ctx.mafiaBackgroundUploadInputId()),
                        });
                        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                            ...{ class: "app-shell-mafia-bg-card__plus" },
                            'aria-hidden': "true",
                        });
                        /** @type {__VLS_StyleScopedClasses['app-shell-mafia-bg-card__plus']} */ ;
                        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                            ...{ class: "app-shell-mafia-bg-card__label" },
                        });
                        /** @type {__VLS_StyleScopedClasses['app-shell-mafia-bg-card__label']} */ ;
                        (__VLS_ctx.t('mafiaPage.deadBackgroundUpload'));
                        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                            ...{ onChange: (__VLS_ctx.onMafiaDeadBackgroundFileChange) },
                            id: (__VLS_ctx.mafiaBackgroundUploadInputId()),
                            type: "file",
                            accept: (__VLS_ctx.mafiaBackgroundUploadAccept()),
                            'aria-label': (__VLS_ctx.mafiaBackgroundUploadAriaLabel()),
                        });
                    }
                }
            }
            // @ts-ignore
            [t, mafiaBackgroundUploadClass, mafiaBackgroundUploadAccept, mafiaBackgroundUploadInputId, mafiaBackgroundUploadInputId, onMafiaDeadBackgroundFileChange, mafiaBackgroundUploadAriaLabel,];
            var __VLS_20;
            // @ts-ignore
            [];
        }
    }
    if ((__VLS_ctx.isCallRoute || __VLS_ctx.isMafiaLikeShellRoute || __VLS_ctx.isEatFirstCallGameView) && !__VLS_ctx.hideMafiaObsHeaderControls) {
        {
            const { center: __VLS_30 } = __VLS_8.slots;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                id: (__VLS_ctx.CALL_ROOM_DROPDOWN_HOST_ID),
                ...{ class: "app-shell-call-room-anchor" },
                ...{ class: ({ 'app-shell-call-room-anchor--mafia': __VLS_ctx.isMafiaLikeShellRoute || __VLS_ctx.isEatFirstCallGameView }) },
            });
            /** @type {__VLS_StyleScopedClasses['app-shell-call-room-anchor']} */ ;
            /** @type {__VLS_StyleScopedClasses['app-shell-call-room-anchor--mafia']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.showChrome))
                            return;
                        if (!((__VLS_ctx.isCallRoute || __VLS_ctx.isMafiaLikeShellRoute || __VLS_ctx.isEatFirstCallGameView) && !__VLS_ctx.hideMafiaObsHeaderControls))
                            return;
                        __VLS_ctx.callRoomHeaderJoin.toggleRoomPopover();
                        // @ts-ignore
                        [isMafiaLikeShellRoute, isMafiaLikeShellRoute, isEatFirstCallGameView, isEatFirstCallGameView, isCallRoute, hideMafiaObsHeaderControls, CALL_ROOM_DROPDOWN_HOST_ID, callRoomHeaderJoin,];
                    } },
                type: "button",
                ...{ class: "app-shell-call-join-room" },
                ...{ class: ({ 'app-shell-call-join-room--mafia': __VLS_ctx.isMafiaLikeShellRoute || __VLS_ctx.isEatFirstCallGameView }) },
                'aria-expanded': (__VLS_ctx.callRoomHeaderJoin.roomPopoverOpen),
                'aria-haspopup': "dialog",
                'aria-controls': (__VLS_ctx.CALL_ROOM_POPOVER_PANEL_ID),
                title: (__VLS_ctx.isMafiaLikeShellRoute || __VLS_ctx.isEatFirstCallGameView ? __VLS_ctx.mafiaHeaderRoomLabel : 'room'),
                'aria-label': (__VLS_ctx.isMafiaLikeShellRoute || __VLS_ctx.isEatFirstCallGameView ? __VLS_ctx.mafiaHeaderRoomLabel : 'room'),
            });
            /** @type {__VLS_StyleScopedClasses['app-shell-call-join-room']} */ ;
            /** @type {__VLS_StyleScopedClasses['app-shell-call-join-room--mafia']} */ ;
            (__VLS_ctx.isMafiaLikeShellRoute || __VLS_ctx.isEatFirstCallGameView ? __VLS_ctx.mafiaHeaderRoomLabel : 'room');
            // @ts-ignore
            [isMafiaLikeShellRoute, isMafiaLikeShellRoute, isMafiaLikeShellRoute, isMafiaLikeShellRoute, isEatFirstCallGameView, isEatFirstCallGameView, isEatFirstCallGameView, isEatFirstCallGameView, callRoomHeaderJoin, CALL_ROOM_POPOVER_PANEL_ID, mafiaHeaderRoomLabel, mafiaHeaderRoomLabel, mafiaHeaderRoomLabel,];
        }
    }
    if (__VLS_ctx.mafiaLikeHeaderShowHostControls || __VLS_ctx.eatFirstHeaderShowHostControls) {
        {
            const { 'actions-start': __VLS_31 } = __VLS_8.slots;
            if (__VLS_ctx.mafiaHeaderShowHostControls) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                    ...{ class: "app-shell-mafia-host-controls" },
                });
                /** @type {__VLS_StyleScopedClasses['app-shell-mafia-host-controls']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (__VLS_ctx.toggleMafiaMode) },
                    type: "button",
                    ...{ class: "app-shell-mafia-toggle" },
                    ...{ class: ({ 'app-shell-mafia-toggle--new': !__VLS_ctx.mafiaHeaderOldMode }) },
                    'aria-pressed': (!__VLS_ctx.mafiaHeaderOldMode),
                    'aria-label': "old / new",
                    title: "old / new",
                });
                /** @type {__VLS_StyleScopedClasses['app-shell-mafia-toggle']} */ ;
                /** @type {__VLS_StyleScopedClasses['app-shell-mafia-toggle--new']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                (__VLS_ctx.mafiaHeaderOldMode ? 'old' : 'new');
            }
            if (__VLS_ctx.mafiaLikeHeaderShowHostControls && __VLS_ctx.mafiaHeaderHasRoom) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (__VLS_ctx.copyMafiaObsViewUrl) },
                    type: "button",
                    ...{ class: "app-shell-mafia-copy" },
                    ...{ class: ({ 'stream-nav__link--active': __VLS_ctx.isMafiaViewMode }) },
                    title: (__VLS_ctx.mafiaHeaderObsCopyLabel),
                    'aria-label': (__VLS_ctx.mafiaHeaderObsCopyLabel),
                });
                /** @type {__VLS_StyleScopedClasses['app-shell-mafia-copy']} */ ;
                /** @type {__VLS_StyleScopedClasses['stream-nav__link--active']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
                    ...{ class: "app-shell-mafia-copy__icon" },
                    src: (__VLS_ctx.mafiaHeaderCopyIcon),
                    alt: "",
                    'aria-hidden': "true",
                });
                /** @type {__VLS_StyleScopedClasses['app-shell-mafia-copy__icon']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                (__VLS_ctx.mafiaHeaderObsCopyLabel);
            }
            if (__VLS_ctx.eatFirstHeaderShowHostControls && __VLS_ctx.eatFirstHeaderHasGame) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (__VLS_ctx.copyEatFirstCallObsUrl) },
                    type: "button",
                    ...{ class: "app-shell-mafia-copy" },
                    ...{ class: ({ 'stream-nav__link--active': __VLS_ctx.eatFirstHeaderStreamView }) },
                    title: (__VLS_ctx.t('eatFirstCall.copyEatCallObs')),
                    'aria-label': (__VLS_ctx.t('eatFirstCall.copyEatCallObs')),
                });
                /** @type {__VLS_StyleScopedClasses['app-shell-mafia-copy']} */ ;
                /** @type {__VLS_StyleScopedClasses['stream-nav__link--active']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
                    ...{ class: "app-shell-mafia-copy__icon" },
                    src: (__VLS_ctx.mafiaHeaderCopyIcon),
                    alt: "",
                    'aria-hidden': "true",
                });
                /** @type {__VLS_StyleScopedClasses['app-shell-mafia-copy__icon']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                (__VLS_ctx.t('eatFirstCall.copyEatCallObs'));
            }
            // @ts-ignore
            [t, t, t, mafiaLikeHeaderShowHostControls, mafiaLikeHeaderShowHostControls, eatFirstHeaderShowHostControls, eatFirstHeaderShowHostControls, mafiaHeaderShowHostControls, toggleMafiaMode, mafiaHeaderOldMode, mafiaHeaderOldMode, mafiaHeaderOldMode, mafiaHeaderHasRoom, copyMafiaObsViewUrl, isMafiaViewMode, mafiaHeaderObsCopyLabel, mafiaHeaderObsCopyLabel, mafiaHeaderObsCopyLabel, mafiaHeaderCopyIcon, mafiaHeaderCopyIcon, eatFirstHeaderHasGame, copyEatFirstCallObsUrl, eatFirstHeaderStreamView,];
        }
    }
    // @ts-ignore
    [];
    var __VLS_8;
    var __VLS_9;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.main, __VLS_intrinsics.main)({
    ...{ class: "app-shell-main" },
    ...{ class: ({
            'app-shell-main--full': !__VLS_ctx.showChrome,
            'app-shell-main--nadraw': __VLS_ctx.isNadrawRoute,
        }) },
});
/** @type {__VLS_StyleScopedClasses['app-shell-main']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-main--full']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-main--nadraw']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "app-shell-main__viewport" },
    ...{ class: ({
            'app-shell-main__viewport--chrome': __VLS_ctx.showChrome,
            'app-shell-main__viewport--nadle': __VLS_ctx.isNadleStreamRoute,
            'app-shell-main__viewport--nadraw': __VLS_ctx.isNadrawRoute,
        }) },
});
/** @type {__VLS_StyleScopedClasses['app-shell-main__viewport']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-main__viewport--chrome']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-main__viewport--nadle']} */ ;
/** @type {__VLS_StyleScopedClasses['app-shell-main__viewport--nadraw']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "app-shell-route-stack" },
});
/** @type {__VLS_StyleScopedClasses['app-shell-route-stack']} */ ;
let __VLS_32;
/** @ts-ignore @type { | typeof __VLS_components.RouterView | typeof __VLS_components.RouterView} */
RouterView;
// @ts-ignore
const __VLS_33 = __VLS_asFunctionalComponent1(__VLS_32, new __VLS_32({}));
const __VLS_34 = __VLS_33({}, ...__VLS_functionalComponentArgsRest(__VLS_33));
{
    const { default: __VLS_37 } = __VLS_35.slots;
    const [{ Component }] = __VLS_vSlot(__VLS_37);
    let __VLS_38;
    /** @ts-ignore @type { | typeof __VLS_components.Transition | typeof __VLS_components.Transition} */
    Transition;
    // @ts-ignore
    const __VLS_39 = __VLS_asFunctionalComponent1(__VLS_38, new __VLS_38({
        name: "route-soft",
    }));
    const __VLS_40 = __VLS_39({
        name: "route-soft",
    }, ...__VLS_functionalComponentArgsRest(__VLS_39));
    const { default: __VLS_43 } = __VLS_41.slots;
    if (Component) {
        const __VLS_44 = (Component);
        // @ts-ignore
        const __VLS_45 = __VLS_asFunctionalComponent1(__VLS_44, new __VLS_44({
            key: (__VLS_ctx.routeTransitionKey),
        }));
        const __VLS_46 = __VLS_45({
            key: (__VLS_ctx.routeTransitionKey),
        }, ...__VLS_functionalComponentArgsRest(__VLS_45));
    }
    // @ts-ignore
    [showChrome, showChrome, isNadrawRoute, isNadrawRoute, isNadleStreamRoute, routeTransitionKey,];
    var __VLS_41;
    // @ts-ignore
    [];
    __VLS_35.slots['' /* empty slot name completion */];
}
var __VLS_35;
if (__VLS_ctx.showFooter) {
    const __VLS_49 = AppLandingFooter;
    // @ts-ignore
    const __VLS_50 = __VLS_asFunctionalComponent1(__VLS_49, new __VLS_49({
        ...{ 'onUpdate:locale': {} },
        brandName: (__VLS_ctx.appLandingFooterBrand),
        feedbackHref: (__VLS_ctx.appLandingFeedbackHref),
        locale: (__VLS_ctx.locale),
        localeOptions: (__VLS_ctx.appLandingLocaleMenuOptions),
        year: (__VLS_ctx.footerYear),
    }));
    const __VLS_51 = __VLS_50({
        ...{ 'onUpdate:locale': {} },
        brandName: (__VLS_ctx.appLandingFooterBrand),
        feedbackHref: (__VLS_ctx.appLandingFeedbackHref),
        locale: (__VLS_ctx.locale),
        localeOptions: (__VLS_ctx.appLandingLocaleMenuOptions),
        year: (__VLS_ctx.footerYear),
    }, ...__VLS_functionalComponentArgsRest(__VLS_50));
    let __VLS_54;
    const __VLS_55 = ({ 'update:locale': {} },
        { 'onUpdate:locale': (__VLS_ctx.persistLocale) });
    var __VLS_52;
    var __VLS_53;
}
if (__VLS_ctx.isEatRoute) {
    let __VLS_56;
    /** @ts-ignore @type { | typeof __VLS_components.OnboardingTourModal} */
    OnboardingTourModal;
    // @ts-ignore
    const __VLS_57 = __VLS_asFunctionalComponent1(__VLS_56, new __VLS_56({
        ...{ 'onDismissSave': {} },
        open: (__VLS_ctx.onboardingOpen),
        tourKey: (__VLS_ctx.onboardingTourKey),
    }));
    const __VLS_58 = __VLS_57({
        ...{ 'onDismissSave': {} },
        open: (__VLS_ctx.onboardingOpen),
        tourKey: (__VLS_ctx.onboardingTourKey),
    }, ...__VLS_functionalComponentArgsRest(__VLS_57));
    let __VLS_61;
    const __VLS_62 = ({ dismissSave: {} },
        { onDismissSave: (__VLS_ctx.onOnboardingDismissSave) });
    var __VLS_59;
    var __VLS_60;
}
if (__VLS_ctx.emailVerificationSuccessFromRoute) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "app-shell-email-status" },
        role: "status",
    });
    /** @type {__VLS_StyleScopedClasses['app-shell-email-status']} */ ;
}
let __VLS_63;
/** @ts-ignore @type { | typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
Teleport;
// @ts-ignore
const __VLS_64 = __VLS_asFunctionalComponent1(__VLS_63, new __VLS_63({
    to: "body",
}));
const __VLS_65 = __VLS_64({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_64));
const { default: __VLS_68 } = __VLS_66.slots;
const __VLS_69 = EconomyComingSoonModal;
// @ts-ignore
const __VLS_70 = __VLS_asFunctionalComponent1(__VLS_69, new __VLS_69({
    ...{ 'onClose': {} },
    open: (__VLS_ctx.economyComingSoonOpen),
    eyebrow: (__VLS_ctx.t('home.comingSoonEyebrow')),
    title: (__VLS_ctx.t('home.economyComingSoonTitle')),
    description: (__VLS_ctx.t('home.economyComingSoonDesc')),
    closeLabel: (__VLS_ctx.t('home.comingSoonClose')),
}));
const __VLS_71 = __VLS_70({
    ...{ 'onClose': {} },
    open: (__VLS_ctx.economyComingSoonOpen),
    eyebrow: (__VLS_ctx.t('home.comingSoonEyebrow')),
    title: (__VLS_ctx.t('home.economyComingSoonTitle')),
    description: (__VLS_ctx.t('home.economyComingSoonDesc')),
    closeLabel: (__VLS_ctx.t('home.comingSoonClose')),
}, ...__VLS_functionalComponentArgsRest(__VLS_70));
let __VLS_74;
const __VLS_75 = ({ close: {} },
    { onClose: (__VLS_ctx.closeEconomyComingSoon) });
var __VLS_72;
var __VLS_73;
// @ts-ignore
[t, t, t, t, isEatRoute, locale, appLandingLocaleMenuOptions, showFooter, appLandingFooterBrand, appLandingFeedbackHref, footerYear, persistLocale, onboardingOpen, onboardingTourKey, onOnboardingDismissSave, emailVerificationSuccessFromRoute, economyComingSoonOpen, closeEconomyComingSoon,];
var __VLS_66;
let __VLS_76;
/** @ts-ignore @type { | typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
Teleport;
// @ts-ignore
const __VLS_77 = __VLS_asFunctionalComponent1(__VLS_76, new __VLS_76({
    to: "body",
}));
const __VLS_78 = __VLS_77({
    to: "body",
}, ...__VLS_functionalComponentArgsRest(__VLS_77));
const { default: __VLS_81 } = __VLS_79.slots;
if (__VLS_ctx.obsGuideOpen) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onKeydown: (__VLS_ctx.closeObsGuide) },
        ...{ class: "app-shell-obs-guide" },
        role: "presentation",
    });
    /** @type {__VLS_StyleScopedClasses['app-shell-obs-guide']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.closeObsGuide) },
        type: "button",
        ...{ class: "app-shell-obs-guide__backdrop" },
        'aria-label': "Close OBS guide",
    });
    /** @type {__VLS_StyleScopedClasses['app-shell-obs-guide__backdrop']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: () => { } },
        ...{ class: "app-shell-obs-guide__panel" },
        role: "dialog",
        'aria-modal': "true",
        'aria-label': "OBS setup guide",
    });
    /** @type {__VLS_StyleScopedClasses['app-shell-obs-guide__panel']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
        ...{ class: "app-shell-obs-guide__title" },
    });
    /** @type {__VLS_StyleScopedClasses['app-shell-obs-guide__title']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "app-shell-obs-guide__text" },
    });
    /** @type {__VLS_StyleScopedClasses['app-shell-obs-guide__text']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.strong, __VLS_intrinsics.strong)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "app-shell-obs-guide__label" },
    });
    /** @type {__VLS_StyleScopedClasses['app-shell-obs-guide__label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "app-shell-obs-guide__code" },
    });
    /** @type {__VLS_StyleScopedClasses['app-shell-obs-guide__code']} */ ;
    (__VLS_ctx.obsGuideUrl);
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "app-shell-obs-guide__label" },
    });
    /** @type {__VLS_StyleScopedClasses['app-shell-obs-guide__label']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "app-shell-obs-guide__sizes" },
    });
    /** @type {__VLS_StyleScopedClasses['app-shell-obs-guide__sizes']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "app-shell-obs-guide__size-line" },
    });
    /** @type {__VLS_StyleScopedClasses['app-shell-obs-guide__size-line']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "app-shell-obs-guide__size-line" },
    });
    /** @type {__VLS_StyleScopedClasses['app-shell-obs-guide__size-line']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "app-shell-obs-guide__size-line" },
    });
    /** @type {__VLS_StyleScopedClasses['app-shell-obs-guide__size-line']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.code, __VLS_intrinsics.code)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "app-shell-obs-guide__actions" },
    });
    /** @type {__VLS_StyleScopedClasses['app-shell-obs-guide__actions']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.closeObsGuide) },
        type: "button",
        ...{ class: "app-shell-obs-guide__close" },
    });
    /** @type {__VLS_StyleScopedClasses['app-shell-obs-guide__close']} */ ;
}
// @ts-ignore
[obsGuideOpen, closeObsGuide, closeObsGuide, closeObsGuide, obsGuideUrl,];
var __VLS_79;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
