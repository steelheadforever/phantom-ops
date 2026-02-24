import { PANE_IDS } from '../../map/layerZIndex.js';

const STORAGE_KEY = 'phantom-shapes';

let _nextId = 1;

/**
 * ShapeManager — CRUD + localStorage persistence for drawn shapes.
 *
 * Shape record: { id, type, name, centerLat, centerLng, radiusNm, color, opacity, visible }
 */
export class ShapeManager {
  constructor() {
    /** @type {Array<Object>} */
    this.shapes = [];
    /** @type {Map<string, L.Circle>} */
    this._layers = new Map();
    this._map = null;
    /** @type {Array<() => void>} */
    this._listeners = [];
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
    const record = {
      id,
      type: 'circle',
      name: config.name ?? `Circle ${id}`,
      centerLat: config.centerLat,
      centerLng: config.centerLng,
      radiusNm: config.radiusNm ?? 1,
      color: config.color ?? '#4da6ff',
      opacity: config.opacity ?? 0.26,
      visible: true,
    };
    this.shapes.push(record);
    this._createLayer(record);
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
      if (changes.radiusNm !== undefined) {
        layer.setRadius(rec.radiusNm * 1852);
      }
      if (changes.centerLat !== undefined || changes.centerLng !== undefined) {
        layer.setLatLng([rec.centerLat, rec.centerLng]);
      }
      if (changes.color !== undefined || changes.opacity !== undefined) {
        layer.setStyle({
          color: rec.color,
          fillColor: rec.color,
          fillOpacity: rec.opacity,
        });
      }
      if (changes.visible !== undefined) {
        if (rec.visible) {
          layer.addTo(this._map);
        } else {
          layer.remove();
        }
      }
    }
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

    // Remove all known layers then re-add in new order
    for (const id of orderedIds) {
      const layer = this._layers.get(id);
      if (layer) layer.remove();
    }
    for (const id of orderedIds) {
      const layer = this._layers.get(id);
      const rec = this._find(id);
      if (layer && rec?.visible !== false) {
        layer.addTo(this._map);
      }
    }

    // Reorder shapes array to match
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

  _createLayer(rec) {
    if (!this._map) return;
    const layer = L.circle([rec.centerLat, rec.centerLng], {
      radius: rec.radiusNm * 1852,
      color: rec.color,
      fillColor: rec.color,
      fillOpacity: rec.opacity,
      weight: 1.5,
      pane: PANE_IDS.DRAWINGS,
    });
    if (rec.visible !== false) {
      layer.addTo(this._map);
    }
    this._layers.set(rec.id, layer);
    return layer;
  }

  _notify() {
    for (const cb of this._listeners) {
      try { cb(this.shapes); } catch { /* ignore */ }
    }
  }
}
