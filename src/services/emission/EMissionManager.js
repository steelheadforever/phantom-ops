import { PANE_IDS } from '../../map/layerZIndex.js';

const STORAGE_KEY = 'phantom-emissions';
let _nextId = 1;
const RED = '#e63946';
const HEX_RADIUS_M = 1.5 * 1852; // 1.5 NM in metres

// Flat-top hexagon: vertices at 30° intervals offset by 30° from north
const HEX_BEARINGS = [30, 90, 150, 210, 270, 330];

/**
 * EMissionManager — CRUD + Leaflet rendering + localStorage for TQ-9 E-Missions.
 *
 * Mission record:
 * {
 *   id, type: 'e-mission', name, visible,
 *   waypoints: [{
 *     lat, lng, ident, name,
 *     alt,          // ft MSL | null
 *     loiter,       // boolean
 *     loiterRadius, // nm | null
 *     loiterDir,    // 'CW' | 'CCW'
 *     exitCond,     // 'time' | 'altitude' | null
 *     exitValue,    // duration 'HH:MM:SS' | number (ft) | null
 *     lastSix,      // boolean — marks the terminal loiter hexagon
 *   }]
 * }
 *
 * Layer entry: { polyline, markers: L.Marker[], loiterCircles: Map<wpIndex, {circle, arrow}>, hexagon: L.Polygon | null }
 */
export class EMissionManager {
  constructor() {
    /** @type {Array<Object>} */
    this.missions = [];
    /** @type {Map<string, Object>} */
    this._layers = new Map();
    this._map = null;
    /** @type {Array<() => void>} */
    this._listeners = [];
  }

  /** Call once after map is ready. Restores persisted missions. */
  restore(map) {
    this._map = map;
    try {
      const raw = globalThis?.localStorage?.getItem(STORAGE_KEY);
      if (!raw) return;
      const records = JSON.parse(raw);
      if (!Array.isArray(records)) return;
      for (const rec of records) {
        this._renderMission(rec);
        this.missions.push(rec);
        if (rec.id && +rec.id >= _nextId) _nextId = +rec.id + 1;
      }
    } catch {
      // corrupt storage — ignore
    }
    this._notify();
  }

  /** Add a new E-mission. Returns new id. */
  addMission(config) {
    if (!this._map) return null;
    const id = String(_nextId++);
    const rec = {
      id,
      type: 'e-mission',
      name: config.name ?? `E-Mission ${id}`,
      visible: true,
      waypoints: config.waypoints ?? [],
    };
    this.missions.push(rec);
    this._renderMission(rec);
    this.persist();
    this._notify();
    return id;
  }

  /** Update fields on an existing mission and re-render. */
  updateMission(id, changes) {
    const rec = this._find(id);
    if (!rec) return;
    Object.assign(rec, changes);
    this._removeRender(id);
    this._renderMission(rec);
    this.persist();
    this._notify();
  }

  /** Remove a mission from map and records. */
  removeMission(id) {
    this._removeRender(id);
    this.missions = this.missions.filter((m) => m.id !== id);
    this.persist();
    this._notify();
  }

  /** Show or hide a mission. */
  setVisible(id, visible) {
    const rec = this._find(id);
    if (!rec) return;
    rec.visible = visible;
    const entry = this._layers.get(id);
    if (entry) {
      if (visible) {
        entry.polyline?.addTo(this._map);
        for (const m of entry.markers) m.addTo(this._map);
        for (const [, lc] of entry.loiterCircles) {
          lc.circle.addTo(this._map);
          lc.arrow.addTo(this._map);
        }
        entry.hexagon?.addTo(this._map);
      } else {
        entry.polyline?.remove();
        for (const m of entry.markers) m.remove();
        for (const [, lc] of entry.loiterCircles) {
          lc.circle.remove();
          lc.arrow.remove();
        }
        entry.hexagon?.remove();
      }
    }
    this.persist();
    this._notify();
  }

  /** Save to localStorage. */
  persist() {
    try {
      globalThis?.localStorage?.setItem(STORAGE_KEY, JSON.stringify(this.missions));
    } catch {
      // quota exceeded — ignore
    }
  }

  /** Remove all missions and clear localStorage. */
  clearAll() {
    for (const id of this._layers.keys()) {
      this._removeRender(id);
    }
    this.missions = [];
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
    return this.missions.find((m) => m.id === id) ?? null;
  }

