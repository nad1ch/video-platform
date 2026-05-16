import { computed, nextTick, shallowRef, ref } from 'vue';
import { ensureDisplayCaptureVideoTrackEnabled } from './displayCaptureVideoTrack';
import { pickOutboundCameraVideoTrack } from './outboundCameraTrack';
import { localPreviewStreamForOutbound } from './previewStream';
/**
 * Display capture for outbound `replaceTrack` on the existing video producer.
 */
export const SCREEN_SHARE_GET_DISPLAY_MEDIA = {
    audio: false,
    video: {
        frameRate: { ideal: 15, max: 30 },
    },
};
function stopAllTracks(stream) {
    if (!stream) {
        return;
    }
    for (const t of stream.getTracks()) {
        try {
            t.stop();
        }
        catch {
            /* ignore */
        }
    }
}
export function useCallScreenShare(deps) {
    const outboundVideoSource = ref('none');
    const screenShareStream = shallowRef(null);
    let detachScreenTrackEnded = null;
    const stoppingScreenShare = ref(false);
    let startOperationInFlight = false;
    /** Serialize start / stop / browser-ended. */
    let opChain = Promise.resolve();
    const screenTrack = computed(() => screenShareStream.value?.getVideoTracks()[0] ?? null);
    const screenSharing = computed(() => outboundVideoSource.value === 'screen');
    const activePreviewStream = computed(() => {
        void deps.localPlayRev.value;
        return localPreviewStreamForOutbound(outboundVideoSource.value, screenShareStream.value, deps.localStream.value);
    });
    function bumpPlayRev() {
        deps.localPlayRev.value += 1;
    }
    function enqueue(fn) {
        const job = opChain.then(() => fn());
        opChain = job.then(() => undefined, () => undefined);
        return job;
    }
    function attachScreenTrackEndedListener(track) {
        detachScreenTrackEnded?.();
        const onEnded = () => {
            void enqueue(() => stopScreenShareBody());
        };
        track.addEventListener('ended', onEnded, { once: true });
        detachScreenTrackEnded = () => {
            track.removeEventListener('ended', onEnded);
            detachScreenTrackEnded = null;
        };
    }
    function applyCamStateForOutbound() {
        if (outboundVideoSource.value === 'screen') {
            return;
        }
        const live = pickOutboundCameraVideoTrack(deps.localStream.value);
        outboundVideoSource.value =
            deps.camEnabled.value && live !== undefined && live.readyState === 'live' && live.enabled
                ? 'camera'
                : 'none';
    }
    async function stopScreenShareBody() {
        if (stoppingScreenShare.value) {
            return;
        }
        if (outboundVideoSource.value !== 'screen' && !screenShareStream.value) {
            return;
        }
        stoppingScreenShare.value = true;
        detachScreenTrackEnded?.();
        detachScreenTrackEnded = null;
        const dm = screenShareStream.value;
        try {
            await deps.ensureOutboundCameraTrack?.();
            const liveCam = pickOutboundCameraVideoTrack(deps.localStream.value);
            /** Prefer attaching any **live** local video track to the producer (even if `enabled === false`); server pause mirrors “cam off”. */
            const hasLiveLocalVideo = liveCam !== undefined && liveCam.readyState === 'live';
            if (import.meta.env.DEV) {
                const vs = deps.localStream.value?.getVideoTracks() ?? [];
                console.log('[call-screen-share] stop restore candidates', {
                    localVideoTrackIds: vs.map((t) => ({ id: t.id, label: t.label, readyState: t.readyState, enabled: t.enabled })),
                    pickedForReplace: liveCam
                        ? { id: liveCam.id, label: liveCam.label, readyState: liveCam.readyState, enabled: liveCam.enabled }
                        : null,
                    hasLiveLocalVideo,
                });
            }
            if (hasLiveLocalVideo && liveCam) {
                const producerId = await deps.replaceOutboundVideoTrack(liveCam);
                await nextTick();
                deps.notifyProducerVideoSource(producerId, 'camera');
                outboundVideoSource.value =
                    deps.camEnabled.value && liveCam.enabled
                        ? 'camera'
                        : 'none';
            }
            else {
                const producerId = await deps.replaceOutboundVideoTrack(null);
                await nextTick();
                deps.notifyProducerVideoSource(producerId, 'camera');
                outboundVideoSource.value = 'none';
            }
            if (dm) {
                stopAllTracks(dm);
            }
            screenShareStream.value = null;
            bumpPlayRev();
            if (import.meta.env.DEV) {
                const preview = localPreviewStreamForOutbound(outboundVideoSource.value, screenShareStream.value, deps.localStream.value);
                const pv = preview?.getVideoTracks()?.[0];
                console.log('[call-screen-share] stopped', {
                    outbound: outboundVideoSource.value,
                    previewFirstVideo: pv
                        ? { id: pv.id, label: pv.label, readyState: pv.readyState }
                        : null,
                });
            }
        }
        catch {
            if (dm) {
                stopAllTracks(dm);
            }
            screenShareStream.value = null;
            // Pre-set the source to 'none' BEFORE attempting recovery. If recovery
            // succeeds we overwrite below with the actual outcome ('camera' or 'none');
            // if recovery throws (producer torn down, transport closed, etc.) the
            // outer catch's silent swallow no longer leaves outboundVideoSource stuck
            // at 'screen' with a null screenShareStream — that mismatch previously
            // caused remotes to see frozen frames while UI still reported screen-share.
            outboundVideoSource.value = 'none';
            try {
                await deps.ensureOutboundCameraTrack?.();
                const liveCam = pickOutboundCameraVideoTrack(deps.localStream.value);
                if (liveCam && liveCam.readyState === 'live') {
                    const producerId = await deps.replaceOutboundVideoTrack(liveCam);
                    deps.notifyProducerVideoSource(producerId, 'camera');
                    outboundVideoSource.value =
                        deps.camEnabled.value && liveCam.enabled ? 'camera' : 'none';
                }
                else {
                    const producerId = await deps.replaceOutboundVideoTrack(null);
                    deps.notifyProducerVideoSource(producerId, 'camera');
                    outboundVideoSource.value = 'none';
                }
            }
            catch {
                /* producer torn down — outboundVideoSource already reset to 'none' above */
            }
            bumpPlayRev();
        }
        finally {
            stoppingScreenShare.value = false;
        }
    }
    async function startScreenShareBody() {
        if (!deps.canShareScreen() || startOperationInFlight || outboundVideoSource.value === 'screen') {
            return;
        }
        startOperationInFlight = true;
        try {
            if (import.meta.env.DEV) {
                const vs = deps.localStream.value?.getVideoTracks() ?? [];
                console.log('[call-screen-share] start (local camera before capture)', {
                    localVideoTrackIds: vs.map((t) => ({
                        id: t.id,
                        label: t.label,
                        readyState: t.readyState,
                        enabled: t.enabled,
                    })),
                });
            }
            const dm = await navigator.mediaDevices.getDisplayMedia(SCREEN_SHARE_GET_DISPLAY_MEDIA);
            const vt = dm.getVideoTracks()[0];
            if (!vt) {
                stopAllTracks(dm);
                return;
            }
            vt.enabled = true;
            screenShareStream.value = dm;
            attachScreenTrackEndedListener(vt);
            outboundVideoSource.value = 'screen';
            bumpPlayRev();
            await nextTick();
            const producerId = await deps.replaceOutboundVideoTrack(vt);
            vt.enabled = true;
            ensureDisplayCaptureVideoTrackEnabled(vt);
            await nextTick();
            deps.notifyProducerVideoSource(producerId, 'screen');
            bumpPlayRev();
            if (import.meta.env.DEV) {
                console.log('[call-screen-share] started', {
                    producerId,
                    trackId: vt.id,
                    readyState: vt.readyState,
                    enabled: vt.enabled,
                });
            }
        }
        catch {
            const orphan = screenShareStream.value;
            if (orphan) {
                stopAllTracks(orphan);
            }
            detachScreenTrackEnded?.();
            detachScreenTrackEnded = null;
            screenShareStream.value = null;
            applyCamStateForOutbound();
        }
        finally {
            startOperationInFlight = false;
        }
    }
    function stopScreenShare() {
        return enqueue(() => stopScreenShareBody());
    }
    function toggleScreenShare() {
        if (!deps.canShareScreen()) {
            return Promise.resolve();
        }
        return enqueue(async () => {
            if (outboundVideoSource.value === 'screen') {
                await stopScreenShareBody();
            }
            else {
                await startScreenShareBody();
            }
        });
    }
    function teardownScreenShare() {
        detachScreenTrackEnded?.();
        detachScreenTrackEnded = null;
        stopAllTracks(screenShareStream.value);
        screenShareStream.value = null;
        outboundVideoSource.value = 'none';
        stoppingScreenShare.value = false;
        startOperationInFlight = false;
        opChain = Promise.resolve();
    }
    return {
        outboundVideoSource,
        screenSharing,
        screenShareStream,
        screenTrack,
        activePreviewStream,
        stoppingScreenShare,
        stopScreenShare,
        toggleScreenShare,
        teardownScreenShare,
        applyCamStateForOutbound,
    };
}
export { useCallScreenShare as useScreenShare };
