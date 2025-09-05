// src/game/map/Generator.js
import { COLS, ROWS, PATH_MAX_TILES } from '../Config.js';
import { Grid, CELL } from './Grid.js';
import { RNG } from '../../core/RNG.js';

export function generateGrid(seed = `gen-${Date.now()}`) {
    const rng = new RNG(seed);
    const canon = generateCanonicalLR(rng);

    // NEW: If path is too long, trim it to a sane size, then sanitize again.
    if (Array.isArray(canon.path) && canon.path.length > PATH_MAX_TILES) {
        canon.path = limitPathLength(canon.path, PATH_MAX_TILES);
        // Restamp after trimming
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
            if (canon.get(c, r) === CELL.PATH) canon.set(c, r, CELL.EMPTY);
        }
        for (const p of canon.path) canon.set(p.c, p.r, CELL.PATH);
        canon.set(canon.spawn.c, canon.spawn.r, CELL.SPAWN);
        canon.set(canon.base.c,  canon.base.r,  CELL.BASE);
    }

    const orient = rng.int(4);
    return orientGrid(canon, orient);
}

/* ===================================================================================== */

function generateCanonicalLR(rng) {
    const g = new Grid(COLS, ROWS);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) g.set(c, r, CELL.EMPTY);

    const spawnR = clampi(Math.floor(rng.range(ROWS)), 1, ROWS - 2);
    const baseR  = clampi(Math.floor(rng.range(ROWS)), 1, ROWS - 2);
    const spawn = { c: 0,        r: spawnR };
    const base  = { c: COLS - 1, r: baseR  };

    const columns = [];
    let c = 3 + rng.int(3);
    while (c < COLS - 4) { columns.push(c); c += 8 + rng.int(7); }

    const waypoints = [];
    let lastRow = spawn.r;
    for (const wc of columns) {
        const maxStep = Math.max(2, Math.floor(ROWS * 0.25));
        const dir  = rng.chance(0.5) ? 1 : -1;
        const step = 3 + rng.int(maxStep);
        const nextRow = clampi(lastRow + dir * step, 1, ROWS - 2);
        waypoints.push({ c: wc, r: nextRow });
        lastRow = nextRow;
    }

    let path = [];
    const nodes = [spawn, ...waypoints, base];
    for (let i = 0; i < nodes.length - 1; i++) {
        carveSegmentWithOptionalArena(path, nodes[i], nodes[i + 1], rng);
    }

    path = sanitizePath(path);

    for (const p of path) g.set(p.c, p.r, CELL.PATH);
    g.set(spawn.c, spawn.r, CELL.SPAWN);
    g.set(base.c,  base.r,  CELL.BASE);

    const { spawns, prefixes } = buildSplitEntrancesBuffered(g, path, rng);
    g.spawns = spawns;
    g.spawnPrefixes = prefixes;
    g.spawn = { ...spawns[0] };
    g.base  = { ...base };
    g.path  = path.slice();

    return g;
}

