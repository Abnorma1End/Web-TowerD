// Simple, lightweight visual effects

export class HitSpark {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.t = 0;            // lifetime
        this.life = 0.18;      // seconds
    }
    update(dt) { this.t += dt; return this.t < this.life; }
}

export class DeathPuff {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.t = 0;
        this.life = 0.35;
        this.r0 = 6;    // start radius
        this.r1 = 22;   // end radius
    }
    update(dt) { this.t += dt; return this.t < this.life; }
    get radius() {
        const k = Math.min(1, this.t / this.life);
        return this.r0 + (this.r1 - this.r0) * k;
    }
    get alpha() {
        const k = Math.min(1, this.t / this.life);
        return 1 - k; // fade out
    }
}
