export const DEFAULT_ARCGIS_AIRSPACE_GEOJSON_ENDPOINT =
  'https://sampleserver6.arcgisonline.com/arcgis/rest/services/USA/MapServer/2/query?where=1%3D1&outFields=*&f=geojson';

export class ArcGISAirspaceSource {
  constructor({ endpoint = DEFAULT_ARCGIS_AIRSPACE_GEOJSON_ENDPOINT, fetchImpl = globalThis.fetch } = {}) {
    this.endpoint = endpoint;
    this.fetchImpl = fetchImpl;
  }

  async fetchGeoJson() {
    if (typeof this.fetchImpl !== 'function') {
      throw new Error('fetch is not available for ArcGISAirspaceSource');
    }

    const response = await this.fetchImpl(this.endpoint);
    if (!response.ok) {
      throw new Error(`ArcGIS airspace request failed: ${response.status}`);
    }

    const geojson = await response.json();
    if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
      throw new Error('ArcGIS airspace response is not a GeoJSON FeatureCollection');
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
