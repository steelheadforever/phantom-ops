/**
 * PolygonPopup — floating upper-right popup for polygon placement and editing.
 *
 * Pre-placement (openPre): name/color/transparency active; corner table empty.
 * During placement (attachShape): corner table updates as points are added.
 * After close (notifyPolygonClosed): draggable corner markers appear.
 */

const TACTICAL_COLORS = [
  { label: 'Red',    hex: '#e63946' },
  { label: 'Orange', hex: '#f4a261' },
  { label: 'Yellow', hex: '#f5a800' },
  { label: 'Green',  hex: '#2dc653' },
  { label: 'Blue',   hex: '#4da6ff' },
  { label: 'White',  hex: '#ffffff' },
  { label: 'Black',  hex: '#1a1a1a' },
];

export class PolygonPopup {
  constructor({ shapeManager, coordinateService, coordinateParser, polygonTool, map }) {
    this._shapeManager = shapeManager;
    this._coordinateService = coordinateService;
    this._coordinateParser = coordinateParser;
    this._polygonTool = polygonTool;
    this._map = map;

    this._el = null;
    this._currentId = null;
    this._isNew = false;
    this._isPre = false;
    this._selectedColor = '#4da6ff';
    this._cornerMarkers = [];

    this._titleEl = null;
    this._nameInput = null;
    this._descInput = null;
    this._transparencyInput = null;
    this._transparencyLabel = null;
    this._coordTbody = null;
    this._altEnabledCb = null;
    this._altFloorInput = null;
    this._altCeilingInput = null;
  }

  mount(root = document.body) {
    const el = document.createElement('div');
    el.className = 'shape-popup polygon-popup';
    el.style.display = 'none';
    el.innerHTML = this._template();
    root.appendChild(el);
    this._el = el;

    this._titleEl = el.querySelector('.shape-popup__title');
    this._nameInput = el.querySelector('.sp-name');
    this._descInput = el.querySelector('.sp-description');
    this._transparencyInput = el.querySelector('.sp-transparency');
    this._transparencyLabel = el.querySelector('.sp-transparency-label');
    this._coordTbody = el.querySelector('.pp-coord-tbody');
    this._altEnabledCb = el.querySelector('.sp-alt-enabled');
    this._altFloorInput = el.querySelector('.sp-alt-floor');
    this._altCeilingInput = el.querySelector('.sp-alt-ceiling');

    this._bindStaticEvents();

    // Re-format all coordinate rows when the format changes
    this._coordinateService?.onFormatChange(() => {
      if (!this._currentId || this._isPre) return;
      this._refreshTable();
    });

    return this;
  }

  /** Show popup in pre-placement mode — before any point is clicked. */
  openPre() {
    this._destroyMarkers();
    this._currentId = null;
    this._isNew = true;
    this._isPre = true;

    this._titleEl.textContent = 'New Polygon';
    this._nameInput.value = '';
    this._descInput.value = '';
    this._coordTbody.innerHTML = '<tr><td colspan="3" class="pp-pre-label">— click map to place corners —</td></tr>';
    this._selectColor('#4da6ff');
    const pct = Math.round((1 - (this._shapeManager.lastOpacity ?? 0.26)) * 100);
    this._transparencyInput.value = pct;
    this._transparencyLabel.textContent = `${pct}% transparent`;
    this._altEnabledCb.checked = false;
    this._altFloorInput.value = '';
    this._altCeilingInput.value = '';
    this._syncAltDisabled();
    this._el.style.display = 'block';
  }

  /**
   * Called by PolygonDrawTool after the first point is placed.
   * Transitions from pre-placement to active editing.
   */
  attachShape(shapeId) {
    const rec = this._shapeManager.shapes.find((s) => s.id === shapeId);
    if (!rec) return;
    this._currentId = shapeId;
    this._isPre = false;
    // Apply any name/color already set in pre-placement
    const name = this._nameInput.value.trim();
    if (name) this._shapeManager.updateShape(shapeId, { name, color: this._selectedColor, opacity: (100 - parseInt(this._transparencyInput.value, 10)) / 100 });
    this._refreshTable();
  }

