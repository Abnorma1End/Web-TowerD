// src/game/entities/Creep.js
import { TILE } from '../Config.js';

/**
 * Creep that walks along a Manhattan (4-neighbor) path of tile centers.
 *
 * Key implementation notes:
 * - Converts tile cells {c,r} into world-space points at tile centers.
 * - Compresses collinear points so movement segments are strictly axis-aligned.
 * - When arriving exactly at a CORNER, the creep pauses further movement
 *   for the remainder of this frame to prevent "cross-corner sliding."
 * - Includes a simple "slow" debuff system. Only the strongest slow is kept;
 *   if a new slow has the same strength but longer duration, the duration refreshes.
 */
export class Creep {
    /**
     * @param {Array<{c:number,r:number}>} path  Strict 4-neighbor tile path.
     * @param {number} speedTilesPerSec          Base speed in tiles/s.
     * @param {number} maxHP                     Maximum hit points.
     */
    constructor(path, speedTilesPerSec = 2.2, maxHP = 25) {
        // --- Core state ---
        this.maxHP = maxHP;
        this.hp = maxHP;
        this.alive = true;

        // Build world-space (pixel) waypoints at tile centers and de-dupe identical points.
        const pts = [];
        let lastX = NaN, lastY = NaN;
        for (const n of path || []) {
            const x = n.c * TILE + TILE / 2;
            const y = n.r * TILE + TILE / 2;
            if (x !== lastX || y !== lastY) { pts.push({ x, y }); lastX = x; lastY = y; }
        }

        // Keep only endpoints + corners (removes straight-line middle points).
        this.points = compressCollinear(pts);
        if (this.points.length === 0) this.points.push({ x: 0, y: 0 });

        // Position at first point
        this.x = this.points[0].x;
        this.y = this.points[0].y;

        // Renderer looks at tilePos for drawing/hitbars, so keep in sync.
        this.tilePos = { x: this.x, y: this.y };

        // Index of the NEXT waypoint to move toward.
        this.idx = Math.min(1, this.points.length - 1);

        // Convert tile speed → pixels/sec. Clamp to non-negative.
        this.baseSpeed = Math.max(0, speedTilesPerSec) * TILE;

        // Exposed progress number for target tiebreakers (used by Combat.js).
        // We bump this when we "arrive" at a waypoint.
        this.pathIndex = 0;

        // --- Status effects: single-slot slow debuff ---
        // pct ∈ [0..0.95], time in seconds. Only the highest pct wins.
        // If pct ties, the longer duration wins (refresh).
        this.slow = { pct: 0, time: 0 };
    }

    /**
     * Apply or refresh a slow debuff.
     * @param {number} pct      Slow percentage [0..1] (e.g., 0.4 = -40% speed).
     * @param {number} duration Slow duration in seconds.
     */
    applySlow(pct, duration) {
        const clampedPct = Math.max(0, Math.min(0.95, pct || 0));
        const dur = Math.max(0, duration || 0);
        const s = this.slow;

        // Keep the strongest slow. If equal strength, keep the longer remaining duration.
        if (clampedPct > s.pct || (clampedPct === s.pct && dur > s.time)) {
            s.pct = clampedPct;
            s.time = dur;
        }
    }

    /** @returns {number} Current movement speed in px/s after slow effects. */
    currentSpeed() {
        const mult = 1 - (this.slow?.pct || 0);
        // Never drop below 5% of base speed so creeps still advance.
        return this.baseSpeed * Math.max(0.05, mult);
    }

    /** Apply damage and set alive=false if HP falls to 0 or less. */
    takeDamage(dmg) {
        if (!this.alive) return;
        this.hp -= (dmg || 0);
        if (this.hp <= 0) this.alive = false;
    }

