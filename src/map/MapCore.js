import { LayerManager } from './LayerManager.js';
import { AirspaceSourceService, ArcGISAirspaceSource } from '../services/airspace/AirspaceSourceService.js';
import { ClassAirspaceSource } from '../services/airspace/ClassAirspaceSource.js';
import { AIRSPACE_STYLE_BY_KIND, mapAirspaceKind } from '../services/airspace/airspaceStyle.js';
import { BASE_LAYER_SOURCE_DEFINITIONS, createBaseTileLayer } from './baseLayerSources.js';
import { persistBaseLayerId, resolveInitialBaseLayerId } from './baseLayerPreferences.js';
import { resolveHealthyTileEndpoint } from '../services/runtimeSourceValidation.js';
import { PANE_IDS } from './layerZIndex.js';
import { CGRSLayer } from '../services/cgrs/CGRSLayer.js';
import { getSymbolSvg } from '../services/drawing/pointSymbols.js';
import { NavaidLayer } from '../services/navaids/NavaidLayer.js';
import { FixLayer } from '../services/navaids/FixLayer.js';
import { AirfieldLayer } from '../services/airfields/AirfieldLayer.js';

const AVIATION_BASE_IDS = ['base-vfr-sectional', 'base-ifr-low', 'base-ifr-high'];

export const CGRS_LAYER_DEF = Object.freeze({ id: 'cgrs-grid', label: 'Kill Box' });
export const NAVAID_LAYER_DEF = Object.freeze({ id: 'navaids', label: 'Navaids' });
export const FIX_HIGH_LAYER_DEF = Object.freeze({ id: 'ifr-fixes-high', label: 'IFR High Fixes' });
export const FIX_LOW_LAYER_DEF = Object.freeze({ id: 'ifr-fixes-low', label: 'IFR Low Fixes' });
export const AIRFIELD_LAYER_DEF = Object.freeze({ id: 'airfields', label: 'Airfields' });

export const AIRSPACE_LAYER_DEFS = [
  { id: 'airspace-class-b', label: 'Class B', kind: 'classB' },
  { id: 'airspace-class-c', label: 'Class C', kind: 'classC' },
  { id: 'airspace-class-d', label: 'Class D', kind: 'classD' },
  { id: 'airspace-moa', label: 'MOAs', kind: 'moa' },
  { id: 'airspace-alert', label: 'Alert Areas', kind: 'alert' },
  { id: 'airspace-restricted', label: 'Restricted Areas', kind: 'restricted' },
];

export const SIMULATED_LAYER_DEF = Object.freeze({ id: 'airspace-simulated', label: 'Simulated Airspace' });

export class MapCore {
  constructor({
    airspaceEndpoint,
    airspaceSource,
    airspaceSourceService,
    classAirspaceSource,
    baseLayerDefinitions = BASE_LAYER_SOURCE_DEFINITIONS,
    storage = globalThis?.localStorage ?? null,
  } = {}) {
    this.map = null;
    this.layerManager = null;
    this.baseLayers = null;
    this.airspaceLayers = new Map();
    this.baseLayerDefinitions = baseLayerDefinitions;
    this.storage = storage;
    this.baseLayerById = new Map();
    this.sourceStatusByLayerId = new Map();
    this._airspaceLoadStatus = new Map();
    this._statusListeners = [];

    this.airspaceSource = airspaceSource ?? new ArcGISAirspaceSource({
      endpoint: airspaceEndpoint,
      fallbackEndpoints: [],
    });
    this.airspaceSourceService = airspaceSourceService ?? new AirspaceSourceService(this.airspaceSource);
    this.classAirspaceSource = classAirspaceSource ?? new ClassAirspaceSource();
  }

