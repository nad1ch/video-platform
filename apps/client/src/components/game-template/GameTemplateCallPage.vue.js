/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
/**
 * GameTemplateCallPage — fork of `components/call/CallPage.vue` for the
 * `/app/game-template` route. The file was originally cut byte-faithful
 * from CallPage; Phase 3C migrated it off the Mafia runtime to the
 * generic GameRoom client layer, and Phase 4A cleaned up local naming
 * left over from the migration.
 *
 * Current runtime wiring on this file:
 *   - signaling room prefix: `gameroom:<base>` via `useGameRoomMediaRoom`.
 *   - WS protocol: `GameRoomWs.*` (`@/composables/gameRoomWsProtocol`).
 *   - host signaling: `useGameRoomHostSignaling` (no Mafia inbound parsers).
 *   - audio mix:      `useGameRoomAudioMixSignaling`.
 *   - tile-click host UI: `useGameRoomCallHostUi` (swap + speaking only,
 *     no Mafia night-action branch).
 *   - game store:    `useGameTemplateGameStore` (no roles, no night
 *     actions, no old/new mode, no background galleries).
 *   - players store: `useGameTemplatePlayersStore`.
 *   - view mode:     `useGameRoomViewMode` (gated on
 *     `route.name === 'game-template'`).
 *
 * Shared infrastructure deliberately kept:
 *   - `useCallOrchestrator` from call-core (mediasoup + media SSOT).
 *   - `ParticipantTile.vue` is consumed via its neutral `game-*` prop /
 *     emit aliases (`game-seat-index`, `game-life-state`,
 *     `@game-toggle-life`, etc.). The component still exposes its
 *     legacy `mafia-*` API in parallel for production Mafia; the alias
 *     pair resolves to the same internal state.
 *   - Stylesheet: `<style src="@/components/call/CallPage.css">`. Mafia
 *     and Game Template share the same class names (`call-page__*`,
 *     `mafia-vote-hud*`, `mafia-host-mode-*`); renaming those classes
 *     is the same coordinated future phase.
 *
 * Phase 4B stripped the EatFirst dead-code branches inherited from the
 * original CallPage byte-faithful fork (trait/action-card/slot-claim
 * helpers, EatFirst-only watchers, the `<EatFirstHostActionsBar>` /
 * `<EatFirstSpeakingQueueBar>` mounts, the `route.name === 'eat'`
 * disjuncts in `isCallAppRoute` / `switchToRoom` / route watcher /
 * `qSignaling` ternary). EatFirst logic still lives in its own
 * `apps/client/src/eat-first/**` tree and on `/app/eat`, untouched.
 */
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, onMounted, onUnmounted, ref, shallowRef, watch, } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { getAudioAnalysisAudioContext, normalizeDisplayName, useCallOrchestrator, VIDEO_QUALITY_PRESETS, } from 'call-core';
import { useLocalTileSpeakingVisual } from '@/composables/useLocalTileSpeakingVisual';
import { useAuth } from '@/composables/useAuth';
import { createLogger } from '@/utils/logger';
import { saveCallTileLocalDisplayOverrides } from '@/utils/callTileLocalDisplayNames';
import { resolveHostPeerIdForGrid, sortPeerIdsHostLast } from '@/components/call/callTileOrderRules';
const callPageLog = createLogger('call-page');
import ParticipantTile from '@/components/call/ParticipantTile.vue';
import MediaDiagnosticsPanel from '@/components/call/MediaDiagnosticsPanel.vue';
import { isMediaDebugEnabled } from '@/utils/mediaDebugRuntime';
import { useMediaStallRecovery } from '@/components/call/useMediaStallRecovery';
import CallRoomPopover from '@/components/call/CallRoomPopover.vue';
import CallControlsDock from '@/components/call/CallControlsDock.vue';
import CallChatPanel from '@/components/call/CallChatPanel.vue';
import { useCallChatPanel } from '@/components/call/useCallChatPanel';
import { GAP, useCallTileLayoutFlip } from '@/composables/game-room/useCallTileLayoutFlip';
import { SPOTLIGHT_STRIP_VISIBLE_LIMIT, useCallSpotlightLayout, } from '@/composables/game-room/useCallSpotlightLayout';
import { useFullPowerMode } from '@/composables/game-room/useFullPowerMode';
import { useCallMediaDebugTaps } from '@/composables/game-room/useCallMediaDebugTaps';
import { useCallPresenceToasts } from '@/composables/game-room/useCallPresenceToasts';
import { useCallDevicePickers } from '@/composables/game-room/useCallDevicePickers';
import { useRemoteTileBudget } from '@/composables/game-room/useRemoteTileBudget';
import { useCallRoomCodeChip } from '@/composables/game-room/useCallRoomCodeChip';
import { useCallDisplayNames } from '@/composables/game-room/useCallDisplayNames';
import { useCallChatInboundToasts } from '@/composables/game-room/useCallChatInboundToasts';
import { useCallTileOrdering } from '@/composables/game-room/useCallTileOrdering';
import { useCallRouteHtmlClass } from '@/composables/game-room/useCallRouteHtmlClass';
import { useCallToastEventListeners } from '@/composables/game-room/useCallToastEventListeners';
import { useCallPageBootstrap } from '@/composables/game-room/useCallPageBootstrap';
import GameRoomCallBottomCluster from '@/components/game-room/GameRoomCallBottomCluster.vue';
import GameRoomCallPresenceToastsPanel from '@/components/game-room/GameRoomCallPresenceToastsPanel.vue';
import GameRoomCallChatInboundToastsPanel from '@/components/game-room/GameRoomCallChatInboundToastsPanel.vue';
import GameRoomCallDebugOverlay from '@/components/game-room/GameRoomCallDebugOverlay.vue';
import AppContainer from '@/components/ui/AppContainer.vue';
import AppButton from '@/components/ui/AppButton.vue';
import AppFullPageLoader from '@/components/ui/AppFullPageLoader.vue';
import tilePinIcon from '@/assets/mafia/ui/tile-pin.svg';
import { generateCallRoomCode } from '@/utils/callRoomUi';
import { useCallRoomHeaderJoinStore } from '@/stores/callRoomHeaderJoin';
import { useGameRoomHostSignaling } from '@/composables/useGameRoomHostSignaling';
import { useGameRoomCallHostUi } from '@/composables/useGameRoomCallHostUi';
import { gameRoomBaseRoomIdFromSignaling, gameRoomSignalingRoomId, GAME_ROOM_SIGNALING_ROOM_PREFIX, } from '@/composables/useGameRoomMediaRoom';
// GameTemplate fork: mounts the GameTemplate adapters that wrap the
// shared `GameHostActionsBar` / `GameSpeakingQueueBar` presentational
// primitives under `components/game-call/`. (Mafia mounts its own
// parallel adapters from `components/mafia/`; both stacks share the
// same shared primitives.)
import GameTemplateSpeakingQueueBar from '@/components/game-template/GameTemplateSpeakingQueueBar.vue';
import GameTemplateHostActionsBar from '@/components/game-template/GameTemplateHostActionsBar.vue';
import { useGameTemplateGameStore } from '@/stores/gameTemplateGame';
import { useGameTemplatePlayersStore } from '@/stores/gameTemplatePlayers';
// `mafiaEliminationAvatarKindForPeerId` is intentionally not imported —
// the Mafia-specific elimination avatar variant has no generic equivalent.
// ParticipantTile receives `undefined` for `game-elimination-kind` on
// the game-template route, which renders the default tile chrome.
import { GAME_ROOM_OBS_URL_TOAST_EVENT, GAME_ROOM_SETTINGS_TOAST_EVENT } from '@/composables/gameRoomStreamViewRoute';
import { GameRoomWs } from '@/composables/gameRoomWsProtocol';
import { useGameRoomAudioMixSignaling } from '@/composables/useGameRoomAudioMixSignaling';
import tilePinActiveIcon from '@/assets/mafia/ui/tile-pin-active.svg';
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { user, ensureAuthLoaded, isAdmin } = useAuth();
/**
 * GameTemplate fork: this file is only mounted on `/app/game-template`.
 * `isGameRoomRoute` is the single route predicate every downstream
 * branch checks; the WS protocol (`gameroom:*`) and signaling room
 * prefix (`gameroom:<base>`) are owned by the generic GameRoom client
 * layer — see this file's top-of-script docblock.
 *
 * `isCallAppRoute` is kept as an alias of `isGameRoomRoute` because
 * several call-shell side effects (HTML class toggle, route-watch
 * room-code generation, normalize-session-room-id, chat panel inbound
 * toasts) historically guarded on a generic "in a call-app route"
 * boolean and we keep the same name to minimize the diff inside those
 * branches.
 */
const isGameRoomRoute = computed(() => route.name === 'game-template');
const isCallAppRoute = isGameRoomRoute;
const props = withDefaults(defineProps(), { gameRoomStreamView: false });
const gameRoomViewUi = computed(() => isGameRoomRoute.value && props.gameRoomStreamView);
/**
 * HTML5 drag-and-drop tile reorder is intentionally disabled inside Game
 * Template (host uses the swap-mode click flow); the drag affordance and
 * its "Drag to reorder" tooltip must stay in lock-step. Bind
 * `:draggable`, `:title`, and `:aria-label` to this single computed so a
 * future change to the gate is impossible to apply to just one of them.
 */
const canReorderTiles = computed(() => !gameRoomViewUi.value && !isGameRoomRoute.value);
/**
 * Game Template `?mode=view`: recv-only in call-core — no camera/mic publish
 * (`wireCallMediaAfterRoomState` skips send transport for `viewer`).
 */
const callEngineRole = computed(() => gameRoomViewUi.value ? 'viewer' : 'participant');
// `sa-call-route` <html> class toggle + onUnmounted cleanup — Block 27.
useCallRouteHtmlClass(isCallAppRoute);
const allowManualVideoQuality = computed(() => isAdmin.value);
/** Sent with `join-room` and used as local tile `avatarUrl` SSOT (same URL remotes receive via roster). */
const joinAvatarUrl = computed(() => {
    const a = user.value?.avatar;
    return typeof a === 'string' && a.trim().length > 0 ? a.trim() : undefined;
});
const joinUserId = computed(() => {
    const id = user.value?.id;
    return typeof id === 'string' && id.trim().length > 0 ? id.trim() : undefined;
});
const showCallDebugControls = computed(() => isAdmin.value || import.meta.env.DEV);
const { session, joining, joinError, joinCall, leaveCall, tiles, sizeTier, activeSpeakerPeerId, localAudioSourceStream, micEnabled, camEnabled, callDeafened, toggleMic, toggleCam, toggleCallDeafen, audioInputDevices, videoInputDevices, audioOutputDevices, refreshMediaDevices, localAudioInputDeviceId, localVideoInputDeviceId, setCallAudioInputDevice, setCallVideoInputDevice, wsStatus, callDebugSnapshot, refreshInboundVideoDebugStats, callPresenceMessages, setRemoteListenVolume, setRemoteListenMuted, callChatMessages, sendChatMessage, handRaised, toggleRaiseHand, screenSharing, toggleScreenShare, sendSignalingMessage, subscribeSignalingMessage, receiveDeviceProfile, serverActiveSpeakerPeerId, playbackRenderFpsPressureByPeerId, setPeerVisible, requestForcedProducerResync, requestHardProducerResync, } = useCallOrchestrator({ allowManualVideoQuality, joinAvatarUrl, joinUserId, role: callEngineRole });
/** Dev-only: gate for the floating `<MediaDiagnosticsPanel>` and the `__MEDIA_DEBUG__` console helpers. */
const mediaDebugPanelEnabled = isMediaDebugEnabled();
/**
 * OBS / `?mode=view` safety gate. Read by `useMediaStallRecovery` to skip the
 * hard producer resync (which would broadcast a synchronous all-cameras
 * flicker to stream viewers) and by anything else that needs to know whether
 * this CallPage instance is acting as a public OBS source rather than a
 * normal participant.
 */
