/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAdminUsersState } from '@/admin';
import { useAuth } from '@/composables/useAuth';
import { appConfirm } from '@/utils/appConfirm';
import { apiFetch } from '@/utils/apiFetch';
import { trackClientEvent } from '@/utils/clientAnalytics';
const { t, locale } = useI18n();
const auth = useAuth();
const { users, loading, errorKey, databaseConfigured, lastUpdated, load } = useAdminUsersState();
const searchQuery = ref('');
const sortKey = ref('name');
const copyFeedbackId = ref(null);
let copyFeedbackTimer = null;
const rolePatchingId = ref(null);
const rolePatchError = ref(null);
const streamerOptions = ref([]);
const streamerOptionsLoading = ref(false);
const streamerOptionsLoaded = ref(false);
const streamerPickerUserId = ref(null);
const streamerPickerSelection = ref('');
const detailUserId = ref(null);
const detailActivity = ref(null);
const detailActivityLoading = ref(false);
const detailActivityError = ref(null);
let detailActivityRequestId = 0;
const detailUser = computed(() => {
    if (!detailUserId.value)
        return null;
    return users.value.find((u) => u.id === detailUserId.value) ?? null;
});
const rating = (u) => u.wins - Math.max(0, u.gamesPlayed - u.wins);
const editableRoles = ['ADMIN', 'STREAMER', 'EAT_FIRST_OPERATOR'];
const empty = computed(() => !loading.value && !errorKey.value && users.value.length === 0);
const summary = computed(() => {
    if (!users.value.length)
        return null;
    const admins = users.value.filter((u) => hasSystemRole(u, 'ADMIN')).length;
    const avgWins = users.value.reduce((s, u) => s + u.wins, 0) / users.value.length;
    return { total: users.value.length, admins, avgWins };
});
const filteredSorted = computed(() => {
    const q = searchQuery.value.trim().toLowerCase();
    let list = users.value;
    if (q) {
        list = list.filter((u) => u.displayName.toLowerCase().includes(q) ||
            u.id.toLowerCase().includes(q) ||
            u.provider.toLowerCase().includes(q) ||
            displayRoles(u).toLowerCase().includes(q));
    }
    const out = [...list];
    if (sortKey.value === 'name') {
        out.sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));
    }
    else if (sortKey.value === 'wins') {
        out.sort((a, b) => b.wins - a.wins || a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));
    }
    else {
        out.sort((a, b) => rating(b) - rating(a) || a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));
    }
    return out;
});
const showToolbar = computed(() => !loading.value && !errorKey.value && databaseConfigured.value && users.value.length > 0);
const noSearchMatches = computed(() => !loading.value && !errorKey.value && databaseConfigured.value && users.value.length > 0 && filteredSorted.value.length === 0);
watch(users, (list) => {
    if (detailUserId.value && !list.some((u) => u.id === detailUserId.value)) {
        detailUserId.value = null;
    }
});
watch(detailUserId, (userId) => {
    detailActivity.value = null;
    detailActivityError.value = null;
    detailActivityRequestId += 1;
    if (userId) {
        void loadUserActivity(userId, detailActivityRequestId);
    }
});
function dashText(value) {
    const s = typeof value === 'string' ? value.trim() : '';
    return s ? s : '—';
}
function formatUpdated(d) {
    try {
        return new Intl.DateTimeFormat(locale.value || undefined, { dateStyle: 'short', timeStyle: 'short' }).format(d);
    }
    catch {
        return d.toLocaleString();
    }
}
function formatIso(iso) {
    if (!iso?.trim()) {
        return '—';
    }
    try {
        return formatUpdated(new Date(iso));
    }
    catch {
        return '—';
    }
}
function formatDuration(seconds) {
    const total = Math.max(0, Math.round(seconds ?? 0));
    if (total < 60) {
        return `${total}s`;
    }
    const minutes = Math.floor(total / 60);
    const hours = Math.floor(minutes / 60);
    const restMinutes = minutes % 60;
    return hours > 0 ? `${hours}h ${restMinutes}m` : `${minutes}m`;
}
function formatMetadata(value) {
    if (!value || typeof value !== 'object') {
        return '—';
    }
    try {
        const json = JSON.stringify(value);
        return json === '{}' ? '—' : json;
    }
    catch {
        return '—';
    }
}
async function loadUserActivity(userId, requestId) {
    detailActivityLoading.value = true;
    detailActivityError.value = null;
    try {
        const r = await apiFetch(`/api/admin/users/${encodeURIComponent(userId)}/activity`);
        if (!r.ok) {
            detailActivityError.value = 'Could not load activity.';
            return;
        }
        const data = (await r.json());
        if (requestId === detailActivityRequestId) {
            detailActivity.value = data;
        }
    }
    catch {
        if (requestId === detailActivityRequestId) {
            detailActivityError.value = 'Could not load activity.';
        }
    }
    finally {
        if (requestId === detailActivityRequestId) {
            detailActivityLoading.value = false;
        }
    }
}
function openUserDetail(u) {
    detailUserId.value = u.id;
}
function closeUserDetail() {
    detailUserId.value = null;
}
function onDocKeydown(e) {
    if (e.key !== 'Escape' || !detailUserId.value) {
        return;
    }
    closeUserDetail();
}
function escapeCsvCell(value) {
    if (/[",\n\r]/.test(value))
        return `"${value.replace(/"/g, '""')}"`;
    return value;
}
function exportCsv() {
    const headers = ['id', 'displayName', 'provider', 'role', 'wins', 'gamesPlayed', 'rating'];
    const lines = [
        headers.join(','),
        ...filteredSorted.value.map((u) => [
            escapeCsvCell(u.id),
            escapeCsvCell(u.displayName),
            escapeCsvCell(u.provider),
            escapeCsvCell(displayRoles(u)),
            String(u.wins),
            String(u.gamesPlayed),
            String(rating(u)),
        ].join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}
function normalizedRoles(u) {
    const roles = new Set(['USER']);
    for (const role of u.roles ?? []) {
        roles.add(role);
    }
    for (const permission of u.permissions ?? []) {
        roles.add(permission);
    }
    if (u.role === 'admin') {
        roles.add('ADMIN');
    }
    else if (u.role === 'host') {
        roles.add('EAT_FIRST_OPERATOR');
    }
    return roles;
}
function hasSystemRole(u, role) {
    return normalizedRoles(u).has(role);
}
function displayRoles(u) {
    return [...normalizedRoles(u)].map(roleLabel).join(', ');
}
function roleLabel(role) {
    if (role === 'EAT_FIRST_OPERATOR') {
        return 'Eat First operator';
    }
    return role === 'USER' ? t('adminPanel.roleUser') : role;
}
function isSelfAdminRole(u, role) {
    return role === 'ADMIN' && u.id === auth.user.value?.dbUserId;
}
function roleToggleDisabled(u, role) {
    if (rolePatchingId.value === u.id || isSelfAdminRole(u, role)) {
        return true;
    }
    if (role === 'EAT_FIRST_OPERATOR' && hasSystemRole(u, 'ADMIN')) {
        return true;
    }
    if (role === 'STREAMER' && !hasSystemRole(u, 'STREAMER') && !u.streamerId && !u.twitchId) {
        return true;
    }
    return false;
}
function canAssignStreamerViaPicker(u) {
    return !hasSystemRole(u, 'STREAMER') && !u.streamerId && !u.twitchId;
}
function closeStreamerRolePicker() {
    streamerPickerUserId.value = null;
    streamerPickerSelection.value = '';
}
function streamerOptionLabel(option) {
    const base = option.name.trim().length > 0 ? option.name : option.username;
    return option.ownerId ? `${base} (${t('adminPanel.streamersOwnerShort')} ${option.ownerId.slice(0, 8)}…)` : base;
}
async function ensureStreamerOptionsLoaded() {
    if (streamerOptionsLoaded.value) {
        return true;
    }
    streamerOptionsLoading.value = true;
    try {
        const r = await apiFetch('/api/admin/streamers');
        if (!r.ok) {
            rolePatchError.value = t('adminPanel.usersStreamerOptionsLoadError');
            return false;
        }
        const payload = (await r.json());
        streamerOptions.value = (payload.streamers ?? [])
            .filter((streamer) => streamer.isActive)
            .map((streamer) => ({
            id: streamer.id,
            name: streamer.name,
            username: streamer.username,
            ownerId: streamer.ownerId,
        }))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        streamerOptionsLoaded.value = true;
        return true;
    }
    catch {
        rolePatchError.value = t('adminPanel.usersStreamerOptionsLoadError');
        return false;
    }
    finally {
        streamerOptionsLoading.value = false;
    }
}
async function patchUserRoles(u, nextRoles, streamerIdOverride) {
    rolePatchError.value = null;
    rolePatchingId.value = u.id;
    try {
        const roles = [...nextRoles].filter((role) => role === 'USER' || role === 'ADMIN' || role === 'STREAMER');
        const permissions = [...nextRoles].filter((role) => role === 'EAT_FIRST_OPERATOR');
        const streamerId = typeof streamerIdOverride === 'string' && streamerIdOverride.length > 0
            ? streamerIdOverride
            : u.streamerId;
        const r = await apiFetch(`/api/admin/users/${encodeURIComponent(u.id)}/role`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roles, permissions, ...(streamerId ? { streamerId } : {}) }),
        });
        if (!r.ok) {
            rolePatchError.value = t('adminPanel.usersRolePatchError');
            return false;
        }
        await load();
        return true;
    }
    catch {
        rolePatchError.value = t('adminPanel.usersRolePatchError');
        return false;
    }
    finally {
        rolePatchingId.value = null;
    }
}
async function onRoleToggle(u, role, ev) {
    const input = ev.target;
    if (roleToggleDisabled(u, role)) {
        input.checked = hasSystemRole(u, role);
        return;
    }
    trackClientEvent('admin_role_toggle_clicked', { targetUserId: u.id, role, enabled: input.checked });
    if (!input.checked && role === 'ADMIN' && !appConfirm(`Remove ADMIN from ${u.displayName}? They will lose admin panel access.`)) {
        input.checked = true;
        return;
    }
    if (!input.checked &&
        role === 'STREAMER' &&
        !appConfirm(`Remove STREAMER from ${u.displayName}? This clears streamer ownership and streamer context.`)) {
        input.checked = true;
        return;
    }
    const nextRoles = normalizedRoles(u);
    if (input.checked) {
        nextRoles.add(role);
    }
    else {
        nextRoles.delete(role);
    }
    nextRoles.add('USER');
    if (nextRoles.has('ADMIN')) {
        nextRoles.delete('EAT_FIRST_OPERATOR');
    }
    const ok = await patchUserRoles(u, nextRoles);
    if (!ok) {
        input.checked = hasSystemRole(u, role);
    }
}
async function openStreamerRolePicker(u) {
    if (streamerPickerUserId.value === u.id) {
        closeStreamerRolePicker();
        return;
    }
    rolePatchError.value = null;
    const loaded = await ensureStreamerOptionsLoaded();
    if (!loaded) {
        return;
    }
    streamerPickerUserId.value = u.id;
    const firstFree = streamerOptions.value.find((streamer) => streamer.ownerId == null);
    streamerPickerSelection.value = firstFree?.id ?? streamerOptions.value[0]?.id ?? '';
}
async function assignStreamerRoleFromPicker(u) {
    const streamerId = streamerPickerSelection.value;
    if (!streamerId) {
        rolePatchError.value = t('adminPanel.usersStreamerPickerRequired');
        return;
    }
    const nextRoles = normalizedRoles(u);
    nextRoles.add('STREAMER');
    nextRoles.add('USER');
    if (nextRoles.has('ADMIN')) {
        nextRoles.delete('EAT_FIRST_OPERATOR');
    }
    const ok = await patchUserRoles(u, nextRoles, streamerId);
    if (ok) {
        closeStreamerRolePicker();
    }
}
async function copyId(id) {
    try {
        await navigator.clipboard.writeText(id);
    }
    catch {
        return;
    }
    if (copyFeedbackTimer)
        clearTimeout(copyFeedbackTimer);
    copyFeedbackId.value = id;
    copyFeedbackTimer = setTimeout(() => {
        copyFeedbackId.value = null;
        copyFeedbackTimer = null;
    }, 1600);
}
onMounted(() => {
    void load();
    document.addEventListener('keydown', onDocKeydown);
});
onUnmounted(() => {
    document.removeEventListener('keydown', onDocKeydown);
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "w-full min-w-0 space-y-5" },
});
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
/** @type {__VLS_StyleScopedClasses['space-y-5']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
    ...{ class: "flex flex-col gap-3 border-b border-slate-800/80 pb-4 sm:flex-row sm:items-end sm:justify-between" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-slate-800/80']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['sm:justify-between']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "min-w-0" },
});
/** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "text-xl font-semibold tracking-tight text-white" },
});
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-tight']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
(__VLS_ctx.t('adminPanel.usersTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-400" },
});
/** @type {__VLS_StyleScopedClasses['mt-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
(__VLS_ctx.t('adminPanel.usersLead'));
if (__VLS_ctx.lastUpdated && !__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-2 text-xs text-slate-500" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
    (__VLS_ctx.t('adminPanel.usersUpdatedAt', { time: __VLS_ctx.formatUpdated(__VLS_ctx.lastUpdated) }));
}
if (!__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.load) },
        type: "button",
        ...{ class: "shrink-0 rounded-lg border border-slate-700/80 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-100 shadow-sm transition hover:bg-slate-700/90 disabled:opacity-50" },
        disabled: (__VLS_ctx.loading),
    });
    /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-slate-700/80']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-slate-800/80']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-100']} */ ;
    /** @type {__VLS_StyleScopedClasses['shadow-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['transition']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:bg-slate-700/90']} */ ;
    /** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
    (__VLS_ctx.t('adminPanel.usersRefreshList'));
}
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-sm text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
    (__VLS_ctx.t('adminPanel.usersLoading'));
}
else if (__VLS_ctx.errorKey === 'forbidden') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-xl border border-amber-900/50 bg-amber-950/20 p-4 text-sm text-amber-100/90" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-amber-900/50']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-amber-950/20']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-amber-100/90']} */ ;
    (__VLS_ctx.t('adminPanel.usersForbidden'));
}
else if (__VLS_ctx.errorKey === 'load') {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap items-center gap-3" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-sm text-rose-300/90" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-rose-300/90']} */ ;
    (__VLS_ctx.t('adminPanel.usersError'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.load) },
        type: "button",
        ...{ class: "rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 ring-1 ring-slate-600 hover:bg-slate-700" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-slate-800']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
    /** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['ring-slate-600']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:bg-slate-700']} */ ;
    (__VLS_ctx.t('adminPanel.commonRetry'));
}
else if (!__VLS_ctx.databaseConfigured) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "rounded-xl border border-amber-800/50 bg-gradient-to-br from-amber-950/30 to-slate-950/60 p-5 ring-1 ring-amber-700/20" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-amber-800/50']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-gradient-to-br']} */ ;
    /** @type {__VLS_StyleScopedClasses['from-amber-950/30']} */ ;
    /** @type {__VLS_StyleScopedClasses['to-slate-950/60']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['ring-amber-700/20']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-sm font-medium text-amber-100/95" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-amber-100/95']} */ ;
    (__VLS_ctx.t('adminPanel.usersNoDb'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "mt-2 text-xs leading-relaxed text-amber-200/70" },
    });
    /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-amber-200/70']} */ ;
    (__VLS_ctx.t('adminPanel.usersNoDbHint'));
}
else if (__VLS_ctx.empty) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-sm text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
    (__VLS_ctx.t('adminPanel.usersEmpty'));
}
else {
    if (__VLS_ctx.rolePatchError) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mb-2 text-sm text-rose-300/90" },
        });
        /** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-rose-300/90']} */ ;
        (__VLS_ctx.rolePatchError);
    }
    if (__VLS_ctx.summary) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid gap-3 sm:grid-cols-3" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['sm:grid-cols-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-xl border border-slate-800/80 bg-slate-900/50 p-4 ring-1 ring-white/[0.04]" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-slate-800/80']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-slate-900/50']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['ring-white/[0.04]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-[11px] font-medium uppercase tracking-wide text-slate-500" },
        });
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
        (__VLS_ctx.t('adminPanel.usersSummaryTotal'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-1.5 text-2xl font-semibold tabular-nums text-white" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-white']} */ ;
        (__VLS_ctx.summary.total);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-xl border border-slate-800/80 bg-slate-900/50 p-4 ring-1 ring-white/[0.04]" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-slate-800/80']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-slate-900/50']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['ring-white/[0.04]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-[11px] font-medium uppercase tracking-wide text-slate-500" },
        });
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
        (__VLS_ctx.t('adminPanel.usersSummaryAdmins'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-1.5 text-2xl font-semibold tabular-nums text-cyan-300" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-cyan-300']} */ ;
        (__VLS_ctx.summary.admins);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-xl border border-slate-800/80 bg-slate-900/50 p-4 ring-1 ring-white/[0.04]" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-slate-800/80']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-slate-900/50']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
        /** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['ring-white/[0.04]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-[11px] font-medium uppercase tracking-wide text-slate-500" },
        });
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
        (__VLS_ctx.t('adminPanel.usersSummaryAvgWins'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-1.5 text-2xl font-semibold tabular-nums text-violet-200" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-violet-200']} */ ;
        (__VLS_ctx.summary.avgWins.toFixed(1));
    }
    if (__VLS_ctx.showToolbar) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-col gap-3 rounded-xl border border-slate-800/70 bg-slate-900/35 p-3 ring-1 ring-white/[0.03] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-slate-800/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-slate-900/35']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['ring-white/[0.03]']} */ ;
        /** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ ;
        /** @type {__VLS_StyleScopedClasses['sm:flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['sm:items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['sm:justify-between']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "flex min-w-[12rem] flex-1 flex-col gap-1.5 sm:max-w-md" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['min-w-[12rem]']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['sm:max-w-md']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-[11px] font-medium uppercase tracking-wide text-slate-500" },
        });
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
        (__VLS_ctx.t('adminPanel.usersSearchLabel'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            type: "search",
            autocomplete: "off",
            ...{ class: "w-full rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-600/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/40" },
            placeholder: (__VLS_ctx.t('adminPanel.usersSearchPlaceholder')),
        });
        (__VLS_ctx.searchQuery);
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-slate-700/80']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-slate-950/80']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-100']} */ ;
        /** @type {__VLS_StyleScopedClasses['placeholder:text-slate-600']} */ ;
        /** @type {__VLS_StyleScopedClasses['focus:border-cyan-600/50']} */ ;
        /** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
        /** @type {__VLS_StyleScopedClasses['focus:ring-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['focus:ring-cyan-500/40']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap items-end gap-3" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-end']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
            ...{ class: "flex flex-col gap-1.5" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-1.5']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "text-[11px] font-medium uppercase tracking-wide text-slate-500" },
        });
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
        (__VLS_ctx.t('adminPanel.usersSortLabel'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
            value: (__VLS_ctx.sortKey),
            ...{ class: "min-w-[10rem] rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-cyan-600/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/40" },
        });
        /** @type {__VLS_StyleScopedClasses['min-w-[10rem]']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-slate-700/80']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-slate-950/80']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-100']} */ ;
        /** @type {__VLS_StyleScopedClasses['focus:border-cyan-600/50']} */ ;
        /** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
        /** @type {__VLS_StyleScopedClasses['focus:ring-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['focus:ring-cyan-500/40']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "name",
        });
        (__VLS_ctx.t('adminPanel.usersSortName'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "wins",
        });
        (__VLS_ctx.t('adminPanel.usersSortWins'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
            value: "rating",
        });
        (__VLS_ctx.t('adminPanel.usersSortRating'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.exportCsv) },
            type: "button",
            ...{ class: "rounded-lg bg-indigo-900/80 px-3 py-2 text-xs font-semibold text-indigo-50 ring-1 ring-indigo-600/40 transition hover:bg-indigo-800/90" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-indigo-900/80']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-indigo-50']} */ ;
        /** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['ring-indigo-600/40']} */ ;
        /** @type {__VLS_StyleScopedClasses['transition']} */ ;
        /** @type {__VLS_StyleScopedClasses['hover:bg-indigo-800/90']} */ ;
        (__VLS_ctx.t('adminPanel.usersExportCsv'));
    }
    if (__VLS_ctx.showToolbar) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "text-xs text-slate-500" },
        });
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
        (__VLS_ctx.t('adminPanel.usersShowing', { n: __VLS_ctx.filteredSorted.length, total: __VLS_ctx.users.length }));
    }
    if (__VLS_ctx.noSearchMatches) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "rounded-lg border border-slate-800/80 bg-slate-900/30 px-3 py-2 text-sm text-slate-400" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-slate-800/80']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-slate-900/30']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
        (__VLS_ctx.t('adminPanel.usersNoMatches'));
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
            ...{ class: "space-y-2" },
            role: "list",
        });
        /** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
        for (const [u] of __VLS_vFor((__VLS_ctx.filteredSorted))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.loading))
                            return;
                        if (!!(__VLS_ctx.errorKey === 'forbidden'))
                            return;
                        if (!!(__VLS_ctx.errorKey === 'load'))
                            return;
                        if (!!(!__VLS_ctx.databaseConfigured))
                            return;
                        if (!!(__VLS_ctx.empty))
                            return;
                        if (!!(__VLS_ctx.noSearchMatches))
                            return;
                        __VLS_ctx.openUserDetail(u);
                        // @ts-ignore
                        [t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, t, lastUpdated, lastUpdated, loading, loading, loading, loading, formatUpdated, load, load, errorKey, errorKey, databaseConfigured, empty, rolePatchError, rolePatchError, summary, summary, summary, summary, showToolbar, showToolbar, searchQuery, sortKey, exportCsv, filteredSorted, filteredSorted, users, noSearchMatches, openUserDetail,];
                    } },
                key: (u.id),
                ...{ class: "flex cursor-pointer flex-col gap-3 rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 ring-1 ring-white/[0.03] transition hover:border-slate-700/90 hover:bg-slate-900/55 sm:flex-row sm:items-center" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['cursor-pointer']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-slate-800/80']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-slate-900/40']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['ring-white/[0.03]']} */ ;
            /** @type {__VLS_StyleScopedClasses['transition']} */ ;
            /** @type {__VLS_StyleScopedClasses['hover:border-slate-700/90']} */ ;
            /** @type {__VLS_StyleScopedClasses['hover:bg-slate-900/55']} */ ;
            /** @type {__VLS_StyleScopedClasses['sm:flex-row']} */ ;
            /** @type {__VLS_StyleScopedClasses['sm:items-center']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex min-w-0 flex-1 items-center gap-3" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-800 ring-1 ring-slate-700" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['h-11']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-11']} */ ;
            /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-slate-800']} */ ;
            /** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['ring-slate-700']} */ ;
            if (u.avatar) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
                    src: (u.avatar),
                    alt: (u.displayName),
                    width: "44",
                    height: "44",
                    ...{ class: "h-full w-full object-cover" },
                });
                /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
                /** @type {__VLS_StyleScopedClasses['object-cover']} */ ;
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "text-base font-semibold text-slate-400" },
                    'aria-hidden': "true",
                });
                /** @type {__VLS_StyleScopedClasses['text-base']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
                (u.displayName.charAt(0).toUpperCase());
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "min-w-0 flex-1" },
            });
            /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "truncate font-medium text-white" },
            });
            /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-white']} */ ;
            (u.displayName);
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 break-all font-mono text-[10px] leading-snug text-slate-500" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-x-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-y-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['leading-snug']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (__VLS_ctx.t('adminPanel.idInternal'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-slate-400" },
            });
            /** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
            (u.id);
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!!(__VLS_ctx.loading))
                            return;
                        if (!!(__VLS_ctx.errorKey === 'forbidden'))
                            return;
                        if (!!(__VLS_ctx.errorKey === 'load'))
                            return;
                        if (!!(!__VLS_ctx.databaseConfigured))
                            return;
                        if (!!(__VLS_ctx.empty))
                            return;
                        if (!!(__VLS_ctx.noSearchMatches))
                            return;
                        __VLS_ctx.copyId(u.id);
                        // @ts-ignore
                        [t, copyId,];
                    } },
                type: "button",
                ...{ class: "rounded border border-slate-700/80 bg-slate-950/60 px-1.5 py-0.5 text-[10px] font-medium text-slate-300 transition hover:border-cyan-700/60 hover:text-cyan-200" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-slate-700/80']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-slate-950/60']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-1.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-slate-300']} */ ;
            /** @type {__VLS_StyleScopedClasses['transition']} */ ;
            /** @type {__VLS_StyleScopedClasses['hover:border-cyan-700/60']} */ ;
            /** @type {__VLS_StyleScopedClasses['hover:text-cyan-200']} */ ;
            (__VLS_ctx.copyFeedbackId === u.id ? __VLS_ctx.t('adminPanel.usersCopied') : __VLS_ctx.t('adminPanel.usersCopyId'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
            (u.provider);
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "rounded border border-slate-700/70 bg-slate-950/70 px-1.5 py-0.5 text-slate-300" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-slate-700/70']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-slate-950/70']} */ ;
            /** @type {__VLS_StyleScopedClasses['px-1.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-slate-300']} */ ;
            (__VLS_ctx.roleLabel('USER'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ onClick: () => { } },
                ...{ class: "inline-flex flex-wrap items-center gap-1" },
            });
            /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
            for (const [role] of __VLS_vFor((__VLS_ctx.editableRoles))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
                    key: (role),
                    ...{ class: "inline-flex items-center gap-1 rounded border border-slate-700/70 bg-slate-950/70 px-1.5 py-0.5 text-slate-200" },
                    ...{ class: ({ 'opacity-50': __VLS_ctx.roleToggleDisabled(u, role) }) },
                });
                /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['rounded']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-slate-700/70']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-slate-950/70']} */ ;
                /** @type {__VLS_StyleScopedClasses['px-1.5']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
                /** @type {__VLS_StyleScopedClasses['opacity-50']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
                    ...{ onChange: (...[$event]) => {
                            if (!!(__VLS_ctx.loading))
                                return;
                            if (!!(__VLS_ctx.errorKey === 'forbidden'))
                                return;
                            if (!!(__VLS_ctx.errorKey === 'load'))
                                return;
                            if (!!(!__VLS_ctx.databaseConfigured))
                                return;
                            if (!!(__VLS_ctx.empty))
                                return;
                            if (!!(__VLS_ctx.noSearchMatches))
                                return;
                            __VLS_ctx.onRoleToggle(u, role, $event);
                            // @ts-ignore
                            [t, t, copyFeedbackId, roleLabel, editableRoles, roleToggleDisabled, onRoleToggle,];
                        } },
                    type: "checkbox",
                    ...{ class: "h-3 w-3 accent-cyan-500" },
                    checked: (__VLS_ctx.hasSystemRole(u, role)),
                    disabled: (__VLS_ctx.roleToggleDisabled(u, role)),
                    'aria-label': (`${__VLS_ctx.roleLabel(role)} ${u.displayName}`),
                });
                /** @type {__VLS_StyleScopedClasses['h-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['w-3']} */ ;
                /** @type {__VLS_StyleScopedClasses['accent-cyan-500']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
                (__VLS_ctx.roleLabel(role));
                // @ts-ignore
                [roleLabel, roleLabel, roleToggleDisabled, hasSystemRole,];
            }
            if (__VLS_ctx.canAssignStreamerViaPicker(u)) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!!(__VLS_ctx.loading))
                                return;
                            if (!!(__VLS_ctx.errorKey === 'forbidden'))
                                return;
                            if (!!(__VLS_ctx.errorKey === 'load'))
                                return;
                            if (!!(!__VLS_ctx.databaseConfigured))
                                return;
                            if (!!(__VLS_ctx.empty))
                                return;
                            if (!!(__VLS_ctx.noSearchMatches))
                                return;
                            if (!(__VLS_ctx.canAssignStreamerViaPicker(u)))
                                return;
                            __VLS_ctx.openStreamerRolePicker(u);
                            // @ts-ignore
                            [canAssignStreamerViaPicker, openStreamerRolePicker,];
                        } },
                    type: "button",
                    ...{ class: "rounded border border-violet-600/70 bg-violet-900/50 px-1.5 py-0.5 text-[10px] font-medium text-violet-100 transition hover:bg-violet-800/70" },
                });
                /** @type {__VLS_StyleScopedClasses['rounded']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-violet-600/70']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-violet-900/50']} */ ;
                /** @type {__VLS_StyleScopedClasses['px-1.5']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-violet-100']} */ ;
                /** @type {__VLS_StyleScopedClasses['transition']} */ ;
                /** @type {__VLS_StyleScopedClasses['hover:bg-violet-800/70']} */ ;
                (__VLS_ctx.t('adminPanel.usersAddStreamerRole'));
            }
            if (__VLS_ctx.streamerPickerUserId === u.id) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ onClick: () => { } },
                    ...{ class: "mt-1 inline-flex flex-wrap items-center gap-1 rounded border border-slate-700/70 bg-slate-950/80 px-2 py-1" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['inline-flex']} */ ;
                /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
                /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
                /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
                /** @type {__VLS_StyleScopedClasses['rounded']} */ ;
                /** @type {__VLS_StyleScopedClasses['border']} */ ;
                /** @type {__VLS_StyleScopedClasses['border-slate-700/70']} */ ;
                /** @type {__VLS_StyleScopedClasses['bg-slate-950/80']} */ ;
                /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['py-1']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "text-[10px] text-slate-400" },
                });
                /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
                (__VLS_ctx.t('adminPanel.usersStreamerPickerLabel'));
                if (__VLS_ctx.streamerOptionsLoading) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                        ...{ class: "text-[10px] text-slate-400" },
                    });
                    /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
                    (__VLS_ctx.t('adminPanel.usersStreamerPickerLoading'));
                }
                else {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
                        value: (__VLS_ctx.streamerPickerSelection),
                        ...{ class: "min-w-[10rem] rounded border border-slate-700/80 bg-slate-950/80 px-1.5 py-1 text-[10px] text-slate-100 focus:border-cyan-600/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/40" },
                    });
                    /** @type {__VLS_StyleScopedClasses['min-w-[10rem]']} */ ;
                    /** @type {__VLS_StyleScopedClasses['rounded']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border-slate-700/80']} */ ;
                    /** @type {__VLS_StyleScopedClasses['bg-slate-950/80']} */ ;
                    /** @type {__VLS_StyleScopedClasses['px-1.5']} */ ;
                    /** @type {__VLS_StyleScopedClasses['py-1']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-slate-100']} */ ;
                    /** @type {__VLS_StyleScopedClasses['focus:border-cyan-600/50']} */ ;
                    /** @type {__VLS_StyleScopedClasses['focus:outline-none']} */ ;
                    /** @type {__VLS_StyleScopedClasses['focus:ring-1']} */ ;
                    /** @type {__VLS_StyleScopedClasses['focus:ring-cyan-500/40']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                        disabled: true,
                        value: "",
                    });
                    (__VLS_ctx.t('adminPanel.usersStreamerPickerPlaceholder'));
                    for (const [streamer] of __VLS_vFor((__VLS_ctx.streamerOptions))) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
                            key: (streamer.id),
                            value: (streamer.id),
                        });
                        (__VLS_ctx.streamerOptionLabel(streamer));
                        // @ts-ignore
                        [t, t, t, t, streamerPickerUserId, streamerOptionsLoading, streamerPickerSelection, streamerOptions, streamerOptionLabel,];
                    }
                    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                        ...{ onClick: (...[$event]) => {
                                if (!!(__VLS_ctx.loading))
                                    return;
                                if (!!(__VLS_ctx.errorKey === 'forbidden'))
                                    return;
                                if (!!(__VLS_ctx.errorKey === 'load'))
                                    return;
                                if (!!(!__VLS_ctx.databaseConfigured))
                                    return;
                                if (!!(__VLS_ctx.empty))
                                    return;
                                if (!!(__VLS_ctx.noSearchMatches))
                                    return;
                                if (!(__VLS_ctx.streamerPickerUserId === u.id))
                                    return;
                                if (!!(__VLS_ctx.streamerOptionsLoading))
                                    return;
                                __VLS_ctx.assignStreamerRoleFromPicker(u);
                                // @ts-ignore
                                [assignStreamerRoleFromPicker,];
                            } },
                        type: "button",
                        ...{ class: "rounded border border-cyan-700/70 bg-cyan-900/50 px-1.5 py-1 text-[10px] font-medium text-cyan-100 transition hover:bg-cyan-800/70 disabled:opacity-50" },
                        disabled: (__VLS_ctx.rolePatchingId === u.id || __VLS_ctx.streamerOptions.length === 0),
                    });
                    /** @type {__VLS_StyleScopedClasses['rounded']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border-cyan-700/70']} */ ;
                    /** @type {__VLS_StyleScopedClasses['bg-cyan-900/50']} */ ;
                    /** @type {__VLS_StyleScopedClasses['px-1.5']} */ ;
                    /** @type {__VLS_StyleScopedClasses['py-1']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
                    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-cyan-100']} */ ;
                    /** @type {__VLS_StyleScopedClasses['transition']} */ ;
                    /** @type {__VLS_StyleScopedClasses['hover:bg-cyan-800/70']} */ ;
                    /** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
                    (__VLS_ctx.t('adminPanel.usersStreamerPickerApply'));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                        ...{ onClick: (__VLS_ctx.closeStreamerRolePicker) },
                        type: "button",
                        ...{ class: "rounded border border-slate-700/80 bg-slate-900/70 px-1.5 py-1 text-[10px] font-medium text-slate-200 transition hover:bg-slate-800/70" },
                    });
                    /** @type {__VLS_StyleScopedClasses['rounded']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border-slate-700/80']} */ ;
                    /** @type {__VLS_StyleScopedClasses['bg-slate-900/70']} */ ;
                    /** @type {__VLS_StyleScopedClasses['px-1.5']} */ ;
                    /** @type {__VLS_StyleScopedClasses['py-1']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
                    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
                    /** @type {__VLS_StyleScopedClasses['transition']} */ ;
                    /** @type {__VLS_StyleScopedClasses['hover:bg-slate-800/70']} */ ;
                    (__VLS_ctx.t('adminPanel.usersStreamerPickerCancel'));
                    if (__VLS_ctx.streamerOptions.length === 0) {
                        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                            ...{ class: "text-[10px] text-amber-300/90" },
                        });
                        /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
                        /** @type {__VLS_StyleScopedClasses['text-amber-300/90']} */ ;
                        (__VLS_ctx.t('adminPanel.usersStreamerPickerEmpty'));
                    }
                }
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.dl, __VLS_intrinsics.dl)({
                ...{ class: "flex shrink-0 flex-wrap gap-4 text-right text-sm sm:justify-end" },
            });
            /** @type {__VLS_StyleScopedClasses['flex']} */ ;
            /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
            /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
            /** @type {__VLS_StyleScopedClasses['sm:justify-end']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({
                ...{ class: "text-[11px] font-medium uppercase tracking-wide text-slate-500" },
            });
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
            /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
            /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
            (__VLS_ctx.t('adminPanel.colWins'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({
                ...{ class: "font-semibold tabular-nums text-cyan-300" },
            });
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            /** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-cyan-300']} */ ;
            (u.wins);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({
                ...{ class: "text-[11px] font-medium uppercase tracking-wide text-slate-500" },
            });
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
            /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
            /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
            (__VLS_ctx.t('adminPanel.colGames'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({
                ...{ class: "font-semibold tabular-nums text-slate-200" },
            });
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            /** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
            (u.gamesPlayed);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({
                ...{ class: "text-[11px] font-medium uppercase tracking-wide text-slate-500" },
            });
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
            /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
            /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
            (__VLS_ctx.t('adminPanel.colRating'));
            __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({
                ...{ class: "font-semibold tabular-nums text-violet-200" },
            });
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            /** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-violet-200']} */ ;
            (__VLS_ctx.rating(u));
            // @ts-ignore
            [t, t, t, t, t, t, streamerOptions, streamerOptions, rolePatchingId, closeStreamerRolePicker, rating,];
        }
    }
    let __VLS_0;
    /** @ts-ignore @type { | typeof __VLS_components.Teleport | typeof __VLS_components.Teleport} */
    Teleport;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        to: "body",
    }));
    const __VLS_2 = __VLS_1({
        to: "body",
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    const { default: __VLS_5 } = __VLS_3.slots;
    if (__VLS_ctx.detailUser) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "fixed inset-0 z-[90] flex justify-end" },
            role: "presentation",
        });
        /** @type {__VLS_StyleScopedClasses['fixed']} */ ;
        /** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['z-[90]']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-end']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.closeUserDetail) },
            type: "button",
            ...{ class: "absolute inset-0 bg-black/55 backdrop-blur-[1px]" },
            'aria-label': (__VLS_ctx.t('adminPanel.usersDetailClose')),
        });
        /** @type {__VLS_StyleScopedClasses['absolute']} */ ;
        /** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-black/55']} */ ;
        /** @type {__VLS_StyleScopedClasses['backdrop-blur-[1px]']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.aside, __VLS_intrinsics.aside)({
            ...{ class: "relative flex h-full w-full max-w-md flex-col border-l border-slate-800/90 bg-slate-950 shadow-2xl shadow-black/40" },
            role: "dialog",
            'aria-modal': "true",
            'aria-labelledby': ('admin-user-detail-title'),
        });
        /** @type {__VLS_StyleScopedClasses['relative']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['max-w-md']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-l']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-slate-800/90']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-slate-950']} */ ;
        /** @type {__VLS_StyleScopedClasses['shadow-2xl']} */ ;
        /** @type {__VLS_StyleScopedClasses['shadow-black/40']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-start justify-between gap-3 border-b border-slate-800/80 p-4" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-b']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-slate-800/80']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
            id: "admin-user-detail-title",
            ...{ class: "min-w-0 text-lg font-semibold tracking-tight text-white" },
        });
        /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['tracking-tight']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-white']} */ ;
        (__VLS_ctx.t('adminPanel.usersDetailTitle'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.closeUserDetail) },
            type: "button",
            ...{ class: "shrink-0 rounded-lg border border-slate-700/80 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800" },
        });
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-slate-700/80']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-slate-900']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
        /** @type {__VLS_StyleScopedClasses['hover:bg-slate-800']} */ ;
        (__VLS_ctx.t('adminPanel.usersDetailClose'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "min-h-0 flex-1 overflow-y-auto p-4" },
        });
        /** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['overflow-y-auto']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-4']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex gap-4" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-800 ring-1 ring-slate-700" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['h-16']} */ ;
        /** @type {__VLS_StyleScopedClasses['w-16']} */ ;
        /** @type {__VLS_StyleScopedClasses['shrink-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-slate-800']} */ ;
        /** @type {__VLS_StyleScopedClasses['ring-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['ring-slate-700']} */ ;
        if (__VLS_ctx.detailUser.avatar) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
                src: (__VLS_ctx.detailUser.avatar),
                alt: (__VLS_ctx.detailUser.displayName),
                width: "64",
                height: "64",
                ...{ class: "h-full w-full object-cover" },
            });
            /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
            /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
            /** @type {__VLS_StyleScopedClasses['object-cover']} */ ;
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-xl font-semibold text-slate-400" },
                'aria-hidden': "true",
            });
            /** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
            (__VLS_ctx.detailUser.displayName.charAt(0).toUpperCase());
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "min-w-0 flex-1" },
        });
        /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "truncate text-base font-medium text-white" },
        });
        /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-base']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-white']} */ ;
        (__VLS_ctx.detailUser.displayName);
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-1 break-all font-mono text-[11px] text-slate-500" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
        (__VLS_ctx.dashText(__VLS_ctx.detailUser.id));
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!!(__VLS_ctx.loading))
                        return;
                    if (!!(__VLS_ctx.errorKey === 'forbidden'))
                        return;
                    if (!!(__VLS_ctx.errorKey === 'load'))
                        return;
                    if (!!(!__VLS_ctx.databaseConfigured))
                        return;
                    if (!!(__VLS_ctx.empty))
                        return;
                    if (!(__VLS_ctx.detailUser))
                        return;
                    __VLS_ctx.copyId(__VLS_ctx.detailUser.id);
                    // @ts-ignore
                    [t, t, t, copyId, detailUser, detailUser, detailUser, detailUser, detailUser, detailUser, detailUser, detailUser, closeUserDetail, closeUserDetail, dashText,];
                } },
            type: "button",
            ...{ class: "mt-2 rounded-lg border border-slate-700/80 bg-slate-900/80 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:border-cyan-700/50 hover:text-cyan-200" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-slate-700/80']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-slate-900/80']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-2.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-300']} */ ;
        /** @type {__VLS_StyleScopedClasses['hover:border-cyan-700/50']} */ ;
        /** @type {__VLS_StyleScopedClasses['hover:text-cyan-200']} */ ;
        (__VLS_ctx.copyFeedbackId === __VLS_ctx.detailUser.id ? __VLS_ctx.t('adminPanel.usersCopied') : __VLS_ctx.t('adminPanel.usersCopyId'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.dl, __VLS_intrinsics.dl)({
            ...{ class: "mt-6 space-y-3 text-sm" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
        /** @type {__VLS_StyleScopedClasses['space-y-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-col gap-0.5" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-0.5']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({
            ...{ class: "text-[11px] font-medium uppercase tracking-wide text-slate-500" },
        });
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
        (__VLS_ctx.t('adminPanel.colProvider'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({
            ...{ class: "text-slate-200" },
        });
        /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
        (__VLS_ctx.dashText(__VLS_ctx.detailUser.provider));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-col gap-0.5" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-0.5']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({
            ...{ class: "text-[11px] font-medium uppercase tracking-wide text-slate-500" },
        });
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
        (__VLS_ctx.t('adminPanel.usersDetailLegacyRole'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({
            ...{ class: "font-mono text-slate-200" },
        });
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
        (__VLS_ctx.dashText(__VLS_ctx.detailUser.role));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-col gap-0.5" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-0.5']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({
            ...{ class: "text-[11px] font-medium uppercase tracking-wide text-slate-500" },
        });
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
        (__VLS_ctx.t('adminPanel.usersDetailRoles'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({
            ...{ class: "text-slate-200" },
        });
        /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
        (__VLS_ctx.dashText(__VLS_ctx.displayRoles(__VLS_ctx.detailUser)));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-col gap-0.5" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-0.5']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({
            ...{ class: "text-[11px] font-medium uppercase tracking-wide text-slate-500" },
        });
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
        (__VLS_ctx.t('adminPanel.usersDetailTwitchId'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({
            ...{ class: "break-all font-mono text-slate-200" },
        });
        /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
        (__VLS_ctx.dashText(__VLS_ctx.detailUser.twitchId));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-col gap-0.5" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-0.5']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({
            ...{ class: "text-[11px] font-medium uppercase tracking-wide text-slate-500" },
        });
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
        (__VLS_ctx.t('adminPanel.usersDetailStreamerId'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({
            ...{ class: "break-all font-mono text-slate-200" },
        });
        /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
        (__VLS_ctx.dashText(__VLS_ctx.detailUser.streamerId));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "grid gap-3 sm:grid-cols-3" },
        });
        /** @type {__VLS_StyleScopedClasses['grid']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['sm:grid-cols-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({
            ...{ class: "text-[11px] font-medium uppercase tracking-wide text-slate-500" },
        });
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
        (__VLS_ctx.t('adminPanel.colWins'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({
            ...{ class: "font-semibold tabular-nums text-cyan-300" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-cyan-300']} */ ;
        (__VLS_ctx.detailUser.wins);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({
            ...{ class: "text-[11px] font-medium uppercase tracking-wide text-slate-500" },
        });
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
        (__VLS_ctx.t('adminPanel.colGames'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({
            ...{ class: "font-semibold tabular-nums text-slate-200" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
        (__VLS_ctx.detailUser.gamesPlayed);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({
            ...{ class: "text-[11px] font-medium uppercase tracking-wide text-slate-500" },
        });
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
        (__VLS_ctx.t('adminPanel.colRating'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({
            ...{ class: "font-semibold tabular-nums text-violet-200" },
        });
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-violet-200']} */ ;
        (__VLS_ctx.rating(__VLS_ctx.detailUser));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-col gap-0.5" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-0.5']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({
            ...{ class: "text-[11px] font-medium uppercase tracking-wide text-slate-500" },
        });
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
        (__VLS_ctx.t('adminPanel.usersDetailCreated'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({
            ...{ class: "text-slate-200" },
        });
        /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
        (__VLS_ctx.formatIso(__VLS_ctx.detailUser.createdAt));
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-col gap-0.5" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-0.5']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({
            ...{ class: "text-[11px] font-medium uppercase tracking-wide text-slate-500" },
        });
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
        /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
        (__VLS_ctx.t('adminPanel.usersDetailUpdated'));
        __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({
            ...{ class: "text-slate-200" },
        });
        /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
        (__VLS_ctx.formatIso(__VLS_ctx.detailUser.updatedAt));
        __VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
            ...{ class: "mt-6 border-t border-slate-800/80 pt-5" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-t']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-slate-800/80']} */ ;
        /** @type {__VLS_StyleScopedClasses['pt-5']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex items-center justify-between gap-3" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['items-center']} */ ;
        /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.h4, __VLS_intrinsics.h4)({
            ...{ class: "text-sm font-semibold text-white" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-white']} */ ;
        if (__VLS_ctx.detailActivityLoading) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-xs text-slate-500" },
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
        }
        if (__VLS_ctx.detailActivityError) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "mt-2 text-xs text-rose-300" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-rose-300']} */ ;
            (__VLS_ctx.detailActivityError);
        }
        else if (__VLS_ctx.detailActivity) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.dl, __VLS_intrinsics.dl)({
                ...{ class: "mt-3 grid grid-cols-2 gap-3 text-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['grid']} */ ;
            /** @type {__VLS_StyleScopedClasses['grid-cols-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rounded-lg border border-slate-800/80 bg-slate-900/45 p-3" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-slate-800/80']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-slate-900/45']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({
                ...{ class: "uppercase tracking-wide text-slate-500" },
            });
            /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
            /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({
                ...{ class: "mt-1 text-slate-200" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
            (__VLS_ctx.formatIso(__VLS_ctx.detailActivity.summary.lastSeenAt));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rounded-lg border border-slate-800/80 bg-slate-900/45 p-3" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-slate-800/80']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-slate-900/45']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({
                ...{ class: "uppercase tracking-wide text-slate-500" },
            });
            /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
            /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({
                ...{ class: "mt-1 tabular-nums text-slate-200" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
            (__VLS_ctx.detailActivity.summary.totalSessions);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rounded-lg border border-slate-800/80 bg-slate-900/45 p-3" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-slate-800/80']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-slate-900/45']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({
                ...{ class: "uppercase tracking-wide text-slate-500" },
            });
            /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
            /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({
                ...{ class: "mt-1 tabular-nums text-slate-200" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
            (__VLS_ctx.formatDuration(__VLS_ctx.detailActivity.summary.totalTimeSpentSeconds));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "rounded-lg border border-slate-800/80 bg-slate-900/45 p-3" },
            });
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-slate-800/80']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-slate-900/45']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({
                ...{ class: "uppercase tracking-wide text-slate-500" },
            });
            /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
            /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({
                ...{ class: "mt-1 break-all font-mono text-[11px] text-slate-200" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
            /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
            (__VLS_ctx.dashText(__VLS_ctx.detailActivity.summary.lastPath));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-5 rounded-lg border border-slate-800/80 bg-slate-900/35 p-3" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
            /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
            /** @type {__VLS_StyleScopedClasses['border']} */ ;
            /** @type {__VLS_StyleScopedClasses['border-slate-800/80']} */ ;
            /** @type {__VLS_StyleScopedClasses['bg-slate-900/35']} */ ;
            /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.h5, __VLS_intrinsics.h5)({
                ...{ class: "text-xs font-semibold uppercase tracking-wide text-slate-500" },
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
            /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.dl, __VLS_intrinsics.dl)({
                ...{ class: "mt-2 grid grid-cols-4 gap-2 text-xs" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['grid']} */ ;
            /** @type {__VLS_StyleScopedClasses['grid-cols-4']} */ ;
            /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({
                ...{ class: "text-slate-500" },
            });
            /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({
                ...{ class: "tabular-nums text-slate-200" },
            });
            /** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
            (__VLS_ctx.detailActivity.gameSummary.nadle.gamesPlayed);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({
                ...{ class: "text-slate-500" },
            });
            /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({
                ...{ class: "tabular-nums text-cyan-300" },
            });
            /** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-cyan-300']} */ ;
            (__VLS_ctx.detailActivity.gameSummary.nadle.wins);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({
                ...{ class: "text-slate-500" },
            });
            /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({
                ...{ class: "tabular-nums text-slate-200" },
            });
            /** @type {__VLS_StyleScopedClasses['tabular-nums']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
            (__VLS_ctx.detailActivity.gameSummary.nadle.losses);
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({});
            __VLS_asFunctionalElement1(__VLS_intrinsics.dt, __VLS_intrinsics.dt)({
                ...{ class: "text-slate-500" },
            });
            /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.dd, __VLS_intrinsics.dd)({
                ...{ class: "text-slate-200" },
            });
            /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
            (__VLS_ctx.formatIso(__VLS_ctx.detailActivity.gameSummary.nadle.lastGameAt));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-5" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.h5, __VLS_intrinsics.h5)({
                ...{ class: "text-xs font-semibold uppercase tracking-wide text-slate-500" },
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
            /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
            if (__VLS_ctx.detailActivity.recentEvents.length === 0) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                    ...{ class: "mt-2 text-xs text-slate-500" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
                    ...{ class: "mt-2 space-y-2" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
                for (const [event] of __VLS_vFor((__VLS_ctx.detailActivity.recentEvents))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
                        key: (`${event.event}-${event.createdAt}`),
                        ...{ class: "rounded-lg border border-slate-800/80 bg-slate-900/35 p-3 text-xs" },
                    });
                    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border-slate-800/80']} */ ;
                    /** @type {__VLS_StyleScopedClasses['bg-slate-900/35']} */ ;
                    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                        ...{ class: "font-medium text-slate-200" },
                    });
                    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
                    (event.event);
                    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                        ...{ class: "mt-1 break-all font-mono text-[11px] text-slate-500" },
                    });
                    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                    /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
                    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
                    (__VLS_ctx.dashText(event.path));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                        ...{ class: "mt-1 text-slate-500" },
                    });
                    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
                    (__VLS_ctx.formatIso(event.createdAt));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                        ...{ class: "mt-1 break-all font-mono text-[10px] text-slate-600" },
                    });
                    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                    /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
                    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-slate-600']} */ ;
                    (__VLS_ctx.formatMetadata(event.metadata));
                    // @ts-ignore
                    [t, t, t, t, t, t, t, t, t, t, t, t, copyFeedbackId, rating, detailUser, detailUser, detailUser, detailUser, detailUser, detailUser, detailUser, detailUser, detailUser, detailUser, detailUser, dashText, dashText, dashText, dashText, dashText, dashText, dashText, displayRoles, formatIso, formatIso, formatIso, formatIso, formatIso, detailActivityLoading, detailActivityError, detailActivityError, detailActivity, detailActivity, detailActivity, detailActivity, detailActivity, detailActivity, detailActivity, detailActivity, detailActivity, detailActivity, detailActivity, formatDuration, formatMetadata,];
                }
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "mt-5" },
            });
            /** @type {__VLS_StyleScopedClasses['mt-5']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.h5, __VLS_intrinsics.h5)({
                ...{ class: "text-xs font-semibold uppercase tracking-wide text-slate-500" },
            });
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
            /** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
            /** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
            if (__VLS_ctx.detailActivity.recentErrors.length === 0) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                    ...{ class: "mt-2 text-xs text-slate-500" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
                    ...{ class: "mt-2 space-y-2" },
                });
                /** @type {__VLS_StyleScopedClasses['mt-2']} */ ;
                /** @type {__VLS_StyleScopedClasses['space-y-2']} */ ;
                for (const [event] of __VLS_vFor((__VLS_ctx.detailActivity.recentErrors))) {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
                        key: (`${event.source}-${event.createdAt}`),
                        ...{ class: "rounded-lg border border-rose-950/70 bg-rose-950/15 p-3 text-xs" },
                    });
                    /** @type {__VLS_StyleScopedClasses['rounded-lg']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border']} */ ;
                    /** @type {__VLS_StyleScopedClasses['border-rose-950/70']} */ ;
                    /** @type {__VLS_StyleScopedClasses['bg-rose-950/15']} */ ;
                    /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
                    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                        ...{ class: "font-medium text-rose-100" },
                    });
                    /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-rose-100']} */ ;
                    (event.message);
                    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                        ...{ class: "mt-1 break-all font-mono text-[11px] text-slate-500" },
                    });
                    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                    /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
                    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
                    (__VLS_ctx.dashText(event.path));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                        ...{ class: "mt-1 text-slate-500" },
                    });
                    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
                    (event.source);
                    (__VLS_ctx.formatIso(event.createdAt));
                    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                        ...{ class: "mt-1 break-all font-mono text-[10px] text-slate-600" },
                    });
                    /** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
                    /** @type {__VLS_StyleScopedClasses['break-all']} */ ;
                    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
                    /** @type {__VLS_StyleScopedClasses['text-slate-600']} */ ;
                    (__VLS_ctx.formatMetadata(event.metadata));
                    // @ts-ignore
                    [dashText, formatIso, detailActivity, detailActivity, formatMetadata,];
                }
            }
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "mt-6 text-xs leading-relaxed text-slate-500" },
        });
        /** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
        (__VLS_ctx.t('adminPanel.usersDetailHint'));
    }
    // @ts-ignore
    [t,];
    var __VLS_3;
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