  /**
   * Called by PolygonDrawTool when the polygon is snapped closed.
   * Adds draggable corner markers now that placement is done.
   */
  notifyPolygonClosed() {
    this._refreshTable();
    this._refreshMarkers();
  }

  /** Public — called by PolygonDrawTool after each point is added during placement. */
  refreshCornerTable() {
    if (!this._currentId) return;
    this._refreshTable();
  }

  open(shapeId, { isNew = false } = {}) {
    const rec = this._shapeManager.shapes.find((s) => s.id === shapeId);
    if (!rec) return;

    this._destroyMarkers();
    this._currentId = shapeId;
    this._isNew = isNew;
    this._isPre = false;

    this._titleEl.textContent = isNew ? 'New Polygon' : rec.name;
    this._nameInput.value = rec.name;
    this._descInput.value = rec.description ?? '';
    this._selectColor(rec.color);

    const pct = Math.round((1 - rec.opacity) * 100);
    this._transparencyInput.value = pct;
    this._transparencyLabel.textContent = `${pct}% transparent`;

    this._altEnabledCb.checked = rec.altEnabled ?? false;
    this._altFloorInput.value = rec.altFloor ?? '';
    this._altCeilingInput.value = rec.altCeiling ?? '';
    this._syncAltDisabled();

    this._refreshTable();
    this._refreshMarkers();
    this._el.style.display = 'block';
  }

  close() {
    this._destroyMarkers();
    this._el.style.display = 'none';
    this._currentId = null;
    this._isPre = false;
  }

  /** Returns field values for use when creating the shape. */
  getPendingConfig() {
    const pct = parseInt(this._transparencyInput?.value ?? '74', 10);
    return {
      name:        this._nameInput?.value.trim() || null,
      description: this._descInput?.value.trim() || '',
      color:       this._selectedColor,
      opacity:     (100 - pct) / 100,
      altEnabled:  this._altEnabledCb?.checked ?? false,
      altFloor:    this._altFloorInput?.value !== '' ? parseFloat(this._altFloorInput.value) : null,
      altCeiling:  this._altCeilingInput?.value !== '' ? parseFloat(this._altCeilingInput.value) : null,
    };
  }

  // ─── private ────────────────────────────────────────────────────────────

  _template() {
    const swatchHtml = TACTICAL_COLORS.map((c) =>
      `<button class="color-swatch" data-hex="${c.hex}" title="${c.label}"
        style="background:${c.hex};" aria-label="${c.label}"></button>`
    ).join('');

    return `
      <div class="shape-popup__title">Polygon</div>
      <div class="shape-popup__field">
        <label>Name</label>
        <input class="sp-name sp-input" type="text" autocomplete="off" />
      </div>
      <div class="shape-popup__field">
        <label>Description</label>
        <textarea class="sp-description sp-input" rows="2" maxlength="200" autocomplete="off"></textarea>
      </div>
      <div class="shape-popup__field">
        <label>Color</label>
        <div class="color-swatches">${swatchHtml}</div>
      </div>
      <div class="shape-popup__field">
        <label>Transparency</label>
        <div class="sp-transparency-row">
          <input class="sp-transparency" type="range" min="0" max="100" step="1" />
          <span class="sp-transparency-label">74% transparent</span>
        </div>
      </div>
      <div class="shape-popup__field">
        <label class="sp-alt-header">
          <input type="checkbox" class="sp-alt-enabled" />
          Altitude (ft MSL)
        </label>
        <div class="sp-alt-fields sp-alt-fields--disabled">
          <input class="sp-alt-floor sp-input" type="number" min="0" step="100" placeholder="Floor" disabled />
          <span class="sp-alt-sep">–</span>
          <input class="sp-alt-ceiling sp-input" type="number" min="0" step="100" placeholder="Ceiling" disabled />
        </div>
      </div>
      <div class="shape-popup__field pp-corners-field">
        <label>Corners</label>
        <div class="pp-coord-wrap">
          <table class="pp-coord-table">
            <tbody class="pp-coord-tbody"></tbody>
          </table>
        </div>
      </div>
      <div class="shape-popup__actions">
        <button class="sp-done sp-btn sp-btn--primary">Done</button>
        <button class="sp-cancel sp-btn">Cancel</button>
      </div>
    `;
  }

