# Phantom Ops — Data Source Register (WP-C Phase 0)

_Last updated: 2026-02-21 (CST)_

## Scope
This register covers candidate/selected data sources for:
- VFR raster
- IFR raster
- GARS grid
- Airspace polygons (Class B/C/D + MOA/Alert/Restricted)
- GPS points (primary + fallback)

Project constraints applied:
- Open/publicly redistributable sources only
- No paid APIs/services
- CONUS-first operation

---

## 1) VFR raster charts (selected)

**Dataset**: FAA digital VFR Raster Charts (Sectional/TAC etc.)  
**Source URL**: https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/vfr/  
**Direct file host pattern**: `https://aeronav.faa.gov/visual/<effective-date>/...` (GeoTIFF ZIP + PDF)

- **License + redistribution status**
  - U.S. federal government source (FAA AIS). No paid or click-through commercial license observed on source pages.
  - Treated as publicly downloadable and redistributable for planning/training use, with source credit and no-warranty disclaimer.
- **Required attribution/disclaimer text**
  - Attribution: `Source: Federal Aviation Administration (FAA) Aeronautical Information Services (AIS).`
  - Disclaimer: `Not for real-world navigation. Verify current chart cycle/effective date before use.`
- **CONUS coverage**
  - Yes (plus AK/HI/Caribbean products). Select CONUS chart set during ingest.
- **Refresh cadence**
  - FAA publishes by chart cycle (sectionals/TAC are 56-day products; next editions posted ahead of effective date).
  - Operational check target remains every 28 days per project policy.
- **File format/schema summary**
  - ZIP packages containing GeoTIFF chart raster + supporting geospatial/metadata files (and companion PDF products).
  - Raster is chart image; features are not object-level vectors.
- **Known gaps/quality caveats**
  - Cartographic text/symbols are baked into raster; limited semantic querying.
  - Insets and non-main-body areas may have georeference caveats noted by FAA.
  - Must enforce cycle currency (expired charts are visually plausible but stale).

---

## 2) IFR raster charts (selected)

**Dataset**: FAA IFR Enroute chart raster/PDF products  
**Source URL**: https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/ifr/  
**Direct file host pattern**: `https://aeronav.faa.gov/enroute/<effective-date>/...` (GeoTIFF ZIP + PDF ZIP)

- **License + redistribution status**
  - U.S. federal government source (FAA AIS); publicly downloadable.
  - No paid dependency; redistribution suitable with source/disclaimer retained.
- **Required attribution/disclaimer text**
  - Attribution: `Source: Federal Aviation Administration (FAA) Aeronautical Information Services (AIS).`
  - Disclaimer: `Training/planning display only; not approved for operational flight navigation.`
- **CONUS coverage**
  - Yes (U.S. low/high enroute and area products; non-CONUS products also present).
- **Refresh cadence**
  - FAA 28/56-day product schedule; enroute cycles align with FAA publication updates.
  - Minimum project check: every 28 days.
- **File format/schema summary**
  - GeoTIFF ZIPs and PDF ZIP bundles per chart/series.
  - Raster-only representation for map display.
- **Known gaps/quality caveats**
  - Raster scales/label density require multi-resolution tiling strategy.
  - FAA safety alerts/notices can supersede chart assumptions between cycles.

---

## 3) GARS grid (selected implementation approach: generated)

**Dataset**: In-house generated GARS polygons/labels from published GARS specification (no third-party licensed tiles)

**Reference URLs**:
- Background overview: https://en.wikipedia.org/wiki/Global_Area_Reference_System
- NGA geodesy portal landing: https://earth-info.nga.mil/

- **License + redistribution status**
  - Preferred approach is **algorithmic generation** (derived geometry from public spec rules), avoiding external proprietary packaged dataset risk.
  - Generated output owned by project build process; no paid dependency.
- **Required attribution/disclaimer text**
  - Attribution: `GARS grid generated from publicly documented Global Area Reference System rules (NGA/DoD references).`
  - Disclaimer: `For planning/training visualization only; not for targeting/navigation.`
- **CONUS coverage**
  - Full globe generation is trivial; clip to CONUS extent at runtime/preprocess.
- **Refresh cadence**
  - Static (spec-driven). Regenerate only if specification version changes.
- **File format/schema summary**
  - Suggested output: GeoJSON or vector tiles with fields such as:
    - `gars_id` (5-char cell)
    - `lat_band`, `lon_band`
    - optional `quadrant`, `keypad` refinements if needed later
- **Known gaps/quality caveats**
  - Requires precise implementation of lettering/numbering rules (omit I/O in latitude bands).
  - Must validate anti-meridian and pole-edge behavior in generator tests.

---

## 4) Airspace polygons — Class B/C/D (selected)

**Dataset**: FAA NASR 28-Day Subscription → `Additional_Data/Shape_Files/Class_Airspace.shp`  
**Source URL**: https://www.faa.gov/air_traffic/flight_info/aeronav/aero_data/NASR_Subscription/  
**Archive URL pattern**: `https://nfdc.faa.gov/webContent/28DaySub/28DaySubscription_Effective_<YYYY-MM-DD>.zip`

- **License + redistribution status**
  - Public FAA source; downloadable without paid license.
  - Redistribution acceptable for project use with FAA source citation and planning-only disclaimer.
- **Required attribution/disclaimer text**
  - Attribution: `Contains FAA NASR data (Class Airspace), Aeronautical Information Services.`
  - Disclaimer: `Not for real-world flight operations; check FAA current publications.`
- **CONUS coverage**
  - Yes (national coverage; includes non-CONUS records too).
- **Refresh cadence**
  - AIRAC/NASR 28-day cycle.
