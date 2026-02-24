/**
 * PointPopup — floating upper-right popup for point placement and editing.
 *
 * Pre-placement: name, symbol, color, transparency active; location disabled.
 * After placement: location field populated and editable.
 */

import { POINT_SYMBOLS } from '../../services/drawing/pointSymbols.js';

const TACTICAL_COLORS = [
  { label: 'Red',    hex: '#e63946' },
  { label: 'Orange', hex: '#f4a261' },
  { label: 'Yellow', hex: '#f5a800' },
  { label: 'Green',  hex: '#2dc653' },
  { label: 'Blue',   hex: '#4da6ff' },
  { label: 'White',  hex: '#ffffff' },
  { label: 'Black',  hex: '#1a1a1a' },
];

export class PointPopup {
  constructor({ shapeManager, coordinateService, coordinateParser, pointTool, map }) {
    this._shapeManager = shapeManager;
    this._coordinateService = coordinateService;
    this._coordinateParser = coordinateParser;
    this._pointTool = pointTool;  // may be null — set via late binding
    this._map = map;

    this._el = null;
    this._currentId = null;
    this._isNew = false;
    this._isPre = false;        // true = pre-placement (no shape yet)
    this._selectedColor = '#4da6ff';

    // Field refs
    this._titleEl = null;
    this._nameInput = null;
    this._labelEyeBtn = null;
    this._locationInput = null;
    this._symbolSelect = null;
    this._transparencyInput = null;
    this._transparencyLabel = null;
  }

  mount(root = document.body) {
    const el = document.createElement('div');
    el.className = 'shape-popup point-popup';
    el.style.display = 'none';
    el.innerHTML = this._template();
    root.appendChild(el);
    this._el = el;

    this._titleEl = el.querySelector('.shape-popup__title');
    this._nameInput = el.querySelector('.sp-name');
    this._labelEyeBtn = el.querySelector('.lp-label-eye');
    this._locationInput = el.querySelector('.sp-location');
    this._symbolSelect = el.querySelector('.lp-dash-select');
    this._transparencyInput = el.querySelector('.sp-transparency');
    this._transparencyLabel = el.querySelector('.sp-transparency-label');

    this._bindStaticEvents();

    // Refresh location field when coordinate format changes
    this._coordinateService?.onFormatChange(() => {
      if (!this._currentId || this._isPre) return;
      const rec = this._shapeManager.shapes.find((s) => s.id === this._currentId);
      if (rec) this._locationInput.value = this._fmt(rec.lat, rec.lng);
    });

    return this;
  }

  /** Show popup in pre-placement mode (no shape placed yet). */
  openPre() {
    this._currentId = null;
    this._isNew = true;
    this._isPre = true;

    this._titleEl.textContent = 'New Point';
    this._nameInput.value = '';
    this._locationInput.value = '— click map —';
    this._locationInput.disabled = true;
    this._symbolSelect.value = 'waypoint';
    this._selectColor('#4da6ff');
    this._updateLabelEye(false);
    const pct = Math.round((1 - (this._shapeManager.lastOpacity ?? 0.26)) * 100);
    this._transparencyInput.value = pct;
    this._transparencyLabel.textContent = `${pct}% transparent`;
    this._el.style.display = 'block';
  }

  /**
   * Open popup for an existing shape (edit mode).
   * @param {string} shapeId
   * @param {{ isNew?: boolean }} opts
   */
  open(shapeId, { isNew = false } = {}) {
    const rec = this._shapeManager.shapes.find((s) => s.id === shapeId);
    if (!rec) return;

    this._currentId = shapeId;
    this._isNew = isNew;
    this._isPre = false;

    this._titleEl.textContent = isNew ? 'New Point' : rec.name;
    this._nameInput.value = rec.name;
    this._locationInput.value = this._fmt(rec.lat, rec.lng);
    this._locationInput.disabled = false;
    this._symbolSelect.value = rec.symbol ?? 'waypoint';
    this._selectColor(rec.color);
    this._updateLabelEye(rec.showLabel ?? false);

    const pct = Math.round((1 - rec.opacity) * 100);
    this._transparencyInput.value = pct;
    this._transparencyLabel.textContent = `${pct}% transparent`;
    this._el.style.display = 'block';
  }

  /** Called by PointDrawTool after the point is placed. */
  attachShape(shapeId) {
    const rec = this._shapeManager.shapes.find((s) => s.id === shapeId);
    if (!rec) return;
    this._currentId = shapeId;
    this._isPre = false;
    this._locationInput.value = this._fmt(rec.lat, rec.lng);
    this._locationInput.disabled = false;
    this._updateLabelEye(rec.showLabel ?? false);
  }

