export class Input {
    constructor(canvas, root = document) {
        this.canvas = canvas;
        this.root = root;

        this.mouse = { x: 0, y: 0 };      // backing pixels (canvas space)
        this.mouseCSS = { x: 0, y: 0 };   // CSS/client px (for tooltip/radial)
        this._clicks = [];                // left-click taps
        this._rclicks = [];               // right-click taps (sell)
        this._keys = new Set();
        this._wheelY = 0;

        // Drag state
        this._dragMM = false; // middle
        this._dragRM = false; // right
        this._panDX = 0;      // accum pan in backing px
        this._panDY = 0;

        // Right-click tap detection
        this._rmStartX = 0;
        this._rmStartY = 0;
        this._rmMoveAcc = 0;  // accumulated movement in backing px

        const toBacking = (e) => {
            const r = canvas.getBoundingClientRect();
            const sx = canvas.width / r.width;
            const sy = canvas.height / r.height;
            return {
                x: (e.clientX - r.left) * sx,
                y: (e.clientY - r.top)  * sy,
                clientX: e.clientX,
                clientY: e.clientY
            };
        };

        canvas.addEventListener('mousemove', (e) => {
            const p = toBacking(e);
            this.mouse.x = p.x; this.mouse.y = p.y;
            this.mouseCSS.x = p.clientX; this.mouseCSS.y = p.clientY;

            const r = canvas.getBoundingClientRect();
            const scaleX = canvas.width / r.width;
            const scaleY = canvas.height / r.height;
            const moveX = (e.movementX ?? 0) * scaleX;
            const moveY = (e.movementY ?? 0) * scaleY;

            if (this._dragMM || this._dragRM) {
                this._panDX += moveX;
                this._panDY += moveY;
            }
            if (this._dragRM) {
                this._rmMoveAcc += Math.abs(moveX) + Math.abs(moveY);
            }
        });

        // Keep CSS mouse coords live even when hovering DOM UI (radial, HUD)
        root.addEventListener('mousemove', (e) => {
            this.mouseCSS.x = e.clientX;
            this.mouseCSS.y = e.clientY;
        });

        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 1) { // middle drag
                e.preventDefault();
                this._dragMM = true;
                canvas.style.cursor = 'grabbing';
            } else if (e.button === 2) { // right drag/tap
                e.preventDefault();
                this._dragRM = true;
                this._rmMoveAcc = 0;
                this._rmStartX = this.mouse.x;
                this._rmStartY = this.mouse.y;
                canvas.style.cursor = 'grabbing';
            } else if (e.button === 0) { // left tap
                this._clicks.push({ x: this.mouse.x, y: this.mouse.y });
            }
        });

        canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        canvas.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });

        root.addEventListener('mouseup', (e) => {
            if (e.button === 1 && this._dragMM) {
                this._dragMM = false; canvas.style.cursor = 'default';
            } else if (e.button === 2 && this._dragRM) {
                const TAP_THRESH_BACKING = 12;
                if (this._rmMoveAcc < TAP_THRESH_BACKING) {
                    this._rclicks.push({ x: this._rmStartX, y: this._rmStartY });
                }
                this._dragRM = false; canvas.style.cursor = 'default';
            }
        });

        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this._wheelY += e.deltaY;
        }, { passive: false });

        root.addEventListener('keydown', (e) => this._keys.add(e.key.toLowerCase()));
        root.addEventListener('keyup',   (e) => this._keys.delete(e.key.toLowerCase()));
    }

    consumeClicks()  { const out = this._clicks;  this._clicks  = []; return out; }
    consumeRClicks() { const out = this._rclicks; this._rclicks = []; return out; }
    isDown(k) { return this._keys.has(k.toLowerCase()); }
    consumeWheelY() { const y = this._wheelY; this._wheelY = 0; return y; }
    consumePanDelta() {
        const dx = this._panDX, dy = this._panDY;
        this._panDX = 0; this._panDY = 0;
        return { dx, dy };
    }
    isDragging() { return this._dragMM || this._dragRM; }
}
