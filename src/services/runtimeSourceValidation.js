// z=8 tile over Texas (Randolph AFB area) — within range of all FAA chart services (minLOD 7–8)
const DEFAULT_TILE_PROBE = Object.freeze({ z: 8, x: 58, y: 106 });

function withTimeout(fetchImpl, timeoutMs) {
  return async (url) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };
}

export function buildTileProbeUrl(template, probe = DEFAULT_TILE_PROBE) {
  return template
    .replace('{z}', String(probe.z))
    .replace('{x}', String(probe.x))
    .replace('{y}', String(probe.y));
}

export async function validateTileEndpoint(template, { fetchImpl = (...args) => fetch(...args), timeoutMs = 8000 } = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch is not available for tile validation');
  }

  const probeUrl = buildTileProbeUrl(template);
  const timedFetch = withTimeout(fetchImpl, timeoutMs);

  try {
    const response = await timedFetch(probeUrl);
    const contentType = response.headers?.get?.('content-type') ?? '';
    const ok = response.ok && /image\//i.test(contentType);
    return { ok, status: response.status, contentType, probeUrl, template };
  } catch (error) {
    return { ok: false, status: 0, contentType: '', probeUrl, template, error: error.message };
  }
}

export async function resolveHealthyTileEndpoint(primaryTemplate, fallbackTemplates = [], options = {}) {
  const candidates = [primaryTemplate, ...fallbackTemplates].filter(Boolean);
  const evidence = [];

  for (const template of candidates) {
    const result = await validateTileEndpoint(template, options);
    evidence.push(result);
    if (result.ok) {
      return { template, evidence };
    }
  }

  return { template: primaryTemplate, evidence };
}

export async function validateGeoJsonEndpoint(endpoint, { fetchImpl = (...args) => fetch(...args), timeoutMs = 8000 } = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch is not available for geojson validation');
  }

  const timedFetch = withTimeout(fetchImpl, timeoutMs);

  try {
    const response = await timedFetch(endpoint);
    if (!response.ok) {
      return { ok: false, status: response.status, endpoint, featureCount: 0 };
    }

    const geojson = await response.json();
    const featureCount = Array.isArray(geojson?.features) ? geojson.features.length : 0;
    const ok = geojson?.type === 'FeatureCollection' && featureCount > 0;

    return { ok, status: response.status, endpoint, featureCount };
  } catch (error) {
    return { ok: false, status: 0, endpoint, featureCount: 0, error: error.message };
  }
}

export async function resolveHealthyGeoJsonEndpoint(primaryEndpoint, fallbackEndpoints = [], options = {}) {
  const candidates = [primaryEndpoint, ...fallbackEndpoints].filter(Boolean);
  const evidence = [];

  for (const endpoint of candidates) {
    const result = await validateGeoJsonEndpoint(endpoint, options);
    evidence.push(result);
    if (result.ok) {
      return { endpoint, evidence };
    }
  }

  return { endpoint: primaryEndpoint, evidence };
}
