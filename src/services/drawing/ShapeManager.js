import { PANE_IDS } from '../../map/layerZIndex.js';
import { getSymbolSvg } from './pointSymbols.js';

const STORAGE_KEY = 'phantom-shapes';

let _nextId = 1;

const DASH_ARRAYS = {
  solid:    null,
  dashed:   '8,6',
  dotted:   '2,6',
  'dash-dot': '10,5,2,5',
};

/**
 * ShapeManager — CRUD + localStorage persistence for drawn shapes.
 *
 * Circle record:  { id, type:'circle',  name, centerLat, centerLng, radiusNm, color, opacity, visible }
 * Polygon record: { id, type:'polygon', name, latlngs:[{lat,lng},...], color, opacity, visible }
 * Line record:    { id, type:'line',    name, latlngs:[{lat,lng},...], color, opacity, dash, showLabel, visible }
 * Point record:   { id, type:'point',   name, lat, lng, symbol, color, opacity, visible }
 */
export class ShapeManager {
  constructor() {
    /** @type {Array<Object>} */
    this.shapes = [];
    /** @type {Map<string, L.Layer>} */
    this._layers = new Map();
    /** @type {Map<string, L.Marker>} label markers for lines with showLabel=true */
    this._labelMarkers = new Map();
    this._map = null;
    /** @type {Array<() => void>} */
    this._listeners = [];
    /** Last opacity used — new circles/polygons default to this. */
    this.lastOpacity = 0.26;
  }

  /** Call once after map is ready. Restores any persisted shapes. */
  restore(map) {
    this._map = map;
    try {
      const raw = globalThis?.localStorage?.getItem(STORAGE_KEY);
      if (!raw) return;
      const records = JSON.parse(raw);
      if (!Array.isArray(records)) return;
      for (const rec of records) {
        this._createLayer(rec);
        this.shapes.push(rec);
        if (rec.id && +rec.id >= _nextId) {
          _nextId = +rec.id + 1;
        }
        if (rec.opacity != null) this.lastOpacity = rec.opacity;
      }
    } catch {
      // corrupt storage — ignore
    }
    this._notify();
  }

  /** Add a new shape record and place it on the map. Returns the id. */
  addShape(config, map) {
    if (map && !this._map) this._map = map;
    const id = String(_nextId++);
    const type = config.type ?? 'circle';
    // Lines default to fully opaque; circles/polygons inherit lastOpacity
    const opacity = config.opacity ?? (type === 'line' ? 1.0 : this.lastOpacity);
    const defaultName = type === 'polygon' ? 'Polygon' : type === 'line' ? 'Line' : type === 'point' ? 'Point' : 'Circle';
    const record = {
      id,
      type,
      name: config.name ?? `${defaultName} ${id}`,
      color: config.color ?? '#4da6ff',
      opacity,
      visible: true,
      // circle
      centerLat: config.centerLat,
      centerLng: config.centerLng,
      radiusNm: config.radiusNm ?? 1,
      // polygon + line
      latlngs: config.latlngs ?? null,
      // line-specific
      dash: config.dash ?? 'solid',
      showLabel: config.showLabel ?? false,
      // point-specific
      lat: config.lat,
      lng: config.lng,
      symbol: config.symbol ?? 'waypoint',
    };
    this.shapes.push(record);
    this._createLayer(record);
    // Don't let line/point opacity overwrite lastOpacity used by circle/polygon
    if (type !== 'line' && type !== 'point') this.lastOpacity = opacity;
    this.persist();
    this._notify();
    return id;
  }

