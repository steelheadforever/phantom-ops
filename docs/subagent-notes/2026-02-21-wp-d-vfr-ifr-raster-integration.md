# WP-D — VFR/IFR Raster Base-Layer Integration Foundation

Date: 2026-02-21

## What was implemented
- Added configurable raster base-layer source definitions in `src/map/baseLayerSources.js`.
  - Includes existing imagery/base options (`base-satellite`, `base-terrain`, `base-street`).
  - Added selectable aviation raster options:
    - `base-vfr-sectional`
    - `base-ifr-low`
    - `base-ifr-high`
- Updated `MapCore` to build/register base layers from definitions rather than hardcoded tile declarations.
- Kept `LayerManager` as authoritative for base-layer state and z-order (base pane remains below GARS/airspace/drawings contract).
- Added `LayerManager.getActiveBaseLayerId()` to support explicit base-selection assertions.
- Added/updated integration tests for WP-D requirements:
  1. Base-layer selection wiring and exclusivity (`tests/integration/base-layer-selection.integration.test.js`)
  2. Dimmer effect on base imagery set including VFR/IFR and no overlay dimming regression (`tests/integration/dimmer-contract.integration.test.js`)
  3. Existing layer z-order contract test retained/passing (`tests/integration/layer-order.integration.test.js`)

## Decisions made
1. **Source configurability first:** Raster endpoints are centralized in one definition list for easy retargeting without touching MapCore logic.
2. **IFR split preserved:** IFR low/high are separate selectable base layers to match likely chart usage and avoid coupling assumptions.
3. **Dimmer compatibility via base kind:** VFR/IFR are registered as `base` layers so existing imagery-only dimmer contract applies automatically.

## Assumptions
- ArcGIS endpoints used for VFR/IFR are treated as interim configurable targets and may be replaced during data pipeline hardening.
- Legal/source posture remains aligned with `docs/data-source-register.md` and `docs/legal-source-notes.md` (planning/training-only use, attribution/disclaimer required).

## Unresolved questions
- Should default startup base remain `Satellite`, or should this be user-configurable/persisted?
- For future data ops, should VFR/IFR maxZoom and attribution strings be sourced from a versioned manifest instead of static code constants?

## Cross-boundary note
- No UI package internals were modified; work remained in map-layer architecture and tests.

## Files touched
- `src/map/baseLayerSources.js` (new)
- `src/map/MapCore.js`
- `src/map/LayerManager.js`
- `tests/integration/base-layer-selection.integration.test.js` (new)
- `tests/integration/dimmer-contract.integration.test.js`
- `docs/subagent-notes/2026-02-21-wp-d-vfr-ifr-raster-integration.md` (new)
