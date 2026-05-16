import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { fetchLeaderboardRating, fetchLeaderboardStreak, fetchLeaderboardWins, } from '@/nadle/nadleApi';
export function useNadleGlobalLeaderboard(options) {
    const { t, locale } = useI18n();
    const { streamerProfile, effectiveNadleSlug, user } = options;
    const globalLbTab = ref('rating');
    const globalLbWinsRows = ref([]);
    const globalLbStreakRows = ref([]);
    const globalLbViewerMaxStreak = ref(undefined);
    const globalLbRatingRows = ref([]);
    const globalLbLoading = ref(false);
    const globalLbError = ref(null);
    function globalLbIsSelfRow(entry) {
        const u = user.value;
        if (!u) {
            return false;
        }
        if (u.dbUserId && entry.userId === u.dbUserId) {
            return true;
        }
        if (entry.userId === u.id) {
            return true;
        }
        if (u.twitchId && entry.userId === u.twitchId) {
            return true;
        }
        return false;
    }
    function globalLbInitials(name) {
        const s = String(name ?? '').trim();
        if (!s) {
            return '?';
        }
        return s[0].toUpperCase();
    }
    function globalLeaderboardQuery() {
        const id = streamerProfile.value?.id;
        if (typeof id === 'string' && id.length > 0) {
            return `?streamerId=${encodeURIComponent(id)}`;
        }
        const slug = effectiveNadleSlug.value;
        if (slug) {
            return `?streamer=${encodeURIComponent(slug)}`;
        }
        return '';
    }
    async function loadGlobalLbWins() {
        globalLbLoading.value = true;
        globalLbError.value = null;
        try {
            globalLbWinsRows.value = await fetchLeaderboardWins(globalLeaderboardQuery());
        }
        catch {
            globalLbError.value = t('nadleLeaderboard.loadError');
            globalLbWinsRows.value = [];
        }
        finally {
            globalLbLoading.value = false;
        }
    }
    async function loadGlobalLbStreak() {
        globalLbLoading.value = true;
        globalLbError.value = null;
        globalLbViewerMaxStreak.value = undefined;
        try {
            const { entries, viewerMaxStreak } = await fetchLeaderboardStreak(globalLeaderboardQuery());
            globalLbStreakRows.value = entries;
            globalLbViewerMaxStreak.value = viewerMaxStreak;
        }
        catch {
            globalLbError.value = t('nadleLeaderboard.loadError');
            globalLbStreakRows.value = [];
            globalLbViewerMaxStreak.value = undefined;
        }
        finally {
            globalLbLoading.value = false;
        }
    }
    async function loadGlobalLbRating() {
        globalLbLoading.value = true;
        globalLbError.value = null;
        try {
            globalLbRatingRows.value = await fetchLeaderboardRating(globalLeaderboardQuery());
        }
        catch {
            globalLbError.value = t('nadleLeaderboard.loadError');
            globalLbRatingRows.value = [];
        }
        finally {
            globalLbLoading.value = false;
        }
    }
    async function loadGlobalLbActive() {
        if (globalLbTab.value === 'wins') {
            await loadGlobalLbWins();
        }
        else if (globalLbTab.value === 'streak') {
            await loadGlobalLbStreak();
        }
        else {
            await loadGlobalLbRating();
        }
    }
    watch(globalLbTab, () => {
        void loadGlobalLbActive();
    });
    watch(() => streamerProfile.value?.id, () => {
        void loadGlobalLbActive();
    });
    const globalLbDisplayRows = computed(() => {
        if (globalLbTab.value === 'wins') {
            return globalLbWinsRows.value;
        }
        if (globalLbTab.value === 'streak') {
            return globalLbStreakRows.value;
        }
        return globalLbRatingRows.value;
    });
    const globalLbScoreLabel = computed(() => {
        void locale.value;
        if (globalLbTab.value === 'wins') {
            return t('nadleLeaderboard.scoreWins');
        }
        if (globalLbTab.value === 'streak') {
            return t('nadleLeaderboard.scoreStreak');
        }
        return t('nadleLeaderboard.scoreRating');
    });
    function globalLbScoreFor(row) {
        if (globalLbTab.value === 'wins') {
            return row.wins;
        }
        if (globalLbTab.value === 'streak') {
            return row.streak;
        }
        return row.rating;
    }
    const globalLbTableRows = computed(() => {
        const tab = globalLbTab.value;
        return globalLbDisplayRows.value.map((row) => ({
            rowKey: `${tab}-${row.userId}-${row.rank}`,
            rank: row.rank,
            displayName: row.displayName,
            avatarUrl: row.avatarUrl,
            score: globalLbScoreFor(row),
            isSelf: globalLbIsSelfRow(row),
            initials: globalLbInitials(row.displayName),
        }));
    });
    const globalLbSelfStreakSummary = computed(() => {
        void locale.value;
        if (globalLbTab.value !== 'streak' || !user.value) {
            return null;
        }
        const v = globalLbViewerMaxStreak.value;
        if (v === undefined) {
            return null;
        }
        return t('nadleLeaderboard.selfBestStreak', { n: v });
    });
    return {
        globalLbTab,
        globalLbLoading,
        globalLbError,
        globalLbTableRows,
        globalLbScoreLabel,
        globalLbSelfStreakSummary,
        loadGlobalLbActive,
    };
}
