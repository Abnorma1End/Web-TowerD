// src/core/Engine.js
export class Engine {
    constructor(game) {
        this.game = game;
        this._raf = null;
        this._last = 0;
        this.paused = false;
        this.timeScale = 1.0;
        this._bound = (t) => this._loop(t);
    }

    start(ctx) {
        this.ctx = ctx;
        this._last = performance.now();
        this._raf = requestAnimationFrame(this._bound);
    }

    togglePause() { this.paused = !this.paused; }
    setTimeScale(s) { this.timeScale = Math.max(0.1, Math.min(4.0, s)); }

    _loop(now) {
        const rawDt = Math.min(0.1, (now - this._last) / 1000); // clamp 100ms
        this._last = now;

        const dt = this.paused ? 0 : rawDt * this.timeScale;

        // Guarded calls so missing methods don't crash the loop
        if (this.game && typeof this.game.update === 'function') {
            this.game.update(dt);
        } else {
            console.error('[Engine] game.update is not a function.');
        }

        if (this.game && typeof this.game.render === 'function') {
            this.game.render(this.ctx);
        } else {
            // Only warn once per session
            if (!this._warnedRender) {
                console.error('[Engine] game.render is not a function.');
                this._warnedRender = true;
            }
        }

        this._raf = requestAnimationFrame(this._bound);
    }
}
