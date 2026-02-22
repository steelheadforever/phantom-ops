# WP-A Handoff Note — Phase 1 Core UX Foundation

## Scope Implemented
- Added fixed, non-interactive center crosshair overlay.
- Added persistent bottom status bar for cursor coordinates.
- Implemented click-to-cycle coordinate format order: `MGRS -> DMS -> DMM -> MGRS`.
- Enforced precision spec:
  - MGRS: 10-digit (1m) via `mgrs.forward([lng, lat], 5)`
  - DMM: 4 decimal places minutes with hemisphere notation
  - DMS: 2 decimal places seconds with hemisphere notation
- Wired coordinate updates to Leaflet `mousemove`, fallback `--` on `mouseout`.

## Decisions Made
- Introduced modular Phase-1 structure under `src/` per codebase contract and moved runtime bootstrapping to `src/main.js`.
- Kept dimmer behavior intact and visually below WP-A overlays (crosshair/status bar) to preserve map-only dim intent.
- Loaded `mgrs` in browser via CDN (`unpkg`) and in tests via npm dependency.

## Assumptions
- Existing single-page app was acceptable to evolve into `src/` modular layout during WP-A because this package owns `src/ui/*` plus coordinate-display wiring.
- `LayerManager`, `GeoFilterService`, and `DataService` remain for later WPs and are intentionally not implemented here.

## Cross-Boundary Notes
- Touched `src/map/MapCore.js` and `src/main.js` only to wire WP-A UI/coordinate behavior into current app initialization. No layer-order logic added.

## Unresolved Questions
- Whether status bar should also indicate active format label separately from value long-term (currently prefixed in coordinate string).
- Whether map `mouseout` reliably fires for all pointer scenarios in target deployment browsers.

## Files Touched
- `index.html`
- `package.json`
- `src/main.js`
- `src/map/MapCore.js`
- `src/services/CoordinateService.js`
- `src/ui/OverlayService.js`
- `src/ui/StatusBar.js`
- `src/styles/map.css`
- `src/styles/controls.css`
- `src/styles/overlays.css`
- `src/styles/status-bar.css`
- `tests/CoordinateService.test.js`
- `tests/CoordinateCycle.integration.test.js`
