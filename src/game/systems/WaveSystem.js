// src/game/systems/WaveSystem.js
import { Creep } from '../entities/Creep.js';
import { RNG } from '../../core/RNG.js';

export class WaveSystem {
    constructor(grid, rng = new RNG('waves')) {
        this.grid = grid;
        this.rng = rng;

        this.waves = [];
        this.waveIndex = -1;
        this.waveNumber = 0;
        this.active = false;

        this._spawnTimer = 0;
        this._queue = [];

        this._spawnPoints = [];
        this._spawnPrefixes = []; // ← NEW: per-spawn feeder paths (array of arrays)
        this.setSpawnsFromGrid(grid);

        this.hpScale = 1.0;
        this.spdScale = 1.0;

        this.multiSpawnActivationWave = 3;
    }

    setSpawnsFromGrid(grid) {
        const out = [];
        if (grid.spawns && Array.isArray(grid.spawns) && grid.spawns.length) {
            for (const s of grid.spawns) out.push({ c: s.c|0, r: s.r|0 });
        } else if (grid.spawn) {
            out.push({ c: grid.spawn.c|0, r: grid.spawn.r|0 });
        }
        if (out.length === 0) out.push({ c: 0, r: 0 });
        this._spawnPoints = out;

        // NEW: capture prefixes aligned to spawns
        this._spawnPrefixes = Array.isArray(grid.spawnPrefixes) ? grid.spawnPrefixes.map(pref => (pref || []).map(p => ({ c: p.c|0, r: p.r|0 }))) : [];
    }

    setMultiSpawnActivationWave(n) {
        this.multiSpawnActivationWave = Math.max(1, Math.floor(n || 1));
    }

    addSpawnPoint(tileC, tileR, prefix = []) {
        this._spawnPoints.push({ c: tileC|0, r: tileR|0 });
        this._spawnPrefixes.push((prefix || []).map(p => ({ c: p.c|0, r: p.r|0 })));
    }

    queueDefaultSet() {
        const defs = [
            { name: 'Scouts',     entries: [{ type: 'basic', count: 10, interval: 0.6 }] },
            { name: 'Drifters',   entries: [{ type: 'fast',  count: 12, interval: 0.5 }] },
            { name: 'Bulks',      entries: [{ type: 'tank',  count: 8,  interval: 0.8 }] },
            { name: 'Mixed Bag',  entries: [{ type: 'basic', count: 8,  interval: 0.55 }, { type: 'fast',  count: 6,  interval: 0.55 }] },
            { name: 'Pressure',   entries: [{ type: 'basic', count: 16, interval: 0.45 }] },
        ];
        this.waves.push(...defs);
    }

    startNextWave() {
        if (this.active) return false;
        if (this.waveIndex + 1 >= this.waves.length) return false;

        this.waveIndex++;
        this.waveNumber = this.waveIndex + 1;
        const def = this.waves[this.waveIndex];

        this._queue = [];
        const activeSpawns = this._getActiveSpawnsCount();
        for (const e of def.entries) {
            let t = 0;
            for (let i = 0; i < e.count; i++) {
                const jitter = (this.rng.range(1) - 0.5) * Math.min(0.2, e.interval * 0.25);
                this._queue.push({
                    at: Math.max(0, t + jitter),
                    type: e.type,
                    spawnIndex: this._pickSpawnIndex(i, activeSpawns),
                });
                t += e.interval;
            }
        }
        this._queue.sort((a, b) => a.at - b.at);

        this._spawnTimer = 0;
        this.active = true;

        this.hpScale *= 1.15;
        this.spdScale *= 1.03;
        return true;
    }

    hasMoreWaves() { return this.waveIndex + 1 < this.waves.length; }

    update(dt, creepsOut) {
        if (!this.active) return;

        this._spawnTimer += dt;

        while (this._queue.length && this._queue[0].at <= this._spawnTimer) {
            const job = this._queue.shift();

            const activeSpawns = this._getActiveSpawnsCount();
            const idx = Math.min(job.spawnIndex, activeSpawns - 1);
            const spawn = this._spawnPoints[idx] || this._spawnPoints[0];

            const path = this._pathAlignedToSpawn(spawn, idx);
            const creep = makeCreep(job.type, path, this.hpScale, this.spdScale);
            creepsOut.push(creep);
        }

        if (this._queue.length === 0) this.active = false;
    }

    hudInfo() {
        const current = this.waves[this.waveIndex] ?? null;
        const next = this.waves[this.waveIndex + 1] ?? null;
        const totalSpawns = this._spawnPoints.length;
        const activeSpawns = this._getActiveSpawnsCount();
        return {
            waveNumber: this.waveNumber,
            currentName: current?.name ?? null,
            nextName: next?.name ?? null,
            remainingSpawns: this._queue.length,
            active: this.active,
            moreWaves: this.hasMoreWaves(),
            spawns: this._spawnPoints.slice(),
            activeSpawns,
            totalSpawns,
            multiSpawnActivationWave: this.multiSpawnActivationWave,
        };
    }

    /* ----------------- helpers ----------------- */

    _getActiveSpawnsCount() {
        if (this.waveNumber < this.multiSpawnActivationWave) return Math.min(1, this._spawnPoints.length);
        return this._spawnPoints.length;
    }

    _pickSpawnIndex(i, activeSpawns) {
        const n = Math.max(1, activeSpawns | 0);
        return n > 1 ? (i % n) : 0;
    }

    /**
     * Build a full path for the given spawn:
     *   optional feeder prefix (if any) + main path slice starting at merge
     */
    _pathAlignedToSpawn(spawn, spawnIdx) {
        const main = this.grid.path || [];
        if (main.length === 0) return main;

        // If this spawn has a feeder prefix, prepend it and join at its last tile.
        const pref = (this._spawnPrefixes[spawnIdx] || []);
        if (pref.length > 0) {
            const merge = pref[pref.length - 1];
            // find merge index in main path
            let mi = 0;
            for (let i = 0; i < main.length; i++) {
                if (main[i].c === merge.c && main[i].r === merge.r) { mi = i; break; }
            }
            // avoid duplicating the merge tile twice
            const tail = main.slice(mi + 1);
            return pref.slice().concat(tail);
        }

        // Otherwise: align to nearest path index (legacy behavior)
        let idx = -1;
        for (let i = 0; i < main.length; i++) {
            if (main[i].c === spawn.c && main[i].r === spawn.r) { idx = i; break; }
        }
        if (idx === -1) {
            let best = Infinity;
            for (let i = 0; i < main.length; i++) {
                const d = Math.abs(main[i].c - spawn.c) + Math.abs(main[i].r - spawn.r);
                if (d < best) { best = d; idx = i; }
            }
        }
        return main.slice(idx);
    }
}

/* =============== Creep factory =============== */

function makeCreep(type, path, hpScale = 1, spdScale = 1) {
    switch (type) {
        case 'fast': {
            const c = new Creep(path, 3.2 * spdScale, 16 * hpScale); c.bounty = 2; return c;
        }
        case 'tank': {
            const c = new Creep(path, 1.6 * spdScale, 60 * hpScale); c.bounty = 4; return c;
        }
        case 'basic':
        default: {
            const c = new Creep(path, 2.2 * spdScale, 28 * hpScale); c.bounty = 3; return c;
        }
    }
}
