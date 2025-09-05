// src/game/entities/Tower.js
import { TILE } from '../Config.js';

/**
 * Preset stats for each tower type.
 * Range in tiles, cooldown in seconds, dmg per shot, projectile speed in px/s.
 */
const PRESETS = {
    arrow: {
        rangeTiles: 4.0,
        cooldown: 0.60,
        dmg: 10,
        projSpeed: 520,
    },
    cannon: {
        rangeTiles: 3.4,
        cooldown: 0.95,
        dmg: 20,       // (later: splash damage)
        projSpeed: 420,
    },
    frost: {
        rangeTiles: 3.8,
        cooldown: 0.75,
        dmg: 6,        // (later: applies slow)
        projSpeed: 480,
    },
};

export class Tower {
    constructor(c, r, kind = 'arrow') {
        this.c = c | 0;
        this.r = r | 0;
        this.x = this.c * TILE + TILE / 2;
        this.y = this.r * TILE + TILE / 2;

        // Pick preset by kind, fallback = arrow
        this.kind = PRESETS[kind] ? kind : 'arrow';
        const p = PRESETS[this.kind];

        this.range = p.rangeTiles * TILE;
        this.baseCooldown = p.cooldown;
        this.cooldown = 0;
        this.damagePerShot = p.dmg;
        this.projectileSpeed = p.projSpeed;

        this.level = 1; // starts at 1, max 3
    }

    /** Tick down cooldown each frame. */
    update(dt) {
        this.cooldown = Math.max(0, this.cooldown - dt);
    }

    /** True if tower can fire this frame. */
    canFire() {
        return this.cooldown <= 0;
    }

    /** Reset cooldown after firing. */
    fire() {
        this.cooldown = this.baseCooldown;
    }

    /**
     * Apply upgrade. Types:
     *  - 'dmg': increase damage
     *  - 'aspd': faster attack speed (lower cooldown)
     *  - 'range': increase attack radius
     */
    upgrade(type) {
        // Prevent upgrades beyond level 3
        if (this.level >= 3) return;

        if (type === 'dmg') {
            this.damagePerShot *= 1.25;
        } else if (type === 'aspd') {
            this.baseCooldown = Math.max(0.2, this.baseCooldown * 0.85);
        } else if (type === 'range') {
            this.range *= 1.12;
        }

        this.level++;
    }
}
