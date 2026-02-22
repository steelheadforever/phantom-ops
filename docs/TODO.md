# Phantom Ops — TODO

_Last updated: 2026-02-22_

## Completed

- **Airspace data pipeline** — Class B/C/D GeoJSON served from Cloudflare R2 via Worker with daily cron refresh from FAA ArcGIS. Manual seed via `scripts/cache-airspace.sh --upload`. Large GeoJSON files removed from git.

## Open Questions

1. **Chart cycle metadata automation**
   - Should VFR/IFR chart cycle date/version be auto-derived from upstream metadata (instead of manually set in manifest)?

2. **Base layer catalog scope**
   - Should `terrain` / `street` remain in the base-layer manifest long-term, or be pruned to mission-planning-focused defaults?

## Next Decision Gate

- Resolve both questions before broadening production data-ops workflow.

## Status

- Paused by owner request.
