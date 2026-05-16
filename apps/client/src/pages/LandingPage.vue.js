/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import twitchBrowseIllustration from '@/assets/landing/twitch-browse-illustration.svg';
import LandingCloudBackdrop from '@/components/ui/LandingCloudBackdrop.vue';
import AppFullPageLoader from '@/components/ui/AppFullPageLoader.vue';
import AppLandingFooterActions from '@/pages/app/components/AppLandingFooterActions.vue';
import AppGamesSection from '@/pages/app/components/AppGamesSection.vue';
import EconomySlotBanner from '@/pages/app/components/EconomySlotBanner.vue';
import { useAuth } from '@/composables/useAuth';
import { useLandingCosmicParallax } from '@/composables/useLandingCosmicParallax';
import avatarBeanieBody from '@/assets/landing/video-call/avatar-beanie-body.svg';
import avatarBeanieExpression from '@/assets/landing/video-call/avatar-beanie-expression.svg';
import avatarBeanieGlasses from '@/assets/landing/video-call/avatar-beanie-glasses.svg';
import avatarBeanieHat from '@/assets/landing/video-call/avatar-beanie-hat.svg';
import avatarBeanieHead from '@/assets/landing/video-call/avatar-beanie-head.svg';
import avatarBucketBody from '@/assets/landing/video-call/avatar-bucket-body.svg';
import avatarBucketExpression from '@/assets/landing/video-call/avatar-bucket-expression.svg';
import avatarBucketHalo from '@/assets/landing/video-call/avatar-bucket-halo.svg';
import avatarBucketHat from '@/assets/landing/video-call/avatar-bucket-hat.svg';
import avatarBucketHead from '@/assets/landing/video-call/avatar-bucket-head.svg';
import avatarCap from '@/assets/landing/video-call/avatar-cap.svg';
import avatarGlassesHat from '@/assets/landing/video-call/avatar-glasses-hat.svg';
import avatarHeadbandBody from '@/assets/landing/video-call/avatar-headband-body.svg';
import avatarHeadbandExpression from '@/assets/landing/video-call/avatar-headband-expression.svg';
import avatarHeadbandHair from '@/assets/landing/video-call/avatar-headband-hair.svg';
import avatarHeadbandHalo from '@/assets/landing/video-call/avatar-headband-halo.svg';
import avatarHeadbandHead from '@/assets/landing/video-call/avatar-headband-head.svg';
import avatarHeadbandMarks from '@/assets/landing/video-call/avatar-headband-marks.svg';
import avatarHeadphones from '@/assets/landing/video-call/avatar-headphones.svg';
import avatarHost from '@/assets/landing/video-call/avatar-host.svg';
import avatarSidecapBody from '@/assets/landing/video-call/avatar-sidecap-body.svg';
import avatarSidecapExpression from '@/assets/landing/video-call/avatar-sidecap-expression.svg';
import avatarSidecapHalo from '@/assets/landing/video-call/avatar-sidecap-halo.svg';
import avatarSidecapHat from '@/assets/landing/video-call/avatar-sidecap-hat.svg';
import avatarSidecapHead from '@/assets/landing/video-call/avatar-sidecap-head.svg';
import landingCameraIcon from '@/assets/landing/decor/landing-camera.svg';
import landingMegaphoneIcon from '@/assets/landing/decor/landing-megaphone.svg';
import landingMicrophoneIcon from '@/assets/landing/decor/landing-microphone.svg';
import landingMonitorIcon from '@/assets/landing/decor/landing-monitor.svg';
// WebP is universally supported on every browser we target; drop the PNG
// twins for the four landing game cards so they don't ship in the chunk
// alongside the WebP that the `<picture>` always serves.
import eatFirstIcon from '@/assets/landing/eat-first.webp';
import nadrawPhoneIcon from '@/assets/landing/nadraw-phone.webp';
import instagramIcon from '@/assets/landing/instagram.png';
import mafiaIcon from '@/assets/landing/mafia.webp';
import checkersMarkImage from '@/assets/landing/checkers-mark.svg';
import durakCardImage from '@/assets/landing/durak-card.svg';
import telegramIcon from '@/assets/landing/telegram.png';
import tiktokIcon from '@/assets/landing/tiktok.png';
import twitchIcon from '@/assets/landing/twitch.png';
import nadleGameIcon from '@/assets/landing/nadle.webp';
import { persistLocale } from '@/eat-first/i18n/index.js';
import { BRAND_LOGO_LIGHT_SVG, STREAMER_NICK, STREAMER_TWITCH_URL, } from '@/eat-first/constants/brand.js';
import { getLandingScrollTopForHash } from '@/utils/landingAnchorScroll';
import { landingDesignPx as px } from '@/utils/landingDesignPx';
import { loadCheckersPage } from '@/routerRouteLoaders';
import { prefetchRoute } from '@/utils/routePrefetch';
const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();
const auth = useAuth();
const defaultNadleStreamer = (typeof import.meta.env.VITE_DEFAULT_STREAMER === 'string' && import.meta.env.VITE_DEFAULT_STREAMER.trim()) ||
    STREAMER_NICK;
