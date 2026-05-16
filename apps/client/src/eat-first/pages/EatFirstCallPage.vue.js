/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/template-helpers.d.ts" />
/// <reference types="C:/Users/mukol/AppData/Local/npm-cache/_npx/2db181330ea4b15b/node_modules/@vue/language-core/types/props-fallback.d.ts" />
import { computed, onUnmounted, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import CallPage from '@/components/call/CallPage.vue';
import GameRoomPageShell from '@/components/game-room/GameRoomPageShell.vue';
import { useEatFirstCallStreamView } from '@/composables/eatFirstCallStreamView';
import EatFirstCallHostPanel from '@/eat-first/components/EatFirstCallHostPanel.vue';
import EatFirstCallTimerStrip from '@/eat-first/components/EatFirstCallTimerStrip.vue';
import { useEatFirstCallGameSnapshot } from '@/eat-first/composables/useEatFirstCallGameSnapshot';
import { normalizeDisplayName } from 'call-core';
import { efEnsureGame } from '@/eat-first/services/eatFirstTransport';
import { setPersistedGameId } from '@/eat-first/utils/persistedGameId.js';
import { useEatFirstCallShellStore } from '@/stores/eatFirstCallShell';
import { resolveEatFirstTimerStripModel } from '@/eat-first/utils/eatFirstTimerStripModel';
import { createLogger } from '@/utils/logger';
const log = createLogger('eat-first:call-page');
const route = useRoute();
const { t } = useI18n();
const { isStreamView } = useEatFirstCallStreamView();
const eatFirstShell = useEatFirstCallShellStore();
const { eatFirstCallTimerFromTableSync, selectedTimerDurationMs: eatFirstSelectedTimerDurationMs } = storeToRefs(eatFirstShell);
const gameId = computed(() => {
    const g = route.query.game;
    return typeof g === 'string' ? normalizeDisplayName(g) : '';
});
const { snapshot, room, display, speakingTimer, timerRoomFields, gamePhase } = useEatFirstCallGameSnapshot(gameId, isStreamView);
watch(() => gameId.value, (gid) => {
    eatFirstShell.setGameId(gid);
    if (!gid) {
        return;
    }
    setPersistedGameId(gid);
    void efEnsureGame(gid).catch((e) => {
        log.warn('ensure game failed', e);
    });
}, { immediate: true });
watch(() => room.value.playerOrder, (po) => {
    const next = Array.isArray(po)
        ? po.filter((x) => typeof x === 'string' && /^p([1-9]|1[01])$/i.test(x.trim())).map((x) => x.trim())
        : [];
    const current = eatFirstShell.playerOrder;
    if (next.length < 1)
        return;
    // Signaling (`eat:table-state-sync` / `eat:trait-state-sync`) owns order after join; snapshot only seeds empty shell.
    if (current.length < 1) {
        eatFirstShell.setPlayerOrder(next);
    }
}, { immediate: true });
function normalizedTraitValue(data, key) {
    const chunk = data[key];
    if (typeof chunk === 'string') {
        return chunk.trim();
    }
    if (!chunk || typeof chunk !== 'object' || Array.isArray(chunk))
        return '';
    const value = chunk.value;
    return typeof value === 'string' ? value.trim() : '';
}
function normalizeLegacyTraitText(input) {
    const raw = String(input ?? '').trim();
    if (!raw)
        return '';
    const table = {
        Engineer: 'Професія: інженер',
        Teacher: 'Професія: вчитель',
        Doctor: 'Професія: лікар',
        Musician: 'Професія: музикант',
        Muscian: 'Професія: музикант',
        Designer: 'Професія: дизайнер',
        Athlete: 'Професія: спортсмен',
        Cook: 'Професія: кухар',
        Pilot: 'Професія: пілот',
        'Phobia: heights': 'Фобія: висота',
        'Phobia: darkness': 'Фобія: темрява',
        'Health: asthma': 'Здоров’я: астма',
        'Health: allergies': 'Здоров’я: алергія',
        'Luggage: toolkit': 'Багаж: набір інструментів',
        'Luggage: first-aid kit': 'Багаж: аптечка',
        'Fact: speaks 4 languages': 'Факт: говорить 4 мовами',
        'Fact: survived shipwreck': 'Факт: пережив кораблетрощу',
        'Quirk: never lies': 'Особливість: ніколи не бреше',
        'Quirk: sleepwalker': 'Особливість: говорить уві сні',
    };
    return table[raw] ?? raw;
}
function parseRoomTraitLines(lines) {
    const out = {};
    const map = [
        { key: 'profession', re: /^(професія|профессия|profession)\s*[:：-]\s*/i },
        { key: 'health', re: /^(здоров['’`]?я|здоровье|health)\s*[:：-]\s*/i },
        { key: 'hobby', re: /^(хобі|хобби|hobby|особливість|quirk)\s*[:：-]\s*/i },
        { key: 'phobia', re: /^(фобія|фобия|phobia)\s*[:：-]\s*/i },
        { key: 'fact', re: /^(факт|fact)\s*[:：-]\s*/i },
        { key: 'baggage', re: /^(багаж|luggage|bag)\s*[:：-]\s*/i },
    ];
    for (const line of lines) {
        const raw = normalizeLegacyTraitText(line);
        for (const row of map) {
            if (row.re.test(raw)) {
                out[row.key] = raw.replace(row.re, '').trim();
            }
        }
    }
    return out;
}
function slotTraitsForPlayer(row, roomTraits) {
    const fromRoom = parseRoomTraitLines(roomTraits);
    const profession = normalizedTraitValue(row, 'profession') || fromRoom.profession || '';
    const health = normalizedTraitValue(row, 'health') || fromRoom.health || '';
    const hobby = normalizedTraitValue(row, 'quirk') || fromRoom.hobby || '';
    const phobia = normalizedTraitValue(row, 'phobia') || fromRoom.phobia || '';
    const fact = normalizedTraitValue(row, 'fact') || fromRoom.fact || '';
    const baggage = normalizedTraitValue(row, 'luggage') || fromRoom.baggage || '';
    const age = typeof row.age === 'string' ? row.age.trim() : '';
    const gender = typeof row.gender === 'string' ? row.gender.trim() : '';
    const values = { gender, age, profession, health, hobby, phobia, fact, baggage };
    const complete = Object.values(values).every((v) => v.length > 0);
    return complete ? values : null;
}
function actionCardFromRow(row) {
    const ac = row.activeCard;
    if (!ac || typeof ac !== 'object' || Array.isArray(ac))
        return null;
    const r = ac;
    const title = typeof r.title === 'string' ? r.title.trim() : '';
    const description = typeof r.description === 'string' ? r.description.trim() : '';
    const templateId = typeof r.templateId === 'string' ? r.templateId.trim() : '';
    const effectId = typeof r.effectId === 'string' ? r.effectId.trim() : '';
    const used = r.used === true;
    if (title.length < 1 && templateId.length < 1)
        return null;
    return { title, description, templateId, effectId, used };
}
watch(() => [snapshot.value?.players, room.value.playerOrder], ([playersRaw, orderRaw]) => {
    const roomTraitsRaw = room.value.callTraitsBySeat && typeof room.value.callTraitsBySeat === 'object' && !Array.isArray(room.value.callTraitsBySeat)
        ? room.value.callTraitsBySeat
        : null;
    const players = Array.isArray(playersRaw) ? playersRaw : [];
    const order = Array.isArray(orderRaw)
        ? orderRaw.filter((x) => typeof x === 'string' && x.trim().length > 0)
        : [];
    const byId = new Map();
    for (const row of players) {
        if (!row || typeof row !== 'object' || Array.isArray(row))
            continue;
        const id = typeof row.id === 'string' ? String(row.id).trim() : '';
        if (!id)
            continue;
        byId.set(id, row);
    }
    const nextSlot = {};
    const nextActionCard = {};
    let lastUsed = null;
    order.forEach((slotId, index) => {
        const row = byId.get(slotId);
        if (!row)
            return;
        const fromRoom = (() => {
            if (roomTraitsRaw == null)
                return [];
            const seatRow = roomTraitsRaw[String(index + 1)];
            if (!Array.isArray(seatRow))
                return [];
            return seatRow
                .filter((x) => typeof x === 'string' && x.trim().length > 0)
                .map((x) => normalizeLegacyTraitText(x));
        })();
        const structuredTraits = slotTraitsForPlayer(row, fromRoom);
        if (structuredTraits) {
            nextSlot[slotId] = structuredTraits;
        }
        const ac = actionCardFromRow(row);
        if (ac) {
            nextActionCard[slotId] = ac;
            if (ac.used && ac.title.length > 0) {
                lastUsed = { slotId, title: ac.title, description: ac.description };
            }
        }
    });
    if (Object.keys(nextSlot).length > 0 && Object.keys(eatFirstShell.traitsBySlot).length < 1) {
        eatFirstShell.setTraitsBySlot(nextSlot);
    }
    if (Object.keys(eatFirstShell.actionCardBySlot).length < 1 && Object.keys(nextActionCard).length > 0) {
        eatFirstShell.setActionCardBySlot(nextActionCard);
    }
    if (eatFirstShell.lastUsedActionCard == null && lastUsed != null) {
        eatFirstShell.setLastUsedActionCard(lastUsed);
    }
}, { immediate: true });
watch(() => display.value.playerCount, (count) => {
    eatFirstShell.setPlayerCount(count);
}, { immediate: true });
const showHostPanel = computed(() => !isStreamView.value && eatFirstShell.isEatFirstRoomHost);
/** Prefer signaling timer from `eat:table-state-sync`; snapshot fields only when shell has no timer. */
const eatFirstTimerStripModel = computed(() => resolveEatFirstTimerStripModel({
    tableSyncTimer: eatFirstCallTimerFromTableSync.value,
    snapshotSpeakingTotalSec: speakingTimer.value,
    snapshotTimerFields: timerRoomFields.value,
}));
onUnmounted(() => {
    eatFirstShell.setEatFirstCallShellHost(false);
    eatFirstShell.setEatFirstCallTimerFromTableSync(null);
});
const __VLS_ctx = {
    ...{},
    ...{},
};
let __VLS_components;
let __VLS_intrinsics;
let __VLS_directives;
const __VLS_0 = GameRoomPageShell || GameRoomPageShell;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent1(__VLS_0, new __VLS_0({
    routeClass: "eat-first-call-page",
    isViewMode: (__VLS_ctx.isStreamView),
    signalingWarningVisible: (false),
    signalingWarningText: "",
}));
const __VLS_2 = __VLS_1({
    routeClass: "eat-first-call-page",
    isViewMode: (__VLS_ctx.isStreamView),
    signalingWarningVisible: (false),
    signalingWarningText: "",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
var __VLS_5 = {};
const { default: __VLS_6 } = __VLS_3.slots;
{
    const { stage: __VLS_7 } = __VLS_3.slots;
    const __VLS_8 = CallPage;
    // @ts-ignore
    const __VLS_9 = __VLS_asFunctionalComponent1(__VLS_8, new __VLS_8({
        eatFirstStreamView: (__VLS_ctx.isStreamView),
    }));
    const __VLS_10 = __VLS_9({
        eatFirstStreamView: (__VLS_ctx.isStreamView),
    }, ...__VLS_functionalComponentArgsRest(__VLS_9));
    // @ts-ignore
    [isStreamView, isStreamView,];
}
{
    const { 'host-panel': __VLS_13 } = __VLS_3.slots;
    if (__VLS_ctx.showHostPanel) {
        const __VLS_14 = EatFirstCallHostPanel;
        // @ts-ignore
        const __VLS_15 = __VLS_asFunctionalComponent1(__VLS_14, new __VLS_14({
            gameId: (__VLS_ctx.gameId),
            hostDisplaySeat: (__VLS_ctx.display.hostDisplaySeat),
            playerCount: (__VLS_ctx.display.playerCount),
            gamePhase: (__VLS_ctx.gamePhase),
            timerSpeakingTotalSec: (__VLS_ctx.eatFirstTimerStripModel.speakingTotalSec),
            timerStartedAt: (__VLS_ctx.eatFirstTimerStripModel.timerStartedAt),
            timerPaused: (__VLS_ctx.eatFirstTimerStripModel.timerPaused),
            timerFrozenRemainingSec: (__VLS_ctx.eatFirstTimerStripModel.frozenRemainingSec),
        }));
        const __VLS_16 = __VLS_15({
            gameId: (__VLS_ctx.gameId),
            hostDisplaySeat: (__VLS_ctx.display.hostDisplaySeat),
            playerCount: (__VLS_ctx.display.playerCount),
            gamePhase: (__VLS_ctx.gamePhase),
            timerSpeakingTotalSec: (__VLS_ctx.eatFirstTimerStripModel.speakingTotalSec),
            timerStartedAt: (__VLS_ctx.eatFirstTimerStripModel.timerStartedAt),
            timerPaused: (__VLS_ctx.eatFirstTimerStripModel.timerPaused),
            timerFrozenRemainingSec: (__VLS_ctx.eatFirstTimerStripModel.frozenRemainingSec),
        }, ...__VLS_functionalComponentArgsRest(__VLS_15));
    }
    // @ts-ignore
    [showHostPanel, gameId, display, display, gamePhase, eatFirstTimerStripModel, eatFirstTimerStripModel, eatFirstTimerStripModel, eatFirstTimerStripModel,];
}
{
    const { overlays: __VLS_19 } = __VLS_3.slots;
    const __VLS_20 = EatFirstCallTimerStrip;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent1(__VLS_20, new __VLS_20({
        viewMode: (__VLS_ctx.isStreamView),
        isEatFirstHost: (__VLS_ctx.showHostPanel),
        speakingTotalSec: (__VLS_ctx.eatFirstTimerStripModel.speakingTotalSec),
        timerStartedAt: (__VLS_ctx.eatFirstTimerStripModel.timerStartedAt),
        timerPaused: (__VLS_ctx.eatFirstTimerStripModel.timerPaused),
        frozenRemainingSec: (__VLS_ctx.eatFirstTimerStripModel.frozenRemainingSec),
        gameId: (__VLS_ctx.gameId),
        selectedTimerDurationMs: (__VLS_ctx.eatFirstSelectedTimerDurationMs),
    }));
    const __VLS_22 = __VLS_21({
        viewMode: (__VLS_ctx.isStreamView),
        isEatFirstHost: (__VLS_ctx.showHostPanel),
        speakingTotalSec: (__VLS_ctx.eatFirstTimerStripModel.speakingTotalSec),
        timerStartedAt: (__VLS_ctx.eatFirstTimerStripModel.timerStartedAt),
        timerPaused: (__VLS_ctx.eatFirstTimerStripModel.timerPaused),
        frozenRemainingSec: (__VLS_ctx.eatFirstTimerStripModel.frozenRemainingSec),
        gameId: (__VLS_ctx.gameId),
        selectedTimerDurationMs: (__VLS_ctx.eatFirstSelectedTimerDurationMs),
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
    // @ts-ignore
    [isStreamView, showHostPanel, gameId, eatFirstTimerStripModel, eatFirstTimerStripModel, eatFirstTimerStripModel, eatFirstTimerStripModel, eatFirstSelectedTimerDurationMs,];
}
// @ts-ignore
[];
var __VLS_3;
// @ts-ignore
[];
const __VLS_export = (await import('vue')).defineComponent({});
export default {};
