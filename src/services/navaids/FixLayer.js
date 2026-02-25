import { fetchFixesInBounds } from './NavaidService.js';
import { makeFixIcon } from './navaidIcons.js';

const MIN_ZOOM = 8;
const DEBOUNCE_MS = 300;
const BOUNDS_BUFFER = 0.5; // degrees padding beyond viewport

export class FixLayer {
  /**
   * @param {L.Map} map
   * @param {'H'|'L'} chartFilter - 'H' for high enroute, 'L' for low enroute
   */
  constructor(map, chartFilter) {
    this.map = map;
    this.chartFilter = chartFilter;
    this.group = L.layerGroup();

    this._abortController = null;
    this._debounceTimer = null;
    /** @type {GeoJSON.Feature[] | null} Current viewport features, for proximity queries. */
    this._features = null;

    map.on('zoomend', () => this._onZoomMove());
    map.on('moveend', () => this._onZoomMove());
    map.on('layeradd', (e) => {
      if (e.layer === this.group) this._onZoomMove();
    });
  }

  _onZoomMove() {
    if (!this.map.hasLayer(this.group)) return;

    const zoom = this.map.getZoom();

    if (zoom < MIN_ZOOM) {
      this._cancel();
      this._features = null;
      this.group.clearLayers();
      return;
    }

    // Debounce rapid pan/zoom
    clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => this._fetchAndRender(), DEBOUNCE_MS);
  }

  _cancel() {
    clearTimeout(this._debounceTimer);
    this._debounceTimer = null;
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
  }

  async _fetchAndRender() {
    // Cancel any in-flight request
    if (this._abortController) this._abortController.abort();
    this._abortController = new AbortController();
    const { signal } = this._abortController;

    const b = this.map.getBounds();
    const bounds = {
      north: b.getNorth() + BOUNDS_BUFFER,
      south: b.getSouth() - BOUNDS_BUFFER,
      east: b.getEast() + BOUNDS_BUFFER,
      west: b.getWest() - BOUNDS_BUFFER,
    };

    try {
      const features = await fetchFixesInBounds(bounds, this.chartFilter, signal);
      if (signal.aborted) return;

      this._features = features;
      this.group.clearLayers();
      for (const feature of features) {
        const [lon, lat] = feature.geometry.coordinates;
        const { IDENT_TXT, TYPE_CODE } = feature.properties ?? {};
        this.group.addLayer(L.marker([lat, lon], {
          icon: makeFixIcon(TYPE_CODE, IDENT_TXT ?? ''),
          interactive: false,
        }));
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('IFR fix layer fetch failed:', err);
      }
    }
  }
}
