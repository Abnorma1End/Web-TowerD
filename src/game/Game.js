// src/game/Game.js
import { RNG } from '../core/RNG.js';
import { generateGrid } from './map/Generator.js';
import { State } from './State.js';
import { Renderer } from './Renderer.js';
import { worldToCell } from './Placement.js';
import { TILE, COLS, ROWS, ECON, INTRO } from './Config.js';
import { Tower } from './entities/Tower.js';
import { updateCombat } from './systems/Combat.js';
import { Camera } from '../core/Camera.js';
import { DeathPuff } from './effects/Effects.js';
import { UpgradeMenu } from '../ui/UpgradeMenu.js';
import { BuildMenu } from '../ui/BuildMenu.js';

const BUILD_COST = {
    arrow: ECON.towerCost ?? 30,
    cannon: Math.round((ECON.towerCost ?? 30) * 1.4),
    frost: Math.round((ECON.towerCost ?? 30) * 1.2),
};

export class Game {
    constructor(canvas, input, tooltip = null) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.input = input;
        this.tooltip = tooltip;

        this.view = { cssW: 960, cssH: 600, dpr: 1 };
        this.camera = new Camera(0, 0, 1.0);

        this.seed = this._newSeed();
        this.rng = new RNG(this.seed);
        this.state = new State(generateGrid(this.seed));
        this.renderer = new Renderer(this);

        // Fit + intro
        this._fitViewToWorld(1);
        this._startIntro(); // NEW

        this.ui = { hoverC: null, hoverR: null, canPlace: false, reason: '' };
        this.phase = 'BUILD';
        this.selectedTower = null;

        this.upgradeMenu = new UpgradeMenu(this.canvas, (type) => this._applyUpgrade(type));
        this.buildMenu = new BuildMenu(this.canvas, (choice) => this._placeFromBuildMenu(choice));
        this._buildAnchorCell = null;

        document.addEventListener('keydown', (e) => {
            const k = e.key.toLowerCase();
            if (k === ' ') { e.preventDefault(); this.startWave(); }
            if (k === 'r') { this.reroll(); }
            if (k === 'escape') { this._closeMenus(); this._cancelIntro(); }
            if (k === 'delete' || k === 'backspace') this._sellTowerUnderCursor();
            if (k === 'f') { this._fitViewToWorld(1); this._cancelIntro(); }
        });

