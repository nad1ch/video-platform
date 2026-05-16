/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, nextTick, onBeforeUnmount, onMounted, onUnmounted, ref, shallowRef, watch, } from 'vue';
import { useI18n } from 'vue-i18n';
import { normalizeDisplayName } from 'call-core';
import { createLogger } from '@/utils/logger';
import GameEliminationMark from '../game-call/GameEliminationMark.vue';
import StreamAudio from '../StreamAudio.vue';
import StreamVideo from '../StreamVideo.vue';
const tileLog = createLogger('participant-tile');
const { t } = useI18n();
const emit = defineEmits();
const props = withDefaults(defineProps(), {
    streamViewMode: false,
    mafiaLifeState: 'alive',
    mafiaEliminationKind: 'skull',
    mafiaEliminationBackground: 'dark',
    mafiaDeadBackgroundUrl: null,
    mafiaHostShowLifeToggle: false,
    mafiaLayerViewportObserve: false,
    videoPlaybackSuppressed: false,
    rowSpeaking: false,
    eatFirstTraitHostView: false,
    eatFirstTraitOwnerView: false,
    eatFirstRevealedTraitKeys: () => [],
    eatFirstActionCard: null,
    canEditDisplayName: true,
});
const ELIMINATION_BACKGROUND_OPTIONS = Object.freeze([
    'dark',
    'red',
    'violet',
    'gray',
]);
const tileRootRef = ref(null);
let tileLayerObserver = null;
let tileLayerLastEmitted = null;
const editingName = ref(false);
const nameDraft = ref('');
const nameInputRef = ref(null);
function peerIdForNameEdit() {
    return typeof props.peerId === 'string' ? props.peerId.trim() : '';
}
const remotePlaybackStallPeerIdForVideo = computed(() => {
    if (props.isLocal) {
        return null;
    }
    const id = typeof props.peerId === 'string' ? props.peerId.trim() : '';
    return id.length > 0 ? id : null;
});
function startNameEdit() {
    if (props.streamViewMode || props.canEditDisplayName !== true) {
        return;
    }
    const id = peerIdForNameEdit();
    if (!id) {
        return;
    }
    nameDraft.value = props.displayName;
    editingName.value = true;
    void nextTick(() => {
        nameInputRef.value?.focus();
        nameInputRef.value?.select();
    });
}
function cancelNameEdit() {
    editingName.value = false;
    nameDraft.value = props.displayName;
}
function finishNameEdit() {
    if (!editingName.value) {
        return;
    }
    if (props.canEditDisplayName !== true) {
        editingName.value = false;
        return;
    }
    editingName.value = false;
    const id = peerIdForNameEdit();
    if (!id) {
        return;
    }
    const trimmed = normalizeDisplayName(nameDraft.value).slice(0, 64);
    if (trimmed === normalizeDisplayName(props.displayName)) {
        return;
    }
    emit('commit-local-display-name', { peerId: id, name: trimmed.length > 0 ? trimmed : null });
}
function onNameInputEnter(ev) {
    const el = ev.target;
    if (el instanceof HTMLInputElement) {
        el.blur();
    }
}
function initials(name) {
    const n = normalizeDisplayName(name);
    const parts = n.split(/\s+/).filter(Boolean).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}
const audioSplitStream = shallowRef(null);
function clearSplitHolder(holder) {
    const m = holder.value;
    if (!m) {
        return;
    }
    for (const t of [...m.getTracks()]) {
        m.removeTrack(t);
    }
    holder.value = null;
}
function syncSplitStream(holder, tracks) {
    if (tracks.length === 0) {
        clearSplitHolder(holder);
        return;
    }
    if (!holder.value) {
        holder.value = new MediaStream();
    }
    const m = holder.value;
    const want = new Set(tracks.map((t) => t.id));
    const kind = tracks[0]?.kind;
    const current = kind === 'video' ? m.getVideoTracks() : m.getAudioTracks();
    for (const t of current) {
        if (!want.has(t.id)) {
            m.removeTrack(t);
        }
    }
    for (const t of tracks) {
        if (!m.getTracks().some((et) => et.id === t.id)) {
            m.addTrack(t);
        }
    }
}
watch(() => [props.stream, props.playRev ?? 0, props.isLocal], () => {
    if (!props.stream || props.isLocal) {
        clearSplitHolder(audioSplitStream);
        return;
    }
    syncSplitStream(audioSplitStream, props.stream.getAudioTracks());
}, { immediate: true });
onUnmounted(() => {
    clearSplitHolder(audioSplitStream);
    clearEatFirstTimers();
});
/**
 * Resolved fallback for each neutral / legacy prop pair: the neutral
 * `game*` prop wins when defined, otherwise we fall back to the legacy
 * `mafia*` prop (which carries its own default via `withDefaults`). This
 * lets Game Template bind `:game-*` and production Mafia keep binding
 * `:mafia-*` without changing internal logic anywhere downstream.
 */
const resolvedSeatIndex = computed(() => props.gameSeatIndex ?? props.mafiaSeatIndex);
const resolvedVisibleRole = computed(() => props.gameVisibleRole ?? props.mafiaVisibleRole);
const resolvedLifeState = computed(() => props.gameLifeState ?? props.mafiaLifeState);
const resolvedEliminationKind = computed(() => props.gameEliminationKind ?? props.mafiaEliminationKind);
const resolvedEliminationIconSrc = computed(() => {
    const value = props.gameEliminationIconSrc ?? props.mafiaEliminationIconSrc;
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : '';
});
const resolvedEliminationBackground = computed(() => props.gameEliminationBackground ?? props.mafiaEliminationBackground);
const resolvedDeadBackgroundUrl = computed(() => props.gameDeadBackgroundUrl ?? props.mafiaDeadBackgroundUrl);
const resolvedHostShowLifeToggle = computed(() => props.gameHostShowLifeToggle || props.mafiaHostShowLifeToggle);
const resolvedLayerViewportObserve = computed(() => props.gameLayerViewportObserve || props.mafiaLayerViewportObserve);
const showSeatBadge = computed(() => typeof resolvedSeatIndex.value === 'number' && resolvedSeatIndex.value > 0);
const EAT_FIRST_TRAIT_LABELS = {
    gender: 'Стать',
    age: 'Вік',
    profession: 'Професія',
    health: 'Здоровʼя',
    hobby: 'Хобі',
    phobia: 'Фобія',
    fact: 'Факт',
    baggage: 'Багаж',
};
const EAT_FIRST_REVEAL_DELAY_MS = 3000;
const eatFirstRevealState = ref({});
const eatFirstRevealTimers = new Map();
const eatFirstToastVisible = ref(false);
const eatFirstToastLabel = ref('');
let eatFirstToastTimer = null;
function clearEatFirstTimers() {
    for (const timer of eatFirstRevealTimers.values()) {
        clearTimeout(timer);
    }
    eatFirstRevealTimers.clear();
    if (eatFirstToastTimer != null) {
        clearTimeout(eatFirstToastTimer);
        eatFirstToastTimer = null;
    }
}
const eatFirstTraitValues = computed(() => {
    const src = props.eatFirstTraits && typeof props.eatFirstTraits === 'object' && !Array.isArray(props.eatFirstTraits)
        ? props.eatFirstTraits
        : null;
    if (!src)
        return {};
    const out = {};
    for (const key of Object.keys(EAT_FIRST_TRAIT_LABELS)) {
        const value = typeof src[key] === 'string' ? src[key].trim() : '';
        if (value.length > 0)
            out[key] = value;
    }
    return out;
});
/**
 * Render the Eat First trait overlay whenever at least one trait has a value.
 * Partial state is legitimate (trait-type reroll mid-round, cold join before
 * `eat:table-state-sync` has hydrated every key); requiring all 8 keys hid the
 * whole overlay during normal play. Per-cell renderers already handle empty
 * values gracefully — host/owner via `'Невідомо'`, OBS viewers via the
 * crossed-eye marker.
 */
