import test from 'node:test';
import assert from 'node:assert/strict';

import { LayerManager } from '../../src/map/LayerManager.js';
import { BASE_LAYER_SOURCE_DEFINITIONS } from '../../src/map/baseLayerSources.js';

function createMockMap() {
  const panes = new Map();
  const activeLayers = new Set();

  return {
    getPane(id) {
      return panes.get(id);
    },
    createPane(id) {
      const pane = { style: {} };
      panes.set(id, pane);
      return pane;
    },
    hasLayer(layer) {
      return activeLayers.has(layer);
    },
    removeLayer(layer) {
      activeLayers.delete(layer);
    },
    __activeLayers: activeLayers,
  };
}

function createMockLayer(name) {
  return {
    name,
    addTo(map) {
      map.__activeLayers.add(this);
      return this;
    },
    setZIndex() {},
    setOpacity() {},
  };
}

test('base layer definitions include satellite, VFR, and IFR options', () => {
  const ids = BASE_LAYER_SOURCE_DEFINITIONS.map((item) => item.id);

  assert.ok(ids.includes('base-satellite'));
  assert.ok(ids.includes('base-vfr-sectional'));
  assert.ok(ids.includes('base-ifr-low'));
  assert.ok(ids.includes('base-ifr-high'));
});

test('base layer selection keeps one active base imagery layer at a time', () => {
  const map = createMockMap();
  const manager = new LayerManager(map).initializePanes();

  const satellite = createMockLayer('satellite');
  const vfr = createMockLayer('vfr');
  const ifrLow = createMockLayer('ifr-low');

  manager.registerLayer('base-satellite', satellite, 'base');
  manager.registerLayer('base-vfr-sectional', vfr, 'base');
  manager.registerLayer('base-ifr-low', ifrLow, 'base');

  manager.showLayer('base-satellite');
  assert.equal(manager.getActiveBaseLayerId(), 'base-satellite');
  assert.equal(manager.getLayerMeta('base-satellite').visible, true);

  manager.showLayer('base-vfr-sectional');
  assert.equal(manager.getActiveBaseLayerId(), 'base-vfr-sectional');
  assert.equal(manager.getLayerMeta('base-satellite').visible, false);
  assert.equal(manager.getLayerMeta('base-vfr-sectional').visible, true);

  manager.showLayer('base-ifr-low');
  assert.equal(manager.getActiveBaseLayerId(), 'base-ifr-low');
  assert.equal(manager.getLayerMeta('base-vfr-sectional').visible, false);
  assert.equal(manager.getLayerMeta('base-ifr-low').visible, true);
});
