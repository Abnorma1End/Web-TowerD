export class Tooltip {
    constructor() {
        this.el = document.createElement('div');
        this.el.className = 'tooltip';
        this.hide();
        document.body.appendChild(this.el);
    }
    set(cssX, cssY, html) {
        this.el.style.left = `${cssX}px`;
        this.el.style.top  = `${cssY}px`;
        this.el.innerHTML = html;
        this.el.style.display = 'block';
    }
    hide() {
        this.el.style.display = 'none';
    }
}