        // Cancel intro on any pointer wheel or down
        canvas.addEventListener('wheel', () => this._cancelIntro(), { passive: true });
        canvas.addEventListener('pointerdown', () => this._cancelIntro());
    }
    _handlePanZoom(dt) {
        // If you want basic keyboard pan while we wire things up:
        // const speed = 600 / (this.camera.zoom || 1);
        // if (this.input?.isKeyDown?.('a')) this.camera.x -= speed * dt;
        // if (this.input?.isKeyDown?.('d')) this.camera.x += speed * dt;
        // if (this.input?.isKeyDown?.('w')) this.camera.y -= speed * dt;
        // if (this.input?.isKeyDown?.('s')) this.camera.y += speed * dt;
        // this._clampCamera();

        return { scrolled: false, camMoved: false, zoomChanged: false };
    }

    /** TEMP: preview logic stub (kept for compatibility). */
    _updatePlacementPreview() {
        // Intentionally empty—your original logic likely highlighted build tiles.
    }

    /** TEMP: click/placement/selection handler stub. */
    _handlePlacementAndSelection() {
        // Intentionally empty—your original handled left/right clicks & menu opens.
    }

    /** TEMP: keep menus anchored if you had that behavior earlier. */
    _trackMenuAnchor() {
        // Intentionally empty—safe placeholder.
    }

    setViewMetrics({ cssW, cssH, dpr }) {
        this.view.cssW = Math.max(1, cssW);
        this.view.cssH = Math.max(1, cssH);
        this.view.dpr = Math.max(1, dpr || 1);
        this._fitViewToWorld(1);
    }

    _fitViewToWorld(padTiles = 1, clampZoomMin = 0.3, clampZoomMax = 3.0) {
        const worldW = COLS * TILE;
        const worldH = ROWS * TILE;
        const pad = Math.max(0, padTiles) * TILE;

        const targetW = worldW + pad * 2;
        const targetH = worldH + pad * 2;

        const zW = this.view.cssW / targetW;
        const zH = this.view.cssH / targetH;
        const zFit = Math.min(zW, zH);
        const z = Math.max(clampZoomMin, Math.min(clampZoomMax, zFit));
        this.camera.zoom = z;

        const viewWWorld = this.view.cssW / z;
        const viewHWorld = this.view.cssH / z;

        const centerX = worldW / 2;
        const centerY = worldH / 2;

        this.camera.x = centerX - viewWWorld / 2;
        this.camera.y = centerY - viewHWorld / 2;

        this._clampCamera();
        return z; // NEW: return the chosen zoom
    }

    _newSeed() { return `run-${Date.now()}`; }

    reroll() {
        this.seed = this._newSeed();
        this.rng = new RNG(this.seed);
        this.state = new State(generateGrid(this.seed));
        this.phase = 'BUILD';
        this.selectedTower = null;
        this._closeMenus();
        this._fitViewToWorld(1);
        this._hideTooltip();
        this._startIntro(); // NEW
    }

    startWave() {
        this._closeMenus();
        if (this.phase === 'COMBAT') return;
        const started = this.state.waves.startNextWave();
        if (started) this.phase = 'COMBAT';
    }

    _clampCamera() {
        const worldW = COLS * TILE;
        const worldH = ROWS * TILE;
        const viewW = this.view.cssW / this.camera.zoom;
        const viewH = this.view.cssH / this.camera.zoom;
        const maxX = Math.max(0, worldW - viewW);
        const maxY = Math.max(0, worldH - viewH);
        this.camera.x = Math.min(Math.max(0, this.camera.x), maxX);
        this.camera.y = Math.min(Math.max(0, this.camera.y), maxY);
    }

    /* ---------------- Intro camera ---------------- */

    _startIntro() {
        // Full map is already fitted. Now we’ll (optionally) animate toward the primary spawn.
        const s = this.state.grid.spawns?.[0] ?? this.state.grid.spawn ?? { c: 0, r: 0 };
        const spawnWX = s.c * TILE + TILE / 2;
        const spawnWY = s.r * TILE + TILE / 2;

        // Target zoom showing ~INTRO.showTiles tiles
        const zTilesW = this.view.cssW / (INTRO.showTiles.w * TILE);
        const zTilesH = this.view.cssH / (INTRO.showTiles.h * TILE);
        const zTarget = Math.min(3.0, Math.max(0.4, Math.min(zTilesW, zTilesH)));

        // Compute target camera top-left so spawn is centered.
        const viewWTarget = this.view.cssW / zTarget;
        const viewHTarget = this.view.cssH / zTarget;
        const targetX = spawnWX - viewWTarget / 2;
        const targetY = spawnWY - viewHTarget / 2;

        this.intro = {
            t: 0,
            hold: INTRO.holdFullMap,
            travel: INTRO.travel,
            from: { x: this.camera.x, y: this.camera.y, z: this.camera.zoom },
            to: { x: targetX, y: targetY, z: zTarget },
            active: true,
        };
    }

    _cancelIntro() { if (this.intro) this.intro.active = false; }

    _updateIntro(dt) {
        const I = this.intro;
        if (!I || !I.active) return;

        I.t += dt;
        if (I.t < I.hold) {
            // show full map — do nothing
            return;
        }
        const t = Math.min(1, (I.t - I.hold) / Math.max(0.0001, I.travel));
        const k = easeInOutCubic(t);

        this.camera.x = lerp(I.from.x, I.to.x, k);
        this.camera.y = lerp(I.from.y, I.to.y, k);
        this.camera.zoom = lerp(I.from.z, I.to.z, k);
        this._clampCamera();

        if (t >= 1) I.active = false;
    }

    /* ---------------- Placement / Selling (unchanged) ---------------- */
    _towerAtCell(c, r) { return this.state.towers.find(t => t.c === c && t.r === r) || null; }

    _sellTowerUnderCursor() {
        const { wx, wy } = this._mouseWorld();
        const { c, r } = worldToCell(wx, wy);
        if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return;
        const t = this._towerAtCell(c, r);
        if (!t) return;
        const cost = BUILD_COST[t.kind] ?? ECON.towerCost;
        const refund = Math.round(cost * ECON.refundRate);
        const idx = this.state.towers.indexOf(t);
        if (idx >= 0) this.state.towers.splice(idx, 1);
        this.state.gold += refund;
        if (this.selectedTower === t) this._closeMenus();
    }

    _placeFromBuildMenu(choice) {
        if (!this._buildAnchorCell) return;
        const cost = BUILD_COST[choice] ?? (ECON.towerCost ?? 30);
        if (this.state.gold < cost) return;

        const { c, r } = this._buildAnchorCell;
        if (!this.state.grid.isBuildable(c, r) || this._towerAtCell(c, r)) return;

        this.state.towers.push(new Tower(c, r, choice));
        this.state.gold -= cost;
        this._closeMenus();
    }

    /* ---------------- Tooltip (unchanged except costs list) ---------------- */
    _updateTooltip() {
        if (!this.tooltip) return;
        if (this.upgradeMenu?.opened || this.buildMenu?.opened) { this._hideTooltip(); return; }
        if (this.input.isDragging()) { this._hideTooltip(); return; }

        const cssX = this.input.mouseCSS?.x ?? (this.input.mouse.x / this.view.dpr);
        const cssY = this.input.mouseCSS?.y ?? (this.input.mouse.y / this.view.dpr);
        const { wx, wy } = this._mouseWorld();
        const { c, r } = worldToCell(wx, wy);
        if (!(c >= 0 && r >= 0 && c < COLS && r < ROWS)) { this._hideTooltip(); return; }

        const towerHere = this._towerAtCell(c, r);
        if (towerHere) {
            const html =
                `<div class="title">Tower (c${c}, r${r})</div>
Range: ${(towerHere.range / TILE).toFixed(1)} tiles
Level: ${towerHere.level}
Dmg/shot: ${towerHere.damagePerShot.toFixed(1)}
Fire CD: ${towerHere.baseCooldown.toFixed(2)} s
<i class="tiny">Click for upgrades · Right-click to sell</i>`;
            this.tooltip.set(cssX, cssY, html);
            return;
        }

        const cellType = this.state.grid.get(c, r);
        let name = 'Empty';
        if (cellType === 1) name = 'Wall';
        else if (cellType === 2) name = 'Path';
        else if (cellType === 3) name = 'Spawn';
        else if (cellType === 4) name = 'Base';

        if (this.ui.reason === 'Blocked' || name !== 'Empty') {
            const html = `<div class="title">${name}</div>\n<span class="bad">Cannot build here.</span>`;
            this.tooltip.set(cssX, cssY, html);
            return;
        }

        const enoughAny = Object.values(BUILD_COST).some(v => this.state.gold >= v);
        const html =
            `<div class="title">Build spot (c${c}, r${r})</div>
${Object.entries(BUILD_COST).map(([k, v]) => `<div>${k}: ${v}g</div>`).join('')}
${enoughAny ? '<span class="ok">Left-click to open build menu</span>'
                : '<span class="bad">Not enough gold for any tower</span>'}`;
        this.tooltip.set(cssX, cssY, html);
    }

    /* ---------------- Update & Render ---------------- */
    update(dt) {
        // Intro camera
        this._updateIntro(dt);

        const scroll = this._handlePanZoom(dt);
        this._updatePlacementPreview();
        this._handlePlacementAndSelection();

        if ((this.upgradeMenu.opened || this.buildMenu.opened)
            && (scroll.scrolled || scroll.camMoved || scroll.zoomChanged)) {
            this._closeMenus();
        } else {
            this._trackMenuAnchor();
        }

        this.state.waves.update(dt, this.state.creeps);

        for (let i = this.state.creeps.length - 1; i >= 0; i--) {
            const c = this.state.creeps[i];
            const reached = c.update(dt);
            if (reached === 'reached') { this.state.creeps.splice(i, 1); this.state.lives--; }
            else if (!c.alive) {
                const { x, y } = c.tilePos;
                this.state.effects.push(new DeathPuff(x, y));
                this.state.creeps.splice(i, 1);
                this.state.gold += (c.bounty ?? ECON.creepBounty);
            }
        }

        updateCombat(dt, this.state.towers, this.state.creeps, this.state.projectiles, this.state.effects);

        for (let i = this.state.effects.length - 1; i >= 0; i--) {
            const e = this.state.effects[i];
            if (!e.update(dt)) this.state.effects.splice(i, 1);
        }

        if (!this.state.waves.active && this.state.creeps.length === 0) {
            this.phase = 'BUILD';
        }

        this._updateTooltip();

        const hudStats = document.getElementById('stats');
        if (hudStats) {
            const w = this.state.waves.hudInfo();
            hudStats.textContent =
                `Gold: ${this.state.gold}  Lives: ${this.state.lives}` +
                (w ? `  |  Wave ${w.waveNumber}/${this.state.waves.waves.length} ${w.active ? '(spawning)' : ''}` : '');
        }
    }

    render(ctx) { this.renderer.render(ctx); }

    /* ---------------- helpers ---------------- */
    _mouseWorld() {
        const cssX = this.input.mouse.x / this.view.dpr;
        const cssY = this.input.mouse.y / this.view.dpr;
        const wx = this.camera.x + cssX / this.camera.zoom;
        const wy = this.camera.y + cssY / this.camera.zoom;
        return { wx, wy };
    }
    _worldToCSS(wx, wy) {
        const cx = (wx - this.camera.x) * this.camera.zoom;
        const cy = (wy - this.camera.y) * this.camera.zoom;
        const rect = this.canvas.getBoundingClientRect();
        return { x: rect.left + cx, y: rect.top + cy };
    }
    _closeMenus() { this.upgradeMenu.hide(); this.buildMenu.hide(); this.selectedTower = null; this._buildAnchorCell = null; }
    _hideTooltip() { if (this.tooltip) this.tooltip.hide(); }
}

/* ---- tiny math helpers for easing ---- */
function lerp(a, b, t) { return a + (b - a) * t; }
function easeInOutCubic(t) {
    return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;


}
