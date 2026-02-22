const CLASS_PATHS = {
  B: '/data/airspace/class-b.geojson',
  C: '/data/airspace/class-c.geojson',
  D: '/data/airspace/class-d.geojson',
};

export class ClassAirspaceSource {
  constructor({ fetchImpl, basePath = '' } = {}) {
    this.fetchImpl = fetchImpl ?? ((...args) => fetch(...args));
    this.basePath = basePath;
  }

  async fetchClass(airspaceClass) {
    const path = CLASS_PATHS[airspaceClass];
    if (!path) throw new Error(`Unknown airspace class: ${airspaceClass}`);

    const url = `${this.basePath}${path}`;
    const response = await this.fetchImpl(url);

    if (!response.ok) {
      throw new Error(`Class ${airspaceClass} airspace request failed: ${response.status}`);
    }

    const geojson = await response.json();
    if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
      throw new Error(`Class ${airspaceClass} response is not a GeoJSON FeatureCollection`);
    }

    return geojson;
  }

  async fetchAllClasses() {
    const [classB, classC, classD] = await Promise.all([
      this.fetchClass('B'),
      this.fetchClass('C'),
      this.fetchClass('D'),
    ]);

    return { classB, classC, classD };
  }
}
