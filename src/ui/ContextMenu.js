/**
 * ContextMenu — right-click popup on the chart.
 *
 * Shows all three coordinate formats (copy-on-click) and lists any
 * airspace polygons that contain the clicked point. Hovering an
 * airspace row reveals its altitude limits in a side tooltip.
 *
 * Suppressed while MeasureTool is active.
 */
export class ContextMenu {
  constructor({ map, coordinateService, airspaceLayers, measureTool, pointLayers = [], layerManager = null }) {
    this._map = map;
    this._coordinateService = coordinateService;
    this._airspaceLayers = airspaceLayers; // Map<id, L.geoJSON> — live reference
    this._measureTool = measureTool;
    this._pointLayers = pointLayers;       // [{ layerId, layer }]
    this._layerManager = layerManager;

    this._el = null;
    this._tipEl = null;

    this._onDocClick = this._onDocClick.bind(this);
    this._onKeyDown  = this._onKeyDown.bind(this);

    this._mount();

    map.on('contextmenu', (e) => {
      e.originalEvent.preventDefault();
      if (this._measureTool?.isActive()) return;
      this._show(e.latlng, e.originalEvent);
    });
  }

  // ─── private ────────────────────────────────────────────────────────────

  _mount() {
    const el = document.createElement('div');
    el.className = 'chart-ctx-menu';
    document.body.appendChild(el);
    this._el = el;

    const tip = document.createElement('div');
    tip.className = 'ccm-alt-tip';
    document.body.appendChild(tip);
    this._tipEl = tip;
  }

  _show(latlng, nativeEvent) {
    const { lat, lng } = latlng;

    // ── Coordinates ──────────────────────────────────────────────────────
    const rows = ['MGRS', 'DMS', 'DMM'].map((fmt) => {
      const value = this._coordinateService.formatCoordinate(lat, lng, fmt);
      const row = document.createElement('div');
      row.className = 'ccm-coord-row';

      const fmtEl = document.createElement('span');
      fmtEl.className = 'ccm-format';
      fmtEl.textContent = fmt;

      const valEl = document.createElement('span');
      valEl.className = 'ccm-value';
      valEl.textContent = value;

      const copiedEl = document.createElement('span');
      copiedEl.className = 'ccm-copied';
      copiedEl.textContent = 'Copied';
      copiedEl.setAttribute('aria-hidden', 'true');

      row.appendChild(fmtEl);
      row.appendChild(valEl);
      row.appendChild(copiedEl);

      row.addEventListener('click', () => {
        const text = `${fmt}: ${value}`;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).catch(() => {});
        } else {
          // Fallback for non-HTTPS
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        copiedEl.classList.add('ccm-copied--visible');
        setTimeout(() => copiedEl.classList.remove('ccm-copied--visible'), 1300);
      });

      return row;
    });

    // ── Airspaces ─────────────────────────────────────────────────────────
    const airspaces = this._getAirspacesAt(lat, lng);
    const airspaceRows = airspaces.map((a) => {
      const row = document.createElement('div');
      row.className = 'ccm-airspace-row';

      const nameEl = document.createElement('span');
      nameEl.className = 'ccm-airspace-name';
      nameEl.textContent = a.name;
      row.appendChild(nameEl);

      if (a.altitude) {
        row.addEventListener('mouseenter', () => this._showTip(a.altitude, row));
        row.addEventListener('mouseleave', () => this._hideTip());
        row.classList.add('ccm-airspace-row--has-alt');
      }

      return row;
    });

    // ── Assemble ─────────────────────────────────────────────────────────
    this._el.innerHTML = '';

    const coordSection = document.createElement('div');
    coordSection.className = 'ccm-section';
    rows.forEach((r) => coordSection.appendChild(r));
    this._el.appendChild(coordSection);

    if (airspaceRows.length) {
      const divider = document.createElement('div');
      divider.className = 'ccm-divider';
      this._el.appendChild(divider);

      const airSection = document.createElement('div');
      airSection.className = 'ccm-section';
      airspaceRows.forEach((r) => airSection.appendChild(r));
      this._el.appendChild(airSection);
    }

