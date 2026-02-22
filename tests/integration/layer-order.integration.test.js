import test from 'node:test';
import assert from 'node:assert/strict';

import { LayerManager } from '../../src/map/LayerManager.js';
import { LAYER_Z_INDEX, ORDERED_STACK, PANE_IDS } from '../../src/map/layerZIndex.js';

function createMockMap() {
  const panes = new Map();
  const activeLayers = new Set();

  return {
    panes,
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
  };
}

function createMockLayer() {
  return {
    addTo(map) {
      map.__added = (map.__added || 0) + 1;
      return this;
    },
    setZIndex() {},
    setOpacity() {},
  };
}

test('enforces authoritative pane z-order: base < GARS < airspace < drawings', () => {
  const map = createMockMap();
  const manager = new LayerManager(map).initializePanes();

  assert.equal(map.getPane(PANE_IDS.BASE_MAP).style.zIndex, String(LAYER_Z_INDEX.BASE_MAP));
  assert.equal(map.getPane(PANE_IDS.GARS).style.zIndex, String(LAYER_Z_INDEX.GARS));
  assert.equal(map.getPane(PANE_IDS.AIRSPACE).style.zIndex, String(LAYER_Z_INDEX.AIRSPACE));
  assert.equal(map.getPane(PANE_IDS.DRAWINGS).style.zIndex, String(LAYER_Z_INDEX.DRAWINGS));

  assert.deepEqual(manager.getRenderOrder(), ORDERED_STACK);
});

test('registration order does not alter deterministic render order', () => {
  const map = createMockMap();
  const manager = new LayerManager(map).initializePanes();

  manager.registerLayer('a', createMockLayer(), 'airspace');
  manager.registerLayer('b', createMockLayer(), 'base');
  manager.registerLayer('c', createMockLayer(), 'drawings');
  manager.registerLayer('d', createMockLayer(), 'gars');

  assert.equal(manager.getLayerMeta('b').zIndex, LAYER_Z_INDEX.BASE_MAP);
  assert.equal(manager.getLayerMeta('d').zIndex, LAYER_Z_INDEX.GARS);
  assert.equal(manager.getLayerMeta('a').zIndex, LAYER_Z_INDEX.AIRSPACE);
  assert.equal(manager.getLayerMeta('c').zIndex, LAYER_Z_INDEX.DRAWINGS);
});
