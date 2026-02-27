/**
 * MapLegend — a fixed bottom-left overlay showing airspace colors and navaid symbols.
 * Toggled by the Legend checkbox in the AirspaceMenu.
 */
export class MapLegend {
  constructor() {
    this._el = null;
  }

  mount(root = document.body) {
    const el = document.createElement('div');
    el.className = 'map-legend';
    el.style.display = 'none';
    el.innerHTML = this._template();
    root.appendChild(el);
    this._el = el;
    return this;
  }

  show() { if (this._el) this._el.style.display = ''; }
  hide() { if (this._el) this._el.style.display = 'none'; }
  setVisible(v) { v ? this.show() : this.hide(); }

  _template() {
    const airspace = [
      { color: '#4da6ff', label: 'Class B' },
      { color: '#2176cc', label: 'Class C' },
      { color: '#0a4a8a', label: 'Class D' },
      { color: '#ff8c00', label: 'MOA' },
      { color: '#ffd700', label: 'Alert Area' },
      { color: '#ff5f5f', label: 'Restricted' },
    ];

    const airspaceRows = airspace.map(({ color, label }) => `
      <div class="map-legend__row">
        <div class="map-legend__swatch" style="background:${color}; border: 1px solid ${color};"></div>
        <span>${label}</span>
      </div>
    `).join('');

    const navaids = [
      {
        label: 'VOR',
        svg: `<svg width="16" height="16" viewBox="0 0 16 16"><polygon points="8,1 14,4.5 14,11.5 8,15 2,11.5 2,4.5" fill="none" stroke="#4488ff" stroke-width="1.5"/><circle cx="8" cy="8" r="2" fill="#4488ff"/></svg>`,
      },
      {
        label: 'VORTAC',
        svg: `<svg width="16" height="16" viewBox="0 0 16 16"><polygon points="8,1 14,4.5 14,11.5 8,15 2,11.5 2,4.5" fill="none" stroke="#4488ff" stroke-width="1.5"/><polygon points="8,5 12,12 4,12" fill="none" stroke="#44ddaa" stroke-width="1.2"/></svg>`,
      },
      {
        label: 'TACAN',
        svg: `<svg width="16" height="16" viewBox="0 0 16 16"><polygon points="8,2 15,14 1,14" fill="none" stroke="#44ddaa" stroke-width="1.5"/></svg>`,
      },
      {
        label: 'NDB',
        svg: `<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="none" stroke="#cc88ff" stroke-width="1.5" stroke-dasharray="2,2"/></svg>`,
      },
      {
        label: 'IFR Fix',
        svg: `<svg width="16" height="16" viewBox="0 0 16 16"><polygon points="8,2 15,14 1,14" fill="none" stroke="#aaddff" stroke-width="1.5"/></svg>`,
      },
    ];

    const navaidRows = navaids.map(({ svg, label }) => `
      <div class="map-legend__row">
        <div class="map-legend__icon">${svg}</div>
        <span>${label}</span>
      </div>
    `).join('');

    return `
      <div class="map-legend__section-title">AIRSPACE</div>
      ${airspaceRows}
      <div class="map-legend__section-title">NAVAIDS</div>
      ${navaidRows}
    `;
  }
}