  _bindStaticEvents() {
    this._nameInput.addEventListener('change', () => {
      if (!this._currentId) return;
      this._shapeManager.updateShape(this._currentId, {
        name: this._nameInput.value.trim() || `Polygon ${this._currentId}`,
      });
    });

    this._descInput.addEventListener('change', () => {
      if (!this._currentId) return;
      this._shapeManager.updateShape(this._currentId, { description: this._descInput.value.trim() });
    });

    this._altEnabledCb.addEventListener('change', () => {
      this._syncAltDisabled();
      if (!this._currentId) return;
      this._shapeManager.updateShape(this._currentId, { altEnabled: this._altEnabledCb.checked });
    });

    this._altFloorInput.addEventListener('change', () => {
      if (!this._currentId) return;
      const val = this._altFloorInput.value !== '' ? parseFloat(this._altFloorInput.value) : null;
      this._shapeManager.updateShape(this._currentId, { altFloor: val });
    });

    this._altCeilingInput.addEventListener('change', () => {
      if (!this._currentId) return;
      const val = this._altCeilingInput.value !== '' ? parseFloat(this._altCeilingInput.value) : null;
      this._shapeManager.updateShape(this._currentId, { altCeiling: val });
    });

    this._el.querySelectorAll('.color-swatch').forEach((btn) => {
      btn.addEventListener('click', () => {
        this._selectColor(btn.dataset.hex);
        if (this._currentId) this._shapeManager.updateShape(this._currentId, { color: btn.dataset.hex });
      });
    });

    this._transparencyInput.addEventListener('input', () => {
      const pct = parseInt(this._transparencyInput.value, 10);
      this._transparencyLabel.textContent = `${pct}% transparent`;
      if (this._currentId) this._shapeManager.updateShape(this._currentId, { opacity: (100 - pct) / 100 });
    });

    this._el.querySelector('.sp-done').addEventListener('click', () => {
      if (this._isPre || !this._currentId) {
        this._polygonTool?.cancelPlacement();
        this.close();
        return;
      }
      this._shapeManager.updateShape(this._currentId, {
        name: this._nameInput.value.trim() || `Polygon ${this._currentId}`,
      });
      if (this._isNew) this._polygonTool?.resetToIdle();
      this.close();
    });

    this._el.querySelector('.sp-cancel').addEventListener('click', () => {
      if (this._isNew) this._polygonTool?.cancelPlacement();
      this.close();
    });
  }

