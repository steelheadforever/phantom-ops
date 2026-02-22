# Phantom Ops — Legal / Source Notes (Working Draft)

_Last updated: 2026-02-22_

This file is a practical handoff reference for subagents. It is not legal advice.

## 1) Project legal posture (owner intent)

- Planning-only training tool (not live navigation)
- Unclassified use case
- Open/public data sources preferred
- No paid data/API dependencies where possible

## 2) Source notes and evidence

## FAA NASR subscription cadence
- FAA 28-day NASR subscription page publishes recurring cycle downloads.
- URL: `https://www.faa.gov/air_traffic/flight_info/aeronav/aero_data/NASR_Subscription/`
- Operational implication: suitable for the project’s “update within a few days of cycle” requirement.

## FAA digital chart products (VFR/IFR)
- FAA digital products landing page:
- URL: `https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/`
- Operational implication: acceptable authoritative source path for raster chart acquisition pipeline.

## Reference implementation signals (third-party sites)
These are implementation clues, not licensing authority.

- hawg-ops frontend references:
  - `https://geojson.hawg-ops.com/Special_Use_Airspace.geojson`
  - `https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/Special_Use_Airspace/FeatureServer/0/query?outFields=*&where=1%3D1&f=geojson`
- hawg-ops and viperops both reference ArcGIS chart tile services under org id `ssFJjBXIUyZDrSYZ`:
  - `.../VFR_Sectional/...`
  - `.../IFR_High/...`
  - `.../IFR_AreaLow/...`

## 3) Recommended disclaimer text for Phantom Ops (v1)

Use in UI footer/about/legal:

> Phantom Ops is provided for training and mission-planning support only. It is not certified for real-world flight navigation or operational control. Always use official approved sources and procedures for live operations.

## 4) Attribution guidance (v1)

Where specific source terms require attribution, include provider name and source URL in an "Attribution" or "Data Sources" section.

Suggested template per dataset:
- Dataset name
- Source organization
- Source URL
- Effective/cycle date

## 5) Open legal verification tasks

1. Confirm exact FAA redistribution/disclaimer wording to quote verbatim (if available) for:
   - NASR subscription datasets
   - VFR/IFR chart derivatives used in web tiles
2. Confirm if any ArcGIS-hosted layers used from third parties include additional terms beyond source data terms.
3. Keep a versioned attribution file tied to data cycle updates.

## 6) Subagent instruction

Before adding a new external dataset:
1. Add/update entry in `docs/data-source-register.md`
2. Add any required attribution language here
3. Note unresolved license ambiguity in `docs/subagent-notes/`
