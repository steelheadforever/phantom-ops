const FORMATS = ['MGRS', 'DMS', 'DMM'];

export class CoordinateService {
  constructor({ statusBar, mgrsLib = globalThis?.mgrs }) {
    this.statusBar = statusBar;
    this.mgrsLib = mgrsLib;
    this.currentFormatIndex = 0;
    this.currentLatLng = null;
    this._formatListeners = [];
  }

  /** Register a callback invoked whenever the coordinate format changes. */
  onFormatChange(cb) {
    this._formatListeners.push(cb);
  }

  getCurrentFormat() {
    return FORMATS[this.currentFormatIndex];
  }

  cycleFormat() {
    this.currentFormatIndex = (this.currentFormatIndex + 1) % FORMATS.length;
    this.publishCurrentCoordinate();
    const fmt = this.getCurrentFormat();
    for (const cb of this._formatListeners) { try { cb(fmt); } catch { /* ignore */ } }
    return fmt;
  }

  attachToMap(map) {
    if (window.matchMedia('(pointer: coarse)').matches) {
      // Touch: show map center coordinate, updated live during pan
      const updateCenter = () => {
        this.currentLatLng = map.getCenter();
        this.publishCurrentCoordinate();
      };
      map.on('move', updateCenter);
      map.on('moveend', updateCenter);
      updateCenter();
    } else {
      // Desktop: show coordinate under the mouse cursor
      map.on('mousemove', (event) => {
        this.currentLatLng = event?.latlng ?? null;
        this.publishCurrentCoordinate();
      });

      map.on('mouseout', () => {
        this.currentLatLng = null;
        this.statusBar.setCoordinate('--');
      });
    }

    this.statusBar.onCoordinateClick(() => {
      this.cycleFormat();
    });
  }

  publishCurrentCoordinate() {
    if (!this.currentLatLng) {
      this.statusBar.setCoordinate('--');
      return;
    }

    const formatted = this.formatCoordinate(
      this.currentLatLng.lat,
      this.currentLatLng.lng,
      this.getCurrentFormat(),
    );

    this.statusBar.setCoordinate(`${this.getCurrentFormat()}: ${formatted}`);
  }

  formatCoordinate(lat, lng, format) {
    if (format === 'MGRS') {
      // 10-digit MGRS precision (1m)
      return this.mgrsLib.forward([lng, lat], 5);
    }

    if (format === 'DMM') {
      return `${this.toDmm(lat, true)} ${this.toDmm(lng, false)}`;
    }

    return `${this.toDms(lat, true)} ${this.toDms(lng, false)}`;
  }

  toDmm(decimal, isLatitude) {
    const hemisphere = isLatitude
      ? (decimal >= 0 ? 'N' : 'S')
      : (decimal >= 0 ? 'E' : 'W');

    const absolute = Math.abs(decimal);
    const degrees = Math.floor(absolute);
    const minutes = (absolute - degrees) * 60;

    return `${degrees}° ${minutes.toFixed(4)}' ${hemisphere}`;
  }

  toDms(decimal, isLatitude) {
    const hemisphere = isLatitude
      ? (decimal >= 0 ? 'N' : 'S')
      : (decimal >= 0 ? 'E' : 'W');

    const absolute = Math.abs(decimal);
    const degrees = Math.floor(absolute);
    const minutesRaw = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesRaw);
    const seconds = (minutesRaw - minutes) * 60;

    return `${degrees}° ${minutes}' ${seconds.toFixed(2)}\" ${hemisphere}`;
  }
}

export { FORMATS };
