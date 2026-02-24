import { PANE_IDS } from '../../map/layerZIndex.js';

const SNAP_PX = 12; // screen-pixel radius for snapping to first point

/**
 * PolygonDrawTool — click-to-add-point placement.
 * Clicking within SNAP_PX of the first point (with ≥3 points) closes the polygon.
 * Right-click cancels at any time.
 */
export class PolygonDrawTool {
  constructor({ map, shapeManager, polygonPopup }) {
    this._map = map;
    this._shapeManager = shapeManager;
    this._polygonPopup = polygonPopup;

    this._state = 'idle'; // 'idle' | 'placing' | 'placed'
    this._points = [];         // L.LatLng array, accumulated during placement
    this._previewPolyline = null;
    this._previewPolygon = null;
    this._snapIndicator = null; // circleMarker at first point
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

  /** Called by PolygonPopup Cancel when isNew=true. */
  cancelPlacement() {
    if (this._activeShapeId) {
      this._shapeManager.removeShape(this._activeShapeId);
      this._activeShapeId = null;
    }
    this.deactivate();
  }

  /** Called by PolygonPopup Done when isNew=true. */
  resetToIdle() {
    this._state = 'idle';
    this._activeShapeId = null;
  }

  // ─── private ────────────────────────────────────────────────────────────

  _onFirstClick(e) {
    this._state = 'placing';
    this._points = [e.latlng];

    // Dashed line: placed points + cursor
    this._previewPolyline = L.polyline([e.latlng, e.latlng], {
      color: '#f5a800',
      weight: 1.5,
      dashArray: '5,5',
      pane: PANE_IDS.DRAWINGS,
      interactive: false,
    }).addTo(this._map);

    // Dashed filled polygon preview (visible once ≥2 points + cursor)
    this._previewPolygon = L.polygon([e.latlng], {
      color: '#f5a800',
      weight: 1,
      dashArray: '5,5',
      fillColor: '#f5a800',
      fillOpacity: 0.08,
      pane: PANE_IDS.DRAWINGS,
      interactive: false,
    }).addTo(this._map);

    // Snap-zone circle at first point (screen-pixel radius, stays fixed)
    this._snapIndicator = L.circleMarker(e.latlng, {
      radius: SNAP_PX,
      color: '#f5a800',
      weight: 1.5,
      fill: false,
      opacity: 0.5,
      pane: PANE_IDS.DRAWINGS,
      interactive: false,
    }).addTo(this._map);

    this._map.on('mousemove', this._onMouseMove);
    this._map.on('click', this._onNextClick);
    this._map.once('contextmenu', this._onRightClick);
  }

  _onNextClick(e) {
    // Check snap to first point when we have enough points for a polygon
    if (this._points.length >= 3) {
      const firstPt = this._map.latLngToContainerPoint(this._points[0]);
      const dx = firstPt.x - e.containerPoint.x;
      const dy = firstPt.y - e.containerPoint.y;
      if (Math.sqrt(dx * dx + dy * dy) <= SNAP_PX) {
        this._closePolygon();
        return;
      }
    }
    this._points.push(e.latlng);
    this._updatePreviews(e.latlng);
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

  _closePolygon() {
    const latlngs = this._points.map((ll) => ({ lat: ll.lat, lng: ll.lng }));
    this._cleanup();
    this._map.off('mousemove', this._onMouseMove);
    this._map.off('click', this._onNextClick);

    const shapeId = this._shapeManager.addShape({
      type: 'polygon',
      latlngs,
      color: '#4da6ff',
      opacity: this._shapeManager.lastOpacity ?? 0.26,
    }, this._map);

    this._activeShapeId = shapeId;
    this._state = 'placed';
    this._points = [];
    this._map.getContainer().style.cursor = '';
    this._polygonPopup.open(shapeId, { isNew: true });
  }

  _onRightClick(e) {
    if (e?.originalEvent) e.originalEvent.preventDefault();
    this._cleanup();
    this._map.off('mousemove', this._onMouseMove);
    this._map.off('click', this._onFirstClick);
    this._map.off('click', this._onNextClick);
    this._state = 'idle';
    this._points = [];
    this._map.getContainer().style.cursor = '';
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