function isOperatingAsObsViewSource() {
    return gameRoomViewUi.value;
}
const { remotePlaybackWaitingPeerIds, onRemotePlaybackStall, onTileVideoStall, onTileAudioStall, } = useMediaStallRecovery({
    tiles,
    isOperatingAsObsViewSource,
    requestForcedProducerResync,
    requestHardProducerResync,
});
/**
 * Global health for **playback budget / full-power** only (strong profile).
 * Not used for per-tile FPS — one struggling remote must not throttle everyone else.
 */
const isSystemHealthy = computed(() => {
    if (remotePlaybackWaitingPeerIds.value.size > 0) {
        return false;
    }
    for (const p of playbackRenderFpsPressureByPeerId.value.values()) {
        if (p !== 'good') {
            return false;
        }
    }
    return true;
});
const { isFullPowerMode } = useFullPowerMode({
    isSystemHealthy,
    receiveDeviceProfile,
});
if (import.meta.env.DEV) {
    watch(callEngineRole, (role) => {
        callPageLog.info('[call-qa:role] callEngineRole', {
            role,
            gameRoomViewUi: gameRoomViewUi.value,
            routeName: route.name,
            isGameRoomRoute: isGameRoomRoute.value,
        });
    }, { immediate: true });
}
useGameRoomHostSignaling(sendSignalingMessage, subscribeSignalingMessage, wsStatus);
// Diagnostics-only WS / signaling counters + probes + env-info stamp +
// optional `__MEDIA_DEBUG__` global install live in `useCallMediaDebugTaps`
// (Block 24). The env-info payload is route-specific (Game Template
// stamps `isGameRoomView`) and is supplied as a thunk; the shared
// `mediaDebugRuntime` reader ORs that key into the `isViewMode` summary.
useCallMediaDebugTaps({
    wsStatus,
    subscribeSignalingMessage,
    requestForcedProducerResync,
    envInfo: () => ({
        isGameRoomView: gameRoomViewUi.value,
    }),
});
const { selfPeerId, selfDisplayName, remoteDisplayNames } = storeToRefs(session);
const GAME_ROOM_FORCE_CAMERA_OFF_SIGNAL = GameRoomWs.forceCameraOff;
const GAME_ROOM_FORCE_MUTE_ALL_SIGNAL = GameRoomWs.forceMuteAll;
function gameRoomSignalPayload(data, type) {
    if (data == null || typeof data !== 'object') {
        return null;
    }
    const rec = data;
    if (rec.type !== type || rec.payload == null || typeof rec.payload !== 'object') {
        return null;
    }
    return rec.payload;
}
const offGameRoomForceControls = subscribeSignalingMessage((data) => {
    if (!isGameRoomRoute.value) {
        return;
    }
    const nickPayload = gameRoomSignalPayload(data, GameRoomWs.playerNicknameUpdate);
    if (nickPayload != null) {
        const peerId = typeof nickPayload.peerId === 'string' ? nickPayload.peerId.trim() : '';
        if (!peerId) {
            return;
        }
        const displayName = typeof nickPayload.displayName === 'string' ? nickPayload.displayName.trim().slice(0, 64) : '';
        const next = { ...nicknameOverrideByPeerId.value };
        if (!displayName) {
            delete next[peerId];
        }
        else {
            next[peerId] = displayName;
        }
        nicknameOverrideByPeerId.value = next;
        // Ensure an older local-only rename doesn't shadow the server-synced nickname.
        if (Object.prototype.hasOwnProperty.call(localTileDisplayOverrides.value, peerId)) {
            const cleaned = { ...localTileDisplayOverrides.value };
            delete cleaned[peerId];
            localTileDisplayOverrides.value = cleaned;
            saveCallTileLocalDisplayOverrides(cleaned);
        }
        return;
    }
    const mutePayload = gameRoomSignalPayload(data, GAME_ROOM_FORCE_MUTE_ALL_SIGNAL);
    if (mutePayload != null) {
        if (gameStore.isGameRoomHost) {
            return;
        }
        const muted = mutePayload.muted !== false;
        if (muted && micEnabled.value) {
            void toggleMic();
        }
        else if (!muted && !micEnabled.value) {
            void toggleMic();
        }
        return;
    }
    const cameraPayload = gameRoomSignalPayload(data, GAME_ROOM_FORCE_CAMERA_OFF_SIGNAL);
    const peerId = cameraPayload?.peerId;
    if (typeof peerId === 'string' && peerId === selfPeerId.value && camEnabled.value) {
        void toggleCam();
    }
    // Per-peer game-room mic-force (server-emitted side effect of kick/revive
    // via `gameroom:force-peer-mic`). `muted: true` flips the local mic UI off
    // through the existing call-core `toggleMic` action so the killed peer
    // stops trying to talk into a server-paused producer. `muted: false` is a
    // UI hint clear only — we do NOT auto-unmute the user; they unmute
    // manually after revive.
    const forcePeerMicPayload = gameRoomSignalPayload(data, GameRoomWs.forcePeerMic);
    if (forcePeerMicPayload != null) {
        const targetPeerId = forcePeerMicPayload.peerId;
        const muted = forcePeerMicPayload.muted === true;
        if (typeof targetPeerId === 'string'
            && targetPeerId === selfPeerId.value
            && muted
            && micEnabled.value) {
            void toggleMic();
        }
    }
});
onBeforeUnmount(offGameRoomForceControls);
/**
 * Per-peer effective audio-muted tracking for the host's "mute all" button
 * visual state. Server's `peer-audio-muted` already encodes effective mute
 * (`audioMuted || forcedAudioMuted`); the room-state snapshot at join
 * carries the same data per peer. Both flow into the store's
 * `peerEffectiveMutedByPeerId`, which `GameTemplateHostActionsBar` reduces
 * against `nonHostPeerIds` for the visual.
 *
 * Gated on `isGameRoomRoute` so non-game-room rooms never write to the
 * generic game-room store.
 */
const offGameRoomPeerAudioMuted = subscribeSignalingMessage((data) => {
    if (!isGameRoomRoute.value) {
        return;
    }
    if (data == null || typeof data !== 'object') {
        return;
    }
    const rec = data;
    if (rec.type === 'room-state') {
        const peers = rec.payload?.peers;
        if (!Array.isArray(peers)) {
            return;
        }
        const snapshot = {};
        for (const p of peers) {
            if (p == null || typeof p !== 'object')
                continue;
            const pid = p.peerId;
            const muted = p.audioMuted;
            if (typeof pid === 'string' && pid.length > 0 && muted === true) {
                snapshot[pid] = true;
            }
        }
        gameStore.replacePeerEffectiveMutedSnapshot(snapshot);
        return;
    }
    if (rec.type === 'peer-audio-muted') {
        const p = rec.payload;
        if (p == null || typeof p !== 'object')
            return;
        const pid = p.peerId;
        const muted = p.muted;
        if (typeof pid !== 'string' || pid.length === 0)
            return;
        gameStore.setPeerEffectiveMuted(pid, muted === true);
        return;
    }
    if (rec.type === 'peer-left') {
        const p = rec.payload;
        if (p == null || typeof p !== 'object')
            return;
        const pid = p.peerId;
        if (typeof pid !== 'string' || pid.length === 0)
            return;
        gameStore.clearPeerEffectiveMuted(pid);
    }
});
onBeforeUnmount(offGameRoomPeerAudioMuted);
/**
 * Toggling Game Template `?mode=view` (header / router) flips `callEngineRole` only after a new wire; re-join
 * so OBS drops any existing send transport from a prior participant session in the same tab.
 */
watch(gameRoomViewUi, (v, oldV) => {
    if (!isGameRoomRoute.value) {
        return;
    }
    if (v === oldV) {
        return;
    }
    if (!session.inCall) {
        return;
    }
    if (joining.value) {
        return;
    }
    void (async () => {
        await leaveCall();
        await joinCall();
    })();
});
// `nicknameOverrideByPeerId` is page-owned because the Game Template
// `playerNicknameUpdate` WS handler above also writes to it from outside
// the composable. `useCallDisplayNames` consumes it via
// `policy.nicknameOverrides`.
const nicknameOverrideByPeerId = shallowRef({});
// `participantsByPeerId`, `displayNameUiByPeerId`, `localTileDisplayOverrides`,
// `canEditTileDisplayName`, `onCommitLocalTileDisplayName`, `peerDisplayName`,
// and `peerAvatarFallbackName` live in `useCallDisplayNames` (Block 25). The
// composable call itself is below — it depends on `gameStore.isGameRoomHost`,
// so the call is placed after that store is instantiated.
/** Stable handlers so grid re-renders do not allocate new fns per tile per frame. */
const remoteListenVolumeByPeer = new Map();
const remoteListenMutedByPeer = new Map();
/**
 * Deferred slot: assigned by `useGameRoomAudioMixSignaling` further down
 * the setup script (it depends on `gameStore` which is initialized later).
 * Handlers below reference the slot lazily so the host's slider/mute
 * toggle also fans out a `gameroom:audio-mix-update` to the room (OBS
 * view applies it). No-op for non-host or non-game-room routes.
 */
