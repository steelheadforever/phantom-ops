const AIRSPACE_COLORS = Object.freeze({
  classBCD: '#3da5ff',
  moa: '#8e7dff',
  alert: '#ffb347',
  restricted: '#ff5f5f',
  fallback: '#d6dee7',
});

const BASE_STYLE = Object.freeze({
  opacity: 0.95,
  fill: true,
  fillOpacity: 0.26,
});

export const AIRSPACE_STYLE_BY_KIND = Object.freeze({
  classBCD: Object.freeze({ ...BASE_STYLE, color: AIRSPACE_COLORS.classBCD, fillColor: AIRSPACE_COLORS.classBCD, weight: 1.8 }),
  moa: Object.freeze({ ...BASE_STYLE, color: AIRSPACE_COLORS.moa, fillColor: AIRSPACE_COLORS.moa, weight: 1.8 }),
  alert: Object.freeze({ ...BASE_STYLE, color: AIRSPACE_COLORS.alert, fillColor: AIRSPACE_COLORS.alert, weight: 1.8 }),
  restricted: Object.freeze({ ...BASE_STYLE, color: AIRSPACE_COLORS.restricted, fillColor: AIRSPACE_COLORS.restricted, weight: 2.0 }),
  fallback: Object.freeze({ ...BASE_STYLE, color: AIRSPACE_COLORS.fallback, fillColor: AIRSPACE_COLORS.fallback, weight: 1.4, fillOpacity: 0.2 }),
});

function normalizeValue(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase();
}

function resolveRawType(properties = {}) {
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

  if (/\bMOA\b|\bMILITARY OPERATIONS AREA\b/.test(raw) || raw === 'M') {
    return 'moa';
  }

  if (/\bALERT\b/.test(raw) || raw === 'A' || /\bA-\d+/.test(raw)) {
    return 'alert';
  }

  if (/\bRESTRICTED\b|\bPROHIBITED\b|\bWARNING\b|\bR-\d+/.test(raw) || /^R$|^P$|^W$/.test(raw)) {
    return 'restricted';
  }

  return 'fallback';
}

export function getAirspaceStyle(feature) {
  const kind = mapAirspaceKind(feature?.properties ?? {});
  return AIRSPACE_STYLE_BY_KIND[kind] ?? AIRSPACE_STYLE_BY_KIND.fallback;
}
