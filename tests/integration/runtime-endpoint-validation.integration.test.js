import test from 'node:test';
import assert from 'node:assert/strict';

import { BASE_LAYER_SOURCE_DEFINITIONS } from '../../src/map/baseLayerSources.js';
import {
  validateGeoJsonEndpoint,
  validateTileEndpoint,
} from '../../src/services/runtimeSourceValidation.js';
import { DEFAULT_ARCGIS_AIRSPACE_GEOJSON_ENDPOINT } from '../../src/services/airspace/AirspaceSourceService.js';

const NETWORK_TEST_TIMEOUT_MS = 20000;

test('configured IFR tile endpoints return successful tile responses', { timeout: NETWORK_TEST_TIMEOUT_MS }, async () => {
  const ifrDefinitions = BASE_LAYER_SOURCE_DEFINITIONS.filter((item) => item.id.startsWith('base-ifr-'));
  assert.ok(ifrDefinitions.length >= 2);

  for (const definition of ifrDefinitions) {
    const result = await validateTileEndpoint(definition.url, { timeoutMs: 8000 });
    assert.equal(result.ok, true, `IFR tile probe failed for ${definition.id}: ${JSON.stringify(result)}`);
    assert.equal(result.status, 200);
  }
});

test('configured airspace endpoint returns non-empty GeoJSON FeatureCollection', { timeout: NETWORK_TEST_TIMEOUT_MS }, async () => {
  const result = await validateGeoJsonEndpoint(DEFAULT_ARCGIS_AIRSPACE_GEOJSON_ENDPOINT, { timeoutMs: 12000 });
  assert.equal(result.ok, true, `Airspace endpoint failed: ${JSON.stringify(result)}`);
  assert.equal(result.status, 200);
  assert.ok(result.featureCount > 0);
});
