/**
 * LinePopup — floating upper-right popup for line placement and editing.
 *
 * Fields: name + label-eyeball, color, transparency, dash pattern,
 *         editable point coordinate table, Place toggle, Done/Cancel.
 *
 * While open (editing mode): draggable point markers appear on the map.
 * While open (new placement): point markers are owned by LineDrawTool.
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

const DASH_OPTIONS = [
  { value: 'solid',    label: 'Solid' },
  { value: 'dashed',   label: 'Dashed' },
  { value: 'dotted',   label: 'Dotted' },
  { value: 'dash-dot', label: 'Dash-Dot' },
];

export class LinePopup {
  constructor({ shapeManager, coordinateService, coordinateParser, lineTool, map }) {
    this._shapeManager = shapeManager;
    this._coordinateService = coordinateService;
    this._coordinateParser = coordinateParser;
    this._lineTool = lineTool;  // may be null initially — set via late binding
    this._map = map;

    this._el = null;
    this._currentId = null;
    this._isNew = false;
    this._isPre = false;
    this._placingEnabled = false;
    this._selectedColor = '#4da6ff';
    this._pointMarkers = [];     // draggable markers (edit mode only)

    // Field refs
    this._titleEl = null;
    this._nameInput = null;
    this._descInput = null;
    this._labelEyeBtn = null;
    this._transparencyInput = null;
    this._transparencyLabel = null;
    this._dashSelect = null;
    this._coordTbody = null;
    this._placeBtn = null;
    this._altEnabledCb = null;
    this._altInput = null;
  }

  mount(root = document.body) {
    const el = document.createElement('div');
    el.className = 'shape-popup line-popup';
    el.style.display = 'none';
    el.innerHTML = this._template();
    root.appendChild(el);
    this._el = el;

    this._titleEl = el.querySelector('.shape-popup__title');
    this._nameInput = el.querySelector('.sp-name');
    this._descInput = el.querySelector('.sp-description');
    this._labelEyeBtn = el.querySelector('.lp-label-eye');
    this._transparencyInput = el.querySelector('.sp-transparency');
    this._transparencyLabel = el.querySelector('.sp-transparency-label');
    this._dashSelect = el.querySelector('.lp-dash-select');
    this._coordTbody = el.querySelector('.lp-coord-tbody');
    this._placeBtn = el.querySelector('.lp-place-btn');
    this._altEnabledCb = el.querySelector('.sp-alt-enabled');
    this._altInput = el.querySelector('.sp-alt');

    this._bindStaticEvents();

    // Re-format coordinate table when format changes
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
    this._placingEnabled = true;

    this._titleEl.textContent = 'New Line';
    this._nameInput.value = '';
    this._descInput.value = '';
    this._updateLabelEye(false);
    this._selectColor('#4da6ff');
    this._dashSelect.value = 'solid';
    const pct = Math.round((1 - (this._shapeManager.lastOpacity ?? 0.26)) * 100);
    this._transparencyInput.value = 0;
    this._transparencyLabel.textContent = '0% transparent';
    this._coordTbody.innerHTML = '<tr><td colspan="3" class="pp-pre-label">— click map to place points —</td></tr>';
    this._altEnabledCb.checked = false;
    this._altInput.value = '';
    this._syncAltDisabled();
    this._updatePlaceBtn();
    this._el.style.display = 'block';
  }

  /**
   * Called by LineDrawTool after the first point is placed.
   * Transitions from pre-placement to active editing.
   */
  attachShape(shapeId) {
    const rec = this._shapeManager.shapes.find((s) => s.id === shapeId);
    if (!rec) return;
    this._currentId = shapeId;
    this._isPre = false;
    // Apply any values already set in pre-placement
    const name = this._nameInput.value.trim();
    const pct = parseInt(this._transparencyInput.value, 10);
    this._shapeManager.updateShape(shapeId, {
      ...(name ? { name } : {}),
      color: this._selectedColor,
      opacity: (100 - pct) / 100,
      dash: this._dashSelect.value,
    });
    this._refreshTable();
  }

  /** Returns field values for use when creating the shape. */
  getPendingConfig() {
    const pct = parseInt(this._transparencyInput?.value ?? '0', 10);
    return {
      name:        this._nameInput?.value.trim() || null,
      description: this._descInput?.value.trim() || '',
      color:       this._selectedColor,
      opacity:     (100 - pct) / 100,
      dash:        this._dashSelect?.value ?? 'solid',
      altEnabled:  this._altEnabledCb?.checked ?? false,
      alt:         this._altInput?.value !== '' ? parseFloat(this._altInput.value) : null,
    };
  }

  /**
   * Open popup for an existing shape.
   * @param {string} shapeId
   * @param {{ isNew?: boolean }} opts
   */
  open(shapeId, { isNew = false } = {}) {
    const rec = this._shapeManager.shapes.find((s) => s.id === shapeId);
    if (!rec) return;

    this._destroyMarkers();
    this._currentId = shapeId;
    this._isNew = isNew;
    this._isPre = false;
    this._placingEnabled = false;  // edit mode: placing off by default

    this._titleEl.textContent = isNew ? 'New Line' : rec.name;
    this._nameInput.value = rec.name;
    this._descInput.value = rec.description ?? '';
    this._updateLabelEye(rec.showLabel ?? false);

    const pct = Math.round((1 - rec.opacity) * 100);
    this._transparencyInput.value = pct;
    this._transparencyLabel.textContent = `${pct}% transparent`;

    this._selectColor(rec.color);
    this._dashSelect.value = rec.dash ?? 'solid';

    this._altEnabledCb.checked = rec.altEnabled ?? false;
    this._altInput.value = rec.alt ?? '';
    this._syncAltDisabled();

    this._refreshTable();
    this._updatePlaceBtn();
    this._el.style.display = 'block';

    // In edit mode (not new), show draggable point markers
    if (!isNew) {
      this._refreshMarkers();
    }
  }

  close() {
    this._destroyMarkers();
    this._el.style.display = 'none';
    this._currentId = null;
    this._isPre = false;
  }

  /** Called by LineDrawTool after each new point is added during placement. */
  refreshPointTable() {
    this._refreshTable();
  }

  /**
   * Called by LineDrawTool when right-click stops placing.
   * Updates the Place button to show "OFF".
   */
  setPlacing(bool) {
    this._placingEnabled = bool;
    this._updatePlaceBtn();
  }

  // ─── private ────────────────────────────────────────────────────────────

  _template() {
    const swatchHtml = TACTICAL_COLORS.map((c) =>
      `<button class="color-swatch" data-hex="${c.hex}" title="${c.label}"
        style="background:${c.hex};" aria-label="${c.label}"></button>`
    ).join('');

    const dashHtml = DASH_OPTIONS.map((d) =>
      `<option value="${d.value}">${d.label}</option>`
    ).join('');

    return `
      <div class="shape-popup__title">Line</div>

      <div class="shape-popup__field">
        <label>Name</label>
        <div class="lp-name-row">
          <input class="sp-name sp-input" type="text" autocomplete="off" />
          <button class="lp-label-eye" title="Show name on line">
            ${this._eyeOpenSvg()}
          </button>
        </div>
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
          <span class="sp-transparency-label">0% transparent</span>
        </div>
      </div>

      <div class="shape-popup__field">
        <label>Dash</label>
        <select class="lp-dash-select sp-input">${dashHtml}</select>
      </div>

      <div class="shape-popup__field">
        <label class="sp-alt-header">
          <input type="checkbox" class="sp-alt-enabled" />
          Altitude (ft MSL)
        </label>
        <div class="sp-alt-fields sp-alt-fields--disabled">
          <input class="sp-alt sp-input" type="number" min="0" step="100" placeholder="e.g. 10000" disabled />
        </div>
      </div>

      <div class="shape-popup__field lp-points-field">
        <label>Points</label>
        <div class="pp-coord-wrap">
          <table class="pp-coord-table">
            <tbody class="lp-coord-tbody"></tbody>
          </table>
        </div>
      </div>

      <button class="lp-place-btn">PLACE: ON</button>

      <div class="shape-popup__actions">
        <button class="sp-done sp-btn sp-btn--primary">Done</button>
        <button class="sp-cancel sp-btn">Cancel</button>
      </div>
    `;
  }

  _bindStaticEvents() {
    // Name — update on change
    this._nameInput.addEventListener('change', () => {
      if (!this._currentId) return;
      const rec = this._shapeManager.shapes.find((s) => s.id === this._currentId);
      const name = this._nameInput.value.trim() || `Line ${this._currentId}`;
      this._shapeManager.updateShape(this._currentId, { name });
      if (!this._isNew) this._titleEl.textContent = name;
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

    this._altInput.addEventListener('change', () => {
      if (!this._currentId) return;
      const val = this._altInput.value !== '' ? parseFloat(this._altInput.value) : null;
      this._shapeManager.updateShape(this._currentId, { alt: val });
    });

    // Label eyeball toggle
    this._labelEyeBtn.addEventListener('click', () => {
      if (!this._currentId) return;
      const rec = this._shapeManager.shapes.find((s) => s.id === this._currentId);
      if (!rec) return;
      const next = !(rec.showLabel ?? false);
      this._shapeManager.updateShape(this._currentId, { showLabel: next });
      this._updateLabelEye(next);
    });

    // Color swatches
    this._el.querySelectorAll('.color-swatch').forEach((btn) => {
      btn.addEventListener('click', () => {
        this._selectColor(btn.dataset.hex);
        if (this._currentId) {
          this._shapeManager.updateShape(this._currentId, { color: btn.dataset.hex });
        }
      });
    });

    // Transparency slider
    this._transparencyInput.addEventListener('input', () => {
      if (!this._currentId) return;
      const pct = parseInt(this._transparencyInput.value, 10);
      this._transparencyLabel.textContent = `${pct}% transparent`;
      this._shapeManager.updateShape(this._currentId, { opacity: (100 - pct) / 100 });
    });

    // Dash select
    this._dashSelect.addEventListener('change', () => {
      if (!this._currentId) return;
      this._shapeManager.updateShape(this._currentId, { dash: this._dashSelect.value });
    });

    // Place toggle button
    this._placeBtn.addEventListener('click', () => {
      if (!this._currentId) return;
      const next = !this._placingEnabled;
      this._placingEnabled = next;
      this._updatePlaceBtn();
      this._lineTool?.setPlacing(next);
    });

    // Done
    this._el.querySelector('.sp-done').addEventListener('click', () => {
      if (this._isPre || !this._currentId) {
        this._lineTool?.cancelPlacement();
        this.close();
        return;
      }
      const name = this._nameInput.value.trim() || `Line ${this._currentId}`;
      this._shapeManager.updateShape(this._currentId, { name });
      if (this._isNew) this._lineTool?.resetToIdle();
      this.close();
    });

    // Cancel
    this._el.querySelector('.sp-cancel').addEventListener('click', () => {
      if (this._isNew) {
        this._lineTool?.cancelPlacement();
      }
      this.close();
    });
  }

  _refreshTable() {
    if (!this._coordTbody || !this._currentId) return;
    const rec = this._shapeManager.shapes.find((s) => s.id === this._currentId);
    if (!rec) return;

    this._coordTbody.innerHTML = '';

    (rec.latlngs ?? []).forEach((ll, i) => {
      const tr = document.createElement('tr');
      tr.className = 'pp-coord-row';

      // Point index
      const numTd = document.createElement('td');
      numTd.className = 'pp-coord-num';
      numTd.textContent = i + 1;

      // Coordinate input
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
          // Update draggable marker if in edit mode
          if (this._pointMarkers[i]) {
            this._pointMarkers[i].setLatLng([parsed.lat, parsed.lng]);
          }
        } else {
          // Revert to stored value
          input.value = this._fmt(cur.latlngs[i].lat, cur.latlngs[i].lng);
        }
      });
      inputTd.appendChild(input);

      // Minus button
      const minusTd = document.createElement('td');
      minusTd.className = 'pp-coord-minus-cell';
      const minusBtn = document.createElement('button');
      minusBtn.className = 'pp-corner-minus';
      minusBtn.title = 'Remove point';
      minusBtn.innerHTML = '&minus;';
      minusBtn.addEventListener('click', () => {
        if (!this._currentId) return;
        const cur = this._shapeManager.shapes.find((s) => s.id === this._currentId);
        if (!cur) return;
        const newLatlngs = cur.latlngs.filter((_, idx) => idx !== i);
        if (newLatlngs.length < 2) {
          // Line needs at least 2 points — remove shape
          if (this._isNew) {
            this._lineTool?.cancelPlacement();
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

  _refreshMarkers() {
    this._destroyMarkers();
    if (!this._map || !this._currentId) return;
    const rec = this._shapeManager.shapes.find((s) => s.id === this._currentId);
    if (!rec) return;

    this._pointMarkers = (rec.latlngs ?? []).map((ll, i) => {
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
    for (const m of this._pointMarkers) m.remove();
    this._pointMarkers = [];
  }

  _syncAltDisabled() {
    const enabled = this._altEnabledCb?.checked ?? false;
    const fields = this._el?.querySelector('.sp-alt-fields');
    if (!fields) return;
    fields.classList.toggle('sp-alt-fields--disabled', !enabled);
    this._altInput.disabled = !enabled;
  }

  _updatePlaceBtn() {
    if (!this._placeBtn) return;
    if (this._placingEnabled) {
      this._placeBtn.textContent = 'PLACE: ON';
      this._placeBtn.classList.add('lp-place-btn--on');
    } else {
      this._placeBtn.textContent = 'PLACE: OFF';
      this._placeBtn.classList.remove('lp-place-btn--on');
    }
  }

  _updateLabelEye(showLabel) {
    if (!this._labelEyeBtn) return;
    this._labelEyeBtn.classList.toggle('lp-label-eye--active', showLabel);
    this._labelEyeBtn.innerHTML = showLabel ? this._eyeOpenSvg() : this._eyeClosedSvg();
    this._labelEyeBtn.title = showLabel ? 'Hide name on line' : 'Show name on line';
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

  _eyeOpenSvg() {
    return `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 3C4.5 3 1.5 6 .5 8c1 2 4 5 7.5 5s6.5-3 7.5-5C14.5 6 11.5 3 8 3zm0 8a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm0-4.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
    </svg>`;
  }

  _eyeClosedSvg() {
    return `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M13.36 2.64 2.64 13.36l.7.7 1.4-1.4A7.9 7.9 0 0 0 8 13c3.5 0 6.5-3 7.5-5a8.5 8.5 0 0 0-1.5-2.64l1.07-1.07-.7-.65zM8 11a3 3 0 0 1-2.58-1.48l.83-.83A1.5 1.5 0 0 0 9.49 6.75l.83-.83A3 3 0 0 1 8 11zM.5 8C1.5 6 4.5 3 8 3c.96 0 1.88.2 2.73.53L9.2 5.06A3 3 0 0 0 5.06 9.2L3.35 10.9A8.8 8.8 0 0 1 .5 8z"/>
    </svg>`;
  }
}
