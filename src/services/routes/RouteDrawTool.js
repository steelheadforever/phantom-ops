import { PANE_IDS } from '../../map/layerZIndex.js';
import { haversineNm, bearingDeg } from './RouteCalc.js';
import { searchPointByIdent } from '../navaids/NavaidService.js';

/**
 * RouteDrawTool — click-to-add-waypoint route placement on the map.
 *
 * States: idle → placing → placed
 *
 * Flow:
 *   1. activate() — crosshair cursor, opens RoutePopup in new-route mode
 *   2. First click → addRoute() to RouteManager, opens popup with WP1
 *   3. Subsequent clicks → appendWaypoint(), refresh popup table
 *   4. Right-click → stop placing (Place toggle off in popup)
 *   5. Popup Done → resetToIdle(); Cancel → cancelPlacement()
 */
export class RouteDrawTool {
  constructor({ map, routeManager, routePopup }) {
    this._map = map;
    this._routeManager = routeManager;
    this._routePopup = routePopup; // may be null initially — set via late binding

    this._state = 'idle';       // 'idle' | 'placing' | 'placed'
    this._placingEnabled = true;
    this._activeRouteId = null;
    this._previewLine = null;    // dashed gold preview line: last WP → cursor
    this._distLabel = null;      // distance/bearing label at cursor

    this._onFirstClick = this._onFirstClick.bind(this);
    this._onNextClick = this._onNextClick.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onRightClick = this._onRightClick.bind(this);
  }

  /** Activate tool — crosshair cursor, open empty route popup. */
  activate() {
    if (this._state !== 'idle') return;
    this._map.getContainer().style.cursor = 'crosshair';
    this._routePopup?.openNew();
    this._map.once('click', this._onFirstClick);
    this._map.once('contextmenu', this._onRightClick);
  }

  deactivate() {
    this._cleanupPreview();
    this._state = 'idle';
    this._activeRouteId = null;
    this._map.getContainer().style.cursor = '';
    this._map.off('click', this._onFirstClick);
    this._map.off('click', this._onNextClick);
    this._map.off('mousemove', this._onMouseMove);
    this._map.off('contextmenu', this._onRightClick);
  }

  /** Cancel — remove the in-progress route and return to idle. */
  cancelPlacement() {
    if (this._activeRouteId) {
      this._routeManager.removeRoute(this._activeRouteId);
      this._activeRouteId = null;
    }
    this.deactivate();
  }

  /** Called by RoutePopup Done when isNew=true. */
  resetToIdle() {
    this._cleanupPreview();
    this._map.off('click', this._onNextClick);
    this._map.off('mousemove', this._onMouseMove);
    this._map.off('contextmenu', this._onRightClick);
    this._state = 'placed';
    this._activeRouteId = null;
    this._map.getContainer().style.cursor = '';
  }

  /**
   * Toggle placing on/off — called by RoutePopup Place button or right-click.
   */
  setPlacing(enabled) {
    this._placingEnabled = enabled;
    if (!enabled) {
      this._cleanupPreview();
      this._map.off('mousemove', this._onMouseMove);
    } else if (this._state === 'placing') {
      const rec = this._routeManager.routes.find((r) => r.id === this._activeRouteId);
      if (!rec || !rec.waypoints.length) return;
      const last = rec.waypoints[rec.waypoints.length - 1];
      this._startPreview([last.lat, last.lng]);
      this._map.on('mousemove', this._onMouseMove);
    }
  }

  /**
   * Programmatically add a waypoint by ident search (called from RoutePopup).
   * @param {string} ident
   * @param {number} index - waypoint index to set (replaces existing or appends)
   * @returns {Promise<boolean>} true if found
   */
  async searchAndSetWaypoint(ident, index) {
    const result = await searchPointByIdent(ident.toUpperCase());
    if (!result) return false;
    const rec = this._routeManager.routes.find((r) => r.id === this._activeRouteId);
    if (!rec) return false;

    const wps = [...(rec.waypoints ?? [])];
    if (index < wps.length) {
      wps[index] = { ...wps[index], lat: result.lat, lng: result.lon, ident: ident.toUpperCase(), name: result.name };
    } else {
      wps.push({ lat: result.lat, lng: result.lon, ident: ident.toUpperCase(), name: result.name });
    }
    this._routeManager.updateRoute(this._activeRouteId, { waypoints: wps });
    return true;
  }

  // ─── private ────────────────────────────────────────────────────────────

  _onFirstClick(e) {
    this._state = 'placing';
    this._placingEnabled = true;

    // Get any name pre-entered in popup
    const pending = this._routePopup?.getPendingConfig() ?? {};

    const id = this._routeManager.addRoute({
      name: pending.name || undefined,
      waypoints: [{ lat: e.latlng.lat, lng: e.latlng.lng, ident: '', name: '' }],
    });
    this._activeRouteId = id;

    // Preview line
    this._startPreview(e.latlng);
    this._map.on('mousemove', this._onMouseMove);
    this._map.on('click', this._onNextClick);
    this._map.once('contextmenu', this._onRightClick);

    // Transition popup to live editing
    this._routePopup?.attachRoute(id);
  }

  _onNextClick(e) {
    if (!this._placingEnabled || !this._activeRouteId) return;
    const rec = this._routeManager.routes.find((r) => r.id === this._activeRouteId);
    if (!rec) return;

    const wps = [...rec.waypoints, { lat: e.latlng.lat, lng: e.latlng.lng, ident: '', name: '' }];
    this._routeManager.updateRoute(this._activeRouteId, { waypoints: wps });

    // Move preview start to new last WP
    this._startPreview(e.latlng);
    this._routePopup?.refreshTable();
  }

  _onMouseMove(e) {
    if (!this._previewLine || !this._placingEnabled) return;
    const rec = this._routeManager.routes.find((r) => r.id === this._activeRouteId);
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
    this._routePopup?.setPlacing(false);
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
