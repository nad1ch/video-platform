/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
/**
 * Admin diagnostics page — list/view/copy/download finalized
 * `RoomDiagnosticReport` rows produced by D1.3 persistence.
 *
 * No new component dependencies: plain HTML + Tailwind, fetch via the
 * shared `apiFetch` helper that every other admin page uses. Detail
 * view is a `Teleport`-based side panel matching `AdminUsers.vue`.
 *
 * Buttons: View, Copy JSON, Download JSON, Copy AI Prompt + JSON.
 */
import { computed, onMounted, ref, watch } from 'vue';
import { apiFetch } from '@/utils/apiFetch';
const DEFAULT_LIMIT = 50;
const COPY_FEEDBACK_MS = 1600;
const AI_PROMPT_PREAMBLE = [
    'Analyze this StreamAssist GameSessionReport.',
    '',
    'Find:',
    '1. What failed',
    '2. When it failed',
    '3. Who was affected',
    '4. Whether it is client/server/WS/WebRTC/playback/game/backend',
    '5. Events that happened right before the failure',
    '6. Most likely root cause',
    '7. Exact files/flows to inspect next',
    '8. Minimal fix direction',
    '9. QA checklist',
    '',
    'Report JSON:',
].join('\n');
const items = ref([]);
const total = ref(0);
const offset = ref(0);
const loading = ref(false);
const errorKey = ref(null);
const filterGameType = ref('');
const filterRoomId = ref('');
const filterHasErrors = ref('');
const detail = ref(null);
const detailLoading = ref(false);
const detailError = ref(null);
const copyFeedback = ref(null);
let copyFeedbackTimer = null;
const hasNext = computed(() => offset.value + items.value.length < total.value);
const hasPrev = computed(() => offset.value > 0);
async function loadList() {
    loading.value = true;
    errorKey.value = null;
    try {
        const qs = new URLSearchParams();
        qs.set('limit', String(DEFAULT_LIMIT));
        qs.set('offset', String(offset.value));
        if (filterGameType.value)
            qs.set('gameType', filterGameType.value);
        if (filterRoomId.value)
            qs.set('roomId', filterRoomId.value);
        if (filterHasErrors.value)
            qs.set('hasErrors', filterHasErrors.value);
        const res = await apiFetch(`/api/admin/diagnostics/reports?${qs.toString()}`);
        if (!res.ok) {
            errorKey.value = `error_${res.status}`;
            items.value = [];
            total.value = 0;
            return;
        }
        const body = (await res.json());
        items.value = body.items;
        total.value = body.total;
    }
    catch (err) {
        errorKey.value = err instanceof Error ? err.message : 'unknown_error';
        items.value = [];
        total.value = 0;
    }
    finally {
        loading.value = false;
    }
}
async function openDetail(id) {
    detailLoading.value = true;
    detailError.value = null;
    detail.value = null;
    try {
        const res = await apiFetch(`/api/admin/diagnostics/reports/${encodeURIComponent(id)}`);
        if (!res.ok) {
            detailError.value = `error_${res.status}`;
            return;
        }
        detail.value = (await res.json());
    }
    catch (err) {
        detailError.value = err instanceof Error ? err.message : 'unknown_error';
    }
    finally {
        detailLoading.value = false;
    }
}
function closeDetail() {
    detail.value = null;
    detailError.value = null;
}
function showCopyFeedback(text) {
    copyFeedback.value = text;
    if (copyFeedbackTimer != null)
        clearTimeout(copyFeedbackTimer);
    copyFeedbackTimer = setTimeout(() => {
        copyFeedback.value = null;
        copyFeedbackTimer = null;
    }, COPY_FEEDBACK_MS);
}
async function copyToClipboard(text, label) {
    try {
        await navigator.clipboard.writeText(text);
        showCopyFeedback(`Copied: ${label}`);
    }
    catch {
        showCopyFeedback('Copy failed — clipboard blocked');
    }
}
function copyReportJson(report) {
    const json = JSON.stringify(report.reportJson, null, 2);
    void copyToClipboard(json, 'raw JSON');
}
function copyAiPrompt(report) {
    const json = JSON.stringify(report.reportJson, null, 2);
    void copyToClipboard(`${AI_PROMPT_PREAMBLE}\n${json}`, 'AI prompt + JSON');
}
function downloadReportJson(id) {
    // The download endpoint returns the raw reportJson with the right
    // Content-Disposition header — opening it in a new tab triggers the
    // browser save dialog.
    window.open(`/api/admin/diagnostics/reports/${encodeURIComponent(id)}/download`, '_blank', 'noopener');
}
function formatDuration(ms) {
    if (ms == null)
        return '—';
    if (ms < 1000)
        return `${ms}ms`;
    const sec = Math.floor(ms / 1000);
    if (sec < 60)
        return `${sec}s`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m < 60)
        return `${m}m ${s}s`;
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}h ${mm}m`;
}
function formatDateTime(iso) {
    if (!iso)
        return '—';
    try {
        return new Date(iso).toLocaleString();
    }
    catch {
        return iso;
    }
}
function applyFilters() {
    offset.value = 0;
    void loadList();
}
function nextPage() {
    if (!hasNext.value)
        return;
    offset.value += DEFAULT_LIMIT;
    void loadList();
}
function prevPage() {
    if (!hasPrev.value)
        return;
    offset.value = Math.max(0, offset.value - DEFAULT_LIMIT);
    void loadList();
}
onMounted(() => {
    void loadList();
});
watch(filterHasErrors, () => applyFilters());
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex flex-col gap-4 text-slate-100" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-100']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
    ...{ class: "flex flex-col gap-1 border-b border-white/5 pb-3" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-white/5']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "text-lg font-semibold tracking-tight text-white" },
});
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-tight']} */ ;
/** @type {__VLS_StyleScopedClasses['text-white']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
    ...{ class: "text-xs text-slate-400" },
});
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-slate-950/50 p-3" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-white/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-950/50']} */ ;
/** @type {__VLS_StyleScopedClasses['p-3']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "flex flex-col gap-1 text-xs text-slate-400" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    ...{ onChange: (__VLS_ctx.applyFilters) },
    value: (__VLS_ctx.filterGameType),
    ...{ class: "rounded-md border border-white/10 bg-slate-900/60 px-2 py-1 text-sm text-slate-100" },
});
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-white/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-900/60']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-100']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "mafia",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "game-room",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "eat-first",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "nadle",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "nadraw-show",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "checkers",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "flex flex-col gap-1 text-xs text-slate-400" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    ...{ onKeyup: (__VLS_ctx.applyFilters) },
    value: (__VLS_ctx.filterRoomId),
    type: "text",
    placeholder: "mafia:foo",
    ...{ class: "w-56 rounded-md border border-white/10 bg-slate-900/60 px-2 py-1 text-sm text-slate-100" },
});
/** @type {__VLS_StyleScopedClasses['w-56']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-white/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-900/60']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-100']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
    ...{ class: "flex flex-col gap-1 text-xs text-slate-400" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.select, __VLS_intrinsics.select)({
    value: (__VLS_ctx.filterHasErrors),
    ...{ class: "rounded-md border border-white/10 bg-slate-900/60 px-2 py-1 text-sm text-slate-100" },
});
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-white/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-900/60']} */ ;
/** @type {__VLS_StyleScopedClasses['px-2']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-100']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "1",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.option, __VLS_intrinsics.option)({
    value: "0",
});
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.applyFilters) },
    type: "button",
    ...{ class: "rounded-md border border-white/10 bg-violet-600/30 px-3 py-1.5 text-sm font-medium text-violet-50 hover:bg-violet-600/40" },
});
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-white/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-violet-600/30']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-violet-50']} */ ;
/** @type {__VLS_StyleScopedClasses['hover:bg-violet-600/40']} */ ;
if (__VLS_ctx.copyFeedback) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "ml-auto text-xs text-emerald-300" },
    });
    /** @type {__VLS_StyleScopedClasses['ml-auto']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-emerald-300']} */ ;
    (__VLS_ctx.copyFeedback);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "rounded-2xl border border-white/10 bg-slate-950/40" },
});
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-white/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-950/40']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center justify-between border-b border-white/5 px-3 py-2 text-xs text-slate-400" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['border-b']} */ ;
/** @type {__VLS_StyleScopedClasses['border-white/5']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(__VLS_ctx.total);
(__VLS_ctx.items.length);
(__VLS_ctx.offset);
if (__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
}
else if (__VLS_ctx.errorKey) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "text-red-300" },
    });
    /** @type {__VLS_StyleScopedClasses['text-red-300']} */ ;
    (__VLS_ctx.errorKey);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "overflow-x-auto" },
});
/** @type {__VLS_StyleScopedClasses['overflow-x-auto']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
    ...{ class: "min-w-full divide-y divide-white/5 text-sm" },
});
/** @type {__VLS_StyleScopedClasses['min-w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['divide-y']} */ ;
/** @type {__VLS_StyleScopedClasses['divide-white/5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({
    ...{ class: "bg-white/[0.03] text-xs uppercase tracking-wide text-slate-400" },
});
/** @type {__VLS_StyleScopedClasses['bg-white/[0.03]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-wide']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ class: "px-3 py-2 text-left" },
});
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ class: "px-3 py-2 text-left" },
});
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ class: "px-3 py-2 text-left" },
});
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ class: "px-3 py-2 text-right" },
});
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ class: "px-3 py-2 text-right" },
});
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ class: "px-3 py-2 text-right" },
});
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ class: "px-3 py-2 text-right" },
});
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-right']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ class: "px-3 py-2 text-left" },
});
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
    ...{ class: "px-3 py-2 text-left" },
});
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-left']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({
    ...{ class: "divide-y divide-white/5" },
});
/** @type {__VLS_StyleScopedClasses['divide-y']} */ ;
/** @type {__VLS_StyleScopedClasses['divide-white/5']} */ ;
if (__VLS_ctx.items.length === 0 && !__VLS_ctx.loading) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        colspan: "9",
        ...{ class: "px-3 py-6 text-center text-xs text-slate-500" },
    });
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-6']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-center']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-500']} */ ;
}
for (const [row] of __VLS_vFor((__VLS_ctx.items))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
        key: (row.id),
        ...{ class: "hover:bg-white/[0.04]" },
    });
    /** @type {__VLS_StyleScopedClasses['hover:bg-white/[0.04]']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['whitespace-nowrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
    (__VLS_ctx.formatDateTime(row.createdAt));
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-3 py-2 font-mono text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    (row.roomId);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-3 py-2 text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    (row.gameType ?? '—');
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-3 py-2 text-right font-mono text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    (__VLS_ctx.formatDuration(row.durationMs));
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-3 py-2 text-right font-mono text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    (row.eventCount);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-3 py-2 text-right font-mono text-xs" },
        ...{ class: (row.hasErrors ? 'text-red-300' : 'text-slate-500') },
    });
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    (row.errorCount + row.criticalCount);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-3 py-2 text-right font-mono text-xs" },
        ...{ class: (row.hasWarnings ? 'text-amber-300' : 'text-slate-500') },
    });
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-right']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    (row.warningCount);
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-3 py-2 text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    if (row.truncated) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "rounded-md bg-amber-500/20 px-1.5 py-0.5 text-amber-300" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-amber-500/20']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-1.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-amber-300']} */ ;
    }
    if (row.finalizedReason === 'forced') {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "ml-1 rounded-md bg-rose-500/20 px-1.5 py-0.5 text-rose-300" },
        });
        /** @type {__VLS_StyleScopedClasses['ml-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-rose-500/20']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-1.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-0.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-rose-300']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
        ...{ class: "px-3 py-2" },
    });
    /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-2']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "flex flex-wrap gap-1" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-1']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.openDetail(row.id);
                // @ts-ignore
                [applyFilters, applyFilters, applyFilters, filterGameType, filterRoomId, filterHasErrors, copyFeedback, copyFeedback, total, items, items, items, offset, loading, loading, errorKey, errorKey, formatDateTime, formatDuration, openDetail,];
            } },
        type: "button",
        ...{ class: "rounded-md border border-white/10 bg-slate-800/70 px-2 py-1 text-xs hover:bg-slate-700/70" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-white/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-slate-800/70']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:bg-slate-700/70']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.downloadReportJson(row.id);
                // @ts-ignore
                [downloadReportJson,];
            } },
        type: "button",
        ...{ class: "rounded-md border border-white/10 bg-slate-800/70 px-2 py-1 text-xs hover:bg-slate-700/70" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-white/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-slate-800/70']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['hover:bg-slate-700/70']} */ ;
    // @ts-ignore
    [];
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "flex items-center justify-between border-t border-white/5 px-3 py-2 text-xs text-slate-400" },
});
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-white/5']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.prevPage) },
    type: "button",
    ...{ class: "rounded-md border border-white/10 bg-slate-800/70 px-3 py-1 disabled:opacity-40" },
    disabled: (!__VLS_ctx.hasPrev),
});
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-white/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-800/70']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-40']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
(Math.floor(__VLS_ctx.offset / __VLS_ctx.DEFAULT_LIMIT) + 1);
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (__VLS_ctx.nextPage) },
    type: "button",
    ...{ class: "rounded-md border border-white/10 bg-slate-800/70 px-3 py-1 disabled:opacity-40" },
    disabled: (!__VLS_ctx.hasNext),
});
/** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
/** @type {__VLS_StyleScopedClasses['border']} */ ;
/** @type {__VLS_StyleScopedClasses['border-white/10']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-slate-800/70']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-40']} */ ;
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
if (__VLS_ctx.detail || __VLS_ctx.detailLoading || __VLS_ctx.detailError) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "fixed inset-0 z-[90] flex" },
        role: "dialog",
        'aria-modal': "true",
    });
    /** @type {__VLS_StyleScopedClasses['fixed']} */ ;
    /** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
    /** @type {__VLS_StyleScopedClasses['z-[90]']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.closeDetail) },
        type: "button",
        ...{ class: "flex-1 cursor-default bg-black/55 backdrop-blur" },
        'aria-label': "Close detail",
    });
    /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['cursor-default']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-black/55']} */ ;
    /** @type {__VLS_StyleScopedClasses['backdrop-blur']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.aside, __VLS_intrinsics.aside)({
        ...{ class: "flex h-full w-full max-w-[820px] flex-col gap-3 overflow-hidden border-l border-white/10 bg-[#0a0512] p-5 text-slate-100 shadow-2xl" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['h-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['w-full']} */ ;
    /** @type {__VLS_StyleScopedClasses['max-w-[820px]']} */ ;
    /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-l']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-white/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-[#0a0512]']} */ ;
    /** @type {__VLS_StyleScopedClasses['p-5']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-100']} */ ;
    /** @type {__VLS_StyleScopedClasses['shadow-2xl']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
        ...{ class: "flex items-start justify-between gap-3 border-b border-white/10 pb-3" },
    });
    /** @type {__VLS_StyleScopedClasses['flex']} */ ;
    /** @type {__VLS_StyleScopedClasses['items-start']} */ ;
    /** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
    /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-b']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-white/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['pb-3']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "min-w-0" },
    });
    /** @type {__VLS_StyleScopedClasses['min-w-0']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
        ...{ class: "truncate text-base font-semibold" },
    });
    /** @type {__VLS_StyleScopedClasses['truncate']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-base']} */ ;
    /** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
    (__VLS_ctx.detail?.roomId ?? 'Loading…');
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "text-xs text-slate-400" },
    });
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
    if (__VLS_ctx.detail) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({});
        (__VLS_ctx.detail.gameType ?? '—');
        (__VLS_ctx.formatDateTime(__VLS_ctx.detail.startedAt));
        (__VLS_ctx.formatDuration(__VLS_ctx.detail.durationMs));
        (__VLS_ctx.detail.eventCount);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.closeDetail) },
        type: "button",
        ...{ class: "rounded-md border border-white/10 bg-slate-800/70 px-2 py-1 text-xs" },
    });
    /** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
    /** @type {__VLS_StyleScopedClasses['border']} */ ;
    /** @type {__VLS_StyleScopedClasses['border-white/10']} */ ;
    /** @type {__VLS_StyleScopedClasses['bg-slate-800/70']} */ ;
    /** @type {__VLS_StyleScopedClasses['px-2']} */ ;
    /** @type {__VLS_StyleScopedClasses['py-1']} */ ;
    /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
    if (__VLS_ctx.detailLoading) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "text-sm text-slate-400" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
    }
    else if (__VLS_ctx.detailError) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "text-sm text-red-300" },
        });
        /** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-red-300']} */ ;
        (__VLS_ctx.detailError);
    }
    else if (__VLS_ctx.detail) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex min-h-0 flex-1 flex-col gap-3" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "flex flex-wrap gap-2" },
        });
        /** @type {__VLS_StyleScopedClasses['flex']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
        /** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.detail || __VLS_ctx.detailLoading || __VLS_ctx.detailError))
                        return;
                    if (!!(__VLS_ctx.detailLoading))
                        return;
                    if (!!(__VLS_ctx.detailError))
                        return;
                    if (!(__VLS_ctx.detail))
                        return;
                    __VLS_ctx.copyReportJson(__VLS_ctx.detail);
                    // @ts-ignore
                    [offset, formatDateTime, formatDuration, prevPage, hasPrev, DEFAULT_LIMIT, nextPage, hasNext, detail, detail, detail, detail, detail, detail, detail, detail, detail, detailLoading, detailLoading, detailError, detailError, detailError, closeDetail, closeDetail, copyReportJson,];
                } },
            type: "button",
            ...{ class: "rounded-md border border-white/10 bg-violet-600/30 px-3 py-1.5 text-xs font-medium hover:bg-violet-600/40" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-white/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-violet-600/30']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        /** @type {__VLS_StyleScopedClasses['hover:bg-violet-600/40']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.detail || __VLS_ctx.detailLoading || __VLS_ctx.detailError))
                        return;
                    if (!!(__VLS_ctx.detailLoading))
                        return;
                    if (!!(__VLS_ctx.detailError))
                        return;
                    if (!(__VLS_ctx.detail))
                        return;
                    __VLS_ctx.copyAiPrompt(__VLS_ctx.detail);
                    // @ts-ignore
                    [detail, copyAiPrompt,];
                } },
            type: "button",
            ...{ class: "rounded-md border border-white/10 bg-violet-600/30 px-3 py-1.5 text-xs font-medium hover:bg-violet-600/40" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-white/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-violet-600/30']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
        /** @type {__VLS_StyleScopedClasses['hover:bg-violet-600/40']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.detail || __VLS_ctx.detailLoading || __VLS_ctx.detailError))
                        return;
                    if (!!(__VLS_ctx.detailLoading))
                        return;
                    if (!!(__VLS_ctx.detailError))
                        return;
                    if (!(__VLS_ctx.detail))
                        return;
                    __VLS_ctx.downloadReportJson(__VLS_ctx.detail.id);
                    // @ts-ignore
                    [downloadReportJson, detail,];
                } },
            type: "button",
            ...{ class: "rounded-md border border-white/10 bg-slate-800/70 px-3 py-1.5 text-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-white/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-slate-800/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['px-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['py-1.5']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        if (__VLS_ctx.copyFeedback) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "ml-auto self-center text-xs text-emerald-300" },
            });
            /** @type {__VLS_StyleScopedClasses['ml-auto']} */ ;
            /** @type {__VLS_StyleScopedClasses['self-center']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-emerald-300']} */ ;
            (__VLS_ctx.copyFeedback);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "rounded-md border border-white/10 bg-slate-950/60 p-3 text-xs" },
        });
        /** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-white/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-slate-950/60']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "font-mono" },
        });
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        (__VLS_ctx.detail.hostDisplayName ?? '—');
        (__VLS_ctx.detail.hostUserId ?? '—');
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        (__VLS_ctx.detail.participantCount ?? '—');
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        (__VLS_ctx.detail.errorCount);
        (__VLS_ctx.detail.criticalCount);
        (__VLS_ctx.detail.warningCount);
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({});
        if (__VLS_ctx.detail.hasErrors) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "text-red-300" },
            });
            /** @type {__VLS_StyleScopedClasses['text-red-300']} */ ;
        }
        if (__VLS_ctx.detail.hasWarnings) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "ml-2 text-amber-300" },
            });
            /** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-amber-300']} */ ;
        }
        if (__VLS_ctx.detail.truncated) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "ml-2 text-amber-300" },
            });
            /** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-amber-300']} */ ;
        }
        if (__VLS_ctx.detail.finalizedReason) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "ml-2 text-slate-400" },
            });
            /** @type {__VLS_StyleScopedClasses['ml-2']} */ ;
            /** @type {__VLS_StyleScopedClasses['text-slate-400']} */ ;
            (__VLS_ctx.detail.finalizedReason);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.pre, __VLS_intrinsics.pre)({
            ...{ class: "min-h-0 flex-1 overflow-auto rounded-md border border-white/10 bg-slate-950/70 p-3 font-mono text-[11px] leading-relaxed text-slate-200" },
        });
        /** @type {__VLS_StyleScopedClasses['min-h-0']} */ ;
        /** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
        /** @type {__VLS_StyleScopedClasses['overflow-auto']} */ ;
        /** @type {__VLS_StyleScopedClasses['rounded-md']} */ ;
        /** @type {__VLS_StyleScopedClasses['border']} */ ;
        /** @type {__VLS_StyleScopedClasses['border-white/10']} */ ;
        /** @type {__VLS_StyleScopedClasses['bg-slate-950/70']} */ ;
        /** @type {__VLS_StyleScopedClasses['p-3']} */ ;
        /** @type {__VLS_StyleScopedClasses['font-mono']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
        /** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
        /** @type {__VLS_StyleScopedClasses['text-slate-200']} */ ;
        (JSON.stringify(__VLS_ctx.detail.reportJson, null, 2));
    }
}
// @ts-ignore
[copyFeedback, copyFeedback, detail, detail, detail, detail, detail, detail, detail, detail, detail, detail, detail, detail,];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
