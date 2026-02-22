# 2026-02-22 — IFR Distinct Wiring + Airspace Visibility Fix

## Root causes

1. **IFR Low and IFR High were configured to the exact same tile endpoint** (`World_Navigation_Charts`), so they could never render distinct chart products.
2. **Fallback behavior was silent**: when operational source validation swapped a URL, there was no explicit surfaced degraded-mode state for operators.
3. **Airspace polygons were effectively hard to see** due to weak default style and incomplete class mapping for `TYPE_CODE` shorthand values in the selected source (`A/M/R/...`).

## What changed

- **Manifest/source wiring**
  - `base-ifr-low` now points to distinct IFR Low primary (`IFR_AreaLow`) and `base-ifr-high` to distinct IFR High primary (`IFR_High`).
  - Added ordered fallbacks per IFR layer: `World_Navigation_Charts` then `World_Imagery`.
- **Runtime source status surfaced**
  - `MapCore` now tracks per-layer configured vs active URL and degraded state.
  - Added `getOperationalSourceStatus()` for strict runtime checks.
  - Added small non-interactive UI debug indicator (`#source-debug-indicator`) showing source mode (`OK` vs `DEGRADED`) and whether each layer is on primary/fallback.
  - Emits explicit console warning if IFR Low + IFR High collapse to same active URL.
- **Airspace visibility hardening**
  - Increased airspace stroke/fill visibility (`opacity`, `fillColor`, stronger `fillOpacity`/weights).
  - Added TYPE_CODE shorthand mapping (`A`, `M`, `R`, `P`, `W`) to style buckets.
  - Calls `bringToFront()` after loading airspace data (pane contract still authoritative: base < GARS < airspace < drawings).

## Test evidence

- Updated/added tests:
  - `tests/integration/operational-source-status.integration.test.js`
    - verifies IFR low/high remain distinct when distinct healthy sources exist
    - verifies degraded mode when both collapse to same fallback
  - `tests/integration/airspace-visibility.integration.test.js`
    - verifies airspace overlay visible by default and rendered feature count > 0 when toggled on
  - `tests/integration/runtime-endpoint-validation.integration.test.js`
    - verifies runtime resolution always yields a healthy active IFR source and enforces degraded-mode expectation when collapsed
  - `tests/unit/base-layer-manifest-and-preferences.unit.test.js`
    - asserts IFR low/high manifest URLs are distinct and have fallback chains
  - `tests/unit/airspace-source-mapping.unit.test.js`
    - asserts TYPE_CODE shorthand mapping coverage

## Caveats

- IFR primaries currently appear to be hosted as secure ArcGIS services in many environments, so runtime may often degrade to chart fallback; this is now explicit rather than silent.
- Distinct IFR visualization in production depends on availability/auth of those distinct primary services (or a project-owned FAA ingestion pipeline).