  /** Update fields on an existing shape and sync Leaflet layer. */
  updateShape(id, changes) {
    const rec = this._find(id);
    if (!rec) return;
    Object.assign(rec, changes);
    const layer = this._layers.get(id);

    if (layer) {
      if (rec.type === 'point') {
        const posChanged = changes.lat !== undefined || changes.lng !== undefined;
        const styleChanged = changes.color !== undefined || changes.opacity !== undefined || changes.symbol !== undefined;
        if (posChanged) {
          layer.setLatLng([rec.lat, rec.lng]);
        }
        if (styleChanged) {
          layer.setIcon(this._makePointIcon(rec));
        }
        if (changes.visible !== undefined) {
          rec.visible ? layer.addTo(this._map) : layer.remove();
        }
      } else if (rec.type === 'line') {
        if (changes.latlngs !== undefined) {
          layer.setLatLngs((rec.latlngs ?? []).map((ll) => [ll.lat, ll.lng]));
          this._repositionLabel(rec);
        }
        if (changes.color !== undefined) {
          layer.setStyle({ color: rec.color });
          this._updateLabelText(rec);
        }
        if (changes.opacity !== undefined) {
          layer.setStyle({ opacity: rec.opacity });
        }
        if (changes.dash !== undefined) {
          layer.setStyle({ dashArray: DASH_ARRAYS[rec.dash] ?? null });
        }
        if (changes.name !== undefined) {
          this._updateLabelText(rec);
        }
        if (changes.showLabel !== undefined) {
          if (rec.showLabel) {
            this._createLabel(rec);
          } else {
            this._removeLabel(id);
          }
        }
        if (changes.visible !== undefined) {
          if (rec.visible) {
            layer.addTo(this._map);
            if (rec.showLabel) this._createLabel(rec);
          } else {
            layer.remove();
            this._removeLabel(id);
          }
        }
      } else if (rec.type === 'polygon') {
        if (changes.latlngs !== undefined) {
          layer.setLatLngs(rec.latlngs.map((ll) => [ll.lat, ll.lng]));
        }
        if (changes.color !== undefined || changes.opacity !== undefined) {
          layer.setStyle({ color: rec.color, fillColor: rec.color, fillOpacity: rec.opacity });
        }
        if (changes.visible !== undefined) {
          rec.visible ? layer.addTo(this._map) : layer.remove();
        }
      } else {
        // circle
        if (changes.radiusNm !== undefined) {
          layer.setRadius(rec.radiusNm * 1852);
        }
        if (changes.centerLat !== undefined || changes.centerLng !== undefined) {
          layer.setLatLng([rec.centerLat, rec.centerLng]);
        }
        if (changes.color !== undefined || changes.opacity !== undefined) {
          layer.setStyle({ color: rec.color, fillColor: rec.color, fillOpacity: rec.opacity });
        }
        if (changes.visible !== undefined) {
          rec.visible ? layer.addTo(this._map) : layer.remove();
        }
      }
    }

    if (changes.opacity !== undefined && rec.type !== 'line' && rec.type !== 'point') this.lastOpacity = rec.opacity;
    this.persist();
    this._notify();
  }

  /** Remove a shape from the map and records. */
  removeShape(id) {
    const layer = this._layers.get(id);
    if (layer) {
      layer.remove();
      this._layers.delete(id);
    }
    this._removeLabel(id);
    this.shapes = this.shapes.filter((r) => r.id !== id);
    this.persist();
    this._notify();
  }

  /** Show or hide a shape's Leaflet layer. */
  setVisible(id, visible) {
    this.updateShape(id, { visible });
  }

  /** Re-order shapes so SVG layers appear in the provided order (bottom-first). */
  reorderShapes(orderedIds) {
    if (!this._map) return;
    for (const id of orderedIds) {
      this._layers.get(id)?.remove();
    }
    for (const id of orderedIds) {
      const layer = this._layers.get(id);
      const rec = this._find(id);
      if (layer && rec?.visible !== false) layer.addTo(this._map);
    }
    const idOrder = new Map(orderedIds.map((id, i) => [id, i]));
    this.shapes.sort((a, b) => (idOrder.get(a.id) ?? 999) - (idOrder.get(b.id) ?? 999));
    this.persist();
    this._notify();
  }

  /** Save shapes to localStorage (records only, no Leaflet objects). */
  persist() {
    try {
      globalThis?.localStorage?.setItem(STORAGE_KEY, JSON.stringify(this.shapes));
    } catch {
      // quota exceeded — ignore
    }
  }

  /** Register a callback invoked after every shape mutation. */
  onChange(cb) {
    this._listeners.push(cb);
  }

