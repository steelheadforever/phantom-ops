import { PANE_IDS } from '../../map/layerZIndex.js';
import { computeLegs } from './RouteCalc.js';

const STORAGE_KEY = 'phantom-routes';
let _nextId = 1;

/**
 * RouteManager — CRUD + Leaflet rendering + localStorage persistence for flight routes.
 *
 * Route record:
 * {
 *   id, type:'flight-route', name, description, visible,
 *   departureTime,    // 'HH:MM' UTC
 *   defaultKtas,      // number | null
 *   defaultWindHdg,   // number | null
 *   defaultWindSpd,   // number | null
 *   defaultAlt,       // number | null  ft MSL
 *   waypoints: [{ lat, lng, ident, name, ktas, windHdg, windSpd, alt }]
 * }
 */
export class RouteManager {
  constructor() {
    /** @type {Array<Object>} */
    this.routes = [];
    /** @type {Map<string, {polyline: L.Polyline, markers: L.CircleMarker[], legLabels: L.Marker[]}>} */
    this._layers = new Map();
    this._map = null;
    /** @type {Array<() => void>} */
    this._listeners = [];
  }

  /** Call once after map is ready. Restores any persisted routes. */
  restore(map) {
    this._map = map;
    try {
      const raw = globalThis?.localStorage?.getItem(STORAGE_KEY);
      if (!raw) return;
      const records = JSON.parse(raw);
      if (!Array.isArray(records)) return;
      for (const rec of records) {
        this._renderRoute(rec);
        this.routes.push(rec);
        if (rec.id && +rec.id >= _nextId) _nextId = +rec.id + 1;
      }
    } catch {
      // corrupt storage — ignore
    }
    this._notify();
  }

  /**
   * Add a new route. Returns the new id.
   * @param {Object} config
   */
  addRoute(config) {
    if (!this._map) return null;
    const id = String(_nextId++);
    const rec = {
      id,
      type: 'flight-route',
      name: config.name ?? `Route ${id}`,
      description: config.description ?? '',
      visible: true,
      departureTime: config.departureTime ?? '',
      defaultKtas: config.defaultKtas ?? null,
      defaultWindHdg: config.defaultWindHdg ?? null,
      defaultWindSpd: config.defaultWindSpd ?? null,
      defaultAlt: config.defaultAlt ?? null,
      waypoints: config.waypoints ?? [],
    };
    this.routes.push(rec);
    this._renderRoute(rec);
    this.persist();
    this._notify();
    return id;
  }

  /**
   * Update fields on an existing route and re-render.
   */
  updateRoute(id, changes) {
    const rec = this._find(id);
    if (!rec) return;
    Object.assign(rec, changes);
    this._removeRender(id);
    this._renderRoute(rec);
    this.persist();
    this._notify();
  }

  /** Remove a route from map and records. */
  removeRoute(id) {
    this._removeRender(id);
    this.routes = this.routes.filter((r) => r.id !== id);
    this.persist();
    this._notify();
  }

  /** Show or hide a route. */
  setVisible(id, visible) {
    const rec = this._find(id);
    if (!rec) return;
    rec.visible = visible;
    const entry = this._layers.get(id);
    if (entry) {
      if (visible) {
        entry.polyline?.addTo(this._map);
        for (const m of entry.markers) m.addTo(this._map);
        for (const l of entry.legLabels) l.addTo(this._map);
      } else {
        entry.polyline?.remove();
        for (const m of entry.markers) m.remove();
        for (const l of entry.legLabels) l.remove();
      }
    }
    this.persist();
    this._notify();
  }

  /** Save to localStorage. */
  persist() {
    try {
      globalThis?.localStorage?.setItem(STORAGE_KEY, JSON.stringify(this.routes));
    } catch {
      // quota exceeded — ignore
    }
  }