  init() {
    this.map = L.map('map', {
      center: [29.535, -98.279],
      zoom: 12,
      zoomControl: false,
    });
    L.control.zoom({ position: 'topright' }).addTo(this.map);

    this.layerManager = new LayerManager(this.map).initializePanes();

    // CGRS killbox grid — below all airspace/nav layers (z-index 300)
    this.cgrsLayer = new CGRSLayer(this.map, { pane: PANE_IDS.GARS });
    this.layerManager.registerLayer(CGRS_LAYER_DEF.id, this.cgrsLayer.group, 'gars');
    this.layerManager.setLayerVisibility(CGRS_LAYER_DEF.id, true);

    // Nav point layers — each gets its own pane for precise z-ordering
    this.navaidLayer = new NavaidLayer(this.map, { pane: PANE_IDS.NAVAIDS });
    this.layerManager.registerLayer(NAVAID_LAYER_DEF.id, this.navaidLayer.group, 'navaids');
    this.layerManager.setLayerVisibility(NAVAID_LAYER_DEF.id, true);

    this.fixHighLayer = new FixLayer(this.map, 'H', { pane: PANE_IDS.IFR_HIGH });
    this.layerManager.registerLayer(FIX_HIGH_LAYER_DEF.id, this.fixHighLayer.group, 'ifr-high');
    this.layerManager.setLayerVisibility(FIX_HIGH_LAYER_DEF.id, true);

    this.fixLowLayer = new FixLayer(this.map, 'L', { pane: PANE_IDS.IFR_LOW });
    this.layerManager.registerLayer(FIX_LOW_LAYER_DEF.id, this.fixLowLayer.group, 'ifr-low');
    this.layerManager.setLayerVisibility(FIX_LOW_LAYER_DEF.id, false);

    this.airfieldLayer = new AirfieldLayer(this.map, { pane: PANE_IDS.AIRFIELDS });
    this.layerManager.registerLayer(AIRFIELD_LAYER_DEF.id, this.airfieldLayer.group, 'airfields');
    this.layerManager.setLayerVisibility(AIRFIELD_LAYER_DEF.id, false);

    const baseLayerLabels = {};

    this.baseLayerDefinitions.forEach((definition) => {
      const layer = createBaseTileLayer(definition);
      this.#registerBaseLayer(definition.id, layer);
      this.baseLayerById.set(definition.id, { definition, layer });
      baseLayerLabels[definition.label] = layer;
      this.sourceStatusByLayerId.set(definition.id, {
        configuredUrl: definition.url,
        activeUrl: definition.url,
        degraded: false,
      });
    });

    const initialBaseLayerId = resolveInitialBaseLayerId({
      definitions: this.baseLayerDefinitions,
      storage: this.storage,
    });

    if (initialBaseLayerId) {
      this.layerManager.showLayer(initialBaseLayerId);
      persistBaseLayerId(this.storage, initialBaseLayerId);
    }

    // Airspace kind → LayerManager kind (each gets its own pane for z-ordering)
    const AIRSPACE_KIND_TO_LAYER_KIND = {
      classB: 'airspace-class-b',
      classC: 'airspace-class-c',
      classD: 'airspace-class-d',
      moa: 'airspace-moa',
      alert: 'airspace-alert',
      restricted: 'airspace-restricted',
    };

    for (const def of AIRSPACE_LAYER_DEFS) {
      const style = AIRSPACE_STYLE_BY_KIND[def.kind] ?? AIRSPACE_STYLE_BY_KIND.fallback;
      const layer = L.geoJSON(null, { style: () => style });
      const layerKind = AIRSPACE_KIND_TO_LAYER_KIND[def.kind] ?? 'airspace-restricted';
      const layerOptions = this.layerManager.registerLayer(def.id, layer, layerKind);
      if (typeof layer.options === 'object') {
        Object.assign(layer.options, layerOptions);
      }
      this.airspaceLayers.set(def.id, layer);
      this.layerManager.setLayerVisibility(def.id, true);
    }

    // Simulated airspace — per-feature styling matching the drawing tool theme
    const simLayer = L.geoJSON(null, {
      style: (feature) => {
        const p = feature.properties || {};
        return {
          color: p.color || '#a0a0a0',
          fillColor: p.color || '#a0a0a0',
          fillOpacity: typeof p.fillOpacity === 'number' ? p.fillOpacity : 0.26,
          opacity: 0.95,
          weight: p.weight || 1.5,
        };
      },
      pointToLayer: (feature, latlng) => {
        const p = feature.properties || {};
        if (p.featureType === 'circle') {
          return L.circle(latlng, {
            radius: p.radiusNm * 1852,
            color: p.color || '#a0a0a0',
            fillColor: p.color || '#a0a0a0',
            fillOpacity: typeof p.fillOpacity === 'number' ? p.fillOpacity : 0.26,
            weight: p.weight || 1.5,
            pane: PANE_IDS.AIRSPACE_SIMULATED,
          });
        }
        // waypoint — match ShapeManager icon style
        const svg = getSymbolSvg(p.symbol || 'waypoint', p.color || '#4da6ff', p.opacity ?? 0.5, 20);
        return L.marker(latlng, {
          icon: L.divIcon({
            className: 'point-symbol-icon',
            html: svg,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          }),
          pane: PANE_IDS.AIRSPACE_SIMULATED,
        });
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties || {};
        if (p.featureType === 'waypoint' && p.showLabel && p.name) {
          layer.bindTooltip(p.name, {
            permanent: true,
            direction: 'right',
            className: 'point-name-label',
            offset: [4, 0],
          });
        }
      },
    });
    const simLayerOptions = this.layerManager.registerLayer(SIMULATED_LAYER_DEF.id, simLayer, 'airspace-simulated');
    if (typeof simLayer.options === 'object') {
      Object.assign(simLayer.options, simLayerOptions);
    }
    this.airspaceLayers.set(SIMULATED_LAYER_DEF.id, simLayer);
    this.layerManager.setLayerVisibility(SIMULATED_LAYER_DEF.id, true);

    this.baseLayers = baseLayerLabels;

    this.validateOperationalSources().catch((error) => {
      console.warn('Operational source validation failed:', error);
    });

    return this.map;
  }