const audioMixBroadcasterSlot = {
    broadcast: null,
};
function broadcastGameRoomAudioMixDeltaForTile(peerId, volume, muted) {
    audioMixBroadcasterSlot.broadcast?.({ peerId, volume, muted });
}
function readTileMutedForPeer(peerId) {
    const t = tiles.value.find((row) => !row.isLocal && row.peerId === peerId);
    return Boolean(t?.remoteListenMuted);
}
function readTileVolumeForPeer(peerId) {
    const t = tiles.value.find((row) => !row.isLocal && row.peerId === peerId);
    const raw = Number(t?.remoteListenVolume ?? 1);
    return Number.isFinite(raw) ? Math.min(2, Math.max(0, raw)) : 1;
}
function remoteListenVolumeHandler(peerId) {
    let h = remoteListenVolumeByPeer.get(peerId);
    if (!h) {
        h = (v) => {
            setRemoteListenVolume(peerId, v);
            // Read companion (muted) AFTER apply so the broadcast carries the
            // engine-resolved entry — `setRemoteListenVolume` does not change muted.
            broadcastGameRoomAudioMixDeltaForTile(peerId, readTileVolumeForPeer(peerId), readTileMutedForPeer(peerId));
        };
        remoteListenVolumeByPeer.set(peerId, h);
    }
    return h;
}
function remoteListenMutedHandler(peerId) {
    let h = remoteListenMutedByPeer.get(peerId);
    if (!h) {
        h = (v) => {
            setRemoteListenMuted(peerId, v);
            // Engine may bump volume from 0 → nz on unmute; reading after apply
            // mirrors what the host's UI now shows so OBS sees the same state.
            broadcastGameRoomAudioMixDeltaForTile(peerId, readTileVolumeForPeer(peerId), readTileMutedForPeer(peerId));
        };
        remoteListenMutedByPeer.set(peerId, h);
    }
    return h;
}
// Remote-tile playback budget — viewport-visible map, server-side
// `setPeerVisible` debounce, per-peer suppression state, suppression
// watcher, and the page-facing `videoPlaybackSuppressedForPeer` /
// `remoteVideoTargetPlaybackFpsForPeer` / `onCallTileViewportForLayers`
// — live in `useRemoteTileBudget` (Block 24). The tile-set-change
// watcher below still owns the non-budget prunes (display-name overrides,
// listen-volume / listen-muted maps); it delegates its budget prunes to
// the composable's `cleanupForRemovedPeers` helper.
const { videoPlaybackSuppressedForPeer, remoteVideoTargetPlaybackFpsForPeer, onCallTileViewportForLayers, cleanupForRemovedPeers: cleanupBudgetForRemovedPeers, } = useRemoteTileBudget({
    tiles,
    selfPeerId,
    receiveDeviceProfile,
    setPeerVisible,
    activeSpeakerPeerId,
    serverActiveSpeakerPeerId,
    isFullPowerMode,
    isCallAppRoute,
    log: callPageLog,
});
watch(() => tiles.value.map((t) => t.peerId).join(), () => {
    const ids = new Set(tiles.value.map((t) => t.peerId));
    for (const id of remoteListenVolumeByPeer.keys()) {
        if (!ids.has(id))
            remoteListenVolumeByPeer.delete(id);
    }
    for (const id of remoteListenMutedByPeer.keys()) {
        if (!ids.has(id))
            remoteListenMutedByPeer.delete(id);
    }
    // Budget prunes (viewport map, suppress-delay timers, peer-visible
    // hide timers + last-sent map) are delegated to `useRemoteTileBudget`.
    cleanupBudgetForRemovedPeers(ids);
    const o = localTileDisplayOverrides.value;
    let next = null;
    for (const k of Object.keys(o)) {
        if (!ids.has(k)) {
            if (!next) {
                next = { ...o };
            }
            delete next[k];
        }
    }
    if (next) {
        localTileDisplayOverrides.value = next;
        saveCallTileLocalDisplayOverrides(next);
    }
});
const videoQualityChoice = computed({
    get() {
        return session.videoQualityExplicit ? session.videoQualityPreset : 'auto';
    },
    set(v) {
        if (v === 'auto') {
            session.setVideoQualityImplicitDefault();
        }
        else {
            session.setVideoQualityPreset(v);
        }
    },
});
const callDebugOverlay = computed({
    get: () => session.callDebugOverlay,
    set: (v) => session.setCallDebugOverlay(v),
});
const qualityPresets = VIDEO_QUALITY_PRESETS;
const inboundDebugRows = ref([]);
const inboundDebugBusy = ref(false);
// `callToasts` stack + `pushCallToast` + presence-toast watcher are owned
// by `useCallPresenceToasts` (Block 24). The route-specific OBS / Settings
// toast handlers below still push into `callToasts.value` directly because
// their `id` prefix (`gameroom-obs-…`, `gameroom-settings-…`) is the
// existing observable shape.
const { callToasts, pushCallToast } = useCallPresenceToasts({
    callPresenceMessages,
    t,
});
// Route-specific OBS / Settings toast event listeners — Block 27.
// Same composable both pages use; Game Template ships only two
// route-specific descriptors (no EatFirst gate here).
useCallToastEventListeners({
    callToasts,
    events: [
        {
            eventName: GAME_ROOM_OBS_URL_TOAST_EVENT,
            idPrefix: 'gameroom-obs',
            getText: () => t('gameRoom.obsViewUrlCopiedToast'),
        },
        {
            eventName: GAME_ROOM_SETTINGS_TOAST_EVENT,
            idPrefix: 'gameroom-settings',
            kind: 'leave',
            getText: (ev) => ev instanceof CustomEvent && typeof ev.detail?.text === 'string'
                ? ev.detail.text
                : t('gameRoom.backgroundUploadFailed'),
        },
    ],
});
const { chatOpen, chatPanelClass, chatPanelStyle, onChatPanelDragPointerDown, onChatPanelResizePointerDown, stopChatPanelGesture, syncChatPanelToViewport, } = useCallChatPanel({
    inCall: () => session.inCall,
    roomId: () => session.roomId,
});
// Chat inbound toast stack (queue, dismiss / open-chat helpers, inCall
// reset + chatOpen sync + messages watcher) lives in
// `useCallChatInboundToasts` (Block 25). Game Template's `isViewMode`
// is a single `gameRoomViewUi`.
const { callChatInboundToasts, dismissCallChatInboundToast, openChatFromInboundToast, } = useCallChatInboundToasts({
    isInCall: computed(() => session.inCall),
    joining,
    isViewMode: gameRoomViewUi,
    callChatMessages,
    selfPeerId,
    chatOpen,
});
const callControlsDockRef = ref(null);
// `roomJoinDraft`, `roomCopyFlash`, `copyRoomToClipboard`,
// `onGenerateNewRoom`, `submitRoomDraft`, and the popover-open sync
// watcher live in `useCallRoomCodeChip` (Block 25). The composable
// call itself is below — it depends on `displayCallOrGameRoomCode`
// and `switchToRoom`, both of which are page-specific.
const callAuthReady = ref(false);
const callRoomHeaderJoin = useCallRoomHeaderJoinStore();
const { roomPopoverOpen } = storeToRefs(callRoomHeaderJoin);
const { micPickerOpen, camPickerOpen, speakerPickerOpen, localAudioOutputDeviceId, showMediaDevicePickers, closeMediaDevicePickers, pickAudioInput, pickVideoInput, pickAudioOutput, } = useCallDevicePickers({
    isInCall: computed(() => session.inCall),
    audioInputDevices,
    videoInputDevices,
    audioOutputDevices,
    setCallAudioInputDevice,
    setCallVideoInputDevice,
    callControlsDockRef,
    isRoomPopoverOpen: () => callRoomHeaderJoin.roomPopoverOpen,
    closeRoomPopover: () => callRoomHeaderJoin.closeRoomPopover(),
    log: callPageLog,
});
const playersStore = useGameTemplatePlayersStore();
const gameStore = useGameTemplateGameStore();
watch(joinUserId, (id) => {
    gameStore.setLocalUserId(id ?? null);
}, { immediate: true });
const { hostPeerId: hostPeerIdRef, isGameRoomHost: isGameRoomHostRef } = storeToRefs(gameStore);
const { localTileDisplayOverrides, canEditTileDisplayName, onCommitLocalTileDisplayName, peerDisplayName, peerAvatarFallbackName, } = useCallDisplayNames({
    tiles,
    remoteDisplayNames,
    selfPeerId,
    selfDisplayName,
    policy: {
        isRouteActive: isGameRoomRoute,
        isHost: isGameRoomHostRef,
        nicknameOverrides: nicknameOverrideByPeerId,
        sendPlayerNameUpdate: (peerId, displayName) => {
            sendSignalingMessage({
                type: GameRoomWs.playerNameUpdate,
                payload: { targetPeerId: peerId, displayName },
            });
        },
    },
});
const { broadcastGameRoomAudioMixDelta } = useGameRoomAudioMixSignaling({
    sendSignalingMessage,
    subscribeSignalingMessage,
    wsStatus,
    isGameRoomRoute,
    isViewMode: gameRoomViewUi,
    isGameRoomHost: isGameRoomHostRef,
    hostPeerId: hostPeerIdRef,
    setRemoteListenVolume,
    setRemoteListenMuted,
});
audioMixBroadcasterSlot.broadcast = broadcastGameRoomAudioMixDelta;
function displayCallOrGameRoomCode() {
    const raw = normalizeDisplayName(session.roomId) || 'demo';
    if (isGameRoomRoute.value) {
        return gameRoomBaseRoomIdFromSignaling(raw);
    }
    return raw;
}
/**
 * Keep `session.roomId` consistent with the route: Game Template → `gameroom:<base>`.
 * If the stored room id carries the prefix on a non-game-room mount (defensive),
 * strip it back to the base form.
 */
function normalizeSessionRoomIdForStreamRoute() {
    if (!isCallAppRoute.value) {
        return;
    }
    const s = normalizeDisplayName(session.roomId) || 'demo';
    if (isGameRoomRoute.value) {
        const desired = gameRoomSignalingRoomId(gameRoomBaseRoomIdFromSignaling(s));
        if (s !== desired) {
            session.roomId = desired;
        }
        return;
    }
    if (s.startsWith(GAME_ROOM_SIGNALING_ROOM_PREFIX)) {
        session.roomId = gameRoomBaseRoomIdFromSignaling(s);
    }
}
async function switchToRoom(nextRaw, opts) {
    const base = normalizeDisplayName(nextRaw) || 'demo';
    const signalingId = gameRoomSignalingRoomId(base);
    if (joining.value) {
        return;
    }
    const cur = normalizeDisplayName(session.roomId) || 'demo';
    if (cur === signalingId && session.inCall) {
        callRoomHeaderJoin.closeRoomPopover();
        return;
    }
    if (session.inCall) {
        leaveCall();
    }
    session.roomId = signalingId;
    if (!opts?.fromRoute && isCallAppRoute.value) {
        try {
            await router.replace({ name: 'game-template', query: { ...route.query, room: base } });
        }
        catch {
            /* ignore */
        }
    }
    callRoomHeaderJoin.closeRoomPopover();
    await joinCall();
}
watch(() => [
    route.name,
    typeof route.query.room === 'string' ? route.query.room : '',
    callAuthReady.value,
], async () => {
    if (!callAuthReady.value || !isCallAppRoute.value) {
        return;
    }
    normalizeSessionRoomIdForStreamRoute();
    const q = typeof route.query.room === 'string' ? normalizeDisplayName(route.query.room) : '';
    if (!q) {
        if (!session.inCall && !joining.value) {
            try {
                const code = generateCallRoomCode();
                await router.replace({
                    name: 'game-template',
                    query: { ...route.query, room: code },
                });
            }
            catch {
                /* ignore */
            }
        }
        return;
    }
    const currentSignaling = normalizeDisplayName(session.roomId) || 'demo';
    const qSignaling = gameRoomSignalingRoomId(q);
    if (qSignaling !== currentSignaling) {
        await switchToRoom(q, { fromRoute: true });
        return;
    }
    if (!session.inCall && !joining.value) {
        void joinCall();
    }
}, { immediate: true });
const { roomJoinDraft, roomCopyFlash, copyRoomToClipboard, onGenerateNewRoom, submitRoomDraft, } = useCallRoomCodeChip({
    roomPopoverOpen,
    displayRoomCode: displayCallOrGameRoomCode,
    switchToRoom,
});
function retryJoinCall() {
    void joinCall();
}
async function refreshInboundDebug() {
    inboundDebugBusy.value = true;
    try {
        inboundDebugRows.value = await refreshInboundVideoDebugStats();
    }
    finally {
        inboundDebugBusy.value = false;
    }
}
/** Local display order (peer ids); does not affect signaling / mediasoup. */
const tileOrder = ref([]);
const dragPeerId = ref(null);
const dragOverPeerId = ref(null);
const tileDragStartedFromControls = ref(false);
const pinnedPeerId = ref(null);
watch(tiles, (list) => {
    const ids = list.map((t) => t.peerId);
    if (isGameRoomRoute.value) {
        const explicitHostId = typeof gameStore.hostPeerId === 'string' ? gameStore.hostPeerId.trim() : '';
        const prevDisplayOrder = gameStore.getDisplayNumberingOrder(tileOrder.value);
        const hostId = resolveHostPeerIdForGrid(explicitHostId, prevDisplayOrder);
        tileOrder.value = sortPeerIdsHostLast(ids, hostId);
        return;
    }
    const prev = tileOrder.value;
    const next = [];
    for (const id of prev) {
        if (ids.includes(id)) {
            next.push(id);
        }
    }
    for (const id of ids) {
        if (!next.includes(id)) {
            next.push(id);
        }
    }
    tileOrder.value = next;
}, { immediate: true, flush: 'post' });
watch(() => tiles.value.map((t) => t.peerId), (ids) => {
    if (pinnedPeerId.value != null && !ids.includes(pinnedPeerId.value)) {
        pinnedPeerId.value = null;
    }
}, { flush: 'pre' });
/**
 * Push the current non-host participant peerIds to the game-room store so
 * it can compute "every non-host effectively muted" for the host UI
 * button. The store filters out the host peerId internally.
 */
