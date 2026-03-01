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
    // Pattern 1: symbols + suffix hemisphere (e.g. 29° 32' 06.57" N, 98° 16' 48.12" W)
    const part1 = String.raw`(\d{1,3})[°\s]\s*(\d{1,2})['\u2019\u02BC]\s*([\d.]+)["″\u2033]\s*([NSEWnsew])`;
    const m1 = s.match(new RegExp(`${part1}[,\\s]+${part1}`, 'i'));
    if (m1) {
      const a = this._dmsToDecimal(+m1[1], +m1[2], +m1[3], m1[4].toUpperCase());
      const b = this._dmsToDecimal(+m1[5], +m1[6], +m1[7], m1[8].toUpperCase());
      return this._assignLatLng(a, m1[4].toUpperCase(), b, m1[8].toUpperCase());
    }

    // Pattern 2: prefix hemisphere, no symbols (e.g. N29 32 06.57 W98 16 48.12)
    const m2 = s.match(/([NSEWnsew])\s*(\d{1,3})\s+(\d{1,2})\s+([\d.]+)\s+([NSEWnsew])\s*(\d{1,3})\s+(\d{1,2})\s+([\d.]+)/i);
    if (m2) {
      const a = this._dmsToDecimal(+m2[2], +m2[3], +m2[4], m2[1].toUpperCase());
      const b = this._dmsToDecimal(+m2[6], +m2[7], +m2[8], m2[5].toUpperCase());
      return this._assignLatLng(a, m2[1].toUpperCase(), b, m2[5].toUpperCase());
    }

    // Pattern 3: suffix hemisphere, no symbols (e.g. 29 32 06.57N 98 16 48.12W)
    const m3 = s.match(/(\d{1,3})\s+(\d{1,2})\s+([\d.]+)\s*([NSEWnsew])\s+(\d{1,3})\s+(\d{1,2})\s+([\d.]+)\s*([NSEWnsew])/i);
    if (m3) {
      const a = this._dmsToDecimal(+m3[1], +m3[2], +m3[3], m3[4].toUpperCase());
      const b = this._dmsToDecimal(+m3[5], +m3[6], +m3[7], m3[8].toUpperCase());
      return this._assignLatLng(a, m3[4].toUpperCase(), b, m3[8].toUpperCase());
    }

    return null;
  }

  _tryDmm(s) {
    // Pattern 1: symbols + suffix hemisphere (e.g. 29° 32.1095' N, 98° 16.8020' W)
    const part1 = String.raw`(\d{1,3})[°\s]\s*([\d.]+)['\u2019\u02BC]\s*([NSEWnsew])`;
    const m1 = s.match(new RegExp(`${part1}[,\\s]+${part1}`, 'i'));
    if (m1) {
      const a = this._dmmToDecimal(+m1[1], +m1[2], m1[3].toUpperCase());
      const b = this._dmmToDecimal(+m1[4], +m1[5], m1[6].toUpperCase());
      return this._assignLatLng(a, m1[3].toUpperCase(), b, m1[6].toUpperCase());
    }

    // Pattern 2: prefix hemisphere, no symbols (e.g. N29 32.1095 W98 16.8020)
    // Minutes must have decimal point to distinguish from DMS
    const m2 = s.match(/([NSEWnsew])\s*(\d{1,3})\s+(\d+\.\d+)\s+([NSEWnsew])\s*(\d{1,3})\s+(\d+\.\d+)/i);
    if (m2) {
      const a = this._dmmToDecimal(+m2[2], +m2[3], m2[1].toUpperCase());
      const b = this._dmmToDecimal(+m2[5], +m2[6], m2[4].toUpperCase());
      return this._assignLatLng(a, m2[1].toUpperCase(), b, m2[4].toUpperCase());
    }

    // Pattern 3: suffix hemisphere, no symbols (e.g. 29 32.1095N 98 16.8020W)
    const m3 = s.match(/(\d{1,3})\s+(\d+\.\d+)\s*([NSEWnsew])\s+(\d{1,3})\s+(\d+\.\d+)\s*([NSEWnsew])/i);
    if (m3) {
      const a = this._dmmToDecimal(+m3[1], +m3[2], m3[3].toUpperCase());
      const b = this._dmmToDecimal(+m3[4], +m3[5], m3[6].toUpperCase());
      return this._assignLatLng(a, m3[3].toUpperCase(), b, m3[6].toUpperCase());
    }

    return null;
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
