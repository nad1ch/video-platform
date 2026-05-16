/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import AppButton from '@/components/ui/AppButton.vue';
const props = defineProps();
const emit = defineEmits();
const { t } = useI18n();
const chatDraft = ref('');
const chatScrollRef = ref(null);
function sendChatFromForm() {
    const raw = chatDraft.value.trim();
    if (!raw) {
        return;
    }
    emit('send', raw);
    chatDraft.value = '';
}
function formatChatTime(at) {
    try {
        return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(at));
    }
    catch {
        return '';
    }
}
function isSelfChatLine(line) {
    return line.peerId === props.selfPeerId;
}
watch(() => props.messages.length, async () => {
    await nextTick();
    const el = chatScrollRef.value;
    if (el) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'auto' });
    }
});
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
__VLS_asFunctionalElement1(__VLS_intrinsics.aside, __VLS_intrinsics.aside)({
    ...{ class: "call-page__chat" },
    ...{ class: (__VLS_ctx.panelClass) },
    ...{ style: (__VLS_ctx.panelStyle) },
    'aria-label': (__VLS_ctx.t('callPage.chatTitle')),
    'aria-hidden': (__VLS_ctx.open ? 'false' : 'true'),
});
/** @type {__VLS_StyleScopedClasses['call-page__chat']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ onPointerdown: (...[$event]) => {
            __VLS_ctx.emit('drag-pointer-down', $event);
            // @ts-ignore
            [panelClass, panelStyle, t, open, emit,];
        } },
    ...{ class: "call-page__chat-head" },
});
/** @type {__VLS_StyleScopedClasses['call-page__chat-head']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "call-page__chat-title" },
});
/** @type {__VLS_StyleScopedClasses['call-page__chat-title']} */ ;
(__VLS_ctx.t('callPage.chatTitle'));
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.emit('update:open', false);
            // @ts-ignore
            [t, emit,];
        } },
    type: "button",
    ...{ class: "call-page__chat-close" },
});
/** @type {__VLS_StyleScopedClasses['call-page__chat-close']} */ ;
(__VLS_ctx.t('callPage.chatClose'));
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "chatScrollRef",
    ...{ class: "call-page__chat-scroll sa-scrollbar" },
});
/** @type {__VLS_StyleScopedClasses['call-page__chat-scroll']} */ ;
/** @type {__VLS_StyleScopedClasses['sa-scrollbar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
    ...{ class: "call-page__chat-list" },
    role: "list",
});
/** @type {__VLS_StyleScopedClasses['call-page__chat-list']} */ ;
if (__VLS_ctx.messages.length === 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
        key: "chat-empty",
        ...{ class: "call-page__chat-li call-page__chat-li--empty" },
    });
    /** @type {__VLS_StyleScopedClasses['call-page__chat-li']} */ ;
    /** @type {__VLS_StyleScopedClasses['call-page__chat-li--empty']} */ ;
    (__VLS_ctx.t('callPage.chatEmpty'));
}
else {
    for (const [line] of __VLS_vFor((__VLS_ctx.messages))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (line.id),
            ...{ class: "call-page__chat-li" },
            ...{ class: ({ 'call-page__chat-li--self': __VLS_ctx.isSelfChatLine(line) }) },
        });
        /** @type {__VLS_StyleScopedClasses['call-page__chat-li']} */ ;
        /** @type {__VLS_StyleScopedClasses['call-page__chat-li--self']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "call-page__chat-meta" },
        });
        /** @type {__VLS_StyleScopedClasses['call-page__chat-meta']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "call-page__chat-name" },
        });
        /** @type {__VLS_StyleScopedClasses['call-page__chat-name']} */ ;
        (__VLS_ctx.displayNameForPeer(line.peerId));
        __VLS_asFunctionalElement1(__VLS_intrinsics.time, __VLS_intrinsics.time)({
            ...{ class: "call-page__chat-time" },
            datetime: (String(line.at)),
        });
        /** @type {__VLS_StyleScopedClasses['call-page__chat-time']} */ ;
        (__VLS_ctx.formatChatTime(line.at));
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "call-page__chat-text" },
        });
        /** @type {__VLS_StyleScopedClasses['call-page__chat-text']} */ ;
        (line.text);
        // @ts-ignore
        [t, t, messages, messages, isSelfChatLine, displayNameForPeer, formatChatTime,];
    }
}
__VLS_asFunctionalElement1(__VLS_intrinsics.form, __VLS_intrinsics.form)({
    ...{ onSubmit: (__VLS_ctx.sendChatFromForm) },
    ...{ class: "call-page__chat-form" },
});
/** @type {__VLS_StyleScopedClasses['call-page__chat-form']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.input)({
    value: (__VLS_ctx.chatDraft),
    ...{ class: "call-page__chat-input" },
    type: "text",
    maxlength: "500",
    autocomplete: "off",
    placeholder: (__VLS_ctx.t('callPage.chatPlaceholder')),
});
/** @type {__VLS_StyleScopedClasses['call-page__chat-input']} */ ;
const __VLS_0 = AppButton || AppButton;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    type: "submit",
    variant: "secondary",
    ...{ class: "call-page__chat-send" },
}));
const __VLS_2 = __VLS_1({
    type: "submit",
    variant: "secondary",
    ...{ class: "call-page__chat-send" },
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {__VLS_StyleScopedClasses['call-page__chat-send']} */ ;
const { default: __VLS_5 } = __VLS_3.slots;
(__VLS_ctx.t('callPage.chatSend'));
// @ts-ignore
[t, t, sendChatFromForm, chatDraft,];
var __VLS_3;
__VLS_asFunctionalElement1(__VLS_intrinsics.span)({
    ...{ onPointerdown: (...[$event]) => {
            __VLS_ctx.emit('resize-pointer-down', $event);
            // @ts-ignore
            [emit,];
        } },
    ...{ class: "call-page__chat-resize" },
    'aria-hidden': "true",
});
/** @type {__VLS_StyleScopedClasses['call-page__chat-resize']} */ ;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
