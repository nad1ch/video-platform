import { onBeforeUnmount, nextTick, ref, shallowRef, watch } from 'vue';
import { EatFirstWs } from '@/eat-first/eatFirstWsProtocol';
const EAT_FIRST_TRAIT_ORDER = [
    'gender',
    'age',
    'profession',
    'health',
    'hobby',
    'phobia',
    'fact',
    'baggage',
];
const EAT_FIRST_HOST_UPDATED_SIGNAL = EatFirstWs.hostUpdated;
const EAT_FIRST_FORCE_MUTE_ALL_SIGNAL = EatFirstWs.forceMuteAll;
const EAT_FIRST_TRAIT_REVEALED_SIGNAL = EatFirstWs.traitRevealed;
const EAT_FIRST_TRAIT_REGENERATED_SIGNAL = EatFirstWs.traitRegenerated;
const EAT_FIRST_TRAIT_TYPE_REROLLED_SIGNAL = EatFirstWs.traitTypeRerolled;
const EAT_FIRST_ACTION_CARD_REROLLED_SIGNAL = EatFirstWs.actionCardRerolled;
const EAT_FIRST_ACTION_CARD_USED_SIGNAL = EatFirstWs.actionCardUsed;
const EAT_FIRST_SPEAKING_QUEUE_UPDATE_SIGNAL = EatFirstWs.speakingQueueUpdate;
const EAT_FIRST_TRAIT_STATE_SYNC_SIGNAL = EatFirstWs.traitStateSync;
const EAT_FIRST_TABLE_STATE_SYNC_SIGNAL = EatFirstWs.tableStateSync;
const EAT_FIRST_TIMER_PRESET_SELECT_SIGNAL = EatFirstWs.timerPresetSelect;
export function useEatFirstCallSignaling(deps) {
    const { subscribeSignalingMessage, selfPeerId, roomId, isEatFirstRoute, eatFirstShell, micEnabled, toggleMic, attemptSlotClaim, patchTraitForSlot, onPlayerUsedActionCard, log, } = deps;
    /** Suppress host echo when applying `eat:speaking-queue-update` from the server. */
    const applyingSpeakingQueueFromSignaling = ref(false);
    /**
     * Eat First trait state is keyed by **slotId** (`p1..p11`), not peerId.
     * Server-side `revealedBySlot`/`overridesBySlot`/`openedBySlot` is the source
     * of truth; on a hard refresh the new peer rebinds via `eat:slot-claim` and
     * the same reveal/override state re-attaches to it.
     */
    const revealedBySlot = shallowRef({});
    const overridesBySlot = shallowRef({});
    const openedBySlot = shallowRef({});
    /**
     * Server-authoritative `peerId → slotId` map and `playerOrder` in
     * `eat:trait-state-sync` / `eat:table-state-sync`. Replaces the old
     * `eatFirstSeatByPeer` (which derived seat from local tile index and made
     * every client see only the first player's traits).
     */
    const slotByPeer = shallowRef({});
    watch(() => roomId.value, () => {
        revealedBySlot.value = {};
        overridesBySlot.value = {};
        openedBySlot.value = {};
        slotByPeer.value = {};
    });
    const off = subscribeSignalingMessage((data) => {
        if (!isEatFirstRoute.value) {
            return;
        }
        const rec = data;
        if (rec.type === 'room-state') {
            attemptSlotClaim();
            return;
        }
        if (rec.type === EAT_FIRST_HOST_UPDATED_SIGNAL) {
            const payload = rec.payload != null && typeof rec.payload === 'object'
                ? rec.payload
                : null;
            const hostPeerId = typeof payload?.hostPeerId === 'string' ? payload.hostPeerId.trim() : '';
            const selfId = typeof selfPeerId.value === 'string' ? selfPeerId.value.trim() : '';
            eatFirstShell.setEatFirstHostPeer(hostPeerId || null, selfId || null);
            return;
        }
        if (rec.type === EAT_FIRST_SPEAKING_QUEUE_UPDATE_SIGNAL) {
            const payload = rec.payload != null && typeof rec.payload === 'object'
                ? rec.payload
                : null;
            const raw = payload?.speakingQueue;
            applyingSpeakingQueueFromSignaling.value = true;
            eatFirstShell.applySpeakingQueueFromSignaling(Array.isArray(raw) ? raw : []);
            void nextTick(() => {
                applyingSpeakingQueueFromSignaling.value = false;
            });
            return;
        }
        if (rec.type === EAT_FIRST_TABLE_STATE_SYNC_SIGNAL) {
            const payload = rec.payload != null && typeof rec.payload === 'object'
                ? rec.payload
                : null;
            if (!payload)
                return;
            overridesBySlot.value = {};
            const playerOrderRaw = Array.isArray(payload.playerOrder) ? payload.playerOrder : [];
            const nextPlayerOrder = playerOrderRaw
                .filter((x) => typeof x === 'string' && /^p([1-9]|1[01])$/i.test(x.trim()))
                .map((x) => x.trim());
            if (nextPlayerOrder.length > 0) {
                eatFirstShell.setPlayerOrder(nextPlayerOrder);
            }
            const slotByPeerRaw = payload.slotByPeer && typeof payload.slotByPeer === 'object' && !Array.isArray(payload.slotByPeer)
                ? payload.slotByPeer
                : {};
            const nextSlotByPeer = {};
            for (const [peerId, slotUnknown] of Object.entries(slotByPeerRaw)) {
                if (typeof slotUnknown !== 'string')
                    continue;
                const slot = slotUnknown.trim();
                if (!/^p([1-9]|1[01])$/i.test(slot))
                    continue;
                nextSlotByPeer[peerId] = slot;
            }
            slotByPeer.value = nextSlotByPeer;
            const traitsBySlotRaw = payload.traitsBySlot && typeof payload.traitsBySlot === 'object' && !Array.isArray(payload.traitsBySlot)
                ? payload.traitsBySlot
                : {};
            const mergedTraitsBySlot = { ...eatFirstShell.traitsBySlot };
            for (const [slotId, rowUnknown] of Object.entries(traitsBySlotRaw)) {
                if (!/^p([1-9]|1[01])$/i.test(String(slotId).trim()))
                    continue;
                if (!rowUnknown || typeof rowUnknown !== 'object' || Array.isArray(rowUnknown))
                    continue;
                const row = rowUnknown;
                const normalized = {};
                let complete = true;
                for (const key of EAT_FIRST_TRAIT_ORDER) {
                    const value = typeof row[key] === 'string' ? row[key].trim() : '';
                    if (value.length < 1) {
                        complete = false;
                        break;
                    }
                    normalized[key] = value;
                }
                if (complete)
                    mergedTraitsBySlot[slotId.trim()] = normalized;
            }
            eatFirstShell.setTraitsBySlot(mergedTraitsBySlot);
            const actionCardBySlotRaw = payload.actionCardBySlot &&
                typeof payload.actionCardBySlot === 'object' &&
                !Array.isArray(payload.actionCardBySlot)
                ? payload.actionCardBySlot
                : {};
            const mergedActionCardBySlot = { ...eatFirstShell.actionCardBySlot };
            for (const [slotId, rowUnknown] of Object.entries(actionCardBySlotRaw)) {
                if (!/^p([1-9]|1[01])$/i.test(String(slotId).trim()))
                    continue;
                if (!rowUnknown || typeof rowUnknown !== 'object' || Array.isArray(rowUnknown))
                    continue;
                const row = rowUnknown;
                const title = typeof row.title === 'string' ? row.title.trim() : '';
                const description = typeof row.description === 'string' ? row.description.trim() : '';
                const templateId = typeof row.templateId === 'string' ? row.templateId.trim() : '';
                const effectId = typeof row.effectId === 'string' ? row.effectId.trim() : '';
                const used = row.used === true;
                if (title.length < 1 && templateId.length < 1)
                    continue;
                mergedActionCardBySlot[slotId.trim()] = { title, description, templateId, effectId, used };
            }
            eatFirstShell.setActionCardBySlot(mergedActionCardBySlot);
            const lastUsedRaw = payload.lastUsedActionCard &&
                typeof payload.lastUsedActionCard === 'object' &&
                !Array.isArray(payload.lastUsedActionCard)
                ? payload.lastUsedActionCard
                : null;
            if (lastUsedRaw) {
                const slotId = typeof lastUsedRaw.slotId === 'string' ? lastUsedRaw.slotId.trim() : '';
                const title = typeof lastUsedRaw.title === 'string' ? lastUsedRaw.title.trim() : '';
                const description = typeof lastUsedRaw.description === 'string' ? lastUsedRaw.description.trim() : '';
                if (slotId.length > 0 && title.length > 0) {
                    eatFirstShell.setLastUsedActionCard({ slotId, title, description });
                }
                else {
                    eatFirstShell.setLastUsedActionCard(null);
                }
            }
            else {
                eatFirstShell.setLastUsedActionCard(null);
            }
            if (Object.prototype.hasOwnProperty.call(payload, 'timer')) {
                const timerRaw = payload.timer;
                let nextCallTimer = null;
                if (timerRaw === null) {
                    nextCallTimer = null;
                }
                else if (timerRaw && typeof timerRaw === 'object' && !Array.isArray(timerRaw)) {
                    const tr = timerRaw;
                    const startedAt = typeof tr.startedAt === 'number' ? tr.startedAt : Number.NaN;
                    const duration = typeof tr.duration === 'number' ? tr.duration : Number.NaN;
                    if (tr.isRunning === true &&
                        Number.isFinite(startedAt) &&
                        Number.isFinite(duration) &&
                        duration >= 5000 &&
                        duration <= 7_200_000) {
                        nextCallTimer = { startedAt, durationMs: duration, isRunning: true };
                    }
                }
                eatFirstShell.setEatFirstCallTimerFromTableSync(nextCallTimer);
            }
            const revealedRaw = payload.revealedTraitsBySlot &&
                typeof payload.revealedTraitsBySlot === 'object' &&
                !Array.isArray(payload.revealedTraitsBySlot)
                ? payload.revealedTraitsBySlot
                : {};
            const openedRaw = payload.openedByBySlot && typeof payload.openedByBySlot === 'object' && !Array.isArray(payload.openedByBySlot)
                ? payload.openedByBySlot
                : {};
            const nextRevealedBySlot = {};
            for (const [slotId, keysUnknown] of Object.entries(revealedRaw)) {
                if (!Array.isArray(keysUnknown))
                    continue;
                const row = {};
                for (const key of keysUnknown) {
                    if (typeof key === 'string' && key.trim().length > 0)
                        row[key.trim()] = true;
                }
                if (Object.keys(row).length > 0)
                    nextRevealedBySlot[slotId] = row;
            }
            const nextOpenedBySlot = {};
            for (const [slotId, rowUnknown] of Object.entries(openedRaw)) {
                if (!rowUnknown || typeof rowUnknown !== 'object' || Array.isArray(rowUnknown))
                    continue;
                const row = rowUnknown;
                const out = {};
                for (const [traitKey, openedBy] of Object.entries(row)) {
                    if (openedBy === 'player' || openedBy === 'host')
                        out[traitKey] = true;
                }
                if (Object.keys(out).length > 0)
                    nextOpenedBySlot[slotId] = out;
            }
            revealedBySlot.value = nextRevealedBySlot;
            openedBySlot.value = nextOpenedBySlot;
            attemptSlotClaim();
            return;
        }
        if (rec.type === EAT_FIRST_TRAIT_STATE_SYNC_SIGNAL) {
            const payload = rec.payload != null && typeof rec.payload === 'object'
                ? rec.payload
                : null;
            if (!payload)
                return;
            const traitSyncPlayerOrderRaw = Array.isArray(payload.playerOrder) ? payload.playerOrder : [];
            const traitSyncPlayerOrder = traitSyncPlayerOrderRaw
                .filter((x) => typeof x === 'string' && /^p([1-9]|1[01])$/i.test(x.trim()))
                .map((x) => x.trim());
            if (traitSyncPlayerOrder.length > 0) {
                eatFirstShell.setPlayerOrder(traitSyncPlayerOrder);
            }
            const revealedRaw = payload.revealedBySlot && typeof payload.revealedBySlot === 'object' && !Array.isArray(payload.revealedBySlot)
                ? payload.revealedBySlot
                : {};
            const overridesRaw = payload.overridesBySlot && typeof payload.overridesBySlot === 'object' && !Array.isArray(payload.overridesBySlot)
                ? payload.overridesBySlot
                : {};
            const openedRaw = payload.openedBySlot && typeof payload.openedBySlot === 'object' && !Array.isArray(payload.openedBySlot)
                ? payload.openedBySlot
                : {};
            const slotByPeerRaw = payload.slotByPeer && typeof payload.slotByPeer === 'object' && !Array.isArray(payload.slotByPeer)
                ? payload.slotByPeer
                : {};
            const nextSlotByPeer = {};
            for (const [peerId, slotUnknown] of Object.entries(slotByPeerRaw)) {
                if (typeof slotUnknown !== 'string')
                    continue;
                const slot = slotUnknown.trim();
                if (slot.length < 1)
                    continue;
                nextSlotByPeer[peerId] = slot;
            }
            slotByPeer.value = nextSlotByPeer;
            if (import.meta.env.DEV) {
                log?.info('[eat-first:slot-map:update]', {
                    selfPeerId: selfPeerId.value,
                    selfSlotId: selfPeerId.value ? nextSlotByPeer[selfPeerId.value] ?? null : null,
                });
            }
            const nextRevealedBySlot = {};
            const nextOverridesBySlot = {};
            const nextOpenedBySlot = {};
            for (const [slotId, keysUnknown] of Object.entries(revealedRaw)) {
                if (!Array.isArray(keysUnknown))
                    continue;
                const row = {};
                for (const k of keysUnknown) {
                    if (typeof k === 'string' && k.trim().length > 0) {
                        row[k.trim()] = true;
                    }
                }
                if (Object.keys(row).length > 0)
                    nextRevealedBySlot[slotId] = row;
            }
            for (const [slotId, rowUnknown] of Object.entries(overridesRaw)) {
                if (!rowUnknown || typeof rowUnknown !== 'object' || Array.isArray(rowUnknown))
                    continue;
                const row = rowUnknown;
                const out = {};
                for (const [k, v] of Object.entries(row)) {
                    if (typeof k === 'string' && k.trim().length > 0 && typeof v === 'string' && v.trim().length > 0) {
                        out[k.trim()] = v.trim();
                    }
                }
                if (Object.keys(out).length > 0)
                    nextOverridesBySlot[slotId] = out;
            }
            for (const [slotId, keysUnknown] of Object.entries(openedRaw)) {
                if (!Array.isArray(keysUnknown))
                    continue;
                const row = {};
                for (const k of keysUnknown) {
                    if (typeof k === 'string' && k.trim().length > 0) {
                        row[k.trim()] = true;
                    }
                }
                if (Object.keys(row).length > 0)
                    nextOpenedBySlot[slotId] = row;
            }
            revealedBySlot.value = nextRevealedBySlot;
            overridesBySlot.value = nextOverridesBySlot;
            openedBySlot.value = nextOpenedBySlot;
            return;
        }
        if (rec.type === EAT_FIRST_TRAIT_REVEALED_SIGNAL) {
            const payload = rec.payload != null && typeof rec.payload === 'object'
                ? rec.payload
                : null;
            const slotId = typeof payload?.slotId === 'string' ? payload.slotId.trim() : '';
            const traitKey = typeof payload?.traitKey === 'string' ? payload.traitKey.trim() : '';
            const openedBy = payload?.openedBy === 'host' ? 'host' : 'player';
            const closed = payload?.closed === true;
            if (!slotId || !traitKey)
                return;
            if (closed) {
                const prevRevealed = revealedBySlot.value[slotId];
                if (prevRevealed && prevRevealed[traitKey]) {
                    const nextRow = { ...prevRevealed };
                    delete nextRow[traitKey];
                    const next = { ...revealedBySlot.value };
                    if (Object.keys(nextRow).length > 0)
                        next[slotId] = nextRow;
                    else
                        delete next[slotId];
                    revealedBySlot.value = next;
                }
                const prevOpened = openedBySlot.value[slotId];
                if (prevOpened && prevOpened[traitKey]) {
                    const nextRow = { ...prevOpened };
                    delete nextRow[traitKey];
                    const next = { ...openedBySlot.value };
                    if (Object.keys(nextRow).length > 0)
                        next[slotId] = nextRow;
                    else
                        delete next[slotId];
                    openedBySlot.value = next;
                }
                return;
            }
            revealedBySlot.value = {
                ...revealedBySlot.value,
                [slotId]: { ...(revealedBySlot.value[slotId] ?? {}), [traitKey]: true },
            };
            if (openedBy === 'player') {
                openedBySlot.value = {
                    ...openedBySlot.value,
                    [slotId]: { ...(openedBySlot.value[slotId] ?? {}), [traitKey]: true },
                };
            }
            return;
        }
        if (rec.type === EAT_FIRST_TRAIT_REGENERATED_SIGNAL) {
            const payload = rec.payload != null && typeof rec.payload === 'object'
                ? rec.payload
                : null;
            const slotId = typeof payload?.slotId === 'string' ? payload.slotId.trim() : '';
            const traitKey = typeof payload?.traitKey === 'string' ? payload.traitKey.trim() : '';
            const value = typeof payload?.value === 'string' ? payload.value.trim() : '';
            if (!slotId || !traitKey || !value)
                return;
            patchTraitForSlot(slotId, traitKey, value);
            overridesBySlot.value = {
                ...overridesBySlot.value,
                [slotId]: { ...(overridesBySlot.value[slotId] ?? {}), [traitKey]: value },
            };
            return;
        }
        if (rec.type === EAT_FIRST_TRAIT_TYPE_REROLLED_SIGNAL) {
            const payload = rec.payload != null && typeof rec.payload === 'object'
                ? rec.payload
                : null;
            const traitKey = typeof payload?.traitKey === 'string' ? payload.traitKey.trim() : '';
            const valuesBySlotRaw = payload?.valuesBySlot &&
                typeof payload.valuesBySlot === 'object' &&
                !Array.isArray(payload.valuesBySlot)
                ? payload.valuesBySlot
                : null;
            if (!traitKey || !valuesBySlotRaw)
                return;
            const next = { ...overridesBySlot.value };
            for (const [slotId, valueUnknown] of Object.entries(valuesBySlotRaw)) {
                if (typeof valueUnknown !== 'string')
                    continue;
                const value = valueUnknown.trim();
                if (value.length < 1)
                    continue;
                patchTraitForSlot(slotId, traitKey, value);
                next[slotId] = { ...(next[slotId] ?? {}), [traitKey]: value };
            }
            overridesBySlot.value = next;
            return;
        }
        if (rec.type === EAT_FIRST_ACTION_CARD_REROLLED_SIGNAL) {
            const payload = rec.payload != null && typeof rec.payload === 'object'
                ? rec.payload
                : null;
            const slotId = typeof payload?.slotId === 'string' ? payload.slotId.trim() : '';
            const card = payload?.card && typeof payload.card === 'object' && !Array.isArray(payload.card)
                ? payload.card
                : null;
            if (!slotId || !card)
                return;
            const title = typeof card.title === 'string' ? card.title : '';
            const description = typeof card.description === 'string' ? card.description : '';
            const templateId = typeof card.templateId === 'string' ? card.templateId : '';
            const effectId = typeof card.effectId === 'string' ? card.effectId : '';
            const used = card.used === true;
            eatFirstShell.setActionCardForSlot(slotId, { title, description, templateId, effectId, used });
            return;
        }
        if (rec.type === EAT_FIRST_ACTION_CARD_USED_SIGNAL) {
            if (!eatFirstShell.isEatFirstRoomHost)
                return;
            const payload = rec.payload != null && typeof rec.payload === 'object'
                ? rec.payload
                : null;
            const peerId = typeof payload?.peerId === 'string' ? payload.peerId.trim() : '';
            const title = typeof payload?.title === 'string' ? payload.title.trim() : '';
            if (!peerId || title.length < 1)
                return;
            onPlayerUsedActionCard({ peerId, title });
            return;
        }
        if (rec.type === EAT_FIRST_TIMER_PRESET_SELECT_SIGNAL) {
            const payload = rec.payload != null && typeof rec.payload === 'object'
                ? rec.payload
                : null;
            const ms = payload?.durationMs;
            if (typeof ms === 'number' && Number.isFinite(ms)) {
                eatFirstShell.setEatFirstSelectedTimerDurationMs(Math.floor(ms));
            }
            return;
        }
        if (rec.type !== EAT_FIRST_FORCE_MUTE_ALL_SIGNAL || rec.payload == null || typeof rec.payload !== 'object')
            return;
        if (eatFirstShell.isEatFirstRoomHost)
            return;
        const payload = rec.payload;
        const muted = payload.muted !== false;
        if (muted && micEnabled.value) {
            void toggleMic();
        }
        else if (!muted && !micEnabled.value) {
            void toggleMic();
        }
    });
    onBeforeUnmount(off);
    return {
        applyingSpeakingQueueFromSignaling,
        slotByPeer,
        revealedBySlot,
        overridesBySlot,
        openedBySlot,
    };
}