  close() {
    this._el.style.display = 'none';
    this._currentId = null;
    this._isPre = false;
  }

  /** Returns the current popup field values for use before a shape is created. */
  getPendingConfig() {
    const pct = parseInt(this._transparencyInput?.value ?? '74', 10);
    return {
      name:    this._nameInput?.value.trim() || null,
      symbol:  this._symbolSelect?.value ?? 'waypoint',
      color:   this._selectedColor,
      opacity: (100 - pct) / 100,
    };
  }

  // ─── private ────────────────────────────────────────────────────────────

  _template() {
    const swatchHtml = TACTICAL_COLORS.map((c) =>
      `<button class="color-swatch" data-hex="${c.hex}" title="${c.label}"
        style="background:${c.hex};" aria-label="${c.label}"></button>`
    ).join('');

    const symbolHtml = POINT_SYMBOLS.map((s) =>
      `<option value="${s.value}">${s.label}</option>`
    ).join('');

    return `
      <div class="shape-popup__title">Point</div>

      <div class="shape-popup__field">
        <label>Name</label>
        <div class="lp-name-row">
          <input class="sp-name sp-input" type="text" autocomplete="off" />
          <button class="lp-label-eye" title="Show name on map">
            ${this._eyeClosedSvg()}
          </button>
        </div>
      </div>

      <div class="shape-popup__field">
        <label>Location</label>
        <input class="sp-location sp-input" type="text" autocomplete="off" />
      </div>

      <div class="shape-popup__field">
        <label>Symbol</label>
        <select class="lp-dash-select sp-input">${symbolHtml}</select>
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

      <div class="shape-popup__actions">
        <button class="sp-done sp-btn sp-btn--primary">Done</button>
        <button class="sp-cancel sp-btn">Cancel</button>
      </div>
    `;
  }

  _bindStaticEvents() {
    // Name
    this._nameInput.addEventListener('change', () => {
      if (!this._currentId) return;
      const name = this._nameInput.value.trim() || `Point ${this._currentId}`;
      this._shapeManager.updateShape(this._currentId, { name });
    });

    // Location — validate on blur
    this._locationInput.addEventListener('blur', () => {
      if (!this._currentId) return;
      const parsed = this._coordinateParser?.parseToLatLng(this._locationInput.value);
      if (parsed) {
        this._shapeManager.updateShape(this._currentId, { lat: parsed.lat, lng: parsed.lng });
        this._locationInput.value = this._fmt(parsed.lat, parsed.lng);
      } else {
        const rec = this._shapeManager.shapes.find((s) => s.id === this._currentId);
        if (rec) this._locationInput.value = this._fmt(rec.lat, rec.lng);
      }
    });

    // Symbol select
    this._symbolSelect.addEventListener('change', () => {
      if (!this._currentId) return;
      this._shapeManager.updateShape(this._currentId, { symbol: this._symbolSelect.value });
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

    // Transparency
    this._transparencyInput.addEventListener('input', () => {
      const pct = parseInt(this._transparencyInput.value, 10);
      this._transparencyLabel.textContent = `${pct}% transparent`;
      if (this._currentId) {
        this._shapeManager.updateShape(this._currentId, { opacity: (100 - pct) / 100 });
      }
    });

    // Done
    this._el.querySelector('.sp-done').addEventListener('click', () => {
      if (this._isPre || !this._currentId) {
        // Nothing placed yet — treat as cancel
        this._pointTool?.cancelPlacement();
        this.close();
        return;
      }
      const name = this._nameInput.value.trim() || `Point ${this._currentId}`;
      this._shapeManager.updateShape(this._currentId, { name });
      if (this._isNew) this._pointTool?.resetToIdle();
      this.close();
    });

    // Cancel
    this._el.querySelector('.sp-cancel').addEventListener('click', () => {
      if (this._isNew) {
        this._pointTool?.cancelPlacement();
      }
      this.close();
    });
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

  _updateLabelEye(showLabel) {
    if (!this._labelEyeBtn) return;
    this._labelEyeBtn.classList.toggle('lp-label-eye--active', showLabel);
    this._labelEyeBtn.innerHTML = showLabel ? this._eyeOpenSvg() : this._eyeClosedSvg();
    this._labelEyeBtn.title = showLabel ? 'Hide name on map' : 'Show name on map';
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
