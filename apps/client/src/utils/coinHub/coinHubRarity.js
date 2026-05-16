export function getSpinRarity(value) {
    if (!Number.isFinite(value) || value < 0) {
        return 'common';
    }
    if (value < 10) {
        return 'common';
    }
    if (value < 20) {
        return 'uncommon';
    }
    if (value < 50) {
        return 'rare';
    }
    if (value < 100) {
        return 'epic';
    }
    return 'legendary';
}
export function getSpinRarityForLabel(label) {
    const n = Number.parseInt(label, 10);
    if (Number.isNaN(n)) {
        return 'common';
    }
    return getSpinRarity(n);
}
