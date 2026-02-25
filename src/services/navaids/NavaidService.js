const NAVAID_ENDPOINT =
  'https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/NAVAIDSystem/FeatureServer/0/query';

const FIX_ENDPOINT =
  'https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/DesignatedPoint/FeatureServer/0/query';

/**
 * Search for a navaid or IFR fix by exact IDENT, CONUS-wide.
 * Tries navaids first, then IFR fixes.
 * @param {string} ident - uppercase identifier (e.g. 'SAT', 'LUVLA')
 * @returns {Promise<{lat: number, lon: number, name: string, type: string} | null>}
 */
export async function searchPointByIdent(ident) {
  // Sanitise: aviation idents are alphanumeric only
  const safe = ident.replace(/[^A-Z0-9]/g, '');
  if (!safe) return null;

  // Query navaids and fixes in parallel
  const [navResp, fixResp] = await Promise.all([
    fetch(`${NAVAID_ENDPOINT}?${new URLSearchParams({
      where: `IDENT = '${safe}'`,
      outFields: 'IDENT,NAME_TXT,CLASS_TXT',
      returnGeometry: 'true',
      outSR: '4326',
      f: 'geojson',
    })}`),
    fetch(`${FIX_ENDPOINT}?${new URLSearchParams({
      where: `IDENT_TXT = '${safe}'`,
      outFields: 'IDENT_TXT,NAME_TXT,TYPE_CODE',
      returnGeometry: 'true',
      outSR: '4326',
      f: 'geojson',
    })}`),
  ]);

  if (navResp.ok) {
    const navJson = await navResp.json();
    const f = navJson.features?.[0];
    if (f) {
      const [lon, lat] = f.geometry.coordinates;
      return { lat, lon, name: f.properties.NAME_TXT ?? safe, type: f.properties.CLASS_TXT ?? 'NAVAID' };
    }
  }

  if (fixResp.ok) {
    const fixJson = await fixResp.json();
    const f = fixJson.features?.[0];
    if (f) {
      const [lon, lat] = f.geometry.coordinates;
      return { lat, lon, name: f.properties.NAME_TXT ?? safe, type: f.properties.TYPE_CODE ?? 'FIX' };
    }
  }

  return null;
}

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
