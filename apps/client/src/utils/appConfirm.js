export function appConfirm(message) {
    if (typeof window === 'undefined') {
        return false;
    }
    return window.confirm(message);
}