    // ── Nearby points ─────────────────────────────────────────────────────
    const nearbyPoints = this._getNearbyPoints(lat, lng);
    if (nearbyPoints.length) {
      const divider = document.createElement('div');
      divider.className = 'ccm-divider';
      this._el.appendChild(divider);

      const ptSection = document.createElement('div');
      ptSection.className = 'ccm-section';
      nearbyPoints.forEach((pt) => ptSection.appendChild(this._makePointRow(pt)));
      this._el.appendChild(ptSection);
    }

    // ── Position + show ───────────────────────────────────────────────────
    this._position(nativeEvent);
    this._el.classList.add('chart-ctx-menu--open');

    document.addEventListener('mousedown', this._onDocClick);
    document.addEventListener('keydown',   this._onKeyDown);
  }

  _hide() {
    this._el.classList.remove('chart-ctx-menu--open');
    this._hideTip();
    document.removeEventListener('mousedown', this._onDocClick);
    document.removeEventListener('keydown',   this._onKeyDown);
  }

  _position(e) {
    const el = this._el;
    // Off-screen while open class is being applied so we can measure
    el.style.left = '-9999px';
    el.style.top  = '-9999px';
    el.classList.add('chart-ctx-menu--open');

    const W = window.innerWidth;
    const H = window.innerHeight;
    const w = el.offsetWidth;
    const h = el.offsetHeight;

    let x = e.clientX + 6;
    let y = e.clientY + 6;
    if (x + w > W - 8) x = e.clientX - w - 6;
    if (y + h > H - 8) y = e.clientY - h - 6;

    el.style.left = `${Math.max(4, x)}px`;
    el.style.top  = `${Math.max(4, y)}px`;
  }

  _showTip(text, anchorEl) {
    const tip = this._tipEl;
    tip.textContent = text;
    tip.classList.add('ccm-alt-tip--visible');

    const aRect = anchorEl.getBoundingClientRect();
    const mRect = this._el.getBoundingClientRect();

    // Estimate tip width for positioning
    const tipW = tip.offsetWidth || 180;
    const showLeft = mRect.right + tipW + 12 > window.innerWidth;

    tip.style.top = `${aRect.top + aRect.height / 2}px`;
    if (showLeft) {
      tip.style.left  = '';
      tip.style.right = `${window.innerWidth - mRect.left + 6}px`;
    } else {
      tip.style.right = '';
      tip.style.left  = `${mRect.right + 6}px`;
    }
  }

  _hideTip() {
    this._tipEl.classList.remove('ccm-alt-tip--visible');
  }

  _onDocClick(e) {
    if (!this._el.contains(e.target)) this._hide();
  }

  _onKeyDown(e) {
    if (e.key === 'Escape') this._hide();
  }

  // ─── point-in-polygon ───────────────────────────────────────────────────

  _getAirspacesAt(lat, lng) {
    const results = [];
    if (!this._airspaceLayers) return results;

    for (const geoJsonLayer of this._airspaceLayers.values()) {
      geoJsonLayer.eachLayer((featureLayer) => {
        const feature = featureLayer.feature;
        if (feature && this._pointInFeature(lat, lng, feature)) {
          const props = feature.properties ?? {};
          results.push({
            name:     this._extractName(props),
            altitude: this._extractAltitude(props),
          });
        }
      });
    }

    return results;
  }

  _pointInFeature(lat, lng, feature) {
    const geom = feature.geometry;
    if (!geom) return false;
    if (geom.type === 'Polygon') {
      return this._pointInRing(lat, lng, geom.coordinates[0]);
    }
    if (geom.type === 'MultiPolygon') {
      return geom.coordinates.some((poly) => this._pointInRing(lat, lng, poly[0]));
    }
    return false;
  }

  // Ray-casting algorithm (GeoJSON ring coords are [lng, lat])
  _pointInRing(lat, lng, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1];
      const xj = ring[j][0], yj = ring[j][1];
      if (((yi > lat) !== (yj > lat)) &&
          (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  // ─── property extraction ────────────────────────────────────────────────

  _extractName(props) {
    return String(
      props.NAME      ?? props.name      ??
      props.IDENT     ?? props.ident     ??
      props.NAME_FAA  ?? props.name_faa  ??
      '(unnamed)'
    ).trim();
  }

  _extractAltitude(props) {
    // ArcGIS SUA style
    const lower     = props.LOWER_VAL  ?? props.lower_val  ?? props.floor   ?? null;
    const upper     = props.UPPER_VAL  ?? props.upper_val  ?? props.ceiling ?? null;
    const lowerCode = String(props.LOWER_CODE ?? props.lower_code ?? 'MSL').trim().toUpperCase();
    const upperCode = String(props.UPPER_CODE ?? props.upper_code ?? 'MSL').trim().toUpperCase();

    if (lower === null && upper === null) return null;

    const fmt = (val, code) => {
      const n = Number(val);
      if (n === 0 && code === 'AGL') return 'SFC';
      return `${n.toLocaleString()} ft ${code}`;
    };

    if (lower !== null && upper !== null) return `${fmt(lower, lowerCode)} – ${fmt(upper, upperCode)}`;
    if (lower !== null) return `from ${fmt(lower, lowerCode)}`;
    return `to ${fmt(upper, upperCode)}`;
  }

  // ─── nearby points ───────────────────────────────────────────────────────

  _getNearbyPoints(lat, lng) {
    const RADIUS_M = 370.4; // 0.2 NM in metres
    const results = [];

    for (const { layerId, layer } of this._pointLayers) {
      const entry = this._layerManager?.layers.get(layerId);
      if (!entry?.visible) continue;

      const features = layer._features;
      if (!features) continue;

      for (const f of features) {
        const [fLon, fLat] = f.geometry.coordinates;
        const distM = L.latLng(lat, lng).distanceTo([fLat, fLon]);
        if (distM > RADIUS_M) continue;

        const props = f.properties ?? {};
        results.push({
          ident:  props.IDENT || props.IDENT_TXT || '?',
          type:   this._pointType(props),
          lat:    fLat,
          lon:    fLon,
          distNm: distM / 1852,
        });
      }
    }

    results.sort((a, b) => a.distNm - b.distNm);
    return results.slice(0, 8); // cap to keep the menu compact
  }

  _pointType(props) {
    if (props.CLASS_TXT) {
      const s = props.CLASS_TXT.toUpperCase();
      if (s.includes('VORTAC')) return 'VORTAC';
      if (s.includes('VOR'))    return 'VOR';
      if (s.includes('TACAN'))  return 'TACAN';
      if (s.includes('NDB'))    return 'NDB';
      return 'NAVAID';
    }
    if (props.TYPE_CODE) {
      return props.TYPE_CODE === 'RPT' ? 'RPT Fix' : 'RNAV Fix';
    }
    return 'Point';
  }

  _makePointRow(pt) {
    const row = document.createElement('div');
    row.className = 'ccm-point-row';

    const identEl = document.createElement('span');
    identEl.className = 'ccm-point-ident';
    identEl.textContent = pt.ident;

    const typeEl = document.createElement('span');
    typeEl.className = 'ccm-point-type';
    typeEl.textContent = pt.type;

    const distEl = document.createElement('span');
    distEl.className = 'ccm-point-dist';
    distEl.textContent = `${pt.distNm.toFixed(2)} NM`;

    const copiedEl = document.createElement('span');
    copiedEl.className = 'ccm-copied';
    copiedEl.textContent = 'Copied';
    copiedEl.setAttribute('aria-hidden', 'true');

    row.appendChild(identEl);
    row.appendChild(typeEl);
    row.appendChild(distEl);
    row.appendChild(copiedEl);

    // Hover: show point's coords in the current chart format via side tooltip
    row.addEventListener('mouseenter', () => {
      const fmt = this._coordinateService.getCurrentFormat();
      const coord = this._coordinateService.formatCoordinate(pt.lat, pt.lon, fmt);
      this._showTip(`${fmt}: ${coord}`, row);
    });
    row.addEventListener('mouseleave', () => this._hideTip());

    // Click: copy point's coords in current format to clipboard
    row.addEventListener('click', () => {
      const fmt = this._coordinateService.getCurrentFormat();
      const coord = this._coordinateService.formatCoordinate(pt.lat, pt.lon, fmt);
      const text = `${fmt}: ${coord}`;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).catch(() => {});
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      copiedEl.classList.add('ccm-copied--visible');
      setTimeout(() => copiedEl.classList.remove('ccm-copied--visible'), 1300);
    });

    return row;
  }
}
