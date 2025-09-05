// src/ui/BuildMenu.js
// DOM-based radial "build" menu, similar to UpgradeMenu but for placing new towers.
// Usage:
//   const buildMenu = new BuildMenu(canvas, (choice) => onPick(choice));
//   buildMenu.show(cssX, cssY, optionsArray);
//   buildMenu.hide();
// Each option: { type:'arrow'|'cannon'|'frost'|..., label, icon, cost }

export class BuildMenu {
    constructor(canvas, onSelect) {
        this.canvas = canvas;
        this.onSelect = onSelect;

        this.wrap = document.createElement('div');
        this.wrap.className = 'radial-wrap';

        this.menu = document.createElement('div');
        this.menu.className = 'radial';
        this.wrap.appendChild(this.menu);

        document.body.appendChild(this.wrap);

        this.items = [];
        this.opened = false;
        this.anchor = { x: 0, y: 0 };

        // Close when clicking anywhere outside the menu
        window.addEventListener('mousedown', (e) => {
            if (!this.opened) return;
            if (!this.menu.contains(e.target)) this.hide();
        });

        // Close on resize
        window.addEventListener('resize', () => this.hide());
    }

    show(cssX, cssY, options, clockwise = true) {
        this.clear();
        this.reposition(cssX, cssY);

        const radius = 108; // slightly larger than upgrade menu
        const step = options.length > 0 ? (2 * Math.PI / options.length) : 0;

        options.forEach((opt, i) => {
            const btn = document.createElement('button');
            btn.className = 'radial-btn';
            btn.dataset.type = opt.type;
            btn.title = `${opt.label} — ${opt.cost}g`; // quick tooltip

            // Bigger icons for build menu
            btn.innerHTML = `
        <div style="font-size:18px;line-height:20px">${opt.icon ?? opt.label}</div>
        <div class="sub" style="font-size:11px;margin-top:2px">${opt.cost}</div>
      `;

            // Closed (stacked at 12 o'clock)
            const closedX = -28;
            const closedY = -28 - radius;
            btn.style.transform = `translate(${closedX}px, ${closedY}px)`;

            // Open target
            const angle = -Math.PI / 2 + (clockwise ? i : -i) * step;
            const tx = -28 + Math.cos(angle) * radius;
            const ty = -28 + Math.sin(angle) * radius;

            setTimeout(() => { btn.style.transform = `translate(${tx}px, ${ty}px)`; }, 40 + i * 50);

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

    reposition(cssX, cssY) {
        this.anchor.x = cssX;
        this.anchor.y = cssY;
        this.menu.style.left = `${cssX}px`;
        this.menu.style.top  = `${cssY}px`;
    }

    hide() {
        if (!this.opened) return;
        this.items.forEach((it, i) => {
            setTimeout(() => {
                it.el.style.transform = `translate(${it.closedX}px, ${it.closedY}px)`;
            }, i * 20);
        });
        setTimeout(() => this.clear(), 240);
        this.opened = false;
    }

    clear() {
        while (this.menu.firstChild) this.menu.removeChild(this.menu.firstChild);
        this.items = [];
    }
}
