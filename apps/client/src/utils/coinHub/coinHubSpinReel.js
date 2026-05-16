/**
 * Daily spin reel builder: structured cells (coins + bonus theatre), rarity, near-miss, dry-streak bias.
 * Authoritative payout remains the server `targetPayout` (coins only in API); bonuses are visual filler.
 */
import { getSpinRarity } from '@/utils/coinHub/coinHubRarity';
const WAVE_PASSES = 5;
const FILLER_LEN = 24;
const RIGHT_PAD_AFTER_WIN = 14;
export const SPIN_BIG_WIN_MIN_COINS = 50;
const POOL_VALUES = [5, 8, 10, 12, 15, 20, 25, 50, 100];
const COMMON_VALS = [5, 8];
const UNCOMMON_VALS = [10, 12, 15];
const RARE_VALS = [20, 25];
const EPIC_VALS = [50];
const LEGENDARY_VALS = [100];
const BONUS_TYPES = ['boost', 'case', 'multiplier'];
const BONUS_DISPLAY = {
    boost: { display: '⚡', rarity: 'rare' },
    case: { display: '📦', rarity: 'epic' },
    multiplier: { display: '×2', rarity: 'legendary' },
};
let idSeq = 0;
function nextId() {
    idSeq += 1;
    return `ch-reel-${idSeq}`;
}
function shuffleInPlace(arr, rng) {
    for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        const a = arr[i];
        const b = arr[j];
        arr[i] = b;
        arr[j] = a;
    }
    return arr;
}
function pickIn(arr, rng) {
    return arr[Math.floor(rng() * arr.length)];
}
export function pickRarityWithBias(dry, rng) {
    const d = Math.min(24, Math.max(0, dry));
    const shift = Math.min(0.09, d * 0.0035);
    let pC = 0.52 - shift;
    let pU = 0.1 + shift * 0.2;
    let pR = 0.2 + shift * 0.4;
    let pE = 0.12 + shift * 0.3;
    const pL = 0.06 + shift * 0.2;
    const sum = pC + pU + pR + pE + pL;
    pC /= sum;
    pU /= sum;
    pR /= sum;
    pE /= sum;
    const r = rng();
    if (r < pC) {
        return 'common';
    }
    if (r < pC + pU) {
        return 'uncommon';
    }
    if (r < pC + pU + pR) {
        return 'rare';
    }
    if (r < pC + pU + pR + pE) {
        return 'epic';
    }
    return 'legendary';
}
function coinValueForRarity(tier, rng) {
    switch (tier) {
        case 'common':
            return pickIn(COMMON_VALS, rng);
        case 'uncommon':
            return pickIn(UNCOMMON_VALS, rng);
        case 'rare':
            return pickIn(RARE_VALS, rng);
        case 'epic':
            return pickIn(EPIC_VALS, rng);
        case 'legendary':
        default:
            return pickIn(LEGENDARY_VALS, rng);
    }
}
function coinCell(value, nearMiss = false) {
    return {
        id: nextId(),
        display: String(value),
        rarity: getSpinRarity(value),
        kind: 'coins',
        nearMiss,
    };
}
function bonusCell(kind) {
    const b = BONUS_DISPLAY[kind];
    return {
        id: nextId(),
        display: b.display,
        rarity: b.rarity,
        kind: 'bonus',
        bonusType: kind,
    };
}
function pickFillerCell(dry, rng) {
    if (rng() < 0.09) {
        return bonusCell(BONUS_TYPES[Math.floor(rng() * BONUS_TYPES.length)]);
    }
    const tier = pickRarityWithBias(dry, rng);
    return coinCell(coinValueForRarity(tier, rng));
}
function useExtendedNearMissTease(targetPayout, rng) {
    if (getSpinRarity(targetPayout) === 'legendary') {
        return false;
    }
    return rng() < 0.26;
}
function buildTeaseCells(targetPayout, rng) {
    if (useExtendedNearMissTease(targetPayout, rng)) {
        if (targetPayout >= 100) {
            return [coinCell(100, true), coinCell(50, true), coinCell(50), coinCell(targetPayout)];
        }
        const mid = targetPayout <= 12 ? 12 : targetPayout < 50 ? 25 : 50;
        return [coinCell(100, true), coinCell(50, true), coinCell(mid), coinCell(targetPayout)];
    }
    if (targetPayout >= 100) {
        if (targetPayout === 100) {
            return [coinCell(100), coinCell(50), coinCell(targetPayout)];
        }
        return rng() < 0.5
            ? [coinCell(100), coinCell(50), coinCell(targetPayout)]
            : [coinCell(100), coinCell(99), coinCell(targetPayout)];
    }
    if (targetPayout === 50) {
        return [coinCell(100, true), coinCell(25), coinCell(targetPayout)];
    }
    if (targetPayout < 50) {
        return [coinCell(100, true), coinCell(50), coinCell(targetPayout)];
    }
    return [coinCell(100), coinCell(50), coinCell(targetPayout)];
}
export function buildSpinStripFromPayout(targetPayout, opts) {
    const rng = opts?.rng ?? Math.random;
    const dry = Math.max(0, opts?.spinsSinceBigWin ?? 0);
    idSeq = 0;
    const out = [];
    for (let w = 0; w < WAVE_PASSES; w += 1) {
        const wave = shuffleInPlace([...POOL_VALUES], rng);
        for (const n of wave) {
            out.push(coinCell(n));
        }
    }
    for (let i = 0; i < FILLER_LEN; i += 1) {
        out.push(pickFillerCell(dry, rng));
    }
    if (targetPayout < 100 && rng() < 0.32) {
        out.push(coinCell(100, true));
    }
    const tease = buildTeaseCells(targetPayout, rng);
    for (const c of tease) {
        out.push(c);
    }
    const landIndex = out.length - 1;
    for (let p = 0; p < RIGHT_PAD_AFTER_WIN; p += 1) {
        out.push(pickFillerCell(dry, rng));
    }
    return { cells: out, landIndex };
}
export function stripCellToLabel(cell) {
    return cell.display;
}
