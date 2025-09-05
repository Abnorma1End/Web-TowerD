import { Creep } from '../entities/Creep.js';

export class Spawning {
    constructor(grid) {
        this.grid = grid;
        this.wave = 0;
        this.active = false;
        this.toSpawn = 0;
        this.timer = 0;
        this.interval = 0.6; // seconds between spawns
    }
    startWave() {
        if (this.active) return;
        this.wave++;
        this.active = true;
        this.toSpawn = 6 + Math.floor(this.wave * 1.5);
        this.timer = 0;
    }
    update(dt, creeps) {
        if (!this.active) return;
        this.timer += dt;
        if (this.toSpawn > 0 && this.timer >= this.interval) {
            this.timer -= this.interval;
            this.toSpawn--;
            creeps.push(new Creep(this.grid.path));
        }
        if (this.toSpawn === 0 && creeps.length === 0) {
            this.active = false; // wave complete
        }
    }
}
