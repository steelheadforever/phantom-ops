import { LayerManager } from './LayerManager.js';
import { AirspaceSourceService, ArcGISAirspaceSource } from '../services/airspace/AirspaceSourceService.js';
import { ClassAirspaceSource } from '../services/airspace/ClassAirspaceSource.js';
import { AIRSPACE_STYLE_BY_KIND, mapAirspaceKind } from '../services/airspace/airspaceStyle.js';
import { BASE_LAYER_SOURCE_DEFINITIONS, createBaseTileLayer } from './baseLayerSources.js';
import { persistBaseLayerId, resolveInitialBaseLayerId } from './baseLayerPreferences.js';
import { resolveHealthyTileEndpoint } from '../services/runtimeSourceValidation.js';

const AVIATION_BASE_IDS = ['base-vfr-sectional', 'base-ifr-low', 'base-ifr-high'];

export const AIRSPACE_LAYER_DEFS = [
  { id: 'airspace-class-b', label: 'Class B', kind: 'classB' },
  { id: 'airspace-class-c', label: 'Class C', kind: 'classC' },
  { id: 'airspace-class-d', label: 'Class D', kind: 'classD' },
  { id: 'airspace-moa', label: 'MOAs', kind: 'moa' },
  { id: 'airspace-alert', label: 'Alert Areas', kind: 'alert' },
  { id: 'airspace-restricted', label: 'Restricted Areas', kind: 'restricted' },
];

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
    this.sourceDebugEl = null;

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
      zoomControl: true,
    });

    this.layerManager = new LayerManager(this.map).initializePanes();

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

    // Create 6 separate airspace layers
    for (const def of AIRSPACE_LAYER_DEFS) {
      const style = AIRSPACE_STYLE_BY_KIND[def.kind] ?? AIRSPACE_STYLE_BY_KIND.fallback;
      const layer = L.geoJSON(null, { style: () => style });
      const layerOptions = this.layerManager.registerLayer(def.id, layer, 'airspace');
      if (typeof layer.options === 'object') {
        Object.assign(layer.options, layerOptions);
      }
      this.airspaceLayers.set(def.id, layer);
      this.layerManager.setLayerVisibility(def.id, true);
    }

    this.baseLayers = baseLayerLabels;

    this.#ensureSourceDebugIndicator();
    this.validateOperationalSources().catch((error) => {
      console.warn('Operational source validation failed:', error);
    });

    return this.map;
  }

  async loadAirspaceData() {
    if (!this.airspaceSourceService) return;

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
  }

  async loadClassAirspaceData() {
    if (!this.classAirspaceSource) return;

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
      const { template } = await resolveHealthyTileEndpoint(definition.url, definition.fallbackUrls ?? []);
      const degraded = template !== definition.url;

      this.sourceStatusByLayerId.set(layerId, {
        configuredUrl: definition.url,
        activeUrl: template,
        degraded,
      });

      if (degraded && typeof layer.setUrl === 'function') {
        layer.setUrl(template);
      }
    }

    this.#updateSourceDebugIndicator();

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

  getOperationalSourceStatus() {
    const aviation = Object.fromEntries(
      AVIATION_BASE_IDS
        .map((id) => [id, this.sourceStatusByLayerId.get(id)])
        .filter(([, value]) => Boolean(value)),
    );

    const ifrLow = aviation['base-ifr-low'];
    const ifrHigh = aviation['base-ifr-high'];
    const ifrDistinctActiveSources = Boolean(ifrLow && ifrHigh && ifrLow.activeUrl !== ifrHigh.activeUrl);

    return {
      aviation,
      ifrDistinctActiveSources,
      degraded: Object.values(aviation).some((entry) => entry?.degraded),
    };
  }

  setAirspaceVisibility(visible) {
    if (!this.layerManager) return;
    for (const def of AIRSPACE_LAYER_DEFS) {
      this.layerManager.setLayerVisibility(def.id, visible);
    }
  }

  #registerBaseLayer(layerId, layer) {
    const options = this.layerManager.registerLayer(layerId, layer, 'base');
    if (typeof layer.options === 'object') {
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

  #ensureSourceDebugIndicator() {
    if (typeof document === 'undefined') return;

    let el = document.getElementById('source-debug-indicator');
    if (!el) {
      el = document.createElement('div');
      el.id = 'source-debug-indicator';
      el.className = 'source-debug-indicator';
      document.body.appendChild(el);
    }

    this.sourceDebugEl = el;
    this.#updateSourceDebugIndicator();
  }

  #updateSourceDebugIndicator() {
    if (!this.sourceDebugEl) return;

    const low = this.sourceStatusByLayerId.get('base-ifr-low');
    const high = this.sourceStatusByLayerId.get('base-ifr-high');
    const mode = low && high && low.activeUrl === high.activeUrl ? 'DEGRADED' : 'OK';

    const summarize = (entry) => {
      if (!entry) return 'n/a';
      return entry.degraded ? 'fallback' : 'primary';
    };

    this.sourceDebugEl.textContent = `Sources ${mode} | VFR:${summarize(this.sourceStatusByLayerId.get('base-vfr-sectional'))} IFR-L:${summarize(low)} IFR-H:${summarize(high)}`;
  }
}
