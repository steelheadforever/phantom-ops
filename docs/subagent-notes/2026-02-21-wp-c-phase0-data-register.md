# WP-C Phase 0 Subagent Handoff — Data Source Register

## What was decided
- Created `docs/data-source-register.md` as Gate 0 deliverable.
- Selected FAA sources for VFR and IFR raster products.
- Selected FAA NASR `Class_Airspace.shp` for Class B/C/D polygons.
- Selected generated-from-spec approach for GARS (no external licensed tiles).
- Recommended GPS points:
  - **Primary**: FAA NASR (`FIX.txt`, optional `NAV.txt`)
  - **Fallback**: OurAirports CSV (Public Domain)
- Documented MOA/Alert/Restricted polygon path via MarineCadastre `MilitarySpecialUseAirspace` as interim candidate with explicit caveats.

## Assumptions
- FAA AIS/NASR public downloads are redistributable for this planning tool with proper source citation and non-operational disclaimer.
- Project policy accepts conservative disclaimer language until legal text is finalized.
- GARS can be generated in-house from publicly documented rules, avoiding third-party licensing ambiguity.

## Unresolved questions / blockers
1. **SUA source confidence**: Need confirmation of an FAA-native, cycle-aligned polygon feed for MOA/Alert/Restricted to ensure inland CONUS completeness and AIRAC alignment.
2. **Legal text hardening**: Need exact FAA policy/terms citation snippet to replace provisional attribution/disclaimer templates.
3. **Schema contract**: WP-F should define minimum GPS point schema contract before ingest implementation starts.

## Files touched
- `docs/data-source-register.md` (new)
- `docs/subagent-notes/2026-02-21-wp-c-phase0-data-register.md` (new)

## Notes on evidence collected
- Verified FAA NASR subscription archive and inspected included `Class_Airspace` shapefile field names and class values.
- Verified MarineCadastre GeoPackage layer names and distinct `specialUseAirspaceType` values include MOA/Alert/Restricted.
- Verified OurAirports terms indicate Public Domain and nightly CSV refresh.
