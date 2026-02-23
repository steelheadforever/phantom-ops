// Combat Grid Reference System (CGRS) utilities
// Structure: 30-minute killboxes subdivided into 9 × 10-minute keypads
// Keypads numbered 1–9 in telephone layout (1=NW, 9=SE):
//   1 | 2 | 3   ← North
//   4 | 5 | 6
//   7 | 8 | 9   ← South
//
// Killbox naming: {2-digit lat number}{2-letter lon code}{optional keypad}
//   Lat number  = floor((lat + 90) × 2) − 200   (e.g. 29.5°N → 39)
//   Lon letters = base-26 encode of (lonBandIdx + 340), A–Z standard alphabet
//                 (e.g. −98.5°W → lonBandIdx 163 → 503 → "TJ")
//   Example: 39TJ9 = lat band 39, lon band TJ, keypad 9 (SE)
// Datum: WGS84

export const TEXAS_BOUNDS = Object.freeze({
  minLat: 25.8,
  maxLat: 36.5,
  minLon: -106.6,
  maxLon: -93.5,
});

// Standard 26-character alphabet (A–Z, includes I and O)
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Cell sizes in decimal degrees
const KILLBOX_SIZE = 0.5;       // 30 minutes
const KEYPAD_SIZE  = 1 / 6;    // 10 minutes (30 / 3 = 10)

/**
 * Convert a lat/lon to a CGRS killbox or keypad cell.
 * @param {number} lat
 * @param {number} lon
 * @param {'killbox'|'keypad'} precision
 * @returns {{ code: string, swLat: number, swLon: number, neLat: number, neLon: number }}
 */
export function latLonToCGRS(lat, lon, precision = 'killbox') {
  if (lat >= 90) lat = 89.9999999;

  // --- Killbox (30-min) ---
  const lonBandIdx = Math.floor((lon + 180) * 2);   // 0-based
  const latBandIdx = Math.floor((lat + 90)  * 2);   // 0-based

  // Lat: 2-digit number (floor((lat+90)*2) − 200)
  const latBandNum = latBandIdx - 200;
  // Lon: 2-letter code using standard A–Z alphabet, offset 340
  const combinedLon = lonBandIdx + 340;
  const lonBand = LETTERS[Math.floor(combinedLon / 26)] + LETTERS[combinedLon % 26];

  const bandSwLon = lonBandIdx * KILLBOX_SIZE - 180;
  const bandSwLat = latBandIdx * KILLBOX_SIZE - 90;

  if (precision === 'killbox') {
    return { code: String(latBandNum) + lonBand, swLat: bandSwLat, swLon: bandSwLon, neLat: bandSwLat + KILLBOX_SIZE, neLon: bandSwLon + KILLBOX_SIZE };
  }

  // --- Keypad (10-min, telephone layout: 1=NW, 9=SE) ---
  const lonFrac = (lon + 180) * 2 - lonBandIdx;  // [0,1)
  const latFrac = (lat + 90)  * 2 - latBandIdx;  // [0,1)

  const kCol = Math.floor(lonFrac * 3);           // 0=west, 1=center, 2=east
  const kRow = Math.floor(latFrac * 3);           // 0=south, 1=middle, 2=north
  const keypad = (2 - kRow) * 3 + kCol + 1;      // 1=NW … 9=SE

  const kSwLon = bandSwLon + kCol * KEYPAD_SIZE;
  const kSwLat = bandSwLat + kRow * KEYPAD_SIZE;

  return {
    code: String(latBandNum) + lonBand + keypad,
    swLat: kSwLat, swLon: kSwLon,
    neLat: kSwLat + KEYPAD_SIZE, neLon: kSwLon + KEYPAD_SIZE,
  };
}

/**
 * Iterate all CGRS cells that intersect the given bounds, clipped to Texas.
 * Uses integer indices to avoid floating-point boundary errors.
 *
 * @param {{ minLat, maxLat, minLon, maxLon }} bounds
 * @param {'killbox'|'keypad'} precision
 * @yields {{ code: string, swLat: number, swLon: number, neLat: number, neLon: number }}
 */
export function* iterateCGRSCells(bounds, precision) {
  const minLat = Math.max(bounds.minLat, TEXAS_BOUNDS.minLat);
  const maxLat = Math.min(bounds.maxLat, TEXAS_BOUNDS.maxLat);
  const minLon = Math.max(bounds.minLon, TEXAS_BOUNDS.minLon);
  const maxLon = Math.min(bounds.maxLon, TEXAS_BOUNDS.maxLon);

  if (minLat >= maxLat || minLon >= maxLon) return;

  // 30-min band index range
  const lonBandStart = Math.floor((minLon + 180) * 2);
  const lonBandEnd   = Math.ceil((maxLon + 180) * 2);
  const latBandStart = Math.floor((minLat + 90)  * 2);
  const latBandEnd   = Math.ceil((maxLat + 90)   * 2);

  for (let latB = latBandStart; latB < latBandEnd; latB++) {
    const bandSwLat  = latB * KILLBOX_SIZE - 90;
    const latBandNum = latB - 200;

    for (let lonB = lonBandStart; lonB < lonBandEnd; lonB++) {
      const combinedLon = lonB + 340;
      const lonBand     = LETTERS[Math.floor(combinedLon / 26)] + LETTERS[combinedLon % 26];
      const bandSwLon   = lonB * KILLBOX_SIZE - 180;

      if (precision === 'killbox') {
        yield {
          code: String(latBandNum) + lonBand,
          swLat: bandSwLat, swLon: bandSwLon,
          neLat: bandSwLat + KILLBOX_SIZE, neLon: bandSwLon + KILLBOX_SIZE,
        };
        continue;
      }

      // 10-min keypads: kRow 0=south→north, kCol 0=west→east
      // Telephone layout: keypad = (2 - kRow) * 3 + kCol + 1  →  1=NW, 9=SE
      for (let kRow = 0; kRow < 3; kRow++) {
        const kSwLat = bandSwLat + kRow * KEYPAD_SIZE;
        if (kSwLat >= maxLat || kSwLat + KEYPAD_SIZE <= minLat) continue;

        for (let kCol = 0; kCol < 3; kCol++) {
          const kSwLon = bandSwLon + kCol * KEYPAD_SIZE;
          if (kSwLon >= maxLon || kSwLon + KEYPAD_SIZE <= minLon) continue;

          const keypad = (2 - kRow) * 3 + kCol + 1;
          yield {
            code: String(latBandNum) + lonBand + keypad,
            swLat: kSwLat, swLon: kSwLon,
            neLat: kSwLat + KEYPAD_SIZE, neLon: kSwLon + KEYPAD_SIZE,
          };
        }
      }
    }
  }
}