const hasEatFirstTraits = computed(() => Object.keys(EAT_FIRST_TRAIT_LABELS).some((key) => {
    const value = eatFirstTraitValues.value[key];
    return typeof value === 'string' && value.length > 0;
}));
const eatFirstTraitsBySection = computed(() => {
    const values = eatFirstTraitValues.value;
    return {
        top: [
            { key: 'gender', label: EAT_FIRST_TRAIT_LABELS.gender, value: values.gender ?? '' },
            { key: 'age', label: EAT_FIRST_TRAIT_LABELS.age, value: values.age ?? '' },
        ],
        left: [
            { key: 'profession', label: EAT_FIRST_TRAIT_LABELS.profession, value: values.profession ?? '' },
            { key: 'health', label: EAT_FIRST_TRAIT_LABELS.health, value: values.health ?? '' },
            { key: 'hobby', label: EAT_FIRST_TRAIT_LABELS.hobby, value: values.hobby ?? '' },
        ],
        right: [
            { key: 'phobia', label: EAT_FIRST_TRAIT_LABELS.phobia, value: values.phobia ?? '' },
            { key: 'fact', label: EAT_FIRST_TRAIT_LABELS.fact, value: values.fact ?? '' },
            { key: 'baggage', label: EAT_FIRST_TRAIT_LABELS.baggage, value: values.baggage ?? '' },
        ],
    };
});
// Local reveal animation state is keyed by `traitKey`, not by trait value — the
// only meaningful invalidation is the tile binding to a different peer. Avoid
// `JSON.stringify` here: at 8–12 cameras × every `eat:table-state-sync` it is
// the hottest per-tile work and contributes to render churn without changing
// behavior (server-authoritative reveal state arrives via
// `props.eatFirstRevealedTraitKeys`, which is already reactive per-cell).
watch(() => props.peerId, () => {
    clearEatFirstTimers();
    eatFirstRevealState.value = {};
    eatFirstToastVisible.value = false;
    eatFirstToastLabel.value = '';
});
function isEatFirstTraitOwnerView() {
    return props.eatFirstTraitOwnerView === true && !props.streamViewMode;
}
function isEatFirstTraitHostView() {
    return props.eatFirstTraitHostView === true && !props.streamViewMode;
}
function canRevealTrait() {
    return isEatFirstTraitOwnerView() || isEatFirstTraitHostView();
}
function canGenerateTrait() {
    return isEatFirstTraitHostView();
}
function eatFirstTraitStateFor(key) {
    if (Array.isArray(props.eatFirstRevealedTraitKeys) && props.eatFirstRevealedTraitKeys.includes(key)) {
        return 'revealed';
    }
    return eatFirstRevealState.value[key] ?? 'hidden';
}
/** Remote viewers only: compact chips until publicly revealed. Host and seated player see full labels/values. */
function eatFirstTraitCellSealed(key) {
    if (isEatFirstTraitHostView() || isEatFirstTraitOwnerView())
        return false;
    return eatFirstTraitStateFor(key) !== 'revealed';
}
function eatFirstTraitInsightLayout() {
    return isEatFirstTraitHostView() || isEatFirstTraitOwnerView();
}
function eatFirstCanRevealValue(key) {
    if (props.eatFirstTraitHostView || props.eatFirstTraitOwnerView)
        return true;
    return eatFirstTraitStateFor(key) === 'revealed';
}
function eatFirstValueText(key, rawValue) {
    const effectiveValue = typeof rawValue === 'string' ? rawValue.trim() : '';
    if (eatFirstCanRevealValue(key))
        return effectiveValue || 'Невідомо';
    return '';
}
const EAT_FIRST_TRAIT_VALUE_MAX_LINE_CHARS = 18;
/** Word-wrapped lines; each line is at most `EAT_FIRST_TRAIT_VALUE_MAX_LINE_CHARS` (long tokens split). */
function eatFirstWrapTraitValueLines(text) {
    const maxChars = EAT_FIRST_TRAIT_VALUE_MAX_LINE_CHARS;
    const t = text.trim();
    if (!t)
        return [];
    const lines = [];
    let line = '';
    const pushLine = () => {
        if (line.length > 0) {
            lines.push(line);
            line = '';
        }
    };
    const consumeOversizedWord = (word) => {
        let w = word;
        while (w.length > maxChars) {
            lines.push(w.slice(0, maxChars));
            w = w.slice(maxChars);
        }
        line = w;
    };
    const words = t.split(/\s+/).filter(Boolean);
    for (const word of words) {
        if (word.length > maxChars) {
            pushLine();
            consumeOversizedWord(word);
            continue;
        }
        const next = line.length === 0 ? word : `${line} ${word}`;
        if (next.length <= maxChars) {
            line = next;
        }
        else {
            pushLine();
            line = word;
        }
    }
    pushLine();
    return lines;
}
function eatFirstValueDisplayLines(key, rawValue) {
    const full = eatFirstValueText(key, rawValue).trim();
    if (!full)
        return [];
    return eatFirstWrapTraitValueLines(full);
}
/** Non-owner/non-host viewers: hidden traits show a crossed-out eye in the value slot (no asterisks). */
function eatFirstPeerShowsHiddenEyeMark(key) {
    if (canRevealTrait())
        return false;
    return eatFirstTraitStateFor(key) !== 'revealed';
}
function onEatFirstReveal(key, label) {
    if (!canRevealTrait())
        return;
    const current = eatFirstTraitStateFor(key);
    // Toggle: clicking a revealed trait emits a close-request so the server
    // strips it from `revealedByPeer`/`openedByPlayerByPeer`. The server then
    // re-broadcasts and the parent CallPage updates `eatFirstRevealedTraitKeys`.
    if (current === 'revealed') {
        const t = eatFirstRevealTimers.get(key);
        if (t != null) {
            clearTimeout(t);
            eatFirstRevealTimers.delete(key);
        }
        eatFirstRevealState.value = { ...eatFirstRevealState.value, [key]: 'hidden' };
        emit('eat-first-reveal-trait', {
            peerId: typeof props.peerId === 'string' ? props.peerId : '',
            traitKey: key,
            closed: true,
        });
        return;
    }
    if (current === 'pending')
        return;
    eatFirstRevealState.value = { ...eatFirstRevealState.value, [key]: 'pending' };
    eatFirstToastLabel.value = label;
    eatFirstToastVisible.value = true;
    if (eatFirstToastTimer != null) {
        clearTimeout(eatFirstToastTimer);
    }
    eatFirstToastTimer = setTimeout(() => {
        eatFirstToastVisible.value = false;
        eatFirstToastTimer = null;
    }, EAT_FIRST_REVEAL_DELAY_MS);
    const existing = eatFirstRevealTimers.get(key);
    if (existing != null) {
        clearTimeout(existing);
    }
    const timer = setTimeout(() => {
        eatFirstRevealState.value = { ...eatFirstRevealState.value, [key]: 'revealed' };
        eatFirstRevealTimers.delete(key);
        emit('eat-first-reveal-trait', {
            peerId: typeof props.peerId === 'string' ? props.peerId : '',
            traitKey: key,
        });
    }, EAT_FIRST_REVEAL_DELAY_MS);
    eatFirstRevealTimers.set(key, timer);
}
function eatFirstRevealEyeLabel(key) {
    return eatFirstTraitStateFor(key) === 'revealed'
        ? 'Приховати характеристику від інших'
        : 'Показати характеристику всім';
}
function onEatFirstGenerateTrait(key) {
    if (!canGenerateTrait())
        return;
    emit('eat-first-generate-trait', {
        peerId: typeof props.peerId === 'string' ? props.peerId : '',
        traitKey: key,
    });
}
function onEatFirstRerollActionCard() {
    if (!isEatFirstTraitHostView())
        return;
    emit('eat-first-reroll-action-card', {
        peerId: typeof props.peerId === 'string' ? props.peerId : '',
    });
}
function onEatFirstPlayerUseActionCard() {
    if (!isEatFirstTraitOwnerView() || isEatFirstTraitHostView())
        return;
    const card = props.eatFirstActionCard;
    if (!card || card.used === true)
        return;
    emit('eat-first-use-action-card', {
        peerId: typeof props.peerId === 'string' ? props.peerId : '',
    });
}
const tilePrimaryLine = computed(() => {
    if (!showSeatBadge.value || typeof resolvedSeatIndex.value !== 'number') {
        return props.displayName;
    }
    return normalizeDisplayName(props.displayName);
});
const showRoleBadge = computed(() => !props.streamViewMode && resolvedVisibleRole.value != null);
const roleBadgeLabel = computed(() => {
    const r = resolvedVisibleRole.value;
    if (r == null) {
        return '';
    }
    return t(`mafiaPage.nightRole.${r}`);
});
const hasLiveLocalVideo = computed(() => {
    if (!props.stream || !props.isLocal) {
        return false;
    }
    void props.playRev;
    if (props.videoPresentation === 'none') {
        return false;
    }
    return props.stream.getVideoTracks().some((t) => t.readyState === 'live');
});
/** Remote only: at least one video track with `readyState === 'live'` (do not use `muted` / `enabled`). */
const hasLiveVideoTrack = computed(() => {
    if (!props.stream || props.isLocal) {
        return false;
    }
    void props.playRev;
    return props.stream.getVideoTracks().some((t) => t.readyState === 'live');
});
const showVideo = computed(() => {
    if (!props.stream) {
        return false;
    }
    if (props.isLocal) {
        return props.videoEnabled && hasLiveLocalVideo.value;
    }
    return props.videoEnabled && hasLiveVideoTrack.value;
});
const isDead = computed(() => resolvedLifeState.value === 'dead');
const deadBackgroundUrlText = computed(() => {
    const value = resolvedDeadBackgroundUrl.value;
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : '';
});
const hasCustomDeadBackground = computed(() => isDead.value && deadBackgroundUrlText.value.length > 0);
const deadShade = computed(() => !props.isLocal && !props.streamViewMode && isDead.value);
const eliminationBackgroundClass = computed(() => isDead.value
    ? hasCustomDeadBackground.value
        ? 'tile--mafia-elim-bg-custom'
        : `tile--mafia-elim-bg-${resolvedEliminationBackground.value}`
    : '');
/**
 * Per-tile signal that the consumer opted into the neutral `game-*`
 * API (i.e. rendered from the Game Template / GameRoom path):
 * `gameLifeState` is the one `game*` prop the GT call site always binds
 * to a defined value; Mafia never binds it. Used to route user-visible
 * i18n labels (host life toggle title, elimination-background labels)
 * through `gameRoom.*` keys instead of legacy `mafiaPage.*` ones.
 * No route-name coupling: ParticipantTile stays a pure presentational
 * component.
 */
const usesNeutralApi = computed(() => props.gameLifeState !== undefined);
const hostLifeToggleTitle = computed(() => {
    if (usesNeutralApi.value) {
        return isDead.value
            ? t('gameRoom.hostTileReviveTitle')
            : t('gameRoom.hostTileEliminateTitle');
    }
    return isDead.value
        ? t('mafiaPage.hostTileReviveTitle')
        : t('mafiaPage.hostTileEliminateTitle');
});
const eliminationBackgroundGroupLabel = computed(() => usesNeutralApi.value
    ? t('gameRoom.eliminationBackgroundLabel')
    : t('mafiaPage.eliminationBackgroundLabel'));
function eliminationBackgroundSwatchLabel(bg) {
    return usesNeutralApi.value
        ? t(`gameRoom.eliminationBackground.${bg}`)
        : t(`mafiaPage.eliminationBackground.${bg}`);
}
const deadBackgroundStyle = computed(() => hasCustomDeadBackground.value
    ? { '--mafia-dead-background-image': `url(${JSON.stringify(deadBackgroundUrlText.value)})` }
    : undefined);
const resolvedAvatarUrl = computed(() => {
    const u = props.avatarUrl;
    return typeof u === 'string' && u.trim().length > 0 ? u.trim() : '';
});
const showCustomDeadBackgroundOnly = computed(() => hasCustomDeadBackground.value && !showVideo.value);
const showEliminationMark = computed(() => isDead.value && !showCustomDeadBackgroundOnly.value && !showVideo.value);
const showAvatar = computed(() => !showCustomDeadBackgroundOnly.value &&
    !showEliminationMark.value &&
    !showVideo.value &&
    resolvedAvatarUrl.value !== '');
const showInitialsFallback = computed(() => !showCustomDeadBackgroundOnly.value &&
    !showEliminationMark.value &&
    !showVideo.value &&
    resolvedAvatarUrl.value === '');
const volumePercentUi = computed(() => Math.min(200, Math.max(0, Math.round((props.remoteListenVolume ?? 1) * 100))));
const localListenSilenced = computed(() => Boolean(props.remoteListenMuted) ||
    (Number(props.remoteListenVolume ?? 1) <= 0.0001));
const localListenIconAria = computed(() => localListenSilenced.value ? t('callPage.localListenUnmuteAria') : t('callPage.localListenMuteAria'));
/**
 * Stable DOM identity for `<StreamVideo>`: peer id only (no playRev/stream in key).
 * Track/cam changes are handled inside `StreamVideo` via `playRev` + `bindStream`; remounting on every bump was redundant and costly at scale.
 */
