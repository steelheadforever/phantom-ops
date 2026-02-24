/**
 * ShapePopup — floating upper-right popup shown after a circle is placed or when editing.
 * Allows naming, coordinate editing, radius, color, and transparency changes.
 * While open, a draggable center marker appears on the map.
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
    this._isNew = false;       // true = initial placement, false = editing existing
    this._centerMarker = null; // draggable L.Marker while popup is open

    // Field refs
    this._titleEl = null;
    this._nameInput = null;
    this._locationInput = null;
    this._radiusInput = null;
    this._transparencyInput = null;
    this._transparencyLabel = null;
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
    this._locationInput = el.querySelector('.sp-location');
    this._radiusInput = el.querySelector('.sp-radius');
    this._transparencyInput = el.querySelector('.sp-transparency');
    this._transparencyLabel = el.querySelector('.sp-transparency-label');

    this._bindEvents();
    return this;
  }

  /**
   * Open the popup for a shape.
   * @param {string} shapeId
   * @param {{ isNew?: boolean }} opts  isNew=true means initial placement (Cancel removes shape)
   */
  open(shapeId, { isNew = false } = {}) {
    const rec = this._shapeManager.shapes.find((s) => s.id === shapeId);
    if (!rec) return;

    // Close any existing state cleanly first (without removing the shape)
    this._destroyCenterMarker();

    this._currentId = shapeId;
    this._isNew = isNew;

    // Title
    this._titleEl.textContent = isNew ? 'New Circle' : rec.name;

    // Populate fields from record
    this._nameInput.value = rec.name;
    this._locationInput.value = this._formatCenter(rec.centerLat, rec.centerLng);
    this._radiusInput.value = rec.radiusNm.toFixed(2);

    // Transparency: fillOpacity 0.26 → 74% transparent slider value 74
    const pct = Math.round((1 - rec.opacity) * 100);
    this._transparencyInput.value = pct;
    this._transparencyLabel.textContent = `${pct}% transparent`;

    // Colour swatches
    this._selectColor(rec.color);

    this._el.style.display = 'block';

    // Place draggable center marker
    this._createCenterMarker(rec);
  }

  close() {
    this._destroyCenterMarker();
    this._el.style.display = 'none';
    this._currentId = null;
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
      <div class="shape-popup__actions">
        <button class="sp-done sp-btn sp-btn--primary">Done</button>
        <button class="sp-cancel sp-btn">Cancel</button>
      </div>
    `;
  }

  _bindEvents() {
    // Name — update on change
    this._nameInput.addEventListener('change', () => {
      if (!this._currentId) return;
      this._shapeManager.updateShape(this._currentId, { name: this._nameInput.value.trim() || `Circle ${this._currentId}` });
    });

    // Location — validate on blur, revert if invalid
    this._locationInput.addEventListener('blur', () => {
      if (!this._currentId) return;
      const parsed = this._coordinateParser?.parseToLatLng(this._locationInput.value);
      if (parsed) {
        this._shapeManager.updateShape(this._currentId, {
          centerLat: parsed.lat,
          centerLng: parsed.lng,
        });
        this._locationInput.value = this._formatCenter(parsed.lat, parsed.lng);
        // Move the center marker to match
        this._centerMarker?.setLatLng([parsed.lat, parsed.lng]);
      } else {
        // Revert
        const rec = this._shapeManager.shapes.find((s) => s.id === this._currentId);
        if (rec) this._locationInput.value = this._formatCenter(rec.centerLat, rec.centerLng);
      }
    });

    // Radius — live update
    this._radiusInput.addEventListener('input', () => {
      if (!this._currentId) return;
      const val = parseFloat(this._radiusInput.value);
      if (val > 0) {
        this._shapeManager.updateShape(this._currentId, { radiusNm: val });
      }
    });

    // Color swatches
    this._el.querySelectorAll('.color-swatch').forEach((btn) => {
      btn.addEventListener('click', () => {
        const hex = btn.dataset.hex;
        this._selectColor(hex);
        if (this._currentId) {
          this._shapeManager.updateShape(this._currentId, { color: hex });
        }
      });
    });

    // Transparency slider
    this._transparencyInput.addEventListener('input', () => {
      if (!this._currentId) return;
      const pct = parseInt(this._transparencyInput.value, 10);
      this._transparencyLabel.textContent = `${pct}% transparent`;
      const opacity = (100 - pct) / 100;
      this._shapeManager.updateShape(this._currentId, { opacity });
    });

    // Done
    this._el.querySelector('.sp-done').addEventListener('click', () => {
      if (this._currentId) {
        this._shapeManager.updateShape(this._currentId, {
          name: this._nameInput.value.trim() || `Circle ${this._currentId}`,
        });
      }
      if (this._isNew) {
        this._circleTool?.resetToIdle();
      }
      this.close();
    });

    // Cancel
    this._el.querySelector('.sp-cancel').addEventListener('click', () => {
      if (this._isNew) {
        // New placement: remove the shape entirely
        this._circleTool?.cancelPlacement();
      }
      this.close();
    });
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
      // Update location field live while dragging
      this._locationInput.value = this._formatCenter(lat, lng);
    });
  }

  _destroyCenterMarker() {
    if (this._centerMarker) {
      this._centerMarker.remove();
      this._centerMarker = null;
    }
  }

  _selectColor(hex) {
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
