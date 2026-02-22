# WP-E Backbone — ArcGIS Airspace Polygon Foundation

Date: 2026-02-21

## What changed
- Added dedicated airspace source module boundary:
  - `src/services/airspace/AirspaceSourceService.js`
    - `ArcGISAirspaceSource` (configurable endpoint + fetch)
    - `AirspaceSourceService` (adapter boundary for future source swaps)
- Added tactical airspace class/style mapping hooks:
  - `src/services/airspace/airspaceStyle.js`
  - Covers Class B/C/D, MOA, Alert, Restricted, fallback.
- Integrated airspace runtime registration and loading in `MapCore`:
  - Airspace GeoJSON layer registered via `LayerManager` as kind `airspace`
  - Maintains pane/z-order contract (base < GARS < airspace < drawings)
  - Added Leaflet overlays control toggle entry: `Airspace (ArcGIS)`
  - Added `MapCore.setAirspaceVisibility(visible)` API for non-UI callers.
- Preserved dimmer contract (map imagery only):
  - `MapCore.setupDimmer()` now wires through `wireDimmerControl` + `LayerManager.setBaseImageryDim`
  - Removed old full-screen `#dim-overlay` usage from `index.html` and CSS.
- Boot wiring:
  - `src/main.js` now triggers `mapCore.loadAirspaceData()` with non-fatal backbone-mode warning on failure.

## Decisions made
1. **Adapter boundary now, source lock later**
   - ArcGIS is the initial adapter; runtime expects `fetchGeoJson()` from source adapter.
   - Swapping to FAA-native source should only require a new adapter class.
2. **Toggle path**
   - Used existing Leaflet control as minimal UI toggle wiring.
   - Also exposed `setAirspaceVisibility` API to support future custom control panel.
3. **Schema-variance handling**
   - Added tolerant mapping across likely property fields (`TYPE`, `TYPE_CODE`, `CLASS`, etc.).

## Assumptions
- ArcGIS endpoint is bootstrap/default only and not final production dataset lock.
- Existing GARS runtime integration is separate/in-progress; this work keeps pane ordering deterministic even before full GARS data ingest.

## TODO / unresolved questions
- Confirm final ArcGIS endpoint from `docs/data-source-register.md` for stable CONUS coverage.
- Once FAA-native source is selected, tighten field mapping and remove heuristic fallbacks.
- Add legend/UX conventions for tactical color semantics (deferred).

## Cross-boundary note
- Touched `src/map/MapCore.js` (WP-B-owned area) to integrate the new airspace service through existing layer-order architecture. Required for runtime registration and toggle/dimmer contract preservation.

## Files touched
- `index.html`
- `src/main.js`
- `src/map/MapCore.js`
- `src/services/airspace/AirspaceSourceService.js`
- `src/services/airspace/airspaceStyle.js`
- `src/styles/controls.css`
- `tests/integration/layer-order.integration.test.js`
- `tests/unit/airspace-source-mapping.unit.test.js`
