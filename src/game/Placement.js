import { TILE } from './Config.js';

export function worldToCell(wx, wy) {
    return { c: Math.floor(wx / TILE), r: Math.floor(wy / TILE) };
}