const streamVideoStableKey = computed(() => props.isLocal ? 'local' : typeof props.peerId === 'string' && props.peerId.length > 0 ? props.peerId : 'peer');
const isSpeaking = computed(() => props.rowSpeaking);
/** Memo deps for the video subtree — label/mic/row speaking can change without patching WebRTC. */
const streamVideoMemoDeps = computed(() => [
    props.stream,
    props.playRev ?? 0,
    showVideo.value,
    hasLiveVideoTrack.value,
    Boolean(props.videoFillCover),
    props.isLocal,
    props.videoPresentation,
    props.mafiaLifeState,
    Boolean(props.videoPlaybackSuppressed),
    props.videoTargetPlaybackFps ?? null,
]);
function onVolumeSliderInput(ev) {
    const t = ev.target;
    const pct = Math.min(200, Math.max(0, Number(t.value)));
    const gain = pct / 100;
    emit('update:listenVolume', gain);
    if (pct > 0 && (props.remoteListenMuted ?? false)) {
        emit('update:listenMuted', false);
    }
}
function onLocalListenIconClick() {
    const vol = Number(props.remoteListenVolume ?? 1);
    const muted = Boolean(props.remoteListenMuted);
    if (!muted && vol > 0.0001) {
        emit('update:listenMuted', true);
        return;
    }
    emit('update:listenMuted', false);
}
const killAnim = ref(false);
const reviveAnim = ref(false);
let killAnimTimer;
let reviveAnimTimer;
watch(() => isDead.value, (next, prev) => {
    if (props.isLocal || props.streamViewMode) {
        return;
    }
    if (prev === undefined) {
        return;
    }
    if (prev === true && next === false) {
        reviveAnim.value = true;
        if (reviveAnimTimer != null) {
            clearTimeout(reviveAnimTimer);
        }
        reviveAnimTimer = setTimeout(() => {
            reviveAnim.value = false;
            reviveAnimTimer = undefined;
        }, 700);
    }
    else if (prev === false && next === true) {
        killAnim.value = true;
        if (killAnimTimer != null) {
            clearTimeout(killAnimTimer);
        }
        killAnimTimer = setTimeout(() => {
            killAnim.value = false;
            killAnimTimer = undefined;
        }, 420);
    }
});
function onHostLifeClick() {
    const id = typeof props.peerId === 'string' ? props.peerId.trim() : '';
    if (id.length < 1) {
        return;
    }
    emit('mafia-toggle-life', id);
    emit('game-toggle-life', id);
    if (!isDead.value) {
        emit('mafia-force-camera-off', id);
        emit('game-force-camera-off', id);
    }
}
function setEliminationBackground(background) {
    const id = typeof props.peerId === 'string' ? props.peerId.trim() : '';
    if (id.length < 1) {
        return;
    }
    emit('mafia-set-elimination-background', { peerId: id, background });
    emit('game-set-elimination-background', { peerId: id, background });
}
onBeforeUnmount(() => {
    if (killAnimTimer != null) {
        clearTimeout(killAnimTimer);
    }
    if (reviveAnimTimer != null) {
        clearTimeout(reviveAnimTimer);
    }
    disconnectTileLayerObserver();
    tileLayerLastEmitted = null;
    if (resolvedLayerViewportObserve.value && !props.isLocal) {
        emit('mafia-viewport-layers', true);
        emit('game-viewport-layers', true);
    }
});
function disconnectTileLayerObserver() {
    if (tileLayerObserver) {
        tileLayerObserver.disconnect();
        tileLayerObserver = null;
    }
}
function emitTileLayerViewport(visible) {
    if (tileLayerLastEmitted === visible) {
        return;
    }
    tileLayerLastEmitted = visible;
    emit('mafia-viewport-layers', visible);
    emit('game-viewport-layers', visible);
}
function connectTileLayerObserver() {
    disconnectTileLayerObserver();
    tileLayerLastEmitted = null;
    if (typeof window === 'undefined' || !resolvedLayerViewportObserve.value || props.isLocal) {
        return;
    }
    const id = peerIdForNameEdit();
    if (!id) {
        return;
    }
    const el = tileRootRef.value;
    if (!el) {
        return;
    }
    tileLayerObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (entry.target === el) {
                emitTileLayerViewport(entry.isIntersecting);
            }
        }
    }, { root: null, rootMargin: '10% 10% 10% 10%', threshold: 0 });
    tileLayerObserver.observe(el);
}
function scheduleTileLayerObserverConnect() {
    void nextTick(() => {
        if (!resolvedLayerViewportObserve.value || props.isLocal) {
            disconnectTileLayerObserver();
            tileLayerLastEmitted = null;
            return;
        }
        connectTileLayerObserver();
    });
}
watch(() => [resolvedLayerViewportObserve.value, props.isLocal, props.peerId], () => {
    scheduleTileLayerObserverConnect();
}, { flush: 'post' });
onMounted(() => {
    scheduleTileLayerObserverConnect();
});
if (import.meta.env.DEV) {
    watch(() => [
        props.peerId,
        props.isLocal,
        showVideo.value,
        props.videoPresentation,
        props.videoFillCover,
        props.stream,
        props.playRev,
        hasLiveVideoTrack.value,
        props.videoEnabled,
    ], () => {
        if (props.isLocal) {
            return;
        }
        const v = props.stream?.getVideoTracks()[0];
        tileLog.debug('remote tile', {
            peerId: props.peerId,
            showVideo: showVideo.value,
            videoPresentation: props.videoPresentation,
            videoEnabled: props.videoEnabled,
            hasLiveVideoTrack: hasLiveVideoTrack.value,
            vt: v
                ? {
                    readyState: v.readyState,
                    muted: v.muted,
                    enabled: v.enabled,
                }
                : null,
        });
    }, { flush: 'post' });
}
const __VLS_defaults = {
    streamViewMode: false,
    mafiaLifeState: 'alive',
    mafiaEliminationKind: 'skull',
    mafiaEliminationBackground: 'dark',
    mafiaDeadBackgroundUrl: null,
    mafiaHostShowLifeToggle: false,
    mafiaLayerViewportObserve: false,
    videoPlaybackSuppressed: false,
    rowSpeaking: false,
    eatFirstTraitHostView: false,
    eatFirstTraitOwnerView: false,
    eatFirstRevealedTraitKeys: () => [],
    eatFirstActionCard: null,
    canEditDisplayName: true,
};
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['tile']} */ ;
/** @type {__VLS_StyleScopedClasses['tile']} */ ;
/** @type {__VLS_StyleScopedClasses['is-speaking']} */ ;
/** @type {__VLS_StyleScopedClasses['tile']} */ ;
/** @type {__VLS_StyleScopedClasses['is-speaking']} */ ;
/** @type {__VLS_StyleScopedClasses['tile']} */ ;
/** @type {__VLS_StyleScopedClasses['is-speaking']} */ ;
/** @type {__VLS_StyleScopedClasses['tile']} */ ;
/** @type {__VLS_StyleScopedClasses['tile']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-remote-volume']} */ ;
/** @type {__VLS_StyleScopedClasses['tile--mafia-kill-anim']} */ ;
/** @type {__VLS_StyleScopedClasses['tile--mafia-revive-glow']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-video-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['tile']} */ ;
/** @type {__VLS_StyleScopedClasses['is-speaking']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-video-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-video-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['tile--speaking']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-video-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-media']} */ ;
/** @type {__VLS_StyleScopedClasses['tile--mafia-elim-bg-dark']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-video-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['tile--mafia-elim-bg-dark']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-video-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['tile--mafia-elim-bg-red']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-placeholder']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-video-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['tile--mafia-elim-bg-violet']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-placeholder']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-video-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['tile--mafia-elim-bg-gray']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-placeholder']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-video-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['tile--mafia-elim-bg-custom']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-placeholder']} */ ;
/** @type {__VLS_StyleScopedClasses['tile--mafia-elim-bg-red']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-dead-veneer']} */ ;
/** @type {__VLS_StyleScopedClasses['tile--mafia-elim-bg-violet']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-dead-veneer']} */ ;
/** @type {__VLS_StyleScopedClasses['tile--mafia-elim-bg-gray']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-dead-veneer']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-video-clip']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-video-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-video-clip']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-eat-first-overlay--insight']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-eat-first-overlay__top']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-eat-first-overlay__column']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-eat-first-card--sealed']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-eat-first-card--mini']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-eat-first-card--revealed']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-eat-first-card--insight']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-eat-first-card--insight']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-eat-first-card--insight']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-eat-first-card__value']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-eat-first-card__icon']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-eat-first-card__main']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-eat-first-card__title']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-eat-first-card__value']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-eat-first-card__value']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-eat-first-card--sealed']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-eat-first-card__value']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-eat-first-card__value--peer-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-eat-first-card__value-line']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-eat-first-card__value--peer-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-eat-first-card__peer-hidden-eye']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-eat-first-card__eye-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-eat-first-card__eye-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-eat-first-card__action-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-eat-first-action-card__use-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-eat-first-action-card__use-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-eat-first-action-card__btn']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-eat-first-action-card__btn']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-eat-first-toast__line']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-eat-first-toast__line']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-overlay__name-input']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-menu__life']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-menu__life--revive']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-menu__life-ico']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-remote-volume']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-remote-volume']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-remote-volume']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-menu']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-menu--remote']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-remote-volume__trigger']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-remote-volume']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-remote-volume__dropdown']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-remote-volume']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-remote-volume__dropdown']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-remote-volume__dropdown']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-menu__life']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-menu-hoverable--remote']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-remote-volume']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-menu__life']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-menu-hoverable--remote']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-remote-volume']} */ ;
/** @type {__VLS_StyleScopedClasses['tile']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-menu__life']} */ ;
/** @type {__VLS_StyleScopedClasses['tile']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-menu__life']} */ ;
/** @type {__VLS_StyleScopedClasses['tile']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-menu-hoverable--remote']} */ ;
/** @type {__VLS_StyleScopedClasses['tile']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-menu-hoverable--remote']} */ ;
/** @type {__VLS_StyleScopedClasses['tile']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-remote-volume']} */ ;
/** @type {__VLS_StyleScopedClasses['tile']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-remote-volume']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-menu__dropdown']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-menu__swatch']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-placeholder']} */ ;
/** @type {__VLS_StyleScopedClasses['tile--speaking']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-video-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-menu']} */ ;
/** @type {__VLS_StyleScopedClasses['tile--speaking']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-video-wrap']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "tileRootRef",
    ...{ class: "tile" },
    draggable: "false",
    'data-video-presentation': (__VLS_ctx.videoPresentation),
    ...{ class: ([
            `tile--${__VLS_ctx.sizeTier}`,
            __VLS_ctx.eliminationBackgroundClass,
            {
                'is-speaking': __VLS_ctx.isSpeaking,
                'tile--speaking': __VLS_ctx.isSpeaking,
                'tile--mafia-kill-anim': __VLS_ctx.killAnim,
                'tile--mafia-revive-glow': __VLS_ctx.reviveAnim,
            },
        ]) },
    ...{ style: (__VLS_ctx.deadBackgroundStyle) },
});
/** @type {__VLS_StyleScopedClasses['tile']} */ ;
/** @type {__VLS_StyleScopedClasses['is-speaking']} */ ;
/** @type {__VLS_StyleScopedClasses['tile--speaking']} */ ;
/** @type {__VLS_StyleScopedClasses['tile--mafia-kill-anim']} */ ;
/** @type {__VLS_StyleScopedClasses['tile--mafia-revive-glow']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "tile-media" },
});
/** @type {__VLS_StyleScopedClasses['tile-media']} */ ;
if (__VLS_ctx.hasEatFirstTraits) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "tile-eat-first-overlay" },
        ...{ class: ({ 'tile-eat-first-overlay--insight': __VLS_ctx.eatFirstTraitInsightLayout() }) },
        'aria-hidden': "false",
    });
    /** @type {__VLS_StyleScopedClasses['tile-eat-first-overlay']} */ ;
    /** @type {__VLS_StyleScopedClasses['tile-eat-first-overlay--insight']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "tile-eat-first-overlay__top" },
    });
    /** @type {__VLS_StyleScopedClasses['tile-eat-first-overlay__top']} */ ;
    for (const [item] of __VLS_vFor((__VLS_ctx.eatFirstTraitsBySection.top))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (`eatf-top-${item.key}`),
            ...{ class: "tile-eat-first-card tile-eat-first-card--mini" },
            ...{ class: ({
                    'tile-eat-first-card--pending': __VLS_ctx.eatFirstTraitStateFor(item.key) === 'pending',
                    'tile-eat-first-card--revealed': __VLS_ctx.eatFirstTraitStateFor(item.key) === 'revealed',
                    'tile-eat-first-card--sealed': __VLS_ctx.eatFirstTraitCellSealed(item.key),
                    'tile-eat-first-card--insight': __VLS_ctx.eatFirstTraitInsightLayout(),
                }) },
        });
        /** @type {__VLS_StyleScopedClasses['tile-eat-first-card']} */ ;
        /** @type {__VLS_StyleScopedClasses['tile-eat-first-card--mini']} */ ;
        /** @type {__VLS_StyleScopedClasses['tile-eat-first-card--pending']} */ ;
        /** @type {__VLS_StyleScopedClasses['tile-eat-first-card--revealed']} */ ;
        /** @type {__VLS_StyleScopedClasses['tile-eat-first-card--sealed']} */ ;
        /** @type {__VLS_StyleScopedClasses['tile-eat-first-card--insight']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tile-eat-first-card__icon" },
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['tile-eat-first-card__icon']} */ ;
        if (item.key === 'gender') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
                xmlns: "http://www.w3.org/2000/svg",
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                'stroke-width': "1.8",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                d: "M15 3h6v6",
                'stroke-linecap': "round",
                'stroke-linejoin': "round",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                d: "M21 3l-5 5",
                'stroke-linecap': "round",
                'stroke-linejoin': "round",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
                cx: "10",
                cy: "14",
                r: "5",
            });
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
                xmlns: "http://www.w3.org/2000/svg",
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                'stroke-width': "1.8",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
                x: "3.5",
                y: "5.5",
                width: "17",
                height: "15",
                rx: "2.2",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                d: "M8 3.5v4M16 3.5v4M3.5 10.5h17",
                'stroke-linecap': "round",
                'stroke-linejoin': "round",
            });
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tile-eat-first-card__main" },
        });
        /** @type {__VLS_StyleScopedClasses['tile-eat-first-card__main']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tile-eat-first-card__title" },
        });
        /** @type {__VLS_StyleScopedClasses['tile-eat-first-card__title']} */ ;
        (item.label.toUpperCase());
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tile-eat-first-card__value" },
            ...{ class: ({ 'tile-eat-first-card__value--peer-hidden': __VLS_ctx.eatFirstPeerShowsHiddenEyeMark(item.key) }) },
        });
        /** @type {__VLS_StyleScopedClasses['tile-eat-first-card__value']} */ ;
        /** @type {__VLS_StyleScopedClasses['tile-eat-first-card__value--peer-hidden']} */ ;
        if (__VLS_ctx.eatFirstPeerShowsHiddenEyeMark(item.key)) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "tile-eat-first-card__peer-hidden-eye" },
                'aria-hidden': "true",
            });
            /** @type {__VLS_StyleScopedClasses['tile-eat-first-card__peer-hidden-eye']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
                xmlns: "http://www.w3.org/2000/svg",
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                'stroke-width': "1.8",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                d: "M3 3l18 18",
                'stroke-linecap': "round",
                'stroke-linejoin': "round",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                d: "M10.8 6.1A12.6 12.6 0 0 1 12 5.8c6.7 0 10.5 6.2 10.5 6.2a18 18 0 0 1-3.1 3.9",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                d: "M14.2 14.2a3.2 3.2 0 0 1-4.4-4.4",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                d: "M6.1 8.1A18.8 18.8 0 0 0 1.5 12s3.8 6.2 10.5 6.2a12.6 12.6 0 0 0 3.3-.4",
            });
        }
        else {
            for (const [line, eatFirstLineIdx] of __VLS_vFor((__VLS_ctx.eatFirstValueDisplayLines(item.key, item.value)))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    key: (`eatf-mini-val-${item.key}-${eatFirstLineIdx}`),
                    ...{ class: "tile-eat-first-card__value-line" },
                });
                /** @type {__VLS_StyleScopedClasses['tile-eat-first-card__value-line']} */ ;
                (line);
                // @ts-ignore
                [videoPresentation, sizeTier, eliminationBackgroundClass, isSpeaking, isSpeaking, killAnim, reviveAnim, deadBackgroundStyle, hasEatFirstTraits, eatFirstTraitInsightLayout, eatFirstTraitInsightLayout, eatFirstTraitsBySection, eatFirstTraitStateFor, eatFirstTraitStateFor, eatFirstTraitCellSealed, eatFirstPeerShowsHiddenEyeMark, eatFirstPeerShowsHiddenEyeMark, eatFirstValueDisplayLines,];
            }
        }
        if (__VLS_ctx.canGenerateTrait() || __VLS_ctx.canRevealTrait()) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "tile-eat-first-card__actions" },
            });
            /** @type {__VLS_StyleScopedClasses['tile-eat-first-card__actions']} */ ;
            if (__VLS_ctx.canGenerateTrait()) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.hasEatFirstTraits))
                                return;
                            if (!(__VLS_ctx.canGenerateTrait() || __VLS_ctx.canRevealTrait()))
                                return;
                            if (!(__VLS_ctx.canGenerateTrait()))
                                return;
                            __VLS_ctx.onEatFirstGenerateTrait(item.key);
                            // @ts-ignore
                            [canGenerateTrait, canGenerateTrait, canRevealTrait, onEatFirstGenerateTrait,];
                        } },
                    type: "button",
                    ...{ class: "tile-eat-first-card__action-btn tile-eat-first-card__action-btn--dice" },
                });
                /** @type {__VLS_StyleScopedClasses['tile-eat-first-card__action-btn']} */ ;
                /** @type {__VLS_StyleScopedClasses['tile-eat-first-card__action-btn--dice']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
                    xmlns: "http://www.w3.org/2000/svg",
                    viewBox: "0 0 24 24",
                    fill: "none",
                    stroke: "currentColor",
                    'stroke-width': "1.8",
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
                    x: "5",
                    y: "5",
                    width: "14",
                    height: "14",
                    rx: "2.4",
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
                    cx: "9",
                    cy: "9",
                    r: "1.1",
                    fill: "currentColor",
                    stroke: "none",
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
                    cx: "15",
                    cy: "15",
                    r: "1.1",
                    fill: "currentColor",
                    stroke: "none",
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
                    cx: "9",
                    cy: "15",
                    r: "1.1",
                    fill: "currentColor",
                    stroke: "none",
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
                    cx: "15",
                    cy: "9",
                    r: "1.1",
                    fill: "currentColor",
                    stroke: "none",
                });
            }
            if (__VLS_ctx.canRevealTrait()) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.hasEatFirstTraits))
                                return;
                            if (!(__VLS_ctx.canGenerateTrait() || __VLS_ctx.canRevealTrait()))
                                return;
                            if (!(__VLS_ctx.canRevealTrait()))
                                return;
                            __VLS_ctx.onEatFirstReveal(item.key, item.label);
                            // @ts-ignore
                            [canRevealTrait, onEatFirstReveal,];
                        } },
                    type: "button",
                    ...{ class: "tile-eat-first-card__eye-btn" },
                    'aria-label': (__VLS_ctx.eatFirstRevealEyeLabel(item.key)),
                });
                /** @type {__VLS_StyleScopedClasses['tile-eat-first-card__eye-btn']} */ ;
                if (__VLS_ctx.eatFirstTraitStateFor(item.key) === 'revealed') {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
                        xmlns: "http://www.w3.org/2000/svg",
                        viewBox: "0 0 24 24",
                        fill: "none",
                        stroke: "currentColor",
                        'stroke-width': "1.8",
                        'aria-hidden': "true",
                    });
                    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                        d: "M1.5 12s3.8-6.5 10.5-6.5S22.5 12 22.5 12s-3.8 6.5-10.5 6.5S1.5 12 1.5 12Z",
                    });
                    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
                        cx: "12",
                        cy: "12",
                        r: "3.2",
                    });
                }
                else {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
                        xmlns: "http://www.w3.org/2000/svg",
                        viewBox: "0 0 24 24",
                        fill: "none",
                        stroke: "currentColor",
                        'stroke-width': "1.8",
                        'aria-hidden': "true",
                    });
                    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                        d: "M3 3l18 18",
                        'stroke-linecap': "round",
                        'stroke-linejoin': "round",
                    });
                    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                        d: "M10.8 6.1A12.6 12.6 0 0 1 12 5.8c6.7 0 10.5 6.2 10.5 6.2a18 18 0 0 1-3.1 3.9",
                    });
                    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                        d: "M14.2 14.2a3.2 3.2 0 0 1-4.4-4.4",
                    });
                    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                        d: "M6.1 8.1A18.8 18.8 0 0 0 1.5 12s3.8 6.2 10.5 6.2a12.6 12.6 0 0 0 3.3-.4",
                    });
                }
            }
        }
        // @ts-ignore
        [eatFirstTraitStateFor, eatFirstRevealEyeLabel,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "tile-eat-first-overlay__columns" },
    });
    /** @type {__VLS_StyleScopedClasses['tile-eat-first-overlay__columns']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "tile-eat-first-overlay__column tile-eat-first-overlay__column--left" },
    });
    /** @type {__VLS_StyleScopedClasses['tile-eat-first-overlay__column']} */ ;
    /** @type {__VLS_StyleScopedClasses['tile-eat-first-overlay__column--left']} */ ;
    for (const [item] of __VLS_vFor((__VLS_ctx.eatFirstTraitsBySection.left))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (`eatf-left-${item.key}`),
            ...{ class: "tile-eat-first-card" },
            ...{ class: ({
                    'tile-eat-first-card--pending': __VLS_ctx.eatFirstTraitStateFor(item.key) === 'pending',
                    'tile-eat-first-card--revealed': __VLS_ctx.eatFirstTraitStateFor(item.key) === 'revealed',
                    'tile-eat-first-card--sealed': __VLS_ctx.eatFirstTraitCellSealed(item.key),
                    'tile-eat-first-card--insight': __VLS_ctx.eatFirstTraitInsightLayout(),
                }) },
        });
        /** @type {__VLS_StyleScopedClasses['tile-eat-first-card']} */ ;
        /** @type {__VLS_StyleScopedClasses['tile-eat-first-card--pending']} */ ;
        /** @type {__VLS_StyleScopedClasses['tile-eat-first-card--revealed']} */ ;
        /** @type {__VLS_StyleScopedClasses['tile-eat-first-card--sealed']} */ ;
        /** @type {__VLS_StyleScopedClasses['tile-eat-first-card--insight']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tile-eat-first-card__icon" },
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['tile-eat-first-card__icon']} */ ;
        if (item.key === 'profession') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
                xmlns: "http://www.w3.org/2000/svg",
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                'stroke-width': "1.8",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
                x: "3.5",
                y: "7",
                width: "17",
                height: "12",
                rx: "2.2",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                d: "M9 7V5.5h6V7M3.5 11.5h17",
                'stroke-linecap': "round",
                'stroke-linejoin': "round",
            });
        }
        else if (item.key === 'health') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
                xmlns: "http://www.w3.org/2000/svg",
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                'stroke-width': "1.8",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                d: "M3 12h3l2-3 3 7 2-4h3l2-3 3 3",
                'stroke-linecap': "round",
                'stroke-linejoin': "round",
            });
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
                xmlns: "http://www.w3.org/2000/svg",
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                'stroke-width': "1.8",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                d: "M6 9.5h12M7 9.5V8a2 2 0 1 1 4 0v1.5M13 9.5V8a2 2 0 1 1 4 0v1.5",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
                x: "4",
                y: "9.5",
                width: "16",
                height: "9.5",
                rx: "3",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                d: "M9.5 14h5",
                'stroke-linecap': "round",
            });
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tile-eat-first-card__main" },
        });
        /** @type {__VLS_StyleScopedClasses['tile-eat-first-card__main']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tile-eat-first-card__title" },
        });
        /** @type {__VLS_StyleScopedClasses['tile-eat-first-card__title']} */ ;
        (item.label.toUpperCase());
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tile-eat-first-card__value" },
            ...{ class: ({ 'tile-eat-first-card__value--peer-hidden': __VLS_ctx.eatFirstPeerShowsHiddenEyeMark(item.key) }) },
        });
        /** @type {__VLS_StyleScopedClasses['tile-eat-first-card__value']} */ ;
        /** @type {__VLS_StyleScopedClasses['tile-eat-first-card__value--peer-hidden']} */ ;
        if (__VLS_ctx.eatFirstPeerShowsHiddenEyeMark(item.key)) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "tile-eat-first-card__peer-hidden-eye" },
                'aria-hidden': "true",
            });
            /** @type {__VLS_StyleScopedClasses['tile-eat-first-card__peer-hidden-eye']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
                xmlns: "http://www.w3.org/2000/svg",
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                'stroke-width': "1.8",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                d: "M3 3l18 18",
                'stroke-linecap': "round",
                'stroke-linejoin': "round",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                d: "M10.8 6.1A12.6 12.6 0 0 1 12 5.8c6.7 0 10.5 6.2 10.5 6.2a18 18 0 0 1-3.1 3.9",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                d: "M14.2 14.2a3.2 3.2 0 0 1-4.4-4.4",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                d: "M6.1 8.1A18.8 18.8 0 0 0 1.5 12s3.8 6.2 10.5 6.2a12.6 12.6 0 0 0 3.3-.4",
            });
        }
        else {
            for (const [line, eatFirstLineIdx] of __VLS_vFor((__VLS_ctx.eatFirstValueDisplayLines(item.key, item.value)))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    key: (`eatf-left-val-${item.key}-${eatFirstLineIdx}`),
                    ...{ class: "tile-eat-first-card__value-line" },
                });
                /** @type {__VLS_StyleScopedClasses['tile-eat-first-card__value-line']} */ ;
                (line);
                // @ts-ignore
                [eatFirstTraitInsightLayout, eatFirstTraitsBySection, eatFirstTraitStateFor, eatFirstTraitStateFor, eatFirstTraitCellSealed, eatFirstPeerShowsHiddenEyeMark, eatFirstPeerShowsHiddenEyeMark, eatFirstValueDisplayLines,];
            }
        }
        if (__VLS_ctx.canGenerateTrait() || __VLS_ctx.canRevealTrait()) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "tile-eat-first-card__actions" },
            });
            /** @type {__VLS_StyleScopedClasses['tile-eat-first-card__actions']} */ ;
            if (__VLS_ctx.canGenerateTrait()) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.hasEatFirstTraits))
                                return;
                            if (!(__VLS_ctx.canGenerateTrait() || __VLS_ctx.canRevealTrait()))
                                return;
                            if (!(__VLS_ctx.canGenerateTrait()))
                                return;
                            __VLS_ctx.onEatFirstGenerateTrait(item.key);
                            // @ts-ignore
                            [canGenerateTrait, canGenerateTrait, canRevealTrait, onEatFirstGenerateTrait,];
                        } },
                    type: "button",
                    ...{ class: "tile-eat-first-card__action-btn tile-eat-first-card__action-btn--dice" },
                });
                /** @type {__VLS_StyleScopedClasses['tile-eat-first-card__action-btn']} */ ;
                /** @type {__VLS_StyleScopedClasses['tile-eat-first-card__action-btn--dice']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
                    xmlns: "http://www.w3.org/2000/svg",
                    viewBox: "0 0 24 24",
                    fill: "none",
                    stroke: "currentColor",
                    'stroke-width': "1.8",
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
                    x: "5",
                    y: "5",
                    width: "14",
                    height: "14",
                    rx: "2.4",
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
                    cx: "9",
                    cy: "9",
                    r: "1.1",
                    fill: "currentColor",
                    stroke: "none",
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
                    cx: "15",
                    cy: "15",
                    r: "1.1",
                    fill: "currentColor",
                    stroke: "none",
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
                    cx: "9",
                    cy: "15",
                    r: "1.1",
                    fill: "currentColor",
                    stroke: "none",
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
                    cx: "15",
                    cy: "9",
                    r: "1.1",
                    fill: "currentColor",
                    stroke: "none",
                });
            }
            if (__VLS_ctx.canRevealTrait()) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.hasEatFirstTraits))
                                return;
                            if (!(__VLS_ctx.canGenerateTrait() || __VLS_ctx.canRevealTrait()))
                                return;
                            if (!(__VLS_ctx.canRevealTrait()))
                                return;
                            __VLS_ctx.onEatFirstReveal(item.key, item.label);
                            // @ts-ignore
                            [canRevealTrait, onEatFirstReveal,];
                        } },
                    type: "button",
                    ...{ class: "tile-eat-first-card__eye-btn" },
                    'aria-label': (__VLS_ctx.eatFirstRevealEyeLabel(item.key)),
                });
                /** @type {__VLS_StyleScopedClasses['tile-eat-first-card__eye-btn']} */ ;
                if (__VLS_ctx.eatFirstTraitStateFor(item.key) === 'revealed') {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
                        xmlns: "http://www.w3.org/2000/svg",
                        viewBox: "0 0 24 24",
                        fill: "none",
                        stroke: "currentColor",
                        'stroke-width': "1.8",
                        'aria-hidden': "true",
                    });
                    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                        d: "M1.5 12s3.8-6.5 10.5-6.5S22.5 12 22.5 12s-3.8 6.5-10.5 6.5S1.5 12 1.5 12Z",
                    });
                    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
                        cx: "12",
                        cy: "12",
                        r: "3.2",
                    });
                }
                else {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
                        xmlns: "http://www.w3.org/2000/svg",
                        viewBox: "0 0 24 24",
                        fill: "none",
                        stroke: "currentColor",
                        'stroke-width': "1.8",
                        'aria-hidden': "true",
                    });
                    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                        d: "M3 3l18 18",
                        'stroke-linecap': "round",
                        'stroke-linejoin': "round",
                    });
                    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                        d: "M10.8 6.1A12.6 12.6 0 0 1 12 5.8c6.7 0 10.5 6.2 10.5 6.2a18 18 0 0 1-3.1 3.9",
                    });
                    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                        d: "M14.2 14.2a3.2 3.2 0 0 1-4.4-4.4",
                    });
                    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                        d: "M6.1 8.1A18.8 18.8 0 0 0 1.5 12s3.8 6.2 10.5 6.2a12.6 12.6 0 0 0 3.3-.4",
                    });
                }
            }
        }
        // @ts-ignore
        [eatFirstTraitStateFor, eatFirstRevealEyeLabel,];
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "tile-eat-first-overlay__column tile-eat-first-overlay__column--right" },
    });
    /** @type {__VLS_StyleScopedClasses['tile-eat-first-overlay__column']} */ ;
    /** @type {__VLS_StyleScopedClasses['tile-eat-first-overlay__column--right']} */ ;
    for (const [item] of __VLS_vFor((__VLS_ctx.eatFirstTraitsBySection.right))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            key: (`eatf-right-${item.key}`),
            ...{ class: "tile-eat-first-card" },
            ...{ class: ({
                    'tile-eat-first-card--pending': __VLS_ctx.eatFirstTraitStateFor(item.key) === 'pending',
                    'tile-eat-first-card--revealed': __VLS_ctx.eatFirstTraitStateFor(item.key) === 'revealed',
                    'tile-eat-first-card--sealed': __VLS_ctx.eatFirstTraitCellSealed(item.key),
                    'tile-eat-first-card--insight': __VLS_ctx.eatFirstTraitInsightLayout(),
                }) },
        });
        /** @type {__VLS_StyleScopedClasses['tile-eat-first-card']} */ ;
        /** @type {__VLS_StyleScopedClasses['tile-eat-first-card--pending']} */ ;
        /** @type {__VLS_StyleScopedClasses['tile-eat-first-card--revealed']} */ ;
        /** @type {__VLS_StyleScopedClasses['tile-eat-first-card--sealed']} */ ;
        /** @type {__VLS_StyleScopedClasses['tile-eat-first-card--insight']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tile-eat-first-card__icon" },
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['tile-eat-first-card__icon']} */ ;
        if (item.key === 'phobia') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
                xmlns: "http://www.w3.org/2000/svg",
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                'stroke-width': "1.8",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
                cx: "12",
                cy: "12",
                r: "2.3",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                d: "M12 4v3M12 17v3M4 12h3M17 12h3M6.2 6.2l2.1 2.1M15.7 15.7l2.1 2.1M17.8 6.2l-2.1 2.1M8.3 15.7l-2.1 2.1",
            });
        }
        else if (item.key === 'fact') {
            __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
                xmlns: "http://www.w3.org/2000/svg",
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                'stroke-width': "1.8",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                d: "M12 3l1.9 4.1L18 9l-4.1 1.9L12 15l-1.9-4.1L6 9l4.1-1.9Z",
            });
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
                xmlns: "http://www.w3.org/2000/svg",
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                'stroke-width': "1.8",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
                x: "5",
                y: "8",
                width: "14",
                height: "11",
                rx: "2.2",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                d: "M9 8V6h6v2M12 11.5v4M10 13.5h4",
                'stroke-linecap': "round",
                'stroke-linejoin': "round",
            });
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tile-eat-first-card__main" },
        });
        /** @type {__VLS_StyleScopedClasses['tile-eat-first-card__main']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tile-eat-first-card__title" },
        });
        /** @type {__VLS_StyleScopedClasses['tile-eat-first-card__title']} */ ;
        (item.label.toUpperCase());
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tile-eat-first-card__value" },
            ...{ class: ({ 'tile-eat-first-card__value--peer-hidden': __VLS_ctx.eatFirstPeerShowsHiddenEyeMark(item.key) }) },
        });
        /** @type {__VLS_StyleScopedClasses['tile-eat-first-card__value']} */ ;
        /** @type {__VLS_StyleScopedClasses['tile-eat-first-card__value--peer-hidden']} */ ;
        if (__VLS_ctx.eatFirstPeerShowsHiddenEyeMark(item.key)) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "tile-eat-first-card__peer-hidden-eye" },
                'aria-hidden': "true",
            });
            /** @type {__VLS_StyleScopedClasses['tile-eat-first-card__peer-hidden-eye']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
                xmlns: "http://www.w3.org/2000/svg",
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                'stroke-width': "1.8",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                d: "M3 3l18 18",
                'stroke-linecap': "round",
                'stroke-linejoin': "round",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                d: "M10.8 6.1A12.6 12.6 0 0 1 12 5.8c6.7 0 10.5 6.2 10.5 6.2a18 18 0 0 1-3.1 3.9",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                d: "M14.2 14.2a3.2 3.2 0 0 1-4.4-4.4",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                d: "M6.1 8.1A18.8 18.8 0 0 0 1.5 12s3.8 6.2 10.5 6.2a12.6 12.6 0 0 0 3.3-.4",
            });
        }
        else {
            for (const [line, eatFirstLineIdx] of __VLS_vFor((__VLS_ctx.eatFirstValueDisplayLines(item.key, item.value)))) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    key: (`eatf-right-val-${item.key}-${eatFirstLineIdx}`),
                    ...{ class: "tile-eat-first-card__value-line" },
                });
                /** @type {__VLS_StyleScopedClasses['tile-eat-first-card__value-line']} */ ;
                (line);
                // @ts-ignore
                [eatFirstTraitInsightLayout, eatFirstTraitsBySection, eatFirstTraitStateFor, eatFirstTraitStateFor, eatFirstTraitCellSealed, eatFirstPeerShowsHiddenEyeMark, eatFirstPeerShowsHiddenEyeMark, eatFirstValueDisplayLines,];
            }
        }
        if (__VLS_ctx.canGenerateTrait() || __VLS_ctx.canRevealTrait()) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "tile-eat-first-card__actions" },
            });
            /** @type {__VLS_StyleScopedClasses['tile-eat-first-card__actions']} */ ;
            if (__VLS_ctx.canGenerateTrait()) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.hasEatFirstTraits))
                                return;
                            if (!(__VLS_ctx.canGenerateTrait() || __VLS_ctx.canRevealTrait()))
                                return;
                            if (!(__VLS_ctx.canGenerateTrait()))
                                return;
                            __VLS_ctx.onEatFirstGenerateTrait(item.key);
                            // @ts-ignore
                            [canGenerateTrait, canGenerateTrait, canRevealTrait, onEatFirstGenerateTrait,];
                        } },
                    type: "button",
                    ...{ class: "tile-eat-first-card__action-btn tile-eat-first-card__action-btn--dice" },
                });
                /** @type {__VLS_StyleScopedClasses['tile-eat-first-card__action-btn']} */ ;
                /** @type {__VLS_StyleScopedClasses['tile-eat-first-card__action-btn--dice']} */ ;
                __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
                    xmlns: "http://www.w3.org/2000/svg",
                    viewBox: "0 0 24 24",
                    fill: "none",
                    stroke: "currentColor",
                    'stroke-width': "1.8",
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
                    x: "5",
                    y: "5",
                    width: "14",
                    height: "14",
                    rx: "2.4",
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
                    cx: "9",
                    cy: "9",
                    r: "1.1",
                    fill: "currentColor",
                    stroke: "none",
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
                    cx: "15",
                    cy: "15",
                    r: "1.1",
                    fill: "currentColor",
                    stroke: "none",
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
                    cx: "9",
                    cy: "15",
                    r: "1.1",
                    fill: "currentColor",
                    stroke: "none",
                });
                __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
                    cx: "15",
                    cy: "9",
                    r: "1.1",
                    fill: "currentColor",
                    stroke: "none",
                });
            }
            if (__VLS_ctx.canRevealTrait()) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                    ...{ onClick: (...[$event]) => {
                            if (!(__VLS_ctx.hasEatFirstTraits))
                                return;
                            if (!(__VLS_ctx.canGenerateTrait() || __VLS_ctx.canRevealTrait()))
                                return;
                            if (!(__VLS_ctx.canRevealTrait()))
                                return;
                            __VLS_ctx.onEatFirstReveal(item.key, item.label);
                            // @ts-ignore
                            [canRevealTrait, onEatFirstReveal,];
                        } },
                    type: "button",
                    ...{ class: "tile-eat-first-card__eye-btn" },
                    'aria-label': (__VLS_ctx.eatFirstRevealEyeLabel(item.key)),
                });
                /** @type {__VLS_StyleScopedClasses['tile-eat-first-card__eye-btn']} */ ;
                if (__VLS_ctx.eatFirstTraitStateFor(item.key) === 'revealed') {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
                        xmlns: "http://www.w3.org/2000/svg",
                        viewBox: "0 0 24 24",
                        fill: "none",
                        stroke: "currentColor",
                        'stroke-width': "1.8",
                        'aria-hidden': "true",
                    });
                    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                        d: "M1.5 12s3.8-6.5 10.5-6.5S22.5 12 22.5 12s-3.8 6.5-10.5 6.5S1.5 12 1.5 12Z",
                    });
                    __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
                        cx: "12",
                        cy: "12",
                        r: "3.2",
                    });
                }
                else {
                    __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
                        xmlns: "http://www.w3.org/2000/svg",
                        viewBox: "0 0 24 24",
                        fill: "none",
                        stroke: "currentColor",
                        'stroke-width': "1.8",
                        'aria-hidden': "true",
                    });
                    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                        d: "M3 3l18 18",
                        'stroke-linecap': "round",
                        'stroke-linejoin': "round",
                    });
                    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                        d: "M10.8 6.1A12.6 12.6 0 0 1 12 5.8c6.7 0 10.5 6.2 10.5 6.2a18 18 0 0 1-3.1 3.9",
                    });
                    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                        d: "M14.2 14.2a3.2 3.2 0 0 1-4.4-4.4",
                    });
                    __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                        d: "M6.1 8.1A18.8 18.8 0 0 0 1.5 12s3.8 6.2 10.5 6.2a12.6 12.6 0 0 0 3.3-.4",
                    });
                }
            }
        }
        // @ts-ignore
        [eatFirstTraitStateFor, eatFirstRevealEyeLabel,];
    }
    if (__VLS_ctx.eatFirstActionCard != null && __VLS_ctx.eatFirstActionCard.title.length > 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "tile-eat-first-action-card" },
            ...{ class: ({
                    'tile-eat-first-action-card--used-host': __VLS_ctx.isEatFirstTraitHostView() && __VLS_ctx.eatFirstActionCard.used === true,
                }) },
            role: "group",
            'aria-label': "Активна карта гравця",
        });
        /** @type {__VLS_StyleScopedClasses['tile-eat-first-action-card']} */ ;
        /** @type {__VLS_StyleScopedClasses['tile-eat-first-action-card--used-host']} */ ;
        if (__VLS_ctx.isEatFirstTraitOwnerView() && !__VLS_ctx.isEatFirstTraitHostView()) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.onEatFirstPlayerUseActionCard) },
                type: "button",
                ...{ class: "tile-eat-first-action-card__use-btn" },
                disabled: (__VLS_ctx.eatFirstActionCard.used === true),
                'aria-label': (__VLS_ctx.eatFirstActionCard.used === true
                    ? __VLS_ctx.t('eatFirstCall.actionCardAlreadyUsedAria')
                    : __VLS_ctx.t('eatFirstCall.useActionCardAria')),
            });
            /** @type {__VLS_StyleScopedClasses['tile-eat-first-action-card__use-btn']} */ ;
            (__VLS_ctx.eatFirstActionCard.title);
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "tile-eat-first-action-card__title" },
            });
            /** @type {__VLS_StyleScopedClasses['tile-eat-first-action-card__title']} */ ;
            (__VLS_ctx.eatFirstActionCard.title);
        }
        if (__VLS_ctx.isEatFirstTraitHostView()) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
                ...{ onClick: (__VLS_ctx.onEatFirstRerollActionCard) },
                type: "button",
                ...{ class: "tile-eat-first-action-card__btn" },
                title: ('Перекинути активну карту'),
                'aria-label': ('Перекинути активну карту'),
            });
            /** @type {__VLS_StyleScopedClasses['tile-eat-first-action-card__btn']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
                viewBox: "0 0 24 24",
                width: "14",
                height: "14",
                fill: "none",
                'aria-hidden': "true",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.rect)({
                x: "4",
                y: "4",
                width: "16",
                height: "16",
                rx: "3",
                stroke: "currentColor",
                'stroke-width': "1.8",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
                cx: "9",
                cy: "9",
                r: "1.3",
                fill: "currentColor",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
                cx: "15",
                cy: "9",
                r: "1.3",
                fill: "currentColor",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
                cx: "12",
                cy: "12",
                r: "1.3",
                fill: "currentColor",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
                cx: "9",
                cy: "15",
                r: "1.3",
                fill: "currentColor",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.circle)({
                cx: "15",
                cy: "15",
                r: "1.3",
                fill: "currentColor",
            });
        }
    }
    if (__VLS_ctx.eatFirstToastVisible) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "tile-eat-first-toast" },
            role: "status",
            'aria-live': "polite",
        });
        /** @type {__VLS_StyleScopedClasses['tile-eat-first-toast']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "tile-eat-first-toast__line" },
        });
        /** @type {__VLS_StyleScopedClasses['tile-eat-first-toast__line']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tile-eat-first-toast__accent" },
        });
        /** @type {__VLS_StyleScopedClasses['tile-eat-first-toast__accent']} */ ;
        (__VLS_ctx.eatFirstToastLabel);
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "tile-eat-first-toast__line" },
        });
        /** @type {__VLS_StyleScopedClasses['tile-eat-first-toast__line']} */ ;
    }
}
if (!__VLS_ctx.isLocal && __VLS_ctx.audioSplitStream) {
    const __VLS_0 = StreamAudio;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        ...{ 'onAudioStall': {} },
        ...{ class: "tile-audio" },
        stream: (__VLS_ctx.audioSplitStream),
        playRev: (__VLS_ctx.playRev),
        listenVolume: (__VLS_ctx.remoteListenVolume ?? 1),
        listenMuted: (__VLS_ctx.remoteListenMuted ?? false),
        peerId: (__VLS_ctx.peerId),
        audioEnabled: (__VLS_ctx.audioEnabled),
    }));
    const __VLS_2 = __VLS_1({
        ...{ 'onAudioStall': {} },
        ...{ class: "tile-audio" },
        stream: (__VLS_ctx.audioSplitStream),
        playRev: (__VLS_ctx.playRev),
        listenVolume: (__VLS_ctx.remoteListenVolume ?? 1),
        listenMuted: (__VLS_ctx.remoteListenMuted ?? false),
        peerId: (__VLS_ctx.peerId),
        audioEnabled: (__VLS_ctx.audioEnabled),
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    let __VLS_5;
    const __VLS_6 = ({ audioStall: {} },
        { onAudioStall: ((p) => __VLS_ctx.emit('audio-stall', p)) });
    __VLS_asFunctionalDirective(__VLS_directives.vMemo, {})(null, { ...__VLS_directiveBindingRestFields, value: ([
            __VLS_ctx.audioSplitStream,
            __VLS_ctx.playRev ?? 0,
            __VLS_ctx.remoteListenVolume ?? 1,
            __VLS_ctx.remoteListenMuted ?? false,
        ]) }, null, null);
    /** @type {__VLS_StyleScopedClasses['tile-audio']} */ ;
    var __VLS_3;
    var __VLS_4;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "tile-video-wrap" },
    ...{ class: ({ 'tile-video-wrap--mafia-dead': __VLS_ctx.deadShade }) },
});
__VLS_asFunctionalDirective(__VLS_directives.vShow, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.showVideo) }, null, null);
/** @type {__VLS_StyleScopedClasses['tile-video-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['tile-video-wrap--mafia-dead']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "tile-video-clip" },
});
__VLS_asFunctionalDirective(__VLS_directives.vMemo, {})(null, { ...__VLS_directiveBindingRestFields, value: (__VLS_ctx.streamVideoMemoDeps) }, null, null);
/** @type {__VLS_StyleScopedClasses['tile-video-clip']} */ ;
const __VLS_7 = StreamVideo;
// @ts-ignore
const __VLS_8 = __VLS_asFunctionalComponent1(__VLS_7, new __VLS_7({
    ...{ 'onRemotePlaybackStall': {} },
    ...{ 'onVideoStall': {} },
    key: (__VLS_ctx.streamVideoStableKey),
    stream: (__VLS_ctx.stream),
    muted: true,
    playRev: (__VLS_ctx.playRev),
    reportVideoUi: (false),
    remotePlaybackStallPeerId: (__VLS_ctx.remotePlaybackStallPeerIdForVideo),
    peerId: (__VLS_ctx.remotePlaybackStallPeerIdForVideo),
    videoPresentation: (__VLS_ctx.videoPresentation && __VLS_ctx.videoPresentation !== 'none' ? __VLS_ctx.videoPresentation : undefined),
    fill: true,
    fillCover: (Boolean(__VLS_ctx.videoFillCover)),
    playbackSuppressed: (!__VLS_ctx.showVideo || Boolean(__VLS_ctx.videoPlaybackSuppressed)),
    targetPlaybackFps: (__VLS_ctx.videoTargetPlaybackFps),
}));
const __VLS_9 = __VLS_8({
    ...{ 'onRemotePlaybackStall': {} },
    ...{ 'onVideoStall': {} },
    key: (__VLS_ctx.streamVideoStableKey),
    stream: (__VLS_ctx.stream),
    muted: true,
    playRev: (__VLS_ctx.playRev),
    reportVideoUi: (false),
    remotePlaybackStallPeerId: (__VLS_ctx.remotePlaybackStallPeerIdForVideo),
    peerId: (__VLS_ctx.remotePlaybackStallPeerIdForVideo),
    videoPresentation: (__VLS_ctx.videoPresentation && __VLS_ctx.videoPresentation !== 'none' ? __VLS_ctx.videoPresentation : undefined),
    fill: true,
    fillCover: (Boolean(__VLS_ctx.videoFillCover)),
    playbackSuppressed: (!__VLS_ctx.showVideo || Boolean(__VLS_ctx.videoPlaybackSuppressed)),
    targetPlaybackFps: (__VLS_ctx.videoTargetPlaybackFps),
}, ...__VLS_functionalComponentArgsRest(__VLS_8));
let __VLS_12;
const __VLS_13 = ({ remotePlaybackStall: {} },
    { onRemotePlaybackStall: ((p) => __VLS_ctx.emit('remote-playback-stall', p)) });
