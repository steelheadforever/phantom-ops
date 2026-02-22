import { LayerManager } from './LayerManager.js';
import { wireDimmerControl } from '../ui/dimmerControl.js';
import { AirspaceSourceService, ArcGISAirspaceSource } from '../services/airspace/AirspaceSourceService.js';
import { getAirspaceStyle } from '../services/airspace/airspaceStyle.js';
import { BASE_LAYER_SOURCE_DEFINITIONS, createBaseTileLayer } from './baseLayerSources.js';
import { persistBaseLayerId, resolveInitialBaseLayerId } from './baseLayerPreferences.js';
import { resolveHealthyTileEndpoint } from '../services/runtimeSourceValidation.js';

const AVIATION_BASE_IDS = ['base-vfr-sectional', 'base-ifr-low', 'base-ifr-high'];

export class MapCore {
  constructor({
    airspaceEndpoint,
    airspaceSource,
    airspaceSourceService,
    baseLayerDefinitions = BASE_LAYER_SOURCE_DEFINITIONS,
    storage = globalThis?.localStorage ?? null,
  } = {}) {
    this.map = null;
    this.layerManager = null;
    this.baseLayers = null;
    this.airspaceLayer = null;
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
  }

  init() {
    this.map = L.map('map', {
      center: [39.0, -98.0],
      zoom: 5,
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

    this.airspaceLayer = L.geoJSON(null, {
      style: getAirspaceStyle,
    });
    const airspaceOptions = this.layerManager.registerLayer('airspace-arcgis', this.airspaceLayer, 'airspace');
    if (typeof this.airspaceLayer.options === 'object') {
      Object.assign(this.airspaceLayer.options, airspaceOptions);
    }

    this.baseLayers = baseLayerLabels;

    this.layerManager.setLayerVisibility('airspace-arcgis', true);

    const overlays = {
      'Airspace (ArcGIS)': this.airspaceLayer,
    };

    L.control.layers(this.baseLayers, overlays, { position: 'topright' }).addTo(this.map);

    this.map.on('baselayerchange', (event) => this.#syncBaseLayer(event.layer));
    this.map.on('overlayadd', (event) => {
      if (event.layer === this.airspaceLayer) {
        this.layerManager.setLayerVisibility('airspace-arcgis', true);
      }
    });
    this.map.on('overlayremove', (event) => {
      if (event.layer === this.airspaceLayer) {
        this.layerManager.setLayerVisibility('airspace-arcgis', false);
      }
    });

    this.#ensureSourceDebugIndicator();
    this.validateOperationalSources().catch((error) => {
      console.warn('Operational source validation failed:', error);
    });

    return this.map;
  }

  async loadAirspaceData() {
    if (!this.airspaceLayer || !this.airspaceSourceService) return;

    const featureCollection = await this.airspaceSourceService.loadAirspaceFeatureCollection();
    this.airspaceLayer.clearLayers();
    this.airspaceLayer.addData(featureCollection);
    if (typeof this.airspaceLayer.bringToFront === 'function') {
      this.airspaceLayer.bringToFront();
    }
  }

  setupDimmer() {
    const dimSlider = document.getElementById('dimmer');
    const dimValue = document.getElementById('dim-value');

    if (!dimSlider || !dimValue || !this.layerManager) {
      return null;
    }

    return wireDimmerControl({
      layerManager: this.layerManager,
      sliderEl: dimSlider,
      valueEl: dimValue,
    });
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
    this.layerManager.setLayerVisibility('airspace-arcgis', visible);
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
