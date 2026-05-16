/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { storeToRefs } from 'pinia';
import { computed, onBeforeUnmount, onMounted, onUnmounted, ref, shallowRef, watch, } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { getAudioAnalysisAudioContext, normalizeDisplayName, useCallOrchestrator, VIDEO_QUALITY_PRESETS, } from 'call-core';
import { useLocalTileSpeakingVisual } from '@/composables/useLocalTileSpeakingVisual';
import { useAuth } from '@/composables/useAuth';
import { createLogger } from '@/utils/logger';
import { saveCallTileLocalDisplayOverrides } from '@/utils/callTileLocalDisplayNames';
import { resolveHostPeerIdForGrid, sortPeerIdsHostLast } from './callTileOrderRules';
const callPageLog = createLogger('call-page');
import ParticipantTile from './ParticipantTile.vue';
import MediaDiagnosticsPanel from './MediaDiagnosticsPanel.vue';
import { isMediaDebugEnabled } from '@/utils/mediaDebugRuntime';
import { useMediaStallRecovery } from './useMediaStallRecovery';
import CallRoomPopover from './CallRoomPopover.vue';
import CallControlsDock from './CallControlsDock.vue';
import CallChatPanel from './CallChatPanel.vue';
import { useCallChatPanel } from './useCallChatPanel';
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
import { buildHostLastOrderedTiles } from '@/composables/game-room/callTileOrdering';
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
import mafiaTilePinIcon from '@/assets/mafia/ui/tile-pin.svg';
import { generateCallRoomCode } from '@/utils/callRoomUi';
import { useCallRoomHeaderJoinStore } from '@/stores/callRoomHeaderJoin';
import { useMafiaHostSignaling } from '@/composables/useMafiaHostSignaling';
import { useMafiaCallHostUi } from '@/composables/useMafiaCallHostUi';
import { useEatFirstCallSignaling } from '@/composables/useEatFirstCallSignaling';
import { mafiaBaseRoomIdFromSignaling, mafiaSignalingRoomId, MAFIA_SIGNALING_ROOM_PREFIX, } from '@/composables/useMafiaMediaRoom';
import { eatFirstBaseRoomIdFromSignaling, eatFirstSignalingRoomId, EAT_FIRST_SIGNALING_ROOM_PREFIX, } from '@/eat-first/utils/eatFirstCallRoomId';
import MafiaSpeakingQueueBar from '@/components/mafia/MafiaSpeakingQueueBar.vue';
import MafiaHostActionsBar from '@/components/mafia/MafiaHostActionsBar.vue';
import EatFirstHostActionsBar from '@/eat-first/components/EatFirstHostActionsBar.vue';
import EatFirstSpeakingQueueBar from '@/eat-first/components/EatFirstSpeakingQueueBar.vue';
import { useEatFirstCallShellStore } from '@/stores/eatFirstCallShell';
import { EatFirstWs } from '@/eat-first/eatFirstWsProtocol';
import { getActiveEatFirstSlotForSession, pickPrimaryEatFirstJoinTokenForGame, } from '@/eat-first/utils/joinTokenStore.js';
import { getOrCreateDeviceId } from '@/eat-first/utils/deviceId.js';
import { useMafiaGameStore } from '@/stores/mafiaGame';
import { useMafiaPlayersStore } from '@/stores/mafiaPlayers';
import { mafiaEliminatedPlayerIconMapForPeerIds } from '@/utils/mafiaEliminatedPlayerIcons';
import { EAT_FIRST_OBS_URL_TOAST_EVENT } from '@/composables/eatFirstCallStreamView';
import { MAFIA_OBS_URL_TOAST_EVENT, MAFIA_SETTINGS_TOAST_EVENT } from '@/composables/mafiaStreamViewRoute';
import { MafiaWs } from '@/composables/mafiaWsProtocol';
import { useMafiaAudioMixSignaling } from '@/composables/useMafiaAudioMixSignaling';
import mafiaTilePinActiveIcon from '@/assets/mafia/ui/tile-pin-active.svg';
import { nominationTargetSeatsFromSpeakingFlat } from '@/utils/speakingNominationQueue';
import { decideSpeakingTileClick } from '@/utils/speakingNominationController';
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { user, ensureAuthLoaded, isAdmin } = useAuth();
/**
 * `/app/call`, `/app/mafia`, and `/app/eat` share one `CallPage` (video + orchestrator).
 * Isolation: Mafia uses `mafia:` signaling prefix; Eat First uses `eat:` (see `eatFirstCallRoomId.ts`).
 */
const isCallAppRoute = computed(() => route.name === 'call' || route.name === 'mafia' || route.name === 'eat');
const isMafiaRoute = computed(() => route.name === 'mafia');
const isEatFirstRoute = computed(() => route.name === 'eat');
const props = withDefaults(defineProps(), { mafiaStreamView: false, eatFirstStreamView: false });
const mafiaViewUi = computed(() => isMafiaRoute.value && props.mafiaStreamView);
const eatFirstViewUi = computed(() => isEatFirstRoute.value && props.eatFirstStreamView);
/**
 * HTML5 drag-and-drop tile reorder is only meaningful on the plain `'call'`
 * route. On Mafia / Eat First the host uses an explicit click-to-swap mode
 * driven by `hostInteractionMode === 'swap'`, and OBS / `?mode=view` is
 * display-only. Bind `:draggable`, `:title`, and `:aria-label` to this
 * single computed so the drag affordance and its tooltip stay in lock-step
 * — non-reorder routes (Mafia, Eat First, view-only) render no
 * "Перетягніть, щоб змінити порядок" tooltip on hover.
 */
const canReorderTiles = computed(() => !mafiaViewUi.value && !isMafiaRoute.value && !isEatFirstRoute.value);
/**
 * Mafia `?mode=view` and Eat First `?mode=view`: recv-only in call-core — no camera/mic publish
 * (`wireCallMediaAfterRoomState` skips send transport for `viewer`). `/app/call` stays `participant`.
 */
