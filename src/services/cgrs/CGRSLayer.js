import { iterateCGRSCells, TEXAS_BOUNDS } from './CGRSUtils.js';

const CGRS_RECT_STYLE = Object.freeze({
  color: 'rgba(160,160,160,0.55)',
  weight: 0.8,
  fill: false,
  interactive: false,
});

/**
 * Zoom thresholds:
 *  zoom ≤ 7 → 30-minute killboxes (all Texas, ~572 cells)
 *  zoom ≥ 8 → 10-minute keypads (viewport-clipped, 9 per killbox)
 */
function getPrecision(zoom) {
  return zoom >= 8 ? 'keypad' : 'killbox';
}

function makeLabelIcon(code) {
  return L.divIcon({
    html: `<span style="font:9px 'B612 Mono',monospace;color:rgba(200,200,200,0.7);white-space:nowrap;pointer-events:none">${code}</span>`,
    className: '',
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

export class CGRSLayer {
  constructor(map) {
    this.map = map;
    this.group = L.layerGroup();

    map.on('zoomend', () => this._onZoomMove());
    map.on('moveend', () => this._onZoomMove());
    map.on('layeradd', (e) => {
      if (e.layer === this.group) this._rebuild();
    });

    this._rebuild();
  }

  _onZoomMove() {
    if (!this.map.hasLayer(this.group)) return;
    this._rebuild();
  }

  _rebuild() {
    const precision = getPrecision(this.map.getZoom());
    this.group.clearLayers();

    const bounds = precision === 'killbox'
      ? { ...TEXAS_BOUNDS }
      : this._viewportClippedToTexas();

    if (!bounds) return;

    for (const cell of iterateCGRSCells(bounds, precision)) {
      this.group.addLayer(L.rectangle(
        [[cell.swLat, cell.swLon], [cell.neLat, cell.neLon]],
        CGRS_RECT_STYLE,
      ));

      const center = [(cell.swLat + cell.neLat) / 2, (cell.swLon + cell.neLon) / 2];
      this.group.addLayer(L.marker(center, {
        icon: makeLabelIcon(cell.code),
        interactive: false,
      }));
    }
  }

  _viewportClippedToTexas() {
    const b = this.map.getBounds();
    const minLat = Math.max(b.getSouth(), TEXAS_BOUNDS.minLat);
    const maxLat = Math.min(b.getNorth(), TEXAS_BOUNDS.maxLat);
    const minLon = Math.max(b.getWest(),  TEXAS_BOUNDS.minLon);
    const maxLon = Math.min(b.getEast(),  TEXAS_BOUNDS.maxLon);
    if (minLat >= maxLat || minLon >= maxLon) return null;
    return { minLat, maxLat, minLon, maxLon };
  }
}