  /** Render (or re-render) a mission on the map. */
  _renderMission(rec) {
    if (!this._map) return;

    const wps = rec.waypoints ?? [];
    const latlngs = wps.map((wp) => [wp.lat, wp.lng]);

    // Red polyline (behind markers — added first)
    const polyline = latlngs.length >= 2
      ? L.polyline(latlngs, {
          color: RED,
          weight: 2,
          pane: PANE_IDS.DRAWINGS,
          interactive: false,
        })
      : null;
    if (polyline && rec.visible !== false) polyline.addTo(this._map);

    // Last 6 hexagon — drawn before markers so markers appear on top
    const lastSixWp = [...wps].reverse().find((wp) => wp.lastSix);
    const hexagon = lastSixWp
      ? this._makeHexagon(lastSixWp.lat, lastSixWp.lng)
      : null;
    if (hexagon && rec.visible !== false) hexagon.addTo(this._map);

    const entry = { polyline, markers: [], loiterCircles: new Map(), hexagon };
    this._layers.set(rec.id, entry);

    // Loiter circles (behind markers)
    wps.forEach((wp, i) => {
      if (wp.loiter && wp.loiterRadius > 0) {
        this._addLoiterCircle(entry, rec, wp, i);
      }
    });

    // Draggable WP markers (numbered red circles — added last, sit on top)
    wps.forEach((wp, i) => {
      const m = L.marker([wp.lat, wp.lng], {
        icon: this._wpIcon(i, !!wp.lastSix),
        draggable: true,
        pane: PANE_IDS.DRAWINGS,
      });
      if (rec.visible !== false) m.addTo(this._map);

      // Live-update while dragging
      m.on('drag', (e) => {
        const { lat, lng } = e.latlng;

        // Update main polyline
        const lls = entry.markers.map((mk, idx) =>
          idx === i ? [lat, lng] : [mk.getLatLng().lat, mk.getLatLng().lng]
        );
        if (entry.polyline && lls.length >= 2) entry.polyline.setLatLngs(lls);

        // Slide loiter circle
        const lc = entry.loiterCircles.get(i);
        if (lc) {
          lc.circle.setLatLng([lat, lng]);
          const arrowLat = lat + (wp.loiterRadius * 1852) / 111320;
          lc.arrow.setLatLng([arrowLat, lng]);
        }

        // Slide hexagon if this is the Last 6 WP
        if (wp.lastSix && entry.hexagon) {
          entry.hexagon.setLatLngs(this._hexagonPoints(lat, lng));
        }
      });

      // Commit on dragend
      m.on('dragend', () => {
        const { lat, lng } = m.getLatLng();
        this._updateWaypointLatLng(rec.id, i, lat, lng);
      });

      entry.markers.push(m);
    });
  }

  _makeHexagon(lat, lng) {
    return L.polygon(this._hexagonPoints(lat, lng), {
      color: RED,
      weight: 2,
      fill: false,
      pane: PANE_IDS.DRAWINGS,
      interactive: false,
    });
  }

  _hexagonPoints(lat, lng) {
    return HEX_BEARINGS.map((brg) => this._destPoint(lat, lng, brg, HEX_RADIUS_M));
  }

  /** Compute destination lat/lng from origin + bearing (°) + distance (m). */
  _destPoint(lat, lng, bearingDeg, distM) {
    const R = 6371000;
    const φ1 = (lat * Math.PI) / 180;
    const λ1 = (lng * Math.PI) / 180;
    const θ = (bearingDeg * Math.PI) / 180;
    const δ = distM / R;
    const φ2 = Math.asin(
      Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
    );
    const λ2 =
      λ1 +
      Math.atan2(
        Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
        Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
      );
    return [(φ2 * 180) / Math.PI, (λ2 * 180) / Math.PI];
  }

  _addLoiterCircle(entry, rec, wp, i) {
    const circle = L.circle([wp.lat, wp.lng], {
      radius: wp.loiterRadius * 1852,
      color: RED,
      weight: 1.5,
      fill: false,
      pane: PANE_IDS.DRAWINGS,
      interactive: false,
    });
    if (rec.visible !== false) circle.addTo(this._map);

    const arrowLat = wp.lat + (wp.loiterRadius * 1852) / 111320;
    const arrow = L.marker([arrowLat, wp.lng], {
      icon: L.divIcon({
        className: 'em-loiter-arrow',
        html: `<div>${wp.loiterDir === 'CW' ? '>' : '<'}</div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
      pane: PANE_IDS.DRAWINGS,
      interactive: false,
    });
    if (rec.visible !== false) arrow.addTo(this._map);

    entry.loiterCircles.set(i, { circle, arrow });
  }

  /** Partial update: sync polyline + loiter circle + hexagon after WP drag. */
  _updateWaypointLatLng(id, wpIndex, lat, lng) {
    const rec = this._find(id);
    if (!rec) return;
    rec.waypoints[wpIndex] = { ...rec.waypoints[wpIndex], lat, lng };

    const entry = this._layers.get(id);
    if (entry) {
      const lls = rec.waypoints.map((wp) => [wp.lat, wp.lng]);
      if (entry.polyline && lls.length >= 2) entry.polyline.setLatLngs(lls);

      // Rebuild loiter circle for this WP only
      const oldLc = entry.loiterCircles.get(wpIndex);
      if (oldLc) {
        oldLc.circle.remove();
        oldLc.arrow.remove();
        entry.loiterCircles.delete(wpIndex);
      }
      const wp = rec.waypoints[wpIndex];
      if (wp.loiter && wp.loiterRadius > 0) {
        this._addLoiterCircle(entry, rec, wp, wpIndex);
      }

      // Update hexagon if this is the Last 6 WP
      if (wp.lastSix && entry.hexagon) {
        entry.hexagon.setLatLngs(this._hexagonPoints(lat, lng));
      }
    }

    this.persist();
    this._notify();
  }

  /** DivIcon for numbered red WP dot marker. */
  _wpIcon(index, isLastSix) {
    const extraClass = isLastSix ? ' em-wp-dot--last6' : '';
    return L.divIcon({
      className: 'em-wp-marker',
      html: `<div class="em-wp-dot${extraClass}">${index + 1}</div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
  }

  /** Remove all Leaflet objects for a mission. */
  _removeRender(id) {
    const entry = this._layers.get(id);
    if (!entry) return;
    entry.polyline?.remove();
    for (const m of entry.markers) m.remove();
    for (const [, lc] of entry.loiterCircles) {
      lc.circle.remove();
      lc.arrow.remove();
    }
    entry.hexagon?.remove();
    this._layers.delete(id);
  }

  _notify() {
    for (const cb of this._listeners) {
      try { cb(this.missions); } catch { /* ignore */ }
    }
  }
}
