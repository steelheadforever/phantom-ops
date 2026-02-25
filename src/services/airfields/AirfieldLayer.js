import { fetchTexasAirfields } from './AirfieldService.js';

// Circle-with-crosshair airport symbol, amber for civil, green-teal for military
function makeAirfieldIcon(ident, isMilitary) {
  const color = isMilitary ? '#44ffaa' : '#ffe080';
  const svg = `<svg width="14" height="14" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="6" fill="none" stroke="${color}" stroke-width="1.5"/>
    <line x1="8" y1="2" x2="8" y2="14" stroke="${color}" stroke-width="1" stroke-linecap="round"/>
    <line x1="2" y1="8" x2="14" y2="8" stroke="${color}" stroke-width="1" stroke-linecap="round"/>
  </svg>`;
  const label = `<span style="display:block;font:8px 'B612 Mono',monospace;color:${color};white-space:nowrap;text-align:center;margin-top:1px;pointer-events:none">${ident}</span>`;

  return L.divIcon({
    html: `<div style="display:flex;flex-direction:column;align-items:center;pointer-events:none">${svg}${label}</div>`,
    className: '',
    iconSize: [40, 24],
    iconAnchor: [20, 7],
  });
}

export class AirfieldLayer {
  constructor(map, { pane } = {}) {
    this.map = map;
    this._pane = pane;
    this.group = L.layerGroup();

    /** @type {GeoJSON.Feature[] | null} null = not yet fetched */
    this._features = null;
    this._fetching = false;

    map.on('layeradd', (e) => {
      if (e.layer === this.group) this._ensureLoaded();
    });
  }

  _ensureLoaded() {
    if (this._features || this._fetching) return;
    this._fetchAndRender();
  }

  async _fetchAndRender() {
    this._fetching = true;
    try {
      this._features = await fetchTexasAirfields();
      this._render();
    } catch (err) {
      console.warn('Airfield layer fetch failed:', err);
    } finally {
      this._fetching = false;
    }
  }

  _render() {
    this.group.clearLayers();
    for (const feature of this._features) {
      const [lon, lat] = feature.geometry.coordinates;
      const { IDENT, ICAO_ID, MIL_CODE } = feature.properties ?? {};
      const ident = ICAO_ID || IDENT || '';
      const isMilitary = MIL_CODE === 'MIL';
      this.group.addLayer(L.marker([lat, lon], {
        icon: makeAirfieldIcon(ident, isMilitary),
        interactive: false,
        ...(this._pane ? { pane: this._pane } : {}),
      }));
    }
  }
}
