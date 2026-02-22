import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AirspaceSourceService,
  ArcGISAirspaceSource,
  DEFAULT_ARCGIS_AIRSPACE_GEOJSON_ENDPOINT,
} from '../../src/services/airspace/AirspaceSourceService.js';
import { mapAirspaceKind } from '../../src/services/airspace/airspaceStyle.js';

test('ArcGIS source adapter fetches configured endpoint and returns FeatureCollection', async () => {
  const expected = { type: 'FeatureCollection', features: [] };
  const calls = [];

  const source = new ArcGISAirspaceSource({
    endpoint: 'https://example.test/airspace.geojson',
    fetchImpl: async (url) => {
      calls.push(url);
      return {
        ok: true,
        json: async () => expected,
      };
    },
  });

  const service = new AirspaceSourceService(source);
  const actual = await service.loadAirspaceFeatureCollection();

  assert.deepEqual(actual, expected);
  assert.deepEqual(calls, ['https://example.test/airspace.geojson']);
});

test('default ArcGIS airspace endpoint targets FAA special use airspace geojson query', () => {
  assert.match(DEFAULT_ARCGIS_AIRSPACE_GEOJSON_ENDPOINT, /Special_Use_Airspace\/FeatureServer\/0\/query/);
  assert.match(DEFAULT_ARCGIS_AIRSPACE_GEOJSON_ENDPOINT, /f=geojson/);
});

test('airspace type mapping covers tactical style hooks', () => {
  assert.equal(mapAirspaceKind({ TYPE: 'Class B' }), 'classBCD');
  assert.equal(mapAirspaceKind({ CLASS: 'C' }), 'classBCD');
  assert.equal(mapAirspaceKind({ TYPE_CODE: 'Military Operations Area (MOA)' }), 'moa');
  assert.equal(mapAirspaceKind({ AIRSPACE_TYPE: 'Alert Area' }), 'alert');
  assert.equal(mapAirspaceKind({ NAME: 'R-5107 Restricted Area' }), 'restricted');
  assert.equal(mapAirspaceKind({ TYPE: 'Unknown Experimental' }), 'fallback');
});
