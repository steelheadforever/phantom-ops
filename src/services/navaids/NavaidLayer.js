import { fetchAllNavaids } from './NavaidService.js';
import { makeNavaidIcon } from './navaidIcons.js';

const MIN_ZOOM = 8;

export class NavaidLayer {
  constructor(map, { pane } = {}) {
    this.map = map;
    this._pane = pane;
    this.group = L.layerGroup();

    /** @type {GeoJSON.Feature[] | null} null = not yet fetched */
    this._features = null;
    this._rendered = false;
    this._fetching = false;

    map.on('zoomend', () => this._onZoomMove());
    map.on('layeradd', (e) => {
      if (e.layer === this.group) this._onZoomMove();
    });
  }

  _onZoomMove() {
    if (!this.map.hasLayer(this.group)) return;

    const zoom = this.map.getZoom();

    if (zoom < MIN_ZOOM) {
      if (this._rendered) {
        this.group.clearLayers();
        this._rendered = false;
      }
      return;
    }

    // zoom >= MIN_ZOOM
    if (this._rendered) return; // already drawn

    if (this._features) {
      this._renderFromCache();
    } else if (!this._fetching) {
      this._fetchAndRender();
    }
  }

  async _fetchAndRender() {
    this._fetching = true;
    try {
      this._features = await fetchAllNavaids();
      this._renderFromCache();
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('Navaid layer fetch failed:', err);
      }
    } finally {
      this._fetching = false;
    }
  }

  _renderFromCache() {
    this.group.clearLayers();
    for (const feature of this._features) {
      const [lon, lat] = feature.geometry.coordinates;
      const { IDENT, CLASS_TXT } = feature.properties ?? {};
      this.group.addLayer(L.marker([lat, lon], {
        icon: makeNavaidIcon(CLASS_TXT, IDENT ?? ''),
        interactive: false,
        ...(this._pane ? { pane: this._pane } : {}),
      }));
    }
    this._rendered = true;
  }
}
