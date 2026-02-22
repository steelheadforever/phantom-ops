import { resolveHealthyGeoJsonEndpoint } from '../runtimeSourceValidation.js';

export const DEFAULT_ARCGIS_AIRSPACE_GEOJSON_ENDPOINT =
  'https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/Special_Use_Airspace/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson';

export class ArcGISAirspaceSource {
  constructor({
    endpoint = DEFAULT_ARCGIS_AIRSPACE_GEOJSON_ENDPOINT,
    fallbackEndpoints = [],
    fetchImpl,
  } = {}) {
    this.endpoint = endpoint;
    this.fallbackEndpoints = fallbackEndpoints;
    this.fetchImpl = fetchImpl ?? ((...args) => fetch(...args));
    this.endpointEvidence = [];
  }

  async resolveEndpoint() {
    const { endpoint, evidence } = await resolveHealthyGeoJsonEndpoint(
      this.endpoint,
      this.fallbackEndpoints,
      { fetchImpl: this.fetchImpl },
    );

    this.endpoint = endpoint;
    this.endpointEvidence = evidence;
    return endpoint;
  }

  async fetchGeoJson() {
    if (typeof this.fetchImpl !== 'function') {
      throw new Error('fetch is not available for ArcGISAirspaceSource');
    }

    await this.resolveEndpoint();

    const response = await this.fetchImpl(this.endpoint);
    if (!response.ok) {
      throw new Error(`ArcGIS airspace request failed: ${response.status}`);
    }

    const geojson = await response.json();
    if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
      throw new Error('ArcGIS airspace response is not a GeoJSON FeatureCollection');
    }

    if (geojson.features.length === 0) {
      throw new Error('ArcGIS airspace response returned zero features');
    }

    return geojson;
  }
}

export class AirspaceSourceService {
  constructor(sourceAdapter) {
    this.sourceAdapter = sourceAdapter;
  }

  async loadAirspaceFeatureCollection() {
    return this.sourceAdapter.fetchGeoJson();
  }
}
