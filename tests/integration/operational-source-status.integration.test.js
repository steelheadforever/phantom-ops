import test from 'node:test';
import assert from 'node:assert/strict';

import { MapCore } from '../../src/map/MapCore.js';

function createLeafletStub() {
  const map = {
    panes: new Map(),
    activeLayers: new Set(),
    getPane(id) { return this.panes.get(id); },
    createPane(id) { const pane = { style: {} }; this.panes.set(id, pane); return pane; },
    hasLayer(layer) { return this.activeLayers.has(layer); },
    removeLayer(layer) { this.activeLayers.delete(layer); },
    on() {},
  };

  return {
    map: () => map,
    tileLayer: (url) => ({
      options: {},
      url,
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
      bringToFront() {},
    }),
    control: {
      layers: () => ({ addTo() {} }),
    },
  };
}

function imageResponse(ok) {
  return {
    ok,
    status: ok ? 200 : 404,
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? (ok ? 'image/png' : 'text/html') : null) },
  };
}

test('IFR Low/High keep distinct active URLs when distinct healthy sources are available', async () => {
  const priorL = globalThis.L;
  const priorFetch = globalThis.fetch;
  const priorDocument = globalThis.document;
  globalThis.L = createLeafletStub();
  globalThis.document = undefined;

  globalThis.fetch = async (url) => {
    if (url.includes('IFR_AreaLow')) return imageResponse(true);
    if (url.includes('IFR_High')) return imageResponse(true);
    if (url.includes('World_Navigation_Charts')) return imageResponse(true);
    if (url.includes('World_Imagery')) return imageResponse(true);
    return imageResponse(false);
  };

  try {
    const mapCore = new MapCore({ storage: { getItem: () => null, setItem() {} } });
    mapCore.init();
    await mapCore.validateOperationalSources();

    const status = mapCore.getOperationalSourceStatus();
    assert.equal(status.ifrDistinctActiveSources, true);
    assert.equal(status.aviation['base-ifr-low'].degraded, false);
    assert.equal(status.aviation['base-ifr-high'].degraded, false);
    assert.notEqual(status.aviation['base-ifr-low'].activeUrl, status.aviation['base-ifr-high'].activeUrl);
  } finally {
    globalThis.L = priorL;
    globalThis.fetch = priorFetch;
    globalThis.document = priorDocument;
  }
});

test('degraded mode is surfaced when IFR Low/High collapse to same fallback URL', async () => {
  const priorL = globalThis.L;
  const priorFetch = globalThis.fetch;
  const priorDocument = globalThis.document;
  globalThis.L = createLeafletStub();
  globalThis.document = undefined;

  globalThis.fetch = async (url) => {
    if (url.includes('IFR_AreaLow')) return imageResponse(false);
    if (url.includes('IFR_High')) return imageResponse(false);
    if (url.includes('World_Navigation_Charts')) return imageResponse(true);
    if (url.includes('World_Imagery')) return imageResponse(true);
    return imageResponse(false);
  };

  try {
    const mapCore = new MapCore({ storage: { getItem: () => null, setItem() {} } });
    mapCore.init();
    await mapCore.validateOperationalSources();

    const status = mapCore.getOperationalSourceStatus();
    assert.equal(status.ifrDistinctActiveSources, false);
    assert.equal(status.aviation['base-ifr-low'].degraded, true);
    assert.equal(status.aviation['base-ifr-high'].degraded, true);
    assert.equal(status.aviation['base-ifr-low'].activeUrl, status.aviation['base-ifr-high'].activeUrl);
  } finally {
    globalThis.L = priorL;
    globalThis.fetch = priorFetch;
    globalThis.document = priorDocument;
  }
});
