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
- `src/ui/TopBar.js` — top bar with hamburger, cross insignia, title, UTC clock
- `src/ui/SideMenu.js` — slide-out overlay menu (Plan / Study stubs)
- `src/ui/BottomBar.js` — bottom bar with coordinate display and control slots
- `src/ui/BaseLayerMenu.js` — globe icon popup for base layer selection
- `src/ui/AirspaceMenu.js` — quadrilateral icon popup for airspace layer toggles
- `src/ui/BrightnessSlider.js` — sun icon popup for map brightness
- `src/ui/popupManager.js` — shared singleton to ensure one popup open at a time
- `src/assets/` — static assets (558 cross insignia PNG)
- `src/styles/` — CSS modules (map, top-bar, bottom-bar, overlays, source-debug)
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

## 7.0 Design Language
- **Theme:** 558 FTS colors — deep royal blue (`#1e3190`) and gold (`#f5a800`)
- **Font:** B612 Mono throughout (avionics display aesthetic)
- **Bars:** Semi-transparent dark grey (`rgba(28,28,28,0.72)`) with `backdrop-filter: blur(10px)`
- **Borders:** Subtle blue (`rgba(43,58,171,0.45)`)
- All controls consolidated into top bar and bottom bar — no floating panels

## 7.1 Top Bar
- Fixed 44px bar across full width
- Left to right: hamburger menu → 558 cross insignia → `PHANTOM-OPS` (B612 Mono italic, gold) → 558 cross insignia → spacer → UTC clock (`HH:MM:SSZ`, ticks every second)
- Hamburger opens a slide-over side menu

## 7.2 Side Menu
- Slides in from left, overlays map (200px wide)
- Contains: **PLAN** and **STUDY** buttons (stubbed, disabled — future implementation)
- Closes on backdrop click or Escape key

## 7.3 Bottom Bar
- Fixed 40px bar across full width
- **Left:** cursor coordinate display — B612 Mono, cycles MGRS → DMS → DMM → MGRS on click; shows `--` when off-map
- **Right (left to right):** quadrilateral button → globe button → sun button

### Coordinate output precision (authoritative)
- **MGRS:** 10-digit grid (1m precision)
- **DMM:** 4 decimal places for minutes
- **DMS:** 2 decimal places for seconds
- Use hemisphere notation (`N/S`, `E/W`) for DMS/DMM

## 7.4 Bottom Bar — Globe Button (Base Layer)
- Globe SVG icon; click opens vertical popup menu rising from bottom bar
- Radio selection among: Satellite, Terrain, Street Map, VFR Sectional, IFR Low, IFR High
- Selection persists to localStorage
- Only one popup open at a time (shared `popupManager`)

## 7.5 Bottom Bar — Quadrilateral Button (Airspace)
- Quadrilateral SVG icon; click opens vertical popup menu
- Checkbox toggles for: Class B, Class C, Class D, MOAs, Alert Areas, Restricted Areas
- All checked by default

## 7.6 Bottom Bar — Sun Button (Brightness)
- Sun SVG icon; click opens vertical slider popup
- Range 0–85%; dims base map imagery only (not overlays, crosshair, or UI)
- **Dimmer behavior:** applies to base map raster only, not airspace polygons, crosshair, bars, or future drawings

## 7.7 Center Crosshair
- Fixed visual element centered within the map area (between top and bottom bars)
- Non-interactive, always visible
- Must not block map gestures

## 7.8 GPS Points (100 NM)
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

## Phase 6 — UI Redesign ✅ Done (2026-02-22)
- Established 558 FTS design language: blue/gold theme, B612 Mono font, semi-transparent bars
- Top bar: hamburger, 558 cross insignia, PHANTOM-OPS title, live UTC clock
- Side menu: slide-over overlay with Plan/Study stubs
- Bottom bar: coordinate display left; globe/airspace/brightness controls right
- Replaced floating dimmer and top-right layer panel with bottom-bar popups
- Added shared `popupManager` to enforce single-popup-at-a-time behavior

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
Last updated: 2026-02-22 (Phase 6 UI redesign complete).
