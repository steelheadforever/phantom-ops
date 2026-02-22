const AIRSPACE_COLORS = Object.freeze({
  classBCD: '#3da5ff',
  moa: '#8e7dff',
  alert: '#ffb347',
  restricted: '#ff5f5f',
  fallback: '#8a8a8a',
});

export const AIRSPACE_STYLE_BY_KIND = Object.freeze({
  classBCD: Object.freeze({ color: AIRSPACE_COLORS.classBCD, weight: 1.5, fillOpacity: 0.16 }),
  moa: Object.freeze({ color: AIRSPACE_COLORS.moa, weight: 1.5, fillOpacity: 0.16 }),
  alert: Object.freeze({ color: AIRSPACE_COLORS.alert, weight: 1.5, fillOpacity: 0.16 }),
  restricted: Object.freeze({ color: AIRSPACE_COLORS.restricted, weight: 1.5, fillOpacity: 0.16 }),
  fallback: Object.freeze({ color: AIRSPACE_COLORS.fallback, weight: 1.0, fillOpacity: 0.1 }),
});

function normalizeValue(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase();
}

function resolveRawType(properties = {}) {
  // TODO(WP-E): tighten this field mapping once the selected FAA-native dataset schema is locked.
  // ArcGIS sources in the wild use varying keys (TYPE, TYPE_CODE, CLASS, LOCAL_TYPE, etc.).
  const candidates = [
    properties.TYPE,
    properties.TYPE_CODE,
    properties.CLASS,
    properties.CLASSIFICATION,
    properties.AIRSPACE_TYPE,
    properties.LOCAL_TYPE,
    properties.NAME,
  ];

  return candidates
    .map(normalizeValue)
    .find(Boolean) || '';
}

export function mapAirspaceKind(properties = {}) {
  const raw = resolveRawType(properties);

  if (/\bCLASS\s*[BCD]\b/.test(raw) || /^B$|^C$|^D$/.test(raw) || /\bCLASS_B\b|\bCLASS_C\b|\bCLASS_D\b/.test(raw)) {
    return 'classBCD';
  }

  if (/\bMOA\b|\bMILITARY OPERATIONS AREA\b/.test(raw)) {
    return 'moa';
  }

  if (/\bALERT\b/.test(raw)) {
    return 'alert';
  }

  if (/\bRESTRICTED\b|\bR-\d+/.test(raw)) {
    return 'restricted';
  }

  return 'fallback';
}

export function getAirspaceStyle(feature) {
  const kind = mapAirspaceKind(feature?.properties ?? {});
  return AIRSPACE_STYLE_BY_KIND[kind] ?? AIRSPACE_STYLE_BY_KIND.fallback;
}