  async loadAirspaceData() {
    if (!this.airspaceSourceService) return;

    try {
      const featureCollection = await this.airspaceSourceService.loadAirspaceFeatureCollection();

      // Distribute SUA features into per-type layers
      for (const feature of featureCollection.features) {
        const kind = mapAirspaceKind(feature.properties ?? {});
        const layerId = this.#kindToLayerId(kind);
        const layer = this.airspaceLayers.get(layerId);
        if (layer) {
          layer.addData(feature);
        }
      }

      this._airspaceLoadStatus.set('sua', { label: 'SUA Airspace', ok: true });
    } catch (err) {
      this._airspaceLoadStatus.set('sua', { label: 'SUA Airspace', ok: false });
      throw err;
    } finally {
      this._notifyStatusListeners();
    }
  }

  async loadClassAirspaceData() {
    if (!this.classAirspaceSource) return;

    try {
      const { classB, classC, classD } = await this.classAirspaceSource.fetchAllClasses();

      const classLayerMap = {
        'airspace-class-b': classB,
        'airspace-class-c': classC,
        'airspace-class-d': classD,
      };

      for (const [layerId, fc] of Object.entries(classLayerMap)) {
        const layer = this.airspaceLayers.get(layerId);
        if (layer && fc.features.length > 0) {
          layer.addData(fc);
        }
      }

      this._airspaceLoadStatus.set('class-bcd', { label: 'Class B/C/D', ok: true });
    } catch (err) {
      this._airspaceLoadStatus.set('class-bcd', { label: 'Class B/C/D', ok: false });
      throw err;
    } finally {
      this._notifyStatusListeners();
    }
  }

  async loadSimulatedAirspaceData() {
    try {
      const response = await fetch('/data/airspace/simulated/simulated.geojson');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const fc = await response.json();
      const layer = this.airspaceLayers.get(SIMULATED_LAYER_DEF.id);
      if (layer && fc.features?.length > 0) {
        layer.addData(fc);
      }
      this._airspaceLoadStatus.set('simulated', { label: 'Simulated', ok: true });
    } catch (err) {
      this._airspaceLoadStatus.set('simulated', { label: 'Simulated', ok: false });
      throw err;
    } finally {
      this._notifyStatusListeners();
    }
  }

