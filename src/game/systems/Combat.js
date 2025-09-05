// src/game/systems/Combat.js
// Handles tower combat: target selection + projectile spawning + projectile updates.
// Target priority order: lowest HP → furthest along path → nearest to tower.

import { Projectile } from '../entities/Projectile.js';
import { HitSpark } from '../effects/Effects.js';

/** Distance squared (cheaper than Math.hypot). */
function dist2(ax, ay, bx, by) {
    const dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
}

export function updateCombat(dt, towers, creeps, projectiles, effects) {
    // Tick cooldowns
    for (const t of towers) t.update(dt);

    // Tower targeting + firing
    for (const t of towers) {
        if (!t.canFire()) continue;

        let best = null;
        let bestD2 = 0;

        for (const c of creeps) {
            if (!c.alive) continue;

            // Creep position
            const { x, y } = c.tilePos;
            const d2 = dist2(t.x, t.y, x, y);
            if (d2 > t.range * t.range) continue; // out of range

            if (!best) {
                best = c; bestD2 = d2;
                continue;
            }

            // 1) Prefer lowest HP
            if (c.hp < best.hp) {
                best = c; bestD2 = d2;
                continue;
            }

            // 2) If HP equal, prefer further along path
            if (c.hp === best.hp) {
                const progC = c.pathIndex ?? 0;
                const progB = best.pathIndex ?? 0;
                if (progC > progB) {
                    best = c; bestD2 = d2;
                    continue;
                }

                // 3) If still equal, prefer nearest to this tower
                if (progC === progB && d2 < bestD2) {
                    best = c; bestD2 = d2;
                }
            }
        }

        // Fire at chosen target
        if (best) {
            const opts = {};

            // Special effects per tower type
            if (t.kind === 'cannon') {
                opts.splashRadius = 48; // px
            } else if (t.kind === 'frost') {
                opts.slowPct = 0.4;       // 40% slow
                opts.slowDuration = 1.25; // seconds
            }

            // Create projectile of correct type
            projectiles.push(
                new Projectile(t.x, t.y, best, t.projectileSpeed, t.damagePerShot, t.kind, opts)
            );

            t.fire();
        }
    }

    // Projectiles update
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.update(dt, creeps, effects);
        if (!p.alive) projectiles.splice(i, 1);
    }
}
