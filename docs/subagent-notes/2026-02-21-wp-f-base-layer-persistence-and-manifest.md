# WP-F: Base Layer Persistence + Manifest Foundation

## Summary
Implemented two scoped enhancements:
1. Persist last-selected base layer in localStorage and restore it at init when valid.
2. Introduce a versioned local base-layer manifest and wire base layer definitions through it.

## Decisions
- Added `src/config/base-layer-manifest.js` as the local manifest source of truth.
  - Includes `schemaVersion`, `publishedAt`, `cycle`, and per-layer metadata (`version`, optional `cycle`).
- Kept current layer set/order and URLs unchanged to avoid behavior drift.
- Added `src/map/baseLayerPreferences.js` to isolate persistence behavior:
  - `BASE_LAYER_STORAGE_KEY = "phantom.baseLayer.selectedId"`
  - `resolveInitialBaseLayerId(...)`
  - `persistBaseLayerId(...)`
- `MapCore` now resolves initial base layer from persisted selection (if valid), otherwise default, then persists selected id.
- `MapCore` persists selection on `baselayerchange` while keeping existing LayerManager single-active-base/dimmer contracts unchanged.

## Assumptions
- Current default remains `base-satellite` unless manifest defaults change.
- Persisted id should be corrected to active default on init when stored id is missing/invalid.
- Local manifest in JS module form is acceptable for this foundation phase (no remote fetch).

## Tests Added
- `tests/unit/base-layer-manifest-and-preferences.unit.test.js`
  - Valid stored id restores that layer id.
  - Missing/invalid stored id falls back to default.
  - Manifest-to-definition wiring sanity (incl. metadata passthrough).
  - Persistence write sanity for localStorage key/value.

## Files Touched
- `src/config/base-layer-manifest.js` (new)
- `src/map/baseLayerSources.js`
- `src/map/baseLayerPreferences.js` (new)
- `src/map/MapCore.js`
- `tests/unit/base-layer-manifest-and-preferences.unit.test.js` (new)

## Unresolved Questions
- Should chart cycle/date be auto-populated from upstream source metadata in a future step?
- Should we prune legacy `terrain/street` from the manifest in a later product decision, or keep as optional bases?