  #kindToLayerId(kind) {
    switch (kind) {
      case 'classB': return 'airspace-class-b';
      case 'classC': return 'airspace-class-c';
      case 'classD': return 'airspace-class-d';
      case 'moa': return 'airspace-moa';
      case 'alert': return 'airspace-alert';
      case 'restricted': return 'airspace-restricted';
      default: return 'airspace-restricted'; // fallback features go to restricted
    }
  }

  switchBaseLayer(layerId) {
    this.layerManager.showLayer(layerId);
    persistBaseLayerId(this.storage, layerId);
  }

  async validateOperationalSources() {
    for (const layerId of AVIATION_BASE_IDS) {
      const entry = this.baseLayerById.get(layerId);
      if (!entry) continue;

      const { definition, layer } = entry;
      const { template, evidence } = await resolveHealthyTileEndpoint(definition.url, definition.fallbackUrls ?? []);
      const degraded = template !== definition.url;
      const reachable = evidence.some((e) => e.ok);

      this.sourceStatusByLayerId.set(layerId, {
        configuredUrl: definition.url,
        activeUrl: template,
        degraded,
        reachable,
      });

      if (degraded && typeof layer.setUrl === 'function') {
        layer.setUrl(template);
      }
    }

    this._notifyStatusListeners();

    const ifrLow = this.sourceStatusByLayerId.get('base-ifr-low');
    const ifrHigh = this.sourceStatusByLayerId.get('base-ifr-high');
    if (ifrLow && ifrHigh && ifrLow.activeUrl === ifrHigh.activeUrl) {
      console.warn('IFR degraded mode: IFR Low and IFR High currently resolve to same active source URL.', {
        ifrLow,
        ifrHigh,
      });
    }

    if (this.airspaceSource && typeof this.airspaceSource.resolveEndpoint === 'function') {
      await this.airspaceSource.resolveEndpoint();
    }
  }

  /** Register a callback invoked whenever source status changes. */
  onStatusUpdate(cb) {
    this._statusListeners.push(cb);
  }

  /**
   * Returns { level: 'ok'|'lim'|'bad', degradedLines: string[] }
   * ok  — all sources on primary, everything loaded
   * lim — at least one source degraded (fallback) or failed
   * bad — nothing is reachable at all
   */
  getSourceStatus() {
    const LAYER_LABELS = {
      'base-vfr-sectional': 'VFR Sectional',
      'base-ifr-low': 'IFR Low',
      'base-ifr-high': 'IFR High',
    };

    const entries = [];

    for (const id of AVIATION_BASE_IDS) {
      const s = this.sourceStatusByLayerId.get(id);
      if (!s) continue;
      entries.push({
        label: LAYER_LABELS[id] || id,
        reachable: s.reachable !== false,
        degraded: s.degraded,
      });
    }

    for (const s of this._airspaceLoadStatus.values()) {
      entries.push({ label: s.label, reachable: s.ok, degraded: !s.ok });
    }

    if (entries.length === 0) return { level: 'ok', degradedLines: [] };

    const allUnreachable = entries.every((e) => !e.reachable);
    const anyIssue = entries.some((e) => !e.reachable || e.degraded);
    const level = allUnreachable ? 'bad' : anyIssue ? 'lim' : 'ok';

    const degradedLines = entries
      .filter((e) => !e.reachable || e.degraded)
      .map((e) => `${e.label}: ${e.reachable ? 'fallback' : 'offline'}`);

    return { level, degradedLines };
  }

  setAirspaceVisibility(visible) {
    if (!this.layerManager) return;
    for (const def of AIRSPACE_LAYER_DEFS) {
      this.layerManager.setLayerVisibility(def.id, visible);
    }
  }

  #registerBaseLayer(layerId, layer) {
    const options = this.layerManager.registerLayer(layerId, layer, 'base');
    if (typeof layer.eachLayer === 'function') {
      // Composite layer group — propagate pane to each sublayer
      layer.eachLayer((sublayer) => {
        if (typeof sublayer.options === 'object') {
          Object.assign(sublayer.options, options);
        }
      });
    } else if (typeof layer.options === 'object') {
      Object.assign(layer.options, options);
    }
  }

  #syncBaseLayer(activeLayer) {
    let activeLayerId = null;

    for (const [layerId, entry] of this.layerManager.layers.entries()) {
      if (entry.kind !== 'base') continue;
      const isActive = entry.layer === activeLayer;
      this.layerManager.setLayerVisibility(layerId, isActive);
      if (isActive) {
        activeLayerId = layerId;
      }
    }

    persistBaseLayerId(this.storage, activeLayerId);
  }

  _notifyStatusListeners() {
    const status = this.getSourceStatus();
    for (const cb of this._statusListeners) cb(status);
  }
}
