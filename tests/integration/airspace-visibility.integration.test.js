import test from 'node:test';
import assert from 'node:assert/strict';

import { MapCore } from '../../src/map/MapCore.js';

function createLeafletStub() {
  const handlers = new Map();

  const map = {
    panes: new Map(),
    activeLayers: new Set(),
    getPane(id) { return this.panes.get(id); },
    createPane(id) { const pane = { style: {} }; this.panes.set(id, pane); return pane; },
    hasLayer(layer) { return this.activeLayers.has(layer); },
    removeLayer(layer) { this.activeLayers.delete(layer); },
    on(event, handler) { handlers.set(event, handler); },
    fire(event, payload) { handlers.get(event)?.(payload); },
  };

  return {
    map: () => map,
    tileLayer: () => ({
      options: {},
      addTo(targetMap) { targetMap.activeLayers.add(this); return this; },
      setZIndex() {},
      setOpacity() {},
      setUrl(nextUrl) { this.url = nextUrl; },
    }),
    geoJSON: () => ({
      options: {},
      addTo(targetMap) { targetMap.activeLayers.add(this); return this; },
      clearLayers() {},
      addData() {},
      setZIndex() {},
    }),
    control: {
      layers: () => ({ addTo() {} }),
    },
  };
}

test('airspace overlay is visible by default and toggling updates visibility state', async () => {
  const priorL = globalThis.L;
  globalThis.L = createLeafletStub();

  try {
    const mapCore = new MapCore({
      storage: { getItem: () => null, setItem() {} },
      airspaceSourceService: { loadAirspaceFeatureCollection: async () => ({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: null }] }) },
      baseLayerDefinitions: [
        {
          id: 'base-satellite',
          label: 'Satellite',
          type: 'tile',
          url: 'https://example.test/{z}/{y}/{x}',
          options: {},
          isDefault: true,
          fallbackUrls: [],
        },
      ],
    });

    mapCore.init();

    assert.equal(mapCore.layerManager.getLayerMeta('airspace-arcgis').visible, true);

    mapCore.setAirspaceVisibility(false);
    assert.equal(mapCore.layerManager.getLayerMeta('airspace-arcgis').visible, false);

    mapCore.setAirspaceVisibility(true);
    assert.equal(mapCore.layerManager.getLayerMeta('airspace-arcgis').visible, true);
  } finally {
    globalThis.L = priorL;
  }
});