  /** Remove all routes and clear localStorage. */
  clearAll() {
    for (const id of this._layers.keys()) {
      this._removeRender(id);
    }
    this.routes = [];
    try {
      globalThis?.localStorage?.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    this._notify();
  }

  /** Register a callback for any mutation. */
  onChange(cb) {
    this._listeners.push(cb);
  }

  // ─── private ────────────────────────────────────────────────────────────

  _find(id) {
    return this.routes.find((r) => r.id === id) ?? null;
  }

  /**
   * Render (or re-render) a route on the map.
   * Creates: gray polyline + draggable L.marker per WP + mid-leg divIcon labels.
   */
  _renderRoute(rec) {
    if (!this._map) return;

    const wps = rec.waypoints ?? [];
    const latlngs = wps.map((wp) => [wp.lat, wp.lng]);

    // Gray polyline
    const polyline = latlngs.length >= 2
      ? L.polyline(latlngs, {
          color: '#a0a0a0',
          weight: 2,
          pane: PANE_IDS.DRAWINGS,
          interactive: false,
        })
      : null;
    if (polyline && rec.visible !== false) polyline.addTo(this._map);

    // WP dot markers — draggable L.marker so position can be updated by drag
    const entry = { polyline, markers: [], legLabels: [] };
    this._layers.set(rec.id, entry);

    wps.forEach((wp, i) => {
      const m = L.marker([wp.lat, wp.lng], {
        icon: this._wpIcon(),
        draggable: true,
        pane: PANE_IDS.DRAWINGS,
      });
      if (rec.visible !== false) m.addTo(this._map);

      // Live-update polyline while dragging
      m.on('drag', (e) => {
        const { lat, lng } = e.latlng;
        if (!entry.polyline) return;
        const lls = entry.markers.map((mk, idx) =>
          idx === i ? [lat, lng] : [mk.getLatLng().lat, mk.getLatLng().lng]
        );
        if (lls.length >= 2) entry.polyline.setLatLngs(lls);
      });

      // Commit position on drop
      m.on('dragend', () => {
        const { lat, lng } = m.getLatLng();
        this._updateWaypointLatLng(rec.id, i, lat, lng);
      });

      entry.markers.push(m);
    });

    // Mid-leg labels (distance + bearing)
    entry.legLabels = this._buildLegLabels(rec);
    if (rec.visible !== false) {
      for (const l of entry.legLabels) l.addTo(this._map);
    }
  }

  /**
   * Update a single waypoint's position without destroying markers.
   * Rebuilds leg labels + persists + notifies (so popup table refreshes).
   */
  _updateWaypointLatLng(id, wpIndex, lat, lng) {
    const rec = this._find(id);
    if (!rec) return;
    rec.waypoints[wpIndex] = { ...rec.waypoints[wpIndex], lat, lng };

    const entry = this._layers.get(id);
    if (entry) {
      // Sync polyline to final positions
      const lls = rec.waypoints.map((wp) => [wp.lat, wp.lng]);
      if (entry.polyline && lls.length >= 2) entry.polyline.setLatLngs(lls);

      // Rebuild leg labels
      for (const l of entry.legLabels) l.remove();
      entry.legLabels = this._buildLegLabels(rec);
      if (rec.visible !== false) {
        for (const l of entry.legLabels) l.addTo(this._map);
      }
    }

    this.persist();
    this._notify();
  }

  /** DivIcon for a WP dot marker. */
  _wpIcon() {
    return L.divIcon({
      className: 'route-wp-marker',
      html: '<div class="route-wp-dot"></div>',
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    });
  }

  /**
   * Build divIcon label markers placed at each leg midpoint.
   */
  _buildLegLabels(rec) {
    const wps = rec.waypoints ?? [];
    const legs = computeLegs(
      wps,
      rec.defaultKtas,
      rec.defaultWindHdg,
      rec.defaultWindSpd,
    );
    const labels = [];

    for (let i = 0; i < legs.length; i++) {
      const leg = legs[i];
      const from = wps[i];
      const to = wps[i + 1];
      const midLat = (from.lat + to.lat) / 2;
      const midLng = (from.lng + to.lng) / 2;

      const text = `${leg.distNm}nm ${leg.trueHdg}°T`;
      const marker = L.marker([midLat, midLng], {
        icon: L.divIcon({
          className: 'route-leg-label',
          html: `<div>${text}</div>`,
          iconSize: [100, 18],
          iconAnchor: [50, 18],
        }),
        pane: PANE_IDS.DRAWINGS,
        interactive: false,
      });
      labels.push(marker);
    }
    return labels;
  }

  /** Remove all Leaflet objects for a route. */
  _removeRender(id) {
    const entry = this._layers.get(id);
    if (!entry) return;
    entry.polyline?.remove();
    for (const m of entry.markers) m.remove();
    for (const l of entry.legLabels) l.remove();
    this._layers.delete(id);
  }

  _notify() {
    for (const cb of this._listeners) {
      try { cb(this.routes); } catch { /* ignore */ }
    }
  }
}
