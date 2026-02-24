import { PANE_IDS } from '../../map/layerZIndex.js';

const SNAP_PX = 12;

/**
 * PolygonDrawTool — click-to-add-point polygon placement.
 *
 * Flow with pre-placement popup:
 *   1. activate() → polygonPopup.openPre(), crosshair cursor
 *   2. First click → create shape (using popup's pending config), attachShape()
 *   3. Each click → add point, updateShape, refreshCornerTable
 *   4. Snap to first point (≥3 pts) → finishPolygon, notifyPolygonClosed
 *   5. Done → resetToIdle(); Cancel → cancelPlacement()
 */
export class PolygonDrawTool {
  constructor({ map, shapeManager, polygonPopup }) {
    this._map = map;
    this._shapeManager = shapeManager;
    this._polygonPopup = polygonPopup;

    this._state = 'idle';
    this._points = [];
    this._previewPolyline = null;
    this._previewPolygon = null;
    this._snapIndicator = null;
    this._activeShapeId = null;

    this._onFirstClick = this._onFirstClick.bind(this);
    this._onNextClick = this._onNextClick.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onRightClick = this._onRightClick.bind(this);
  }

  activate() {
    if (this._state !== 'idle') return;
    this._map.getContainer().style.cursor = 'crosshair';
    this._polygonPopup.openPre();
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

  cancelPlacement() {
    if (this._activeShapeId) {
      this._shapeManager.removeShape(this._activeShapeId);
      this._activeShapeId = null;
    }
    this.deactivate();
  }

  resetToIdle() {
    this._state = 'idle';
    this._activeShapeId = null;
  }

  // ─── private ────────────────────────────────────────────────────────────

  _onFirstClick(e) {
    this._state = 'placing';
    this._points = [e.latlng];

    // Create shape immediately using any config set in pre-placement popup
    const config = this._polygonPopup.getPendingConfig();
    const shapeId = this._shapeManager.addShape({
      type: 'polygon',
      latlngs: [{ lat: e.latlng.lat, lng: e.latlng.lng }],
      color:   config.color,
      opacity: config.opacity,
      name:    config.name || undefined,
    }, this._map);
    this._activeShapeId = shapeId;

    // Transition popup from pre-placement to live editing
    this._polygonPopup.attachShape(shapeId);

    // Dashed preview polyline
    this._previewPolyline = L.polyline([e.latlng, e.latlng], {
      color: '#f5a800', weight: 1.5, dashArray: '5,5',
      pane: PANE_IDS.DRAWINGS, interactive: false,
    }).addTo(this._map);

    // Dashed filled polygon preview
    this._previewPolygon = L.polygon([e.latlng], {
      color: '#f5a800', weight: 1, dashArray: '5,5',
      fillColor: '#f5a800', fillOpacity: 0.08,
      pane: PANE_IDS.DRAWINGS, interactive: false,
    }).addTo(this._map);

    // Snap-zone circle at first point
    this._snapIndicator = L.circleMarker(e.latlng, {
      radius: SNAP_PX, color: '#f5a800', weight: 1.5,
      fill: false, opacity: 0.5,
      pane: PANE_IDS.DRAWINGS, interactive: false,
    }).addTo(this._map);

    this._map.on('mousemove', this._onMouseMove);
    this._map.on('click', this._onNextClick);
    this._map.once('contextmenu', this._onRightClick);
  }

  _onNextClick(e) {
    if (this._points.length >= 3) {
      const firstPt = this._map.latLngToContainerPoint(this._points[0]);
      const dx = firstPt.x - e.containerPoint.x;
      const dy = firstPt.y - e.containerPoint.y;
      if (Math.sqrt(dx * dx + dy * dy) <= SNAP_PX) {
        this._finishPolygon();
        return;
      }
    }
    this._points.push(e.latlng);
    this._updatePreviews(e.latlng);

    // Sync shape and refresh table
    const latlngs = this._points.map((ll) => ({ lat: ll.lat, lng: ll.lng }));
    this._shapeManager.updateShape(this._activeShapeId, { latlngs });
    this._polygonPopup.refreshCornerTable();
  }

  _onMouseMove(e) {
    this._updatePreviews(e.latlng);
  }

  _updatePreviews(cursor) {
    this._previewPolyline?.setLatLngs([...this._points, cursor]);
    if (this._points.length >= 2) {
      this._previewPolygon?.setLatLngs([...this._points, cursor]);
    }
  }

  _finishPolygon() {
    this._cleanup();
    this._map.off('mousemove', this._onMouseMove);
    this._map.off('click', this._onNextClick);
    this._state = 'placed';
    this._points = [];
    this._map.getContainer().style.cursor = '';

    // Tell popup placement is done — it adds draggable corner markers
    this._polygonPopup.notifyPolygonClosed();
  }

  _onRightClick(e) {
    if (e?.originalEvent) e.originalEvent.preventDefault();
    this._polygonPopup?.cancelPlacement
      ? this._polygonPopup // don't call — let user click Cancel in popup
      : null;
    this._cleanup();
    this._map.off('mousemove', this._onMouseMove);
    this._map.off('click', this._onFirstClick);
    this._map.off('click', this._onNextClick);
    // If shape already created, remove it
    if (this._activeShapeId) {
      this._shapeManager.removeShape(this._activeShapeId);
      this._activeShapeId = null;
    }
    this._state = 'idle';
    this._points = [];
    this._map.getContainer().style.cursor = '';
    this._polygonPopup.close();
  }

  _cleanup() {
    this._previewPolyline?.remove();
    this._previewPolyline = null;
    this._previewPolygon?.remove();
    this._previewPolygon = null;
    this._snapIndicator?.remove();
    this._snapIndicator = null;
  }
}
