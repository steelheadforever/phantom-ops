# Phantom Ops — Implementation Specification (v1)

## 1) Project Context

Phantom Ops is an unclassified, planning-only web mission-planning tool intended to replace core CAVOK-style functionality for USAF simulator training workflows.

### Primary Users
- Instructors
- Students

### Operating Context
- Internet-connected environment
- CONUS/US only
- Not for live aircraft operations

---

## 2) Product Principles

1. **Clean mission-planning UI/UX first**
2. **Fast, readable map interactions**
3. **Deterministic behavior over feature sprawl**
4. **Open-license tooling and data sources** (no paid dependencies beyond domain/hosting)
5. **Simplified tactical styling** (not full FAA chart symbology replication)

---

## 3) Scope (v1)

## In Scope
1. Cursor coordinate display in bottom status bar with click-to-cycle format:
   - MGRS
   - DMS
   - DMM
2. Center crosshair overlay indicating map center
3. Usable dimmable map layer system
4. Selectable VFR/IFR raster layers
5. GARS boxes layer
6. Airspace polygon layer with tactical colors:
   - Class B/C/D
   - MOA
   - Alert Areas
   - Restricted Areas
7. GPS points layer with dynamic filter:
   - show points within **100 NM** of map center

## Out of Scope (for now)
- User drawing/editing tools (routes, polygons, orbits)
- Air-gapped/offline deployment
- OCONUS/global coverage
- Real-time operational aviation use

---

## 4) Layering & Render Order (Authoritative)

Render stack must be enforced as:

1. **Base map layers** (satellite / VFR / IFR raster)
2. **GARS layer**
3. **Airspace polygon layers**
4. **Future user drawing layers** (reserved top position)
5. UI overlays (crosshair, status bar, controls)

### Requirement
GARS must always render **below** airspace and below future drawing layers.

---

## 5) Technical Architecture

## Frontend
- Leaflet (map engine)
- JavaScript-first modular architecture for v1 (with clean boundaries so TypeScript migration is straightforward)

## 5.1 Codebase Contract (Authoritative for subagents)

### v1 directory structure target
- `index.html` — app shell
- `src/main.js` — bootstraps app
- `src/map/MapCore.js`
- `src/map/LayerManager.js`
- `src/services/CoordinateService.js`
- `src/services/GeoFilterService.js`
- `src/services/DataService.js`
- `src/ui/OverlayService.js`
- `src/ui/StatusBar.js`
- `src/styles/` — CSS modules (map, controls, status bar, overlays)
- `docs/` — design notes, data-source register, subagent handoff docs

### Subagent ownership boundaries
- **WP-A** owns `src/ui/*` and coordinate-display wiring in `CoordinateService`.
- **WP-B** owns `src/map/LayerManager.js` and z-order constants.
- **WP-C** owns docs only (`docs/data-source-register.md`, licensing notes), no runtime code edits.

### Shared integration rule
- If a subagent must touch another package's area, it must add a short "cross-boundary note" in its implementation note explaining why.

## Core Modules
1. `MapCore`
   - map init, base controls, event bus
2. `LayerManager`
   - registration, z-order, visibility, opacity
3. `CoordinateService`
   - cursor lat/lon capture
   - format conversion (MGRS/DMS/DMM)
4. `OverlayService`
   - crosshair, status bar, UI overlays
5. `DataService`
   - load/version manifests for raster/vector/static point datasets
6. `GeoFilterService`
   - 100 NM center-distance filtering for GPS points

## Suggested Libraries
- `mgrs` (MGRS conversion)
- DMS/DMM formatter utility (small local util or lightweight geodesy helper)
- `@turf/turf` for NM distance and geo filtering

---

## 6) Data Strategy

## Refresh cadence
- FAA-style cycle awareness: **28-day check/update target**, acceptable within a few days of release

## Data requirements by feature
1. **VFR/IFR raster layers**
   - source: open/public FAA chart data products
   - preprocessed as web-ready tiles
2. **GARS**
   - generated grid or open-licensed source equivalent
3. **Airspace polygons**
   - open/public US aviation datasets (Class B/C/D + MOA/Alert/Restricted)
4. **GPS points**
   - open-license source to be selected after validation of coverage and legal terms

## 6.1 Phase 0 Deliverable — Data Source Register (WP-C)
WP-C must produce `docs/data-source-register.md` before WP-D/WP-E/WP-F start.

Each dataset entry must include:
- Source URL
- License + redistribution status
- Required attribution/disclaimer text
- Geographic coverage (CONUS)
- Refresh cadence
- File format/schema summary
- Known gaps/quality caveats

## Licensing policy
- Open-source/open-license only
- Avoid paid APIs/services
- Add attribution/disclaimer notes where required by source terms

---

## 7) UX Specification

## 7.1 Bottom Status Bar
- Persistent bottom bar
- Displays cursor coordinate in current format
- Click/tap coordinate value cycles format in fixed order:
  1. MGRS
  2. DMS
  3. DMM
  4. back to MGRS
- If cursor is off-map/unknown, show `--`

### Coordinate output precision (authoritative)
- **MGRS:** 10-digit grid (1m precision)
- **DMM:** 4 decimal places for minutes
- **DMS:** 2 decimal places for seconds
- Use hemisphere notation (`N/S`, `E/W`) for DMS/DMM