  // ─── private ────────────────────────────────────────────────────────────

  _find(id) {
    return this.shapes.find((r) => r.id === id) ?? null;
  }

  _makePointIcon(rec) {
    const svg = getSymbolSvg(rec.symbol ?? 'waypoint', rec.color, rec.opacity, 20);
    return L.divIcon({
      className: 'point-symbol-icon',
      html: svg,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  }

  _createLayer(rec) {
    if (!this._map) return;
    let layer;
    if (rec.type === 'point') {
      layer = L.marker([rec.lat, rec.lng], {
        icon: this._makePointIcon(rec),
        pane: PANE_IDS.DRAWINGS,
        interactive: true,
      });
      if (rec.visible !== false) layer.addTo(this._map);
      this._layers.set(rec.id, layer);
    } else if (rec.type === 'line') {
      layer = L.polyline(
        (rec.latlngs ?? []).map((ll) => [ll.lat, ll.lng]),
        {
          color: rec.color,
          opacity: rec.opacity,
          weight: 2,
          dashArray: DASH_ARRAYS[rec.dash] ?? null,
          pane: PANE_IDS.DRAWINGS,
        },
      );
      if (rec.visible !== false) layer.addTo(this._map);
      this._layers.set(rec.id, layer);
      if (rec.showLabel && (rec.latlngs?.length ?? 0) >= 2) {
        this._createLabel(rec);
      }
    } else if (rec.type === 'polygon') {
      layer = L.polygon(
        (rec.latlngs ?? []).map((ll) => [ll.lat, ll.lng]),
        {
          color: rec.color,
          fillColor: rec.color,
          fillOpacity: rec.opacity,
          weight: 1.5,
          pane: PANE_IDS.DRAWINGS,
        },
      );
      if (rec.visible !== false) layer.addTo(this._map);
      this._layers.set(rec.id, layer);
    } else {
      layer = L.circle([rec.centerLat, rec.centerLng], {
        radius: rec.radiusNm * 1852,
        color: rec.color,
        fillColor: rec.color,
        fillOpacity: rec.opacity,
        weight: 1.5,
        pane: PANE_IDS.DRAWINGS,
      });
      if (rec.visible !== false) layer.addTo(this._map);
      this._layers.set(rec.id, layer);
    }
    return layer;
  }

  /** Create or replace the name label marker for a line. */
  _createLabel(rec) {
    this._removeLabel(rec.id);
    if (!this._map || !rec.latlngs || rec.latlngs.length < 2) return;
    const mid = rec.latlngs[Math.floor((rec.latlngs.length - 1) / 2)];
    const marker = L.marker([mid.lat, mid.lng], {
      icon: L.divIcon({
        className: 'line-label',
        html: `<div style="color:${rec.color}">${rec.name}</div>`,
        iconSize: [120, 20],
        iconAnchor: [60, 20],
      }),
      pane: PANE_IDS.DRAWINGS,
      interactive: false,
    }).addTo(this._map);
    this._labelMarkers.set(rec.id, marker);
  }

  /** Reposition label to line midpoint after latlngs change. */
  _repositionLabel(rec) {
    const marker = this._labelMarkers.get(rec.id);
    if (!marker || !rec.latlngs || rec.latlngs.length < 2) return;
    const mid = rec.latlngs[Math.floor((rec.latlngs.length - 1) / 2)];
    marker.setLatLng([mid.lat, mid.lng]);
  }

  /** Update the label text and color after a name or color change. */
  _updateLabelText(rec) {
    const marker = this._labelMarkers.get(rec.id);
    if (!marker) return;
    const el = marker.getElement?.()?.querySelector('div');
    if (el) {
      el.textContent = rec.name;
      el.style.color = rec.color;
    }
  }

  /** Remove label marker if it exists. */
  _removeLabel(id) {
    const marker = this._labelMarkers.get(id);
    if (marker) {
      marker.remove();
      this._labelMarkers.delete(id);
    }
  }

  _notify() {
    for (const cb of this._listeners) {
      try { cb(this.shapes); } catch { /* ignore */ }
    }
  }
}