    /**
     * Move along the path for this frame.
     * IMPORTANT: If we arrive exactly at a CORNER waypoint, we stop moving
     * for the rest of this frame to avoid “cross-corner slide.”
     *
     * @param {number} dt Seconds elapsed this frame.
     * @returns {'reached'|undefined} 'reached' when the final point is reached.
     */
    update(dt) {
        if (!this.alive) return;

        // Tick slow debuff timer and clear it when done.
        if (this.slow.time > 0) {
            this.slow.time -= dt;
            if (this.slow.time <= 0) { this.slow.time = 0; this.slow.pct = 0; }
        }

        // Remaining distance (in px) we can travel this frame.
        let remaining = this.currentSpeed() * dt;
        if (this.idx >= this.points.length) return 'reached';

        const EPS = 1e-6;

        while (remaining > 0 && this.idx < this.points.length) {
            const tgt = this.points[this.idx];
            const dx = tgt.x - this.x;
            const dy = tgt.y - this.y;
            const dist = Math.hypot(dx, dy);

            if (dist <= EPS) {
                // Already "at" this waypoint → advance to next.
                this.idx++;
                this.pathIndex = this.idx;
                continue;
            }

            // Step toward target this frame.
            const step = Math.min(remaining, dist);
            const inv = 1 / Math.max(dist, EPS);
            this.x += dx * inv * step;
            this.y += dy * inv * step;
            this.tilePos.x = this.x;
            this.tilePos.y = this.y;

            remaining -= step;

            // If we landed exactly on the waypoint, decide whether to continue.
            if (Math.abs(this.x - tgt.x) <= 0.001 && Math.abs(this.y - tgt.y) <= 0.001) {
                const prev = this.points[this.idx - 1] ?? this.points[this.idx];
                const next = this.points[this.idx + 1];

                // Advance to "being at" this waypoint.
                this.idx++;
                this.pathIndex = this.idx;

                if (next) {
                    // If direction changes at this waypoint, pause movement for the rest of this frame.
                    const dirA = unitAxis(prev, tgt); // into this waypoint
                    const dirB = unitAxis(tgt, next); // out of this waypoint
                    const isCorner = (dirA.x !== dirB.x) || (dirA.y !== dirB.y);
                    if (isCorner) break; // stop here; remaining movement discarded this frame
                    // If straight line, loop continues and we may consume more remaining distance.
                } else {
                    // No next point → path complete.
                    return 'reached';
                }
            } else {
                // Didn't reach waypoint yet; done for this frame.
                break;
            }
        }

        // Safety: if we consumed to/past the final waypoint.
        if (this.idx >= this.points.length) {
            const last = this.points[this.points.length - 1];
            this.x = last.x; this.y = last.y;
            this.tilePos.x = this.x; this.tilePos.y = this.y;
            return 'reached';
        }
    }
}

/* ----------------------- helpers ----------------------- */

/**
 * Remove intermediate points that are collinear (axis-aligned).
 * Keeps only endpoints + corners. This ensures motion segments
 * are clean and the corner pause logic works predictably.
 */
function compressCollinear(points) {
    if (points.length <= 2) return points.slice();
    const out = [points[0]];
    for (let i = 1; i < points.length - 1; i++) {
        const a = out[out.length - 1], b = points[i], c = points[i + 1];
        const abx = Math.sign(b.x - a.x), aby = Math.sign(b.y - a.y);
        const bcx = Math.sign(c.x - b.x), bcy = Math.sign(c.y - b.y);
        if (abx !== bcx || aby !== bcy) out.push(b); // keep corners only
    }
    out.push(points[points.length - 1]);
    return out;
}

/**
 * Return the axis-aligned unit step between two points (assumes Manhattan path).
 * Example: from (10,10) to (10,42) → {x:0, y:1}; from (20,9) to (4,9) → {x:-1, y:0}.
 */
function unitAxis(a, b) {
    const dx = Math.sign(b.x - a.x);
    const dy = Math.sign(b.y - a.y);
    return { x: dx, y: dy };
}