function clampi(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function carveSegment(out, a, b, rng) {
    const last = out[out.length - 1];
    if (!last || last.c !== a.c || last.r !== a.r) out.push({ c: a.c, r: a.r });
    const horizFirst = rng.chance(0.5);
    let c = a.c, r = a.r;
    const stepH = () => { c += Math.sign(b.c - c); out.push({ c, r }); };
    const stepV = () => { r += Math.sign(b.r - r); out.push({ c, r }); };
    while (c !== b.c || r !== b.r) {
        if (horizFirst) { if (c !== b.c) stepH(); else if (r !== b.r) stepV(); }
        else { if (r !== b.r) stepV(); else if (c !== b.c) stepH(); }
    }
}

function carveSegmentWithOptionalArena(out, a, b, rng) {
    const len = Math.abs(b.c - a.c) + Math.abs(b.r - a.r);
    const wantArena = len >= 8 && rng.chance(0.35);
    if (!wantArena) { carveSegment(out, a, b, rng); return; }

    const dc = b.c - a.c, dr = b.r - a.r;
    const horizFavored = Math.abs(dc) >= Math.abs(dr);
    const j = { c: a.c + (horizFavored ? Math.sign(dc) : 0), r: a.r + (horizFavored ? 0 : Math.sign(dr)) };
    carveSegment(out, a, j, rng);

    const dirX = Math.sign(dc) || 1;
    const upSpace   = j.r - 1;
    const downSpace = ROWS - 2 - j.r;
    const dirY = (downSpace >= upSpace) ? 1 : -1;

    if (horizFavored) {
        const maxForward = dirX > 0 ? (COLS - 2 - j.c) : (j.c - 1);
        const maxVert    = dirY > 0 ? (ROWS - 2 - j.r) : (j.r - 1);
        let w = clampi(5 + rng.int(6), 3, maxForward);
        let h = clampi(3 + rng.int(4), 2, maxVert);
        if (w < 2 || h < 2) { carveSegment(out, j, b, rng); return; }
        const A = { c: j.c,            r: j.r + dirY * h };
        const B = { c: j.c + dirX * w, r: j.r + dirY * h };
        const C = { c: j.c + dirX * w, r: j.r };
        carveSegment(out, j, A, rng);
        carveSegment(out, A, B, rng);
        carveSegment(out, B, C, rng);
        carveSegment(out, C, b, rng);
    } else {
        const maxForward = dirY > 0 ? (ROWS - 2 - j.r) : (j.r - 1);
        const maxHoriz   = dirX > 0 ? (COLS - 2 - j.c) : (j.c - 1);
        let w = clampi(3 + rng.int(4), 2, maxHoriz);
        let h = clampi(5 + rng.int(6), 3, maxForward);
        if (w < 2 || h < 2) { carveSegment(out, j, b, rng); return; }
        const A = { c: j.c + dirX * w, r: j.r };
        const B = { c: j.c + dirX * w, r: j.r + dirY * h };
        const C = { c: j.c,            r: j.r + dirY * h };
        carveSegment(out, j, A, rng);
        carveSegment(out, A, B, rng);
        carveSegment(out, B, C, rng);
        carveSegment(out, C, b, rng);
    }
}


/* ---------------- multi-spawn with buffered feeders ---------------- */


/**
 * Build 1–2 extra spawns with FEEDER corridors that keep a 1-tile buffer
 * from the main path, except at the merge tile.
 *
 * Returns:
 *   spawns    : Array<{c,r}>   (first = primary left-edge spawn)
 *   prefixes  : Array<Array<{c,r}>>  Feeder path per spawn (same index alignment)
 */
function buildSplitEntrancesBuffered(grid, path, rng) {
    const spawns = [];
    const prefixes = [];

    // Primary spawn = left edge aligned to first path row
    const primary = { c: 0, r: path[0]?.r ?? 1 };
    spawns.push(primary);
    prefixes.push([]); // primary has no feeder

    if (!path || path.length < 8) return { spawns, prefixes };

    // Decide number of extra spawns (0, 1, or 2)
    let extra = rng.chance(0.25) ? 2 : (rng.chance(0.5) ? 1 : 0);
    if (extra === 0) return { spawns, prefixes };

    // Merge early along primary path (not too close to endpoints)
    const iLo = 3, iHi = Math.min(14, path.length - 4);
    const mergeIdx = clampi(iLo + rng.int(Math.max(1, iHi - iLo)), 2, path.length - 3);
    const merge = path[mergeIdx];

    // Build a mask that blocks main path cells and their 4-neighbors (1-tile buffer),
    // but allows entering the merge cell.
    const blocked = buildBufferMaskFromPath(path, merge);

    // Place extra spawns on the left edge near merge.r (with jitter), avoiding row reuse.
    const usedRows = new Set([primary.r]);
    for (let k = 0; k < extra; k++) {
        let jr = merge.r + (rng.chance(0.5) ? 1 : -1) * (2 + rng.int(3));
        jr = clampi(jr, 1, ROWS - 2);

        // Avoid duplicates
        let tries = 8;
        while (tries-- && usedRows.has(jr)) {
            jr = clampi(jr + (rng.chance(0.5) ? 1 : -1) * (1 + rng.int(2)), 1, ROWS - 2);
        }
        usedRows.add(jr);

        const s = { c: 0, r: jr };
        spawns.push(s);

        // BFS feeder from s→merge that respects the buffer (except at merge).
        const feeder = bfsManhattanAvoiding(s, merge, blocked);

        // Fallback: if BFS fails (rare), carve a simple manhattan segment (may violate buffer).
        const feederPath = feeder && feeder.length ? feeder : simpleSegment(s, merge);

        // Stamp feeder to grid and record prefix.
        for (const p of feederPath) grid.set(p.c, p.r, CELL.PATH);
        grid.set(s.c, s.r, CELL.SPAWN);

        prefixes.push(feederPath.slice());
    }

    return { spawns, prefixes };
}

/** Build a [ROWS][COLS] boolean mask of "blocked" cells for buffer enforcement. */
function buildBufferMaskFromPath(path, merge) {
    const blocked = Array.from({ length: ROWS }, () => new Array(COLS).fill(false));
    const allowAt = (p) => (p.c === merge.c && p.r === merge.r);

    for (const p of path) {
        if (!allowAt(p)) blocked[p.r][p.c] = true; // block main path tile
        // block 4-neighbors (buffer ring)
        const nb = [
            { c: p.c + 1, r: p.r }, { c: p.c - 1, r: p.r },
            { c: p.c, r: p.r + 1 }, { c: p.c, r: p.r - 1 },
        ];
        for (const n of nb) {
            if (n.c < 0 || n.r < 0 || n.c >= COLS || n.r >= ROWS) continue;
            if (!allowAt(n)) blocked[n.r][n.c] = true;
        }
    }
    return blocked;
}

/**
 * Manhattan BFS from start→goal avoiding blocked[r][c] == true,
 * but ALWAYS allowing entry into the goal cell.
 * Returns a path including both endpoints, or null if unreachable.
 */
function bfsManhattanAvoiding(start, goal, blocked) {
    const inb = (c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS;
    const allow = (c, r) => inb(c, r) && (!blocked[r][c] || (c === goal.c && r === goal.r));

    const q = [];
    const seen = Array.from({ length: ROWS }, () => new Array(COLS).fill(false));
    const prev = Array.from({ length: ROWS }, () => new Array(COLS).fill(null));

    if (!allow(start.c, start.r)) return null;

    q.push(start);
    seen[start.r][start.c] = true;

    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];

    while (q.length) {
        const cur = q.shift();
        if (cur.c === goal.c && cur.r === goal.r) {
            // Reconstruct
            const out = [];
            let node = cur;
            while (node) { out.push({ c: node.c, r: node.r }); node = prev[node.r][node.c]; }
            out.reverse();
            return out;
        }
        for (const [dx, dy] of dirs) {
            const nc = cur.c + dx, nr = cur.r + dy;
            if (!allow(nc, nr) || seen[nr][nc]) continue;
            seen[nr][nc] = true;
            prev[nr][nc] = cur;
            q.push({ c: nc, r: nr });
        }
    }
    return null;
}

/** Simple fallback: straight manhattan segment A→B. */
function simpleSegment(a, b) {
    const out = [];
    let c = a.c, r = a.r;
    out.push({ c, r });
    while (c !== b.c || r !== b.r) {
        if (c !== b.c) c += Math.sign(b.c - c);
        else if (r !== b.r) r += Math.sign(b.r - r);
        out.push({ c, r });
    }
    return out;
}

/**
 * Enforce 4-neighbor continuity and remove backtracks/duplicates.
 * This also prevents diagonal skips if the input had gaps.
 */
function sanitizePath(path) {
    if (!path || path.length === 0) return [];
    const out = [];

    const pushUnique = (c, r) => {
        const last = out[out.length - 1];
        if (!last || last.c !== c || last.r !== r) out.push({ c, r });
    };

    pushUnique(path[0].c, path[0].r);
    for (let i = 1; i < path.length; i++) {
        const a = out[out.length - 1];
        const b = path[i];
        let c = a.c, r = a.r;
        while (c !== b.c || r !== b.r) {
            if (c !== b.c) c += Math.sign(b.c - c);
            else if (r !== b.r) r += Math.sign(b.r - r);
            pushUnique(c, r);
        }
    }

    // Remove immediate backtracks introduced by stitching
    const out2 = [];
    for (let i = 0; i < out.length; i++) {
        const cur = out[i];
        const prev = out2[out2.length - 1];
        const prev2 = out2[out2.length - 2];
        if (prev2 && prev2.c === cur.c && prev2.r === cur.r) out2.pop();
        out2.push(cur);
    }
    return out2;
}

/* ===================================================================================== */
/* Orientation utilities                                                                  */
/* ===================================================================================== */

/**
 * Rotate a canonical grid into the final orientation (0, 90, 180, 270 CW).
 * Copies cell stamps and transforms metadata (spawn/base/path/spawns/prefixes).
 */
function orientGrid(canon, orient) {
    const g = new Grid(COLS, ROWS);

    // Copy cells with rotation
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const cell = canon.get(c, r);
            if (cell === CELL.EMPTY) continue;
            const { c: nc, r: nr } = rotateCR(c, r, orient);
            g.set(nc, nr, cell);
        }
    }

    // Transform metadata
    const rot = (p) => rotateCR(p.c, p.r, orient);
    g.spawn = rot(canon.spawn);
    g.base  = rot(canon.base);
    g.path  = (canon.path || []).map(rot);

    g.spawns = (canon.spawns || [canon.spawn]).map(rot);
    g.spawnPrefixes = (canon.spawnPrefixes || []).map(arr => (arr || []).map(rot));

    // Sanity: ensure stamps exist in rotated grid
    for (const p of g.path) g.set(p.c, p.r, CELL.PATH);
    for (const s of g.spawns) g.set(s.c, s.r, CELL.SPAWN);
    g.set(g.base.c, g.base.r, CELL.BASE);

    // Defensive alignment of arrays
    if (!Array.isArray(g.spawns) || g.spawns.length === 0) g.spawns = [g.spawn];
    if (!Array.isArray(g.spawnPrefixes)) g.spawnPrefixes = [];
    while (g.spawnPrefixes.length < g.spawns.length) g.spawnPrefixes.push([]);

    return g;
}

/** Rotate (c,r) by 0/90/180/270 CW within COLS×ROWS bounds. */
function rotateCR(c, r, orient) {
    switch (orient & 3) {
        case 0: return { c, r };                                  // 0°
        case 1: return { c: COLS - 1 - r, r: c };                 // 90° CW
        case 2: return { c: COLS - 1 - c, r: ROWS - 1 - r };      // 180°
        case 3: return { c: r, r: ROWS - 1 - c };                 // 270° CW
        default: return { c, r };
    }
}

function limitPathLength(path, maxLen) {
    if (!path || path.length <= maxLen) return path.slice();

    const keep = new Array(maxLen);
    keep[0] = path[0];
    keep[maxLen - 1] = path[path.length - 1];

    const step = (path.length - 1) / (maxLen - 1);
    for (let i = 1; i < maxLen - 1; i++) {
        const idx = Math.round(i * step);
        keep[i] = path[idx];
    }
    return sanitizePath(keep);
}