/**
 * Call gallery grid (cols × rows + 16:9 tile px). Pure — no Vue / mediasoup.
 * Keep in sync with `.call-page__grid` padding + gap in CallPage.vue.
 */
export const CALL_GRID_MAX_COLS = 4;
function tryColsRows(cols, rows, layoutW, layoutH, gapPx, minTileWidthPx) {
    const totalGapW = gapPx * (cols - 1);
    const totalGapH = gapPx * (rows - 1);
    const innerW = layoutW - totalGapW;
    const innerH = layoutH - totalGapH;
    if (innerW <= 0 || innerH <= 0) {
        return null;
    }
    let tileWidth = innerW / cols;
    let tileHeight = tileWidth * (9 / 16);
    if (tileHeight * rows > innerH) {
        tileHeight = innerH / rows;
        tileWidth = tileHeight * (16 / 9);
    }
    const tilesW = tileWidth * cols;
    const totalWidth = tilesW + totalGapW;
    if (totalWidth > layoutW && tilesW > 0) {
        const scale = (layoutW - totalGapW) / tilesW;
        tileWidth *= scale;
        tileHeight *= scale;
    }
    if (tileWidth < minTileWidthPx) {
        return null;
    }
    const usedHeight = tileHeight * rows + totalGapH;
    const usedWidth = tileWidth * cols + totalGapW;
    const heightDiff = Math.abs(layoutH - usedHeight);
    const widthDiff = Math.abs(layoutW - usedWidth);
    const score = Math.max(heightDiff, widthDiff);
    return { tileWidth, tileHeight, score };
}
export function computeCallVideoGridLayout(participantCount, stageWidth, stageHeight, params) {
    const n = Math.floor(Number(participantCount) || 0);
    if (n <= 0) {
        return { cols: 1, rows: 0, tileWidth: 0, tileHeight: 0 };
    }
    const { gapPx, minTileWidthPx, contentInsetPx } = params;
    const layoutW = Math.max(1, stageWidth - contentInsetPx);
    const layoutH = Math.max(1, stageHeight - contentInsetPx);
    const tryGrid = (cols, rows) => tryColsRows(cols, rows, layoutW, layoutH, gapPx, minTileWidthPx);
    if (n === 4) {
        const t = tryGrid(2, 2);
        if (t) {
            return { cols: 2, rows: 2, tileWidth: t.tileWidth, tileHeight: t.tileHeight };
        }
    }
    if (n === 8 || n === 9) {
        const t = tryGrid(3, 3);
        if (t) {
            return { cols: 3, rows: 3, tileWidth: t.tileWidth, tileHeight: t.tileHeight };
        }
    }
    let best = null;
    let bestScore = Infinity;
    const maxCols = Math.min(CALL_GRID_MAX_COLS, n);
    for (let cols = 1; cols <= maxCols; cols++) {
        const rows = Math.ceil(n / cols);
        const t = tryGrid(cols, rows);
        if (!t) {
            continue;
        }
        if (t.score < bestScore) {
            bestScore = t.score;
            best = { cols, rows, tileWidth: t.tileWidth, tileHeight: t.tileHeight };
        }
    }
    if (!best) {
        const cols = Math.min(n, CALL_GRID_MAX_COLS, 2);
        const rows = Math.ceil(n / cols);
        const tileWidth = layoutW / cols;
        const tileHeight = tileWidth * (9 / 16);
        return { cols, rows, tileWidth, tileHeight };
    }
    return best;
}
