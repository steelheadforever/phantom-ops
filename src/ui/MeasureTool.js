/**
 * MeasureTool — click-based distance measurement on the map.
 *
 * States:
 *   idle    → tool inactive
 *   placing → active, waiting for first click (start point)
 *   drawing → start placed, tracking line follows cursor
 *   placed  → line frozen, waiting for third click to clear
 */

const RULER_SVG = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"
  stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <rect x="1" y="5" width="14" height="6" rx="1"/>
  <line x1="4"  y1="5" x2="4"  y2="8.5"/>
  <line x1="7"  y1="5" x2="7"  y2="7.5"/>
  <line x1="10" y1="5" x2="10" y2="8.5"/>
  <line x1="13" y1="5" x2="13" y2="7.5"/>
</svg>`;

export class MeasureTool {
  constructor({ map, bottomBar }) {
    this._map = map;
    this._state = 'idle';   // idle | placing | drawing | placed
    this._startLatLng = null;

    // Temp Leaflet layers
    this._startDot = null;
    this._endDot   = null;
    this._line     = null;
    this._label    = null;

    this._btn = null;

    this._onMapClick  = this._onMapClick.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);

    this._buildButton(bottomBar);
  }

  isActive() {
    return this._state !== 'idle';
  }

  // ─── private ────────────────────────────────────────────────────────────

  _buildButton(bottomBar) {
    const btn = document.createElement('button');
    btn.className = 'bar-btn';
    btn.setAttribute('aria-label', 'Measure distance');
    btn.title = 'Measure distance';
    btn.innerHTML = RULER_SVG;
    btn.addEventListener('click', () => this._toggle());
    bottomBar.addMidControl(btn);
    this._btn = btn;
  }

  _toggle() {
    if (this._state === 'idle') {
      this._activate();
    } else {
      this._deactivate();
    }
  }

  _activate() {
    this._state = 'placing';
    this._btn.classList.add('active');
    this._map.on('click', this._onMapClick);
    this._map.on('mousemove', this._onMouseMove);
    this._map.getContainer().style.cursor = 'crosshair';
  }

  _deactivate() {
    this._clearTemp();
    this._startLatLng = null;
    this._state = 'idle';
    this._btn.classList.remove('active');
    this._map.off('click', this._onMapClick);
    this._map.off('mousemove', this._onMouseMove);
    this._map.getContainer().style.cursor = '';
  }

  _onMapClick(e) {
    if (this._state === 'placing') {
      // First click — place start dot, begin tracking
      this._startLatLng = e.latlng;
      this._startDot = L.circleMarker(e.latlng, {
        radius: 3,
        color: '#f5a800',
        fillColor: '#f5a800',
        fillOpacity: 1,
        weight: 1,
        interactive: false,
      }).addTo(this._map);
      this._state = 'drawing';

    } else if (this._state === 'drawing') {
      // Second click — freeze line in place, place end dot
      this._endDot = L.circleMarker(e.latlng, {
        radius: 3,
        color: '#f5a800',
        fillColor: '#f5a800',
        fillOpacity: 1,
        weight: 1,
        interactive: false,
      }).addTo(this._map);
      this._state = 'placed';

    } else if (this._state === 'placed') {
      // Third click — clear measurement, ready for next one
      this._clearTemp();
      this._startLatLng = null;
      this._state = 'placing';
    }
  }

  _onMouseMove(e) {
    if (this._state !== 'drawing') return;
    const end = e.latlng;
    const latlngs = [this._startLatLng, end];

    // Update or create tracking line
    if (this._line) {
      this._line.setLatLngs(latlngs);
    } else {
      this._line = L.polyline(latlngs, {
        color: '#f5a800',
        weight: 1.5,
        dashArray: '6,4',
        interactive: false,
      }).addTo(this._map);
    }

    // Distance in NM
    const distNm = this._map.distance(this._startLatLng, end) / 1852;
    const labelText = `${distNm < 10 ? distNm.toFixed(2) : distNm.toFixed(1)} NM`;
    const mid = [(this._startLatLng.lat + end.lat) / 2, (this._startLatLng.lng + end.lng) / 2];

    if (this._label) {
      this._label.setLatLng(mid);
      this._label.getElement()?.querySelector('.mt-label__text')
        ?.replaceChildren(document.createTextNode(labelText));
    } else {
      this._label = L.marker(mid, {
        icon: L.divIcon({
          className: '',
          html: `<div class="mt-label"><span class="mt-label__text">${labelText}</span></div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        }),
        interactive: false,
        zIndexOffset: 1000,
      }).addTo(this._map);
    }
  }

  _clearTemp() {
    this._startDot?.remove(); this._startDot = null;
    this._endDot?.remove();   this._endDot   = null;
    this._line?.remove();     this._line     = null;
    this._label?.remove();    this._label    = null;
  }
}
