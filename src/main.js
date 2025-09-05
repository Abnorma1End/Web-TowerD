// src/main.js
import { Engine } from './core/Engine.js';
import { Game } from './game/Game.js';
import { Input } from './ui/Input.js';
import { Tooltip } from './ui/Tooltip.js';
import { ECON } from './game/Config.js';

const canvas  = document.getElementById('game');
const hud     = document.getElementById('hud');
const stage   = document.getElementById('stage');
const tooltip = new Tooltip();
const input   = new Input(canvas);
const game    = new Game(canvas, input, tooltip);

// Keep the hotkey line in sync (optional polish)
const hk = document.getElementById('hotkeys');
if (hk) hk.textContent =
    `WASD / Middle or Right drag to pan · Wheel to zoom · Click to place tower (base cost ${ECON.towerCost}).`;

function layout() {
    const dpr = window.devicePixelRatio || 1;

    // 1) Measure HUD and push stage down to match real height
    const hudH = hud ? hud.offsetHeight : 48;
    if (stage) stage.style.top = `${hudH}px`;

    // 2) Compute playable CSS size = viewport minus HUD
    const cssW = Math.max(1, Math.floor(window.innerWidth));
    const cssH = Math.max(1, Math.floor(window.innerHeight - hudH));

    // 3) Size the canvas CSS box to fill the stage
    canvas.style.width  = `${cssW}px`;
    canvas.style.height = `${cssH}px`;

    // 4) Match backing store to CSS × DPR (sharp rendering)
    const pxW = Math.max(1, Math.floor(cssW * dpr));
    const pxH = Math.max(1, Math.floor(cssH * dpr));
    if (canvas.width !== pxW)  canvas.width  = pxW;
    if (canvas.height !== pxH) canvas.height = pxH;

    // 5) Tell the game its current CSS size and DPR
    game.setViewMetrics({ cssW, cssH, dpr });
}

// Re-layout on resize, DPR changes, and HUD wrapping changes.
window.addEventListener('resize', layout);
window.matchMedia && window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener?.('change', layout);

// If the HUD text wraps to a second line, we’ll detect the height change:
if ('ResizeObserver' in window && hud) {
    const ro = new ResizeObserver(layout);
    ro.observe(hud);
}

// Initial layout + engine start
layout();

const engine = new Engine((dt) => game.update(dt), (ctx) => game.render(ctx), canvas);
engine.start();
