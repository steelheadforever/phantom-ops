# 2026-02-21 — Local VFR/IFR + Airspace Overlay Fix

## Summary
Resolved two runtime issues that made chart/airspace overlays appear "broken" when serving Phantom locally.

## Root causes

1. **VFR/IFR base layers were pointed at non-working ArcGIS endpoints for local unauthenticated use**
   - Existing manifest URLs targeted `services6.arcgis.com/.../VFR_Sectional|IFR_*` paths that currently return ArcGIS `Invalid URL` (400) for those chart map services.
   - The equivalent `tiles.arcgis.com/...` services for those chart names exist but are marked `"access":"SECURE"`, so they are not usable anonymously from local LAN-hosted Phantom.

2. **Airspace overlay was loaded but never made visible by default**
   - `MapCore` registered the airspace layer and loaded data, but did not add/show it at init.
   - Result: users saw no airspace until manually enabling overlay control.

## Changes made

### 1) Chart source manifest URL fix (functional public fallback)
- File: `src/config/base-layer-manifest.js`
- Updated `base-vfr-sectional`, `base-ifr-low`, and `base-ifr-high` tile URLs to public ArcGIS navigation chart tiles:
  - `https://services.arcgisonline.com/ArcGIS/rest/services/Specialty/World_Navigation_Charts/MapServer/tile/{z}/{y}/{x}`

### 2) Airspace endpoint + default visibility fix
- File: `src/services/airspace/AirspaceSourceService.js`
- Updated default endpoint from sample USA states layer to FAA-related special-use airspace GeoJSON query:
  - `https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/Special_Use_Airspace/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson`

- File: `src/map/MapCore.js`
- Added default visibility enablement after registration:
  - `this.layerManager.setLayerVisibility('airspace-arcgis', true);`

## Test updates

1. `tests/unit/base-layer-manifest-and-preferences.unit.test.js`
   - Added assertion that VFR manifest URL resolves to the expected public navigation chart service host/path.

2. `tests/unit/airspace-source-mapping.unit.test.js`
   - Added assertion that default airspace endpoint targets `Special_Use_Airspace` GeoJSON query.

## Verification performed

- Automated tests:
  - `npm test`
  - Result: **17/17 passing**

- Endpoint/runtime sanity checks:
  - Navigation chart tile sample request returns `200 image/jpeg`.
  - Airspace GeoJSON endpoint returns `FeatureCollection` with CORS-compatible response.

## Caveats

- VFR/IFR labels now map to a **public navigation chart fallback source** for local reliability.
- If product requires strict FAA-distinct VFR vs IFR low/high visual products, a non-secure/publicly licensed endpoint set (or backend proxy/token strategy) will still be needed in follow-on work.
