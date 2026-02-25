import { BASE_LAYER_MANIFEST } from '../config/base-layer-manifest.js';

export function createBaseLayerSourceDefinitions(manifest) {
  const layers = manifest?.layers;
  if (!Array.isArray(layers)) {
    throw new Error('Base layer manifest must provide a layers array');
  }

  return layers.map((layer) => {
    // For composite layers expose the primary sublayer URL for health-check probing and status tracking
    const primaryUrl = layer.type === 'tile-composite'
      ? (layer.sublayers?.[0]?.url ?? null)
      : layer.url;

    return {
      id: layer.id,
      label: layer.label,
      type: layer.type,
      url: primaryUrl,
      sublayers: layer.type === 'tile-composite' ? layer.sublayers : undefined,
      options: {
        maxZoom: layer.maxZoom ?? 18,
        ...(layer.minNativeZoom != null && { minNativeZoom: layer.minNativeZoom }),
        ...(layer.maxNativeZoom != null && { maxNativeZoom: layer.maxNativeZoom }),
        attribution: layer.attribution,
      },
      fallbackUrls: Array.isArray(layer.fallbackUrls) ? [...layer.fallbackUrls] : [],
      isDefault: Boolean(layer.isDefault),
      metadata: {
        cycle: layer.cycle ?? manifest?.cycle ?? null,
        publishedAt: layer.publishedAt ?? manifest?.publishedAt ?? null,
        version: layer.version ?? null,
        schemaVersion: manifest?.schemaVersion ?? null,
      },
    };
  });
}

export const BASE_LAYER_SOURCE_DEFINITIONS = Object.freeze(
  createBaseLayerSourceDefinitions(BASE_LAYER_MANIFEST),
);

export function createBaseTileLayer(definition, leafletLib = L) {
  if (definition.type === 'tile') {
    return leafletLib.tileLayer(definition.url, definition.options ?? {});
  }

  if (definition.type === 'tile-composite') {
    const group = leafletLib.layerGroup();
    for (const sub of definition.sublayers ?? []) {
      group.addLayer(leafletLib.tileLayer(sub.url, {
        ...definition.options,
        minNativeZoom: sub.minNativeZoom,
        maxNativeZoom: sub.maxNativeZoom,
      }));
    }
    return group;
  }

  throw new Error(`Unsupported base layer type: ${definition.type}`);
}
