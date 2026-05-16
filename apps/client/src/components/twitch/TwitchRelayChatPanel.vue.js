/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { ref } from 'vue';
const props = withDefaults(defineProps(), { showGuessHints: true, flexRail: false, showWsPill: true });
const feedEl = ref(null);
function avatarInitial(displayName) {
    const s = displayName.trim();
    if (!s) {
        return '?';
    }
    const first = [...s][0];
    return first ? first.toUpperCase() : '?';
}
function scrollToBottom() {
    const el = feedEl.value;
    if (!el) {
        return;
    }
    el.scrollTop = el.scrollHeight;
}
const __VLS_exposed = { scrollToBottom };
defineExpose(__VLS_exposed);
const __VLS_defaults = { showGuessHints: true, flexRail: false, showWsPill: true };
const __VLS_ctx = {
    ...{},
    ...{},
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__shell--flex-rail']} */ ;
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__ws-pill']} */ ;
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__ws-pill']} */ ;
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__external']} */ ;
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__toolbar']} */ ;
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__external']} */ ;
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__feed']} */ ;
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__line']} */ ;
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__line']} */ ;
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__feed']} */ ;
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__feed']} */ ;
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__shell']} */ ;
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__feed']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "twitch-relay-chat__shell" },
    ...{ class: ({ 'twitch-relay-chat__shell--flex-rail': props.flexRail }) },
});
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__shell']} */ ;
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__shell--flex-rail']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.header, __VLS_intrinsics.header)({
    ...{ class: "twitch-relay-chat__head" },
});
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__head']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "twitch-relay-chat__head-row" },
});
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__head-row']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h2, __VLS_intrinsics.h2)({
    ...{ class: "twitch-relay-chat__title" },
});
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__title']} */ ;
(props.chatTitle);
if (props.showWsPill) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
        ...{ class: "twitch-relay-chat__ws-pill" },
        'data-state': (props.wsStatus),
    });
    /** @type {__VLS_StyleScopedClasses['twitch-relay-chat__ws-pill']} */ ;
    (props.wsStatusLabel);
}
if (props.showGuessHints && props.guessLenHint) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "twitch-relay-chat__len-hint" },
        role: "note",
    });
    /** @type {__VLS_StyleScopedClasses['twitch-relay-chat__len-hint']} */ ;
    (props.guessLenHint);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "twitch-relay-chat__toolbar" },
});
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__toolbar']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
    ...{ class: "twitch-relay-chat__channel-pill" },
});
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__channel-pill']} */ ;
(props.channelDisplay);
__VLS_asFunctionalElement1(__VLS_intrinsics.a, __VLS_intrinsics.a)({
    ...{ class: "twitch-relay-chat__external" },
    href: (props.twitchWatchUrl),
    target: "_blank",
    rel: "noopener noreferrer",
});
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__external']} */ ;
(props.openTwitchLabel);
if (props.ircRelayBanner) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "twitch-relay-chat__irc-banner" },
        role: "status",
    });
    /** @type {__VLS_StyleScopedClasses['twitch-relay-chat__irc-banner']} */ ;
    (props.ircRelayBanner);
}
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ref: "feedEl",
    ...{ class: "twitch-relay-chat__feed" },
    role: "log",
    'aria-relevant': "additions",
    'aria-label': (props.relayAriaLabel),
});
/** @type {__VLS_StyleScopedClasses['twitch-relay-chat__feed']} */ ;
if (props.lines.length === 0) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "twitch-relay-chat__empty" },
    });
    /** @type {__VLS_StyleScopedClasses['twitch-relay-chat__empty']} */ ;
    (props.chatEmptyText);
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.ul, __VLS_intrinsics.ul)({
        ...{ class: "twitch-relay-chat__lines" },
    });
    /** @type {__VLS_StyleScopedClasses['twitch-relay-chat__lines']} */ ;
    for (const [c] of __VLS_vFor((props.lines))) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.li, __VLS_intrinsics.li)({
            key: (c._cid),
            ...{ class: "twitch-relay-chat__line" },
            ...{ class: ({
                    'twitch-relay-chat__line--guess': c.validGuess && !c.system,
                    'twitch-relay-chat__line--slow': c.rateLimited === true,
                    'twitch-relay-chat__line--system': c.system === true,
                }) },
        });
        /** @type {__VLS_StyleScopedClasses['twitch-relay-chat__line']} */ ;
        /** @type {__VLS_StyleScopedClasses['twitch-relay-chat__line--guess']} */ ;
        /** @type {__VLS_StyleScopedClasses['twitch-relay-chat__line--slow']} */ ;
        /** @type {__VLS_StyleScopedClasses['twitch-relay-chat__line--system']} */ ;
        if (c.system) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "twitch-relay-chat__system-text" },
            });
            /** @type {__VLS_StyleScopedClasses['twitch-relay-chat__system-text']} */ ;
            (c.text);
        }
        else {
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "twitch-relay-chat__avatar" },
                'aria-hidden': "true",
            });
            /** @type {__VLS_StyleScopedClasses['twitch-relay-chat__avatar']} */ ;
            (__VLS_ctx.avatarInitial(c.displayName));
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "twitch-relay-chat__line-body" },
            });
            /** @type {__VLS_StyleScopedClasses['twitch-relay-chat__line-body']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
                ...{ class: "twitch-relay-chat__line-meta" },
            });
            /** @type {__VLS_StyleScopedClasses['twitch-relay-chat__line-meta']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "twitch-relay-chat__name" },
            });
            /** @type {__VLS_StyleScopedClasses['twitch-relay-chat__name']} */ ;
            (c.displayName);
            if (c.validGuess) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "twitch-relay-chat__badge" },
                });
                /** @type {__VLS_StyleScopedClasses['twitch-relay-chat__badge']} */ ;
                (props.guessBadgeLabel);
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                ...{ class: "twitch-relay-chat__text" },
            });
            /** @type {__VLS_StyleScopedClasses['twitch-relay-chat__text']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "twitch-relay-chat__text-inner" },
            });
            /** @type {__VLS_StyleScopedClasses['twitch-relay-chat__text-inner']} */ ;
            (c.text);
            if (c.validGuess && c.guessFeedback?.length) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "twitch-relay-chat__relay-emojis" },
                    'aria-hidden': "true",
                });
                /** @type {__VLS_StyleScopedClasses['twitch-relay-chat__relay-emojis']} */ ;
                (props.feedbackToEmojis(c.guessFeedback));
            }
            if (c.rateLimited) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
                    ...{ class: "twitch-relay-chat__cooldown" },
                });
                /** @type {__VLS_StyleScopedClasses['twitch-relay-chat__cooldown']} */ ;
                (props.formatCooldownHint(c.cooldownMs ?? props.defaultCooldownMs));
            }
        }
        // @ts-ignore
        [avatarInitial,];
    }
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    setup: () => __VLS_exposed,
    __defaults: __VLS_defaults,
    __typeProps: {},
});
export default {};
