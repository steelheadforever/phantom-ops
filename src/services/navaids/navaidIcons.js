/**
 * Aviation navaid and IFR fix icons for Leaflet.
 * All icons use L.divIcon with inline SVG — same pattern as CGRSLayer labels.
 * Font: B612 Mono (matches rest of app).
 */

// ── SVG primitives ────────────────────────────────────────────────────────────

function hexagonSvg(color) {
  // Regular hexagon centered at 8,8 in a 16×16 viewBox
  return `<polygon points="8,1 14,4.5 14,11.5 8,15 2,11.5 2,4.5" fill="none" stroke="${color}" stroke-width="1.5"/>`;
}

function triangleSvg(color, filled = false) {
  const fill = filled ? color : 'none';
  return `<polygon points="8,2 15,14 1,14" fill="${fill}" stroke="${color}" stroke-width="1.5"/>`;
}

function circleSvg(color, dashed = false) {
  const dash = dashed ? 'stroke-dasharray="2,2"' : '';
  return `<circle cx="8" cy="8" r="6" fill="none" stroke="${color}" stroke-width="1.5" ${dash}/>`;
}

function dotSvg(color) {
  return `<circle cx="8" cy="8" r="2" fill="${color}"/>`;
}

function svgWrap(content) {
  return `<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">${content}</svg>`;
}

// ── Icon SVGs by navaid type ──────────────────────────────────────────────────

function vorSvg() {
  // Blue hexagon with center dot
  return svgWrap(hexagonSvg('#4488ff') + dotSvg('#4488ff'));
}

function vortacSvg() {
  // Blue hexagon + small teal triangle overlaid (VORTAC = VOR + TACAN)
  return svgWrap(hexagonSvg('#4488ff') + `<polygon points="8,5 12,12 4,12" fill="none" stroke="#44ddaa" stroke-width="1.2"/>`);
}

function tacanSvg() {
  // Teal triangle outline (military)
  return svgWrap(triangleSvg('#44ddaa', false));
}

function ndbSvg() {
  // Purple dashed circle
  return svgWrap(circleSvg('#cc88ff', true));
}

function genericNavaidSvg() {
  return svgWrap(circleSvg('#aaaaaa', false));
}

// ── Fix SVGs ──────────────────────────────────────────────────────────────────

function fixSvg(filled) {
  // Small equilateral triangle in light blue; filled = compulsory RPT, open = RNAV
  return `<svg width="10" height="10" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">${triangleSvg('#aaddff', filled)}</svg>`;
}

// ── Type detection ────────────────────────────────────────────────────────────

/**
 * Parse CLASS_TXT (e.g. "H-VORTACW", "L-TACAN", "L-VOR/DME") into a navaid type key.
 */
function detectNavaidType(classTxt) {
  const s = (classTxt ?? '').toUpperCase();
  if (s.includes('VORTAC')) return 'vortac';
  if (s.includes('VOR')) return 'vor';
  if (s.includes('TACAN')) return 'tacan';
  if (s.includes('NDB')) return 'ndb';
  return 'generic';
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Create a Leaflet divIcon for a navaid.
 * @param {string} classTxt - CLASS_TXT field value (e.g. "H-VORTACW")
 * @param {string} ident    - navaid identifier (e.g. "SAT")
 */
export function makeNavaidIcon(classTxt, ident) {
  const type = detectNavaidType(classTxt);

  const svgMap = {
    vor: vorSvg(),
    vortac: vortacSvg(),
    tacan: tacanSvg(),
    ndb: ndbSvg(),
    generic: genericNavaidSvg(),
  };

  const svg = svgMap[type];
  const label = `<span style="display:block;font:9px 'B612 Mono',monospace;color:#ccddff;white-space:nowrap;text-align:center;margin-top:1px;pointer-events:none">${ident}</span>`;

  return L.divIcon({
    html: `<div style="display:flex;flex-direction:column;align-items:center;pointer-events:none">${svg}${label}</div>`,
    className: '',
    iconSize: [32, 26],
    iconAnchor: [16, 8],
  });
}

/**
 * Create a Leaflet divIcon for an IFR fix/waypoint.
 * @param {string} typeCode - TYPE_CODE field value ("RPT" or "RNAV")
 * @param {string} ident    - fix identifier (e.g. "BOGSI")
 */
export function makeFixIcon(typeCode, ident) {
  const filled = (typeCode ?? '').toUpperCase() === 'RPT';
  const svg = fixSvg(filled);
  const label = `<span style="display:block;font:8px 'B612 Mono',monospace;color:#aaddff;white-space:nowrap;text-align:center;margin-top:1px;pointer-events:none">${ident}</span>`;

  return L.divIcon({
    html: `<div style="display:flex;flex-direction:column;align-items:center;pointer-events:none">${svg}${label}</div>`,
    className: '',
    iconSize: [40, 22],
    iconAnchor: [20, 5],
  });
}
