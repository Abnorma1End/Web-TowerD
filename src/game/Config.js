export const TILE = 32;

export const COLS = 80;
export const ROWS = 60;

export const COLORS = {
    bg: '#0a0c12',
    grid: '#141826',
    wall: '#1c2336',
    path: '#2e3b5e',
    tower: '#56b6c2',
    towerRange: 'rgba(86,182,194,0.12)',
    creep: '#d19a66',
    hpBack: '#2b2f3a',
    hpFore: '#98c379',
    base: '#be5046',
    spawn: '#c678dd',
    selection: 'rgba(255,255,255,0.25)',
    selectionSell: 'rgba(255,180,80,0.28)',
};

export const ECON = {
    startGold: 100,
    startLives: 20,
    towerCost: 25,
    creepBounty: 5,
    refundRate: 0.75,
};

export const BALANCE = {
    creepHP: 25,
    creepSpeed: 2.2,  // tiles/sec
    towerRange: 3.0,  // tiles
    towerDPS: 7,
    fireCooldown: 0.25
};

/* ---- New tuning knobs ---- */

// Hard cap for initial main-path length (tiles). “~1.5 board-width” feels right.
// Keeps runs brisk and ensures path fits readable pacing.
export const PATH_MAX_TILES = Math.floor(COLS * 1.5);

// Intro camera behavior
export const INTRO = {
    holdFullMap: 0.6,       // seconds to show full map before moving
    travel: 1.1,            // seconds to pan+zoom to spawn
    showTiles: { w: 28, h: 18 }, // target visible tiles around the spawn (roughly)
};
