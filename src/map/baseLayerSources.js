export const BASE_LAYER_SOURCE_DEFINITIONS = Object.freeze([
  {
    id: 'base-satellite',
    label: 'Satellite',
    type: 'tile',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: {
      maxZoom: 18,
      attribution: 'Imagery &copy; Esri',
    },
    isDefault: true,
  },
  {
    id: 'base-terrain',
    label: 'Terrain',
    type: 'tile',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    options: {
      maxZoom: 17,
      attribution: '&copy; OpenTopoMap contributors',
    },
  },
  {
    id: 'base-street',
    label: 'Street Map',
    type: 'tile',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  {
    id: 'base-vfr-sectional',
    label: 'VFR Sectional (FAA)',
    type: 'tile',
    // Endpoint remains configurable; swap/retarget by editing this definition.
    url: 'https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/ArcGIS/rest/services/VFR_Sectional/MapServer/tile/{z}/{y}/{x}',
    options: {
      maxZoom: 12,
      attribution: 'FAA AIS chart-derived tiles (planning use only)',
    },
  },
  {
    id: 'base-ifr-low',
    label: 'IFR Low (FAA)',
    type: 'tile',
    url: 'https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/ArcGIS/rest/services/IFR_AreaLow/MapServer/tile/{z}/{y}/{x}',
    options: {
      maxZoom: 12,
      attribution: 'FAA AIS chart-derived tiles (planning use only)',
    },
  },
  {
    id: 'base-ifr-high',
    label: 'IFR High (FAA)',
    type: 'tile',
    url: 'https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/ArcGIS/rest/services/IFR_High/MapServer/tile/{z}/{y}/{x}',
    options: {
      maxZoom: 12,
      attribution: 'FAA AIS chart-derived tiles (planning use only)',
    },
  },
]);

export function createBaseTileLayer(definition, leafletLib = L) {
  if (definition.type !== 'tile') {
    throw new Error(`Unsupported base layer type: ${definition.type}`);
  }
  return leafletLib.tileLayer(definition.url, definition.options ?? {});
}
