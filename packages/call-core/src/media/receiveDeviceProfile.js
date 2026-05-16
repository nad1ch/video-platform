/**
 * Receive-side device capability hints for adaptive inbound simulcast policy.
 * Pure, coarse-grained classification — no fingerprinting, safe defaults on missing APIs.
 */
export const RECEIVE_DEVICE_DEFAULT_MAX_HIGH = 2;
export const RECEIVE_DEVICE_DEFAULT_MAX_MEDIUM = 8;
function mobileProfile() {
    return {
        profile: 'mobile',
        maxHighStreams: 1,
        maxMediumStreams: 3,
        allowRenderSuppression: true,
        maxActiveRemoteVideos: 4,
        pressureBadStreakToShift: 2,
    };
}
function constrainedProfile() {
    return {
        profile: 'constrained',
        maxHighStreams: 1,
        maxMediumStreams: 4,
        allowRenderSuppression: true,
        maxActiveRemoteVideos: 5,
        pressureBadStreakToShift: 2,
    };
}
function strongProfile() {
    return {
        profile: 'strong',
        maxHighStreams: RECEIVE_DEVICE_DEFAULT_MAX_HIGH,
        maxMediumStreams: RECEIVE_DEVICE_DEFAULT_MAX_MEDIUM,
        allowRenderSuppression: false,
        maxActiveRemoteVideos: 9,
        pressureBadStreakToShift: 4,
    };
}
function defaultProfile() {
    return {
        profile: 'default',
        maxHighStreams: RECEIVE_DEVICE_DEFAULT_MAX_HIGH,
        maxMediumStreams: RECEIVE_DEVICE_DEFAULT_MAX_MEDIUM,
        allowRenderSuppression: false,
        maxActiveRemoteVideos: 7,
        pressureBadStreakToShift: 3,
    };
}
function isLikelyHandheldUa(ua) {
    if (!ua) {
        return false;
    }
    if (/iPhone|iPod|iPad/i.test(ua)) {
        return true;
    }
    if (/Android/i.test(ua)) {
        return true;
    }
    if (/Mobile/i.test(ua) && /Safari/i.test(ua)) {
        return true;
    }
    return false;
}
/**
 * Classify this client for inbound simulcast slot budgets and receive-pressure tuning.
 */
export function resolveReceiveDeviceProfile(input) {
    const fallback = defaultProfile();
    if (!input || typeof input !== 'object') {
        return fallback;
    }
    const ua = typeof input.userAgent === 'string' ? input.userAgent : '';
    const cores = typeof input.hardwareConcurrency === 'number' &&
        Number.isFinite(input.hardwareConcurrency) &&
        input.hardwareConcurrency > 0
        ? Math.floor(input.hardwareConcurrency)
        : 0;
    const mem = typeof input.deviceMemory === 'number' &&
        Number.isFinite(input.deviceMemory) &&
        input.deviceMemory > 0
        ? input.deviceMemory
        : undefined;
    if (isLikelyHandheldUa(ua)) {
        return mobileProfile();
    }
    const weakCpu = cores > 0 && cores <= 4;
    const weakRam = mem !== undefined && mem <= 4;
    if (weakCpu || weakRam) {
        return constrainedProfile();
    }
    const strongCpu = cores >= 8;
    const strongManyCores = cores >= 12;
    const strongRam = mem !== undefined && mem >= 8;
    if (strongCpu && (strongManyCores || strongRam || mem === undefined)) {
        return strongProfile();
    }
    return fallback;
}
export function readNavigatorDeviceProfileInput() {
    if (typeof globalThis === 'undefined' || typeof globalThis.navigator === 'undefined') {
        return undefined;
    }
    const nav = globalThis.navigator;
    return {
        hardwareConcurrency: nav.hardwareConcurrency,
        deviceMemory: nav.deviceMemory,
        userAgent: typeof nav.userAgent === 'string' ? nav.userAgent : '',
    };
}
