import { PANE_IDS } from '../../map/layerZIndex.js';
import { getSymbolSvg } from './pointSymbols.js';

/**
 * PointDrawTool — single-click point placement on the map.
 *
 * States: idle → placed
 *
 * Flow:
 *   1. activate() — crosshair cursor, opens PointPopup in pre-placement mode
 *   2. Single click — creates point shape using popup's pending config
 *   3. pointPopup.attachShape(id) — popup transitions to edit mode
 *   4. Popup Done → resetToIdle(); Cancel → cancelPlacement()
 */
export class PointDrawTool {
  constructor({ map, shapeManager, pointPopup }) {
    this._map = map;
    this._shapeManager = shapeManager;
    this._pointPopup = pointPopup;

    this._state = 'idle';     // 'idle' | 'placed'
    this._activeShapeId = null;
    this._cursorMarker = null; // ghost marker that follows the cursor

    this._onPlaceClick = this._onPlaceClick.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onRightClick = this._onRightClick.bind(this);
  }

  activate() {
    if (this._state !== 'idle') return;
    this._map.getContainer().style.cursor = 'crosshair';
    this._pointPopup.openPre();
    this._spawnCursorMarker();
    this._map.on('mousemove', this._onMouseMove);
    this._map.once('click', this._onPlaceClick);
    this._map.once('contextmenu', this._onRightClick);
  }

  deactivate() {
    this._destroyCursorMarker();
    this._state = 'idle';
    this._map.getContainer().style.cursor = '';
    this._map.off('mousemove', this._onMouseMove);
    this._map.off('click', this._onPlaceClick);
    this._map.off('contextmenu', this._onRightClick);
  }

  /** Called by PointPopup Cancel when isNew=true. */
  cancelPlacement() {
    if (this._activeShapeId) {
      this._shapeManager.removeShape(this._activeShapeId);
      this._activeShapeId = null;
    }
    this.deactivate();
  }

  /** Called by PointPopup Done when isNew=true. */
  resetToIdle() {
    this._state = 'idle';
    this._activeShapeId = null;
    this._map.getContainer().style.cursor = '';
  }

  // ─── private ────────────────────────────────────────────────────────────

  _onPlaceClick(e) {
    this._destroyCursorMarker();
    this._map.off('mousemove', this._onMouseMove);

    const config = this._pointPopup.getPendingConfig();
    const shapeId = this._shapeManager.addShape({
      type: 'point',
      lat: e.latlng.lat,
      lng: e.latlng.lng,
      symbol: config.symbol ?? 'waypoint',
      color: config.color,
      opacity: config.opacity,
      name: config.name || undefined,
    }, this._map);

    this._activeShapeId = shapeId;
    this._state = 'placed';
    this._map.getContainer().style.cursor = '';

    this._pointPopup.attachShape(shapeId);
  }

  _onMouseMove(e) {
    this._cursorMarker?.setLatLng(e.latlng);
    // Sync ghost marker symbol/color to whatever is set in the pre-placement popup
    const config = this._pointPopup.getPendingConfig();
    if (this._cursorMarker && config) {
      this._cursorMarker.setIcon(this._makeGhostIcon(config));
    }
  }

  _onRightClick(e) {
    if (e?.originalEvent) e.originalEvent.preventDefault();
    this._pointPopup.close();
    this.deactivate();
  }

  _spawnCursorMarker() {
    const config = this._pointPopup.getPendingConfig();
    this._cursorMarker = L.marker([0, 0], {
      icon: this._makeGhostIcon(config),
      pane: PANE_IDS.DRAWINGS,
      interactive: false,
      opacity: 0.6,
    }).addTo(this._map);
  }

  _makeGhostIcon(config) {
    const svg = getSymbolSvg(config.symbol ?? 'waypoint', config.color, config.opacity, 20);
    return L.divIcon({
      className: 'point-symbol-icon',
      html: svg,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  }

  _destroyCursorMarker() {
    this._cursorMarker?.remove();
    this._cursorMarker = null;
  }
}
