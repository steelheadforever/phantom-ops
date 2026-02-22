export const BASE_LAYER_STORAGE_KEY = 'phantom.baseLayer.selectedId';

export function resolveInitialBaseLayerId({ definitions, storage }) {
  const validIds = new Set((definitions ?? []).map((definition) => definition.id));
  const storedLayerId = readStoredBaseLayerId(storage);

  if (storedLayerId && validIds.has(storedLayerId)) {
    return storedLayerId;
  }

  return definitions?.find((item) => item.isDefault)?.id ?? definitions?.[0]?.id ?? null;
}

export function persistBaseLayerId(storage, layerId) {
  if (!storage || !layerId) return;

  try {
    storage.setItem(BASE_LAYER_STORAGE_KEY, layerId);
  } catch {
    // Ignore persistence failures in restricted/private browsing contexts.
  }
}

function readStoredBaseLayerId(storage) {
  if (!storage) return null;

  try {
    return storage.getItem(BASE_LAYER_STORAGE_KEY);
  } catch {
    return null;
  }
}
