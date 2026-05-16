import { useRouter } from 'vue-router';
import { safeOAuthRedirectPath } from '@/utils/safeOAuthRedirectPath';
export function useStreamAuthModal() {
    const router = useRouter();
    function openStreamAuthModal(redirectPath = '/app', mode = 'login') {
        void router.push({
            path: '/auth',
            query: {
                redirect: safeOAuthRedirectPath(redirectPath),
                mode,
            },
        });
    }
    function closeStreamAuthModal() { }
    return {
        openStreamAuthModal,
        closeStreamAuthModal,
    };
}
