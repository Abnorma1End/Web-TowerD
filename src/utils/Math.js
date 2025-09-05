export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const dist2 = (x1,y1,x2,y2) => {
    const dx = x2-x1, dy=y2-y1; return dx*dx+dy*dy;
};
