import { BASE_LAYER_MANIFEST } from '../config/base-layer-manifest.js';

export function createBaseLayerSourceDefinitions(manifest) {
  const layers = manifest?.layers;
  if (!Array.isArray(layers)) {
    throw new Error('Base layer manifest must provide a layers array');
  }

  return layers.map((layer) => ({
    id: layer.id,
    label: layer.label,
    type: layer.type,
    url: layer.url,
    options: {
      maxZoom: layer.maxZoom,
      attribution: layer.attribution,
    },
    isDefault: Boolean(layer.isDefault),
    metadata: {
      cycle: layer.cycle ?? manifest?.cycle ?? null,
      publishedAt: layer.publishedAt ?? manifest?.publishedAt ?? null,
      version: layer.version ?? null,
      schemaVersion: manifest?.schemaVersion ?? null,
    },
  }));
}

export const BASE_LAYER_SOURCE_DEFINITIONS = Object.freeze(
  createBaseLayerSourceDefinitions(BASE_LAYER_MANIFEST),
);

export function createBaseTileLayer(definition, leafletLib = L) {
  if (definition.type !== 'tile') {
    throw new Error(`Unsupported base layer type: ${definition.type}`);
  }
  return leafletLib.tileLayer(definition.url, definition.options ?? {});
}
