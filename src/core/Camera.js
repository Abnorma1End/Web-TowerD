export class Camera {
    constructor(x=0, y=0, zoom=1) {
        this.x = x; this.y = y; this.zoom = zoom;
    }
    lookAt(wx, wy) {
        this.x = Math.max(0, wx); this.y = Math.max(0, wy);
    }
}
