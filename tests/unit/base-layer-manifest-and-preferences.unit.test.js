import test from 'node:test';
import assert from 'node:assert/strict';

import { BASE_LAYER_MANIFEST } from '../../src/config/base-layer-manifest.js';
import { createBaseLayerSourceDefinitions } from '../../src/map/baseLayerSources.js';
import {
  BASE_LAYER_STORAGE_KEY,
  persistBaseLayerId,
  resolveInitialBaseLayerId,
} from '../../src/map/baseLayerPreferences.js';

test('persisted base layer restore selects stored id when valid', () => {
  const definitions = createBaseLayerSourceDefinitions(BASE_LAYER_MANIFEST);
  const storage = {
    getItem(key) {
      assert.equal(key, BASE_LAYER_STORAGE_KEY);
      return 'base-vfr-sectional';
    },
  };

  const initial = resolveInitialBaseLayerId({ definitions, storage });
  assert.equal(initial, 'base-vfr-sectional');
});

test('stored layer fallback uses default when stored id is missing or invalid', () => {
  const definitions = createBaseLayerSourceDefinitions(BASE_LAYER_MANIFEST);

  const missingStorage = { getItem: () => null };
  const invalidStorage = { getItem: () => 'base-does-not-exist' };

  assert.equal(resolveInitialBaseLayerId({ definitions, storage: missingStorage }), 'base-satellite');
  assert.equal(resolveInitialBaseLayerId({ definitions, storage: invalidStorage }), 'base-satellite');
});

test('manifest parsing creates expected base-layer definitions and metadata wiring', () => {
  const definitions = createBaseLayerSourceDefinitions(BASE_LAYER_MANIFEST);

  assert.ok(definitions.length >= 6);

  const vfr = definitions.find((item) => item.id === 'base-vfr-sectional');
  assert.ok(vfr);
  assert.equal(vfr.label, 'VFR Sectional (FAA)');
  assert.equal(vfr.options.maxZoom, 12);
  assert.match(vfr.url, /^https:\/\/services\.arcgisonline\.com\/ArcGIS\/rest\/services\/Specialty\/World_Navigation_Charts\//);
  assert.equal(vfr.metadata.version, 'vfr-sectional');
  assert.equal(vfr.metadata.schemaVersion, BASE_LAYER_MANIFEST.schemaVersion);
});

test('persistBaseLayerId writes selected layer id to local storage', () => {
  let key = null;
  let value = null;
  const storage = {
    setItem(nextKey, nextValue) {
      key = nextKey;
      value = nextValue;
    },
  };

  persistBaseLayerId(storage, 'base-ifr-low');

  assert.equal(key, BASE_LAYER_STORAGE_KEY);
  assert.equal(value, 'base-ifr-low');
});
