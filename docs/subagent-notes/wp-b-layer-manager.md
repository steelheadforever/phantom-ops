# WP-B — LayerManager Scaffold + Authoritative Z-Order

Date: 2026-02-21

## What was implemented
- Added `src/map/LayerManager.js` with pane initialization, deterministic z-order metadata, layer registration, visibility helpers, and base-imagery dimming support.
- Added explicit z-index constants in `src/map/layerZIndex.js`:
  - base map < GARS < airspace < drawings
- Added `src/map/MapCore.js` and `src/main.js` wiring so base-map layers are registered through `LayerManager` and base-layer switches keep manager state authoritative.
- Reworked dimmer behavior to operate via base tile-layer opacity (`LayerManager.setBaseImageryDim`) instead of a fullscreen dark overlay.

## Decisions made
1. **Pane-based ordering is authoritative**
   - Enforced with named panes and explicit z-index constants for determinism and future WP-D/WP-E compatibility.
2. **Dimmer contract enforcement**
   - Dimmer now targets base layers only (imagery), leaving overlays/UI unaffected.
3. **Reserved drawings tier now**
   - Added drawings pane/constants now so later drawing tooling can plug in without z-order churn.

## Assumptions
- Leaflet pane z-index is the canonical ordering mechanism across current/future layers.
- Current dimmer max of 85% should remain unchanged.
- No aviation data integration is in scope for WP-B; this is architecture/wiring only.

## Unresolved questions
- Should base map minimum opacity be clamped above 0.15 long-term for readability, or should future UX permit full blackout?
- Should a dedicated "future drawings" placeholder layer object be added now, or only pane reservation is sufficient until drawing tools exist?

## Files touched
- `index.html`
- `package.json`
- `src/main.js`
- `src/map/MapCore.js`
- `src/map/LayerManager.js`
- `src/map/layerZIndex.js`
- `src/ui/dimmerControl.js`
- `tests/integration/layer-order.integration.test.js`
- `tests/integration/dimmer-contract.integration.test.js`
