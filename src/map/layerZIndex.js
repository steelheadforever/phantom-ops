export const LAYER_Z_INDEX = Object.freeze({
  BASE_MAP: 200,
  GARS: 300,
  AIRSPACE: 400,
  DRAWINGS: 500,
  UI_OVERLAY: 900,
});

export const PANE_IDS = Object.freeze({
  BASE_MAP: 'pane-base-map',
  GARS: 'pane-gars',
  AIRSPACE: 'pane-airspace',
  DRAWINGS: 'pane-drawings',
});

export const ORDERED_STACK = Object.freeze([
  PANE_IDS.BASE_MAP,
  PANE_IDS.GARS,
  PANE_IDS.AIRSPACE,
  PANE_IDS.DRAWINGS,
]);
