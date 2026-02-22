# 2026-02-21 — Strict IFR + Airspace Runtime Validation & Fallback Pass

## Root-cause summary (with evidence)

1) **IFR layers had no runtime endpoint health validation/fallback behavior**
- The app trusted static IFR tile URLs and assumed availability.
- On real-device/LAN usage, if that upstream tile service is degraded/unreachable, IFR layer appears blank with no automatic recovery.
- Evidence added as runtime-facing integration checks now probes configured IFR URLs directly and enforces success.

2) **Airspace overlay depended on a single endpoint with no resilient endpoint fallback and no strict non-empty-feature validation**
- Existing source adapter validated shape but did not enforce non-empty features and had no endpoint failover logic.
- Result in outage/empty dataset cases: overlay can be "visible" but effectively non-rendering.
- Evidence (live probe on this pass):
  - IFR tile probe: `status=200`, `content-type=image/jpeg`, `acao=*`, `tileBytes=35944`
  - Airspace probe: `status=200`, `type=FeatureCollection`, `features=1539`, `acao=*`

## Fixes implemented

### A) Runtime endpoint validation utility (new)
- **File**: `src/services/runtimeSourceValidation.js`
- Added strict runtime checks:
  - `validateTileEndpoint(template)` → verifies probe tile URL returns `2xx` image content.
  - `resolveHealthyTileEndpoint(primary, fallbacks)` → picks first healthy template with evidence trail.
  - `validateGeoJsonEndpoint(endpoint)` → verifies `FeatureCollection` with `features.length > 0`.
  - `resolveHealthyGeoJsonEndpoint(primary, fallbacks)` → picks first healthy endpoint with evidence.

### B) IFR/VFR fallback wiring in manifest + source definitions
- **Files**:
  - `src/config/base-layer-manifest.js`
  - `src/map/baseLayerSources.js`
- Added `fallbackUrls` support in manifest + mapping so tile layers can degrade gracefully to known-good imagery when chart endpoint fails.

### C) MapCore runtime source hardening
- **File**: `src/map/MapCore.js`
- Added `validateOperationalSources()` called at init:
  - Validates VFR/IFR templates and swaps to fallback via `layer.setUrl(...)` if needed.
  - Resolves healthy airspace endpoint before normal data load path uses it.
- Kept architecture/layer ordering/dimmer contracts unchanged.

### D) Airspace adapter strictness + failover capability
- **File**: `src/services/airspace/AirspaceSourceService.js`
- `ArcGISAirspaceSource` now supports endpoint resolution with fallback evidence.
- Enforces non-empty GeoJSON feature collection (`features.length > 0`).

## Strict validations/tests added

1) **Runtime-facing endpoint checks (live integration)**
- **File**: `tests/integration/runtime-endpoint-validation.integration.test.js`
- Asserts:
  - Configured IFR tile endpoints return successful tile response (`200`, image content)
  - Airspace endpoint returns non-empty `FeatureCollection`

2) **Airspace visibility integration assertion**
- **File**: `tests/integration/airspace-visibility.integration.test.js`
- Asserts:
  - Airspace layer is visible by default
  - Toggling visibility (`false` then `true`) changes layer visibility state accordingly

3) **Fallback behavior unit tests**
- **File**: `tests/unit/runtime-source-validation.unit.test.js`
- Asserts:
  - Tile endpoint fallback selected when primary fails
  - GeoJSON endpoint fallback selected when primary has zero features

4) **Manifest/source parsing assertions extended**
- **File**: `tests/unit/base-layer-manifest-and-preferences.unit.test.js`
- Asserts chart layer fallback URLs are present and correctly wired.

## Test results

- Command: `npm test`
- Result: **23/23 passing**
- Includes live runtime probes for IFR + airspace endpoints.

## Residual risks

- IFR low/high currently share one public chart source (`World_Navigation_Charts`) as reliability-first behavior; they are selectable but not distinct FAA IFR cartography products.
- Runtime validation runs at app startup and can still be affected by transient network conditions; failover exists, but user-visible first-load delays are possible under poor connectivity.
- Airspace fallback endpoint list is currently empty by default to avoid CORS-mismatched sources; add only endpoints verified for wildcard (or allowed local origin) CORS.
