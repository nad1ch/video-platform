import { computed, onMounted, onUnmounted, provide, ref, watch, } from 'vue';
import { applyCallAudioOutputSinkToStreamAudios, CALL_AUDIO_OUTPUT_DEVICE_ID_KEY, } from '@/audio/callAudioOutputInjection';
import { CALL_ROOM_DROPDOWN_HOST_ID, CALL_ROOM_POPOVER_PANEL_ID, } from '@/stores/callRoomHeaderJoin';
/**
 * Block 24 — pure media-device-picker composable extracted from `CallPage.vue`
 * and `GameTemplateCallPage.vue`. Both routes carried this code
 * byte-equivalently — three picker-open refs, the audio-output LS read/write,
 * the audio-output sink-apply watcher, the show-pickers gate, the
 * close-pickers helper, the `pointerdown`-outside-closes-pickers listener,
 * and the three async `pick*` helpers.
 *
 * Scope:
 *   - mic / cam / speaker picker open refs (the page binds them via
 *     `v-model:mic-picker-open` etc. on `<CallControlsDock>`)
 *   - `callAudioOutputDeviceId` — provide()d to `<StreamAudio>` descendants
 *     via `CALL_AUDIO_OUTPUT_DEVICE_ID_KEY` (call-core injection contract)
 *   - `localAudioOutputDeviceId` — computed (last-picked beats LS-restored,
 *     both filtered against the live `audioOutputDevices` list)
 *   - LS persistence: `streamassist_call_audio_out_v1`
 *   - `showMediaDevicePickers` — the dock-mounted gate
 *   - `onDocumentPointerForDevicePickers` — outside-click closer; also
 *     closes the call-room popover when the click lands outside of its
 *     dropdown host / panel
 *   - `pickAudioInput` / `pickVideoInput` / `pickAudioOutput`
 *
 * Cleanup:
 *   - `onMounted` attaches the `pointerdown` listener in capture phase;
 *     `onUnmounted` removes it. Matches the page's previous behavior.
 *
 * The composable depends on `@/audio/callAudioOutputInjection` (pure util)
 * and `@/stores/callRoomHeaderJoin` ONLY for the two DOM-id constants
 * (`CALL_ROOM_DROPDOWN_HOST_ID`, `CALL_ROOM_POPOVER_PANEL_ID`). It does not
 * import or instantiate the Pinia store itself; the page passes
 * `isRoomPopoverOpen` + `closeRoomPopover` as inputs so the composable stays
 * store-free.
 */
const CALL_AUDIO_OUTPUT_LS_KEY = 'streamassist_call_audio_out_v1';
export function useCallDevicePickers(options) {
    const { isInCall, audioInputDevices, videoInputDevices, audioOutputDevices, setCallAudioInputDevice, setCallVideoInputDevice, callControlsDockRef, isRoomPopoverOpen, closeRoomPopover, log, } = options;
    const micPickerOpen = ref(false);
    const camPickerOpen = ref(false);
    const speakerPickerOpen = ref(false);
    const lastPickedAudioOutputId = ref('');
    const callAudioOutputDeviceId = ref('');
    provide(CALL_AUDIO_OUTPUT_DEVICE_ID_KEY, callAudioOutputDeviceId);
    function readCallAudioOutputFromStorage() {
        if (typeof localStorage === 'undefined') {
            return;
        }
        try {
            const raw = localStorage.getItem(CALL_AUDIO_OUTPUT_LS_KEY);
            if (typeof raw === 'string' && raw.trim().length > 0) {
                callAudioOutputDeviceId.value = raw.trim();
            }
        }
        catch {
            /* ignore */
        }
    }
    readCallAudioOutputFromStorage();
    const localAudioOutputDeviceId = computed(() => {
        const picked = lastPickedAudioOutputId.value.trim();
        if (picked && audioOutputDevices.value.some((d) => d.deviceId === picked)) {
            return picked;
        }
        const cur = callAudioOutputDeviceId.value.trim();
        if (cur && audioOutputDevices.value.some((d) => d.deviceId === cur)) {
            return cur;
        }
        return null;
    });
    watch(callAudioOutputDeviceId, async (id) => {
        const t = typeof id === 'string' ? id.trim() : '';
        try {
            if (typeof localStorage !== 'undefined') {
                if (t.length > 0) {
                    localStorage.setItem(CALL_AUDIO_OUTPUT_LS_KEY, t);
                }
                else {
                    localStorage.removeItem(CALL_AUDIO_OUTPUT_LS_KEY);
                }
            }
        }
        catch {
            /* ignore */
        }
        if (t.length > 0) {
            await applyCallAudioOutputSinkToStreamAudios(t);
        }
    }, { flush: 'post', immediate: true });
    const showMediaDevicePickers = computed(() => isInCall.value &&
        (audioInputDevices.value.length > 0 ||
            videoInputDevices.value.length > 0 ||
            audioOutputDevices.value.length > 0));
    function closeMediaDevicePickers() {
        micPickerOpen.value = false;
        camPickerOpen.value = false;
        speakerPickerOpen.value = false;
    }
    function onDocumentPointerForDevicePickers(ev) {
        const t = ev.target;
        if (!(t instanceof Node)) {
            return;
        }
        const roomHost = typeof document !== 'undefined' ? document.getElementById(CALL_ROOM_DROPDOWN_HOST_ID) : null;
        const roomPanel = typeof document !== 'undefined' ? document.getElementById(CALL_ROOM_POPOVER_PANEL_ID) : null;
        if (roomHost?.contains(t) || roomPanel?.contains(t)) {
            return;
        }
        if (isRoomPopoverOpen()) {
            closeRoomPopover();
        }
        if (!micPickerOpen.value && !camPickerOpen.value && !speakerPickerOpen.value) {
            return;
        }
        if (callControlsDockRef.value?.containsDevicePickerTarget(t)) {
            return;
        }
        closeMediaDevicePickers();
    }
    async function pickAudioInput(deviceId) {
        closeMediaDevicePickers();
        try {
            await setCallAudioInputDevice(deviceId);
        }
        catch (err) {
            log.warn('audio input', err);
        }
    }
    async function pickVideoInput(deviceId) {
        closeMediaDevicePickers();
        try {
            await setCallVideoInputDevice(deviceId);
        }
        catch (err) {
            log.warn('video input', err);
        }
    }
    async function pickAudioOutput(deviceId) {
        closeMediaDevicePickers();
        const id = deviceId.trim();
        if (id.length < 1) {
            return;
        }
        lastPickedAudioOutputId.value = id;
        callAudioOutputDeviceId.value = id;
    }
    onMounted(() => {
        document.addEventListener('pointerdown', onDocumentPointerForDevicePickers, true);
    });
    onUnmounted(() => {
        document.removeEventListener('pointerdown', onDocumentPointerForDevicePickers, true);
    });
    return {
        micPickerOpen,
        camPickerOpen,
        speakerPickerOpen,
        lastPickedAudioOutputId,
        callAudioOutputDeviceId,
        localAudioOutputDeviceId,
        showMediaDevicePickers,
        closeMediaDevicePickers,
        onDocumentPointerForDevicePickers,
        pickAudioInput,
        pickVideoInput,
        pickAudioOutput,
    };
}
