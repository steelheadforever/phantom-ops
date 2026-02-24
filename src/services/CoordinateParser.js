/**
 * CoordinateParser — parse various coordinate formats to {lat, lng}
 * Supports: MGRS, DMS, DMM, DD
 */
export class CoordinateParser {
  constructor({ mgrsLib = globalThis?.mgrs } = {}) {
    this.mgrsLib = mgrsLib;
  }

  /**
   * Parse a coordinate string in any supported format.
   * @param {string} str
   * @returns {{ lat: number, lng: number } | null}
   */
  parseToLatLng(str) {
    if (typeof str !== 'string') return null;
    const s = str.trim();
    if (!s) return null;

    return (
      this._tryMgrs(s) ||
      this._tryDms(s) ||
      this._tryDmm(s) ||
      this._tryDd(s)
    );
  }

  _tryMgrs(s) {
    if (!this.mgrsLib) return null;
    try {
      // mgrs.toPoint returns [lng, lat]
      const [lng, lat] = this.mgrsLib.toPoint(s);
      if (this._validLatLng(lat, lng)) return { lat, lng };
    } catch {
      // not MGRS
    }
    return null;
  }

  _tryDms(s) {
    // Match two DMS groups: deg° min' sec" [NSEW]
    const part = String.raw`(\d{1,3})[°\s]\s*(\d{1,2})['\u2019\u02BC]\s*([\d.]+)["″\u2033]\s*([NSEWnsew])`;
    const re = new RegExp(`${part}[,\\s]+${part}`, 'i');
    const m = s.match(re);
    if (!m) return null;

    const first = this._dmsToDecimal(+m[1], +m[2], +m[3], m[4].toUpperCase());
    const second = this._dmsToDecimal(+m[5], +m[6], +m[7], m[8].toUpperCase());

    return this._assignLatLng(first, m[4].toUpperCase(), second, m[8].toUpperCase());
  }

  _tryDmm(s) {
    // Match two DMM groups: deg° min' [NSEW]
    const part = String.raw`(\d{1,3})[°\s]\s*([\d.]+)['\u2019\u02BC]\s*([NSEWnsew])`;
    const re = new RegExp(`${part}[,\\s]+${part}`, 'i');
    const m = s.match(re);
    if (!m) return null;

    const first = this._dmmToDecimal(+m[1], +m[2], m[3].toUpperCase());
    const second = this._dmmToDecimal(+m[4], +m[5], m[6].toUpperCase());

    return this._assignLatLng(first, m[3].toUpperCase(), second, m[6].toUpperCase());
  }

  _tryDd(s) {
    // Match two decimal numbers separated by comma or whitespace
    const re = /^([-+]?\d{1,3}(?:\.\d+)?)[,\s]+([-+]?\d{1,3}(?:\.\d+)?)$/;
    const m = s.match(re);
    if (!m) return null;
    const lat = +m[1];
    const lng = +m[2];
    if (this._validLatLng(lat, lng)) return { lat, lng };
    return null;
  }

  _dmsToDecimal(deg, min, sec, hemi) {
    const val = deg + min / 60 + sec / 3600;
    return (hemi === 'S' || hemi === 'W') ? -val : val;
  }

  _dmmToDecimal(deg, min, hemi) {
    const val = deg + min / 60;
    return (hemi === 'S' || hemi === 'W') ? -val : val;
  }

  _assignLatLng(a, aHemi, b, bHemi) {
    // If first has N/S hemisphere it's latitude; if E/W it's longitude
    let lat, lng;
    if (aHemi === 'N' || aHemi === 'S') {
      lat = a; lng = b;
    } else {
      lat = b; lng = a;
    }
    if (this._validLatLng(lat, lng)) return { lat, lng };
    return null;
  }

  _validLatLng(lat, lng) {
    return (
      typeof lat === 'number' && isFinite(lat) && lat >= -90 && lat <= 90 &&
      typeof lng === 'number' && isFinite(lng) && lng >= -180 && lng <= 180
    );
  }
}