  _refreshTable() {
    if (!this._coordTbody || !this._currentId) return;
    const rec = this._shapeManager.shapes.find((s) => s.id === this._currentId);
    if (!rec) return;

    this._coordTbody.innerHTML = '';

    rec.latlngs.forEach((ll, i) => {
      const tr = document.createElement('tr');
      tr.className = 'pp-coord-row';

      const numTd = document.createElement('td');
      numTd.className = 'pp-coord-num';
      numTd.textContent = i + 1;

      const inputTd = document.createElement('td');
      inputTd.className = 'pp-coord-input-cell';
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'pp-coord-input sp-input';
      input.value = this._fmt(ll.lat, ll.lng);
      input.autocomplete = 'off';
      input.addEventListener('blur', () => {
        if (!this._currentId) return;
        const cur = this._shapeManager.shapes.find((s) => s.id === this._currentId);
        if (!cur) return;
        const parsed = this._coordinateParser?.parseToLatLng(input.value);
        if (parsed) {
          const newLatlngs = [...cur.latlngs];
          newLatlngs[i] = { lat: parsed.lat, lng: parsed.lng };
          this._shapeManager.updateShape(this._currentId, { latlngs: newLatlngs });
          input.value = this._fmt(parsed.lat, parsed.lng);
          this._cornerMarkers[i]?.setLatLng([parsed.lat, parsed.lng]);
        } else {
          input.value = this._fmt(cur.latlngs[i].lat, cur.latlngs[i].lng);
        }
      });
      inputTd.appendChild(input);

      const minusTd = document.createElement('td');
      minusTd.className = 'pp-coord-minus-cell';
      const minusBtn = document.createElement('button');
      minusBtn.className = 'pp-corner-minus';
      minusBtn.title = 'Remove corner';
      minusBtn.innerHTML = '&minus;';
      minusBtn.addEventListener('click', () => {
        if (!this._currentId) return;
        const cur = this._shapeManager.shapes.find((s) => s.id === this._currentId);
        if (!cur) return;
        const newLatlngs = cur.latlngs.filter((_, idx) => idx !== i);
        if (newLatlngs.length < 3) {
          if (this._isNew) {
            this._polygonTool?.cancelPlacement();
          } else {
            this._shapeManager.removeShape(this._currentId);
          }
          this.close();
        } else {
          this._shapeManager.updateShape(this._currentId, { latlngs: newLatlngs });
          this._refreshTable();
          this._refreshMarkers();
        }
      });
      minusTd.appendChild(minusBtn);

      tr.appendChild(numTd);
      tr.appendChild(inputTd);
      tr.appendChild(minusTd);
      this._coordTbody.appendChild(tr);
    });
  }

  _syncAltDisabled() {
    const enabled = this._altEnabledCb?.checked ?? false;
    const fields = this._el?.querySelector('.sp-alt-fields');
    if (!fields) return;
    fields.classList.toggle('sp-alt-fields--disabled', !enabled);
    this._altFloorInput.disabled = !enabled;
    this._altCeilingInput.disabled = !enabled;
  }

  _refreshMarkers() {
    this._destroyMarkers();
    const rec = this._shapeManager.shapes.find((s) => s.id === this._currentId);
    if (!rec || !this._map) return;

    this._cornerMarkers = rec.latlngs.map((ll, i) => {
      const marker = L.marker([ll.lat, ll.lng], {
        icon: L.divIcon({
          className: 'center-marker',
          html: '<div class="center-marker__dot"></div>',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        }),
        draggable: true,
        zIndexOffset: 1000,
      }).addTo(this._map);

      marker.on('drag', (e) => {
        const { lat, lng } = e.latlng;
        const cur = this._shapeManager.shapes.find((s) => s.id === this._currentId);
        if (!cur) return;
        const newLatlngs = [...cur.latlngs];
        newLatlngs[i] = { lat, lng };
        this._shapeManager.updateShape(this._currentId, { latlngs: newLatlngs });
        const inputs = this._coordTbody?.querySelectorAll('.pp-coord-input');
        if (inputs?.[i]) inputs[i].value = this._fmt(lat, lng);
      });

      return marker;
    });
  }

  _destroyMarkers() {
    this._cornerMarkers.forEach((m) => m.remove());
    this._cornerMarkers = [];
  }

  _selectColor(hex) {
    this._selectedColor = hex;
    if (!this._el) return;
    this._el.querySelectorAll('.color-swatch').forEach((btn) => {
      btn.classList.toggle('color-swatch--selected', btn.dataset.hex === hex);
    });
  }

  _fmt(lat, lng) {
    if (!this._coordinateService) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const fmt = this._coordinateService.getCurrentFormat();
    return `${fmt}: ${this._coordinateService.formatCoordinate(lat, lng, fmt)}`;
  }
}
