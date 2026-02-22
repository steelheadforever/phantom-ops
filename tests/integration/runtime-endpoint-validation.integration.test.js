import test from 'node:test';
import assert from 'node:assert/strict';

import { BASE_LAYER_SOURCE_DEFINITIONS } from '../../src/map/baseLayerSources.js';
import {
  resolveHealthyTileEndpoint,
  validateGeoJsonEndpoint,
  validateTileEndpoint,
} from '../../src/services/runtimeSourceValidation.js';
import { DEFAULT_ARCGIS_AIRSPACE_GEOJSON_ENDPOINT } from '../../src/services/airspace/AirspaceSourceService.js';

const NETWORK_TEST_TIMEOUT_MS = 20000;

test('IFR runtime source resolution returns healthy active source and surfaces degraded mode when collapsed', { timeout: NETWORK_TEST_TIMEOUT_MS }, async () => {
  const ifrDefinitions = BASE_LAYER_SOURCE_DEFINITIONS.filter((item) => item.id.startsWith('base-ifr-'));
  assert.ok(ifrDefinitions.length >= 2);

  const resolvedById = new Map();

  for (const definition of ifrDefinitions) {
    const primary = await validateTileEndpoint(definition.url, { timeoutMs: 8000 });
    const resolved = await resolveHealthyTileEndpoint(definition.url, definition.fallbackUrls ?? [], { timeoutMs: 8000 });
    const active = await validateTileEndpoint(resolved.template, { timeoutMs: 8000 });

    assert.equal(active.ok, true, `No healthy active tile source for ${definition.id}: ${JSON.stringify({ primary, resolved, active })}`);

    resolvedById.set(definition.id, {
      activeUrl: resolved.template,
      degraded: resolved.template !== definition.url,
    });
  }

  const ifrLow = resolvedById.get('base-ifr-low');
  const ifrHigh = resolvedById.get('base-ifr-high');
  assert.ok(ifrLow && ifrHigh);

  if (ifrLow.activeUrl === ifrHigh.activeUrl) {
    assert.equal(ifrLow.degraded || ifrHigh.degraded, true);
  } else {
    assert.notEqual(ifrLow.activeUrl, ifrHigh.activeUrl);
  }
});

test('configured airspace endpoint returns non-empty GeoJSON FeatureCollection', { timeout: NETWORK_TEST_TIMEOUT_MS }, async () => {
  const result = await validateGeoJsonEndpoint(DEFAULT_ARCGIS_AIRSPACE_GEOJSON_ENDPOINT, { timeoutMs: 12000 });
  assert.equal(result.ok, true, `Airspace endpoint failed: ${JSON.stringify(result)}`);
  assert.equal(result.status, 200);
  assert.ok(result.featureCount > 0);
});
