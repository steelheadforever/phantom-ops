/**
 * ShapePopup — floating upper-right popup for circle placement and editing.
 *
 * Pre-placement (openPre): name/color/transparency active; location/radius disabled.
 * After placement (attachShape): all fields active; draggable center marker on map.
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

const CENTER_MARKER_ICON = L.divIcon({
  className: 'center-marker',
  html: '<div class="center-marker__dot"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

export class ShapePopup {
  constructor({ shapeManager, coordinateService, coordinateParser, circleTool, map }) {
    this._shapeManager = shapeManager;
    this._coordinateService = coordinateService;
    this._coordinateParser = coordinateParser;
    this._circleTool = circleTool;
    this._map = map;

    this._el = null;
    this._currentId = null;
    this._isNew = false;
    this._isPre = false;          // true = pre-placement, no shape yet
    this._selectedColor = '#4da6ff';
    this._centerMarker = null;

    this._titleEl = null;
    this._nameInput = null;
    this._descInput = null;
    this._locationInput = null;
    this._radiusInput = null;
    this._transparencyInput = null;
    this._transparencyLabel = null;
    this._altEnabledCb = null;
    this._altFloorInput = null;
    this._altCeilingInput = null;
  }

  mount(root = document.body) {
    const el = document.createElement('div');
    el.className = 'shape-popup';
    el.style.display = 'none';
    el.innerHTML = this._template();
    root.appendChild(el);
    this._el = el;

    this._titleEl = el.querySelector('.shape-popup__title');
    this._nameInput = el.querySelector('.sp-name');
    this._descInput = el.querySelector('.sp-description');
    this._locationInput = el.querySelector('.sp-location');
    this._radiusInput = el.querySelector('.sp-radius');
    this._transparencyInput = el.querySelector('.sp-transparency');
    this._transparencyLabel = el.querySelector('.sp-transparency-label');
    this._altEnabledCb = el.querySelector('.sp-alt-enabled');
    this._altFloorInput = el.querySelector('.sp-alt-floor');
    this._altCeilingInput = el.querySelector('.sp-alt-ceiling');

    this._bindEvents();

    // Re-format location field when coordinate format changes
    this._coordinateService?.onFormatChange(() => {
      if (!this._currentId || this._isPre) return;
      const rec = this._shapeManager.shapes.find((s) => s.id === this._currentId);
      if (rec) this._locationInput.value = this._formatCenter(rec.centerLat, rec.centerLng);
    });

    return this;
  }

  /** Show popup in pre-placement mode — before the circle is drawn. */
  openPre() {
    this._destroyCenterMarker();
    this._currentId = null;
    this._isNew = true;
    this._isPre = true;

    this._titleEl.textContent = 'New Circle';
    this._nameInput.value = '';
    this._descInput.value = '';
    this._locationInput.value = '— place center —';
    this._locationInput.disabled = true;
    this._radiusInput.value = '';
    this._radiusInput.disabled = true;
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
   * Called by CircleDrawTool after the circle is placed — transitions from
   * pre-placement to active editing.
   */
  attachShape(shapeId) {
    const rec = this._shapeManager.shapes.find((s) => s.id === shapeId);
    if (!rec) return;
    this._currentId = shapeId;
    this._isPre = false;
    this._locationInput.value = this._formatCenter(rec.centerLat, rec.centerLng);
    this._locationInput.disabled = false;
    this._radiusInput.value = rec.radiusNm.toFixed(2);
    this._radiusInput.disabled = false;
    this._createCenterMarker(rec);
  }

  /**
   * Open popup for an existing shape (edit mode, not new).
   * @param {string} shapeId
   * @param {{ isNew?: boolean }} opts
   */
  open(shapeId, { isNew = false } = {}) {
    const rec = this._shapeManager.shapes.find((s) => s.id === shapeId);
    if (!rec) return;

    this._destroyCenterMarker();
    this._currentId = shapeId;
    this._isNew = isNew;
    this._isPre = false;

    this._titleEl.textContent = isNew ? 'New Circle' : rec.name;
    this._nameInput.value = rec.name;
    this._descInput.value = rec.description ?? '';
    this._locationInput.value = this._formatCenter(rec.centerLat, rec.centerLng);
    this._locationInput.disabled = false;
    this._radiusInput.value = rec.radiusNm.toFixed(2);
    this._radiusInput.disabled = false;

    const pct = Math.round((1 - rec.opacity) * 100);
    this._transparencyInput.value = pct;
    this._transparencyLabel.textContent = `${pct}% transparent`;
    this._selectColor(rec.color);

    this._altEnabledCb.checked = rec.altEnabled ?? false;
    this._altFloorInput.value = rec.altFloor ?? '';
    this._altCeilingInput.value = rec.altCeiling ?? '';
    this._syncAltDisabled();

    this._el.style.display = 'block';
    this._createCenterMarker(rec);
  }

  close() {
    this._destroyCenterMarker();
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
      <div class="shape-popup__title">Circle</div>
      <div class="shape-popup__field">
        <label>Name</label>
        <input class="sp-name sp-input" type="text" autocomplete="off" />
      </div>
      <div class="shape-popup__field">
        <label>Description</label>
        <textarea class="sp-description sp-input" rows="2" maxlength="200" autocomplete="off"></textarea>
      </div>
      <div class="shape-popup__field">
        <label>Location</label>
        <input class="sp-location sp-input" type="text" autocomplete="off" />
      </div>
      <div class="shape-popup__field">
        <label>Radius (nm)</label>
        <input class="sp-radius sp-input" type="number" min="0.01" step="0.01" />
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
      <div class="shape-popup__actions">
        <button class="sp-done sp-btn sp-btn--primary">Done</button>
        <button class="sp-cancel sp-btn">Cancel</button>
      </div>
    `;
  }

  _bindEvents() {
    this._nameInput.addEventListener('change', () => {
      if (!this._currentId) return;
      this._shapeManager.updateShape(this._currentId, { name: this._nameInput.value.trim() || `Circle ${this._currentId}` });
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

    this._locationInput.addEventListener('blur', () => {
      if (!this._currentId) return;
      const parsed = this._coordinateParser?.parseToLatLng(this._locationInput.value);
      if (parsed) {
        this._shapeManager.updateShape(this._currentId, { centerLat: parsed.lat, centerLng: parsed.lng });
        this._locationInput.value = this._formatCenter(parsed.lat, parsed.lng);
        this._centerMarker?.setLatLng([parsed.lat, parsed.lng]);
      } else {
        const rec = this._shapeManager.shapes.find((s) => s.id === this._currentId);
        if (rec) this._locationInput.value = this._formatCenter(rec.centerLat, rec.centerLng);
      }
    });

    this._radiusInput.addEventListener('input', () => {
      if (!this._currentId) return;
      const val = parseFloat(this._radiusInput.value);
      if (val > 0) this._shapeManager.updateShape(this._currentId, { radiusNm: val });
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
        this._circleTool?.cancelPlacement();
        this.close();
        return;
      }
      this._shapeManager.updateShape(this._currentId, { name: this._nameInput.value.trim() || `Circle ${this._currentId}` });
      if (this._isNew) this._circleTool?.resetToIdle();
      this.close();
    });

    this._el.querySelector('.sp-cancel').addEventListener('click', () => {
      if (this._isNew) this._circleTool?.cancelPlacement();
      this.close();
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

  _createCenterMarker(rec) {
    if (!this._map) return;
    this._centerMarker = L.marker([rec.centerLat, rec.centerLng], {
      icon: CENTER_MARKER_ICON,
      draggable: true,
      zIndexOffset: 1000,
    }).addTo(this._map);

    this._centerMarker.on('drag', (e) => {
      if (!this._currentId) return;
      const { lat, lng } = e.latlng;
      this._shapeManager.updateShape(this._currentId, { centerLat: lat, centerLng: lng });
      this._locationInput.value = this._formatCenter(lat, lng);
    });
  }

  _destroyCenterMarker() {
    this._centerMarker?.remove();
    this._centerMarker = null;
  }

  _selectColor(hex) {
    this._selectedColor = hex;
    if (!this._el) return;
    this._el.querySelectorAll('.color-swatch').forEach((btn) => {
      btn.classList.toggle('color-swatch--selected', btn.dataset.hex === hex);
    });
  }

  _formatCenter(lat, lng) {
    if (!this._coordinateService) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const fmt = this._coordinateService.getCurrentFormat();
    return `${fmt}: ${this._coordinateService.formatCoordinate(lat, lng, fmt)}`;
  }
}
