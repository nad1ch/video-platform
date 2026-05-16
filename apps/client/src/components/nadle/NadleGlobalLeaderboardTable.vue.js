/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
const tab = defineModel('tab', { required: true });
const __VLS_props = defineProps();
let __VLS_modelEmit;
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
/** @type {__VLS_StyleScopedClasses['nadle-page__global-lb']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__global-lb']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__global-lb']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-muted']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-podium-step']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-podium-step']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-podium-step']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-scroll']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-body']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-loader']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-loader']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-loader-dot']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-body']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-loader']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-glb-loader-enter-active']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-glb-loader-leave-active']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-td']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-td']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-tr--self']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-td']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-tr--self']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-td']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-tr--self']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-td']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-tr']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-td']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-tr']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-td']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-tabs']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__global-lb']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-title']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-tabs']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-table']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-td']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-th']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-td--rank']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-td--score']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-avatar']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-name']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.section, __VLS_intrinsics.section)({
    ...{ class: "nadle-page__global-lb" },
    'aria-label': (__VLS_ctx.sectionAriaLabel),
});
/** @type {__VLS_StyleScopedClasses['nadle-page__global-lb']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.h3, __VLS_intrinsics.h3)({
    ...{ class: "nadle-page__glb-title" },
});
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-title']} */ ;
(__VLS_ctx.title);
__VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
    ...{ class: "nadle-page__glb-tabs" },
    role: "tablist",
    'aria-label': (__VLS_ctx.tabsAriaLabel),
});
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-tabs']} */ ;
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.tab = 'wins';
            // @ts-ignore
            [sectionAriaLabel, title, tabsAriaLabel, tab,];
        } },
    type: "button",
    role: "tab",
    ...{ class: "nadle-page__glb-tab" },
    ...{ class: ({ 'nadle-page__glb-tab--active': __VLS_ctx.tab === 'wins' }) },
    'aria-selected': (__VLS_ctx.tab === 'wins'),
});
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-tab--active']} */ ;
(__VLS_ctx.tabWinsLabel);
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.tab = 'streak';
            // @ts-ignore
            [tab, tab, tab, tabWinsLabel,];
        } },
    type: "button",
    role: "tab",
    ...{ class: "nadle-page__glb-tab" },
    ...{ class: ({ 'nadle-page__glb-tab--active': __VLS_ctx.tab === 'streak' }) },
    'aria-selected': (__VLS_ctx.tab === 'streak'),
});
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-tab--active']} */ ;
(__VLS_ctx.tabStreakLabel);
__VLS_asFunctionalElement1(__VLS_intrinsics.button, __VLS_intrinsics.button)({
    ...{ onClick: (...[$event]) => {
            __VLS_ctx.tab = 'rating';
            // @ts-ignore
            [tab, tab, tab, tabStreakLabel,];
        } },
    type: "button",
    role: "tab",
    ...{ class: "nadle-page__glb-tab" },
    ...{ class: ({ 'nadle-page__glb-tab--active': __VLS_ctx.tab === 'rating' }) },
    'aria-selected': (__VLS_ctx.tab === 'rating'),
});
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-tab']} */ ;
/** @type {__VLS_StyleScopedClasses['nadle-page__glb-tab--active']} */ ;
(__VLS_ctx.tabRatingLabel);
if (__VLS_ctx.selfStreakSummary) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "nadle-page__glb-self-streak" },
        'aria-live': "polite",
    });
    /** @type {__VLS_StyleScopedClasses['nadle-page__glb-self-streak']} */ ;
    (__VLS_ctx.selfStreakSummary);
}
if (__VLS_ctx.error) {
    __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
        ...{ class: "nadle-page__glb-banner" },
        role: "alert",
    });
    /** @type {__VLS_StyleScopedClasses['nadle-page__glb-banner']} */ ;
    (__VLS_ctx.error);
}
else {
    __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
        ...{ class: "nadle-page__glb-body" },
        ...{ class: ({ 'nadle-page__glb-body--loading': __VLS_ctx.loading }) },
        'aria-busy': (__VLS_ctx.loading ? 'true' : 'false'),
    });
    /** @type {__VLS_StyleScopedClasses['nadle-page__glb-body']} */ ;
    /** @type {__VLS_StyleScopedClasses['nadle-page__glb-body--loading']} */ ;
    if (__VLS_ctx.rows.length === 0 && !__VLS_ctx.loading) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "nadle-page__glb-empty" },
        });
        /** @type {__VLS_StyleScopedClasses['nadle-page__glb-empty']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "nadle-page__glb-podium" },
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['nadle-page__glb-podium']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "nadle-page__glb-podium-step" },
        });
        /** @type {__VLS_StyleScopedClasses['nadle-page__glb-podium-step']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "nadle-page__glb-podium-step" },
        });
        /** @type {__VLS_StyleScopedClasses['nadle-page__glb-podium-step']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
            ...{ class: "nadle-page__glb-podium-step" },
        });
        /** @type {__VLS_StyleScopedClasses['nadle-page__glb-podium-step']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.p, __VLS_intrinsics.p)({
            ...{ class: "nadle-page__glb-muted nadle-page__glb-muted--empty" },
        });
        /** @type {__VLS_StyleScopedClasses['nadle-page__glb-muted']} */ ;
        /** @type {__VLS_StyleScopedClasses['nadle-page__glb-muted--empty']} */ ;
        (__VLS_ctx.emptyText);
    }
    else if (__VLS_ctx.rows.length > 0) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "nadle-page__glb-scroll" },
        });
        /** @type {__VLS_StyleScopedClasses['nadle-page__glb-scroll']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.table, __VLS_intrinsics.table)({
            ...{ class: "nadle-page__glb-table" },
            'aria-label': (__VLS_ctx.scoreColumnHeader),
        });
        /** @type {__VLS_StyleScopedClasses['nadle-page__glb-table']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.thead, __VLS_intrinsics.thead)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({});
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            scope: "col",
            ...{ class: "nadle-page__glb-th nadle-page__glb-th--rank" },
        });
        /** @type {__VLS_StyleScopedClasses['nadle-page__glb-th']} */ ;
        /** @type {__VLS_StyleScopedClasses['nadle-page__glb-th--rank']} */ ;
        (__VLS_ctx.colRank);
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            scope: "col",
            ...{ class: "nadle-page__glb-th nadle-page__glb-th--player-col" },
        });
        /** @type {__VLS_StyleScopedClasses['nadle-page__glb-th']} */ ;
        /** @type {__VLS_StyleScopedClasses['nadle-page__glb-th--player-col']} */ ;
        (__VLS_ctx.colPlayer);
        __VLS_asFunctionalElement1(__VLS_intrinsics.th, __VLS_intrinsics.th)({
            scope: "col",
            ...{ class: "nadle-page__glb-th nadle-page__glb-th--score" },
        });
        /** @type {__VLS_StyleScopedClasses['nadle-page__glb-th']} */ ;
        /** @type {__VLS_StyleScopedClasses['nadle-page__glb-th--score']} */ ;
        (__VLS_ctx.scoreColumnHeader);
        __VLS_asFunctionalElement1(__VLS_intrinsics.tbody, __VLS_intrinsics.tbody)({});
        for (const [row] of __VLS_vFor((__VLS_ctx.rows))) {
            __VLS_asFunctionalElement1(__VLS_intrinsics.tr, __VLS_intrinsics.tr)({
                key: (row.rowKey),
                ...{ class: "nadle-page__glb-tr" },
                ...{ class: ({ 'nadle-page__glb-tr--self': row.isSelf }) },
            });
            /** @type {__VLS_StyleScopedClasses['nadle-page__glb-tr']} */ ;
            /** @type {__VLS_StyleScopedClasses['nadle-page__glb-tr--self']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ class: "nadle-page__glb-td nadle-page__glb-td--rank" },
            });
            /** @type {__VLS_StyleScopedClasses['nadle-page__glb-td']} */ ;
            /** @type {__VLS_StyleScopedClasses['nadle-page__glb-td--rank']} */ ;
            (row.rank);
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ class: "nadle-page__glb-td nadle-page__glb-td--player" },
            });
            /** @type {__VLS_StyleScopedClasses['nadle-page__glb-td']} */ ;
            /** @type {__VLS_StyleScopedClasses['nadle-page__glb-td--player']} */ ;
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "nadle-page__glb-player" },
            });
            /** @type {__VLS_StyleScopedClasses['nadle-page__glb-player']} */ ;
            if (row.avatarUrl) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.img)({
                    ...{ class: "nadle-page__glb-avatar" },
                    src: (row.avatarUrl),
                    alt: "",
                    width: "26",
                    height: "26",
                    referrerpolicy: "no-referrer",
                });
                /** @type {__VLS_StyleScopedClasses['nadle-page__glb-avatar']} */ ;
            }
            else {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "nadle-page__glb-avatar nadle-page__glb-avatar--ph" },
                    'aria-hidden': "true",
                });
                /** @type {__VLS_StyleScopedClasses['nadle-page__glb-avatar']} */ ;
                /** @type {__VLS_StyleScopedClasses['nadle-page__glb-avatar--ph']} */ ;
                (row.initials);
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                ...{ class: "nadle-page__glb-name" },
            });
            /** @type {__VLS_StyleScopedClasses['nadle-page__glb-name']} */ ;
            (row.displayName);
            if (row.isSelf) {
                __VLS_asFunctionalElement1(__VLS_intrinsics.span, __VLS_intrinsics.span)({
                    ...{ class: "nadle-page__glb-you" },
                });
                /** @type {__VLS_StyleScopedClasses['nadle-page__glb-you']} */ ;
                (__VLS_ctx.youLabel);
            }
            __VLS_asFunctionalElement1(__VLS_intrinsics.td, __VLS_intrinsics.td)({
                ...{ class: "nadle-page__glb-td nadle-page__glb-td--score" },
            });
            /** @type {__VLS_StyleScopedClasses['nadle-page__glb-td']} */ ;
            /** @type {__VLS_StyleScopedClasses['nadle-page__glb-td--score']} */ ;
            (row.score);
            // @ts-ignore
            [tab, tab, tabRatingLabel, selfStreakSummary, selfStreakSummary, error, error, loading, loading, loading, rows, rows, rows, emptyText, scoreColumnHeader, scoreColumnHeader, colRank, colPlayer, youLabel,];
        }
    }
    let __VLS_0;
    /** @ts-ignore @type { | typeof __VLS_components.Transition | typeof __VLS_components.Transition} */
    Transition;
    // @ts-ignore
    const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
        name: "nadle-glb-loader",
    }));
    const __VLS_2 = __VLS_1({
        name: "nadle-glb-loader",
    }, ...__VLS_functionalComponentArgsRest(__VLS_1));
    const { default: __VLS_5 } = __VLS_3.slots;
    if (__VLS_ctx.loading) {
        __VLS_asFunctionalElement1(__VLS_intrinsics.div, __VLS_intrinsics.div)({
            ...{ class: "nadle-page__glb-loader" },
            role: "status",
            'aria-label': (__VLS_ctx.loadingText),
        });
        /** @type {__VLS_StyleScopedClasses['nadle-page__glb-loader']} */ ;
        __VLS_asFunctionalElement1(__VLS_intrinsics.span)({
            ...{ class: "nadle-page__glb-loader-dot" },
            'aria-hidden': "true",
        });
        /** @type {__VLS_StyleScopedClasses['nadle-page__glb-loader-dot']} */ ;
    }
    // @ts-ignore
    [loading, loadingText,];
    var __VLS_3;
}
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({
    __typeEmits: {},
    __typeProps: {},
});
export default {};
