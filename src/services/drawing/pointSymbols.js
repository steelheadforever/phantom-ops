/**
 * Aviation point symbols — SVG factory for map markers and table icons.
 *
 * All symbols render at a specified size in a given color/opacity.
 */

export const POINT_SYMBOLS = [
  { value: 'waypoint',    label: 'Waypoint' },
  { value: 'fix',         label: 'Fix' },
  { value: 'checkpoint',  label: 'Checkpoint' },
  { value: 'ip',          label: 'Initial Point' },
  { value: 'target',      label: 'Target' },
  { value: 'dot',         label: 'Position' },
];

/**
 * Return an SVG string for a point symbol.
 * @param {string} symbol  one of POINT_SYMBOLS[].value
 * @param {string} color   hex color
 * @param {number} opacity 0–1
 * @param {number} size    pixel dimensions (square)
 */
export function getSymbolSvg(symbol, color, opacity, size = 20) {
  const s = size;
  const stroke = `stroke="${color}" stroke-opacity="${opacity}" stroke-width="1.5"`;
  const fill   = `fill="${color}" fill-opacity="${opacity}"`;
  const noFill = `fill="none"`;

  switch (symbol) {
    case 'waypoint':
      // Solid upward triangle
      return `<svg width="${s}" height="${s}" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <polygon points="10,2 18,17 2,17" ${fill} ${stroke}/>
      </svg>`;

    case 'fix':
      // Open circle with centre dot (IFR fix style)
      return `<svg width="${s}" height="${s}" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <circle cx="10" cy="10" r="7" ${noFill} ${stroke}/>
        <circle cx="10" cy="10" r="2" ${fill} stroke="none"/>
      </svg>`;

    case 'checkpoint':
      // Solid diamond
      return `<svg width="${s}" height="${s}" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <polygon points="10,2 18,10 10,18 2,10" ${fill} ${stroke}/>
      </svg>`;

    case 'ip':
      // Circle with four cardinal tick marks (Initial Point)
      return `<svg width="${s}" height="${s}" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <circle cx="10" cy="10" r="5.5" ${noFill} ${stroke}/>
        <line x1="10" y1="1"  x2="10" y2="4"  stroke="${color}" stroke-opacity="${opacity}" stroke-width="1.5"/>
        <line x1="10" y1="16" x2="10" y2="19" stroke="${color}" stroke-opacity="${opacity}" stroke-width="1.5"/>
        <line x1="1"  y1="10" x2="4"  y2="10" stroke="${color}" stroke-opacity="${opacity}" stroke-width="1.5"/>
        <line x1="16" y1="10" x2="19" y2="10" stroke="${color}" stroke-opacity="${opacity}" stroke-width="1.5"/>
      </svg>`;

    case 'target':
      // Bullseye — two rings + centre dot
      return `<svg width="${s}" height="${s}" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <circle cx="10" cy="10" r="8" ${noFill} ${stroke}/>
        <circle cx="10" cy="10" r="4" ${noFill} ${stroke}/>
        <circle cx="10" cy="10" r="1.5" ${fill} stroke="none"/>
      </svg>`;

    case 'dot':
    default:
      // Simple filled circle
      return `<svg width="${s}" height="${s}" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <circle cx="10" cy="10" r="5" ${fill} ${stroke}/>
      </svg>`;
  }
}