const __VLS_14 = ({ videoStall: {} },
    { onVideoStall: ((p) => __VLS_ctx.emit('video-stall', p)) });
var __VLS_10;
var __VLS_11;
if (__VLS_ctx.deadShade) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div)({
        ...{ class: "tile-dead-veneer" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['tile-dead-veneer']} */ ;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "tile-overlay" },
    'aria-hidden': "false",
});
/** @type {__VLS_StyleScopedClasses['tile-overlay']} */ ;
if (!__VLS_ctx.editingName) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onDblclick: (__VLS_ctx.startNameEdit) },
        ...{ class: "tile-overlay__label-group" },
        ...{ class: ({ 'tile-overlay__label-group--editable': !__VLS_ctx.streamViewMode }) },
        title: (__VLS_ctx.streamViewMode ? undefined : __VLS_ctx.t('callPage.renameLocalHint')),
    });
    /** @type {__VLS_StyleScopedClasses['tile-overlay__label-group']} */ ;
    /** @type {__VLS_StyleScopedClasses['tile-overlay__label-group--editable']} */ ;
    if (__VLS_ctx.showSeatBadge) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tile-overlay__seat-badge" },
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['tile-overlay__seat-badge']} */ ;
        (__VLS_ctx.resolvedSeatIndex);
    }
    if (__VLS_ctx.showRoleBadge) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tile-overlay__role-badge" },
            title: (__VLS_ctx.roleBadgeLabel),
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['tile-overlay__role-badge']} */ ;
        (__VLS_ctx.roleBadgeLabel);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "tile-overlay__identity" },
    });
    /** @type {__VLS_StyleScopedClasses['tile-overlay__identity']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "tile-overlay__display-name" },
        ...{ class: ({ 'tile-overlay__display-name--editable': !__VLS_ctx.streamViewMode }) },
    });
    /** @type {__VLS_StyleScopedClasses['tile-overlay__display-name']} */ ;
    /** @type {__VLS_StyleScopedClasses['tile-overlay__display-name--editable']} */ ;
    (__VLS_ctx.tilePrimaryLine);
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "tile-overlay__name-edit" },
    });
    /** @type {__VLS_StyleScopedClasses['tile-overlay__name-edit']} */ ;
    if (__VLS_ctx.showSeatBadge) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tile-overlay__seat-badge" },
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['tile-overlay__seat-badge']} */ ;
        (__VLS_ctx.resolvedSeatIndex);
    }
    if (__VLS_ctx.showRoleBadge) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tile-overlay__role-badge" },
            title: (__VLS_ctx.roleBadgeLabel),
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['tile-overlay__role-badge']} */ ;
        (__VLS_ctx.roleBadgeLabel);
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onBlur: (__VLS_ctx.finishNameEdit) },
        ...{ onKeydown: (__VLS_ctx.onNameInputEnter) },
        ...{ onKeydown: (__VLS_ctx.cancelNameEdit) },
        ref: "nameInputRef",
        value: (__VLS_ctx.nameDraft),
        ...{ class: "tile-overlay__name-input" },
        type: "text",
        maxlength: "64",
        'aria-label': (__VLS_ctx.t('callPage.editNameAria')),
    });
    /** @type {__VLS_StyleScopedClasses['tile-overlay__name-input']} */ ;
}
if (!__VLS_ctx.streamViewMode) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "tile-overlay__icons" },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['tile-overlay__icons']} */ ;
    if (__VLS_ctx.raiseHand) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tile-overlay__hand" },
            title: (__VLS_ctx.t('callPage.raiseHandBadge')),
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['tile-overlay__hand']} */ ;
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "tile-overlay__mic" },
        ...{ class: ({ 'tile-overlay__mic--off': !__VLS_ctx.audioEnabled }) },
    });
    /** @type {__VLS_StyleScopedClasses['tile-overlay__mic']} */ ;
    /** @type {__VLS_StyleScopedClasses['tile-overlay__mic--off']} */ ;
    if (__VLS_ctx.audioEnabled) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
            xmlns: "http://www.w3.org/2000/svg",
            fill: "none",
            viewBox: "0 0 24 24",
            'stroke-width': "2",
            stroke: "currentColor",
            width: "15",
            height: "15",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
            'stroke-linecap': "round",
            'stroke-linejoin': "round",
            d: "M12 3c-1.66 0-3 1.2-3 2.7v4.6c0 1.5 1.34 2.7 3 2.7s3-1.2 3-2.7V5.7C15 4.2 13.66 3 12 3Z",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
            'stroke-linecap': "round",
            'stroke-linejoin': "round",
            d: "M19 10v1a7 7 0 0 1-14 0v-1M12 18v3",
        });
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
            xmlns: "http://www.w3.org/2000/svg",
            fill: "none",
            viewBox: "0 0 24 24",
            'stroke-width': "2",
            stroke: "currentColor",
            'stroke-linecap': "round",
            'stroke-linejoin': "round",
            width: "15",
            height: "15",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
            d: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
            d: "M19 10v1a7 7 0 0 1-14 0v-1",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
            d: "M12 19v3",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
            d: "M3 3l18 18",
        });
    }
}
if (!__VLS_ctx.showVideo) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "tile-placeholder" },
    });
    /** @type {__VLS_StyleScopedClasses['tile-placeholder']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "tile-placeholder__main" },
    });
    /** @type {__VLS_StyleScopedClasses['tile-placeholder__main']} */ ;
    if (__VLS_ctx.showEliminationMark) {
        const __VLS_15 = GameEliminationMark;
        // @ts-ignore
        const __VLS_16 = __VLS_asFunctionalComponent1(__VLS_15, new __VLS_15({
            ...{ class: "tile-placeholder-elimination" },
            kind: (__VLS_ctx.resolvedEliminationKind),
            iconSrc: (__VLS_ctx.resolvedEliminationIconSrc),
        }));
        const __VLS_17 = __VLS_16({
            ...{ class: "tile-placeholder-elimination" },
            kind: (__VLS_ctx.resolvedEliminationKind),
            iconSrc: (__VLS_ctx.resolvedEliminationIconSrc),
        }, ...__VLS_functionalComponentArgsRest(__VLS_16));
        /** @type {__VLS_StyleScopedClasses['tile-placeholder-elimination']} */ ;
    }
    else if (__VLS_ctx.showAvatar) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
            ...{ class: "tile-placeholder-avatar tile-placeholder-avatar--img" },
            src: (__VLS_ctx.resolvedAvatarUrl),
            alt: "",
            decoding: "async",
            loading: "lazy",
        });
        /** @type {__VLS_StyleScopedClasses['tile-placeholder-avatar']} */ ;
        /** @type {__VLS_StyleScopedClasses['tile-placeholder-avatar--img']} */ ;
    }
    else if (__VLS_ctx.showInitialsFallback) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tile-placeholder-avatar" },
        });
        /** @type {__VLS_StyleScopedClasses['tile-placeholder-avatar']} */ ;
        (__VLS_ctx.initials(typeof __VLS_ctx.avatarFallbackName === 'string' && __VLS_ctx.avatarFallbackName.trim().length > 0 ? __VLS_ctx.avatarFallbackName : __VLS_ctx.displayName));
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "tile-overlay tile-overlay--on-placeholder" },
        'aria-hidden': "false",
    });
    /** @type {__VLS_StyleScopedClasses['tile-overlay']} */ ;
    /** @type {__VLS_StyleScopedClasses['tile-overlay--on-placeholder']} */ ;
    if (!__VLS_ctx.editingName) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ onDblclick: (__VLS_ctx.startNameEdit) },
            ...{ class: "tile-overlay__label-group" },
            ...{ class: ({ 'tile-overlay__label-group--editable': !__VLS_ctx.streamViewMode }) },
            title: (__VLS_ctx.streamViewMode ? undefined : __VLS_ctx.t('callPage.renameLocalHint')),
        });
        /** @type {__VLS_StyleScopedClasses['tile-overlay__label-group']} */ ;
        /** @type {__VLS_StyleScopedClasses['tile-overlay__label-group--editable']} */ ;
        if (__VLS_ctx.showSeatBadge) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "tile-overlay__seat-badge" },
                'aria-hidden': "true",
            });
            /** @type {__VLS_StyleScopedClasses['tile-overlay__seat-badge']} */ ;
            (__VLS_ctx.resolvedSeatIndex);
        }
        if (__VLS_ctx.showRoleBadge) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "tile-overlay__role-badge" },
                title: (__VLS_ctx.roleBadgeLabel),
                'aria-hidden': "true",
            });
            /** @type {__VLS_StyleScopedClasses['tile-overlay__role-badge']} */ ;
            (__VLS_ctx.roleBadgeLabel);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tile-overlay__identity" },
        });
        /** @type {__VLS_StyleScopedClasses['tile-overlay__identity']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tile-overlay__display-name" },
            ...{ class: ({ 'tile-overlay__display-name--editable': !__VLS_ctx.streamViewMode }) },
        });
        /** @type {__VLS_StyleScopedClasses['tile-overlay__display-name']} */ ;
        /** @type {__VLS_StyleScopedClasses['tile-overlay__display-name--editable']} */ ;
        (__VLS_ctx.tilePrimaryLine);
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "tile-overlay__name-edit" },
        });
        /** @type {__VLS_StyleScopedClasses['tile-overlay__name-edit']} */ ;
        if (__VLS_ctx.showSeatBadge) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "tile-overlay__seat-badge" },
                'aria-hidden': "true",
            });
            /** @type {__VLS_StyleScopedClasses['tile-overlay__seat-badge']} */ ;
            (__VLS_ctx.resolvedSeatIndex);
        }
        if (__VLS_ctx.showRoleBadge) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "tile-overlay__role-badge" },
                title: (__VLS_ctx.roleBadgeLabel),
                'aria-hidden': "true",
            });
            /** @type {__VLS_StyleScopedClasses['tile-overlay__role-badge']} */ ;
            (__VLS_ctx.roleBadgeLabel);
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
            ...{ onBlur: (__VLS_ctx.finishNameEdit) },
            ...{ onKeydown: (__VLS_ctx.onNameInputEnter) },
            ...{ onKeydown: (__VLS_ctx.cancelNameEdit) },
            ref: "nameInputRef",
            value: (__VLS_ctx.nameDraft),
            ...{ class: "tile-overlay__name-input" },
            type: "text",
            maxlength: "64",
            'aria-label': (__VLS_ctx.t('callPage.editNameAria')),
        });
        /** @type {__VLS_StyleScopedClasses['tile-overlay__name-input']} */ ;
    }
    if (!__VLS_ctx.streamViewMode) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tile-overlay__icons" },
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['tile-overlay__icons']} */ ;
        if (__VLS_ctx.raiseHand) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "tile-overlay__hand" },
                title: (__VLS_ctx.t('callPage.raiseHandBadge')),
                'aria-hidden': "true",
            });
            /** @type {__VLS_StyleScopedClasses['tile-overlay__hand']} */ ;
        }
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tile-overlay__mic" },
            ...{ class: ({ 'tile-overlay__mic--off': !__VLS_ctx.audioEnabled }) },
        });
        /** @type {__VLS_StyleScopedClasses['tile-overlay__mic']} */ ;
        /** @type {__VLS_StyleScopedClasses['tile-overlay__mic--off']} */ ;
        if (__VLS_ctx.audioEnabled) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
                xmlns: "http://www.w3.org/2000/svg",
                fill: "none",
                viewBox: "0 0 24 24",
                'stroke-width': "2",
                stroke: "currentColor",
                width: "15",
                height: "15",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                'stroke-linecap': "round",
                'stroke-linejoin': "round",
                d: "M12 3c-1.66 0-3 1.2-3 2.7v4.6c0 1.5 1.34 2.7 3 2.7s3-1.2 3-2.7V5.7C15 4.2 13.66 3 12 3Z",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                'stroke-linecap': "round",
                'stroke-linejoin': "round",
                d: "M19 10v1a7 7 0 0 1-14 0v-1M12 18v3",
            });
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
                xmlns: "http://www.w3.org/2000/svg",
                fill: "none",
                viewBox: "0 0 24 24",
                'stroke-width': "2",
                stroke: "currentColor",
                'stroke-linecap': "round",
                'stroke-linejoin': "round",
                width: "15",
                height: "15",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                d: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                d: "M19 10v1a7 7 0 0 1-14 0v-1",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                d: "M12 19v3",
            });
            __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
                d: "M3 3l18 18",
            });
        }
    }
}
if (!__VLS_ctx.isLocal && !__VLS_ctx.streamViewMode) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "tile-menu-cluster" },
    });
    /** @type {__VLS_StyleScopedClasses['tile-menu-cluster']} */ ;
    if (__VLS_ctx.resolvedHostShowLifeToggle) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (__VLS_ctx.onHostLifeClick) },
            type: "button",
            ...{ class: "tile-menu__life" },
            ...{ class: ({ 'tile-menu__life--revive': __VLS_ctx.isDead }) },
            'data-no-mafia-tile-host': true,
            'data-no-game-room-tile-host': true,
            title: (__VLS_ctx.hostLifeToggleTitle),
            'aria-label': (__VLS_ctx.hostLifeToggleTitle),
        });
        /** @type {__VLS_StyleScopedClasses['tile-menu__life']} */ ;
        /** @type {__VLS_StyleScopedClasses['tile-menu__life--revive']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tile-menu__life-ico" },
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['tile-menu__life-ico']} */ ;
        (__VLS_ctx.isDead ? '👤' : '💀');
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "tile-remote-volume tile-menu-hoverable tile-menu-hoverable--remote" },
    });
    /** @type {__VLS_StyleScopedClasses['tile-remote-volume']} */ ;
    /** @type {__VLS_StyleScopedClasses['tile-menu-hoverable']} */ ;
    /** @type {__VLS_StyleScopedClasses['tile-menu-hoverable--remote']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "tile-menu tile-menu--remote" },
    });
    /** @type {__VLS_StyleScopedClasses['tile-menu']} */ ;
    /** @type {__VLS_StyleScopedClasses['tile-menu--remote']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
        ...{ onClick: (__VLS_ctx.onLocalListenIconClick) },
        type: "button",
        ...{ class: "tile-remote-volume__trigger" },
        draggable: "false",
        'aria-label': (__VLS_ctx.localListenIconAria),
        'aria-pressed': (__VLS_ctx.localListenSilenced),
    });
    /** @type {__VLS_StyleScopedClasses['tile-remote-volume__trigger']} */ ;
    if (!__VLS_ctx.localListenSilenced) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
            ...{ class: "tile-remote-volume__ico" },
            xmlns: "http://www.w3.org/2000/svg",
            fill: "none",
            viewBox: "0 0 24 24",
            stroke: "currentColor",
            'stroke-width': "2",
            'stroke-linecap': "round",
            'stroke-linejoin': "round",
            width: "18",
            height: "18",
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['tile-remote-volume__ico']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
            d: "M11 5 6 9H2v6h4l5 4V5Z",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
            d: "M15.54 8.46a5 5 0 0 1 0 7.07",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
            d: "M19.07 4.93a10 10 0 0 1 0 14.14",
        });
    }
    else {
        __VLS_asFunctionalElement1(__VLS_intrinsics.svg, __VLS_intrinsics.svg)({
            ...{ class: "tile-remote-volume__ico" },
            xmlns: "http://www.w3.org/2000/svg",
            fill: "none",
            viewBox: "0 0 24 24",
            stroke: "currentColor",
            'stroke-width': "2",
            'stroke-linecap': "round",
            'stroke-linejoin': "round",
            width: "18",
            height: "18",
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['tile-remote-volume__ico']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
            d: "M11 5 6 9H2v6h4l5 4V5Z",
        });
        __VLS_asFunctionalElement1(__VLS_intrinsics.path)({
            d: "m22 9-6 6M16 9l6 6",
        });
    }
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onClick: () => { } },
        ...{ onDragstart: () => { } },
        ...{ onMousedown: () => { } },
        ...{ onPointerdown: () => { } },
        ...{ onTouchstart: () => { } },
        ...{ class: "tile-menu__dropdown tile-remote-volume__dropdown" },
        draggable: "false",
    });
    /** @type {__VLS_StyleScopedClasses['tile-menu__dropdown']} */ ;
    /** @type {__VLS_StyleScopedClasses['tile-remote-volume__dropdown']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.label, __VLS_intrinsics.label)({
        ...{ class: "tile-menu__row" },
    });
    /** @type {__VLS_StyleScopedClasses['tile-menu__row']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "tile-menu__label" },
    });
    /** @type {__VLS_StyleScopedClasses['tile-menu__label']} */ ;
    (__VLS_ctx.t('callPage.listenVolume'));
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "tile-menu__pct" },
    });
    /** @type {__VLS_StyleScopedClasses['tile-menu__pct']} */ ;
    (__VLS_ctx.volumePercentUi);
    __VLS_asFunctionalElement1(__VLS_intrinsics.input)({
        ...{ onInput: (__VLS_ctx.onVolumeSliderInput) },
        ...{ onClick: () => { } },
        ...{ onDragstart: () => { } },
        ...{ onMousedown: () => { } },
        ...{ onPointerdown: () => { } },
        ...{ onTouchstart: () => { } },
        ...{ class: "tile-menu__range" },
        type: "range",
        min: "0",
        max: "200",
        step: "1",
        value: (__VLS_ctx.volumePercentUi),
        'aria-label': (__VLS_ctx.t('callPage.localListenVolumeSliderAria')),
        draggable: "false",
    });
    /** @type {__VLS_StyleScopedClasses['tile-menu__range']} */ ;
    if (__VLS_ctx.isDead) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "tile-menu__row tile-menu__row--mafia-bg" },
        });
        /** @type {__VLS_StyleScopedClasses['tile-menu__row']} */ ;
        /** @type {__VLS_StyleScopedClasses['tile-menu__row--mafia-bg']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "tile-menu__label" },
        });
        /** @type {__VLS_StyleScopedClasses['tile-menu__label']} */ ;
        (__VLS_ctx.eliminationBackgroundGroupLabel);
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "tile-menu__swatches" },
            role: "group",
            'aria-label': (__VLS_ctx.eliminationBackgroundGroupLabel),
        });
        /** @type {__VLS_StyleScopedClasses['tile-menu__swatches']} */ ;
        for (const [bg] of __VLS_vFor((__VLS_ctx.ELIMINATION_BACKGROUND_OPTIONS))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(!__VLS_ctx.isLocal && !__VLS_ctx.streamViewMode))
                            return;
                        if (!(__VLS_ctx.isDead))
                            return;
                        __VLS_ctx.setEliminationBackground(bg);
                        // @ts-ignore
                        [videoPresentation, videoPresentation, videoPresentation, eatFirstActionCard, eatFirstActionCard, eatFirstActionCard, eatFirstActionCard, eatFirstActionCard, eatFirstActionCard, eatFirstActionCard, isEatFirstTraitHostView, isEatFirstTraitHostView, isEatFirstTraitHostView, isEatFirstTraitOwnerView, onEatFirstPlayerUseActionCard, t, t, t, t, t, t, t, t, t, t, onEatFirstRerollActionCard, eatFirstToastVisible, eatFirstToastLabel, isLocal, isLocal, audioSplitStream, audioSplitStream, audioSplitStream, playRev, playRev, playRev, remoteListenVolume, remoteListenVolume, remoteListenMuted, remoteListenMuted, peerId, audioEnabled, audioEnabled, audioEnabled, audioEnabled, audioEnabled, emit, emit, emit, deadShade, deadShade, showVideo, showVideo, showVideo, streamVideoMemoDeps, streamVideoStableKey, stream, remotePlaybackStallPeerIdForVideo, remotePlaybackStallPeerIdForVideo, videoFillCover, videoPlaybackSuppressed, videoTargetPlaybackFps, editingName, editingName, startNameEdit, startNameEdit, streamViewMode, streamViewMode, streamViewMode, streamViewMode, streamViewMode, streamViewMode, streamViewMode, streamViewMode, streamViewMode, showSeatBadge, showSeatBadge, showSeatBadge, showSeatBadge, resolvedSeatIndex, resolvedSeatIndex, resolvedSeatIndex, resolvedSeatIndex, showRoleBadge, showRoleBadge, showRoleBadge, showRoleBadge, roleBadgeLabel, roleBadgeLabel, roleBadgeLabel, roleBadgeLabel, roleBadgeLabel, roleBadgeLabel, roleBadgeLabel, roleBadgeLabel, tilePrimaryLine, tilePrimaryLine, finishNameEdit, finishNameEdit, onNameInputEnter, onNameInputEnter, cancelNameEdit, cancelNameEdit, nameDraft, nameDraft, raiseHand, raiseHand, showEliminationMark, resolvedEliminationKind, resolvedEliminationIconSrc, showAvatar, resolvedAvatarUrl, showInitialsFallback, initials, avatarFallbackName, avatarFallbackName, avatarFallbackName, displayName, resolvedHostShowLifeToggle, onHostLifeClick, isDead, isDead, isDead, hostLifeToggleTitle, hostLifeToggleTitle, onLocalListenIconClick, localListenIconAria, localListenSilenced, localListenSilenced, volumePercentUi, volumePercentUi, onVolumeSliderInput, eliminationBackgroundGroupLabel, eliminationBackgroundGroupLabel, ELIMINATION_BACKGROUND_OPTIONS, setEliminationBackground,];
                    } },
                key: (bg),
                type: "button",
                ...{ class: "tile-menu__swatch" },
                ...{ class: ([`tile-menu__swatch--${bg}`, { 'tile-menu__swatch--active': __VLS_ctx.resolvedEliminationBackground === bg }]) },
                'aria-label': (__VLS_ctx.eliminationBackgroundSwatchLabel(bg)),
                'aria-pressed': (__VLS_ctx.resolvedEliminationBackground === bg),
            });
            /** @type {__VLS_StyleScopedClasses['tile-menu__swatch']} */ ;
            /** @type {__VLS_StyleScopedClasses['tile-menu__swatch--active']} */ ;
            // @ts-ignore
            [resolvedEliminationBackground, resolvedEliminationBackground, eliminationBackgroundSwatchLabel,];
        }
    }
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
