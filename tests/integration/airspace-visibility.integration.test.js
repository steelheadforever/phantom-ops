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
      _renderedFeatures: [],
      addTo(targetMap) { targetMap.activeLayers.add(this); return this; },
      clearLayers() { this._renderedFeatures = []; },
      addData(data) { if (data?.type === 'Feature') { this._renderedFeatures.push(data); } else if (Array.isArray(data?.features)) { this._renderedFeatures.push(...data.features); } },
      getLayers() { return this._renderedFeatures; },
      setZIndex() {},
      bringToFront() {},
    }),
    control: Object.assign(
      function () { const c = { onAdd: null, addTo() { if (c.onAdd) c.onAdd(map); } }; return c; },
      { layers: () => ({ addTo() {} }) },
    ),
    DomUtil: {
      create(tag, cls, parent) { const el = { tagName: tag, className: cls || '', style: {}, textContent: '', children: [], hasLayer() { return false; } }; if (parent) parent.children.push(el); return el; },
    },
    DomEvent: {
      disableClickPropagation() {},
      disableScrollPropagation() {},
      on() {},
    },
  };
}

test('airspace overlay is visible by default, renders features, and toggling updates visibility state', async () => {
  const priorL = globalThis.L;
  globalThis.L = createLeafletStub();

  try {
    const mapCore = new MapCore({
      storage: { getItem: () => null, setItem() {} },
      airspaceSourceService: {
        loadAirspaceFeatureCollection: async () => ({
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            properties: { TYPE_CODE: 'R' },
            geometry: {
              type: 'Polygon',
              coordinates: [[[-98, 39], [-97.5, 39], [-97.5, 39.5], [-98, 39.5], [-98, 39]]],
            },
          }],
        }),
      },
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
    await mapCore.loadAirspaceData();

    assert.equal(mapCore.layerManager.getLayerMeta('airspace-restricted').visible, true);
    const restrictedLayer = mapCore.airspaceLayers.get('airspace-restricted');
    assert.ok(restrictedLayer.getLayers().length > 0);

    mapCore.setAirspaceVisibility(false);
    assert.equal(mapCore.layerManager.getLayerMeta('airspace-restricted').visible, false);

    mapCore.setAirspaceVisibility(true);
    assert.equal(mapCore.layerManager.getLayerMeta('airspace-restricted').visible, true);
  } finally {
    globalThis.L = priorL;
  }
});
