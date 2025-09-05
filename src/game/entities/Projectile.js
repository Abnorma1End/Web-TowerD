// src/game/entities/Projectile.js
import { TILE } from '../Config.js';

/**
 * Projectile fired by towers.
 * - Arrow → single target hit
 * - Cannon → splash damage around impact point
 * - Frost → deals damage + applies slow
 */
export class Projectile {
    /**
     * @param {number} x  Starting X
     * @param {number} y  Starting Y
     * @param {object} target  Expected { tilePos:{x,y}, takeDamage(d) }
     * @param {number} speedPx Speed in px/s
     * @param {number} damage  Damage dealt
     * @param {'arrow'|'cannon'|'frost'} kind  Projectile type
     * @param {object} [opts]
     *   - splashRadius: number (px)     // cannon
     *   - slowPct: number in [0..1]     // frost
     *   - slowDuration: number (sec)    // frost
     */
    constructor(x, y, target, speedPx, damage, kind = 'arrow', opts = {}) {
        this.x = x;
        this.y = y;
        this.target = target;
        this.speed = Math.max(10, speedPx || 400);
        this.damage = Math.max(0, damage || 0);
        this.kind = kind;

        // Visuals (renderer uses radius)
        this.radius = 3;

        // Special options (default values if not provided)
        this.splashRadius = opts.splashRadius ?? Math.max(0, TILE * 0.9);
        this.slowPct = Math.max(0, Math.min(0.95, opts.slowPct ?? 0.4));
        this.slowDuration = Math.max(0, opts.slowDuration ?? 1.25);

        this.alive = true;
    }

    /**
     * Move projectile toward target.
     * Returns true if still flying, false when finished.
     */
    update(dt, creepsAll = null, effectsOut = null) {
        if (!this.alive) return false;
        if (!this.target || !this.target.alive) {
            this.alive = false;
            return false;
        }

        // Current target position (creep may have moved)
        const tx = this.target.tilePos?.x ?? this.target.x ?? 0;
        const ty = this.target.tilePos?.y ?? this.target.y ?? 0;

        let dx = tx - this.x;
        let dy = ty - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist <= 1e-6) {
            // Already colliding → trigger hit
            this._onHit(tx, ty, creepsAll, effectsOut);
            this.alive = false;
            return false;
        }

        const step = this.speed * dt;
        if (step >= dist) {
            // Will reach (or overshoot) target this frame
            this.x = tx; this.y = ty;
            this._onHit(tx, ty, creepsAll, effectsOut);
            this.alive = false;
            return false;
        } else {
            // Advance toward target
            const inv = 1 / dist;
            this.x += dx * inv * step;
            this.y += dy * inv * step;
            return true;
        }
    }

    /**
     * Handle collision effects depending on projectile kind.
     */
    _onHit(hitX, hitY, creepsAll, effectsOut) {
        // Simple visual effect
        const addSpark = () => {
            if (effectsOut) {
                effectsOut.push({
                    type: 'hitspark',
                    x: hitX,
                    y: hitY,
                    alpha: 1,
                    update: fadeOutSquare(0.25)
                });
            }
        };

        if (this.kind === 'cannon') {
            // Splash → damage all creeps within splashRadius
            if (Array.isArray(creepsAll) && creepsAll.length) {
                const r2 = this.splashRadius * this.splashRadius;
                for (const c of creepsAll) {
                    if (!c.alive) continue;
                    const dx = (c.tilePos?.x ?? c.x ?? 0) - hitX;
                    const dy = (c.tilePos?.y ?? c.y ?? 0) - hitY;
                    if (dx * dx + dy * dy <= r2) {
                        c.takeDamage(this.damage);
                    }
                }
            } else if (this.target?.alive) {
                // Fallback: at least damage main target
                this.target.takeDamage(this.damage);
            }
            addSpark();
            return;
        }

        if (this.kind === 'frost') {
            // Frost → damage + apply slow debuff
            if (this.target?.alive) {
                this.target.takeDamage(this.damage);
                if (typeof this.target.applySlow === 'function') {
                    this.target.applySlow(this.slowPct, this.slowDuration);
                }
            }
            addSpark();
            return;
        }

        // Default: Arrow → single target
        if (this.target?.alive) {
            this.target.takeDamage(this.damage);
        }
        addSpark();
    }
}

/* ---------- tiny effect helper ---------- */
/**
 * Creates a fade-out function for simple square hit sparks.
 * Reduces alpha over time and signals when finished.
 */
function fadeOutSquare(duration = 0.25) {
    let t = duration;
    return function update(dt) {
        t -= dt;
        this.alpha = Math.max(0, t / duration);
        return t > 0; // false when finished → renderer removes it
    };
}
