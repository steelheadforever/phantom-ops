/**
 * RouteCalc — pure flight math, no Leaflet/DOM dependencies.
 */

const R_NM = 3440.065; // Earth radius in nautical miles
const DEG = Math.PI / 180;

/**
 * Great-circle distance in nautical miles between two lat/lng points.
 * @param {number} lat1 @param {number} lng1 @param {number} lat2 @param {number} lng2
 * @returns {number}
 */
export function haversineNm(lat1, lng1, lat2, lng2) {
  const dLat = (lat2 - lat1) * DEG;
  const dLng = (lng2 - lng1) * DEG;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLng / 2) ** 2;
  return 2 * R_NM * Math.asin(Math.sqrt(a));
}

/**
 * Initial true bearing (0–360°) from point 1 to point 2.
 * @param {number} lat1 @param {number} lng1 @param {number} lat2 @param {number} lng2
 * @returns {number}
 */
export function bearingDeg(lat1, lng1, lat2, lng2) {
  const φ1 = lat1 * DEG;
  const φ2 = lat2 * DEG;
  const Δλ = (lng2 - lng1) * DEG;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) / DEG) + 360) % 360;
}

/**
 * Full-vector wind triangle.
 * Solves for ground speed (GS) and true heading (HDG) given:
 *   trueCourse (TC) in degrees, TAS in knots, windFrom in degrees, windSpd in knots.
 *
 * Math: treat as vector problem.
 *   Wind vector W = windSpd pointed FROM windFrom (i.e. blowing toward windFrom+180).
 *   We need: GS² - 2·GS·(W·TC_hat) - (TAS² - |W|²) = 0, but more cleanly:
 *   Using the classic triangle: WCA = arcsin(wS·sin(wind_angle) / TAS)
 *   GS = TAS·cos(WCA) + W_along_track
 *
 * Returns { GS, HDG, WCA } or null if impossible (TAS=0 or discriminant<0).
 * @param {number} trueCourse  degrees magnetic/true (0–360)
 * @param {number} TAS         knots
 * @param {number} windFrom    degrees (wind comes FROM this direction)
 * @param {number} windSpd     knots
 * @returns {{ GS: number, HDG: number, WCA: number } | null}
 */
export function windTriangle(trueCourse, TAS, windFrom, windSpd) {
  if (!TAS || TAS <= 0) return null;

  // Wind correction angle using quadratic approach
  // WA = angle between TC and wind-from direction
  const windTo = (windFrom + 180) % 360;  // direction the wind is blowing toward
  const WA = (windTo - trueCourse) * DEG; // angle of wind vector relative to track

  // Cross-wind and head-wind components
  const Wcross = windSpd * Math.sin(WA);   // cross-track wind (positive = left to right)
  const Walong = windSpd * Math.cos(WA);   // along-track wind (positive = tailwind)

  // WCA = arcsin(Wcross / TAS)
  const sinWCA = Wcross / TAS;
  if (Math.abs(sinWCA) > 1) return null; // impossible wind scenario

  const WCA = Math.asin(sinWCA) / DEG;
  const HDG = ((trueCourse + WCA) + 360) % 360;
  const GS = TAS * Math.cos(WCA * DEG) + Walong;

  if (GS <= 0) return null; // headwind stronger than TAS — can't make progress

  return { GS: Math.round(GS * 10) / 10, HDG: Math.round(HDG * 10) / 10, WCA: Math.round(WCA * 10) / 10 };
}

/**
 * Compute leg data for a route.
 * @param {Array<{lat,lng,ktas,windHdg,windSpd}>} waypoints
 * @param {number|null} defaultKtas
 * @param {number|null} defaultWindHdg
 * @param {number|null} defaultWindSpd
 * @returns {Array<{distNm, trueTrack, trueHdg, gs, eteSeconds}>}
 */
export function computeLegs(waypoints, defaultKtas, defaultWindHdg, defaultWindSpd) {
  const legs = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i];
    const to = waypoints[i + 1];

    const distNm = haversineNm(from.lat, from.lng, to.lat, to.lng);
    const trueTrack = bearingDeg(from.lat, from.lng, to.lat, to.lng);

    // Per-leg overrides take precedence over route defaults
    const ktas = to.ktas ?? defaultKtas ?? null;
    const windHdg = to.windHdg ?? defaultWindHdg ?? null;
    const windSpd = to.windSpd ?? defaultWindSpd ?? null;

    let gs = null;
    let trueHdg = trueTrack;
    let eteSeconds = null;

    if (ktas && ktas > 0) {
      if (windHdg != null && windSpd != null && windSpd > 0) {
        const wt = windTriangle(trueTrack, ktas, windHdg, windSpd);
        if (wt) {
          gs = wt.GS;
          trueHdg = wt.HDG;
        } else {
          gs = ktas; // fallback — impossible wind, use TAS as GS
          trueHdg = trueTrack;
        }
      } else {
        gs = ktas;
        trueHdg = trueTrack;
      }
      eteSeconds = gs > 0 ? (distNm / gs) * 3600 : null;
    }

    legs.push({
      distNm: Math.round(distNm * 10) / 10,
      trueTrack: Math.round(trueTrack),
      trueHdg: Math.round(trueHdg),
      gs,
      eteSeconds,
    });
  }
  return legs;
}

/**
 * Format ETE seconds as HH:MM:SS string.
 * @param {number|null} seconds
 * @returns {string}
 */
export function formatEte(seconds) {
  if (seconds == null || !isFinite(seconds)) return '--:--:--';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Add ETE (in seconds) to a departure time string 'HH:MM' (UTC).
 * @param {string} departureTime  'HH:MM'
 * @param {number|null} totalEteSeconds
 * @returns {string}  'HH:MMZ' or '--'
 */
export function computeToa(departureTime, totalEteSeconds) {
  if (!departureTime || totalEteSeconds == null) return '--';
  const [hh, mm] = departureTime.split(':').map(Number);
  if (isNaN(hh) || isNaN(mm)) return '--';
  const totalMin = hh * 60 + mm + Math.round(totalEteSeconds / 60);
  const toaH = Math.floor(totalMin / 60) % 24;
  const toaM = totalMin % 60;
  return `${String(toaH).padStart(2, '0')}:${String(toaM).padStart(2, '0')}Z`;
}