const authRouteLogin = { path: '/auth', query: { redirect: '/app', mode: 'login' } };
const callRoute = { name: 'call' };
const economyComingSoonRoute = { name: 'home', query: { comingSoon: 'economy' } };
const mafiaRoute = { name: 'mafia' };
const checkersRoute = { name: 'checkers', params: { roomId: 'lobby' }, query: { defaultMode: 'rated' } };
const prefetchCheckers = () => prefetchRoute(loadCheckersPage);
const landingFeedbackHref = 'https://docs.google.com/forms/d/e/1FAIpQLSdlLcJTCl7VIufeRmeZHsMD2h08kwwCkHZVMmQBNuN2Z3930Q/viewform?usp=header';
const landingPageLoading = ref(true);
const landingCanvasElement = ref(null);
let landingReadyTimer;
let landingCanvasResizeObserver;
useLandingCosmicParallax(landingCanvasElement);
const navItems = computed(() => [
    { label: t('landing.navVideoCall'), href: '#videocall' },
    { label: t('landing.navGames'), href: '#games' },
    { label: t('landing.navEconomy'), href: '#economy' },
    { label: t('landing.navSafety'), href: '#footer' },
    { label: t('landing.navSupport'), href: '#footer' },
    { label: t('landing.navDevelopers'), href: '#footer' },
]);
const localeButtons = computed(() => [
    { code: 'en', label: 'English' },
    { code: 'de', label: 'Deutsch' },
    { code: 'uk', label: 'Українська' },
    { code: 'pl', label: 'Polski' },
]);
const landingFooterLocaleOptions = computed(() => localeButtons.value.map((item) => ({ value: item.code, label: item.label })));
const landingCriticalImageSources = Object.freeze([
    BRAND_LOGO_LIGHT_SVG,
    twitchBrowseIllustration,
    avatarHost,
    avatarHeadbandHalo,
    avatarHeadbandBody,
    avatarHeadbandHead,
    avatarHeadbandHair,
    avatarHeadbandExpression,
    avatarHeadbandMarks,
    avatarHeadphones,
    avatarCap,
    eatFirstIcon,
    mafiaIcon,
    checkersMarkImage,
    durakCardImage,
    nadleGameIcon,
    nadrawPhoneIcon,
    landingCameraIcon,
    landingMegaphoneIcon,
    landingMicrophoneIcon,
    landingMonitorIcon,
]);
const callBannerCards = Object.freeze([
    Object.freeze({
        id: 'host',
        tone: 'violet',
        layers: Object.freeze([{ src: avatarHost, className: 'call-banner__avatar--host' }]),
        style: Object.freeze({ left: px(24.5), width: px(159) }),
    }),
    Object.freeze({
        id: 'headband',
        tone: 'indigo',
        layers: Object.freeze([
            { src: avatarHeadbandHalo, className: 'call-banner__avatar--headband-halo' },
            { src: avatarHeadbandBody, className: 'call-banner__avatar--headband-body' },
            { src: avatarHeadbandHead, className: 'call-banner__avatar--headband-head' },
            { src: avatarHeadbandHair, className: 'call-banner__avatar--headband-hair' },
            { src: avatarHeadbandExpression, className: 'call-banner__avatar--headband-expression' },
            { src: avatarHeadbandMarks, className: 'call-banner__avatar--headband-marks' },
        ]),
        style: Object.freeze({ left: px(193.5), width: px(160) }),
    }),
    Object.freeze({
        id: 'headphones',
        tone: 'brown',
        layers: Object.freeze([{ src: avatarHeadphones, className: 'call-banner__avatar--headphones' }]),
        style: Object.freeze({ left: px(363.5), width: px(160) }),
    }),
    Object.freeze({
        id: 'cap',
        tone: 'olive',
        layers: Object.freeze([{ src: avatarCap, className: 'call-banner__avatar--cap' }]),
        style: Object.freeze({ left: px(533.5), width: px(159) }),
    }),
    Object.freeze({
        id: 'bucket',
        tone: 'sand',
        layers: Object.freeze([
            { src: avatarBucketHalo, className: 'call-banner__avatar--bucket-halo' },
            { src: avatarBucketBody, className: 'call-banner__avatar--bucket-body' },
            { src: avatarBucketHead, className: 'call-banner__avatar--bucket-head' },
            { src: avatarBucketHat, className: 'call-banner__avatar--bucket-hat' },
            { src: avatarBucketExpression, className: 'call-banner__avatar--bucket-expression' },
        ]),
        style: Object.freeze({ left: px(24.5), width: px(159) }),
    }),
    Object.freeze({
        id: 'glasses-hat',
        tone: 'pink',
        layers: Object.freeze([{ src: avatarGlassesHat, className: 'call-banner__avatar--glasses-hat' }]),
        style: Object.freeze({ left: px(193.5), width: px(160) }),
    }),
    Object.freeze({
        id: 'beanie',
        tone: 'rose',
        layers: Object.freeze([
            { src: avatarBeanieBody, className: 'call-banner__avatar--beanie-body' },
            { src: avatarBeanieHead, className: 'call-banner__avatar--beanie-head' },
            { src: avatarBeanieHat, className: 'call-banner__avatar--beanie-hat' },
            { src: avatarBeanieGlasses, className: 'call-banner__avatar--beanie-glasses' },
            { src: avatarBeanieExpression, className: 'call-banner__avatar--beanie-expression' },
        ]),
        style: Object.freeze({ left: px(363.5), width: px(160) }),
    }),
    Object.freeze({
        id: 'sidecap',
        tone: 'purple',
        layers: Object.freeze([
            { src: avatarSidecapHalo, className: 'call-banner__avatar--sidecap-halo' },
            { src: avatarSidecapBody, className: 'call-banner__avatar--sidecap-body' },
            { src: avatarSidecapHead, className: 'call-banner__avatar--sidecap-head' },
            { src: avatarSidecapHat, className: 'call-banner__avatar--sidecap-hat' },
            { src: avatarSidecapExpression, className: 'call-banner__avatar--sidecap-expression' },
        ]),
        style: Object.freeze({ left: px(533.5), width: px(159) }),
    }),
]);
const landingDecorIcons = Object.freeze([
    Object.freeze({
        alt: 'Camera',
        asset: landingCameraIcon,
        style: Object.freeze({
            left: px(557),
            top: px(694),
            width: px(127),
            height: px(96),
            transform: 'rotate(20deg)',
        }),
    }),
    Object.freeze({
        alt: 'Megaphone',
        asset: landingMegaphoneIcon,
        style: Object.freeze({
            left: px(1699),
            top: px(1091),
            width: px(137),
            height: px(134),
            transform: 'rotate(-12deg)',
        }),
    }),
    Object.freeze({
        alt: 'Microphone',
        asset: landingMicrophoneIcon,
        style: Object.freeze({
            left: px(618),
            top: px(1752),
            width: px(101),
            height: px(101),
            transform: 'rotate(4deg)',
        }),
    }),
    Object.freeze({
        alt: 'Monitor',
        asset: landingMonitorIcon,
        style: Object.freeze({
            left: px(1918),
            top: px(1921),
            width: px(132),
            height: px(102),
            transform: 'rotate(8deg)',
        }),
    }),
]);
const landingGameCards = computed(() => [
    {
        id: 'eat-first',
        title: t('home.gameEatFirst'),
        to: { name: 'eat' },
        image: eatFirstIcon,
        ariaLabel: t('home.openEatFirst'),
        tone: 'amber',
    },
    {
        id: 'mafia',
        title: t('home.gameMafia'),
        to: mafiaRoute,
        image: mafiaIcon,
        ariaLabel: t('home.openMafia'),
        tone: 'slate',
    },
    {
        id: 'nadle',
        title: t('home.gameNadle'),
        to: { name: 'nadle-streamer', params: { streamer: defaultNadleStreamer } },
        image: nadleGameIcon,
        ariaLabel: t('home.openNadle'),
        tone: 'green',
    },
    {
        id: 'nadraw',
        title: t('home.gameNadraw'),
        to: { name: 'nadraw-show', params: { streamer: defaultNadleStreamer } },
        image: nadrawPhoneIcon,
        ariaLabel: t('home.openNadraw'),
        tone: 'violet',
    },
    {
        id: 'durak',
        title: t('home.gameDurak'),
        image: durakCardImage,
        ariaLabel: t('home.openDurak'),
        tone: 'slate',
        comingSoon: {
            eyebrow: t('home.comingSoonEyebrow'),
            title: t('home.gameDurak'),
            description: t('home.gameDurakComingSoonDesc'),
            status: t('home.comingSoonStatus'),
        },
    },
    {
        id: 'checkers',
        title: t('home.gameCheckers'),
        to: checkersRoute,
        image: checkersMarkImage,
        ariaLabel: t('home.openCheckers'),
        tone: 'amber',
        prefetch: prefetchCheckers,
    },
]);
const socialLinks = Object.freeze([
    Object.freeze({
        alt: 'Instagram',
        icon: instagramIcon,
        href: 'https://www.instagram.com/nad1ch_/',
        style: Object.freeze({
            left: px(884.25),
            top: px(2233.56),
            width: px(62.58),
            height: px(62.58),
        }),
    }),
    Object.freeze({
        alt: 'TikTok',
        icon: tiktokIcon,
        href: 'https://www.tiktok.com/@nad1ch',
        style: Object.freeze({
            left: px(993.94),
            top: px(2234.27),
            width: px(61.17),
            height: px(61.17),
        }),
    }),
    Object.freeze({
        alt: 'Telegram',
        icon: telegramIcon,
        href: 'https://t.me/nad1ch_tgh',
        style: Object.freeze({
            left: px(1100.81),
            top: px(2229.7),
            width: px(70.31),
            height: px(70.31),
        }),
    }),
    Object.freeze({
        alt: 'Twitch',
        icon: twitchIcon,
        href: STREAMER_TWITCH_URL,
        style: Object.freeze({
            left: px(1233),
            top: px(2229),
            width: px(71.72),
            height: px(71.72),
        }),
    }),
]);
const footerProduct = computed(() => [
    t('landing.footerProductTitle'),
    t('landing.footerNitro'),
    t('landing.footerStatus'),
    t('landing.footerPolicies'),
    t('landing.footerTerms'),
    t('landing.footerPrivacy'),
    t('landing.footerCookieSettings'),
]);
const footerAbout = computed(() => [
    t('landing.footerAboutTitle'),
    t('landing.footerJobs'),
    t('landing.footerBrand'),
    t('landing.footerNewsroom'),
    t('landing.footerDevelopers'),
]);
async function selectLocale(code) {
    await persistLocale(code);
}
const LANDING_FLOW_LAYOUT_MEDIA = '(max-width: 960px)';
function landingPrefersReducedMotion() {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
function landingUsesFlowLayout() {
    return typeof window !== 'undefined' && window.matchMedia(LANDING_FLOW_LAYOUT_MEDIA).matches;
}
function syncLandingBackdropUnit() {
    const canvas = landingCanvasElement.value;
    if (typeof window === 'undefined' || canvas == null)
        return;
    if (!landingUsesFlowLayout()) {
        canvas.style.removeProperty('--landing-backdrop-u');
        return;
    }
    const width = canvas.clientWidth;
    const height = canvas.scrollHeight;
    if (width <= 0 || height <= 0)
        return;
    canvas.style.setProperty('--landing-backdrop-u', `${Math.max(width / 2560, height / 2655)}px`);
}
function getLandingFlowScrollTop(hash) {
    if (typeof window === 'undefined' || !landingUsesFlowLayout())
        return null;
    const target = document.querySelector(hash);
    if (target == null)
        return null;
    const top = window.scrollY + target.getBoundingClientRect().top;
    return Number.isFinite(top) ? Math.max(top - 16, 0) : null;
}
function scrollLandingToHash(hash) {
    if (typeof window === 'undefined')
        return;
    const top = getLandingFlowScrollTop(hash) ?? getLandingScrollTopForHash(hash);
    window.scrollTo({ top, behavior: landingPrefersReducedMotion() ? 'auto' : 'smooth' });
}
function goLandingNav(href) {
    const hash = href.startsWith('#') ? href : `#${href}`;
    void router.push({ path: '/', query: route.query, hash });
}
async function goLandingAuth() {
    await auth.ensureAuthLoaded();
    await router.push(auth.isAuthenticated.value ? { path: '/app' } : authRouteLogin);
}
function waitForLandingImage(src) {
    return new Promise((resolve) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = src;
    });
}
function waitForLandingFonts() {
    if (typeof document === 'undefined' || document.fonts == null) {
        return Promise.resolve();
    }
    return document.fonts.ready.then(() => undefined, () => undefined);
}
function waitForLandingTimeout(ms) {
    return new Promise((resolve) => {
        landingReadyTimer = window.setTimeout(resolve, ms);
    });
}
onMounted(() => {
    syncLandingBackdropUnit();
    if (typeof ResizeObserver !== 'undefined' && landingCanvasElement.value != null) {
        landingCanvasResizeObserver = new ResizeObserver(syncLandingBackdropUnit);
        landingCanvasResizeObserver.observe(landingCanvasElement.value);
    }
    window.addEventListener('resize', syncLandingBackdropUnit);
    void Promise.race([
        Promise.allSettled([
            waitForLandingFonts(),
            ...landingCriticalImageSources.map((src) => waitForLandingImage(src)),
        ]).then(() => undefined),
        waitForLandingTimeout(1400),
    ]).then(() => {
        void nextTick(() => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    landingPageLoading.value = false;
                });
            });
        });
    });
});
onUnmounted(() => {
    if (landingReadyTimer !== undefined) {
        window.clearTimeout(landingReadyTimer);
    }
    landingCanvasResizeObserver?.disconnect();
    window.removeEventListener('resize', syncLandingBackdropUnit);
});
watch(() => route.hash, (hash) => {
    void nextTick(() => {
        if (!hash)
            return;
        scrollLandingToHash(hash);
    });
}, { immediate: true });
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['landing__dot']} */ ;
/** @type {__VLS_StyleScopedClasses['landing__glow']} */ ;
/** @type {__VLS_StyleScopedClasses['landing__bolt']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-header__nav-link']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-header__nav-link']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-auth']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-auth']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-auth']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-auth']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-auth__link']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-auth']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-auth__link']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-hero__screen']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-hero__screen']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-hero__core']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-hero__screen-notch']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-hero__mini-card']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-hero__mini-card-line']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-hero__title']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-hero__tagline']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-auth__link']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-hero__lead']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section__title']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section__lead']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section__title']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section--videocall']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section__lead']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__title']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__title']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__card']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__card']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__card']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__card']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__card']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__card']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__card--headband']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__card--headband']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__card--headband']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__card--headband']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__card--headband']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__card--bucket']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__card--bucket']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__card--bucket']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__card--bucket']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__card--beanie']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__card--beanie']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__card--beanie']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__card--beanie']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__card--sidecap']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__card--sidecap']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__card--sidecap']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__card--sidecap']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__avatar--host']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__avatar--headphones']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__avatar--cap']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__avatar--glasses-hat']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__avatar--host']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__avatar--headphones']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__avatar--cap']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__avatar--glasses-hat']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__avatar--headband-halo']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__avatar--headband-body']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__avatar--headband-head']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__avatar--headband-hair']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__avatar--headband-expression']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__avatar--headband-marks']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__avatar--bucket-halo']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__avatar--sidecap-halo']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__avatar--bucket-halo']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__avatar--bucket-body']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__avatar--bucket-head']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__avatar--bucket-hat']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__avatar--bucket-expression']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__avatar--beanie-body']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__avatar--beanie-head']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__avatar--beanie-hat']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__avatar--beanie-glasses']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__avatar--beanie-expression']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__avatar--sidecap-halo']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__avatar--sidecap-body']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__avatar--sidecap-head']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__avatar--sidecap-hat']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__avatar--sidecap-expression']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section__title']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section--games']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section__lead']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-games-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-games-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-games-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-games-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-games-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-games-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-games-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['games-grid__card']} */ ;
/** @type {__VLS_StyleScopedClasses['games-grid__card']} */ ;
/** @type {__VLS_StyleScopedClasses['games-grid__icon']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section__title']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section--economy']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section__lead']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__seo-link']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__seo-link']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__locale-action']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__feedback-action']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__locale-action']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__feedback-action']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__locale-action']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__feedback-action']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__locale-action']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__locale-action']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__feedback-action']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__feedback-action']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__social']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__social']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__product']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__about']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__product']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__about']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__product']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__about']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__product']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__about']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-auth']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-auth']} */ ;
/** @type {__VLS_StyleScopedClasses['landing__canvas']} */ ;
/** @type {__VLS_StyleScopedClasses['landing__canvas']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-header__brand']} */ ;
/** @type {__VLS_StyleScopedClasses['landing__canvas']} */ ;
/** @type {__VLS_StyleScopedClasses['landing__background']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-decor-icons']} */ ;
/** @type {__VLS_StyleScopedClasses['landing__bolt']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-decor-icons__item']} */ ;
/** @type {__VLS_StyleScopedClasses['landing__wordmark']} */ ;
/** @type {__VLS_StyleScopedClasses['landing__wordmark--1']} */ ;
/** @type {__VLS_StyleScopedClasses['landing__wordmark--2']} */ ;
/** @type {__VLS_StyleScopedClasses['landing__wordmark--3']} */ ;
/** @type {__VLS_StyleScopedClasses['landing__wordmark--4']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-topbar']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-auth']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-topbar']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-header__brand']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-header__brand-mark']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-header__brand-name']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-header__nav']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-header__nav']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-header__nav-link']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-auth']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-auth']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-auth__link']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-auth__link']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-hero']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-hero__copy']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-hero__headline']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-hero__tagline']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-hero__lead']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-hero__tagline']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-hero__lead']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-hero__screen']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section__title']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section__lead']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section__title']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section__lead']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section--videocall']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section__title']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section--videocall']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section__lead']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section--games']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section__title']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section--games']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section__lead']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section--economy']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section__title']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section--economy']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section__lead']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section--videocall']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section--games']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section--economy']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__title']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__cards']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__title']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__cards']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__card']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__card']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__card']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__card']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__card']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__card']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__card']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__card']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__card']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__card']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__card']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__card']} */ ;
/** @type {__VLS_StyleScopedClasses['games-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-games-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-games-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['app-games__panel']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-games-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['app-games__title']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-games-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['app-games__lead']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-games-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['app-games__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-games-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-games-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card__title']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-games-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card__visual']} */ ;
/** @type {__VLS_StyleScopedClasses['games-grid__card']} */ ;
/** @type {__VLS_StyleScopedClasses['games-grid__label']} */ ;
/** @type {__VLS_StyleScopedClasses['games-grid__icon']} */ ;
/** @type {__VLS_StyleScopedClasses['games-grid__card']} */ ;
/** @type {__VLS_StyleScopedClasses['games-grid__icon']} */ ;
/** @type {__VLS_StyleScopedClasses['games-grid__card']} */ ;
/** @type {__VLS_StyleScopedClasses['games-grid__card']} */ ;
/** @type {__VLS_StyleScopedClasses['games-grid__card']} */ ;
/** @type {__VLS_StyleScopedClasses['games-grid__card']} */ ;
/** @type {__VLS_StyleScopedClasses['games-grid__card']} */ ;
/** @type {__VLS_StyleScopedClasses['games-grid__card']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section--economy']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section__lead']} */ ;
/** @type {__VLS_StyleScopedClasses['economy-banner']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__seo']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__panel']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__static']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__locale-action']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__feedback-action']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__socials']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__social']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__social']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__columns']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__product']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__about']} */ ;
/** @type {__VLS_StyleScopedClasses['landing__canvas']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-topbar']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-header__nav']} */ ;
/** @type {__VLS_StyleScopedClasses['games-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__panel']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__socials']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__social']} */ ;
/** @type {__VLS_StyleScopedClasses['landing__wordmark']} */ ;
/** @type {__VLS_StyleScopedClasses['landing__canvas']} */ ;
/** @type {__VLS_StyleScopedClasses['landing__wordmark']} */ ;
/** @type {__VLS_StyleScopedClasses['landing__wordmark--1']} */ ;
/** @type {__VLS_StyleScopedClasses['landing__wordmark--2']} */ ;
/** @type {__VLS_StyleScopedClasses['landing__wordmark--3']} */ ;
/** @type {__VLS_StyleScopedClasses['landing__wordmark--4']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-topbar']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-topbar__start']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-header__brand']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-header__brand-mark']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-header__brand-name']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-header__nav']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-header__nav-link']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-auth']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-auth__link']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-hero']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-hero__tagline']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-hero__screen']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-hero__lead']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section--videocall']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section--games']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section--economy']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section__title']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section__lead']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__cards']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__title']} */ ;
/** @type {__VLS_StyleScopedClasses['games-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-games-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-games-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['app-games__title']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-games-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['app-games__lead']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-games-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['app-games__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-games-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-games-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card__title']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-games-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card__visual']} */ ;
/** @type {__VLS_StyleScopedClasses['games-grid__card']} */ ;
/** @type {__VLS_StyleScopedClasses['games-grid__label']} */ ;
/** @type {__VLS_StyleScopedClasses['games-grid__icon']} */ ;
/** @type {__VLS_StyleScopedClasses['games-grid__card']} */ ;
/** @type {__VLS_StyleScopedClasses['games-grid__card']} */ ;
/** @type {__VLS_StyleScopedClasses['games-grid__card']} */ ;
/** @type {__VLS_StyleScopedClasses['games-grid__card']} */ ;
/** @type {__VLS_StyleScopedClasses['games-grid__card']} */ ;
/** @type {__VLS_StyleScopedClasses['games-grid__card']} */ ;
/** @type {__VLS_StyleScopedClasses['economy-banner']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__panel']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__locale-action']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__feedback-action']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__columns']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__product']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__about']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__socials']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__social']} */ ;
/** @type {__VLS_StyleScopedClasses['landing__canvas']} */ ;
/** @type {__VLS_StyleScopedClasses['landing__wordmark']} */ ;
/** @type {__VLS_StyleScopedClasses['landing__wordmark--1']} */ ;
/** @type {__VLS_StyleScopedClasses['landing__wordmark--2']} */ ;
/** @type {__VLS_StyleScopedClasses['landing__wordmark--3']} */ ;
/** @type {__VLS_StyleScopedClasses['landing__wordmark--4']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-topbar']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-header__nav']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-header__nav-link']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-auth']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-auth__link']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-hero__headline']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-hero__tagline']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-hero__screen']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-hero__lead']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section__lead']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section__title']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__cards']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__title']} */ ;
/** @type {__VLS_StyleScopedClasses['games-grid']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-games-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['app-games__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-games-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['app-games__title']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-games-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['app-games__lead']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-games-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-games-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card__title']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-games-panel']} */ ;
/** @type {__VLS_StyleScopedClasses['app-game-card__visual']} */ ;
/** @type {__VLS_StyleScopedClasses['games-grid__card']} */ ;
/** @type {__VLS_StyleScopedClasses['games-grid__label']} */ ;
/** @type {__VLS_StyleScopedClasses['games-grid__icon']} */ ;
/** @type {__VLS_StyleScopedClasses['economy-banner']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__panel']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__locale-action']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__feedback-action']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__socials']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__social']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__columns']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__product']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-footer__about']} */ ;
/** @type {__VLS_StyleScopedClasses['landing__dot']} */ ;
/** @type {__VLS_StyleScopedClasses['landing__wordmark']} */ ;
/** @type {__VLS_StyleScopedClasses['landing__background']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner']} */ ;
/** @type {__VLS_StyleScopedClasses['economy-banner']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__card']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__avatar-layer']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner__card']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "landing page-stack" },
});
/** @type {__VLS_StyleScopedClasses['landing']} */ ;
/** @type {__VLS_StyleScopedClasses['page-stack']} */ ;
const __VLS_0 = AppFullPageLoader;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    visible: (__VLS_ctx.landingPageLoading),
    'aria-label': (__VLS_ctx.t('landing.loadingAria')),
    label: "",
}));
const __VLS_2 = __VLS_1({
    visible: (__VLS_ctx.landingPageLoading),
    'aria-label': (__VLS_ctx.t('landing.loadingAria')),
    label: "",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "landingCanvasElement",
    ...{ class: "landing__canvas" },
});
/** @type {__VLS_StyleScopedClasses['landing__canvas']} */ ;
const __VLS_5 = LandingCloudBackdrop;
// @ts-ignore
const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({
    ...{ class: "landing__background" },
}));
const __VLS_7 = __VLS_6({
    ...{ class: "landing__background" },
}, ...__VLS_functionalComponentArgsRest(__VLS_6));
/** @type {__VLS_StyleScopedClasses['landing__background']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "landing-wordmark-layer" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['landing-wordmark-layer']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "landing__wordmark landing__wordmark--1" },
});
/** @type {__VLS_StyleScopedClasses['landing__wordmark']} */ ;
/** @type {__VLS_StyleScopedClasses['landing__wordmark--1']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "landing__wordmark landing__wordmark--2" },
});
/** @type {__VLS_StyleScopedClasses['landing__wordmark']} */ ;
/** @type {__VLS_StyleScopedClasses['landing__wordmark--2']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "landing__wordmark landing__wordmark--3" },
});
/** @type {__VLS_StyleScopedClasses['landing__wordmark']} */ ;
/** @type {__VLS_StyleScopedClasses['landing__wordmark--3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "landing__wordmark landing__wordmark--4" },
});
/** @type {__VLS_StyleScopedClasses['landing__wordmark']} */ ;
/** @type {__VLS_StyleScopedClasses['landing__wordmark--4']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "landing-decor-icons" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['landing-decor-icons']} */ ;
for (const [icon] of __VLS_vFor((__VLS_ctx.landingDecorIcons))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
        key: (icon.alt),
        ...{ class: "landing-decor-icons__item" },
        src: (icon.asset),
        alt: "",
        draggable: "false",
        decoding: "async",
        ...{ style: (icon.style) },
    });
    /** @type {__VLS_StyleScopedClasses['landing-decor-icons__item']} */ ;
    // @ts-ignore
    [landingPageLoading, t, landingDecorIcons,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
    ...{ class: "landing-topbar" },
    'aria-label': (__VLS_ctx.t('landing.siteHeaderAria')),
});
/** @type {__VLS_StyleScopedClasses['landing-topbar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "landing-topbar__start" },
});
/** @type {__VLS_StyleScopedClasses['landing-topbar__start']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "landing-header__brand" },
});
/** @type {__VLS_StyleScopedClasses['landing-header__brand']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.img)({
    ...{ class: "landing-header__brand-mark" },
    src: (__VLS_ctx.BRAND_LOGO_LIGHT_SVG),
    alt: "",
    width: "81",
    height: "104",
    decoding: "async",
    fetchpriority: "high",
});
/** @type {__VLS_StyleScopedClasses['landing-header__brand-mark']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "landing-header__brand-name" },
});
/** @type {__VLS_StyleScopedClasses['landing-header__brand-name']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.nav, __VLS_intrinsics.nav)({
    ...{ class: "landing-topbar__mid landing-header__nav" },
    'aria-label': (__VLS_ctx.t('landing.primaryNavAria')),
});
/** @type {__VLS_StyleScopedClasses['landing-topbar__mid']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-header__nav']} */ ;
for (const [item] of __VLS_vFor((__VLS_ctx.navItems))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.goLandingNav(item.href);
                // @ts-ignore
                [t, t, BRAND_LOGO_LIGHT_SVG, navItems, goLandingNav,];
            } },
        key: (item.label),
        ...{ class: "landing-header__nav-link" },
        href: (item.href),
    });
    /** @type {__VLS_StyleScopedClasses['landing-header__nav-link']} */ ;
    (item.label);
    // @ts-ignore
    [];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "landing-topbar__end landing-auth sa-glass-button" },
    'aria-label': (__VLS_ctx.t('landing.accountAria')),
});
/** @type {__VLS_StyleScopedClasses['landing-topbar__end']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-auth']} */ ;
/** @type {__VLS_StyleScopedClasses['sa-glass-button']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.goLandingAuth) },
    type: "button",
    ...{ class: "landing-auth__link" },
});
/** @type {__VLS_StyleScopedClasses['landing-auth__link']} */ ;
(__VLS_ctx.t('landing.login'));
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "landing-hero" },
    'aria-label': (__VLS_ctx.t('landing.heroAria')),
});
/** @type {__VLS_StyleScopedClasses['landing-hero']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "landing-hero__screen" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['landing-hero__screen']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.img)({
    ...{ class: "landing-hero__browse-illustration" },
    src: (__VLS_ctx.twitchBrowseIllustration),
    alt: "",
});
/** @type {__VLS_StyleScopedClasses['landing-hero__browse-illustration']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "landing-hero__copy" },
});
/** @type {__VLS_StyleScopedClasses['landing-hero__copy']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "landing-hero__headline" },
});
/** @type {__VLS_StyleScopedClasses['landing-hero__headline']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h1, __VLS_intrinsics.h1)({
    ...{ class: "landing-hero__title landing-u-text-outline-heading" },
});
/** @type {__VLS_StyleScopedClasses['landing-hero__title']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-u-text-outline-heading']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "landing-hero__tagline landing-u-text-outline-heading" },
});
/** @type {__VLS_StyleScopedClasses['landing-hero__tagline']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-u-text-outline-heading']} */ ;
(__VLS_ctx.t('landing.newHeroTagline'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "landing-hero__lead" },
});
/** @type {__VLS_StyleScopedClasses['landing-hero__lead']} */ ;
(__VLS_ctx.t('landing.newHeroLead'));
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    id: "videocall",
    ...{ class: "landing-section landing-section--videocall" },
});
/** @type {__VLS_StyleScopedClasses['landing-section']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section--videocall']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "landing-section__title landing-u-text-outline-heading" },
});
/** @type {__VLS_StyleScopedClasses['landing-section__title']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-u-text-outline-heading']} */ ;
(__VLS_ctx.t('landing.videoCallTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "landing-section__lead" },
});
/** @type {__VLS_StyleScopedClasses['landing-section__lead']} */ ;
(__VLS_ctx.t('landing.videoCallLead'));
let __VLS_10;
/** @ts-ignore @type { | typeof __VLS_components.RouterLink | typeof __VLS_components.RouterLink} */
RouterLink;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
    ...{ class: "call-banner" },
    ...{ class: ({ 'call-banner--compact-title': __VLS_ctx.locale === 'uk' }) },
    to: (__VLS_ctx.callRoute),
}));
const __VLS_12 = __VLS_11({
    ...{ class: "call-banner" },
    ...{ class: ({ 'call-banner--compact-title': __VLS_ctx.locale === 'uk' }) },
    to: (__VLS_ctx.callRoute),
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
/** @type {__VLS_StyleScopedClasses['call-banner']} */ ;
/** @type {__VLS_StyleScopedClasses['call-banner--compact-title']} */ ;
const { default: __VLS_15 } = __VLS_13.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "call-banner__title landing-u-text-outline-cta" },
});
/** @type {__VLS_StyleScopedClasses['call-banner__title']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-u-text-outline-cta']} */ ;
(__VLS_ctx.t('landing.videoCallCta'));
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "call-banner__cards" },
});
/** @type {__VLS_StyleScopedClasses['call-banner__cards']} */ ;
for (const [card, index] of __VLS_vFor((__VLS_ctx.callBannerCards))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        key: (`call-card-${index}`),
        ...{ class: "call-banner__card" },
        ...{ class: ([`call-banner__card--${card.tone}`, `call-banner__card--${card.id}`]) },
        ...{ style: (card.style) },
    });
    /** @type {__VLS_StyleScopedClasses['call-banner__card']} */ ;
    for (const [layer] of __VLS_vFor((card.layers))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
            key: (layer.className),
            ...{ class: "call-banner__avatar-layer" },
            ...{ class: (layer.className) },
            src: (layer.src),
            alt: "",
            loading: "eager",
            decoding: "async",
        });
        /** @type {__VLS_StyleScopedClasses['call-banner__avatar-layer']} */ ;
        // @ts-ignore
        [t, t, t, t, t, t, t, t, goLandingAuth, twitchBrowseIllustration, locale, callRoute, callBannerCards,];
    }
    // @ts-ignore
    [];
}
// @ts-ignore
[];
var __VLS_13;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    id: "games",
    ...{ class: "landing-section landing-section--games" },
});
/** @type {__VLS_StyleScopedClasses['landing-section']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section--games']} */ ;
const __VLS_16 = AppGamesSection;
// @ts-ignore
const __VLS_17 = __VLS_asFunctionalComponent1(__VLS_16, new __VLS_16({
    ...{ class: "landing-games-panel" },
    items: (__VLS_ctx.landingGameCards),
    lead: (__VLS_ctx.t('landing.gamesLead')),
}));
const __VLS_18 = __VLS_17({
    ...{ class: "landing-games-panel" },
    items: (__VLS_ctx.landingGameCards),
    lead: (__VLS_ctx.t('landing.gamesLead')),
}, ...__VLS_functionalComponentArgsRest(__VLS_17));
/** @type {__VLS_StyleScopedClasses['landing-games-panel']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    id: "economy",
    ...{ class: "landing-section landing-section--economy" },
});
/** @type {__VLS_StyleScopedClasses['landing-section']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-section--economy']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "landing-section__title landing-u-text-outline-heading" },
});
/** @type {__VLS_StyleScopedClasses['landing-section__title']} */ ;
/** @type {__VLS_StyleScopedClasses['landing-u-text-outline-heading']} */ ;
(__VLS_ctx.t('landing.economyTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "landing-section__lead" },
});
/** @type {__VLS_StyleScopedClasses['landing-section__lead']} */ ;
(__VLS_ctx.t('landing.economyLead'));
const __VLS_21 = EconomySlotBanner;
// @ts-ignore
const __VLS_22 = __VLS_asFunctionalComponent1(__VLS_21, new __VLS_21({
    ...{ class: "economy-banner" },
    to: (__VLS_ctx.economyComingSoonRoute),
}));
const __VLS_23 = __VLS_22({
    ...{ class: "economy-banner" },
    to: (__VLS_ctx.economyComingSoonRoute),
}, ...__VLS_functionalComponentArgsRest(__VLS_22));
/** @type {__VLS_StyleScopedClasses['economy-banner']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.footer, __VLS_intrinsics.footer)({
    id: "footer",
    ...{ class: "landing-footer" },
    'aria-label': (__VLS_ctx.t('landing.siteFooterAria')),
});
/** @type {__VLS_StyleScopedClasses['landing-footer']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.nav, __VLS_intrinsics.nav)({
    ...{ class: "landing-footer__seo" },
    'aria-label': (__VLS_ctx.t('landing.guidesAria')),
});
/** @type {__VLS_StyleScopedClasses['landing-footer__seo']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
    ...{ class: "landing-footer__seo-link" },
    href: "/video-calls-for-streamers/",
});
/** @type {__VLS_StyleScopedClasses['landing-footer__seo-link']} */ ;
(__VLS_ctx.t('landing.seoVideoCalls'));
__VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
    ...{ class: "landing-footer__seo-link" },
    href: "/twitch-nadle-game/",
});
/** @type {__VLS_StyleScopedClasses['landing-footer__seo-link']} */ ;
(__VLS_ctx.t('landing.seoNadle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
    ...{ class: "landing-footer__seo-link" },
    href: "/stream-overlay-tools/",
});
/** @type {__VLS_StyleScopedClasses['landing-footer__seo-link']} */ ;
(__VLS_ctx.t('landing.seoOverlay'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "landing-footer__panel" },
});
/** @type {__VLS_StyleScopedClasses['landing-footer__panel']} */ ;
const __VLS_26 = AppLandingFooterActions;
// @ts-ignore
const __VLS_27 = __VLS_asFunctionalComponent1(__VLS_26, new __VLS_26({
    ...{ 'onUpdate:locale': {} },
    ...{ class: "landing-footer__locale-action" },
    locale: (__VLS_ctx.locale),
    localeOptions: (__VLS_ctx.landingFooterLocaleOptions),
    mode: "locale",
    tone: "light",
}));
const __VLS_28 = __VLS_27({
    ...{ 'onUpdate:locale': {} },
    ...{ class: "landing-footer__locale-action" },
    locale: (__VLS_ctx.locale),
    localeOptions: (__VLS_ctx.landingFooterLocaleOptions),
    mode: "locale",
    tone: "light",
}, ...__VLS_functionalComponentArgsRest(__VLS_27));
let __VLS_31;
const __VLS_32 = ({ 'update:locale': {} },
    { 'onUpdate:locale': (__VLS_ctx.selectLocale) });
