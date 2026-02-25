const BASE = 'https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services';
const AIRPORT_ENDPOINT = `${BASE}/US_Airport/FeatureServer/0/query`;
const RUNWAY_ENDPOINT  = `${BASE}/Runways/FeatureServer/0/query`;

const MIN_LENGTH = 5000; // feet
const MIN_WIDTH  = 75;   // feet

// Texas bounding box
const TX_BBOX = JSON.stringify({ xmin: -106.65, ymin: 25.84, xmax: -93.51, ymax: 36.50 });

/**
 * Fetch Texas airfields that have at least one runway >= 5000 ft × 75 ft.
 *
 * Strategy:
 *  1. Parallel-fetch all TX airports (by STATE='TX') and qualifying runways (spatial TX bbox).
 *  2. Build a Set of AIRPORT_IDs from qualifying runways.
 *  3. Return only airports whose GLOBAL_ID is in that Set.
 *
 * @returns {Promise<GeoJSON.Feature[]>} Airport point features with properties:
 *   GLOBAL_ID, IDENT, NAME, ICAO_ID, MIL_CODE
 */
export async function fetchTexasAirfields() {
  const [airports, qualifyingIds] = await Promise.all([
    _fetchTexasAirports(),
    _fetchQualifyingRunwayIds(),
  ]);

  return airports.filter(f => qualifyingIds.has(f.properties?.GLOBAL_ID));
}

async function _fetchTexasAirports() {
  // Service caps at 1000 records/page; TX has 2000+ airports so we must paginate.
  const PAGE_SIZE = 1000;
  const features = [];
  let offset = 0;

  while (true) {
    const params = new URLSearchParams({
      where: "STATE = 'TX'",
      outFields: 'GLOBAL_ID,IDENT,NAME,ICAO_ID,MIL_CODE',
      returnGeometry: 'true',
      outSR: '4326',
      resultRecordCount: String(PAGE_SIZE),
      resultOffset: String(offset),
      f: 'geojson',
    });

    const resp = await fetch(`${AIRPORT_ENDPOINT}?${params}`);
    if (!resp.ok) throw new Error(`Airport fetch failed: ${resp.status}`);
    const json = await resp.json();
    const page = json.features ?? [];
    features.push(...page);

    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return features;
}

async function _fetchQualifyingRunwayIds() {
  const params = new URLSearchParams({
    where: `LENGTH >= ${MIN_LENGTH} AND WIDTH >= ${MIN_WIDTH}`,
    geometry: TX_BBOX,
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'AIRPORT_ID',
    returnGeometry: 'false',
    resultRecordCount: '2000',
    f: 'json',
  });

  const resp = await fetch(`${RUNWAY_ENDPOINT}?${params}`);
  if (!resp.ok) throw new Error(`Runway fetch failed: ${resp.status}`);
  const json = await resp.json();
  return new Set(
    (json.features ?? []).map(f => f.attributes?.AIRPORT_ID).filter(Boolean),
  );
}
