import { computed } from 'vue';
import { useRoute, } from 'vue-router';
export function createStreamViewRouteHelpers(routeName) {
    function viewQueryIsView(mode) {
        if (mode === 'view') {
            return true;
        }
        return Array.isArray(mode) && mode[0] === 'view';
    }
    function streamViewFromRoute(route) {
        if (route.name !== routeName) {
            return false;
        }
        return viewQueryIsView(route.query.mode);
    }
    function useViewMode() {
        const route = useRoute();
        return {
            isViewMode: computed(() => streamViewFromRoute(route)),
        };
    }
    function useStreamViewFromRoute() {
        const route = useRoute();
        const isViewMode = computed(() => streamViewFromRoute(route));
        return {
            isStreamView: isViewMode,
            isViewMode,
        };
    }
    return {
        viewQueryIsView,
        streamViewFromRoute,
        useViewMode,
        useStreamViewFromRoute,
    };
}
