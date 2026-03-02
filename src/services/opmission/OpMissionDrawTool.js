import { PANE_IDS } from '../../map/layerZIndex.js';
import { haversineNm, bearingDeg } from '../routes/RouteCalc.js';

/**
 * OpMissionDrawTool — click-to-add-waypoint op mission placement.
 *
 * States: idle → placing → placed
 *
 * Flow:
 *   1. activate()      — crosshair cursor, opens OpMissionPopup in new mode
 *   2. First click     → addMission() to OpMissionManager, popup attaches to mission
 *   3. Subsequent      → append WP, refresh popup table
 *   4. Right-click     → stop placing (PLACE OFF in popup)
 *   5. Done            → resetToIdle() (solidifies closing line)
 *      Cancel          → cancelPlacement() (removes mission)
 */
export class OpMissionDrawTool {
  constructor({ map, opMissionManager, opMissionPopup }) {
    this._map = map;
    this._manager = opMissionManager;
    this._popup = opMissionPopup; // may be null initially — set via late binding

    this._state = 'idle';       // 'idle' | 'placing' | 'placed'
    this._placingEnabled = true;
    this._activeMissionId = null;
    this._previewLine = null;    // dashed gold preview line: last WP → cursor
    this._distLabel = null;      // distance/bearing label at cursor

    this._onFirstClick = this._onFirstClick.bind(this);
    this._onNextClick = this._onNextClick.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onRightClick = this._onRightClick.bind(this);
  }

  /** Activate tool — crosshair cursor, open empty mission popup. */
  activate() {
    if (this._state !== 'idle') return;
    this._map.getContainer().style.cursor = 'crosshair';
    this._popup?.openNew();
    this._map.once('click', this._onFirstClick);
    this._map.once('contextmenu', this._onRightClick);
  }

  deactivate() {
    this._cleanupPreview();
    this._state = 'idle';
    this._activeMissionId = null;
    this._map.getContainer().style.cursor = '';
    this._map.off('click', this._onFirstClick);
    this._map.off('click', this._onNextClick);
    this._map.off('mousemove', this._onMouseMove);
    this._map.off('contextmenu', this._onRightClick);
  }

  /** Cancel — remove the in-progress mission and return to idle. */
  cancelPlacement() {
    if (this._activeMissionId) {
      this._manager.removeMission(this._activeMissionId);
      this._activeMissionId = null;
    }
    this.deactivate();
  }

  /** Called by OpMissionPopup Done when isNew=true. Solidifies closing line. */
  resetToIdle() {
    this._cleanupPreview();
    this._map.off('click', this._onNextClick);
    this._map.off('mousemove', this._onMouseMove);
    this._map.off('contextmenu', this._onRightClick);
    if (this._activeMissionId) {
      this._manager.closeMission(this._activeMissionId);
    }
    this._state = 'placed';
    this._activeMissionId = null;
    this._map.getContainer().style.cursor = '';
  }

  /** Toggle placing on/off — called by popup PLACE button or right-click. */
  setPlacing(enabled) {
    this._placingEnabled = enabled;
    if (!enabled) {
      this._cleanupPreview();
      this._map.off('mousemove', this._onMouseMove);
    } else if (this._state === 'placing') {
      const rec = this._manager.missions.find((m) => m.id === this._activeMissionId);
      if (!rec || !rec.waypoints.length) return;
      const last = rec.waypoints[rec.waypoints.length - 1];
      this._startPreview([last.lat, last.lng]);
      this._map.on('mousemove', this._onMouseMove);
    }
  }

  // ─── private ────────────────────────────────────────────────────────────

  _onFirstClick(e) {
    this._state = 'placing';
    this._placingEnabled = true;

    const pending = this._popup?.getPendingConfig() ?? {};

    const id = this._manager.addMission({
      name: pending.name || undefined,
      waypoints: [{
        lat: e.latlng.lat, lng: e.latlng.lng,
        ident: '', name: '', alt: null,
        loiter: false, loiterRadius: null, loiterDir: 'CW',
        exitCond: null, exitValue: null,
      }],
    });
    this._activeMissionId = id;

    this._startPreview(e.latlng);
    this._map.on('mousemove', this._onMouseMove);
    this._map.on('click', this._onNextClick);
    this._map.once('contextmenu', this._onRightClick);

    this._popup?.attachMission(id);
  }

  _onNextClick(e) {
    if (!this._placingEnabled || !this._activeMissionId) return;
    const rec = this._manager.missions.find((m) => m.id === this._activeMissionId);
    if (!rec) return;

    const wps = [...rec.waypoints, {
      lat: e.latlng.lat, lng: e.latlng.lng,
      ident: '', name: '', alt: null,
      loiter: false, loiterRadius: null, loiterDir: 'CW',
      exitCond: null, exitValue: null,
    }];
    this._manager.updateMission(this._activeMissionId, { waypoints: wps });

    this._startPreview(e.latlng);
    this._popup?.refreshTable();
  }

  _onMouseMove(e) {
    if (!this._previewLine || !this._placingEnabled) return;
    const rec = this._manager.missions.find((m) => m.id === this._activeMissionId);
    if (!rec || !rec.waypoints.length) return;
    const last = rec.waypoints[rec.waypoints.length - 1];
    const lastLL = L.latLng(last.lat, last.lng);
    const cursor = e.latlng;

    this._previewLine.setLatLngs([lastLL, cursor]);

    const distNm = haversineNm(last.lat, last.lng, cursor.lat, cursor.lng);
    const brg = Math.round(bearingDeg(last.lat, last.lng, cursor.lat, cursor.lng));
    const midLat = (last.lat + cursor.lat) / 2;
    const midLng = (last.lng + cursor.lng) / 2;
    this._distLabel.setLatLng([midLat, midLng]);
    const el = this._distLabel.getElement?.()?.querySelector('div');
    if (el) el.textContent = `${distNm.toFixed(1)}nm ${brg}°T`;
  }

  _onRightClick(e) {
    if (e?.originalEvent) e.originalEvent.preventDefault();
    this._placingEnabled = false;
    this._cleanupPreview();
    this._map.off('mousemove', this._onMouseMove);
    this._popup?.setPlacing(false);
  }

  _startPreview(latlng) {
    this._cleanupPreview();
    const ll = L.latLng(latlng);
    this._previewLine = L.polyline([ll, ll], {
      color: '#f5a800',
      weight: 1.5,
      dashArray: '5,5',
      pane: PANE_IDS.DRAWINGS,
      interactive: false,
    }).addTo(this._map);

    this._distLabel = L.marker(ll, {
      icon: L.divIcon({
        className: 'radius-label',
        html: '<div></div>',
        iconSize: [110, 20],
        iconAnchor: [55, 20],
      }),
      pane: PANE_IDS.DRAWINGS,
      interactive: false,
    }).addTo(this._map);
  }

  _cleanupPreview() {
    this._previewLine?.remove();
    this._previewLine = null;
    this._distLabel?.remove();
    this._distLabel = null;
  }
}
