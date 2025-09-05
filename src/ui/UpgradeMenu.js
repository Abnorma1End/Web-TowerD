// src/ui/UpgradeMenu.js
// DOM-based radial menu that pops at a world anchor (converted to CSS coords).
// - Buttons slide out clockwise from 12 o’clock.
// - Tracks anchor via .reposition(x,y) called by Game each frame when open.
// - Closes on outside click or resize. No CSS trigonometry (perf-safe).

export class UpgradeMenu {
    constructor(canvas, onSelect) {
        this.canvas = canvas;
        this.onSelect = onSelect;

        this.wrap = document.createElement('div');
        this.wrap.className = 'radial-wrap';

        this.menu = document.createElement('div');
        this.menu.className = 'radial';
        this.wrap.appendChild(this.menu);

        document.body.appendChild(this.wrap);

        this.items = [];            // [{ el, closedX, closedY }]
        this.opened = false;
        this.anchor = { x: 0, y: 0 };

        // Close when clicking anywhere that isn't a menu button
        window.addEventListener('mousedown', (e) => {
            if (!this.opened) return;
            if (!this.menu.contains(e.target)) this.hide();
        });

        // Close on layout changes
        window.addEventListener('resize', () => this.hide());
    }

    /**
     * Show the radial at a given CSS position with a list of options.
     * options: [{ type, label, cost?, icon? }]
     */
    show(cssX, cssY, options, clockwise = true) {
        this.clear();
        this.reposition(cssX, cssY);

        const radius = 92;                               // px from center
        const step = options.length > 0 ? (2 * Math.PI / options.length) : 0;

        options.forEach((opt, i) => {
            const btn = document.createElement('button');
            btn.className = 'radial-btn';
            btn.dataset.type = opt.type;

            // Content (swap for SVGs any time)
            btn.innerHTML = `<div>${opt.icon ?? opt.label}</div>${opt.cost ? `<div class="sub">${opt.cost}</div>` : ''}`;

            // Start "stacked" at 12 o'clock (closed)
            const closedX = -24;
            const closedY = -24 - radius;
            btn.style.transform = `translate(${closedX}px, ${closedY}px)`;

            // Compute open target pos: 12 o'clock + clockwise spread
            const angle = -Math.PI / 2 + (clockwise ? i : -i) * step; // -90deg is 12 o'clock
            const tx = -24 + Math.cos(angle) * radius;
            const ty = -24 + Math.sin(angle) * radius;

            // Staggered open
            setTimeout(() => { btn.style.transform = `translate(${tx}px, ${ty}px)`; }, 40 + i * 40);

            // Selection
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.onSelect?.(opt.type);
                this.hide();
            });

            this.menu.appendChild(btn);
            this.items.push({ el: btn, closedX, closedY });
        });

        this.opened = true;
    }

    /**
     * Move the radial anchor to new CSS coords (Game calls while open to follow tower).
     */
    reposition(cssX, cssY) {
        this.anchor.x = cssX;
        this.anchor.y = cssY;
        this.menu.style.left = `${cssX}px`;
        this.menu.style.top  = `${cssY}px`;
    }

    /**
     * Animate buttons back to 12 o'clock, then clear.
     */
    hide() {
        if (!this.opened) return;
        this.items.forEach((it, i) => {
            setTimeout(() => {
                it.el.style.transform = `translate(${it.closedX}px, ${it.closedY}px)`;
            }, i * 20);
        });
        setTimeout(() => this.clear(), 220);
        this.opened = false;
    }

    clear() {
        while (this.menu.firstChild) this.menu.removeChild(this.menu.firstChild);
        this.items = [];
    }
}