/** @type {__VLS_StyleScopedClasses['landing-footer__locale-action']} */ ;
var __VLS_29;
var __VLS_30;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "landing-footer__static" },
});
/** @type {__VLS_StyleScopedClasses['landing-footer__static']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "landing-footer__socials" },
});
/** @type {__VLS_StyleScopedClasses['landing-footer__socials']} */ ;
for (const [item] of __VLS_vFor((__VLS_ctx.socialLinks))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
        key: (item.alt),
        ...{ class: "landing-footer__social" },
        href: (item.href),
        target: "_blank",
        rel: "noreferrer",
        'aria-label': (item.alt),
        ...{ style: (item.style) },
    });
    /** @type {__VLS_StyleScopedClasses['landing-footer__social']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
        src: (item.icon),
        alt: (item.alt),
        width: "128",
        height: "128",
        loading: "lazy",
    });
    // @ts-ignore
    [t, t, t, t, t, t, t, t, locale, landingGameCards, economyComingSoonRoute, landingFooterLocaleOptions, selectLocale, socialLinks,];
}
const __VLS_33 = AppLandingFooterActions;
// @ts-ignore
const __VLS_34 = __VLS_asFunctionalComponent1(__VLS_33, new __VLS_33({
    ...{ class: "landing-footer__feedback-action" },
    feedbackHref: (__VLS_ctx.landingFeedbackHref),
    mode: "feedback",
    tone: "light",
}));
const __VLS_35 = __VLS_34({
    ...{ class: "landing-footer__feedback-action" },
    feedbackHref: (__VLS_ctx.landingFeedbackHref),
    mode: "feedback",
    tone: "light",
}, ...__VLS_functionalComponentArgsRest(__VLS_34));
/** @type {__VLS_StyleScopedClasses['landing-footer__feedback-action']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "landing-footer__columns" },
});
/** @type {__VLS_StyleScopedClasses['landing-footer__columns']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "landing-footer__product" },
});
/** @type {__VLS_StyleScopedClasses['landing-footer__product']} */ ;
for (const [item] of __VLS_vFor((__VLS_ctx.footerProduct))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        key: (item),
    });
    (item);
    // @ts-ignore
    [landingFeedbackHref, footerProduct,];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "landing-footer__about" },
});
/** @type {__VLS_StyleScopedClasses['landing-footer__about']} */ ;
for (const [item] of __VLS_vFor((__VLS_ctx.footerAbout))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        key: (item),
    });
    (item);
    // @ts-ignore
    [footerAbout,];
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