watch(() => [
    isGameRoomRoute.value,
    gameStore.hostPeerId,
    tiles.value.map((t) => t.peerId).join('|'),
], () => {
    if (!isGameRoomRoute.value) {
        gameStore.setNonHostPeerIds([]);
        return;
    }
    // Pass every tile peerId; the store filters the host peer internally.
    // This keeps the membership stable when host changes via transfer.
    gameStore.setNonHostPeerIds(tiles.value.map((t) => t.peerId));
}, { immediate: true, flush: 'post' });
const seatNumberByPeer = computed(() => {
    if (!isGameRoomRoute.value) {
        return new Map();
    }
    const m = new Map();
    const order = gameStore.getDisplayNumberingOrder(tileOrder.value);
    const explicitHostPeerId = typeof gameStore.hostPeerId === 'string' ? gameStore.hostPeerId.trim() : '';
    const hostPeerId = resolveHostPeerIdForGrid(explicitHostPeerId, order);
    const numbered = hostPeerId.length > 0 ? order.filter((id) => id !== hostPeerId) : order;
    numbered.forEach((id, i) => {
        m.set(id, i + 1);
    });
    return m;
});
/**
 * Generic game-room call-host UI behaviour via `useGameRoomCallHostUi`.
 *
 * Owns the host-side handlers and the speaking-mode seat-highlight
 * computed, plus the generic tile-click router (swap + speaking branches
 * only — there is no night-action branch in the generic protocol).
 *
 * The OBS/host-claim flow, audio-mix host broadcast, and inbound
 * `gameroom:*` signaling live in `useGameRoomHostSignaling` and
 * `useGameRoomAudioMixSignaling`; this composable is strictly the
 * CallPage-level host-UI surface.
 */
const { isHostSpeakingNominationUiSeat, onToggleLifeFromTile, onForceCameraOffFromTile, onForceMuteAll, handleHostTileClick, } = useGameRoomCallHostUi({
    isGameRoomRoute,
    viewUi: gameRoomViewUi,
    selfPeerId,
    gameStore,
    seatNumberByPeer,
    sendSignalingMessage,
    pushCallToast,
    t,
});
// Local-tile speaking ring source. Moved up so it can be consumed by
// `useCallTileOrdering` below (which owns `isTileRowSpeaking`).
const localTileSpeakingForWrap = useLocalTileSpeakingVisual(() => localAudioSourceStream.value, () => true, () => micEnabled.value);
// Tile ordering + row shaping + speaking check — Block 26.
// `orderedTiles` precedence: `hostLastPolicy` (Game Template route, host
// pinned last + extras fold) → fallback (`tileOrder` + spotlight pin).
// `getSpotlightActive` is taken as a thunk so the composable can be
// wired BEFORE `useCallSpotlightLayout` (which consumes `orderedTiles`).
const { orderedTiles, orderedGridRows, isTileRowSpeaking } = useCallTileOrdering({
    tiles,
    tileOrder,
    pinnedPeerId,
    getSpotlightActive: () => spotlightDesktop.value,
    peerDisplayName,
    localTileSpeaking: localTileSpeakingForWrap,
    activeSpeakerPeerId,
    serverActiveSpeakerPeerId,
    hostLastPolicy: {
        isActive: isGameRoomRoute,
        getDisplayNumberingOrder: (o) => gameStore.getDisplayNumberingOrder(o),
        getExplicitHostPeerId: () => typeof gameStore.hostPeerId === 'string' ? gameStore.hostPeerId.trim() : '',
    },
});
const { spotlightDesktop, layoutMode, spotlightPeerId, spotlightStripPeerIds, spotlightOverflowCount, spotlightOverflowTileStyle, spotlightStripSlotForPeer, isSpotlightStripPeerHidden, togglePin, } = useCallSpotlightLayout({ orderedTiles, pinnedPeerId });
const stageRef = ref(null);
const gridRef = ref(null);
const { stageSize, setTileWrapRef, getGrid } = useCallTileLayoutFlip({
    stageRef,
    gridRef,
    orderedTiles,
    layoutMode,
    spotlightPeerId,
    dragPeerId,
});
// Auth-load IIFE + ?callDebug parse + DEV-only __CALL_DEBUG__ global —
// Block 28. Page-owned `callAuthReady` is mutated by the composable.
useCallPageBootstrap({
    session,
    user,
    ensureAuthLoaded,
    stageSize,
    orderedTiles,
    callAuthReady,
});
if (import.meta.env.DEV) {
    watch(() => {
        const n = orderedTiles.value.length;
        if (!n) {
            return null;
        }
        const { cols, rows, tileWidth, tileHeight } = getGrid(n, stageSize.value.width, stageSize.value.height);
        return { n, cols, rows, tileWidth, tileHeight };
    }, (v) => {
        if (!v) {
            return;
        }
        if (v.n > 1 && v.cols === 1) {
            callPageLog.debug('call grid: unexpected single column layout', {
                ...v,
                stageW: stageSize.value.width,
                stageH: stageSize.value.height,
            });
        }
    }, { flush: 'post' });
}
// `orderedGridRows` + `isTileRowSpeaking` are part of `useCallTileOrdering`
// (Block 26). The single-source-of-truth speaking-ring rule (local tile
// via `useLocalTileSpeakingVisual`, remote tiles via `activeSpeakerPeerId`
// + `serverActiveSpeakerPeerId`) is preserved verbatim inside the composable.
function resumeCallAudioAnalysisFromGesture() {
    void getAudioAnalysisAudioContext().resume().catch(() => { });
}
/**
 * Tile-click router for `/app/game-template`. Delegates to
 * `useGameRoomCallHostUi.handleHostTileClick`, which owns the swap +
 * speaking branches. There is no other host-interaction mode on the
 * generic protocol.
 */
function onGameRoomHostTileClick(ev, row) {
    handleHostTileClick(ev, row);
}
function refreshGameRoomPlayersState() {
    if (!isGameRoomRoute.value) {
        playersStore.clearPlayerRowsForUi();
        // Phase 3C: the original Mafia branch also pruned `playerOverlayStateByPeerId`
        // for Eat First rooms — that bridge belonged to the Mafia store and has
        // no equivalent on the generic `useGameTemplateGameStore`. When the route
        // is not game-template we simply clear our own state.
        gameStore.clearWhenLeavingGameRoomRoute();
        return;
    }
    if (gameStore.isApplyingGameRoomReshuffle) {
        const engine = tileOrder.value;
        const order = gameStore.getDisplayNumberingOrder(engine);
        const explicitHostPeerId = typeof gameStore.hostPeerId === 'string' ? gameStore.hostPeerId.trim() : '';
        const hostPeerId = explicitHostPeerId.length > 0
            ? explicitHostPeerId
            : order.length > 0
                ? order[order.length - 1] ?? ''
                : '';
        const playersOnly = hostPeerId.length > 0 ? order.filter((peerId) => peerId !== hostPeerId) : order;
        playersStore.setPlayerRowsDisplay(playersOnly.map((peerId, i) => ({
            peerId,
            number: i + 1,
            displayName: peerDisplayName(peerId),
        })));
        return;
    }
    playersStore.syncWithPeers(session.roomId, tiles.value.map((t) => t.peerId));
    const engine = tileOrder.value;
    gameStore.reconcileNumberingWithEngine(engine);
    gameStore.pruneGameStateToPeers(engine);
    const order = gameStore.getDisplayNumberingOrder(engine);
    const explicitHostPeerId = typeof gameStore.hostPeerId === 'string' ? gameStore.hostPeerId.trim() : '';
    const hostPeerId = explicitHostPeerId.length > 0
        ? explicitHostPeerId
        : order.length > 0
            ? order[order.length - 1] ?? ''
            : '';
    const seatCount = hostPeerId.length > 0 && order.includes(hostPeerId) ? order.length - 1 : order.length;
    // Phase 3C: `pruneNightActionsToMaxSeat` was Mafia-only (night-action
    // role grid) — dropped because the generic protocol has no roles.
    if (gameStore.isGameRoomHost) {
        gameStore.pruneSpeakingQueueToMaxSeat(seatCount);
    }
    const playersOnly = hostPeerId.length > 0 ? order.filter((peerId) => peerId !== hostPeerId) : order;
    playersStore.setPlayerRowsDisplay(playersOnly.map((peerId, i) => ({
        peerId,
        number: i + 1,
        displayName: peerDisplayName(peerId),
    })));
}
/**
 * Stable scalar key for `refreshGameRoomPlayersState`. Replaces the previous
 * `deep: true` watcher over `[tiles, orderedGridRows, speakingQueue]` which
 * fired on every audio-level / tile-reorder / speaker-change tick (3-5/s
 * in active discussion at 8-12 cameras) and re-ran the full reconcile pass
 * even when no peer-set / numbering / queue change had actually occurred.
 *
 * `refreshGameRoomPlayersState` only consumes:
 *   - peerIds from `tiles.value` (set membership)
 *   - `gameStore.numberingKey` (engine ordering)
 *   - `gameStore.speakingQueue` (length / contents)
 *   - `isApplyingGameRoomReshuffle` (branch selector)
 *
 * The function itself is idempotent so an extra run on an unrelated state
 * change would only waste CPU, not produce a wrong result.
 */
