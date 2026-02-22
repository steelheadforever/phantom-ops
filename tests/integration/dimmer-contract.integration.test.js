import test from 'node:test';
import assert from 'node:assert/strict';

import { LayerManager } from '../../src/map/LayerManager.js';

function createMockMap() {
  const panes = new Map();

  return {
    getPane(id) {
      return panes.get(id);
    },
    createPane(id) {
      const pane = { style: {} };
      panes.set(id, pane);
      return pane;
    },
    hasLayer() {
      return false;
    },
    removeLayer() {},
  };
}

function createOpacitySpyLayer() {
  const calls = [];
  return {
    calls,
    addTo() {
      return this;
    },
    setOpacity(value) {
      calls.push(value);
    },
    setZIndex() {},
  };
}

test('dimmer affects map imagery only (base layers)', () => {
  const map = createMockMap();
  const manager = new LayerManager(map).initializePanes();

  const base = createOpacitySpyLayer();
  const gars = createOpacitySpyLayer();
  const airspace = createOpacitySpyLayer();

  manager.registerLayer('satellite', base, 'base');
  manager.registerLayer('gars-overlay', gars, 'gars');
  manager.registerLayer('airspace-overlay', airspace, 'airspace');

  const opacity = manager.setBaseImageryDim(40);

  assert.equal(opacity, 0.6);
  assert.deepEqual(base.calls, [0.6]);
  assert.deepEqual(gars.calls, []);
  assert.deepEqual(airspace.calls, []);
});
