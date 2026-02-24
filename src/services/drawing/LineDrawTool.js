import { PANE_IDS } from '../../map/layerZIndex.js';

/**
 * LineDrawTool — click-to-add-point line placement on the map.
 *
 * States: idle → placing → placed
 *
 * Flow:
 *   1. activate() — crosshair cursor, wait for first click
 *   2. First click — creates shape, opens LinePopup, shows preview
 *   3. Subsequent clicks — add points (if placing enabled)
 *   4. Right-click — stop placing (Place toggle goes off in popup)
 *   5. Popup Done → resetToIdle(); Cancel → cancelPlacement()
 */
export class LineDrawTool {
  constructor({ map, shapeManager, linePopup }) {
    this._map = map;
    this._shapeManager = shapeManager;
    this._linePopup = linePopup;

    this._state = 'idle';       // 'idle' | 'placing' | 'placed'
    this._points = [];           // L.LatLng[], accumulated during placement
    this._pointMarkers = [];     // L.circleMarker at each placed point
    this._previewLine = null;    // dashed gold line: last point → cursor
    this._distLabel = null;      // distance label marker
    this._placingEnabled = true;
    this._activeShapeId = null;

    this._onFirstClick = this._onFirstClick.bind(this);
    this._onNextClick = this._onNextClick.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onRightClick = this._onRightClick.bind(this);
  }

  activate() {
    if (this._state !== 'idle') return;
    this._map.getContainer().style.cursor = 'crosshair';
    this._map.once('click', this._onFirstClick);
    this._map.once('contextmenu', this._onRightClick);
  }

  deactivate() {
    this._cleanup();
    this._state = 'idle';
    this._points = [];
    this._map.getContainer().style.cursor = '';
    this._map.off('click', this._onFirstClick);
    this._map.off('click', this._onNextClick);
    this._map.off('mousemove', this._onMouseMove);
    this._map.off('contextmenu', this._onRightClick);
  }

  /** Called by LinePopup Cancel when isNew=true. */
  cancelPlacement() {
    if (this._activeShapeId) {
      this._shapeManager.removeShape(this._activeShapeId);
      this._activeShapeId = null;
    }
    this.deactivate();
  }

  /** Called by LinePopup Done when isNew=true. */
  resetToIdle() {
    this._cleanupPreview();
    this._cleanupPointMarkers();
    this._map.off('click', this._onNextClick);
    this._map.off('mousemove', this._onMouseMove);
    this._map.off('contextmenu', this._onRightClick);
    this._state = 'placed';
    this._activeShapeId = null;
    this._points = [];
    this._map.getContainer().style.cursor = '';
  }

  /**
   * Toggle placing on/off — called by LinePopup Place button.
   * Also called internally from _onRightClick.
   */
  setPlacing(enabled) {
    this._placingEnabled = enabled;
    if (!enabled) {
      this._cleanupPreview();
      this._map.off('mousemove', this._onMouseMove);
    } else if (this._state === 'placing' && this._points.length > 0) {
      // Re-enable preview from last placed point
      const last = this._points[this._points.length - 1];
      this._previewLine = L.polyline([last, last], {
        color: '#f5a800',
        weight: 1.5,
        dashArray: '5,5',
        pane: PANE_IDS.DRAWINGS,
        interactive: false,
      }).addTo(this._map);

      this._distLabel = L.marker(last, {
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
    }
  }

  // ─── private ────────────────────────────────────────────────────────────

  _onFirstClick(e) {
    this._state = 'placing';
    this._placingEnabled = true;
    this._points = [e.latlng];

    this._addPointMarker(e.latlng);

    // Create the shape in ShapeManager immediately (1 point to start)
    const shapeId = this._shapeManager.addShape({
      type: 'line',
      latlngs: [{ lat: e.latlng.lat, lng: e.latlng.lng }],
      color: '#4da6ff',
      opacity: 1.0,
      dash: 'solid',
      showLabel: false,
    }, this._map);
    this._activeShapeId = shapeId;

    // Preview line from first point to cursor
    this._previewLine = L.polyline([e.latlng, e.latlng], {
      color: '#f5a800',
      weight: 1.5,
      dashArray: '5,5',
      pane: PANE_IDS.DRAWINGS,
      interactive: false,
    }).addTo(this._map);

    // Distance label
    this._distLabel = L.marker(e.latlng, {
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
    this._map.on('click', this._onNextClick);
    this._map.once('contextmenu', this._onRightClick);

    // Open popup so user can name/style while placing continues
    this._linePopup.open(shapeId, { isNew: true });
  }

  _onNextClick(e) {
    if (!this._placingEnabled) return;
    this._points.push(e.latlng);
    this._addPointMarker(e.latlng);

    const latlngs = this._points.map((ll) => ({ lat: ll.lat, lng: ll.lng }));
    this._shapeManager.updateShape(this._activeShapeId, { latlngs });

    // Tell popup to refresh the point table
    this._linePopup?.refreshPointTable();
  }

  _onMouseMove(e) {
    if (!this._previewLine || !this._placingEnabled) return;
    const last = this._points[this._points.length - 1];
    if (!last) return;
    const cursor = e.latlng;
    this._previewLine.setLatLngs([last, cursor]);

    const distNm = this._map.distance(last, cursor) / 1852;
    const midLat = (last.lat + cursor.lat) / 2;
    const midLng = (last.lng + cursor.lng) / 2;
    this._distLabel.setLatLng([midLat, midLng]);
    const el = this._distLabel.getElement?.()?.querySelector('div');
    if (el) el.textContent = `${distNm.toFixed(2)} nm`;
  }

  _onRightClick(e) {
    if (e?.originalEvent) e.originalEvent.preventDefault();
    // Stop placing but keep the shape and keep popup open
    this._placingEnabled = false;
    this._cleanupPreview();
    this._map.off('mousemove', this._onMouseMove);
    // Notify popup so Place button reflects the change
    this._linePopup?.setPlacing(false);
  }

  _addPointMarker(latlng) {
    const m = L.circleMarker(latlng, {
      radius: 4,
      color: '#f5a800',
      weight: 1.5,
      fillColor: '#f5a800',
      fillOpacity: 0.85,
      pane: PANE_IDS.DRAWINGS,
      interactive: false,
    }).addTo(this._map);
    this._pointMarkers.push(m);
  }

  _cleanupPreview() {
    this._previewLine?.remove();
    this._previewLine = null;
    this._distLabel?.remove();
    this._distLabel = null;
  }

  _cleanupPointMarkers() {
    for (const m of this._pointMarkers) m.remove();
    this._pointMarkers = [];
  }

  _cleanup() {
    this._cleanupPreview();
    this._cleanupPointMarkers();
  }
}
