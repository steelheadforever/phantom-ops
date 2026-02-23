const NAVAID_ENDPOINT =
  'https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/NAVAIDSystem/FeatureServer/0/query';

const FIX_ENDPOINT =
  'https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/DesignatedPoint/FeatureServer/0/query';

/**
 * Fetch all US navaids from FAA ADDS ArcGIS FeatureServer.
 * Paginates automatically (max 1000 records/page, ~3 pages for full US).
 * @returns {Promise<GeoJSON.Feature[]>}
 */
export async function fetchAllNavaids() {
  const PAGE_SIZE = 1000;
  const fields = 'IDENT,NAME_TXT,CLASS_TXT,STATUS';
  const features = [];
  let offset = 0;

  while (true) {
    const params = new URLSearchParams({
      where: '1=1',
      outFields: fields,
      returnGeometry: 'true',
      resultRecordCount: String(PAGE_SIZE),
      resultOffset: String(offset),
      outSR: '4326',
      f: 'geojson',
    });

    const resp = await fetch(`${NAVAID_ENDPOINT}?${params}`);
    if (!resp.ok) throw new Error(`Navaid fetch failed: ${resp.status}`);

    const json = await resp.json();
    const page = json.features ?? [];
    features.push(...page);

    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return features;
}

/**
 * Fetch IFR fixes within a viewport bounding box.
 * Uses ArcGIS spatial envelope query so only visible-area records are returned.
 * @param {{ north: number, south: number, east: number, west: number }} bounds
 * @param {'H'|'L'} chartFilter - 'H' for high enroute, 'L' for low enroute
 * @param {AbortSignal} [signal]
 * @returns {Promise<GeoJSON.Feature[]>}
 */
export async function fetchFixesInBounds(bounds, chartFilter, signal) {
  const geom = JSON.stringify({
    xmin: bounds.west,
    ymin: bounds.south,
    xmax: bounds.east,
    ymax: bounds.north,
  });

  const params = new URLSearchParams({
    where: `CHARTSTRUCTURES_TXT LIKE '%${chartFilter}%'`,
    geometry: geom,
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'IDENT_TXT,NAME_TXT,TYPE_CODE,MIL_CODE',
    returnGeometry: 'true',
    resultRecordCount: '2000',
    outSR: '4326',
    f: 'geojson',
  });

  const resp = await fetch(`${FIX_ENDPOINT}?${params}`, { signal });
  if (!resp.ok) throw new Error(`Fix fetch failed: ${resp.status}`);

  const json = await resp.json();
  return json.features ?? [];
}