## 7.2 Center Crosshair
- Fixed visual element at viewport center
- Non-interactive, always visible
- Must not block map gestures

## 7.3 Layer Controls
- Toggle visibility for each layer
- Opacity/dimming controls for raster layers
- Preserve current dimmer behavior and make it compatible with VFR/IFR layers
- **Dimmer behavior:** dimmer applies to map imagery only (base map/raster presentation), not UI controls, crosshair, status bar, airspace overlays, GARS labels, or future drawings

## 7.4 GPS Points (100 NM)
- Radius anchored to map center (crosshair), not cursor
- Auto-refresh on map movement (debounced)
- Show only points where distance(center, point) <= 100 NM

---

## 8) Performance Requirements

1. Debounce expensive move handlers (`moveend` preferred for heavy operations)
2. Keep UI interactions smooth during pan/zoom
3. For large GPS datasets:
   - prefilter via bbox
   - then apply precise NM calculation
   - optionally introduce clustering if visual overload occurs

---

## 9) Implementation Phases

## Phase 1 — Core UX Foundation
- Add center crosshair
- Add bottom coordinate status bar
- Implement coordinate format cycle (MGRS/DMS/DMM)
- Acceptance: user can pan map and live-see/cycle cursor coordinate formats

## Phase 2 — Layer Management Foundation
- Introduce structured `LayerManager` with explicit z-index order
- Implement layer visibility controls and dimming interoperability
- Acceptance: GARS always remains below airspace in render order

## Phase 3 — Aviation Layers
- Integrate selectable VFR/IFR raster layers
- Integrate GARS overlay
- Integrate tactical airspace polygons with class-based styles
- Acceptance: all required overlays render correctly and can be toggled

## Phase 4 — GPS Proximity Feature
- Integrate GPS points source
- Implement 100 NM center-based filtering
- Add performance safeguards for high point counts
- Acceptance: only points within 100 NM are rendered after map move

## Phase 5 — Data Ops & Reliability
- Add data manifest + version timestamps
- ~~Add 28-day update check workflow~~ — **Done:** Cloudflare Worker cron refreshes Class B/C/D from FAA ArcGIS daily; data served from R2 at `/data/airspace/*`
- Surface “last updated” metadata in UI
- Acceptance: operator can verify data currency quickly

---

## 10) Subagent Work Package Design

Each subagent should:
1. Work on one phase/feature area only
2. Avoid changing unrelated modules
3. Include a short implementation note in PR/commit message:
   - what changed
   - why
   - acceptance criteria met
4. Write durable handoff context for future subagents in `docs/subagent-notes/`:
   - decisions made
   - assumptions
   - unresolved questions
   - files touched

## Execution gates (authoritative)
- **Gate 0:** WP-C must publish `docs/data-source-register.md` before WP-D/WP-E/WP-F begin.
- **Gate 1:** WP-A and WP-B may run in parallel after this spec version is in repo.
- **Gate 2:** WP-D/WP-E start only after WP-B merge (layer ordering scaffold present).
- **Gate 3:** WP-F starts after WP-C GPS dataset decision is approved and schema is documented.

## Initial parallelizable packages
- **WP-A:** Phase 1 (crosshair + coordinate status bar + format cycle)
- **WP-B:** LayerManager scaffold + z-order enforcement
- **WP-C:** Data-source research doc for VFR/IFR, GARS, airspace, GPS licensing/cadence

After WP-A/B merge and Gate 0 satisfied:
- **WP-D:** VFR/IFR layer integration
- **WP-E:** GARS + airspace overlay integration
- **WP-F:** GPS 100 NM filtering and optimization

---

## 11) Definition of Done (v1)

v1 is complete when:
1. All in-scope features are implemented and user-testable
2. Layer ordering is deterministic and matches Section 4
3. Coordinate UX behaves exactly per Section 7.1
4. GPS filtering behavior matches Section 7.4
5. Data sources are documented with licensing/attribution notes
6. Basic regression checklist passes (map movement, toggles, dimmer, no major console errors)

## 11.1 Test Plan (required)

### Unit tests
- Coordinate formatting:
  - MGRS outputs 10-digit grid (1m)
  - DMM outputs 4 decimal places
  - DMS outputs 2 decimal places
- Geo filter:
  - point included at <= 100 NM
  - point excluded at > 100 NM

### Integration tests
- Layer order assertions enforce: base < GARS < airspace < future drawings
- Dimmer affects map imagery only
- Coordinate click cycles MGRS -> DMS -> DMM -> MGRS deterministically

### Manual regression checklist
- Pan/zoom remains smooth
- Cursor coordinate updates while moving over map
- Crosshair remains fixed at viewport center
- GARS toggles independently and stays under airspace
- VFR/IFR layers can be selected and dimmed
- No major console errors during normal interactions

---

## 12) Open Decisions / Follow-ups

1. Final open-license GPS points dataset selection
2. Exact tactical color palette and legend conventions

## 12.1 Decisions locked after WP-A/WP-B review
- Keep current dimmer behavior (map-imagery dimming only) as-is for v1.
- Pane reservation for future drawing layers is sufficient for now (no placeholder drawing layer required in v1).

---

## 13) Notes for Future Phases (Not in v1)

- Drawing/edit tools (routes, boundaries, orbits)
- Saved mission plans
- Export/share packages
- Additional instructor workflow utilities

---

Owner intent captured from project discussion and approved constraints as of 2026-02-22.
