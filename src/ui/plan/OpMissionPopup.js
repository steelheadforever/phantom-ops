import { PANE_IDS } from '../../map/layerZIndex.js';
import { searchPointByIdentWithSim } from '../../services/navaids/NavaidService.js';

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
 * OpMissionPopup — draggable floating popup for TQ-9 op mission editing.
 *
 * Per-WP card rows:
 *   1. WP row:     WP# label + coord input (flex:1) + FIX input (52px)
 *   2. Alt row:    Alt label + altitude input (69px) + ft
 *   3. Loiter row: Loiter checkbox + Radius input (47px) + nm + CW/CCW toggle
 *   4. Exit row:   Exit label + select (—/Time/Altitude) + value input   [hidden if !loiter]
 *   5. Act row:    right-aligned delete button
 *
 * Footer: PLACE toggle, DONE (disabled < 3 WPs), CANCEL
 */
export class OpMissionPopup {
  /**
   * @param {Object} opts
   * @param {import('../../services/opmission/OpMissionManager.js').OpMissionManager} opts.opMissionManager
   * @param {Object} opts.coordinateService
   * @param {Object} opts.coordinateParser
   * @param {Object} opts.missionTool        - late-bound via _missionTool
   * @param {Object} opts.map
   * @param {Map}    opts.airspaceLayers      - mapCore.airspaceLayers (lazy sim lookup)
   */
  constructor({ opMissionManager, coordinateService, coordinateParser, missionTool, map, airspaceLayers }) {
    this._manager = opMissionManager;
    this._coordinateService = coordinateService;
    this._coordinateParser = coordinateParser;
    this._missionTool = missionTool; // may be null — set via late binding
    this._map = map;
    this._airspaceLayers = airspaceLayers; // Map<id, layer>

    this._el = null;
    this._currentId = null;
    this._isNew = false;
    this._isPre = false;
    this._placingEnabled = false;

    this._nameInput = null;
    this._wpContainer = null;
    this._placeBtn = null;
    this._doneBtn = null;

    this._selectedWpIndex = null;
    this._selectionRing = null;
    this._snapshot = null;
  }

