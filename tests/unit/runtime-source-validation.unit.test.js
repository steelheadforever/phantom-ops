import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildTileProbeUrl,
  resolveHealthyGeoJsonEndpoint,
  resolveHealthyTileEndpoint,
} from '../../src/services/runtimeSourceValidation.js';

test('tile probe url substitutes z/y/x placeholders in ArcGIS order', () => {
  const url = buildTileProbeUrl('https://example.test/tile/{z}/{y}/{x}');
  assert.equal(url, 'https://example.test/tile/6/25/16');
});

test('tile endpoint resolver falls back when primary probe fails', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes('primary')) {
      return { ok: false, status: 503, headers: { get: () => 'text/plain' } };
    }
    return { ok: true, status: 200, headers: { get: () => 'image/jpeg' } };
  };

  const { template, evidence } = await resolveHealthyTileEndpoint(
    'https://primary.test/tile/{z}/{y}/{x}',
    ['https://fallback.test/tile/{z}/{y}/{x}'],
    { fetchImpl },
  );

  assert.equal(template, 'https://fallback.test/tile/{z}/{y}/{x}');
  assert.equal(evidence.length, 2);
  assert.ok(calls[0].includes('primary.test'));
  assert.ok(calls[1].includes('fallback.test'));
});

test('geojson endpoint resolver falls back when primary has zero features', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('primary')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ type: 'FeatureCollection', features: [] }),
      };
    }

    return {
      ok: true,
      status: 200,
      json: async () => ({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: null }] }),
    };
  };

  const { endpoint, evidence } = await resolveHealthyGeoJsonEndpoint(
    'https://primary.test/airspace.geojson',
    ['https://fallback.test/airspace.geojson'],
    { fetchImpl },
  );

  assert.equal(endpoint, 'https://fallback.test/airspace.geojson');
  assert.equal(evidence.length, 2);
  assert.equal(evidence[0].featureCount, 0);
  assert.equal(evidence[1].featureCount, 1);
});
