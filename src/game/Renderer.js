// src/game/Renderer.js
// Renderer with multi-spawn labeling (active vs locked) and safe HUD.

import { TILE, COLS, ROWS } from './Config.js';

export class Renderer {
    constructor(game) {
        this.game = game;
    }

    render(ctx) {
        const { dpr } = this.game.view;

        // clear
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#0a0c12';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.restore();


        // camera transform
        const z = this.game.camera.zoom;
        const ox = -this.game.camera.x * z;
        const oy = -this.game.camera.y * z;

        ctx.save();
        ctx.setTransform(z * dpr, 0, 0, z * dpr, ox * dpr, oy * dpr);

        this.drawGrid(ctx);
        this.drawPathAndSpawns(ctx);   // ← updated: shows multi-spawn labels
        this.drawTowers(ctx);
        this.drawCreeps(ctx);
        this.drawProjectiles(ctx);
        this.drawEffects(ctx);
        this.drawPlacementPreview(ctx);

        ctx.restore();

        // HUD overlay text
        this.drawHUDText(ctx);
    }

    /* ----------------- world ----------------- */

    drawGrid(ctx) {
        const worldW = COLS * TILE;
        const worldH = ROWS * TILE;

        // board background
        ctx.fillStyle = '#0d1220';
        ctx.fillRect(0, 0, worldW, worldH);

        // grid lines
        ctx.strokeStyle = '#10141f';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let c = 0; c <= COLS; c++) {
            const x = c * TILE + 0.5;
            ctx.moveTo(x, 0);
            ctx.lineTo(x, worldH);
        }
        for (let r = 0; r <= ROWS; r++) {
            const y = r * TILE + 0.5;
            ctx.moveTo(0, y);
            ctx.lineTo(worldW, y);
        }
        ctx.stroke();
    }

    drawPathAndSpawns(ctx) {
        const g = this.game?.state?.grid;
        if (!g) return;

        // path tiles
        if (g.path) {
            ctx.fillStyle = '#1e2a44';
            for (const p of g.path) {
                ctx.fillRect(p.c * TILE, p.r * TILE, TILE, TILE);
            }
        }
        if (Array.isArray(g.spawnPrefixes)) {
            ctx.fillStyle = '#253357'; // slightly different from main path
            for (const pref of g.spawnPrefixes) {
                if (!pref || !pref.length) continue;
                for (const p of pref) {
                    ctx.fillRect(p.c * TILE, p.r * TILE, TILE, TILE);
                }
            }
        }
        // base marker
        if (g.base) {
            ctx.fillStyle = '#e46a6a';
            ctx.fillRect(g.base.c * TILE, g.base.r * TILE, TILE, TILE);
            this._labelTile(ctx, g.base.c, g.base.r, 'BASE', '#e46a6a');
        }

        // spawn markers (multi-spawn aware)
        const waves = this.game?.state?.waves ?? null;
        const info = waves?.hudInfo ? waves.hudInfo() : null;
        const activeSpawns = info?.activeSpawns ?? 1;
        const activationWave = info?.multiSpawnActivationWave ?? 3;

        // If grid.spawns exists, use it; else fall back to single spawn
        const spawns = Array.isArray(g.spawns) && g.spawns.length ? g.spawns : (g.spawn ? [g.spawn] : []);
        const labelFor = (i) => (i === 0 ? 'SPAWN A' : `SPAWN ${String.fromCharCode(65 + i)}`);

        spawns.forEach((s, i) => {
            const x = s.c * TILE, y = s.r * TILE;
            const active = i < activeSpawns;

            // tile background
            ctx.fillStyle = active ? '#2fa56f' : '#3a3f4d';
            ctx.fillRect(x, y, TILE, TILE);

            // border
            ctx.strokeStyle = active ? '#6de3a7' : '#9aa2b3';
            ctx.lineWidth = 2;
            ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);

            // center dot
            ctx.fillStyle = active ? '#bff7dc' : '#d4d8e1';
            ctx.beginPath();
            ctx.arc(x + TILE / 2, y + TILE / 2, Math.max(3, TILE * 0.12), 0, Math.PI * 2);
            ctx.fill();

            // label (and lock if not active)
            if (active) {
                this._labelTile(ctx, s.c, s.r, labelFor(i), '#6de3a7');
            } else {
                this._labelTile(ctx, s.c, s.r, `🔒 ${labelFor(i)}\nUnlock W${activationWave}`, '#d4d8e1');
            }
        });
    }

    _labelTile(ctx, c, r, text, color = '#dfe7ff') {
        const x = c * TILE + TILE / 2;
        const baseY = r * TILE - 6;
        const lines = String(text).split('\n');
        const lh = (TILE * 0.22) * 1.05; // line height

        ctx.save();
        ctx.font = `${Math.max(10, TILE * 0.22)}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        // shadow (draw all lines for each shadow offset)
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        for (const [dx, dy] of [[0.5, 0.5], [0.5, -0.5], [-0.5, 0.5], [-0.5, -0.5]]) {
            let yy = baseY;
            for (const line of lines) {
                ctx.fillText(line, x + dx, yy + dy);
                yy += lh;
            }
        }

        // main text
        ctx.fillStyle = color;
        let yy = baseY;
        for (const line of lines) {
            ctx.fillText(line, x, yy);
            yy += lh;
        }

        ctx.restore();
    }

    drawTowers(ctx) {
        const towers = this.game?.state?.towers ?? [];
        for (const t of towers) {
            ctx.fillStyle = '#88a4ff';
            ctx.beginPath();
            ctx.arc(t.x, t.y, TILE * 0.35, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#cfe0ff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(t.x, t.y);
            ctx.lineTo(t.x + TILE * 0.35, t.y);
            ctx.stroke();

            if (this.game.selectedTower === t) {
                ctx.strokeStyle = 'rgba(136,164,255,0.35)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(t.x, t.y, t.range, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
    }

    drawCreeps(ctx) {
        const creeps = this.game?.state?.creeps ?? [];
        for (const c of creeps) {
            if (!c.alive) continue;
            ctx.fillStyle = '#ffd98a';
            ctx.beginPath();
            ctx.arc(c.tilePos.x, c.tilePos.y, TILE * 0.28, 0, Math.PI * 2);
            ctx.fill();

            // hp bar
            const w = TILE * 0.6, h = 4;
            const x = c.tilePos.x - w / 2;
            const y = c.tilePos.y - TILE * 0.45;
            const pct = Math.max(0, Math.min(1, c.hp / c.maxHP));
            ctx.fillStyle = '#2b2f3a';
            ctx.fillRect(x, y, w, h);
            ctx.fillStyle = '#76e0a4';
            ctx.fillRect(x, y, w * pct, h);
            ctx.strokeStyle = '#0f131d';
            ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        }
    }

    drawProjectiles(ctx) {
        const projs = this.game?.state?.projectiles ?? [];
        ctx.fillStyle = '#fff';
        for (const p of projs) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius ?? 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawEffects(ctx) {
        const fx = this.game?.state?.effects ?? [];
        for (const e of fx) {
            if (e.type === 'deathpuff') {
                ctx.globalAlpha = e.alpha ?? 1;
                ctx.fillStyle = '#e46a6a';
                ctx.beginPath();
                ctx.arc(e.x, e.y, e.radius ?? 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            } else if (e.type === 'hitspark') {
                ctx.globalAlpha = e.alpha ?? 1;
                ctx.fillStyle = '#fff';
                ctx.fillRect(e.x - 2, e.y - 2, 4, 4);
                ctx.globalAlpha = 1;
            }
        }
    }

    drawPlacementPreview(ctx) {
        const ui = this.game.ui;
        if (ui.hoverC == null || ui.hoverR == null) return;
        const x = ui.hoverC * TILE;
        const y = ui.hoverR * TILE;
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = ui.canPlace ? '#2f855a' : '#7b2d2d';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.globalAlpha = 1;
    }

    /* ----------------- HUD ----------------- */

    drawHUDText(ctx) {
        const gold = this.game?.state?.gold ?? 0;
        const lives = this.game?.state?.lives ?? 0;
        const waves = this.game?.state?.waves ?? null;
        const info = waves?.hudInfo ? waves.hudInfo() : null;

        const wNum = info?.waveNumber ?? 0;
        const wCnt = this.game?.state?.waves?.waves?.length ?? 0;
        const wStatus = info?.active ? 'spawning' : 'idle';
        const sp = info ? `${info.activeSpawns}/${info.totalSpawns} spawns` : '';

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#dfe7ff';
        ctx.font = '14px Inter, system-ui, sans-serif';
        ctx.textBaseline = 'top';

        const lines = [
            `Gold: ${gold}   Lives: ${lives}`,
            wCnt ? `Wave ${wNum}/${wCnt} — ${wStatus}   (${sp})` : `No waves queued`,
            info?.currentName ? `Current: ${info.currentName}` : '',
            info?.nextName ? `Next: ${info.nextName}` : '',
            info && info.activeSpawns < info.totalSpawns
                ? `Extra spawns unlock at Wave ${info.multiSpawnActivationWave}`
                : '',
        ].filter(Boolean);

        let y = 8;
        for (const line of lines) {
            ctx.fillText(line, 10, y);
            y += 16;
        }
        ctx.restore();
    }
}
