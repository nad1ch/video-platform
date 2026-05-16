import { apiFetch, readJsonIfOk } from '@/utils/apiFetch';
import { apiUrl } from '@/utils/apiUrl';
/**
 * Same branching as the former inline `fetchNadlePublicConfig` in NadleStreamPage:
 * - HTTP !ok → noop (keep previous config)
 * - invalid JSON → clear
 * - invalid cooldown field → noop
 * - network throw → clear
 */
export async function requestNadlePublicConfig(streamerId) {
    try {
        const res = await fetch(apiUrl(`/api/nadle/public-config?streamerId=${encodeURIComponent(streamerId)}`));
        if (!res.ok) {
            return { kind: 'noop' };
        }
        const j = await readJsonIfOk(res);
        if (!j) {
            return { kind: 'clear' };
        }
        if (typeof j.chatGuessCooldownMs !== 'number' || !Number.isFinite(j.chatGuessCooldownMs)) {
            return { kind: 'noop' };
        }
        return {
            kind: 'set',
            value: {
                ingestChannel: typeof j.ingestChannel === 'string' ? j.ingestChannel : null,
                chatGuessCooldownMs: j.chatGuessCooldownMs,
            },
        };
    }
    catch {
        return { kind: 'clear' };
    }
}
export async function fetchLeaderboardWins(querySuffix) {
    const res = await apiFetch(`/api/leaderboard/wins${querySuffix}`);
    const j = (await res.json());
    const list = Array.isArray(j.entries) ? j.entries : [];
    return list
        .map((raw, i) => {
        const o = raw;
        const rank = typeof o.rank === 'number' ? o.rank : i + 1;
        const userId = typeof o.userId === 'string' ? o.userId : '';
        const displayName = typeof o.displayName === 'string' ? o.displayName : userId || '—';
        const avatarUrl = typeof o.avatarUrl === 'string' ? o.avatarUrl : null;
        const wins = typeof o.wins === 'number' && Number.isFinite(o.wins) ? o.wins : 0;
        return { rank, userId, displayName, avatarUrl, wins };
    })
        .filter((r) => r.userId.length > 0);
}
export async function fetchLeaderboardStreak(querySuffix) {
    const res = await apiFetch(`/api/leaderboard/streak${querySuffix}`);
    const j = (await res.json());
    const list = Array.isArray(j.entries) ? j.entries : [];
    const entries = list
        .map((raw, i) => {
        const o = raw;
        const rank = typeof o.rank === 'number' ? o.rank : i + 1;
        const userId = typeof o.userId === 'string' ? o.userId : '';
        const displayName = typeof o.displayName === 'string' ? o.displayName : userId || '—';
        const avatarUrl = typeof o.avatarUrl === 'string' ? o.avatarUrl : null;
        const streak = typeof o.streak === 'number' && Number.isFinite(o.streak) ? o.streak : 0;
        return { rank, userId, displayName, avatarUrl, streak };
    })
        .filter((r) => r.userId.length > 0);
    const viewerMaxStreak = typeof j.viewerMaxStreak === 'number' && Number.isFinite(j.viewerMaxStreak) ? j.viewerMaxStreak : undefined;
    return { entries, viewerMaxStreak };
}
export async function fetchLeaderboardRating(querySuffix) {
    const res = await apiFetch(`/api/leaderboard/rating${querySuffix}`);
    const j = (await res.json());
    const list = Array.isArray(j.entries) ? j.entries : [];
    return list
        .map((raw, i) => {
        const o = raw;
        const rank = typeof o.rank === 'number' ? o.rank : i + 1;
        const userId = typeof o.userId === 'string' ? o.userId : '';
        const displayName = typeof o.displayName === 'string' ? o.displayName : userId || '—';
        const avatarUrl = typeof o.avatarUrl === 'string' ? o.avatarUrl : null;
        const rating = typeof o.rating === 'number' && Number.isFinite(o.rating) ? o.rating : 0;
        const wins = typeof o.wins === 'number' && Number.isFinite(o.wins) ? o.wins : 0;
        const losses = typeof o.losses === 'number' && Number.isFinite(o.losses) ? o.losses : 0;
        return { rank, userId, displayName, avatarUrl, rating, wins, losses };
    })
        .filter((r) => r.userId.length > 0);
}
