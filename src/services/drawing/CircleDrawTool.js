import { PANE_IDS } from '../../map/layerZIndex.js';

/**
 * CircleDrawTool — two-click circle placement on the map.
 *
 * States: idle → placing-radius → placed
 *
 * Usage:
 *   const tool = new CircleDrawTool({ map, shapeManager, shapePopup });
 *   tool.activate();   // start listening for clicks
 *   tool.deactivate(); // stop (also called internally after cancel/place)
 */
export class CircleDrawTool {
  constructor({ map, shapeManager, shapePopup }) {
    this._map = map;
    this._shapeManager = shapeManager;
    this._shapePopup = shapePopup;

    this._state = 'idle';      // 'idle' | 'placing-radius' | 'placed'
    this._center = null;       // L.LatLng
    this._previewLine = null;  // L.Polyline
    this._previewCircle = null;// L.Circle (dashed, no fill)
    this._radiusLabel = null;  // L.Marker with divIcon
    this._activeShapeId = null;

    // Bound handlers
    this._onFirstClick = this._onFirstClick.bind(this);
    this._onSecondClick = this._onSecondClick.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onRightClick = this._onRightClick.bind(this);
  }

  activate() {
    if (this._state !== 'idle') return;
    this._map.getContainer().style.cursor = 'crosshair';
    this._shapePopup.openPre();
    this._map.once('click', this._onFirstClick);
    this._map.once('contextmenu', this._onRightClick);
  }

  deactivate() {
    this._cleanup();
    this._state = 'idle';
    this._map.getContainer().style.cursor = '';
    this._map.off('click', this._onFirstClick);
    this._map.off('click', this._onSecondClick);
    this._map.off('mousemove', this._onMouseMove);
    this._map.off('contextmenu', this._onRightClick);
  }

  /** Called by ShapePopup when user clicks Cancel on a new placement. */
  cancelPlacement() {
    if (this._activeShapeId) {
      this._shapeManager.removeShape(this._activeShapeId);
      this._activeShapeId = null;
    }
    this.deactivate();
  }

  /** Called by ShapePopup when user clicks Done — shape is kept, tool goes idle. */
  resetToIdle() {
    this._state = 'idle';
    this._activeShapeId = null;
  }

  // ─── private ────────────────────────────────────────────────────────────

  _onFirstClick(e) {
    this._state = 'placing-radius';
    this._center = e.latlng;

    // Preview dashed line from center to cursor
    this._previewLine = L.polyline([this._center, this._center], {
      color: '#f5a800',
      weight: 1.5,
      dashArray: '5,5',
      pane: PANE_IDS.DRAWINGS,
      interactive: false,
    }).addTo(this._map);

    // Preview dashed circle that grows with the cursor
    this._previewCircle = L.circle(this._center, {
      radius: 0,
      color: '#f5a800',
      weight: 1.5,
      dashArray: '5,5',
      fill: false,
      pane: PANE_IDS.DRAWINGS,
      interactive: false,
    }).addTo(this._map);

    // Radius label marker
    this._radiusLabel = L.marker(this._center, {
      icon: L.divIcon({
        className: 'radius-label',
        html: '<div></div>',
        iconSize: [80, 20],
        iconAnchor: [40, 20],
      }),
      pane: PANE_IDS.DRAWINGS,
      interactive: false,
    }).addTo(this._map);

    this._map.on('mousemove', this._onMouseMove);
    this._map.once('click', this._onSecondClick);
    this._map.once('contextmenu', this._onRightClick);
  }

  _onMouseMove(e) {
    if (!this._previewLine || !this._center) return;
    const cursor = e.latlng;
    this._previewLine.setLatLngs([this._center, cursor]);

    const distM = this._map.distance(this._center, cursor);
    const radiusNm = distM / 1852;

    // Grow the preview circle
    this._previewCircle?.setRadius(distM);

    // Place label at midpoint
    const midLat = (this._center.lat + cursor.lat) / 2;
    const midLng = (this._center.lng + cursor.lng) / 2;
    this._radiusLabel.setLatLng([midLat, midLng]);
    const labelEl = this._radiusLabel.getElement?.()?.querySelector('div');
    if (labelEl) labelEl.textContent = `${radiusNm.toFixed(2)} nm`;
  }

  _onSecondClick(e) {
    const radiusNm = this._map.distance(this._center, e.latlng) / 1852;

    this._cleanup();
    this._map.off('mousemove', this._onMouseMove);

    // Use whatever name/color/opacity the user set in the pre-placement popup
    const config = this._shapePopup.getPendingConfig();
    const shapeId = this._shapeManager.addShape({
      centerLat: this._center.lat,
      centerLng: this._center.lng,
      radiusNm: Math.max(radiusNm, 0.01),
      color:   config.color,
      opacity: config.opacity,
      name:    config.name || undefined,
    }, this._map);
    this._activeShapeId = shapeId;
    this._state = 'placed';
    this._map.getContainer().style.cursor = '';

    // Transition popup from pre-placement to active editing
    this._shapePopup.attachShape(shapeId);
  }

  _onRightClick(e) {
    // Prevent Leaflet default context menu from propagating further
    if (e?.originalEvent) {
      e.originalEvent.preventDefault();
    }
    this._cleanup();
    this._map.off('mousemove', this._onMouseMove);
    this._map.off('click', this._onFirstClick);
    this._map.off('click', this._onSecondClick);
    this._state = 'idle';
    this._map.getContainer().style.cursor = '';
  }

  _cleanup() {
    if (this._previewLine) {
      this._previewLine.remove();
      this._previewLine = null;
    }
    if (this._previewCircle) {
      this._previewCircle.remove();
      this._previewCircle = null;
    }
    if (this._radiusLabel) {
      this._radiusLabel.remove();
      this._radiusLabel = null;
    }
  }
}
