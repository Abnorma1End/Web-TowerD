import { COLS, ROWS } from '../Config.js';
export const CELL = { EMPTY:0, WALL:1, PATH:2, SPAWN:3, BASE:4 };

export class Grid {
    constructor() {
        this.cols = COLS; this.rows = ROWS;
        this.cells = new Uint8Array(this.cols * this.rows);
        this.path = []; // array of {c,r} path cells in order
        this.spawn = { c:0, r:0 };
        this.base = { c: this.cols-1, r: 0 };
    }
    idx(c,r){ return r*this.cols + c; }
    inBounds(c,r){ return c>=0 && r>=0 && c<this.cols && r<this.rows; }
    get(c,r){ return this.cells[this.idx(c,r)]; }
    set(c,r,v){ this.cells[this.idx(c,r)] = v; }
    isWalkable(c,r){ return this.inBounds(c,r) && (this.get(c,r)===CELL.PATH || this.get(c,r)===CELL.SPAWN || this.get(c,r)===CELL.BASE); }
    isBuildable(c,r){ return this.inBounds(c,r) && this.get(c,r)===CELL.EMPTY; }
}
