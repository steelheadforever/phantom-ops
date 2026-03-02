import { computeLegs, formatEte, computeToa } from '../../services/routes/RouteCalc.js';
import { searchPointByIdent } from '../../services/navaids/NavaidService.js';

function makeDraggable(el, handle) {
  if (document.body.classList.contains('is-touch')) return;
  handle.addEventListener('mousedown', (startEvt) => {
    startEvt.preventDefault();
    const rect = el.getBoundingClientRect();
    const offsetX = startEvt.clientX - rect.left;
    const offsetY = startEvt.clientY - rect.top;
    el.style.right = '';
    el.style.left = `${rect.left}px`;
    el.style.top = `${rect.top}px`;
    const onMove = (e) => {
      const x = Math.min(Math.max(0, e.clientX - offsetX), window.innerWidth - el.offsetWidth);
      const y = Math.min(Math.max(0, e.clientY - offsetY), window.innerHeight - el.offsetHeight);
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

/**
 * RoutePopup — draggable floating popup for flight route editing.
 *
 * Header: name, description, departure time, wind, KTAS, default altitude.
 * Waypoint table: one card per WP with coordinate, ident, altitude, computed leg data.
 * Totals row: total dist, ETE, TOA.
 * Footer: PLACE toggle, DONE, CANCEL.
 */
export class RoutePopup {
  constructor({ routeManager, coordinateService, coordinateParser, routeTool, map }) {
    this._routeManager = routeManager;
    this._coordinateService = coordinateService;
    this._coordinateParser = coordinateParser;
    this._routeTool = routeTool; // may be null — set via late binding
    this._map = map;

    this._el = null;
    this._currentId = null;
    this._isNew = false;
    this._isPre = false;
    this._placingEnabled = false;

    // Header field refs
    this._nameInput = null;
    this._descInput = null;
    this._departInput = null;
    this._windHdgInput = null;
    this._windSpdInput = null;
    this._ktasInput = null;
    this._altInput = null;
    this._wpContainer = null;
    this._totalsEl = null;
    this._placeBtn = null;
  }

  mount(root = document.body) {
    const el = document.createElement('div');
    el.className = 'shape-popup route-popup';
    el.style.display = 'none';
    el.innerHTML = this._template();
    root.appendChild(el);
    this._el = el;

    this._nameInput    = el.querySelector('.rp-name');
    this._descInput    = el.querySelector('.rp-desc');
    this._departInput  = el.querySelector('.rp-depart');
    this._windHdgInput = el.querySelector('.rp-wind-hdg');
    this._windSpdInput = el.querySelector('.rp-wind-spd');
    this._ktasInput    = el.querySelector('.rp-ktas');
    this._altInput     = el.querySelector('.rp-alt');
    this._wpContainer  = el.querySelector('.rp-wp-container');
    this._totalsEl     = el.querySelector('.rp-totals');
    this._placeBtn     = el.querySelector('.rp-place-btn');

    this._bindHeaderEvents();
    this._bindFooterEvents();

    makeDraggable(el, el.querySelector('.shape-popup__title'));

    this._coordinateService?.onFormatChange(() => {
      if (this._currentId && !this._isPre) this.refreshTable();
    });

    // Refresh table when any route changes (e.g. waypoint dragged on map)
    this._routeManager.onChange(() => {
      if (this._currentId && !this._isPre) this.refreshTable();
    });

    return this;
  }

  /** Open popup in pre-placement mode (before first click on map). */
  openNew() {
    this._currentId = null;
    this._isNew = true;
    this._isPre = true;
    this._placingEnabled = true;

    this._nameInput.value = '';
    this._descInput.value = '';
    this._departInput.value = '';
    this._windHdgInput.value = '';
    this._windSpdInput.value = '';
    this._ktasInput.value = '';
    this._altInput.value = '';
    this._wpContainer.innerHTML = '<div class="pp-pre-label">— click map to place waypoints —</div>';
    this._totalsEl.innerHTML = '';
    this._updatePlaceBtn();
    this._el.style.display = 'block';
  }

  /**
   * Returns config values from header fields (for use on first click).
   */
  getPendingConfig() {
    return {
      name: this._nameInput?.value.trim() || null,
      defaultKtas: this._ktasInput?.value ? parseFloat(this._ktasInput.value) : null,
      defaultWindHdg: this._windHdgInput?.value ? parseFloat(this._windHdgInput.value) : null,
      defaultWindSpd: this._windSpdInput?.value ? parseFloat(this._windSpdInput.value) : null,
      defaultAlt: this._altInput?.value ? parseFloat(this._altInput.value) : null,
      departureTime: this._departInput?.value.trim() || '',
    };
  }

  /**
   * Called by RouteDrawTool after first WP is placed.
   * Attaches to the created route and switches from pre to live mode.
   */
  attachRoute(routeId) {
    const rec = this._routeManager.routes.find((r) => r.id === routeId);
    if (!rec) return;
    this._currentId = routeId;
    this._isPre = false;

    // Flush any header values into the route record
    const pending = this.getPendingConfig();
    this._routeManager.updateRoute(routeId, {
      ...(pending.name ? { name: pending.name } : {}),
      defaultKtas: pending.defaultKtas,
      defaultWindHdg: pending.defaultWindHdg,
      defaultWindSpd: pending.defaultWindSpd,
      defaultAlt: pending.defaultAlt,
      departureTime: pending.departureTime,
    });

    this.refreshTable();
  }

  /**
   * Open popup for an existing route (from FlightRoutePanel Edit action).
   */
  open(routeId, { isNew = false } = {}) {
    const rec = this._routeManager.routes.find((r) => r.id === routeId);
    if (!rec) return;

    this._currentId = routeId;
    this._isNew = isNew;
    this._isPre = false;
    this._placingEnabled = false;

    this._nameInput.value = rec.name ?? '';
    this._descInput.value = rec.description ?? '';
    this._departInput.value = rec.departureTime ?? '';
    this._windHdgInput.value = rec.defaultWindHdg ?? '';
    this._windSpdInput.value = rec.defaultWindSpd ?? '';
    this._ktasInput.value = rec.defaultKtas ?? '';
    this._altInput.value = rec.defaultAlt ?? '';

    this._updatePlaceBtn();
    this.refreshTable();
    this._el.style.display = 'block';
  }

  close() {
    this._el.style.display = 'none';
    this._currentId = null;
    this._isPre = false;
  }

  /** Rebuild the waypoint table (called after any WP addition or update). */
  refreshTable() {
    if (!this._currentId) return;
    const rec = this._routeManager.routes.find((r) => r.id === this._currentId);
    if (!rec) return;

    const wps = rec.waypoints ?? [];
    const legs = computeLegs(wps, rec.defaultKtas, rec.defaultWindHdg, rec.defaultWindSpd);

    this._wpContainer.innerHTML = '';

    wps.forEach((wp, i) => {
      const leg = i < legs.length ? legs[i] : null;
      this._wpContainer.appendChild(this._buildWpCard(rec, wp, i, leg));
    });

    this._renderTotals(rec, legs);
  }

  /** Update the Place button state (called by RouteDrawTool on right-click). */
  setPlacing(bool) {
    this._placingEnabled = bool;
    this._updatePlaceBtn();
  }

  // ─── private ────────────────────────────────────────────────────────────

  _template() {
    return `
      <div class="shape-popup__title">Flight Route</div>

      <div class="rp-header-grid">
        <label class="rp-lbl">Name</label>
        <input class="rp-name sp-input" type="text" autocomplete="off" placeholder="Route name" />

        <label class="rp-lbl">Desc</label>
        <input class="rp-desc sp-input" type="text" autocomplete="off" placeholder="Optional description" maxlength="200" />

        <label class="rp-lbl">Start</label>
        <div class="rp-inline-group">
          <input class="rp-depart sp-input rp-time-input" type="text" autocomplete="off" placeholder="HH:MM" maxlength="5" />
          <span class="rp-lbl-mid">Z</span>
          <span class="rp-lbl-mid">Wind</span>
          <input class="rp-wind-hdg sp-input rp-short-input" type="number" min="0" max="360" placeholder="HDG°" />
          <span class="rp-lbl-mid">/</span>
          <input class="rp-wind-spd sp-input rp-short-input" type="number" min="0" placeholder="kts" />
        </div>

        <label class="rp-lbl">KTAS</label>
        <div class="rp-inline-group">
          <input class="rp-ktas sp-input rp-short-input" type="number" min="0" max="999" placeholder="kts" />
          <span class="rp-lbl-mid">Alt</span>
          <input class="rp-alt sp-input rp-medium-input" type="number" min="0" step="500" placeholder="ft MSL" />
        </div>
      </div>

      <div class="rp-wp-container"></div>

      <div class="rp-totals"></div>

      <button class="rp-place-btn lp-place-btn">PLACE: ON</button>

      <div class="shape-popup__actions">
        <button class="rp-done sp-btn sp-btn--primary">Done</button>
        <button class="rp-cancel sp-btn">Cancel</button>
      </div>
    `;
  }

  _buildWpCard(rec, wp, i, legAfter) {
    const wps = rec.waypoints;
    const card = document.createElement('div');
    card.className = 'route-wp-card';
    card.dataset.index = i;

    // ── WP row: label + coord input + ident + alt ──
    const wpRow = document.createElement('div');
    wpRow.className = 'route-wp-row';

    const wpLabel = document.createElement('span');
    wpLabel.className = 'route-wp-label';
    wpLabel.textContent = `WP${i + 1}`;

    const coordInput = document.createElement('input');
    coordInput.type = 'text';
    coordInput.className = 'route-field sp-input route-coord-input';
    coordInput.value = this._fmt(wp.lat, wp.lng);
    coordInput.autocomplete = 'off';
    coordInput.addEventListener('blur', () => this._onCoordBlur(coordInput, i));

    const identInput = document.createElement('input');
    identInput.type = 'text';
    identInput.className = 'route-field sp-input route-ident-input';
    identInput.value = wp.ident ?? '';
    identInput.maxLength = 7;
    identInput.placeholder = 'FIX';
    identInput.style.textTransform = 'uppercase';
    identInput.autocomplete = 'off';
    identInput.addEventListener('blur', () => this._onIdentBlur(identInput, coordInput, i));

    const altLabel = document.createElement('span');
    altLabel.className = 'route-wp-label';
    altLabel.textContent = 'Alt';

    const wpAltInput = document.createElement('input');
    wpAltInput.type = 'number';
    wpAltInput.className = 'route-field sp-input route-alt-input';
    wpAltInput.min = '0';
    wpAltInput.step = '500';
    wpAltInput.placeholder = rec.defaultAlt ? String(rec.defaultAlt) : 'ft';
    wpAltInput.value = wp.alt ?? '';
    wpAltInput.title = 'Per-WP altitude override (ft MSL)';
    wpAltInput.addEventListener('change', () => {
      const val = wpAltInput.value !== '' ? parseFloat(wpAltInput.value) : null;
      this._updateWp(i, { alt: val });
    });

    wpRow.appendChild(wpLabel);
    wpRow.appendChild(coordInput);
    wpRow.appendChild(identInput);
    wpRow.appendChild(altLabel);
    wpRow.appendChild(wpAltInput);
    card.appendChild(wpRow);

    // ── Leg row (shown for every WP except the last) ──
    if (legAfter && i < wps.length - 1) {
      const legRow = document.createElement('div');
      legRow.className = 'route-wp-row route-leg-row';

      const legLabel = document.createElement('span');
      legLabel.className = 'route-wp-label route-wp-label--dim';
      legLabel.textContent = `L${i + 1}`;

      const distSpan = document.createElement('span');
      distSpan.className = 'route-field--computed';
      distSpan.textContent = `${legAfter.distNm}nm`;

      const hdgSpan = document.createElement('span');
      hdgSpan.className = 'route-field--computed';
      hdgSpan.textContent = `${legAfter.trueHdg}°T`;

      const ktasLabel = document.createElement('span');
      ktasLabel.className = 'route-wp-label';
      ktasLabel.textContent = 'KTAS';

      const legKtasInput = document.createElement('input');
      legKtasInput.type = 'number';
      legKtasInput.className = 'route-field sp-input route-short-input';
      legKtasInput.min = '0';
      legKtasInput.max = '999';
      legKtasInput.placeholder = rec.defaultKtas ? String(rec.defaultKtas) : '';
      legKtasInput.value = wp.ktas ?? '';
      legKtasInput.title = 'Per-leg KTAS override';
      legKtasInput.addEventListener('change', () => {
        const val = legKtasInput.value !== '' ? parseFloat(legKtasInput.value) : null;
        this._updateWp(i, { ktas: val });
      });

      const windLabel = document.createElement('span');
      windLabel.className = 'route-wp-label';
      windLabel.textContent = 'Wind';

      const legWindHdg = document.createElement('input');
      legWindHdg.type = 'number';
      legWindHdg.className = 'route-field sp-input route-short-input';
      legWindHdg.min = '0';
      legWindHdg.max = '360';
      legWindHdg.placeholder = rec.defaultWindHdg ? String(rec.defaultWindHdg) : 'HDG';
      legWindHdg.value = wp.windHdg ?? '';
      legWindHdg.addEventListener('change', () => {
        const val = legWindHdg.value !== '' ? parseFloat(legWindHdg.value) : null;
        this._updateWp(i, { windHdg: val });
      });

      const windSep = document.createElement('span');
      windSep.className = 'route-sep';
      windSep.textContent = '/';

      const legWindSpd = document.createElement('input');
      legWindSpd.type = 'number';
      legWindSpd.className = 'route-field sp-input route-short-input';
      legWindSpd.min = '0';
      legWindSpd.placeholder = rec.defaultWindSpd ? String(rec.defaultWindSpd) : 'kts';
      legWindSpd.value = wp.windSpd ?? '';
      legWindSpd.addEventListener('change', () => {
        const val = legWindSpd.value !== '' ? parseFloat(legWindSpd.value) : null;
        this._updateWp(i, { windSpd: val });
      });

      const eteSpan = document.createElement('span');
      eteSpan.className = 'route-field--computed';
      eteSpan.textContent = legAfter.eteSeconds != null ? formatEte(legAfter.eteSeconds) : '--:--:--';

      legRow.appendChild(legLabel);
      legRow.appendChild(distSpan);
      legRow.appendChild(hdgSpan);
      legRow.appendChild(ktasLabel);
      legRow.appendChild(legKtasInput);
      legRow.appendChild(windLabel);
      legRow.appendChild(legWindHdg);
      legRow.appendChild(windSep);
      legRow.appendChild(legWindSpd);
      legRow.appendChild(eteSpan);
      card.appendChild(legRow);
    }

    // ── Actions row: delete button ──
    const actRow = document.createElement('div');
    actRow.className = 'route-wp-row route-act-row';

    const spacer = document.createElement('span');
    spacer.style.flex = '1';

    const delBtn = document.createElement('button');
    delBtn.className = 'pp-corner-minus';
    delBtn.title = 'Remove waypoint';
    delBtn.innerHTML = '&minus;';
    delBtn.addEventListener('click', () => this._removeWp(i));

    actRow.appendChild(spacer);
    actRow.appendChild(delBtn);
    card.appendChild(actRow);

    return card;
  }

  _renderTotals(rec, legs) {
    if (!legs.length) { this._totalsEl.innerHTML = ''; return; }

    const totalDist = legs.reduce((s, l) => s + l.distNm, 0);
    const allHaveEte = legs.every((l) => l.eteSeconds != null);
    const totalEte = allHaveEte ? legs.reduce((s, l) => s + l.eteSeconds, 0) : null;
    const toa = computeToa(rec.departureTime, totalEte);

    this._totalsEl.innerHTML = `
      <div class="route-totals">
        <span class="route-totals__label">Total</span>
        <span class="route-field--computed">${totalDist.toFixed(1)}nm</span>
        <span class="route-totals__label">ETE</span>
        <span class="route-field--computed">${formatEte(totalEte)}</span>
        <span class="route-totals__label">TOA</span>
        <span class="route-field--computed">${toa}</span>
      </div>
    `;
  }

  _bindHeaderEvents() {
    const flush = () => {
      if (!this._currentId) return;
      this._routeManager.updateRoute(this._currentId, {
        name: this._nameInput.value.trim() || `Route ${this._currentId}`,
        description: this._descInput.value.trim(),
        departureTime: this._departInput.value.trim(),
        defaultKtas: this._ktasInput.value ? parseFloat(this._ktasInput.value) : null,
        defaultWindHdg: this._windHdgInput.value ? parseFloat(this._windHdgInput.value) : null,
        defaultWindSpd: this._windSpdInput.value ? parseFloat(this._windSpdInput.value) : null,
        defaultAlt: this._altInput.value ? parseFloat(this._altInput.value) : null,
      });
      this.refreshTable();
    };

    [this._nameInput, this._descInput, this._departInput,
     this._windHdgInput, this._windSpdInput, this._ktasInput, this._altInput
    ].forEach((inp) => inp.addEventListener('change', flush));
  }

  _bindFooterEvents() {
    this._placeBtn.addEventListener('click', () => {
      if (!this._currentId) return;
      const next = !this._placingEnabled;
      this._placingEnabled = next;
      this._updatePlaceBtn();
      this._routeTool?.setPlacing(next);
    });

    this._el.querySelector('.rp-done').addEventListener('click', () => {
      if (this._isPre || !this._currentId) {
        this._routeTool?.cancelPlacement();
        this.close();
        return;
      }
      const name = this._nameInput.value.trim() || `Route ${this._currentId}`;
      this._routeManager.updateRoute(this._currentId, { name });
      if (this._isNew) this._routeTool?.resetToIdle();
      this.close();
    });

    this._el.querySelector('.rp-cancel').addEventListener('click', () => {
      if (this._isNew) this._routeTool?.cancelPlacement();
      this.close();
    });
  }

  _onCoordBlur(input, index) {
    if (!this._currentId) return;
    const parsed = this._coordinateParser?.parseToLatLng(input.value);
    if (parsed) {
      this._updateWp(index, { lat: parsed.lat, lng: parsed.lng });
      input.value = this._fmt(parsed.lat, parsed.lng);
    } else {
      const rec = this._routeManager.routes.find((r) => r.id === this._currentId);
      const wp = rec?.waypoints?.[index];
      if (wp) input.value = this._fmt(wp.lat, wp.lng);
    }
  }

  async _onIdentBlur(identInput, coordInput, index) {
    const raw = identInput.value.trim().toUpperCase();
    if (!raw || !this._currentId) return;
    identInput.value = raw;

    const result = await searchPointByIdent(raw);
    if (result) {
      this._updateWp(index, { lat: result.lat, lng: result.lon, ident: raw, name: result.name });
      coordInput.value = this._fmt(result.lat, result.lon);
      this.refreshTable();
    }
  }

  _updateWp(index, changes) {
    if (!this._currentId) return;
    const rec = this._routeManager.routes.find((r) => r.id === this._currentId);
    if (!rec) return;
    const wps = [...rec.waypoints];
    if (!wps[index]) return;
    wps[index] = { ...wps[index], ...changes };
    this._routeManager.updateRoute(this._currentId, { waypoints: wps });
    this.refreshTable();
  }

  _removeWp(index) {
    if (!this._currentId) return;
    const rec = this._routeManager.routes.find((r) => r.id === this._currentId);
    if (!rec) return;
    const wps = rec.waypoints.filter((_, i) => i !== index);
    if (wps.length === 0) {
      if (this._isNew) this._routeTool?.cancelPlacement();
      else this._routeManager.removeRoute(this._currentId);
      this.close();
      return;
    }
    this._routeManager.updateRoute(this._currentId, { waypoints: wps });
    this.refreshTable();
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

  _fmt(lat, lng) {
    if (!this._coordinateService) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const fmt = this._coordinateService.getCurrentFormat();
    return this._coordinateService.formatCoordinate(lat, lng, fmt);
  }
}