- **File format/schema summary**
  - ESRI Shapefile components (`.shp/.shx/.dbf/.prj`).
  - Key attributes observed in current file include: `IDENT`, `NAME`, `CLASS`, `LOCAL_TYPE`, altitude descriptors (`UPPER_*`, `LOWER_*`), and geometry area/length.
  - Distinct class values observed: B/C/D/E; filter to B/C/D for this scope.
- **Known gaps/quality caveats**
  - This layer does **not** include MOA/Alert/Restricted in the same shapefile.
  - Multi-part geometries and altitude semantics need normalization in pipeline.

---

## 5) Airspace polygons — MOA / Alert / Restricted (candidate selected for Phase 0; requires validation before production lock)

**Dataset**: NOAA Office for Coastal Management / MarineCadastre `MilitaryCollection.gpkg` (contains `MilitarySpecialUseAirspace`)  
**Source URL**: https://marinecadastre.gov/downloads/data/mc/MilitaryCollection.zip  
**Catalog context**: https://catalog.data.gov/dataset/military-special-use-airspace1

- **License + redistribution status**
  - U.S. government open data distribution (no paid dependency).
  - Treat as redistributable with source citation + no-warranty language.
- **Required attribution/disclaimer text**
  - Attribution: `Source: NOAA Office for Coastal Management / MarineCadastre.gov (Military Collection).`
  - Disclaimer: `Data may be incomplete/out-of-date for aviation operational use; planning/training display only.`
- **CONUS coverage**
  - Partial for this mission need; dataset is strong for maritime/coastal military airspace context.
  - **Not yet validated as complete inland CONUS replacement for FAA SUA products.**
- **Refresh cadence**
  - Not AIRAC-coupled; update cadence appears irregular compared to FAA 28-day cycle.
- **File format/schema summary**
  - GeoPackage with multiple layers. Relevant layer: `MilitarySpecialUseAirspace`.
  - Useful attributes include `specialUseAirspaceType` (values observed include `Military Operations Area`, `Alert`, `Restricted`, etc.), altitude fields, controlling/scheduling agency, and identifier fields.
- **Known gaps/quality caveats**
  - Primary risk: cycle alignment and CONUS inland completeness versus FAA NASR expectations.
  - Requires crosswalk/QA against FAA references before production gate.

> **Phase-0 decision note:** Use this as a documented open fallback path, but keep an unresolved action to identify/confirm an FAA-native SUA polygon feed (preferred) before final WP-E production lock.

---

## 6) GPS points dataset recommendation

### Primary recommendation: FAA NASR `FIX.txt` (+ optional `NAV.txt`)

**Source URL**: https://www.faa.gov/air_traffic/flight_info/aeronav/aero_data/NASR_Subscription/

- **Why primary**
  - Same authoritative FAA ecosystem and 28-day cadence as other aviation layers.
  - Strong fit for deterministic training planning and WP-F 100 NM filtering.
  - No paid dependency.
- **License + redistribution status**
  - Public FAA distribution; include FAA source credit and non-operational disclaimer.
- **Required attribution/disclaimer text**
  - `Contains FAA NASR waypoint/navigation data. Not for operational navigation.`
- **CONUS coverage**
  - Yes (national, with extra non-CONUS records that can be filtered).
- **Refresh cadence**
  - 28-day NASR cycle.
- **File format/schema summary**
  - Delimited text files with FAA record layouts (see NASR layout documents).
  - Candidate fields (varies by file): identifier, type, latitude/longitude, state/region, usage/status metadata.
- **Known gaps/quality caveats**
  - Parsing complexity is higher than CSV; record-layout-driven ETL required.
  - Must de-duplicate collocated identifiers across source tables where needed.

### Fallback recommendation: OurAirports `airports.csv` + `navaids.csv` (CC0/Public Domain)

**Source URL**: https://ourairports.com/data/

- **Why fallback**
  - Extremely easy ingest (UTF-8 CSV), permissive terms (`Public Domain`), daily updates.
  - Good developer velocity and robust backup if FAA feed ingest is delayed.
- **License + redistribution status**
  - Explicitly stated Public Domain by provider.
- **Required attribution/disclaimer text**
  - Attribution optional by terms, but recommended: `Source: OurAirports open data.`
  - Disclaimer: `Community-aggregated data; accuracy/fitness not guaranteed.`
- **CONUS coverage**
  - Includes U.S. and global records; filter to U.S./CONUS in pipeline.
- **Refresh cadence**
  - Nightly.
- **File format/schema summary**
  - CSV datasets with documented columns (identifiers, coordinates, type, elevation, country/region, etc.).
- **Known gaps/quality caveats**
  - Community-curated; may diverge from FAA cycle timing and naming.
  - Potential inconsistency in military-use points and specialized waypoint taxonomies.

---

## Consolidated recommendation set for WP-D/E/F gating

1. **VFR raster**: FAA digital VFR GeoTIFF products (approved).  
2. **IFR raster**: FAA IFR Enroute GeoTIFF/PDF products (approved).  
3. **GARS**: Generate from public specification (approved).  
4. **Class B/C/D polygons**: FAA NASR Class_Airspace shapefile (approved).  
5. **MOA/Alert/Restricted polygons**: MarineCadastre MilitarySpecialUseAirspace as interim documented source; FAA-native SUA polygon source still needs confirmation for final production confidence.  
6. **GPS points**: FAA NASR FIX/NAV as primary, OurAirports as fallback (approved recommendation).

---

## Open items (for next package)

- Confirm an FAA-native, cycle-aligned SUA polygon source (MOA/Alert/Restricted) to remove dependency on marine-focused fallback coverage assumptions.
- Add exact legal text snippet from FAA data terms/policy page to replace current conservative attribution/disclaimer template language.
- Define canonical field contract for WP-F GPS ingest (minimum required schema for runtime filtering).
