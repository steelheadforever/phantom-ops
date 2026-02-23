# Phantom Ops — TODO

_Last updated: 2026-02-22_

## Completed

- **Airspace data pipeline** — Class B/C/D GeoJSON served from Cloudflare R2 via Worker with daily cron refresh from FAA ArcGIS. Manual seed via `scripts/cache-airspace.sh --upload`. Large GeoJSON files removed from git.

- **UI redesign (Phase 6)** — Full frontend overhaul:
  - 558 FTS design language: blue/gold theme, B612 Mono font throughout
  - Top bar: hamburger menu, 558 cross insignia, *PHANTOM-OPS* title, live UTC clock (HH:MM:SSZ)
  - Slide-over side menu with Plan/Study stubs for future implementation
  - Bottom bar: coordinate display (left) + globe/airspace/brightness popup controls (right)
  - Semi-transparent dark grey bars with backdrop blur
  - Replaced floating dimmer card and top-right layer panel with unified bottom-bar popups

## Open Questions

1. **Chart cycle metadata automation**
   - Should VFR/IFR chart cycle date/version be auto-derived from upstream metadata (instead of manually set in manifest)?

2. **Base layer catalog scope**
   - Should `terrain` / `street` remain in the base-layer manifest long-term, or be pruned to mission-planning-focused defaults?

## Up Next

- **PLAN mode** — route/waypoint planning workflow (side menu stub ready)
- **STUDY mode** — content TBD (side menu stub ready)
- Surface chart cycle "last updated" metadata somewhere in the UI

## Next Decision Gate

- Resolve open questions 1 & 2 before broadening production data-ops workflow.
- Define scope of PLAN and STUDY modes before implementation begins.
