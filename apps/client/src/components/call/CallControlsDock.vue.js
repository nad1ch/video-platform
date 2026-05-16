/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import callControlChat from '@/assets/call-controls/chat.svg';
import callControlHand from '@/assets/call-controls/hand.svg';
import callControlHandActive from '@/assets/call-controls/hand-active.svg';
import callControlHeadphonesDeafen from '@/assets/call-controls/split-headphones-deafen.svg';
import callControlHeadphonesOn from '@/assets/call-controls/split-headphones-on.svg';
import callControlIconCameraOff from '@/assets/call-controls/icon-camera-off.svg';
import callControlIconCameraOn from '@/assets/call-controls/icon-camera-on.svg';
import callControlIconHand from '@/assets/call-controls/icon-hand.svg';
import callControlIconHandActive from '@/assets/call-controls/icon-hand-active.svg';
import callControlIconHeadphonesDeafen from '@/assets/call-controls/icon-headphones-deafen.svg';
import callControlIconHeadphonesOn from '@/assets/call-controls/icon-headphones-on.svg';
import callControlIconLeave from '@/assets/call-controls/icon-leave.svg';
import callControlIconMicOff from '@/assets/call-controls/icon-mic-off.svg';
import callControlIconMicOn from '@/assets/call-controls/icon-mic-on.svg';
import callControlIconScreen from '@/assets/call-controls/icon-screen.svg';
import callControlIconScreenActive from '@/assets/call-controls/icon-screen-active.svg';
import callControlLeave from '@/assets/call-controls/leave.svg';
import callControlMicOff from '@/assets/call-controls/split-mic-off.svg';
import callControlMicOn from '@/assets/call-controls/split-mic-on.svg';
import callControlScreen from '@/assets/call-controls/screen.svg';
import callControlScreenActive from '@/assets/call-controls/screen-active.svg';
import callControlCameraOff from '@/assets/call-controls/split-camera-off.svg';
import callControlCameraOn from '@/assets/call-controls/split-camera-on.svg';
const __VLS_props = defineProps();
const emit = defineEmits();
const { t } = useI18n();
const micSplitRef = ref(null);
const headSplitRef = ref(null);
const camSplitRef = ref(null);
const callControlArt = {
    cameraOff: callControlCameraOff,
    cameraOn: callControlCameraOn,
    chat: callControlChat,
    hand: callControlHand,
    handActive: callControlHandActive,
    headphonesDeafen: callControlHeadphonesDeafen,
    headphonesOn: callControlHeadphonesOn,
    leave: callControlLeave,
    micOff: callControlMicOff,
    micOn: callControlMicOn,
    screen: callControlScreen,
    screenActive: callControlScreenActive,
};
const callControlIconArt = {
    cameraOff: callControlIconCameraOff,
    cameraOn: callControlIconCameraOn,
    hand: callControlIconHand,
    handActive: callControlIconHandActive,
    headphonesDeafen: callControlIconHeadphonesDeafen,
    headphonesOn: callControlIconHeadphonesOn,
    leave: callControlIconLeave,
    micOff: callControlIconMicOff,
    micOn: callControlIconMicOn,
    screen: callControlIconScreen,
    screenActive: callControlIconScreenActive,
};
function openMicPicker(open) {
    emit('update:micPickerOpen', open);
    if (open) {
        emit('update:camPickerOpen', false);
        emit('update:speakerPickerOpen', false);
    }
}
function openCamPicker(open) {
    emit('update:camPickerOpen', open);
    if (open) {
        emit('update:micPickerOpen', false);
        emit('update:speakerPickerOpen', false);
    }
}
function openSpeakerPicker(open) {
    emit('update:speakerPickerOpen', open);
    if (open) {
        emit('update:micPickerOpen', false);
        emit('update:camPickerOpen', false);
    }
}
function containsDevicePickerTarget(target) {
    return Boolean(micSplitRef.value?.contains(target) ||
        headSplitRef.value?.contains(target) ||
        camSplitRef.value?.contains(target));
}
const __VLS_exposed = { containsDevicePickerTarget };
defineExpose(__VLS_exposed);
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
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "call-page__dock" },
    ...{ class: ({ 'call-page__dock--pending': __VLS_ctx.joining }) },
    role: "toolbar",
    'aria-label': (__VLS_ctx.t('callPage.callControls')),
});
/** @type {__VLS_StyleScopedClasses['call-page__dock']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__dock--pending']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "micSplitRef",
    ...{ class: "call-page__dock-split call-page__dock-split--figma call-page__dock-split--mic" },
    ...{ class: ({
            'call-page__dock-split--open': __VLS_ctx.micPickerOpen,
            'call-page__dock-split--solo': !__VLS_ctx.showMediaDevicePickers,
        }) },
});
/** @type {__VLS_StyleScopedClasses['call-page__dock-split']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__dock-split--figma']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__dock-split--mic']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__dock-split--open']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__dock-split--solo']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.img)({
    ...{ class: "call-page__dock-control-art" },
    src: (__VLS_ctx.micEnabled ? __VLS_ctx.callControlArt.micOn : __VLS_ctx.callControlArt.micOff),
    alt: "",
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['call-page__dock-control-art']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.img)({
    key: (__VLS_ctx.micEnabled ? 'mic-icon-on' : 'mic-icon-off'),
    ...{ class: "call-page__dock-control-icon call-page__dock-control-icon--split" },
    src: (__VLS_ctx.micEnabled ? __VLS_ctx.callControlIconArt.micOn : __VLS_ctx.callControlIconArt.micOff),
    alt: "",
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['call-page__dock-control-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__dock-control-icon--split']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('toggle-mic');
            // @ts-ignore
            [joining, t, micPickerOpen, showMediaDevicePickers, micEnabled, micEnabled, micEnabled, callControlArt, callControlArt, callControlIconArt, callControlIconArt, emit,];
        } },
    type: "button",
    ...{ class: "call-page__dock-btn call-page__dock-btn--split-main" },
    ...{ class: ({ 'call-page__dock-btn--danger': !__VLS_ctx.micEnabled }) },
    'aria-label': (__VLS_ctx.micEnabled ? __VLS_ctx.t('callPage.muteMic') : __VLS_ctx.t('callPage.unmute')),
    title: (__VLS_ctx.micEnabled ? __VLS_ctx.t('callPage.muteMic') : __VLS_ctx.t('callPage.unmute')),
    'aria-pressed': (!__VLS_ctx.micEnabled),
});
/** @type {__VLS_StyleScopedClasses['call-page__dock-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__dock-btn--split-main']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__dock-btn--danger']} */ ;
if (__VLS_ctx.showMediaDevicePickers) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showMediaDevicePickers))
                    return;
                __VLS_ctx.openMicPicker(!__VLS_ctx.micPickerOpen);
                // @ts-ignore
                [t, t, t, t, micPickerOpen, showMediaDevicePickers, micEnabled, micEnabled, micEnabled, micEnabled, openMicPicker,];
            } },
        type: "button",
        ...{ class: "call-page__dock-btn call-page__dock-btn--split-chev" },
        'aria-label': (__VLS_ctx.t('callPage.micInputMenu')),
        title: (__VLS_ctx.t('callPage.micInputMenu')),
        'aria-expanded': (__VLS_ctx.micPickerOpen),
        'aria-haspopup': "menu",
    });
    /** @type {__VLS_StyleScopedClasses['call-page__dock-btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['call-page__dock-btn--split-chev']} */ ;
}
if (__VLS_ctx.micPickerOpen && __VLS_ctx.showMediaDevicePickers) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "call-page__device-pop sa-scrollbar" },
        role: "menu",
        'aria-label': (__VLS_ctx.t('callPage.micInputMenu')),
    });
    /** @type {__VLS_StyleScopedClasses['call-page__device-pop']} */ ;
    /** @type {__VLS_StyleScopedClasses['sa-scrollbar']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "call-page__device-pop__title" },
    });
    /** @type {__VLS_StyleScopedClasses['call-page__device-pop__title']} */ ;
    (__VLS_ctx.t('callPage.chooseMic'));
    for (const [d] of __VLS_vFor((__VLS_ctx.audioInputDevices))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.micPickerOpen && __VLS_ctx.showMediaDevicePickers))
                        return;
                    __VLS_ctx.emit('pick-audio-input', d.deviceId);
                    // @ts-ignore
                    [t, t, t, t, micPickerOpen, micPickerOpen, showMediaDevicePickers, emit, audioInputDevices,];
                } },
            key: (d.deviceId),
            type: "button",
            role: "menuitemradio",
            ...{ class: "call-page__device-pop__opt" },
            'aria-checked': (d.deviceId === __VLS_ctx.localAudioInputDeviceId),
            ...{ class: ({ 'call-page__device-pop__opt--active': d.deviceId === __VLS_ctx.localAudioInputDeviceId }) },
        });
        /** @type {__VLS_StyleScopedClasses['call-page__device-pop__opt']} */ ;
        /** @type {__VLS_StyleScopedClasses['call-page__device-pop__opt--active']} */ ;
        (d.label);
        // @ts-ignore
        [localAudioInputDeviceId, localAudioInputDeviceId,];
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "headSplitRef",
    ...{ class: "call-page__dock-split call-page__dock-split--figma call-page__dock-split--headphones" },
    ...{ class: ({
            'call-page__dock-split--open': __VLS_ctx.speakerPickerOpen,
            'call-page__dock-split--solo': !__VLS_ctx.showMediaDevicePickers || __VLS_ctx.audioOutputDevices.length === 0,
        }) },
});
/** @type {__VLS_StyleScopedClasses['call-page__dock-split']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__dock-split--figma']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__dock-split--headphones']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__dock-split--open']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__dock-split--solo']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.img)({
    ...{ class: "call-page__dock-control-art" },
    src: (__VLS_ctx.callDeafened ? __VLS_ctx.callControlArt.headphonesDeafen : __VLS_ctx.callControlArt.headphonesOn),
    alt: "",
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['call-page__dock-control-art']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.img)({
    key: (__VLS_ctx.callDeafened ? 'head-deafen' : 'head-on'),
    ...{ class: "call-page__dock-control-icon call-page__dock-control-icon--split" },
    src: (__VLS_ctx.callDeafened ? __VLS_ctx.callControlIconArt.headphonesDeafen : __VLS_ctx.callControlIconArt.headphonesOn),
    alt: "",
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['call-page__dock-control-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__dock-control-icon--split']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('toggle-deafen');
            // @ts-ignore
            [showMediaDevicePickers, callControlArt, callControlArt, callControlIconArt, callControlIconArt, emit, speakerPickerOpen, audioOutputDevices, callDeafened, callDeafened, callDeafened,];
        } },
    type: "button",
    ...{ class: "call-page__dock-btn call-page__dock-btn--split-main" },
    ...{ class: ({ 'call-page__dock-btn--danger': __VLS_ctx.callDeafened }) },
    'aria-label': (__VLS_ctx.callDeafened ? __VLS_ctx.t('callPage.deafenOffAria') : __VLS_ctx.t('callPage.deafenOnAria')),
    title: (__VLS_ctx.callDeafened ? __VLS_ctx.t('callPage.deafenOffAria') : __VLS_ctx.t('callPage.deafenOnAria')),
    'aria-pressed': (__VLS_ctx.callDeafened),
});
/** @type {__VLS_StyleScopedClasses['call-page__dock-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__dock-btn--split-main']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__dock-btn--danger']} */ ;
if (__VLS_ctx.showMediaDevicePickers && __VLS_ctx.audioOutputDevices.length > 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showMediaDevicePickers && __VLS_ctx.audioOutputDevices.length > 0))
                    return;
                __VLS_ctx.openSpeakerPicker(!__VLS_ctx.speakerPickerOpen);
                // @ts-ignore
                [t, t, t, t, showMediaDevicePickers, speakerPickerOpen, audioOutputDevices, callDeafened, callDeafened, callDeafened, callDeafened, openSpeakerPicker,];
            } },
        type: "button",
        ...{ class: "call-page__dock-btn call-page__dock-btn--split-chev" },
        'aria-label': (__VLS_ctx.t('callPage.speakerOutputMenu')),
        title: (__VLS_ctx.t('callPage.speakerOutputMenu')),
        'aria-expanded': (__VLS_ctx.speakerPickerOpen),
        'aria-haspopup': "menu",
    });
    /** @type {__VLS_StyleScopedClasses['call-page__dock-btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['call-page__dock-btn--split-chev']} */ ;
}
if (__VLS_ctx.speakerPickerOpen && __VLS_ctx.showMediaDevicePickers && __VLS_ctx.audioOutputDevices.length > 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "call-page__device-pop sa-scrollbar" },
        role: "menu",
        'aria-label': (__VLS_ctx.t('callPage.speakerOutputMenu')),
    });
    /** @type {__VLS_StyleScopedClasses['call-page__device-pop']} */ ;
    /** @type {__VLS_StyleScopedClasses['sa-scrollbar']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "call-page__device-pop__title" },
    });
    /** @type {__VLS_StyleScopedClasses['call-page__device-pop__title']} */ ;
    (__VLS_ctx.t('callPage.chooseSpeaker'));
    for (const [d] of __VLS_vFor((__VLS_ctx.audioOutputDevices))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.speakerPickerOpen && __VLS_ctx.showMediaDevicePickers && __VLS_ctx.audioOutputDevices.length > 0))
                        return;
                    __VLS_ctx.emit('pick-audio-output', d.deviceId);
                    // @ts-ignore
                    [t, t, t, t, showMediaDevicePickers, emit, speakerPickerOpen, speakerPickerOpen, audioOutputDevices, audioOutputDevices,];
                } },
            key: (d.deviceId),
            type: "button",
            role: "menuitemradio",
            ...{ class: "call-page__device-pop__opt" },
            'aria-checked': (d.deviceId === __VLS_ctx.localAudioOutputDeviceId),
            ...{ class: ({ 'call-page__device-pop__opt--active': d.deviceId === __VLS_ctx.localAudioOutputDeviceId }) },
        });
        /** @type {__VLS_StyleScopedClasses['call-page__device-pop__opt']} */ ;
        /** @type {__VLS_StyleScopedClasses['call-page__device-pop__opt--active']} */ ;
        (d.label);
        // @ts-ignore
        [localAudioOutputDeviceId, localAudioOutputDeviceId,];
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "camSplitRef",
    ...{ class: "call-page__dock-split call-page__dock-split--figma call-page__dock-split--camera" },
    ...{ class: ({
            'call-page__dock-split--open': __VLS_ctx.camPickerOpen,
            'call-page__dock-split--solo': !__VLS_ctx.showMediaDevicePickers,
        }) },
});
/** @type {__VLS_StyleScopedClasses['call-page__dock-split']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__dock-split--figma']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__dock-split--camera']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__dock-split--open']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__dock-split--solo']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.img)({
    ...{ class: "call-page__dock-control-art" },
    src: (__VLS_ctx.camEnabled ? __VLS_ctx.callControlArt.cameraOn : __VLS_ctx.callControlArt.cameraOff),
    alt: "",
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['call-page__dock-control-art']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.img)({
    key: (__VLS_ctx.camEnabled ? 'camera-icon-on' : 'camera-icon-off'),
    ...{ class: "call-page__dock-control-icon call-page__dock-control-icon--split" },
    src: (__VLS_ctx.camEnabled ? __VLS_ctx.callControlIconArt.cameraOn : __VLS_ctx.callControlIconArt.cameraOff),
    alt: "",
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['call-page__dock-control-icon']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__dock-control-icon--split']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('toggle-cam');
            // @ts-ignore
            [showMediaDevicePickers, callControlArt, callControlArt, callControlIconArt, callControlIconArt, emit, camPickerOpen, camEnabled, camEnabled, camEnabled,];
        } },
    type: "button",
    ...{ class: "call-page__dock-btn call-page__dock-btn--split-main" },
    ...{ class: ({ 'call-page__dock-btn--danger': !__VLS_ctx.camEnabled }) },
    'aria-label': (__VLS_ctx.camEnabled ? __VLS_ctx.t('callPage.cameraOff') : __VLS_ctx.t('callPage.cameraOn')),
    title: (__VLS_ctx.camEnabled ? __VLS_ctx.t('callPage.cameraOff') : __VLS_ctx.t('callPage.cameraOn')),
    'aria-pressed': (!__VLS_ctx.camEnabled),
});
/** @type {__VLS_StyleScopedClasses['call-page__dock-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__dock-btn--split-main']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__dock-btn--danger']} */ ;
if (__VLS_ctx.showMediaDevicePickers) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.showMediaDevicePickers))
                    return;
                __VLS_ctx.openCamPicker(!__VLS_ctx.camPickerOpen);
                // @ts-ignore
                [t, t, t, t, showMediaDevicePickers, camPickerOpen, camEnabled, camEnabled, camEnabled, camEnabled, openCamPicker,];
            } },
        type: "button",
        ...{ class: "call-page__dock-btn call-page__dock-btn--split-chev" },
        'aria-label': (__VLS_ctx.t('callPage.cameraInputMenu')),
        title: (__VLS_ctx.t('callPage.cameraInputMenu')),
        'aria-expanded': (__VLS_ctx.camPickerOpen),
        'aria-haspopup': "menu",
    });
    /** @type {__VLS_StyleScopedClasses['call-page__dock-btn']} */ ;
    /** @type {__VLS_StyleScopedClasses['call-page__dock-btn--split-chev']} */ ;
}
if (__VLS_ctx.camPickerOpen && __VLS_ctx.showMediaDevicePickers) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "call-page__device-pop sa-scrollbar" },
        role: "menu",
        'aria-label': (__VLS_ctx.t('callPage.cameraInputMenu')),
    });
    /** @type {__VLS_StyleScopedClasses['call-page__device-pop']} */ ;
    /** @type {__VLS_StyleScopedClasses['sa-scrollbar']} */ ;
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "call-page__device-pop__title" },
    });
    /** @type {__VLS_StyleScopedClasses['call-page__device-pop__title']} */ ;
    (__VLS_ctx.t('callPage.chooseCamera'));
    for (const [d] of __VLS_vFor((__VLS_ctx.videoInputDevices))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.camPickerOpen && __VLS_ctx.showMediaDevicePickers))
                        return;
                    __VLS_ctx.emit('pick-video-input', d.deviceId);
                    // @ts-ignore
                    [t, t, t, t, showMediaDevicePickers, emit, camPickerOpen, camPickerOpen, videoInputDevices,];
                } },
            key: (d.deviceId),
            type: "button",
            role: "menuitemradio",
            ...{ class: "call-page__device-pop__opt" },
            'aria-checked': (d.deviceId === __VLS_ctx.localVideoInputDeviceId),
            ...{ class: ({ 'call-page__device-pop__opt--active': d.deviceId === __VLS_ctx.localVideoInputDeviceId }) },
        });
        /** @type {__VLS_StyleScopedClasses['call-page__device-pop__opt']} */ ;
        /** @type {__VLS_StyleScopedClasses['call-page__device-pop__opt--active']} */ ;
        (d.label);
        // @ts-ignore
        [localVideoInputDeviceId, localVideoInputDeviceId,];
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('toggle-raise-hand');
            // @ts-ignore
            [emit,];
        } },
    type: "button",
    ...{ class: "call-page__dock-btn call-page__dock-btn--figma call-page__dock-btn--hand call-page__dock-btn--compact-narrow-hide" },
    ...{ class: ({ 'call-page__dock-btn--accent': __VLS_ctx.handRaised }) },
    'aria-label': (__VLS_ctx.handRaised ? __VLS_ctx.t('callPage.raiseHandOff') : __VLS_ctx.t('callPage.raiseHandOn')),
    title: (__VLS_ctx.handRaised ? __VLS_ctx.t('callPage.raiseHandOff') : __VLS_ctx.t('callPage.raiseHandOn')),
    'aria-pressed': (__VLS_ctx.handRaised),
});
/** @type {__VLS_StyleScopedClasses['call-page__dock-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__dock-btn--figma']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__dock-btn--hand']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__dock-btn--compact-narrow-hide']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__dock-btn--accent']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.img)({
    ...{ class: "call-page__dock-control-art" },
    src: (__VLS_ctx.handRaised ? __VLS_ctx.callControlArt.handActive : __VLS_ctx.callControlArt.hand),
    alt: "",
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['call-page__dock-control-art']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.img)({
    key: (__VLS_ctx.handRaised ? 'hand-icon-active' : 'hand-icon'),
    ...{ class: "call-page__dock-control-icon" },
    src: (__VLS_ctx.handRaised ? __VLS_ctx.callControlIconArt.handActive : __VLS_ctx.callControlIconArt.hand),
    alt: "",
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['call-page__dock-control-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('toggle-screen-share');
            // @ts-ignore
            [t, t, t, t, callControlArt, callControlArt, callControlIconArt, callControlIconArt, emit, handRaised, handRaised, handRaised, handRaised, handRaised, handRaised, handRaised,];
        } },
    type: "button",
    ...{ class: "call-page__dock-btn call-page__dock-btn--figma call-page__dock-btn--screen call-page__dock-btn--compact-narrow-hide" },
    ...{ class: ({ 'call-page__dock-btn--accent': __VLS_ctx.screenSharing }) },
    'aria-label': (__VLS_ctx.screenSharing ? __VLS_ctx.t('callPage.screenShareStop') : __VLS_ctx.t('callPage.screenShareStart')),
    title: (__VLS_ctx.screenSharing ? __VLS_ctx.t('callPage.screenShareStop') : __VLS_ctx.t('callPage.screenShareStart')),
    'aria-pressed': (__VLS_ctx.screenSharing),
});
/** @type {__VLS_StyleScopedClasses['call-page__dock-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__dock-btn--figma']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__dock-btn--screen']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__dock-btn--compact-narrow-hide']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__dock-btn--accent']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.img)({
    ...{ class: "call-page__dock-control-art" },
    src: (__VLS_ctx.screenSharing ? __VLS_ctx.callControlArt.screenActive : __VLS_ctx.callControlArt.screen),
    alt: "",
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['call-page__dock-control-art']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.img)({
    key: (__VLS_ctx.screenSharing ? 'screen-icon-active' : 'screen-icon'),
    ...{ class: "call-page__dock-control-icon" },
    src: (__VLS_ctx.screenSharing ? __VLS_ctx.callControlIconArt.screenActive : __VLS_ctx.callControlIconArt.screen),
    alt: "",
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['call-page__dock-control-icon']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('update:chatOpen', !__VLS_ctx.chatOpen);
            // @ts-ignore
            [t, t, t, t, callControlArt, callControlArt, callControlIconArt, callControlIconArt, emit, screenSharing, screenSharing, screenSharing, screenSharing, screenSharing, screenSharing, screenSharing, chatOpen,];
        } },
    type: "button",
    ...{ class: "call-page__dock-btn call-page__dock-btn--chat call-page__dock-btn--compact-narrow-hide" },
    ...{ class: ({ 'call-page__dock-btn--accent': __VLS_ctx.chatOpen }) },
    'aria-label': (__VLS_ctx.chatOpen ? __VLS_ctx.t('callPage.chatHide') : __VLS_ctx.t('callPage.chatShow')),
    title: (__VLS_ctx.chatOpen ? __VLS_ctx.t('callPage.chatHide') : __VLS_ctx.t('callPage.chatShow')),
    'aria-pressed': (__VLS_ctx.chatOpen),
});
/** @type {__VLS_StyleScopedClasses['call-page__dock-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__dock-btn--chat']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__dock-btn--compact-narrow-hide']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__dock-btn--accent']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "call-page__dock-ico" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['call-page__dock-ico']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.img)({
    ...{ class: "call-page__dock-icon-img" },
    src: (__VLS_ctx.callControlArt.chat),
    alt: "",
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['call-page__dock-icon-img']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('leave');
            // @ts-ignore
            [t, t, t, t, callControlArt, emit, chatOpen, chatOpen, chatOpen, chatOpen,];
        } },
    type: "button",
    ...{ class: "call-page__dock-btn call-page__dock-btn--figma call-page__dock-btn--leave" },
    'aria-label': (__VLS_ctx.t('callPage.leave')),
    title: (__VLS_ctx.t('callPage.leave')),
});
/** @type {__VLS_StyleScopedClasses['call-page__dock-btn']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__dock-btn--figma']} */ ;
/** @type {__VLS_StyleScopedClasses['call-page__dock-btn--leave']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.img)({
    ...{ class: "call-page__dock-control-art" },
    src: (__VLS_ctx.callControlArt.leave),
    alt: "",
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['call-page__dock-control-art']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.img)({
    ...{ class: "call-page__dock-control-icon" },
    src: (__VLS_ctx.callControlIconArt.leave),
    alt: "",
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['call-page__dock-control-icon']} */ ;
// @ts-ignore
[t, t, callControlArt, callControlIconArt,];
const __VLS_export = (await import('vue')).defineComponent({
    setup: () => __VLS_exposed,
    __typeEmits: {},
    __typeProps: {},
});
export default {};