const playersWatcherKey = computed(() => {
    if (!isGameRoomRoute.value) {
        return `off|${session.roomId}`;
    }
    const peerIds = [];
    for (const t of tiles.value) {
        peerIds.push(t.peerId);
    }
    const queue = gameStore.speakingQueue.join(',');
    return [
        'on',
        session.roomId,
        peerIds.join('|'),
        gameStore.numberingKey,
        queue,
        gameStore.isApplyingGameRoomReshuffle ? '1' : '0',
    ].join('::');
});
watch(playersWatcherKey, () => {
    void refreshGameRoomPlayersState();
}, { immediate: true });
const gridStyle = computed(() => {
    const n = orderedTiles.value.length;
    if (!n) {
        return {};
    }
    if (layoutMode.value === 'spotlight') {
        const hasStrip = spotlightStripPeerIds.value.length > 0;
        return {
            display: 'grid',
            gridTemplateColumns: hasStrip ? 'minmax(0, 1fr) clamp(8.5rem, 18vw, 13rem)' : 'minmax(0, 1fr)',
            gridTemplateRows: hasStrip ? `repeat(${SPOTLIGHT_STRIP_VISIBLE_LIMIT}, minmax(0, 1fr))` : 'minmax(0, 1fr)',
            gap: `${GAP}px`,
            justifyContent: 'stretch',
            alignContent: 'stretch',
        };
    }
    const { cols, rows, tileWidth, tileHeight } = getGrid(n, stageSize.value.width, stageSize.value.height);
    return {
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, ${tileWidth}px)`,
        gridTemplateRows: `repeat(${rows}, ${tileHeight}px)`,
        gap: `${GAP}px`,
        justifyContent: 'center',
        alignContent: 'center',
    };
});
function tileLayoutStyle(row) {
    if (layoutMode.value !== 'spotlight') {
        return {};
    }
    const main = spotlightPeerId.value;
    if (main == null || row.tile.peerId === main) {
        return {};
    }
    return {
        '--call-page-spotlight-slot': String(spotlightStripSlotForPeer(row.tile.peerId)),
    };
}
const stageFullBleed = computed(() => session.inCall && tiles.value.some((t) => t.videoEnabled));
function isTileControlDragTarget(target) {
    if (!(target instanceof Element)) {
        return false;
    }
    return Boolean(target.closest('button,input,select,textarea,label,.tile-menu-cluster,.tile-menu-hoverable,.tile-menu__dropdown,.tile-remote-volume,.tile-remote-volume__dropdown'));
}
function onTilePointerDownForDrag(e) {
    tileDragStartedFromControls.value = isTileControlDragTarget(e.target);
}
function onTileDragStart(e, peerId) {
    if (tileDragStartedFromControls.value || isTileControlDragTarget(e.target)) {
        e.preventDefault();
        dragPeerId.value = null;
        dragOverPeerId.value = null;
        return;
    }
    dragPeerId.value = peerId;
    e.dataTransfer?.setData('text/plain', peerId);
    if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
    }
}
function onTileDragOver(e, peerId) {
    e.preventDefault();
    if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
    }
    dragOverPeerId.value = peerId;
}
function onTileDragLeave(peerId) {
    if (dragOverPeerId.value === peerId) {
        dragOverPeerId.value = null;
    }
}
function onTileDrop(peerId) {
    const from = dragPeerId.value;
    dragPeerId.value = null;
    dragOverPeerId.value = null;
    if (!from || from === peerId) {
        return;
    }
    const order = [...tileOrder.value];
    const fi = order.indexOf(from);
    const ti = order.indexOf(peerId);
    if (fi === -1 || ti === -1) {
        return;
    }
    order.splice(fi, 1);
    order.splice(ti, 0, from);
    tileOrder.value = order;
}
function onTileDragEnd() {
    dragPeerId.value = null;
    dragOverPeerId.value = null;
    tileDragStartedFromControls.value = false;
}
onBeforeUnmount(() => {
    // matchMedia teardown + FLIP RAF/timer cleanup are owned by
    // `useCallSpotlightLayout` and `useCallTileLayoutFlip` (Block 23).
    // Full-power timer + flag reset → `useFullPowerMode` (Block 24).
    // Remote-tile suppression-delay timers + suppressed map reset →
    //   `useRemoteTileBudget` onBeforeUnmount (Block 24).
    // Media-debug probe + global detach → `useCallMediaDebugTaps` onUnmounted (Block 24).
    // Room copy-flash timer cleanup → `useCallRoomCodeChip` onBeforeUnmount (Block 25).
    remotePlaybackWaitingPeerIds.value = new Set();
    // The "speaking order" hint timer is owned by `useGameRoomSpeakingHint`
    // (inside `GameTemplateCallAdapter`); the composable's own
    // `onBeforeUnmount` clears it. Do not reach for the timer ref from
    // here — it lives in the adapter, not in this file.
    callRoomHeaderJoin.reset();
    playersStore.reset();
    gameStore.fullReset();
    // Leaving /call must teardown media; otherwise Pinia session stays inCall.
    leaveCall();
});
onMounted(() => {
    // The spotlight matchMedia listener is owned by `useCallSpotlightLayout`
    // (Block 23). The `pointerdown` outside-click closer for media pickers
    // is owned by `useCallDevicePickers` (Block 24).
    // Auth-load IIFE, `?callDebug` URL parse, and DEV-only `__CALL_DEBUG__`
    // global are owned by `useCallPageBootstrap` (Block 28).
    // Timer-drift / rAF probes, `setMediaDebugEnvInfo`, and the optional
    // `installMediaDebugGlobal` install are owned by `useCallMediaDebugTaps`
    // (Block 24); see the composable call earlier in this script.
    // OBS / Settings toast event listeners are owned by
    // `useCallToastEventListeners` (Block 27).
    window.addEventListener('resize', syncChatPanelToViewport);
});
onUnmounted(() => {
    window.removeEventListener('resize', syncChatPanelToViewport);
    stopChatPanelGesture();
    // `pointerdown` listener teardown → `useCallDevicePickers`.
    // `setPeerVisibleHideTimerByPeer` + `lastSentPeerVisibleByPeer` cleanup
    //   → `useRemoteTileBudget` onUnmounted.
    // Media debug probe + global detach → `useCallMediaDebugTaps` onUnmounted.
    // `sa-call-route` <html> class teardown → `useCallRouteHtmlClass` (Block 27).
    // OBS / Settings event listener teardown → `useCallToastEventListeners` (Block 27).
    // DEV-only `__CALL_DEBUG__` teardown → `useCallPageBootstrap` (Block 28).
});
watch(() => session.inCall, (inCall) => {
    if (inCall) {
        void refreshMediaDevices();
    }
    else {
        closeMediaDevicePickers();
    }
});
watch(joining, (j) => {
    if (j) {
        callRoomHeaderJoin.closeRoomPopover();
    }
});
const __VLS_defaults = { gameRoomStreamView: false };
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "page-route" },
});
/** @type {__VLS_StyleScopedClasses['page-route']} */ ;
const __VLS_0 = AppFullPageLoader;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    visible: (__VLS_ctx.joining),
    'aria-label': (__VLS_ctx.t('callPage.joining')),
    label: "",
}));
const __VLS_2 = __VLS_1({
    visible: (__VLS_ctx.joining),
    'aria-label': (__VLS_ctx.t('callPage.joining')),
    label: "",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
if (__VLS_ctx.mediaDebugPanelEnabled) {
    const __VLS_5 = MediaDiagnosticsPanel;
    // @ts-ignore
    const __VLS_6 = __VLS_asFunctionalComponent1(__VLS_5, new __VLS_5({}));
    const __VLS_7 = __VLS_6({}, ...__VLS_functionalComponentArgsRest(__VLS_6));
}
const __VLS_10 = CallRoomPopover;
// @ts-ignore
const __VLS_11 = __VLS_asFunctionalComponent1(__VLS_10, new __VLS_10({
    ...{ 'onSubmitRoom': {} },
    ...{ 'onCopyRoom': {} },
    ...{ 'onGenerateRoom': {} },
    displayName: (__VLS_ctx.session.selfDisplayName),
    roomJoinDraft: (__VLS_ctx.roomJoinDraft),
    videoQualityChoice: (__VLS_ctx.videoQualityChoice),
    callDebugOverlay: (__VLS_ctx.callDebugOverlay),
    open: (__VLS_ctx.callRoomHeaderJoin.roomPopoverOpen),
    roomCopyFlash: (__VLS_ctx.roomCopyFlash),
    joining: (__VLS_ctx.joining),
    allowManualVideoQuality: (__VLS_ctx.allowManualVideoQuality),
    showCallDebugControls: (__VLS_ctx.showCallDebugControls),
    isAdmin: (__VLS_ctx.isAdmin),
    wsStatus: (__VLS_ctx.wsStatus),
    qualityPresets: (__VLS_ctx.qualityPresets),
}));
const __VLS_12 = __VLS_11({
    ...{ 'onSubmitRoom': {} },
    ...{ 'onCopyRoom': {} },
    ...{ 'onGenerateRoom': {} },
    displayName: (__VLS_ctx.session.selfDisplayName),
    roomJoinDraft: (__VLS_ctx.roomJoinDraft),
    videoQualityChoice: (__VLS_ctx.videoQualityChoice),
    callDebugOverlay: (__VLS_ctx.callDebugOverlay),
    open: (__VLS_ctx.callRoomHeaderJoin.roomPopoverOpen),
    roomCopyFlash: (__VLS_ctx.roomCopyFlash),
    joining: (__VLS_ctx.joining),
    allowManualVideoQuality: (__VLS_ctx.allowManualVideoQuality),
    showCallDebugControls: (__VLS_ctx.showCallDebugControls),
    isAdmin: (__VLS_ctx.isAdmin),
    wsStatus: (__VLS_ctx.wsStatus),
    qualityPresets: (__VLS_ctx.qualityPresets),
}, ...__VLS_functionalComponentArgsRest(__VLS_11));
let __VLS_15;
const __VLS_16 = ({ submitRoom: {} },
    { onSubmitRoom: (__VLS_ctx.submitRoomDraft) });
const __VLS_17 = ({ copyRoom: {} },
    { onCopyRoom: (__VLS_ctx.copyRoomToClipboard) });
const __VLS_18 = ({ generateRoom: {} },
    { onGenerateRoom: (__VLS_ctx.onGenerateNewRoom) });
var __VLS_13;
var __VLS_14;
const __VLS_19 = AppContainer || AppContainer;
// @ts-ignore
const __VLS_20 = __VLS_asFunctionalComponent1(__VLS_19, new __VLS_19({
    ...{ class: "call-page" },
    ...{ class: ({ 'call-page--stage-full': __VLS_ctx.stageFullBleed }) },
    flush: (true),
}));
const __VLS_21 = __VLS_20({
    ...{ class: "call-page" },
    ...{ class: ({ 'call-page--stage-full': __VLS_ctx.stageFullBleed }) },
    flush: (true),
}, ...__VLS_functionalComponentArgsRest(__VLS_20));
/** @type {__VLS_StyleScopedClasses['call-page']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page--stage-full']} */ ;
const { default: __VLS_24 } = __VLS_22.slots;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "call-page__shell" },
});
/** @type {__VLS_StyleScopedClasses['call-page__shell']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "call-page__active" },
    ...{ class: ({
            'call-page__active--with-dock': (__VLS_ctx.session.inCall || __VLS_ctx.joining) && !__VLS_ctx.gameRoomViewUi,
            'call-page__active--with-mafia-bottom': __VLS_ctx.isGameRoomRoute && (__VLS_ctx.session.inCall || __VLS_ctx.joining) && !__VLS_ctx.gameRoomViewUi,
        }) },
});
/** @type {__VLS_StyleScopedClasses['call-page__active']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__active--with-dock']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__active--with-mafia-bottom']} */ ;
if (__VLS_ctx.joinError && !__VLS_ctx.joining) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "call-page__join-error" },
        role: "alert",
    });
    /** @type {__VLS_StyleScopedClasses['call-page__join-error']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "call-page__join-error-text" },
    });
    /** @type {__VLS_StyleScopedClasses['call-page__join-error-text']} */ ;
    (__VLS_ctx.joinError);
    const __VLS_25 = AppButton || AppButton;
    // @ts-ignore
    const __VLS_26 = __VLS_asFunctionalComponent1(__VLS_25, new __VLS_25({
        ...{ 'onClick': {} },
        variant: "primary",
    }));
    const __VLS_27 = __VLS_26({
        ...{ 'onClick': {} },
        variant: "primary",
    }, ...__VLS_functionalComponentArgsRest(__VLS_26));
    let __VLS_30;
    const __VLS_31 = ({ click: {} },
        { onClick: (__VLS_ctx.retryJoinCall) });
    const { default: __VLS_32 } = __VLS_28.slots;
    (__VLS_ctx.t('callPage.retryJoin'));
    // @ts-ignore
    [joining, joining, joining, joining, joining, t, t, mediaDebugPanelEnabled, session, session, session, roomJoinDraft, videoQualityChoice, callDebugOverlay, callRoomHeaderJoin, roomCopyFlash, allowManualVideoQuality, showCallDebugControls, isAdmin, wsStatus, qualityPresets, submitRoomDraft, copyRoomToClipboard, onGenerateNewRoom, stageFullBleed, gameRoomViewUi, gameRoomViewUi, isGameRoomRoute, joinError, joinError, retryJoinCall,];
    var __VLS_28;
    var __VLS_29;
}
const __VLS_33 = GameRoomCallPresenceToastsPanel;
// @ts-ignore
const __VLS_34 = __VLS_asFunctionalComponent1(__VLS_33, new __VLS_33({
    toasts: (__VLS_ctx.callToasts),
}));
const __VLS_35 = __VLS_34({
    toasts: (__VLS_ctx.callToasts),
}, ...__VLS_functionalComponentArgsRest(__VLS_34));
if (__VLS_ctx.session.inCall && !__VLS_ctx.gameRoomViewUi && __VLS_ctx.callChatInboundToasts.length > 0) {
    const __VLS_38 = GameRoomCallChatInboundToastsPanel;
    // @ts-ignore
    const __VLS_39 = __VLS_asFunctionalComponent1(__VLS_38, new __VLS_38({
        ...{ 'onOpen': {} },
        ...{ 'onDismiss': {} },
        toasts: (__VLS_ctx.callChatInboundToasts),
    }));
    const __VLS_40 = __VLS_39({
        ...{ 'onOpen': {} },
        ...{ 'onDismiss': {} },
        toasts: (__VLS_ctx.callChatInboundToasts),
    }, ...__VLS_functionalComponentArgsRest(__VLS_39));
    let __VLS_43;
    const __VLS_44 = ({ open: {} },
        { onOpen: (__VLS_ctx.openChatFromInboundToast) });
    const __VLS_45 = ({ dismiss: {} },
        { onDismiss: (__VLS_ctx.dismissCallChatInboundToast) });
    var __VLS_41;
    var __VLS_42;
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onPointerdown: (__VLS_ctx.resumeCallAudioAnalysisFromGesture) },
    ref: "stageRef",
    ...{ class: "call-page__stage" },
});
/** @type {__VLS_StyleScopedClasses['call-page__stage']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "gridRef",
    ...{ class: "call-page__grid" },
    ...{ class: ({ 'call-page__grid--spotlight': __VLS_ctx.layoutMode === 'spotlight' }) },
    ...{ style: (__VLS_ctx.gridStyle) },
});
/** @type {__VLS_StyleScopedClasses['call-page__grid']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__grid--spotlight']} */ ;
for (const [row] of __VLS_vFor((__VLS_ctx.orderedGridRows))) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ onPointerdown: (__VLS_ctx.onTilePointerDownForDrag) },
        ...{ onClick: (...[$event]) => {
                __VLS_ctx.onGameRoomHostTileClick($event, row);
                // @ts-ignore
                [session, gameRoomViewUi, callToasts, callChatInboundToasts, callChatInboundToasts, openChatFromInboundToast, dismissCallChatInboundToast, resumeCallAudioAnalysisFromGesture, layoutMode, gridStyle, orderedGridRows, onTilePointerDownForDrag, onGameRoomHostTileClick,];
            } },
        ...{ onDragstart: (...[$event]) => {
                __VLS_ctx.onTileDragStart($event, row.tile.peerId);
                // @ts-ignore
                [onTileDragStart,];
            } },
        ...{ onDragover: (...[$event]) => {
                __VLS_ctx.onTileDragOver($event, row.tile.peerId);
                // @ts-ignore
                [onTileDragOver,];
            } },
        ...{ onDragleave: (...[$event]) => {
                __VLS_ctx.onTileDragLeave(row.tile.peerId);
                // @ts-ignore
                [onTileDragLeave,];
            } },
        ...{ onDrop: (...[$event]) => {
                __VLS_ctx.onTileDrop(row.tile.peerId);
                // @ts-ignore
                [onTileDrop,];
            } },
        ...{ onDragend: (__VLS_ctx.onTileDragEnd) },
        key: (row.tile.peerId),
        ref: ((el) => __VLS_ctx.setTileWrapRef(row.tile.peerId, el)),
        ...{ class: "call-page__tile-wrap" },
        ...{ style: (__VLS_ctx.tileLayoutStyle(row)) },
        draggable: (__VLS_ctx.canReorderTiles),
        title: (__VLS_ctx.canReorderTiles ? __VLS_ctx.t('callPage.dragReorder') : undefined),
        'aria-label': (__VLS_ctx.canReorderTiles ? __VLS_ctx.t('callPage.dragReorder') : undefined),
        ...{ class: ({
                'call-page__tile-wrap--spotlight-main': __VLS_ctx.layoutMode === 'spotlight' && row.tile.peerId === __VLS_ctx.spotlightPeerId,
                'call-page__tile-wrap--spotlight-strip': __VLS_ctx.layoutMode === 'spotlight' && row.tile.peerId !== __VLS_ctx.spotlightPeerId,
                'call-page__tile-wrap--spotlight-hidden': __VLS_ctx.isSpotlightStripPeerHidden(row.tile.peerId),
                'call-page__tile-wrap--pinned': __VLS_ctx.pinnedPeerId === row.tile.peerId,
                'call-page__tile-wrap--over': __VLS_ctx.dragOverPeerId === row.tile.peerId,
                'call-page__tile-wrap--dragging': __VLS_ctx.dragPeerId === row.tile.peerId,
                // Phase 3C: Mafia night-action-target highlight removed
                // (no `'night'` interaction mode in the generic protocol).
                'call-page__tile-wrap--mafia-host-speaking-queued': __VLS_ctx.isGameRoomRoute &&
                    __VLS_ctx.isHostSpeakingNominationUiSeat(__VLS_ctx.seatNumberByPeer.get(row.tile.peerId)),
                'call-page__tile-wrap--mafia-host-mode': __VLS_ctx.isGameRoomRoute && !__VLS_ctx.gameRoomViewUi && __VLS_ctx.gameStore.isGameRoomHost,
                'call-page__tile-wrap--mafia-host-mode-speaking': __VLS_ctx.isGameRoomRoute &&
                    !__VLS_ctx.gameRoomViewUi &&
                    __VLS_ctx.gameStore.isGameRoomHost &&
                    __VLS_ctx.gameStore.hostInteractionMode === 'speaking',
                'call-page__tile-wrap--mafia-host-mode-swap': __VLS_ctx.isGameRoomRoute &&
                    !__VLS_ctx.gameRoomViewUi &&
                    __VLS_ctx.gameStore.isGameRoomHost &&
                    __VLS_ctx.gameStore.hostInteractionMode === 'swap',
                'call-page__tile-wrap--mafia-swap-selected': __VLS_ctx.isGameRoomRoute &&
                    !__VLS_ctx.gameRoomViewUi &&
                    __VLS_ctx.gameStore.isGameRoomHost &&
                    __VLS_ctx.gameStore.hostInteractionMode === 'swap' &&
                    __VLS_ctx.gameStore.hostSeatSwapSelectionPeerId === row.tile.peerId,
                'call-page__tile-wrap--mafia-cursor-default': __VLS_ctx.isGameRoomRoute && (__VLS_ctx.gameRoomViewUi || !__VLS_ctx.gameStore.isGameRoomHost),
                'call-page__tile-wrap--speaking': __VLS_ctx.isTileRowSpeaking(row),
            }) },
    });
    /** @type {__VLS_StyleScopedClasses['call-page__tile-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['call-page__tile-wrap--spotlight-main']} */ ;
    /** @type {__VLS_StyleScopedClasses['call-page__tile-wrap--spotlight-strip']} */ ;
    /** @type {__VLS_StyleScopedClasses['call-page__tile-wrap--spotlight-hidden']} */ ;
    /** @type {__VLS_StyleScopedClasses['call-page__tile-wrap--pinned']} */ ;
    /** @type {__VLS_StyleScopedClasses['call-page__tile-wrap--over']} */ ;
    /** @type {__VLS_StyleScopedClasses['call-page__tile-wrap--dragging']} */ ;
    /** @type {__VLS_StyleScopedClasses['call-page__tile-wrap--mafia-host-speaking-queued']} */ ;
    /** @type {__VLS_StyleScopedClasses['call-page__tile-wrap--mafia-host-mode']} */ ;
    /** @type {__VLS_StyleScopedClasses['call-page__tile-wrap--mafia-host-mode-speaking']} */ ;
    /** @type {__VLS_StyleScopedClasses['call-page__tile-wrap--mafia-host-mode-swap']} */ ;
    /** @type {__VLS_StyleScopedClasses['call-page__tile-wrap--mafia-swap-selected']} */ ;
    /** @type {__VLS_StyleScopedClasses['call-page__tile-wrap--mafia-cursor-default']} */ ;
    /** @type {__VLS_StyleScopedClasses['call-page__tile-wrap--speaking']} */ ;
    const __VLS_46 = ParticipantTile;
    // @ts-ignore
    const __VLS_47 = __VLS_asFunctionalComponent1(__VLS_46, new __VLS_46({
        ...{ 'onUpdate:listenVolume': {} },
        ...{ 'onUpdate:listenMuted': {} },
        ...{ 'onCommitLocalDisplayName': {} },
        ...{ 'onGameToggleLife': {} },
        ...{ 'onGameForceCameraOff': {} },
        ...{ 'onGameViewportLayers': {} },
        ...{ 'onRemotePlaybackStall': {} },
        ...{ 'onVideoStall': {} },
        ...{ 'onAudioStall': {} },
        ...{ class: "call-page__tile-inner" },
        peerId: (row.tile.peerId),
        displayName: (row.displayName),
        avatarFallbackName: (__VLS_ctx.peerAvatarFallbackName(row.tile.peerId)),
        canEditDisplayName: (__VLS_ctx.canEditTileDisplayName(row.tile.peerId)),
        gameSeatIndex: (__VLS_ctx.isGameRoomRoute ? __VLS_ctx.seatNumberByPeer.get(row.tile.peerId) : undefined),
        gameVisibleRole: (undefined),
        streamViewMode: (__VLS_ctx.gameRoomViewUi),
        stream: (row.tile.stream),
        isLocal: (row.tile.isLocal),
        videoEnabled: (row.tile.videoEnabled),
        audioEnabled: (row.tile.audioEnabled),
        videoFillCover: (false),
        playRev: (row.tile.playRev),
        sizeTier: (__VLS_ctx.sizeTier),
        rowSpeaking: (__VLS_ctx.isTileRowSpeaking(row)),
        remoteListenVolume: (row.tile.remoteListenVolume),
        remoteListenMuted: (row.tile.remoteListenMuted),
        raiseHand: (Boolean(row.tile.handRaised)),
        videoPresentation: (row.tile.videoPresentation),
        avatarUrl: (row.tile.avatarUrl ?? ''),
        gameLifeState: (__VLS_ctx.isGameRoomRoute ? __VLS_ctx.gameStore.lifeStateForPeer(row.tile.peerId) : 'alive'),
        gameEliminationKind: (undefined),
        gameEliminationBackground: (undefined),
        gameDeadBackgroundUrl: (null),
        gameHostShowLifeToggle: (__VLS_ctx.isGameRoomRoute && !__VLS_ctx.gameRoomViewUi && __VLS_ctx.gameStore.isGameRoomHost),
        gameLayerViewportObserve: (__VLS_ctx.isCallAppRoute && !row.tile.isLocal),
        videoPlaybackSuppressed: (!row.tile.isLocal && __VLS_ctx.videoPlaybackSuppressedForPeer(row.tile.peerId)),
        videoTargetPlaybackFps: (__VLS_ctx.remoteVideoTargetPlaybackFpsForPeer(row.tile.peerId)),
    }));
    const __VLS_48 = __VLS_47({
        ...{ 'onUpdate:listenVolume': {} },
        ...{ 'onUpdate:listenMuted': {} },
        ...{ 'onCommitLocalDisplayName': {} },
        ...{ 'onGameToggleLife': {} },
        ...{ 'onGameForceCameraOff': {} },
        ...{ 'onGameViewportLayers': {} },
        ...{ 'onRemotePlaybackStall': {} },
        ...{ 'onVideoStall': {} },
        ...{ 'onAudioStall': {} },
        ...{ class: "call-page__tile-inner" },
        peerId: (row.tile.peerId),
        displayName: (row.displayName),
        avatarFallbackName: (__VLS_ctx.peerAvatarFallbackName(row.tile.peerId)),
        canEditDisplayName: (__VLS_ctx.canEditTileDisplayName(row.tile.peerId)),
        gameSeatIndex: (__VLS_ctx.isGameRoomRoute ? __VLS_ctx.seatNumberByPeer.get(row.tile.peerId) : undefined),
        gameVisibleRole: (undefined),
        streamViewMode: (__VLS_ctx.gameRoomViewUi),
        stream: (row.tile.stream),
        isLocal: (row.tile.isLocal),
        videoEnabled: (row.tile.videoEnabled),
        audioEnabled: (row.tile.audioEnabled),
        videoFillCover: (false),
        playRev: (row.tile.playRev),
        sizeTier: (__VLS_ctx.sizeTier),
        rowSpeaking: (__VLS_ctx.isTileRowSpeaking(row)),
        remoteListenVolume: (row.tile.remoteListenVolume),
        remoteListenMuted: (row.tile.remoteListenMuted),
        raiseHand: (Boolean(row.tile.handRaised)),
        videoPresentation: (row.tile.videoPresentation),
        avatarUrl: (row.tile.avatarUrl ?? ''),
        gameLifeState: (__VLS_ctx.isGameRoomRoute ? __VLS_ctx.gameStore.lifeStateForPeer(row.tile.peerId) : 'alive'),
        gameEliminationKind: (undefined),
        gameEliminationBackground: (undefined),
        gameDeadBackgroundUrl: (null),
        gameHostShowLifeToggle: (__VLS_ctx.isGameRoomRoute && !__VLS_ctx.gameRoomViewUi && __VLS_ctx.gameStore.isGameRoomHost),
        gameLayerViewportObserve: (__VLS_ctx.isCallAppRoute && !row.tile.isLocal),
        videoPlaybackSuppressed: (!row.tile.isLocal && __VLS_ctx.videoPlaybackSuppressedForPeer(row.tile.peerId)),
        videoTargetPlaybackFps: (__VLS_ctx.remoteVideoTargetPlaybackFpsForPeer(row.tile.peerId)),
    }, ...__VLS_functionalComponentArgsRest(__VLS_47));
    let __VLS_51;
    const __VLS_52 = ({ 'update:listenVolume': {} },
        { 'onUpdate:listenVolume': ((v) => __VLS_ctx.remoteListenVolumeHandler(row.tile.peerId)(v)) });
    const __VLS_53 = ({ 'update:listenMuted': {} },
        { 'onUpdate:listenMuted': ((v) => __VLS_ctx.remoteListenMutedHandler(row.tile.peerId)(v)) });
    const __VLS_54 = ({ commitLocalDisplayName: {} },
        { onCommitLocalDisplayName: (__VLS_ctx.onCommitLocalTileDisplayName) });
    const __VLS_55 = ({ gameToggleLife: {} },
        { onGameToggleLife: (...[$event]) => {
                __VLS_ctx.onToggleLifeFromTile(row.tile.peerId);
                // @ts-ignore
                [t, t, gameRoomViewUi, gameRoomViewUi, gameRoomViewUi, gameRoomViewUi, gameRoomViewUi, gameRoomViewUi, gameRoomViewUi, isGameRoomRoute, isGameRoomRoute, isGameRoomRoute, isGameRoomRoute, isGameRoomRoute, isGameRoomRoute, isGameRoomRoute, isGameRoomRoute, isGameRoomRoute, layoutMode, layoutMode, onTileDragEnd, setTileWrapRef, tileLayoutStyle, canReorderTiles, canReorderTiles, canReorderTiles, spotlightPeerId, spotlightPeerId, isSpotlightStripPeerHidden, pinnedPeerId, dragOverPeerId, dragPeerId, isHostSpeakingNominationUiSeat, seatNumberByPeer, seatNumberByPeer, gameStore, gameStore, gameStore, gameStore, gameStore, gameStore, gameStore, gameStore, gameStore, gameStore, gameStore, isTileRowSpeaking, isTileRowSpeaking, peerAvatarFallbackName, canEditTileDisplayName, sizeTier, isCallAppRoute, videoPlaybackSuppressedForPeer, remoteVideoTargetPlaybackFpsForPeer, remoteListenVolumeHandler, remoteListenMutedHandler, onCommitLocalTileDisplayName, onToggleLifeFromTile,];
            } });
    const __VLS_56 = ({ gameForceCameraOff: {} },
        { onGameForceCameraOff: (...[$event]) => {
                __VLS_ctx.onForceCameraOffFromTile(row.tile.peerId);
                // @ts-ignore
                [onForceCameraOffFromTile,];
            } });
    const __VLS_57 = ({ gameViewportLayers: {} },
        { onGameViewportLayers: ((v) => __VLS_ctx.onCallTileViewportForLayers(row.tile.peerId, v)) });
    const __VLS_58 = ({ remotePlaybackStall: {} },
        { onRemotePlaybackStall: (__VLS_ctx.onRemotePlaybackStall) });
    const __VLS_59 = ({ videoStall: {} },
        { onVideoStall: (__VLS_ctx.onTileVideoStall) });
    const __VLS_60 = ({ audioStall: {} },
        { onAudioStall: (__VLS_ctx.onTileAudioStall) });
    /** @type {__VLS_StyleScopedClasses['call-page__tile-inner']} */ ;
    var __VLS_49;
    var __VLS_50;
    if (!__VLS_ctx.gameRoomViewUi) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(!__VLS_ctx.gameRoomViewUi))
                        return;
                    __VLS_ctx.togglePin(row.tile.peerId);
                    // @ts-ignore
                    [gameRoomViewUi, onCallTileViewportForLayers, onRemotePlaybackStall, onTileVideoStall, onTileAudioStall, togglePin,];
                } },
            type: "button",
            ...{ class: "call-page__pin-btn" },
            ...{ class: ({ 'call-page__pin-btn--active': __VLS_ctx.pinnedPeerId === row.tile.peerId }) },
            title: (__VLS_ctx.pinnedPeerId === row.tile.peerId ? __VLS_ctx.t('callPage.unpinTile') : __VLS_ctx.t('callPage.pinTile')),
            'aria-label': (__VLS_ctx.pinnedPeerId === row.tile.peerId ? __VLS_ctx.t('callPage.unpinTile') : __VLS_ctx.t('callPage.pinTile')),
            'aria-pressed': (__VLS_ctx.pinnedPeerId === row.tile.peerId),
        });
        /** @type {__VLS_StyleScopedClasses['call-page__pin-btn']} */ ;
        /** @type {__VLS_StyleScopedClasses['call-page__pin-btn--active']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
            ...{ class: "call-page__pin-icon" },
            src: (__VLS_ctx.pinnedPeerId === row.tile.peerId ? __VLS_ctx.tilePinActiveIcon : __VLS_ctx.tilePinIcon),
            alt: "",
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['call-page__pin-icon']} */ ;
    }
    // @ts-ignore
    [t, t, t, t, pinnedPeerId, pinnedPeerId, pinnedPeerId, pinnedPeerId, pinnedPeerId, tilePinActiveIcon, tilePinIcon,];
}
if (__VLS_ctx.layoutMode === 'spotlight' && __VLS_ctx.spotlightOverflowCount > 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "call-page__tile-wrap call-page__tile-wrap--spotlight-strip call-page__tile-wrap--spotlight-overflow" },
        ...{ style: (__VLS_ctx.spotlightOverflowTileStyle) },
        'aria-hidden': "true",
    });
    /** @type {__VLS_StyleScopedClasses['call-page__tile-wrap']} */ ;
    /** @type {__VLS_StyleScopedClasses['call-page__tile-wrap--spotlight-strip']} */ ;
    /** @type {__VLS_StyleScopedClasses['call-page__tile-wrap--spotlight-overflow']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "call-page__spotlight-overflow-tile" },
    });
    /** @type {__VLS_StyleScopedClasses['call-page__spotlight-overflow-tile']} */ ;
    (__VLS_ctx.spotlightOverflowCount);
}
if ((__VLS_ctx.session.inCall || __VLS_ctx.joining) && !__VLS_ctx.gameRoomViewUi) {
    const __VLS_61 = GameRoomCallBottomCluster || GameRoomCallBottomCluster;
    // @ts-ignore
    const __VLS_62 = __VLS_asFunctionalComponent1(__VLS_61, new __VLS_61({}));
    const __VLS_63 = __VLS_62({}, ...__VLS_functionalComponentArgsRest(__VLS_62));
    const { default: __VLS_66 } = __VLS_64.slots;
    {
        const { 'host-actions': __VLS_67 } = __VLS_64.slots;
        if (__VLS_ctx.isGameRoomRoute && __VLS_ctx.gameStore.isGameRoomHost) {
            const __VLS_68 = GameTemplateHostActionsBar;
            // @ts-ignore
            const __VLS_69 = __VLS_asFunctionalComponent1(__VLS_68, new __VLS_68({
                ...{ 'onForceMuteAll': {} },
            }));
            const __VLS_70 = __VLS_69({
                ...{ 'onForceMuteAll': {} },
            }, ...__VLS_functionalComponentArgsRest(__VLS_69));
            let __VLS_73;
            const __VLS_74 = ({ forceMuteAll: {} },
                { onForceMuteAll: (__VLS_ctx.onForceMuteAll) });
            var __VLS_71;
            var __VLS_72;
        }
        // @ts-ignore
        [joining, session, gameRoomViewUi, isGameRoomRoute, layoutMode, gameStore, spotlightOverflowCount, spotlightOverflowCount, spotlightOverflowTileStyle, onForceMuteAll,];
    }
    {
        const { dock: __VLS_75 } = __VLS_64.slots;
        const __VLS_76 = CallControlsDock;
        // @ts-ignore
        const __VLS_77 = __VLS_asFunctionalComponent1(__VLS_76, new __VLS_76({
            ...{ 'onToggleMic': {} },
            ...{ 'onToggleCam': {} },
            ...{ 'onToggleDeafen': {} },
            ...{ 'onToggleRaiseHand': {} },
            ...{ 'onToggleScreenShare': {} },
            ...{ 'onLeave': {} },
            ...{ 'onPickAudioInput': {} },
            ...{ 'onPickVideoInput': {} },
            ...{ 'onPickAudioOutput': {} },
            ref: "callControlsDockRef",
            micPickerOpen: (__VLS_ctx.micPickerOpen),
            camPickerOpen: (__VLS_ctx.camPickerOpen),
            speakerPickerOpen: (__VLS_ctx.speakerPickerOpen),
            chatOpen: (__VLS_ctx.chatOpen),
            joining: (__VLS_ctx.joining),
            micEnabled: (__VLS_ctx.micEnabled),
            camEnabled: (__VLS_ctx.camEnabled),
            callDeafened: (__VLS_ctx.callDeafened),
            handRaised: (__VLS_ctx.handRaised),
            screenSharing: (__VLS_ctx.screenSharing),
            showMediaDevicePickers: (__VLS_ctx.showMediaDevicePickers),
            audioInputDevices: (__VLS_ctx.audioInputDevices),
            videoInputDevices: (__VLS_ctx.videoInputDevices),
            audioOutputDevices: (__VLS_ctx.audioOutputDevices),
            localAudioInputDeviceId: (__VLS_ctx.localAudioInputDeviceId),
            localVideoInputDeviceId: (__VLS_ctx.localVideoInputDeviceId),
            localAudioOutputDeviceId: (__VLS_ctx.localAudioOutputDeviceId),
        }));
        const __VLS_78 = __VLS_77({
            ...{ 'onToggleMic': {} },
            ...{ 'onToggleCam': {} },
            ...{ 'onToggleDeafen': {} },
            ...{ 'onToggleRaiseHand': {} },
            ...{ 'onToggleScreenShare': {} },
            ...{ 'onLeave': {} },
            ...{ 'onPickAudioInput': {} },
            ...{ 'onPickVideoInput': {} },
            ...{ 'onPickAudioOutput': {} },
            ref: "callControlsDockRef",
            micPickerOpen: (__VLS_ctx.micPickerOpen),
            camPickerOpen: (__VLS_ctx.camPickerOpen),
            speakerPickerOpen: (__VLS_ctx.speakerPickerOpen),
            chatOpen: (__VLS_ctx.chatOpen),
            joining: (__VLS_ctx.joining),
            micEnabled: (__VLS_ctx.micEnabled),
            camEnabled: (__VLS_ctx.camEnabled),
            callDeafened: (__VLS_ctx.callDeafened),
            handRaised: (__VLS_ctx.handRaised),
            screenSharing: (__VLS_ctx.screenSharing),
            showMediaDevicePickers: (__VLS_ctx.showMediaDevicePickers),
            audioInputDevices: (__VLS_ctx.audioInputDevices),
            videoInputDevices: (__VLS_ctx.videoInputDevices),
            audioOutputDevices: (__VLS_ctx.audioOutputDevices),
            localAudioInputDeviceId: (__VLS_ctx.localAudioInputDeviceId),
            localVideoInputDeviceId: (__VLS_ctx.localVideoInputDeviceId),
            localAudioOutputDeviceId: (__VLS_ctx.localAudioOutputDeviceId),
        }, ...__VLS_functionalComponentArgsRest(__VLS_77));
        let __VLS_81;
        const __VLS_82 = ({ toggleMic: {} },
            { onToggleMic: (__VLS_ctx.toggleMic) });
        const __VLS_83 = ({ toggleCam: {} },
            { onToggleCam: (__VLS_ctx.toggleCam) });
        const __VLS_84 = ({ toggleDeafen: {} },
            { onToggleDeafen: (__VLS_ctx.toggleCallDeafen) });
        const __VLS_85 = ({ toggleRaiseHand: {} },
            { onToggleRaiseHand: (__VLS_ctx.toggleRaiseHand) });
        const __VLS_86 = ({ toggleScreenShare: {} },
            { onToggleScreenShare: (__VLS_ctx.toggleScreenShare) });
        const __VLS_87 = ({ leave: {} },
            { onLeave: (__VLS_ctx.leaveCall) });
        const __VLS_88 = ({ pickAudioInput: {} },
            { onPickAudioInput: (__VLS_ctx.pickAudioInput) });
        const __VLS_89 = ({ pickVideoInput: {} },
            { onPickVideoInput: (__VLS_ctx.pickVideoInput) });
        const __VLS_90 = ({ pickAudioOutput: {} },
            { onPickAudioOutput: (__VLS_ctx.pickAudioOutput) });
        var __VLS_91 = {};
        var __VLS_79;
        var __VLS_80;
        // @ts-ignore
        [joining, micPickerOpen, camPickerOpen, speakerPickerOpen, chatOpen, micEnabled, camEnabled, callDeafened, handRaised, screenSharing, showMediaDevicePickers, audioInputDevices, videoInputDevices, audioOutputDevices, localAudioInputDeviceId, localVideoInputDeviceId, localAudioOutputDeviceId, toggleMic, toggleCam, toggleCallDeafen, toggleRaiseHand, toggleScreenShare, leaveCall, pickAudioInput, pickVideoInput, pickAudioOutput,];
    }
    {
        const { 'speaking-queue': __VLS_93 } = __VLS_64.slots;
        if (__VLS_ctx.isGameRoomRoute) {
            const __VLS_94 = GameTemplateSpeakingQueueBar;
            // @ts-ignore
            const __VLS_95 = __VLS_asFunctionalComponent1(__VLS_94, new __VLS_94({
                showTools: (__VLS_ctx.gameStore.isGameRoomHost),
            }));
            const __VLS_96 = __VLS_95({
                showTools: (__VLS_ctx.gameStore.isGameRoomHost),
            }, ...__VLS_functionalComponentArgsRest(__VLS_95));
        }
        // @ts-ignore
        [isGameRoomRoute, gameStore,];
    }
    // @ts-ignore
    [];
    var __VLS_64;
}
if ((__VLS_ctx.session.inCall || __VLS_ctx.joining) && __VLS_ctx.gameRoomViewUi && __VLS_ctx.isGameRoomRoute) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "call-page__mafia-view-bottom" },
    });
    /** @type {__VLS_StyleScopedClasses['call-page__mafia-view-bottom']} */ ;
    const __VLS_99 = GameTemplateSpeakingQueueBar;
    // @ts-ignore
    const __VLS_100 = __VLS_asFunctionalComponent1(__VLS_99, new __VLS_99({
        showTools: (false),
    }));
    const __VLS_101 = __VLS_100({
        showTools: (false),
    }, ...__VLS_functionalComponentArgsRest(__VLS_100));
}
if (__VLS_ctx.session.inCall && !__VLS_ctx.gameRoomViewUi) {
    const __VLS_104 = CallChatPanel;
    // @ts-ignore
    const __VLS_105 = __VLS_asFunctionalComponent1(__VLS_104, new __VLS_104({
        ...{ 'onSend': {} },
        ...{ 'onDragPointerDown': {} },
        ...{ 'onResizePointerDown': {} },
        open: (__VLS_ctx.chatOpen),
        messages: (__VLS_ctx.callChatMessages),
        selfPeerId: (__VLS_ctx.selfPeerId),
        panelClass: (__VLS_ctx.chatPanelClass),
        panelStyle: (__VLS_ctx.chatPanelStyle),
        displayNameForPeer: (__VLS_ctx.peerDisplayName),
    }));
    const __VLS_106 = __VLS_105({
        ...{ 'onSend': {} },
        ...{ 'onDragPointerDown': {} },
        ...{ 'onResizePointerDown': {} },
        open: (__VLS_ctx.chatOpen),
        messages: (__VLS_ctx.callChatMessages),
        selfPeerId: (__VLS_ctx.selfPeerId),
        panelClass: (__VLS_ctx.chatPanelClass),
        panelStyle: (__VLS_ctx.chatPanelStyle),
        displayNameForPeer: (__VLS_ctx.peerDisplayName),
    }, ...__VLS_functionalComponentArgsRest(__VLS_105));
    let __VLS_109;
    const __VLS_110 = ({ send: {} },
        { onSend: (__VLS_ctx.sendChatMessage) });
    const __VLS_111 = ({ dragPointerDown: {} },
        { onDragPointerDown: (__VLS_ctx.onChatPanelDragPointerDown) });
    const __VLS_112 = ({ resizePointerDown: {} },
        { onResizePointerDown: (__VLS_ctx.onChatPanelResizePointerDown) });
    var __VLS_107;
    var __VLS_108;
}
if (__VLS_ctx.session.callDebugOverlay && __VLS_ctx.showCallDebugControls && !__VLS_ctx.gameRoomViewUi) {
    const __VLS_113 = GameRoomCallDebugOverlay;
    // @ts-ignore
    const __VLS_114 = __VLS_asFunctionalComponent1(__VLS_113, new __VLS_113({
        ...{ 'onRefresh': {} },
        snapshot: (__VLS_ctx.callDebugSnapshot),
        inboundRows: (__VLS_ctx.inboundDebugRows),
        inboundBusy: (__VLS_ctx.inboundDebugBusy),
    }));
    const __VLS_115 = __VLS_114({
        ...{ 'onRefresh': {} },
        snapshot: (__VLS_ctx.callDebugSnapshot),
        inboundRows: (__VLS_ctx.inboundDebugRows),
        inboundBusy: (__VLS_ctx.inboundDebugBusy),
    }, ...__VLS_functionalComponentArgsRest(__VLS_114));
    let __VLS_118;
    const __VLS_119 = ({ refresh: {} },
        { onRefresh: (__VLS_ctx.refreshInboundDebug) });
    var __VLS_116;
    var __VLS_117;
}
// @ts-ignore
[joining, session, session, session, showCallDebugControls, gameRoomViewUi, gameRoomViewUi, gameRoomViewUi, isGameRoomRoute, chatOpen, callChatMessages, selfPeerId, chatPanelClass, chatPanelStyle, peerDisplayName, sendChatMessage, onChatPanelDragPointerDown, onChatPanelResizePointerDown, callDebugSnapshot, inboundDebugRows, inboundDebugBusy, refreshInboundDebug,];
var __VLS_22;
// @ts-ignore
var __VLS_92 = __VLS_91;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
