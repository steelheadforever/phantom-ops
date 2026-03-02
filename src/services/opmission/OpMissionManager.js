import { PANE_IDS } from '../../map/layerZIndex.js';

const STORAGE_KEY = 'phantom-opmissions';
let _nextId = 1;
const ORANGE = '#f4a261';

/**
 * OpMissionManager — CRUD + Leaflet rendering + localStorage for TQ-9 op missions.
 *
 * Mission record:
 * {
 *   id, type: 'op-mission', name, visible,
 *   closed: boolean,   // true after DONE — closing line becomes solid
 *   waypoints: [{
 *     lat, lng, ident, name,
 *     alt,          // ft MSL | null
 *     loiter,       // boolean
 *     loiterRadius, // nm | null
 *     loiterDir,    // 'CW' | 'CCW'
 *     exitCond,     // 'time' | 'altitude' | null
 *     exitValue,    // 'HH:MM:SS' | number (ft) | null
 *   }]
 * }
 *
 * entry: { polyline, closingLine, markers: L.Marker[], loiterCircles: Map<wpIndex, {circle, arrow}> }
 */
export class OpMissionManager {
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

  /**
   * Add a new mission. Returns new id.
   * @param {Object} config
   */
  addMission(config) {
    if (!this._map) return null;
    const id = String(_nextId++);
    const rec = {
      id,
      type: 'op-mission',
      name: config.name ?? `Mission ${id}`,
      visible: true,
      closed: false,
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
        entry.closingLine?.addTo(this._map);
        for (const m of entry.markers) m.addTo(this._map);
        for (const [, lc] of entry.loiterCircles) {
          lc.circle.addTo(this._map);
          lc.arrow.addTo(this._map);
        }
      } else {
        entry.polyline?.remove();
        entry.closingLine?.remove();
        for (const m of entry.markers) m.remove();
        for (const [, lc] of entry.loiterCircles) {
          lc.circle.remove();
          lc.arrow.remove();
        }
      }
    }
    this.persist();
    this._notify();
  }

  /**
   * Solidify the closing line — called when user hits Done.
   * Sets closed=true and updates closing line style in place.
   */
  closeMission(id) {
    const rec = this._find(id);
    if (!rec) return;
    rec.closed = true;
    const entry = this._layers.get(id);
    if (entry?.closingLine) {
      entry.closingLine.setStyle({ opacity: 1, dashArray: null });
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

  /**
   * Render (or re-render) a mission on the map.
   * Creates: orange polyline + closing line + draggable WP markers + loiter circles.
   */
  _renderMission(rec) {
    if (!this._map) return;

    const wps = rec.waypoints ?? [];
    const latlngs = wps.map((wp) => [wp.lat, wp.lng]);

    // Orange polyline (all WP segments)
    const polyline = latlngs.length >= 2
      ? L.polyline(latlngs, {
          color: ORANGE,
          weight: 2,
          pane: PANE_IDS.DRAWINGS,
          interactive: false,
        })
      : null;
    if (polyline && rec.visible !== false) polyline.addTo(this._map);

    // Closing line: last WP → first WP, only when ≥3 WPs
    let closingLine = null;
    if (latlngs.length >= 3) {
      closingLine = L.polyline(
        [latlngs[latlngs.length - 1], latlngs[0]],
        {
          color: ORANGE,
          weight: 2,
          pane: PANE_IDS.DRAWINGS,
          interactive: false,
          opacity: rec.closed ? 1 : 0.3,
          dashArray: rec.closed ? null : '6,5',
        }
      );
      if (rec.visible !== false) closingLine.addTo(this._map);
    }

    const entry = { polyline, closingLine, markers: [], loiterCircles: new Map() };
    this._layers.set(rec.id, entry);

    // Draggable WP markers
    wps.forEach((wp, i) => {
      const m = L.marker([wp.lat, wp.lng], {
        icon: this._wpIcon(i),
        draggable: true,
        pane: PANE_IDS.DRAWINGS,
      });
      if (rec.visible !== false) m.addTo(this._map);

      // Live-update polyline + closing line + loiter circle while dragging
      m.on('drag', (e) => {
        const { lat, lng } = e.latlng;

        // Update main polyline
        const lls = entry.markers.map((mk, idx) =>
          idx === i ? [lat, lng] : [mk.getLatLng().lat, mk.getLatLng().lng]
        );
        if (entry.polyline && lls.length >= 2) entry.polyline.setLatLngs(lls);

        // Update closing line
        if (entry.closingLine && lls.length >= 3) {
          entry.closingLine.setLatLngs([lls[lls.length - 1], lls[0]]);
        }

        // Slide loiter circle for this WP
        const lc = entry.loiterCircles.get(i);
        if (lc) {
          lc.circle.setLatLng([lat, lng]);
          const arrowLat = lat + (wp.loiterRadius * 1852) / 111320;
          lc.arrow.setLatLng([arrowLat, lng]);
        }
      });

      // Commit position on drop
      m.on('dragend', () => {
        const { lat, lng } = m.getLatLng();
        this._updateWaypointLatLng(rec.id, i, lat, lng);
      });

      entry.markers.push(m);
    });

    // Loiter circles
    wps.forEach((wp, i) => {
      if (wp.loiter && wp.loiterRadius > 0) {
        this._addLoiterCircle(entry, rec, wp, i);
      }
    });
  }

  /**
   * Create and add a loiter circle + direction arrow for a single waypoint.
   */
  _addLoiterCircle(entry, rec, wp, i) {
    const circle = L.circle([wp.lat, wp.lng], {
      radius: wp.loiterRadius * 1852,
      color: ORANGE,
      weight: 1.5,
      fill: false,
      pane: PANE_IDS.DRAWINGS,
      interactive: false,
    });
    if (rec.visible !== false) circle.addTo(this._map);

    // Arrow at north pole of circle
    const arrowLat = wp.lat + (wp.loiterRadius * 1852) / 111320;
    const arrow = L.marker([arrowLat, wp.lng], {
      icon: L.divIcon({
        className: 'opm-loiter-arrow',
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

  /**
   * Partial update: sync polyline + closing line + loiter circle for a dragged WP.
   * Does not destroy/recreate all markers.
   */
  _updateWaypointLatLng(id, wpIndex, lat, lng) {
    const rec = this._find(id);
    if (!rec) return;
    rec.waypoints[wpIndex] = { ...rec.waypoints[wpIndex], lat, lng };

    const entry = this._layers.get(id);
    if (entry) {
      const lls = rec.waypoints.map((wp) => [wp.lat, wp.lng]);

      if (entry.polyline && lls.length >= 2) entry.polyline.setLatLngs(lls);

      if (entry.closingLine && lls.length >= 3) {
        entry.closingLine.setLatLngs([lls[lls.length - 1], lls[0]]);
      }

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
    }

    this.persist();
    this._notify();
  }

  /** DivIcon for numbered orange WP dot marker. */
  _wpIcon(index) {
    return L.divIcon({
      className: 'opm-wp-marker',
      html: `<div class="opm-wp-dot">${index + 1}</div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
  }

  /** Remove all Leaflet objects for a mission. */
  _removeRender(id) {
    const entry = this._layers.get(id);
    if (!entry) return;
    entry.polyline?.remove();
    entry.closingLine?.remove();
    for (const m of entry.markers) m.remove();
    for (const [, lc] of entry.loiterCircles) {
      lc.circle.remove();
      lc.arrow.remove();
    }
    this._layers.delete(id);
  }

  _notify() {
    for (const cb of this._listeners) {
      try { cb(this.missions); } catch { /* ignore */ }
    }
  }
}
