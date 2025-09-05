// src/game/State.js
import { WaveSystem } from './systems/WaveSystem.js';
import { ECON } from './Config.js';

export class State {
    constructor(grid) {
        this.grid = grid;

        // Entities
        this.towers = [];
        this.creeps = [];
        this.projectiles = [];
        this.effects = [];

        // Economy / base
        this.gold = ECON.startGold;   // pulled from Config
        this.lives = ECON.startLives; // pulled from Config

        // Waves
        this.waves = new WaveSystem(grid);
        this.waves.queueDefaultSet();
    }
}