const callEngineRole = computed(() => mafiaViewUi.value || eatFirstViewUi.value ? 'viewer' : 'participant');
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
    return mafiaViewUi.value || eatFirstViewUi.value;
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
            mafiaViewUi: mafiaViewUi.value,
            eatFirstViewUi: eatFirstViewUi.value,
            routeName: route.name,
            isMafiaRoute: isMafiaRoute.value,
            isEatFirstRoute: isEatFirstRoute.value,
        });
    }, { immediate: true });
}
useMafiaHostSignaling(sendSignalingMessage, subscribeSignalingMessage, wsStatus);
// Diagnostics-only WS / signaling counters + probes + env-info stamp +
// optional `__MEDIA_DEBUG__` global install live in `useCallMediaDebugTaps`
// (Block 24). The composable owns the WS watcher, the
// `subscribeSignalingMessage` detach, the timer-drift + rAF probes, and the
// `installMediaDebugGlobal` lifecycle. The env-info payload is route-specific
// (Mafia stamps `isMafiaView` + `isEatFirstView`) and is supplied as a thunk.
useCallMediaDebugTaps({
    wsStatus,
    subscribeSignalingMessage,
    requestForcedProducerResync,
    envInfo: () => ({
        isMafiaView: mafiaViewUi.value,
        isEatFirstView: eatFirstViewUi.value,
    }),
});
const { selfPeerId, selfDisplayName, remoteDisplayNames } = storeToRefs(session);
const MAFIA_FORCE_CAMERA_OFF_SIGNAL = MafiaWs.forceCameraOff;
const MAFIA_FORCE_MUTE_ALL_SIGNAL = MafiaWs.forceMuteAll;
const EAT_FIRST_FORCE_MUTE_ALL_SIGNAL = EatFirstWs.forceMuteAll;
const EAT_FIRST_TRAIT_REVEAL_REQUEST_SIGNAL = EatFirstWs.traitRevealRequest;
const EAT_FIRST_TRAIT_REGENERATE_REQUEST_SIGNAL = EatFirstWs.traitRegenerateRequest;
const EAT_FIRST_TRAIT_TYPE_REROLL_REQUEST_SIGNAL = EatFirstWs.traitTypeRerollRequest;
const EAT_FIRST_ACTION_CARD_REROLL_REQUEST_SIGNAL = EatFirstWs.actionCardRerollRequest;
const EAT_FIRST_ACTION_CARD_USE_SIGNAL = EatFirstWs.actionCardUse;
const EAT_FIRST_TABLE_ROUND_DEAL_SIGNAL = EatFirstWs.tableRoundDeal;
const EAT_FIRST_SPEAKING_QUEUE_UPDATE_SIGNAL = EatFirstWs.speakingQueueUpdate;
const EAT_FIRST_SLOT_CLAIM_SIGNAL = EatFirstWs.slotClaim;
function mafiaSignalPayload(data, type) {
    if (data == null || typeof data !== 'object') {
        return null;
    }
    const rec = data;
    if (rec.type !== type || rec.payload == null || typeof rec.payload !== 'object') {
        return null;
    }
    return rec.payload;
}
const offMafiaForceControls = subscribeSignalingMessage((data) => {
    if (!isMafiaRoute.value) {
        return;
    }
    const nickPayload = mafiaSignalPayload(data, MafiaWs.playerNicknameUpdate);
    if (nickPayload != null) {
        const peerId = typeof nickPayload.peerId === 'string' ? nickPayload.peerId.trim() : '';
        if (!peerId) {
            return;
        }
        const displayName = typeof nickPayload.displayName === 'string' ? nickPayload.displayName.trim().slice(0, 64) : '';
        const next = { ...mafiaNicknameOverrideByPeerId.value };
        if (!displayName) {
            delete next[peerId];
        }
        else {
            next[peerId] = displayName;
        }
        mafiaNicknameOverrideByPeerId.value = next;
        // Ensure an older local-only rename doesn't shadow the Mafia-synced nickname.
        if (Object.prototype.hasOwnProperty.call(localTileDisplayOverrides.value, peerId)) {
            const cleaned = { ...localTileDisplayOverrides.value };
            delete cleaned[peerId];
            localTileDisplayOverrides.value = cleaned;
            saveCallTileLocalDisplayOverrides(cleaned);
        }
        return;
    }
    const mutePayload = mafiaSignalPayload(data, MAFIA_FORCE_MUTE_ALL_SIGNAL);
    if (mutePayload != null) {
        if (mafiaGameStore.isMafiaHost) {
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
    const cameraPayload = mafiaSignalPayload(data, MAFIA_FORCE_CAMERA_OFF_SIGNAL);
    const peerId = cameraPayload?.peerId;
    if (typeof peerId === 'string' && peerId === selfPeerId.value && camEnabled.value) {
        void toggleCam();
    }
    // Per-peer Mafia mic-force (server-emitted side effect of kick/revive).
    // `muted: true` flips the local mic UI off via the existing call-core
    // `toggleMic` action so the killed peer stops trying to talk into a
    // server-paused producer. `muted: false` is a UI hint clear only — we
    // do NOT auto-unmute the user; they unmute manually after revive.
    const forcePeerMicPayload = mafiaSignalPayload(data, MafiaWs.forcePeerMic);
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
onBeforeUnmount(offMafiaForceControls);
/**
 * Mafia P1 Bug 1+2: per-peer effective audio-muted tracking for the host's
 * "mute all" button visual state. Server's `peer-audio-muted` already
 * encodes effective mute (`audioMuted || forcedAudioMuted`); the room-state
 * snapshot at join carries the same data per peer. Both flow into the
 * store's `peerEffectiveMutedByPeerId`, which `MafiaHostActionsBar`
 * reduces against `nonHostPeerIds` for the visual.
 *
 * Gated on `isMafiaRoute` so non-Mafia rooms never write to the Mafia store.
 */
const offMafiaPeerAudioMuted = subscribeSignalingMessage((data) => {
    if (!isMafiaRoute.value) {
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
        mafiaGameStore.replacePeerEffectiveMutedSnapshot(snapshot);
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
        mafiaGameStore.setPeerEffectiveMuted(pid, muted === true);
        return;
    }
    if (rec.type === 'peer-left') {
        const p = rec.payload;
        if (p == null || typeof p !== 'object')
            return;
        const pid = p.peerId;
        if (typeof pid !== 'string' || pid.length === 0)
            return;
        mafiaGameStore.clearPeerEffectiveMuted(pid);
    }
});
onBeforeUnmount(offMafiaPeerAudioMuted);
/**
 * Toggling Mafia `?mode=view` (header / router) flips `callEngineRole` only after a new wire; re-join
 * so OBS drops any existing send transport from a prior participant session in the same tab.
 */
watch(mafiaViewUi, (v, oldV) => {
    if (!isMafiaRoute.value) {
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
watch(eatFirstViewUi, (v, oldV) => {
    if (!isEatFirstRoute.value) {
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
// `mafiaNicknameOverrideByPeerId` is page-owned because the Mafia
// `playerNicknameUpdate` WS handler above (and the in-call view) writes
// to it from outside the composable. It's the route-specific input that
// `useCallDisplayNames` consumes via its `policy.nicknameOverrides`.
const mafiaNicknameOverrideByPeerId = shallowRef({});
// `participantsByPeerId`, `displayNameUiByPeerId`, `localTileDisplayOverrides`,
// `canEditTileDisplayName`, `onCommitLocalTileDisplayName`, `peerDisplayName`,
// and `peerAvatarFallbackName` live in `useCallDisplayNames` (Block 25). The
// composable call itself is below — it depends on `mafiaGameStore.isMafiaHost`,
// so the call is placed after that store is instantiated.
/** Stable handlers so grid re-renders do not allocate new fns per tile per frame. */
const remoteListenVolumeByPeer = new Map();
const remoteListenMutedByPeer = new Map();
/**
 * Deferred slot: assigned by `useMafiaAudioMixSignaling` further down the
 * setup script (it depends on `mafiaGameStore` which is initialized later).
 * Handlers below reference the slot lazily so the host's slider/mute toggle
 * also fans out a `mafia:audio-mix-update` to the room (OBS view applies it).
 * No-op for non-host or non-Mafia routes.
 */
const mafiaAudioMixBroadcasterSlot = {
    broadcast: null,
};
function broadcastMafiaAudioMixDeltaForTile(peerId, volume, muted) {
    mafiaAudioMixBroadcasterSlot.broadcast?.({ peerId, volume, muted });
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
            broadcastMafiaAudioMixDeltaForTile(peerId, readTileVolumeForPeer(peerId), readTileMutedForPeer(peerId));
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
            broadcastMafiaAudioMixDeltaForTile(peerId, readTileVolumeForPeer(peerId), readTileMutedForPeer(peerId));
        };
        remoteListenMutedByPeer.set(peerId, h);
    }
    return h;
}
const eatFirstShell = useEatFirstCallShellStore();
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
    if (isEatFirstRoute.value) {
        const hostPeerId = typeof eatFirstShell.hostPeerId === 'string' ? eatFirstShell.hostPeerId : null;
        const connectedPlayers = hostPeerId != null && ids.has(hostPeerId) ? Math.max(0, ids.size - 1) : ids.size;
        eatFirstShell.setConnectedPlayerCount(connectedPlayers);
    }
});
watch(() => [isEatFirstRoute.value, eatFirstShell.hostPeerId, tiles.value.map((t) => t.peerId).join('|')], ([isEatRoute, hostPeerId]) => {
    if (!isEatRoute) {
        return;
    }
    const ids = new Set(tiles.value.map((t) => t.peerId));
    const hostId = typeof hostPeerId === 'string' ? hostPeerId : null;
    const connectedPlayers = hostId != null && ids.has(hostId) ? Math.max(0, ids.size - 1) : ids.size;
    eatFirstShell.setConnectedPlayerCount(connectedPlayers);
}, { immediate: true });
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
// their `id` prefix (`mafia-obs-…`, `eat-first-obs-…`, `mafia-settings-…`)
// is the existing observable shape.
const { callToasts, pushCallToast } = useCallPresenceToasts({
    callPresenceMessages,
    t,
});
function onEatFirstForceMuteAll(muted) {
    if (!isEatFirstRoute.value || !eatFirstShell.isEatFirstRoomHost) {
        return;
    }
    sendSignalingMessage({ type: EAT_FIRST_FORCE_MUTE_ALL_SIGNAL, payload: { muted } });
}
function onEatFirstReshuffle() {
    if (!isEatFirstRoute.value || !eatFirstShell.isEatFirstRoomHost) {
        return;
    }
    if (import.meta.env.DEV) {
        callPageLog.info('[eat-first:ws:send]', { type: EAT_FIRST_TABLE_ROUND_DEAL_SIGNAL, payload: {} });
    }
    sendSignalingMessage({
        type: EAT_FIRST_TABLE_ROUND_DEAL_SIGNAL,
        payload: {},
    });
}
function attemptEatFirstSlotClaim() {
    if (!isEatFirstRoute.value)
        return;
    const gid = (() => {
        const q = route.query?.game;
        return typeof q === 'string' ? q.trim() : '';
    })();
    if (!gid)
        return;
    const sessionTok = getActiveEatFirstSlotForSession(gid);
    const picked = pickPrimaryEatFirstJoinTokenForGame(gid);
    let slotId = '';
    let joinToken = '';
    let deviceId = '';
    if (sessionTok && sessionTok.joinToken.length > 0) {
        slotId = sessionTok.slotId.trim();
        joinToken = sessionTok.joinToken.trim();
        deviceId = typeof sessionTok.deviceId === 'string' ? sessionTok.deviceId.trim() : '';
    }
    else if (picked && picked.token.trim().length > 0) {
        slotId = typeof picked.slotId === 'string' ? picked.slotId.trim() : '';
        joinToken = picked.token.trim();
        deviceId = '';
    }
    else {
        return;
    }
    if (!slotId)
        return;
    const selfId = typeof selfPeerId.value === 'string' ? selfPeerId.value.trim() : '';
    if (joinToken.length > 0) {
        const fallbackDeviceId = deviceId.length >= 8 ? deviceId : getOrCreateDeviceId();
        if (fallbackDeviceId.length < 8)
            return;
        if (import.meta.env.DEV) {
            callPageLog.info('[eat-first:slot-claim:send]', {
                gameId: gid,
                slotId,
                peerId: selfId || null,
                mode: 'token',
            });
        }
        sendSignalingMessage({
            type: EAT_FIRST_SLOT_CLAIM_SIGNAL,
            payload: { slotId, joinToken, deviceId: fallbackDeviceId },
        });
    }
}
function patchEatFirstTraitForSlot(slotId, traitKey, value) {
    const sid = slotId.trim();
    const nextValue = value.trim();
    if (!sid || !nextValue)
        return;
    const prev = eatFirstShell.traitsBySlot[sid];
    if (!prev || typeof prev !== 'object')
        return;
    eatFirstShell.setTraitsBySlot({
        ...eatFirstShell.traitsBySlot,
        [sid]: { ...prev, [traitKey]: nextValue },
    });
}
/**
 * Eat First inbound signaling — extracted into `useEatFirstCallSignaling`.
 *
 * The composable owns the four `slot/revealed/overrides/opened-bySlot`
 * shallowRefs (returned here so the rest of CallPage's computeds can read
 * them with the original variable names) plus the `applyingSpeakingQueueFromSignaling`
 * flag the host-side rebroadcast watcher uses to suppress its own echo.
 *
 * Cross-cutting effects that need other CallPage-scope deps stay here as
 * callbacks: slot-claim (route + per-game token store), trait patcher
 * (writes through `eatFirstShell.traitsBySlot`), and the action-card-used
 * toast (i18n + display name + `callToasts`).
 */
// `overridesBySlot` and `openedBySlot` are internal to the composable today
// (the dispatcher writes them; no CallPage computed reads them). Kept on the
// composable's return shape for future EatFirst adapters; not destructured
// here to avoid lint warnings.
const { applyingSpeakingQueueFromSignaling: applyingEatFirstSpeakingQueueFromSignaling, slotByPeer: eatFirstSlotByPeer, revealedBySlot: eatFirstRevealedBySlot, } = useEatFirstCallSignaling({
    subscribeSignalingMessage,
    selfPeerId,
    roomId: computed(() => session.roomId),
    isEatFirstRoute,
    eatFirstShell,
    micEnabled,
    toggleMic,
    attemptSlotClaim: attemptEatFirstSlotClaim,
    patchTraitForSlot: patchEatFirstTraitForSlot,
    onPlayerUsedActionCard: ({ peerId, title }) => {
        const name = peerDisplayName(peerId);
        const id = `eat-ac-${Date.now()}-${peerId}`;
        const text = t('eatFirstCall.playerUsedActionCardToast', { name, card: title });
        callToasts.value = [...callToasts.value, { id, text, kind: 'join' }];
        window.setTimeout(() => {
            callToasts.value = callToasts.value.filter((x) => x.id !== id);
        }, 5200);
    },
    log: callPageLog,
});
/**
 * Host-panel <-> CallPage bridge. The panel is rendered as a sibling of
 * `<CallPage />` (Teleport-d to body from `EatFirstCallPage`), so it cannot
 * call signaling methods directly. Instead the panel dispatches a typed
 * `CustomEvent` on `window` and CallPage forwards it through the live socket.
 * Listener is removed on unmount; only acts when on the Eat First route AND
 * the local user is the room host (server still re-validates).
 */
function onEatFirstHostActionEvent(ev) {
    if (!isEatFirstRoute.value)
        return;
    if (!eatFirstShell.isEatFirstRoomHost)
        return;
    const detail = ev.detail;
    if (!detail || typeof detail !== 'object')
        return;
    if (import.meta.env.DEV) {
        callPageLog.info('[eat-first:host-action:received]', detail);
    }
    const action = detail.action;
    if (action === 'trait-type-reroll-all') {
        const traitKey = detail.traitKey;
        if (typeof traitKey !== 'string')
            return;
        if (import.meta.env.DEV) {
            callPageLog.info('[eat-first:ws:send]', {
                type: EAT_FIRST_TRAIT_TYPE_REROLL_REQUEST_SIGNAL,
                payload: { traitKey },
            });
        }
        sendSignalingMessage({
            type: EAT_FIRST_TRAIT_TYPE_REROLL_REQUEST_SIGNAL,
            payload: { traitKey },
        });
        return;
    }
    if (action === 'action-card-reroll') {
        const slotId = detail.slotId;
        if (typeof slotId !== 'string' || slotId.length < 1)
            return;
        if (import.meta.env.DEV) {
            callPageLog.info('[eat-first:ws:send]', {
                type: EAT_FIRST_ACTION_CARD_REROLL_REQUEST_SIGNAL,
                payload: { slotId },
            });
        }
        sendSignalingMessage({
            type: EAT_FIRST_ACTION_CARD_REROLL_REQUEST_SIGNAL,
            payload: { slotId },
        });
        return;
    }
}
const EAT_FIRST_HOST_ACTION_EVENT = 'streamassist:eat-first:host-action';
function onEatFirstTimerActionEvent(ev) {
    if (!isEatFirstRoute.value)
        return;
    if (!eatFirstShell.isEatFirstRoomHost)
        return;
    const detail = ev.detail;
    if (!detail || typeof detail !== 'object')
        return;
    const action = detail.action;
    if (action === 'timer-start') {
        const raw = detail.durationSec;
        const durationSec = typeof raw === 'number' && Number.isFinite(raw) ? Math.max(5, Math.floor(raw)) : 30;
        const durationMs = durationSec * 1000;
        sendSignalingMessage({
            type: EatFirstWs.timerStart,
            payload: { startedAt: Date.now(), duration: durationMs },
        });
        return;
    }
    if (action === 'timer-stop') {
        sendSignalingMessage({ type: EatFirstWs.timerStop, payload: {} });
        return;
    }
    if (action === 'timer-preset-select') {
        const raw = detail.durationSec;
        if (typeof raw !== 'number' || !Number.isFinite(raw))
            return;
        const durationMs = Math.max(5_000, Math.floor(raw * 1000));
        sendSignalingMessage({
            type: EatFirstWs.timerPresetSelect,
            payload: { durationMs },
        });
    }
}
const EAT_FIRST_TIMER_ACTION_EVENT = 'streamassist:eat-first:timer-action';
if (typeof window !== 'undefined') {
    window.addEventListener(EAT_FIRST_HOST_ACTION_EVENT, onEatFirstHostActionEvent);
    window.addEventListener(EAT_FIRST_TIMER_ACTION_EVENT, onEatFirstTimerActionEvent);
    onBeforeUnmount(() => {
        window.removeEventListener(EAT_FIRST_HOST_ACTION_EVENT, onEatFirstHostActionEvent);
        window.removeEventListener(EAT_FIRST_TIMER_ACTION_EVENT, onEatFirstTimerActionEvent);
    });
}
// Route-specific OBS / Settings toast event listeners — Block 27. The
// composable owns the `addEventListener` / `removeEventListener` pairs
// and the prefixed-id push pattern; the i18n keys, id prefixes, and the
// EatFirst route gate stay route-specific via the `events` array.
useCallToastEventListeners({
    callToasts,
    events: [
        {
            eventName: MAFIA_OBS_URL_TOAST_EVENT,
            idPrefix: 'mafia-obs',
            getText: () => t('mafiaPage.obsViewUrlCopiedToast'),
        },
        {
            eventName: EAT_FIRST_OBS_URL_TOAST_EVENT,
            idPrefix: 'eat-first-obs',
            getText: () => (isEatFirstRoute.value ? t('eatFirstCall.obsCopied') : null),
        },
        {
            eventName: MAFIA_SETTINGS_TOAST_EVENT,
            idPrefix: 'mafia-settings',
            kind: 'leave',
            getText: (ev) => ev instanceof CustomEvent && typeof ev.detail?.text === 'string'
                ? ev.detail.text
                : t('mafiaPage.backgroundUploadFailed'),
        },
    ],
});
const { chatOpen, chatPanelClass, chatPanelStyle, onChatPanelDragPointerDown, onChatPanelResizePointerDown, stopChatPanelGesture, syncChatPanelToViewport, } = useCallChatPanel({
    inCall: () => session.inCall,
    roomId: () => session.roomId,
});
// Chat inbound toast stack (queue, dismiss / open-chat helpers, inCall
// reset + chatOpen sync + messages watcher) lives in
// `useCallChatInboundToasts` (Block 25). `isViewMode` is route-specific —
// Mafia ORs `mafiaViewUi` with `eatFirstViewUi`.
const { callChatInboundToasts, dismissCallChatInboundToast, openChatFromInboundToast, } = useCallChatInboundToasts({
    isInCall: computed(() => session.inCall),
    joining,
    isViewMode: computed(() => mafiaViewUi.value || eatFirstViewUi.value),
    callChatMessages,
    selfPeerId,
    chatOpen,
});
const callControlsDockRef = ref(null);
// `roomJoinDraft`, `roomCopyFlash`, `copyRoomToClipboard`,
// `onGenerateNewRoom`, `submitRoomDraft`, and the popover-open sync
// watcher live in `useCallRoomCodeChip` (Block 25). The composable
// call itself is below — it depends on `displayCallOrMafiaRoomCode`
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
const mafiaPlayersStore = useMafiaPlayersStore();
const mafiaGameStore = useMafiaGameStore();
watch(joinUserId, (id) => {
    mafiaGameStore.setLocalMafiaUserId(id ?? null);
}, { immediate: true });
const { mafiaHostPeerId: mafiaHostPeerIdRef, isMafiaHost: isMafiaHostRef } = storeToRefs(mafiaGameStore);
const { localTileDisplayOverrides, canEditTileDisplayName, onCommitLocalTileDisplayName, peerDisplayName, peerAvatarFallbackName, } = useCallDisplayNames({
    tiles,
    remoteDisplayNames,
    selfPeerId,
    selfDisplayName,
    policy: {
        isRouteActive: isMafiaRoute,
        isHost: isMafiaHostRef,
        nicknameOverrides: mafiaNicknameOverrideByPeerId,
        sendPlayerNameUpdate: (peerId, displayName) => {
            sendSignalingMessage({
                type: MafiaWs.playerNameUpdate,
                payload: { targetPeerId: peerId, displayName },
            });
        },
    },
});
const { broadcastMafiaAudioMixDelta } = useMafiaAudioMixSignaling({
    sendSignalingMessage,
    subscribeSignalingMessage,
    wsStatus,
    isMafiaRoute,
    isViewMode: mafiaViewUi,
    isMafiaHost: isMafiaHostRef,
    hostPeerId: mafiaHostPeerIdRef,
    setRemoteListenVolume,
    setRemoteListenMuted,
});
mafiaAudioMixBroadcasterSlot.broadcast = broadcastMafiaAudioMixDelta;
function displayCallOrMafiaRoomCode() {
    const raw = normalizeDisplayName(session.roomId) || 'demo';
    if (isMafiaRoute.value) {
        return mafiaBaseRoomIdFromSignaling(raw);
    }
    if (isEatFirstRoute.value) {
        return eatFirstBaseRoomIdFromSignaling(raw);
    }
    return raw;
}
/**
 * Keep `session.roomId` consistent with the route: Mafia → `mafia:<base>`, Eat First → `eat:<base>`,
 * Call → neither prefix.
 */
function normalizeSessionRoomIdForStreamRoute() {
    if (!isCallAppRoute.value) {
        return;
    }
    const s = normalizeDisplayName(session.roomId) || 'demo';
    if (isEatFirstRoute.value) {
        const desired = eatFirstSignalingRoomId(eatFirstBaseRoomIdFromSignaling(s));
        if (s !== desired) {
            session.roomId = desired;
        }
        return;
    }
    if (isMafiaRoute.value) {
        const desired = mafiaSignalingRoomId(mafiaBaseRoomIdFromSignaling(s));
        if (s !== desired) {
            session.roomId = desired;
        }
        return;
    }
    if (s.startsWith(MAFIA_SIGNALING_ROOM_PREFIX)) {
        session.roomId = mafiaBaseRoomIdFromSignaling(s);
    }
    if (s.startsWith(EAT_FIRST_SIGNALING_ROOM_PREFIX)) {
        session.roomId = eatFirstBaseRoomIdFromSignaling(s);
    }
}
async function switchToRoom(nextRaw, opts) {
    const base = normalizeDisplayName(nextRaw) || 'demo';
    const signalingId = isMafiaRoute.value
        ? mafiaSignalingRoomId(base)
        : isEatFirstRoute.value
            ? eatFirstSignalingRoomId(base)
            : base;
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
            const name = route.name === 'mafia' ? 'mafia' : route.name === 'eat' ? 'eat' : 'call';
            const query = name === 'eat' ? { ...route.query, game: base } : { ...route.query, room: base };
            await router.replace({ name, query });
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
    typeof route.query.game === 'string' ? route.query.game : '',
    callAuthReady.value,
], async () => {
    if (!callAuthReady.value || !isCallAppRoute.value) {
        return;
    }
    normalizeSessionRoomIdForStreamRoute();
    const q = route.name === 'eat'
        ? typeof route.query.game === 'string'
            ? normalizeDisplayName(route.query.game)
            : ''
        : typeof route.query.room === 'string'
            ? normalizeDisplayName(route.query.room)
            : '';
    if (!q) {
        if (!session.inCall && !joining.value) {
            try {
                const code = generateCallRoomCode();
                if (route.name === 'eat') {
                    await router.replace({
                        name: 'eat',
                        query: { ...route.query, game: code },
                    });
                }
                else {
                    await router.replace({
                        name: route.name,
                        query: { ...route.query, room: code },
                    });
                }
            }
            catch {
                /* ignore */
            }
        }
        return;
    }
    const currentSignaling = normalizeDisplayName(session.roomId) || 'demo';
    const qSignaling = route.name === 'mafia'
        ? mafiaSignalingRoomId(q)
        : route.name === 'eat'
            ? eatFirstSignalingRoomId(q)
            : q;
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
    displayRoomCode: displayCallOrMafiaRoomCode,
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
    let ids = list.map((t) => t.peerId);
    if (isEatFirstRoute.value) {
        const hostId = typeof eatFirstShell.hostPeerId === 'string' ? eatFirstShell.hostPeerId : '';
        ids = sortPeerIdsHostLast(ids, hostId);
    }
    if (isMafiaRoute.value) {
        const explicitHostId = typeof mafiaGameStore.mafiaHostPeerId === 'string' ? mafiaGameStore.mafiaHostPeerId.trim() : '';
        const prevDisplayOrder = mafiaGameStore.getDisplayNumberingOrder(tileOrder.value);
        const hostId = resolveHostPeerIdForGrid(explicitHostId, prevDisplayOrder);
        ids = sortPeerIdsHostLast(ids, hostId);
        tileOrder.value = ids;
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
 * Push the current non-host participant peerIds to the Mafia store so it
 * can compute "every non-host effectively muted" for the host UI button
 * (P1 Bug 1+2). The store filters out the host peerId internally.
 */
watch(() => [
    isMafiaRoute.value,
    mafiaGameStore.mafiaHostPeerId,
    tiles.value.map((t) => t.peerId).join('|'),
], () => {
    if (!isMafiaRoute.value) {
        mafiaGameStore.setNonHostPeerIds([]);
        return;
    }
    // Pass every tile peerId; the store filters the host peer internally.
    // This keeps the membership stable when host changes via transfer.
    mafiaGameStore.setNonHostPeerIds(tiles.value.map((t) => t.peerId));
}, { immediate: true, flush: 'post' });
const mafiaNumberByPeer = computed(() => {
    if (!isMafiaRoute.value) {
        return new Map();
    }
    const m = new Map();
    const order = mafiaGameStore.getDisplayNumberingOrder(tileOrder.value);
    const explicitHostPeerId = typeof mafiaGameStore.mafiaHostPeerId === 'string' ? mafiaGameStore.mafiaHostPeerId.trim() : '';
    const hostPeerId = resolveHostPeerIdForGrid(explicitHostPeerId, order);
    const numbered = hostPeerId.length > 0 ? order.filter((id) => id !== hostPeerId) : order;
    numbered.forEach((id, i) => {
        m.set(id, i + 1);
    });
    return m;
});
const mafiaEliminatedPlayerIconByPeer = computed(() => {
    if (!isMafiaRoute.value) {
        return new Map();
    }
    const numberedPeerIds = [...mafiaNumberByPeer.value.entries()]
        .sort((a, b) => a[1] - b[1])
        .map(([peerId]) => peerId);
    return mafiaEliminatedPlayerIconMapForPeerIds(numberedPeerIds, session.roomId);
});
function mafiaEliminatedPlayerIconForTile(peerId) {
    if (!isMafiaRoute.value) {
        return undefined;
    }
    return mafiaEliminatedPlayerIconByPeer.value.get(peerId);
}
/**
 * Mafia call-host UI behaviour — extracted into `useMafiaCallHostUi` (Phase 2).
 *
 * Owns the host-side handlers, the night-action/speaking seat-highlight
 * computeds, the speak-hint visibility ref + lifecycle, and the Mafia branch
 * of the tile-click router. CallPage's template binds the destructured names
 * unchanged, so no template edits are required.
 *
 * The Mafia OBS/host-claim flow, audio-mix host broadcast, and inbound
 * Mafia signaling continue to live in `useMafiaHostSignaling` and
 * `useMafiaAudioMixSignaling`; this composable is strictly the CallPage-level
 * host-UI surface.
 */
const { isMafiaHostNightActionSeat, isMafiaHostSpeakingNominationUiSeat, onMafiaToggleLifeFromTile, onMafiaForceCameraOffFromTile, onMafiaForceMuteAll, onMafiaSetEliminationBackground, handleMafiaHostTileClick, } = useMafiaCallHostUi({
    isMafiaRoute,
    mafiaViewUi,
    selfPeerId,
    mafiaGameStore,
    mafiaNumberByPeer,
    sendSignalingMessage,
    pushCallToast,
    t,
});
const eatFirstSeatByPeer = computed(() => {
    if (!isEatFirstRoute.value) {
        return new Map();
    }
    const m = new Map();
    for (const [peerId, slotId] of Object.entries(eatFirstSlotByPeer.value)) {
        if (typeof slotId !== 'string')
            continue;
        const hit = /^p([1-9]|1[01])$/i.exec(slotId.trim());
        if (!hit)
            continue;
        const seat = Number(hit[1]);
        if (Number.isInteger(seat) && seat >= 1) {
            m.set(peerId, seat);
        }
    }
    return m;
});
/** 1-based position in `playerOrder` for the tile badge (speaking / table order). */
const eatFirstDisplayOrderByPeer = computed(() => {
    const m = new Map();
    if (!isEatFirstRoute.value)
        return m;
    const slotByPeer = eatFirstSlotByPeer.value;
    const peerBySlot = new Map();
    for (const [peerId, slotId] of Object.entries(slotByPeer)) {
        const sid = typeof slotId === 'string' ? slotId.trim() : '';
        if (!/^p([1-9]|1[01])$/i.test(sid))
            continue;
        peerBySlot.set(sid, peerId);
    }
    eatFirstShell.playerOrder.forEach((slotId, idx) => {
        const peerId = peerBySlot.get(slotId);
        if (peerId && !m.has(peerId)) {
            m.set(peerId, idx + 1);
        }
    });
    return m;
});
/** Same 1-based index as the Eat First tile badge; host nomination queue must match that label, not `pN` slot digits. */
function eatFirstNominationNumberForPeer(peerId) {
    if (!isEatFirstRoute.value)
        return undefined;
    const disp = eatFirstDisplayOrderByPeer.value.get(peerId);
    if (typeof disp === 'number' && Number.isInteger(disp) && disp >= 1)
        return disp;
    const slotNum = eatFirstSeatByPeer.value.get(peerId);
    if (typeof slotNum === 'number' && Number.isInteger(slotNum) && slotNum >= 1)
        return slotNum;
    return undefined;
}
watch(() => eatFirstShell.speakingQueue, (q) => {
    if (applyingEatFirstSpeakingQueueFromSignaling.value) {
        return;
    }
    if (!isEatFirstRoute.value) {
        return;
    }
    if (!session.inCall) {
        return;
    }
    if (wsStatus.value !== 'open') {
        return;
    }
    if (!eatFirstShell.isEatFirstRoomHost) {
        return;
    }
    sendSignalingMessage({
        type: EAT_FIRST_SPEAKING_QUEUE_UPDATE_SIGNAL,
        payload: { speakingQueue: [...q] },
    });
}, { deep: true });
/**
 * Host-side outbound `eat:players-update` watcher. Driven by
 * `eatFirstShell.swapEatFirstSlotsInPlayerOrder` which queues the new
 * `playerOrder` on `playersUpdateBroadcastPayload` after a positional
 * swap. Server's existing `handleEatFirstPlayersUpdate` validates the
 * permutation, persists via `setEatFirstPlayerOrder`, and re-broadcasts
 * via `eat:table-state-sync` to every peer. Mirrors the Mafia
 * `playersUpdateBroadcastPayload` pattern.
 */
watch(() => eatFirstShell.playersUpdateBroadcastPayload, (p) => {
    if (p == null)
        return;
    if (!isEatFirstRoute.value) {
        eatFirstShell.clearPlayersUpdateBroadcastPayload();
        return;
    }
    if (!session.inCall) {
        eatFirstShell.clearPlayersUpdateBroadcastPayload();
        return;
    }
    if (wsStatus.value !== 'open') {
        eatFirstShell.clearPlayersUpdateBroadcastPayload();
        return;
    }
    if (!eatFirstShell.isEatFirstRoomHost) {
        eatFirstShell.clearPlayersUpdateBroadcastPayload();
        return;
    }
    sendSignalingMessage({
        type: EatFirstWs.playersUpdate,
        payload: { playerOrder: [...p.playerOrder] },
    });
    eatFirstShell.clearPlayersUpdateBroadcastPayload();
}, { flush: 'post' });
const eatFirstActiveTabSlotId = computed(() => {
    if (!isEatFirstRoute.value)
        return '';
    const gid = typeof route.query?.game === 'string' ? route.query.game.trim() : '';
    if (!gid)
        return '';
    const active = getActiveEatFirstSlotForSession(gid);
    return active?.slotId ?? '';
});
function eatFirstTraitsForPeer(peerId) {
    if (!isEatFirstRoute.value)
        return null;
    const hostPid = typeof eatFirstShell.hostPeerId === 'string' ? eatFirstShell.hostPeerId.trim() : '';
    if (hostPid.length > 0 && peerId === hostPid)
        return null;
    const slot = eatFirstSlotByPeer.value[peerId];
    if (typeof slot === 'string' && slot.length > 0) {
        const bySlot = eatFirstShell.traitsBySlot[slot];
        if (bySlot && typeof bySlot === 'object')
            return bySlot;
    }
    return null;
}
function eatFirstTraitHostView() {
    return isEatFirstRoute.value && eatFirstShell.isEatFirstRoomHost;
}
function eatFirstTraitOwnerView(peerId) {
    if (!isEatFirstRoute.value)
        return false;
    const peerSlot = eatFirstSlotForPeer(peerId);
    if (!peerSlot)
        return false;
    const selfId = typeof selfPeerId.value === 'string' ? selfPeerId.value.trim() : '';
    if (selfId.length > 0 && peerId === selfId)
        return true;
    const tabSlot = eatFirstActiveTabSlotId.value;
    if (tabSlot.length > 0 && peerSlot === tabSlot)
        return true;
    return false;
}
function eatFirstSlotForPeer(peerId) {
    if (!isEatFirstRoute.value)
        return '';
    const slot = eatFirstSlotByPeer.value[peerId];
    return typeof slot === 'string' ? slot : '';
}
function eatFirstRevealedTraitsForPeer(peerId) {
    if (!isEatFirstRoute.value)
        return [];
    const slot = eatFirstSlotForPeer(peerId);
    if (!slot)
        return [];
    const bySlot = eatFirstRevealedBySlot.value[slot];
    if (!bySlot || typeof bySlot !== 'object')
        return [];
    const out = [];
    for (const [k, open] of Object.entries(bySlot)) {
        if (open === true)
            out.push(k);
    }
    return out;
}
function eatFirstActionCardForPeer(peerId) {
    if (!isEatFirstRoute.value)
        return null;
    const hostPid = typeof eatFirstShell.hostPeerId === 'string' ? eatFirstShell.hostPeerId.trim() : '';
    if (hostPid.length > 0 && peerId === hostPid)
        return null;
    const selfId = typeof selfPeerId.value === 'string' ? selfPeerId.value.trim() : '';
    const isHost = eatFirstShell.isEatFirstRoomHost === true;
    if (!isHost) {
        if (!selfId || peerId !== selfId)
            return null;
    }
    const slot = eatFirstSlotForPeer(peerId);
    if (!slot)
        return null;
    const card = eatFirstShell.actionCardBySlot[slot];
    if (!card)
        return null;
    const title = typeof card.title === 'string' ? card.title : '';
    if (title.length < 1)
        return null;
    return {
        title,
        description: typeof card.description === 'string' ? card.description : '',
        templateId: typeof card.templateId === 'string' ? card.templateId : '',
        used: card.used === true,
    };
}
function onEatFirstRevealTrait(payload) {
    if (!isEatFirstRoute.value)
        return;
    const peerId = typeof payload.peerId === 'string' ? payload.peerId.trim() : '';
    const slotId = eatFirstSlotForPeer(peerId);
    if (!slotId)
        return;
    const close = payload.closed === true;
    sendSignalingMessage({
        type: EAT_FIRST_TRAIT_REVEAL_REQUEST_SIGNAL,
        payload: close
            ? { slotId, traitKey: payload.traitKey, closed: true }
            : { slotId, traitKey: payload.traitKey },
    });
}
function onEatFirstGenerateTrait(payload) {
    if (!isEatFirstRoute.value || !eatFirstShell.isEatFirstRoomHost)
        return;
    const peerId = typeof payload.peerId === 'string' ? payload.peerId.trim() : '';
    const slotId = eatFirstSlotForPeer(peerId);
    if (!slotId)
        return;
    sendSignalingMessage({
        type: EAT_FIRST_TRAIT_REGENERATE_REQUEST_SIGNAL,
        payload: { slotId, traitKey: payload.traitKey },
    });
}
function onEatFirstRerollActionCard(payload) {
    if (!isEatFirstRoute.value || !eatFirstShell.isEatFirstRoomHost)
        return;
    const peerId = typeof payload.peerId === 'string' ? payload.peerId.trim() : '';
    const slotId = eatFirstSlotForPeer(peerId);
    if (!slotId)
        return;
    sendSignalingMessage({
        type: EAT_FIRST_ACTION_CARD_REROLL_REQUEST_SIGNAL,
        payload: { slotId },
    });
}
function onEatFirstPlayerUseActionCard(payload) {
    if (!isEatFirstRoute.value)
        return;
    const peerId = typeof payload.peerId === 'string' ? payload.peerId.trim() : '';
    const selfId = typeof selfPeerId.value === 'string' ? selfPeerId.value.trim() : '';
    if (!peerId || peerId !== selfId)
        return;
    const slotId = eatFirstSlotForPeer(peerId);
    if (!slotId)
        return;
    sendSignalingMessage({
        type: EAT_FIRST_ACTION_CARD_USE_SIGNAL,
        payload: { slotId },
    });
}
// Local-tile speaking ring source. Moved up so it can be consumed by
// `useCallTileOrdering` below (which owns `isTileRowSpeaking`).
const localTileSpeakingForWrap = useLocalTileSpeakingVisual(() => localAudioSourceStream.value, () => true, () => micEnabled.value);
// Tile ordering + row shaping + speaking check — Block 26.
// `orderedTiles` precedence: `customOrdering()` (EatFirst slot order) →
// `hostLastPolicy` (Mafia route, host pinned last + extras fold) →
// fallback (`tileOrder` + spotlight pin).
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
        isActive: isMafiaRoute,
        getDisplayNumberingOrder: (o) => mafiaGameStore.getDisplayNumberingOrder(o),
        getExplicitHostPeerId: () => typeof mafiaGameStore.mafiaHostPeerId === 'string'
            ? mafiaGameStore.mafiaHostPeerId.trim()
            : '',
    },
    customOrdering: () => {
        if (!isEatFirstRoute.value || tiles.value.length === 0) {
            return null;
        }
        const slotByPeer = eatFirstSlotByPeer.value;
        const peerBySlot = new Map();
        for (const [peerId, slotId] of Object.entries(slotByPeer)) {
            if (typeof slotId === 'string' && /^p([1-9]|1[01])$/i.test(slotId.trim())) {
                peerBySlot.set(slotId.trim(), peerId);
            }
        }
        const baseOrder = [];
        for (const slotId of eatFirstShell.playerOrder) {
            const peerId = peerBySlot.get(slotId);
            if (!peerId)
                continue;
            baseOrder.push(peerId);
        }
        const hostPid = typeof eatFirstShell.hostPeerId === 'string' ? eatFirstShell.hostPeerId.trim() : '';
        return buildHostLastOrderedTiles(tiles.value, baseOrder, hostPid);
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
function isEatFirstHostSpeakingNominationSeat(seat) {
    if (seat == null) {
        return false;
    }
    return nominationTargetSeatsFromSpeakingFlat(eatFirstShell.speakingQueue).has(seat);
}
/**
 * Tile-click router across all three call routes.
 *
 * The EatFirst speaking-mode branch (host-only nomination toggle) remains
 * inline here because it reads `eatFirstShell` state owned by the EatFirst
 * domain in CallPage's setup. The Mafia branch (swap / speaking / night
 * action) is delegated to `useMafiaCallHostUi.handleMafiaHostTileClick`.
 *
 * Behaviour preserved 1:1: same guards, same `ev.stopPropagation()`
 * semantics, same toast keys, same store dispatch order.
 */
function onMafiaHostTileClick(ev, row) {
    if (isEatFirstRoute.value && !eatFirstViewUi.value && eatFirstShell.isEatFirstRoomHost) {
        // Swap mode branch (Choice A — Mafia / Game Template parity). Routed
        // BEFORE the speaking-mode branch because `setHostInteractionMode`
        // enforces mutual exclusion: speakingMode is forced off whenever swap
        // mode is on, so the speaking branch below cannot fire while swap is
        // active. First tile click stores the selection; second tile click on
        // a different peer commits a positional swap in `playerOrder` and
        // remaps the speaking queue. Slot ownership and slot-bound traits /
        // action cards are NOT touched.
        if (eatFirstShell.hostInteractionMode === 'swap') {
            const swapClickTarget = ev.target;
            if (swapClickTarget instanceof Element) {
                if (swapClickTarget.closest('button, input, textarea, a, [data-no-mafia-tile-host]')) {
                    return;
                }
                if (swapClickTarget.closest('.tile-overlay__label-group, .tile-overlay__name-input, .tile-overlay__name-edit')) {
                    return;
                }
            }
            const clickedPeerId = row.tile.peerId;
            const slotForClicked = eatFirstSlotByPeer.value[clickedPeerId];
            if (typeof slotForClicked !== 'string' || slotForClicked.length < 1) {
                ev.stopPropagation();
                return;
            }
            const pending = eatFirstShell.hostSeatSwapSelectionPeerId;
            if (pending == null) {
                eatFirstShell.setHostSeatSwapSelectionPeerId(clickedPeerId);
            }
            else if (pending === clickedPeerId) {
                eatFirstShell.setHostSeatSwapSelectionPeerId(null);
            }
            else {
                const slotForPending = eatFirstSlotByPeer.value[pending];
                if (typeof slotForPending === 'string' && slotForPending.length >= 1) {
                    eatFirstShell.swapEatFirstSlotsInPlayerOrder(slotForPending, slotForClicked);
                }
                else {
                    eatFirstShell.setHostSeatSwapSelectionPeerId(null);
                }
            }
            ev.stopPropagation();
            return;
        }
        if (!eatFirstShell.speakingMode) {
            return;
        }
        const clickTarget = ev.target;
        if (clickTarget instanceof Element) {
            if (clickTarget.closest('button, input, textarea, a, [data-no-mafia-tile-host]')) {
                return;
            }
            if (clickTarget.closest('.tile-overlay__label-group, .tile-overlay__name-input, .tile-overlay__name-edit')) {
                return;
            }
        }
        const seat = eatFirstNominationNumberForPeer(row.tile.peerId);
        if (seat == null) {
            return;
        }
        // Route the tile click through the shared speaking-nomination state
        // machine so Eat First applies the exact same rules Mafia / Game
        // Template do (duplicate-by and duplicate-target collisions surface a
        // toast instead of silently appending a duplicate entry). The
        // controller is pure; this branch is the sole adapter.
        const intent = decideSpeakingTileClick({
            mode: 'speaking',
            seat,
            draft: eatFirstShell.speakingNominationDraftBySeat,
            queue: eatFirstShell.speakingQueue,
        });
        switch (intent.kind) {
            case 'set-draft':
                eatFirstShell.setSpeakingNominationDraftBySeat(intent.seat);
                break;
            case 'clear-draft':
                eatFirstShell.setSpeakingNominationDraftBySeat(null);
                break;
            case 'append-pair':
                eatFirstShell.appendSpeakingNominationPair(intent.by, intent.target);
                break;
            case 'reject-duplicate-by':
                pushCallToast(t('eatFirstCall.speakingByAlreadyNominatedToast', {
                    by: intent.bySeat,
                    target: intent.existingTarget,
                }), 'leave');
                if (intent.clearDraftAfter) {
                    eatFirstShell.setSpeakingNominationDraftBySeat(null);
                }
                break;
            case 'reject-duplicate-target':
                pushCallToast(t('eatFirstCall.speakingTargetAlreadyNominatedToast', {
                    target: intent.targetSeat,
                    by: intent.existingBySeat ?? '?',
                }), 'leave');
                break;
            case 'ignore':
            default:
                break;
        }
        ev.stopPropagation();
        return;
    }
    handleMafiaHostTileClick(ev, row);
}
function refreshMafiaPlayersState() {
    if (!isMafiaRoute.value) {
        mafiaPlayersStore.clearPlayerRowsForUi();
        if (isEatFirstRoute.value) {
            mafiaGameStore.prunePlayerOverlayStateToPeerIds(tiles.value.map((t) => t.peerId));
        }
        else {
            mafiaGameStore.clearWhenLeavingMafiaRoute();
        }
        return;
    }
    if (mafiaGameStore.isApplyingMafiaReshuffle) {
        const engine = tileOrder.value;
        const order = mafiaGameStore.getDisplayNumberingOrder(engine);
        const explicitHostPeerId = typeof mafiaGameStore.mafiaHostPeerId === 'string' ? mafiaGameStore.mafiaHostPeerId.trim() : '';
        const hostPeerId = explicitHostPeerId.length > 0
            ? explicitHostPeerId
            : order.length > 0
                ? order[order.length - 1] ?? ''
                : '';
        const playersOnly = hostPeerId.length > 0 ? order.filter((peerId) => peerId !== hostPeerId) : order;
        mafiaPlayersStore.setPlayerRowsDisplay(playersOnly.map((peerId, i) => ({
            peerId,
            number: i + 1,
            displayName: peerDisplayName(peerId),
        })));
        return;
    }
    mafiaPlayersStore.syncWithPeers(session.roomId, tiles.value.map((t) => t.peerId));
    const engine = tileOrder.value;
    mafiaGameStore.reconcileNumberingWithEngine(engine);
    mafiaGameStore.pruneGameStateToPeers(engine);
    const order = mafiaGameStore.getDisplayNumberingOrder(engine);
    const explicitHostPeerId = typeof mafiaGameStore.mafiaHostPeerId === 'string' ? mafiaGameStore.mafiaHostPeerId.trim() : '';
    const hostPeerId = explicitHostPeerId.length > 0
        ? explicitHostPeerId
        : order.length > 0
            ? order[order.length - 1] ?? ''
            : '';
    const seatCount = hostPeerId.length > 0 && order.includes(hostPeerId) ? order.length - 1 : order.length;
    mafiaGameStore.pruneNightActionsToMaxSeat(seatCount);
    if (mafiaGameStore.isMafiaHost) {
        mafiaGameStore.pruneSpeakingQueueToMaxSeat(seatCount);
    }
    const playersOnly = hostPeerId.length > 0 ? order.filter((peerId) => peerId !== hostPeerId) : order;
    mafiaPlayersStore.setPlayerRowsDisplay(playersOnly.map((peerId, i) => ({
        peerId,
        number: i + 1,
        displayName: peerDisplayName(peerId),
    })));
}
/**
 * Stable scalar key for `refreshMafiaPlayersState`. Replaces the previous
 * `deep: true` watcher over `[tiles, orderedGridRows, nightActions, speakingQueue]`
 * which fired on every audio-level / tile-reorder / speaker-change tick (3-5/s
 * in active mafia discussion at 8-12 cameras) and re-ran the full reconcile
 * pass even when no peer-set / numbering / queue change had actually occurred.
 *
 * `refreshMafiaPlayersState` only consumes:
 *   - peerIds from `tiles.value` (set membership)
 *   - `mafiaGameStore.numberingKey` (engine ordering)
 *   - `mafiaGameStore.speakingQueue` (length / contents)
 *   - `isApplyingMafiaReshuffle` (branch selector)
 * It does NOT read `orderedGridRows.value` or `mafiaGameStore.nightActions`
 * content; nightActions are pruned by max-seat which is derived from peer count.
 *
 * The function itself is idempotent so an extra run on an unrelated mafia state
 * change would only waste CPU, not produce a wrong result.
 */
const mafiaPlayersWatcherKey = computed(() => {
    if (!isMafiaRoute.value) {
        return `off|${session.roomId}`;
    }
    const peerIds = [];
    for (const t of tiles.value) {
        peerIds.push(t.peerId);
    }
    const queue = mafiaGameStore.speakingQueue.join(',');
    return [
        'on',
        session.roomId,
        peerIds.join('|'),
        mafiaGameStore.numberingKey,
        queue,
        mafiaGameStore.isApplyingMafiaReshuffle ? '1' : '0',
    ].join('::');
});
watch(mafiaPlayersWatcherKey, () => {
    void refreshMafiaPlayersState();
}, { immediate: true });
watch(() => [
    isEatFirstRoute.value,
    eatFirstShell.isEatFirstRoomHost,
    eatFirstViewUi.value,
], ([eat, host, view]) => {
    mafiaGameStore.setEatFirstCallEliminationHost(eat && host && !view);
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
    // The Mafia speaking-hint timer is owned by `useMafiaSpeakingHint`
    // (inside `MafiaCallAdapter`); the composable's own `onBeforeUnmount`
    // clears it. A leftover reference here from before the Phase 2A
    // extraction was throwing a `ReferenceError` at unmount and aborting
    // the rest of this hook — including `leaveCall()` below.
    callRoomHeaderJoin.reset();
    mafiaPlayersStore.reset();
    mafiaGameStore.fullReset();
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
const __VLS_defaults = { mafiaStreamView: false, eatFirstStreamView: false };
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
            'call-page__active--with-dock': (__VLS_ctx.session.inCall || __VLS_ctx.joining) && !__VLS_ctx.mafiaViewUi && !__VLS_ctx.eatFirstViewUi,
            'call-page__active--with-mafia-bottom': __VLS_ctx.isMafiaRoute && (__VLS_ctx.session.inCall || __VLS_ctx.joining) && !__VLS_ctx.mafiaViewUi,
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
    [joining, joining, joining, joining, joining, t, t, mediaDebugPanelEnabled, session, session, session, roomJoinDraft, videoQualityChoice, callDebugOverlay, callRoomHeaderJoin, roomCopyFlash, allowManualVideoQuality, showCallDebugControls, isAdmin, wsStatus, qualityPresets, submitRoomDraft, copyRoomToClipboard, onGenerateNewRoom, stageFullBleed, mafiaViewUi, mafiaViewUi, eatFirstViewUi, isMafiaRoute, joinError, joinError, retryJoinCall,];
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
if (__VLS_ctx.session.inCall && !__VLS_ctx.mafiaViewUi && !__VLS_ctx.eatFirstViewUi && __VLS_ctx.callChatInboundToasts.length > 0) {
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
                __VLS_ctx.onMafiaHostTileClick($event, row);
                // @ts-ignore
                [session, mafiaViewUi, eatFirstViewUi, callToasts, callChatInboundToasts, callChatInboundToasts, openChatFromInboundToast, dismissCallChatInboundToast, resumeCallAudioAnalysisFromGesture, layoutMode, gridStyle, orderedGridRows, onTilePointerDownForDrag, onMafiaHostTileClick,];
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
                'call-page__tile-wrap--mafia-host-target': __VLS_ctx.isMafiaRoute &&
                    !__VLS_ctx.mafiaViewUi &&
                    __VLS_ctx.mafiaGameStore.isMafiaHost &&
                    __VLS_ctx.mafiaGameStore.hostInteractionMode === 'night' &&
                    __VLS_ctx.isMafiaHostNightActionSeat(__VLS_ctx.mafiaNumberByPeer.get(row.tile.peerId)),
                'call-page__tile-wrap--mafia-host-speaking-queued': __VLS_ctx.isMafiaRoute &&
                    __VLS_ctx.isMafiaHostSpeakingNominationUiSeat(__VLS_ctx.mafiaNumberByPeer.get(row.tile.peerId)),
                'call-page__tile-wrap--eat-first-host-speaking-seat': __VLS_ctx.isEatFirstRoute &&
                    !__VLS_ctx.eatFirstViewUi &&
                    __VLS_ctx.isEatFirstHostSpeakingNominationSeat(__VLS_ctx.eatFirstNominationNumberForPeer(row.tile.peerId)),
                'call-page__tile-wrap--mafia-host-mode': __VLS_ctx.isMafiaRoute && !__VLS_ctx.mafiaViewUi && __VLS_ctx.mafiaGameStore.isMafiaHost,
                'call-page__tile-wrap--mafia-host-mode-speaking': __VLS_ctx.isMafiaRoute &&
                    !__VLS_ctx.mafiaViewUi &&
                    __VLS_ctx.mafiaGameStore.isMafiaHost &&
                    __VLS_ctx.mafiaGameStore.hostInteractionMode === 'speaking',
                'call-page__tile-wrap--mafia-host-mode-swap': __VLS_ctx.isMafiaRoute &&
                    !__VLS_ctx.mafiaViewUi &&
                    __VLS_ctx.mafiaGameStore.isMafiaHost &&
                    __VLS_ctx.mafiaGameStore.hostInteractionMode === 'swap',
                'call-page__tile-wrap--mafia-swap-selected': __VLS_ctx.isMafiaRoute &&
                    !__VLS_ctx.mafiaViewUi &&
                    __VLS_ctx.mafiaGameStore.isMafiaHost &&
                    __VLS_ctx.mafiaGameStore.hostInteractionMode === 'swap' &&
                    __VLS_ctx.mafiaGameStore.hostSeatSwapSelectionPeerId === row.tile.peerId,
                'call-page__tile-wrap--mafia-cursor-default': __VLS_ctx.isMafiaRoute && (__VLS_ctx.mafiaViewUi || !__VLS_ctx.mafiaGameStore.isMafiaHost),
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
    /** @type {__VLS_StyleScopedClasses['call-page__tile-wrap--mafia-host-target']} */ ;
    /** @type {__VLS_StyleScopedClasses['call-page__tile-wrap--mafia-host-speaking-queued']} */ ;
    /** @type {__VLS_StyleScopedClasses['call-page__tile-wrap--eat-first-host-speaking-seat']} */ ;
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
        ...{ 'onMafiaToggleLife': {} },
        ...{ 'onMafiaForceCameraOff': {} },
        ...{ 'onMafiaSetEliminationBackground': {} },
        ...{ 'onMafiaViewportLayers': {} },
        ...{ 'onRemotePlaybackStall': {} },
        ...{ 'onVideoStall': {} },
        ...{ 'onAudioStall': {} },
        ...{ 'onEatFirstRevealTrait': {} },
        ...{ 'onEatFirstGenerateTrait': {} },
        ...{ 'onEatFirstRerollActionCard': {} },
        ...{ 'onEatFirstUseActionCard': {} },
        ...{ class: "call-page__tile-inner" },
        peerId: (row.tile.peerId),
        displayName: (row.displayName),
        avatarFallbackName: (__VLS_ctx.peerAvatarFallbackName(row.tile.peerId)),
        canEditDisplayName: (__VLS_ctx.canEditTileDisplayName(row.tile.peerId)),
        mafiaSeatIndex: (__VLS_ctx.isMafiaRoute
            ? __VLS_ctx.mafiaNumberByPeer.get(row.tile.peerId)
            : __VLS_ctx.isEatFirstRoute
                ? __VLS_ctx.eatFirstDisplayOrderByPeer.get(row.tile.peerId)
                : undefined),
        mafiaVisibleRole: (__VLS_ctx.isMafiaRoute && !__VLS_ctx.mafiaViewUi ? __VLS_ctx.mafiaGameStore.getMafiaRoleVisibleForTile(row.tile.peerId) : undefined),
        streamViewMode: (__VLS_ctx.mafiaViewUi || __VLS_ctx.eatFirstViewUi),
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
        mafiaLifeState: (__VLS_ctx.isMafiaRoute || __VLS_ctx.isEatFirstRoute ? __VLS_ctx.mafiaGameStore.lifeStateForPeer(row.tile.peerId) : 'alive'),
        eatFirstTraits: (__VLS_ctx.isEatFirstRoute ? __VLS_ctx.eatFirstTraitsForPeer(row.tile.peerId) : undefined),
        eatFirstTraitHostView: (__VLS_ctx.isEatFirstRoute ? __VLS_ctx.eatFirstTraitHostView() : false),
        eatFirstTraitOwnerView: (__VLS_ctx.isEatFirstRoute ? __VLS_ctx.eatFirstTraitOwnerView(row.tile.peerId) : false),
        eatFirstRevealedTraitKeys: (__VLS_ctx.isEatFirstRoute ? __VLS_ctx.eatFirstRevealedTraitsForPeer(row.tile.peerId) : []),
        eatFirstActionCard: (__VLS_ctx.isEatFirstRoute ? __VLS_ctx.eatFirstActionCardForPeer(row.tile.peerId) : null),
        mafiaEliminationIconSrc: (__VLS_ctx.mafiaEliminatedPlayerIconForTile(row.tile.peerId)),
        mafiaEliminationBackground: (__VLS_ctx.mafiaGameStore.eliminationBackgroundForPeer(row.tile.peerId)),
        mafiaDeadBackgroundUrl: (__VLS_ctx.isMafiaRoute || __VLS_ctx.isEatFirstRoute ? __VLS_ctx.mafiaGameStore.activeDeadBackgroundUrl() : null),
        mafiaHostShowLifeToggle: ((__VLS_ctx.isMafiaRoute && !__VLS_ctx.mafiaViewUi && __VLS_ctx.mafiaGameStore.isMafiaHost) ||
            (__VLS_ctx.isEatFirstRoute && !__VLS_ctx.eatFirstViewUi && __VLS_ctx.eatFirstShell.isEatFirstRoomHost)),
        mafiaLayerViewportObserve: (__VLS_ctx.isCallAppRoute && !row.tile.isLocal),
        videoPlaybackSuppressed: (!row.tile.isLocal && __VLS_ctx.videoPlaybackSuppressedForPeer(row.tile.peerId)),
        videoTargetPlaybackFps: (__VLS_ctx.remoteVideoTargetPlaybackFpsForPeer(row.tile.peerId)),
    }));
    const __VLS_48 = __VLS_47({
        ...{ 'onUpdate:listenVolume': {} },
        ...{ 'onUpdate:listenMuted': {} },
        ...{ 'onCommitLocalDisplayName': {} },
        ...{ 'onMafiaToggleLife': {} },
        ...{ 'onMafiaForceCameraOff': {} },
        ...{ 'onMafiaSetEliminationBackground': {} },
        ...{ 'onMafiaViewportLayers': {} },
        ...{ 'onRemotePlaybackStall': {} },
        ...{ 'onVideoStall': {} },
        ...{ 'onAudioStall': {} },
        ...{ 'onEatFirstRevealTrait': {} },
        ...{ 'onEatFirstGenerateTrait': {} },
        ...{ 'onEatFirstRerollActionCard': {} },
        ...{ 'onEatFirstUseActionCard': {} },
        ...{ class: "call-page__tile-inner" },
        peerId: (row.tile.peerId),
        displayName: (row.displayName),
        avatarFallbackName: (__VLS_ctx.peerAvatarFallbackName(row.tile.peerId)),
        canEditDisplayName: (__VLS_ctx.canEditTileDisplayName(row.tile.peerId)),
        mafiaSeatIndex: (__VLS_ctx.isMafiaRoute
            ? __VLS_ctx.mafiaNumberByPeer.get(row.tile.peerId)
            : __VLS_ctx.isEatFirstRoute
                ? __VLS_ctx.eatFirstDisplayOrderByPeer.get(row.tile.peerId)
                : undefined),
        mafiaVisibleRole: (__VLS_ctx.isMafiaRoute && !__VLS_ctx.mafiaViewUi ? __VLS_ctx.mafiaGameStore.getMafiaRoleVisibleForTile(row.tile.peerId) : undefined),
        streamViewMode: (__VLS_ctx.mafiaViewUi || __VLS_ctx.eatFirstViewUi),
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
        mafiaLifeState: (__VLS_ctx.isMafiaRoute || __VLS_ctx.isEatFirstRoute ? __VLS_ctx.mafiaGameStore.lifeStateForPeer(row.tile.peerId) : 'alive'),
        eatFirstTraits: (__VLS_ctx.isEatFirstRoute ? __VLS_ctx.eatFirstTraitsForPeer(row.tile.peerId) : undefined),
        eatFirstTraitHostView: (__VLS_ctx.isEatFirstRoute ? __VLS_ctx.eatFirstTraitHostView() : false),
        eatFirstTraitOwnerView: (__VLS_ctx.isEatFirstRoute ? __VLS_ctx.eatFirstTraitOwnerView(row.tile.peerId) : false),
        eatFirstRevealedTraitKeys: (__VLS_ctx.isEatFirstRoute ? __VLS_ctx.eatFirstRevealedTraitsForPeer(row.tile.peerId) : []),
        eatFirstActionCard: (__VLS_ctx.isEatFirstRoute ? __VLS_ctx.eatFirstActionCardForPeer(row.tile.peerId) : null),
        mafiaEliminationIconSrc: (__VLS_ctx.mafiaEliminatedPlayerIconForTile(row.tile.peerId)),
        mafiaEliminationBackground: (__VLS_ctx.mafiaGameStore.eliminationBackgroundForPeer(row.tile.peerId)),
        mafiaDeadBackgroundUrl: (__VLS_ctx.isMafiaRoute || __VLS_ctx.isEatFirstRoute ? __VLS_ctx.mafiaGameStore.activeDeadBackgroundUrl() : null),
        mafiaHostShowLifeToggle: ((__VLS_ctx.isMafiaRoute && !__VLS_ctx.mafiaViewUi && __VLS_ctx.mafiaGameStore.isMafiaHost) ||
            (__VLS_ctx.isEatFirstRoute && !__VLS_ctx.eatFirstViewUi && __VLS_ctx.eatFirstShell.isEatFirstRoomHost)),
        mafiaLayerViewportObserve: (__VLS_ctx.isCallAppRoute && !row.tile.isLocal),
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
    const __VLS_55 = ({ mafiaToggleLife: {} },
        { onMafiaToggleLife: (...[$event]) => {
                __VLS_ctx.onMafiaToggleLifeFromTile(row.tile.peerId);
                // @ts-ignore
                [t, t, mafiaViewUi, mafiaViewUi, mafiaViewUi, mafiaViewUi, mafiaViewUi, mafiaViewUi, mafiaViewUi, mafiaViewUi, mafiaViewUi, eatFirstViewUi, eatFirstViewUi, eatFirstViewUi, isMafiaRoute, isMafiaRoute, isMafiaRoute, isMafiaRoute, isMafiaRoute, isMafiaRoute, isMafiaRoute, isMafiaRoute, isMafiaRoute, isMafiaRoute, isMafiaRoute, isMafiaRoute, layoutMode, layoutMode, onTileDragEnd, setTileWrapRef, tileLayoutStyle, canReorderTiles, canReorderTiles, canReorderTiles, spotlightPeerId, spotlightPeerId, isSpotlightStripPeerHidden, pinnedPeerId, dragOverPeerId, dragPeerId, mafiaGameStore, mafiaGameStore, mafiaGameStore, mafiaGameStore, mafiaGameStore, mafiaGameStore, mafiaGameStore, mafiaGameStore, mafiaGameStore, mafiaGameStore, mafiaGameStore, mafiaGameStore, mafiaGameStore, mafiaGameStore, mafiaGameStore, mafiaGameStore, isMafiaHostNightActionSeat, mafiaNumberByPeer, mafiaNumberByPeer, mafiaNumberByPeer, isMafiaHostSpeakingNominationUiSeat, isEatFirstRoute, isEatFirstRoute, isEatFirstRoute, isEatFirstRoute, isEatFirstRoute, isEatFirstRoute, isEatFirstRoute, isEatFirstRoute, isEatFirstRoute, isEatFirstRoute, isEatFirstHostSpeakingNominationSeat, eatFirstNominationNumberForPeer, isTileRowSpeaking, isTileRowSpeaking, peerAvatarFallbackName, canEditTileDisplayName, eatFirstDisplayOrderByPeer, sizeTier, eatFirstTraitsForPeer, eatFirstTraitHostView, eatFirstTraitOwnerView, eatFirstRevealedTraitsForPeer, eatFirstActionCardForPeer, mafiaEliminatedPlayerIconForTile, eatFirstShell, isCallAppRoute, videoPlaybackSuppressedForPeer, remoteVideoTargetPlaybackFpsForPeer, remoteListenVolumeHandler, remoteListenMutedHandler, onCommitLocalTileDisplayName, onMafiaToggleLifeFromTile,];
            } });
    const __VLS_56 = ({ mafiaForceCameraOff: {} },
        { onMafiaForceCameraOff: (...[$event]) => {
                __VLS_ctx.onMafiaForceCameraOffFromTile(row.tile.peerId);
                // @ts-ignore
                [onMafiaForceCameraOffFromTile,];
            } });
    const __VLS_57 = ({ mafiaSetEliminationBackground: {} },
        { onMafiaSetEliminationBackground: (__VLS_ctx.onMafiaSetEliminationBackground) });
    const __VLS_58 = ({ mafiaViewportLayers: {} },
        { onMafiaViewportLayers: ((v) => __VLS_ctx.onCallTileViewportForLayers(row.tile.peerId, v)) });
    const __VLS_59 = ({ remotePlaybackStall: {} },
        { onRemotePlaybackStall: (__VLS_ctx.onRemotePlaybackStall) });
    const __VLS_60 = ({ videoStall: {} },
        { onVideoStall: (__VLS_ctx.onTileVideoStall) });
    const __VLS_61 = ({ audioStall: {} },
        { onAudioStall: (__VLS_ctx.onTileAudioStall) });
    const __VLS_62 = ({ eatFirstRevealTrait: {} },
        { onEatFirstRevealTrait: (__VLS_ctx.onEatFirstRevealTrait) });
    const __VLS_63 = ({ eatFirstGenerateTrait: {} },
        { onEatFirstGenerateTrait: (__VLS_ctx.onEatFirstGenerateTrait) });
    const __VLS_64 = ({ eatFirstRerollActionCard: {} },
        { onEatFirstRerollActionCard: (__VLS_ctx.onEatFirstRerollActionCard) });
    const __VLS_65 = ({ eatFirstUseActionCard: {} },
        { onEatFirstUseActionCard: (__VLS_ctx.onEatFirstPlayerUseActionCard) });
    /** @type {__VLS_StyleScopedClasses['call-page__tile-inner']} */ ;
    var __VLS_49;
    var __VLS_50;
    if (!__VLS_ctx.mafiaViewUi && !__VLS_ctx.eatFirstViewUi) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(!__VLS_ctx.mafiaViewUi && !__VLS_ctx.eatFirstViewUi))
                        return;
                    __VLS_ctx.togglePin(row.tile.peerId);
                    // @ts-ignore
                    [mafiaViewUi, eatFirstViewUi, onMafiaSetEliminationBackground, onCallTileViewportForLayers, onRemotePlaybackStall, onTileVideoStall, onTileAudioStall, onEatFirstRevealTrait, onEatFirstGenerateTrait, onEatFirstRerollActionCard, onEatFirstPlayerUseActionCard, togglePin,];
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
            src: (__VLS_ctx.pinnedPeerId === row.tile.peerId ? __VLS_ctx.mafiaTilePinActiveIcon : __VLS_ctx.mafiaTilePinIcon),
            alt: "",
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['call-page__pin-icon']} */ ;
    }
    // @ts-ignore
    [t, t, t, t, pinnedPeerId, pinnedPeerId, pinnedPeerId, pinnedPeerId, pinnedPeerId, mafiaTilePinActiveIcon, mafiaTilePinIcon,];
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
if ((__VLS_ctx.session.inCall || __VLS_ctx.joining) && !__VLS_ctx.mafiaViewUi && !__VLS_ctx.eatFirstViewUi) {
    const __VLS_66 = GameRoomCallBottomCluster || GameRoomCallBottomCluster;
    // @ts-ignore
    const __VLS_67 = __VLS_asFunctionalComponent1(__VLS_66, new __VLS_66({}));
    const __VLS_68 = __VLS_67({}, ...__VLS_functionalComponentArgsRest(__VLS_67));
    const { default: __VLS_71 } = __VLS_69.slots;
    {
        const { 'host-actions': __VLS_72 } = __VLS_69.slots;
        if (__VLS_ctx.isMafiaRoute && __VLS_ctx.mafiaGameStore.isMafiaHost) {
            const __VLS_73 = MafiaHostActionsBar;
            // @ts-ignore
            const __VLS_74 = __VLS_asFunctionalComponent1(__VLS_73, new __VLS_73({
                ...{ 'onForceMuteAll': {} },
            }));
            const __VLS_75 = __VLS_74({
                ...{ 'onForceMuteAll': {} },
            }, ...__VLS_functionalComponentArgsRest(__VLS_74));
            let __VLS_78;
            const __VLS_79 = ({ forceMuteAll: {} },
                { onForceMuteAll: (__VLS_ctx.onMafiaForceMuteAll) });
            var __VLS_76;
            var __VLS_77;
        }
        if (__VLS_ctx.isEatFirstRoute && __VLS_ctx.eatFirstShell.isEatFirstRoomHost) {
            const __VLS_80 = EatFirstHostActionsBar;
            // @ts-ignore
            const __VLS_81 = __VLS_asFunctionalComponent1(__VLS_80, new __VLS_80({
                ...{ 'onForceMuteAll': {} },
                ...{ 'onReshuffle': {} },
            }));
            const __VLS_82 = __VLS_81({
                ...{ 'onForceMuteAll': {} },
                ...{ 'onReshuffle': {} },
            }, ...__VLS_functionalComponentArgsRest(__VLS_81));
            let __VLS_85;
            const __VLS_86 = ({ forceMuteAll: {} },
                { onForceMuteAll: (__VLS_ctx.onEatFirstForceMuteAll) });
            const __VLS_87 = ({ reshuffle: {} },
                { onReshuffle: (__VLS_ctx.onEatFirstReshuffle) });
            var __VLS_83;
            var __VLS_84;
        }
        // @ts-ignore
        [joining, session, mafiaViewUi, eatFirstViewUi, isMafiaRoute, layoutMode, mafiaGameStore, isEatFirstRoute, eatFirstShell, spotlightOverflowCount, spotlightOverflowCount, spotlightOverflowTileStyle, onMafiaForceMuteAll, onEatFirstForceMuteAll, onEatFirstReshuffle,];
    }
    {
        const { dock: __VLS_88 } = __VLS_69.slots;
        const __VLS_89 = CallControlsDock;
        // @ts-ignore
        const __VLS_90 = __VLS_asFunctionalComponent1(__VLS_89, new __VLS_89({
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
        const __VLS_91 = __VLS_90({
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
        }, ...__VLS_functionalComponentArgsRest(__VLS_90));
        let __VLS_94;
        const __VLS_95 = ({ toggleMic: {} },
            { onToggleMic: (__VLS_ctx.toggleMic) });
        const __VLS_96 = ({ toggleCam: {} },
            { onToggleCam: (__VLS_ctx.toggleCam) });
        const __VLS_97 = ({ toggleDeafen: {} },
            { onToggleDeafen: (__VLS_ctx.toggleCallDeafen) });
        const __VLS_98 = ({ toggleRaiseHand: {} },
            { onToggleRaiseHand: (__VLS_ctx.toggleRaiseHand) });
        const __VLS_99 = ({ toggleScreenShare: {} },
            { onToggleScreenShare: (__VLS_ctx.toggleScreenShare) });
        const __VLS_100 = ({ leave: {} },
            { onLeave: (__VLS_ctx.leaveCall) });
        const __VLS_101 = ({ pickAudioInput: {} },
            { onPickAudioInput: (__VLS_ctx.pickAudioInput) });
        const __VLS_102 = ({ pickVideoInput: {} },
            { onPickVideoInput: (__VLS_ctx.pickVideoInput) });
        const __VLS_103 = ({ pickAudioOutput: {} },
            { onPickAudioOutput: (__VLS_ctx.pickAudioOutput) });
        var __VLS_104 = {};
        var __VLS_92;
        var __VLS_93;
        // @ts-ignore
        [joining, micPickerOpen, camPickerOpen, speakerPickerOpen, chatOpen, micEnabled, camEnabled, callDeafened, handRaised, screenSharing, showMediaDevicePickers, audioInputDevices, videoInputDevices, audioOutputDevices, localAudioInputDeviceId, localVideoInputDeviceId, localAudioOutputDeviceId, toggleMic, toggleCam, toggleCallDeafen, toggleRaiseHand, toggleScreenShare, leaveCall, pickAudioInput, pickVideoInput, pickAudioOutput,];
    }
    {
        const { 'speaking-queue': __VLS_106 } = __VLS_69.slots;
        if (__VLS_ctx.isMafiaRoute) {
            const __VLS_107 = MafiaSpeakingQueueBar;
            // @ts-ignore
            const __VLS_108 = __VLS_asFunctionalComponent1(__VLS_107, new __VLS_107({
                showTools: (__VLS_ctx.mafiaGameStore.isMafiaHost),
            }));
            const __VLS_109 = __VLS_108({
                showTools: (__VLS_ctx.mafiaGameStore.isMafiaHost),
            }, ...__VLS_functionalComponentArgsRest(__VLS_108));
        }
        if (__VLS_ctx.isEatFirstRoute) {
            const __VLS_112 = EatFirstSpeakingQueueBar;
            // @ts-ignore
            const __VLS_113 = __VLS_asFunctionalComponent1(__VLS_112, new __VLS_112({
                showTools: (__VLS_ctx.eatFirstShell.isEatFirstRoomHost),
            }));
            const __VLS_114 = __VLS_113({
                showTools: (__VLS_ctx.eatFirstShell.isEatFirstRoomHost),
            }, ...__VLS_functionalComponentArgsRest(__VLS_113));
        }
        // @ts-ignore
        [isMafiaRoute, mafiaGameStore, isEatFirstRoute, eatFirstShell,];
    }
    // @ts-ignore
    [];
    var __VLS_69;
}
if ((__VLS_ctx.session.inCall || __VLS_ctx.joining) && __VLS_ctx.mafiaViewUi && __VLS_ctx.isMafiaRoute) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "call-page__mafia-view-bottom" },
    });
    /** @type {__VLS_StyleScopedClasses['call-page__mafia-view-bottom']} */ ;
    const __VLS_117 = MafiaSpeakingQueueBar;
    // @ts-ignore
    const __VLS_118 = __VLS_asFunctionalComponent1(__VLS_117, new __VLS_117({
        showTools: (false),
    }));
    const __VLS_119 = __VLS_118({
        showTools: (false),
    }, ...__VLS_functionalComponentArgsRest(__VLS_118));
}
if (__VLS_ctx.session.inCall && !__VLS_ctx.mafiaViewUi && !__VLS_ctx.eatFirstViewUi) {
    const __VLS_122 = CallChatPanel;
    // @ts-ignore
    const __VLS_123 = __VLS_asFunctionalComponent1(__VLS_122, new __VLS_122({
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
    const __VLS_124 = __VLS_123({
        ...{ 'onSend': {} },
        ...{ 'onDragPointerDown': {} },
        ...{ 'onResizePointerDown': {} },
        open: (__VLS_ctx.chatOpen),
        messages: (__VLS_ctx.callChatMessages),
        selfPeerId: (__VLS_ctx.selfPeerId),
        panelClass: (__VLS_ctx.chatPanelClass),
        panelStyle: (__VLS_ctx.chatPanelStyle),
        displayNameForPeer: (__VLS_ctx.peerDisplayName),
    }, ...__VLS_functionalComponentArgsRest(__VLS_123));
    let __VLS_127;
    const __VLS_128 = ({ send: {} },
        { onSend: (__VLS_ctx.sendChatMessage) });
    const __VLS_129 = ({ dragPointerDown: {} },
        { onDragPointerDown: (__VLS_ctx.onChatPanelDragPointerDown) });
    const __VLS_130 = ({ resizePointerDown: {} },
        { onResizePointerDown: (__VLS_ctx.onChatPanelResizePointerDown) });
    var __VLS_125;
    var __VLS_126;
}
if (__VLS_ctx.session.callDebugOverlay && __VLS_ctx.showCallDebugControls && !__VLS_ctx.mafiaViewUi && !__VLS_ctx.eatFirstViewUi) {
    const __VLS_131 = GameRoomCallDebugOverlay;
    // @ts-ignore
    const __VLS_132 = __VLS_asFunctionalComponent1(__VLS_131, new __VLS_131({
        ...{ 'onRefresh': {} },
        snapshot: (__VLS_ctx.callDebugSnapshot),
        inboundRows: (__VLS_ctx.inboundDebugRows),
        inboundBusy: (__VLS_ctx.inboundDebugBusy),
    }));
    const __VLS_133 = __VLS_132({
        ...{ 'onRefresh': {} },
        snapshot: (__VLS_ctx.callDebugSnapshot),
        inboundRows: (__VLS_ctx.inboundDebugRows),
        inboundBusy: (__VLS_ctx.inboundDebugBusy),
    }, ...__VLS_functionalComponentArgsRest(__VLS_132));
    let __VLS_136;
    const __VLS_137 = ({ refresh: {} },
        { onRefresh: (__VLS_ctx.refreshInboundDebug) });
    var __VLS_134;
    var __VLS_135;
}
// @ts-ignore
[joining, session, session, session, showCallDebugControls, mafiaViewUi, mafiaViewUi, mafiaViewUi, eatFirstViewUi, eatFirstViewUi, isMafiaRoute, chatOpen, callChatMessages, selfPeerId, chatPanelClass, chatPanelStyle, peerDisplayName, sendChatMessage, onChatPanelDragPointerDown, onChatPanelResizePointerDown, callDebugSnapshot, inboundDebugRows, inboundDebugBusy, refreshInboundDebug,];
var __VLS_22;
// @ts-ignore
var __VLS_105 = __VLS_104;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