  mount(root = document.body) {
    const el = document.createElement('div');
    el.className = 'shape-popup opm-popup';
    el.style.display = 'none';
    el.innerHTML = this._template();
    root.appendChild(el);
    this._el = el;

    this._nameInput   = el.querySelector('.opm-name');
    this._wpContainer = el.querySelector('.opm-wp-container');
    this._placeBtn    = el.querySelector('.opm-place-btn');
    this._doneBtn     = el.querySelector('.opm-done');

    this._bindNameEvents();
    this._bindFooterEvents();
    makeDraggable(el, el.querySelector('.shape-popup__title'));

    this._coordinateService?.onFormatChange(() => {
      if (this._currentId && !this._isPre) this.refreshTable();
    });

    // Refresh table when any mission changes (e.g. WP dragged on map)
    this._manager.onChange(() => {
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
    this._selectedWpIndex = null;

    this._nameInput.value = '';
    this._wpContainer.innerHTML = '<div class="pp-pre-label">— click map to place waypoints —</div>';
    this._updatePlaceBtn();
    this._updateDoneBtn(0);
    this._el.style.display = 'block';
  }

  /** Returns config values from header fields (used on first click). */
  getPendingConfig() {
    return { name: this._nameInput?.value.trim() || null };
  }

  /**
   * Called by OpMissionDrawTool after first WP placed.
   * Attaches to the created mission and switches from pre to live mode.
   */
  attachMission(missionId) {
    const rec = this._manager.missions.find((m) => m.id === missionId);
    if (!rec) return;
    this._currentId = missionId;
    this._isPre = false;

    const pending = this.getPendingConfig();
    if (pending.name) {
      this._manager.updateMission(missionId, { name: pending.name });
    } else {
      this.refreshTable();
    }
  }

  /**
   * Open popup for an existing mission (from OpMissionPanel Edit action).
   */
  open(missionId, { isNew = false } = {}) {
    const rec = this._manager.missions.find((m) => m.id === missionId);
    if (!rec) return;

    this._currentId = missionId;
    this._isNew = isNew;
    this._isPre = false;
    this._placingEnabled = false;
    this._selectedWpIndex = null;
    this._snapshot = isNew ? null : JSON.parse(JSON.stringify(rec));

    this._nameInput.value = rec.name ?? '';
    this._updatePlaceBtn();
    this.refreshTable();
    this._el.style.display = 'block';
  }

  close() {
    this._missionTool?.cancelInsert();
    this._el.style.display = 'none';
    this._currentId = null;
    this._isPre = false;
    this._removeSelectionRing();
  }

  /** Clear active state from all insert buttons (called by OpMissionDrawTool.cancelInsert). */
  refreshInsertButtons() {
    this._wpContainer?.querySelectorAll('.opm-wp-insert-btn--active').forEach((btn) => {
      btn.classList.remove('opm-wp-insert-btn--active');
    });
  }

  /** Rebuild the waypoint table (called after any WP addition or update). */
  refreshTable() {
    if (!this._currentId) return;
    const rec = this._manager.missions.find((m) => m.id === this._currentId);
    if (!rec) return;

    const wps = rec.waypoints ?? [];
    this._wpContainer.innerHTML = '';
    wps.forEach((wp, i) => {
      this._wpContainer.appendChild(this._buildWpCard(rec, wp, i));
    });
    this._updateDoneBtn(wps.length);
  }

  /** Update the Place button state (called by OpMissionDrawTool on right-click). */
  setPlacing(bool) {
    this._placingEnabled = bool;
    this._updatePlaceBtn();
  }

  // ─── private ────────────────────────────────────────────────────────────

  _template() {
    return `
      <div class="shape-popup__title">Op Mission</div>
      <input class="opm-name sp-input" type="text" autocomplete="off" placeholder="Mission name" style="margin-bottom:8px" />
      <div class="opm-wp-container"></div>
      <button class="opm-place-btn lp-place-btn">PLACE: ON</button>
      <div class="shape-popup__actions">
        <button class="opm-done sp-btn sp-btn--primary" disabled>Done</button>
        <button class="opm-cancel sp-btn">Cancel</button>
      </div>
    `;
  }

  _buildWpCard(rec, wp, i) {
    const card = document.createElement('div');
    card.className = 'opm-wp-card';
    card.dataset.index = i;
    if (i === this._selectedWpIndex) card.classList.add('opm-wp-card--selected');

    // ── Row 1: WP label + coord + FIX ──
    const wpRow = document.createElement('div');
    wpRow.className = 'opm-wp-row';

    const wpLabel = document.createElement('span');
    wpLabel.className = 'opm-wp-label';
    wpLabel.textContent = `WP${i + 1}`;

    const coordInput = document.createElement('input');
    coordInput.type = 'text';
    coordInput.className = 'opm-coord-input sp-input';
    coordInput.value = this._fmt(wp.lat, wp.lng);
    coordInput.autocomplete = 'off';
    coordInput.addEventListener('blur', () => this._onCoordBlur(coordInput, i));

    const identInput = document.createElement('input');
    identInput.type = 'text';
    identInput.className = 'opm-ident-input sp-input';
    identInput.value = wp.ident ?? '';
    identInput.maxLength = 7;
    identInput.placeholder = 'FIX';
    identInput.style.textTransform = 'uppercase';
    identInput.autocomplete = 'off';
    identInput.addEventListener('blur', () => this._onIdentBlur(identInput, coordInput, i));

    wpRow.appendChild(wpLabel);
    wpRow.appendChild(coordInput);
    wpRow.appendChild(identInput);
    card.appendChild(wpRow);

    // ── Row 2: Alt ──
    const altRow = document.createElement('div');
    altRow.className = 'opm-wp-row';

    const altLabel = document.createElement('span');
    altLabel.className = 'opm-wp-label';
    altLabel.textContent = 'Alt';

    const altInput = document.createElement('input');
    altInput.type = 'number';
    altInput.className = 'opm-alt-input sp-input';
    altInput.min = '0';
    altInput.step = '500';
    altInput.placeholder = 'ft';
    altInput.value = wp.alt ?? '';
    altInput.addEventListener('change', () => {
      const val = altInput.value !== '' ? parseFloat(altInput.value) : null;
      this._updateWp(i, { alt: val });
    });

    const altUnit = document.createElement('span');
    altUnit.className = 'opm-wp-label';
    altUnit.textContent = 'ft';

    altRow.appendChild(altLabel);
    altRow.appendChild(altInput);
    altRow.appendChild(altUnit);
    card.appendChild(altRow);

    // ── Row 3: Loiter ──
    const loiterRow = document.createElement('div');
    loiterRow.className = 'opm-wp-row';

    const loiterChk = document.createElement('input');
    loiterChk.type = 'checkbox';
    loiterChk.checked = !!wp.loiter;
    loiterChk.title = 'Enable loiter';
    loiterChk.style.accentColor = 'var(--gold)';
    loiterChk.style.cursor = 'pointer';
    loiterChk.style.flexShrink = '0';

    const loiterLabel = document.createElement('span');
    loiterLabel.className = 'opm-wp-label';
    loiterLabel.textContent = 'Loiter';

    const radLabel = document.createElement('span');
    radLabel.className = 'opm-wp-label';
    radLabel.textContent = 'R';

    const radInput = document.createElement('input');
    radInput.type = 'number';
    radInput.className = 'opm-short-input sp-input';
    radInput.min = '0.5';
    radInput.step = '0.5';
    radInput.placeholder = 'nm';
    radInput.value = wp.loiterRadius ?? '';
    radInput.disabled = !wp.loiter;

    const radUnit = document.createElement('span');
    radUnit.className = 'opm-wp-label';
    radUnit.textContent = 'nm';

    const dirBtn = document.createElement('button');
    dirBtn.className = 'opm-dir-btn sp-btn';
    dirBtn.textContent = wp.loiterDir === 'CCW' ? 'CCW' : 'CW';
    dirBtn.disabled = !wp.loiter;
    dirBtn.style.cssText = 'padding:2px 5px;font-size:10px;flex:none;min-width:52px';

    loiterRow.appendChild(loiterChk);
    loiterRow.appendChild(loiterLabel);
    loiterRow.appendChild(radLabel);
    loiterRow.appendChild(radInput);
    loiterRow.appendChild(radUnit);
    loiterRow.appendChild(dirBtn);
    card.appendChild(loiterRow);

    // ── Row 4: Exit (hidden when !loiter) ──
    const exitRow = document.createElement('div');
    exitRow.className = 'opm-wp-row';
    exitRow.style.display = wp.loiter ? 'flex' : 'none';

    const exitLabel = document.createElement('span');
    exitLabel.className = 'opm-wp-label';
    exitLabel.textContent = 'Exit';

    const exitSelect = document.createElement('select');
    exitSelect.className = 'sp-input opm-exit-select';
    exitSelect.style.cssText = 'flex:1;font-size:10px;padding:3px 5px;cursor:pointer';
    [['', '—'], ['time', 'Time'], ['altitude', 'Altitude']].forEach(([val, lbl]) => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = lbl;
      if ((wp.exitCond ?? '') === val) opt.selected = true;
      exitSelect.appendChild(opt);
    });

    const exitValInput = document.createElement('input');
    exitValInput.className = 'opm-short-input sp-input';
    exitValInput.style.width = '80px';
    if (wp.exitCond === 'time') {
      exitValInput.type = 'text';
      exitValInput.placeholder = 'HH:MM:SS';
      exitValInput.value = wp.exitValue ?? '';
    } else if (wp.exitCond === 'altitude') {
      exitValInput.type = 'number';
      exitValInput.placeholder = 'ft';
      exitValInput.value = wp.exitValue ?? '';
    } else {
      exitValInput.type = 'text';
      exitValInput.placeholder = '—';
      exitValInput.disabled = true;
    }

    exitRow.appendChild(exitLabel);
    exitRow.appendChild(exitSelect);
    exitRow.appendChild(exitValInput);
    card.appendChild(exitRow);

    // ── Row 5: Actions ──
    const actRow = document.createElement('div');
    actRow.className = 'opm-wp-row opm-act-row';

    const spacer = document.createElement('span');
    spacer.style.flex = '1';

    const insertBtn = document.createElement('button');
    insertBtn.className = 'opm-wp-insert-btn';
    insertBtn.title = 'Insert waypoint after this one';
    insertBtn.textContent = '+';
    insertBtn.addEventListener('click', () => {
      const isActive = insertBtn.classList.toggle('opm-wp-insert-btn--active');
      if (isActive) {
        this._missionTool?.startInsert(this._currentId, i);
      } else {
        this._missionTool?.cancelInsert();
      }
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'pp-corner-minus';
    delBtn.title = 'Remove waypoint';
    delBtn.innerHTML = '&minus;';
    delBtn.addEventListener('click', () => this._removeWp(i));

    actRow.appendChild(spacer);
    actRow.appendChild(insertBtn);
    actRow.appendChild(delBtn);
    card.appendChild(actRow);

    // ── Event bindings ──

    // Card body click → select WP (ignore clicks on interactive children)
    card.addEventListener('click', (e) => {
      if (e.target.closest('input, button, select')) return;
      this._selectWp(i, wp);
    });

    // Loiter checkbox
    loiterChk.addEventListener('change', () => {
      const checked = loiterChk.checked;
      radInput.disabled = !checked;
      dirBtn.disabled = !checked;
      exitRow.style.display = checked ? 'flex' : 'none';
      this._updateWp(i, { loiter: checked });
    });

    // Radius
    radInput.addEventListener('change', () => {
      const val = radInput.value !== '' ? parseFloat(radInput.value) : null;
      this._updateWp(i, { loiterRadius: val });
    });

    // Direction toggle
    dirBtn.addEventListener('click', () => {
      const newDir = wp.loiterDir === 'CW' ? 'CCW' : 'CW';
      this._updateWp(i, { loiterDir: newDir });
    });

    // Exit condition select
    exitSelect.addEventListener('change', () => {
      const cond = exitSelect.value || null;
      exitValInput.value = '';
      if (cond === 'time') {
        exitValInput.type = 'text';
        exitValInput.placeholder = 'HH:MM:SS';
        exitValInput.disabled = false;
      } else if (cond === 'altitude') {
        exitValInput.type = 'number';
        exitValInput.placeholder = 'ft';
        exitValInput.disabled = false;
      } else {
        exitValInput.type = 'text';
        exitValInput.placeholder = '—';
        exitValInput.disabled = true;
      }
      this._updateWp(i, { exitCond: cond, exitValue: null });
    });

    // Exit value
    exitValInput.addEventListener('change', () => {
      const cond = exitSelect.value;
      let val = exitValInput.value || null;
      if (cond === 'altitude' && val !== null) val = parseFloat(val);
      this._updateWp(i, { exitValue: val });
    });

    return card;
  }

  /** Highlight a WP card and show pulsing ring on map. */
  _selectWp(index, wp) {
    this._selectedWpIndex = index;
    const cards = this._wpContainer.querySelectorAll('.opm-wp-card');
    cards.forEach((c, i) => c.classList.toggle('opm-wp-card--selected', i === index));

    this._removeSelectionRing();
    this._selectionRing = L.marker([wp.lat, wp.lng], {
      icon: L.divIcon({
        className: 'opm-selected-ring',
        html: '<div></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      }),
      pane: PANE_IDS.DRAWINGS,
      interactive: false,
    }).addTo(this._map);
  }

  _removeSelectionRing() {
    this._selectionRing?.remove();
    this._selectionRing = null;
  }

  _bindNameEvents() {
    this._nameInput.addEventListener('change', () => {
      if (!this._currentId) return;
      const name = this._nameInput.value.trim() || `Mission ${this._currentId}`;
      this._manager.updateMission(this._currentId, { name });
    });
  }

  _bindFooterEvents() {
    this._placeBtn.addEventListener('click', () => {
      if (!this._currentId) return;
      const next = !this._placingEnabled;
      this._placingEnabled = next;
      this._updatePlaceBtn();
      this._missionTool?.setPlacing(next);
    });

    this._doneBtn.addEventListener('click', () => {
      if (this._isPre || !this._currentId) {
        this._missionTool?.cancelPlacement();
        this.close();
        return;
      }
      const name = this._nameInput.value.trim() || `Mission ${this._currentId}`;
      this._manager.updateMission(this._currentId, { name });
      if (this._isNew) this._missionTool?.resetToIdle();
      this.close();
    });

    this._el.querySelector('.opm-cancel').addEventListener('click', () => {
      if (this._isNew) {
        this._missionTool?.cancelPlacement();
      } else if (this._snapshot) {
        this._manager.updateMission(this._snapshot.id, this._snapshot);
      }
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
      const rec = this._manager.missions.find((m) => m.id === this._currentId);
      const wp = rec?.waypoints?.[index];
      if (wp) input.value = this._fmt(wp.lat, wp.lng);
    }
  }

  async _onIdentBlur(identInput, coordInput, index) {
    const raw = identInput.value.trim().toUpperCase();
    if (!raw || !this._currentId) return;
    identInput.value = raw;

    // Look up sim layer lazily (may not be loaded at construction time)
    const simLayer = this._airspaceLayers?.get('airspace-simulated') ?? null;
    const result = await searchPointByIdentWithSim(raw, simLayer);
    if (result) {
      this._updateWp(index, { lat: result.lat, lng: result.lon, ident: raw, name: result.name });
      coordInput.value = this._fmt(result.lat, result.lon);
      this.refreshTable();
    }
  }

  _updateWp(index, changes) {
    if (!this._currentId) return;
    const rec = this._manager.missions.find((m) => m.id === this._currentId);
    if (!rec) return;
    const wps = [...rec.waypoints];
    if (!wps[index]) return;
    wps[index] = { ...wps[index], ...changes };
    this._manager.updateMission(this._currentId, { waypoints: wps });
    this.refreshTable();
  }

  _removeWp(index) {
    if (!this._currentId) return;
    const rec = this._manager.missions.find((m) => m.id === this._currentId);
    if (!rec) return;
    const wps = rec.waypoints.filter((_, i) => i !== index);
    if (wps.length === 0) {
      if (this._isNew) this._missionTool?.cancelPlacement();
      else this._manager.removeMission(this._currentId);
      this.close();
      return;
    }
    this._manager.updateMission(this._currentId, { waypoints: wps });
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

  _updateDoneBtn(wpCount) {
    if (!this._doneBtn) return;
    this._doneBtn.disabled = wpCount < 3;
  }

  _fmt(lat, lng) {
    if (!this._coordinateService) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const fmt = this._coordinateService.getCurrentFormat();
    return this._coordinateService.formatCoordinate(lat, lng, fmt);
  }
}
