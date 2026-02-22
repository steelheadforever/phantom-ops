export class AirspaceLayerControl {
  constructor({ baseLayers, airspaceLayerDefs, layerManager }) {
    this.baseLayers = baseLayers;
    this.airspaceLayerDefs = airspaceLayerDefs;
    this.layerManager = layerManager;
    this._container = null;
    this._control = null;
  }

  addTo(map) {
    this._map = map;
    this._control = L.control({ position: 'topright' });
    this._control.onAdd = () => this._buildContainer();
    this._control.addTo(map);
    return this;
  }

  _buildContainer() {
    const container = L.DomUtil.create('div', 'leaflet-control-layers airspace-layer-control');
    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);

    // Base layer radios
    const baseSection = L.DomUtil.create('div', 'alc-section', container);
    const baseEntries = Object.entries(this.baseLayers);
    baseEntries.forEach(([label, layer], i) => {
      const row = L.DomUtil.create('label', 'alc-row', baseSection);
      const radio = L.DomUtil.create('input', '', row);
      radio.type = 'radio';
      radio.name = 'alc-base-layer';
      radio.checked = this._map.hasLayer(layer);
      const span = L.DomUtil.create('span', '', row);
      span.textContent = ` ${label}`;

      L.DomEvent.on(radio, 'change', () => {
        // Remove all base layers, add selected
        baseEntries.forEach(([, l]) => {
          if (this._map.hasLayer(l)) this._map.removeLayer(l);
        });
        layer.addTo(this._map);
        this._map.fire('baselayerchange', { layer, name: label });
      });
    });

    // Separator
    L.DomUtil.create('div', 'alc-separator', container);

    // Airspace group header
    const groupHeader = L.DomUtil.create('div', 'alc-group-header', container);
    const arrow = L.DomUtil.create('span', 'alc-arrow', groupHeader);
    arrow.textContent = '\u25BC';
    const headerLabel = L.DomUtil.create('span', '', groupHeader);
    headerLabel.textContent = ' Airspace';

    // Airspace checkboxes (collapsible)
    const groupBody = L.DomUtil.create('div', 'alc-group-body', container);

    this.airspaceLayerDefs.forEach((def) => {
      const row = L.DomUtil.create('label', 'alc-row alc-indent', groupBody);
      const cb = L.DomUtil.create('input', '', row);
      cb.type = 'checkbox';
      cb.checked = true;
      const span = L.DomUtil.create('span', '', row);
      span.textContent = ` ${def.label}`;

      L.DomEvent.on(cb, 'change', () => {
        this.layerManager.setLayerVisibility(def.id, cb.checked);
      });
    });

    // Toggle expand/collapse
    let expanded = true;
    L.DomEvent.on(groupHeader, 'click', () => {
      expanded = !expanded;
      groupBody.style.display = expanded ? '' : 'none';
      arrow.textContent = expanded ? '\u25BC' : '\u25B6';
    });

    this._container = container;
    return container;
  }
}
