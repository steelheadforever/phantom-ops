import { LAYER_Z_INDEX, ORDERED_STACK, PANE_IDS } from './layerZIndex.js';

const META_BY_KIND = Object.freeze({
  base: { paneId: PANE_IDS.BASE_MAP, zIndex: LAYER_Z_INDEX.BASE_MAP },
  gars: { paneId: PANE_IDS.GARS, zIndex: LAYER_Z_INDEX.GARS },
  airspace: { paneId: PANE_IDS.AIRSPACE, zIndex: LAYER_Z_INDEX.AIRSPACE },
  drawings: { paneId: PANE_IDS.DRAWINGS, zIndex: LAYER_Z_INDEX.DRAWINGS },
});

export class LayerManager {
  constructor(map) {
    this.map = map;
    this.layers = new Map();
    this.activeBaseLayerId = null;
  }

  initializePanes() {
    Object.values(META_BY_KIND).forEach(({ paneId, zIndex }) => {
      const pane = this.map.getPane(paneId) ?? this.map.createPane(paneId);
      pane.style.zIndex = String(zIndex);
      if (paneId === PANE_IDS.DRAWINGS) {
        pane.style.pointerEvents = 'auto';
      }
    });
    return this;
  }

  registerLayer(layerId, layer, kind, options = {}) {
    const meta = META_BY_KIND[kind];
    if (!meta) {
      throw new Error(`Unknown layer kind: ${kind}`);
    }

    const mergedOptions = { ...options, pane: meta.paneId };
    if (typeof layer.setZIndex === 'function') {
      layer.setZIndex(meta.zIndex);
    }

    this.layers.set(layerId, {
      id: layerId,
      layer,
      kind,
      paneId: meta.paneId,
      zIndex: meta.zIndex,
      options: mergedOptions,
      visible: false,
    });

    return mergedOptions;
  }

  showLayer(layerId) {
    const entry = this.#getLayer(layerId);

    if (entry.kind === 'base') {
      if (this.activeBaseLayerId && this.activeBaseLayerId !== layerId) {
        this.hideLayer(this.activeBaseLayerId);
      }
      this.activeBaseLayerId = layerId;
    }

    if (!this.map.hasLayer(entry.layer)) {
      entry.layer.addTo(this.map);
    }
    entry.visible = true;
  }

  hideLayer(layerId) {
    const entry = this.#getLayer(layerId);
    if (this.map.hasLayer(entry.layer)) {
      this.map.removeLayer(entry.layer);
    }
    entry.visible = false;
    if (entry.kind === 'base' && this.activeBaseLayerId === layerId) {
      this.activeBaseLayerId = null;
    }
  }

  setLayerVisibility(layerId, visible) {
    if (visible) {
      this.showLayer(layerId);
      return;
    }
    this.hideLayer(layerId);
  }

  setBaseImageryDim(dimPercent) {
    const opacity = 1 - Math.max(0, Math.min(85, dimPercent)) / 100;
    for (const entry of this.layers.values()) {
      if (entry.kind !== 'base') continue;
      if (typeof entry.layer.setOpacity === 'function') {
        entry.layer.setOpacity(opacity);
      }
    }
    return opacity;
  }

  getRenderOrder() {
    return [...ORDERED_STACK];
  }

  getLayerMeta(layerId) {
    const entry = this.#getLayer(layerId);
    return {
      id: entry.id,
      kind: entry.kind,
      paneId: entry.paneId,
      zIndex: entry.zIndex,
      visible: entry.visible,
    };
  }

  getActiveBaseLayerId() {
    return this.activeBaseLayerId;
  }

  #getLayer(layerId) {
    const entry = this.layers.get(layerId);
    if (!entry) {
      throw new Error(`Layer not registered: ${layerId}`);
    }
    return entry;
  }
}
