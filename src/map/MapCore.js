export class MapCore {
  constructor() {
    this.map = null;
  }

  init() {
    this.map = L.map('map', {
      center: [39.0, -98.0],
      zoom: 5,
      zoomControl: true,
    });

    const osmBase = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18,
    });

    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18,
      attribution: 'Imagery &copy; Esri',
    });

    const topoMap = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution: '&copy; OpenTopoMap contributors',
    });

    satellite.addTo(this.map);

    const baseLayers = {
      Satellite: satellite,
      Terrain: topoMap,
      'Street Map': osmBase,
    };

    L.control.layers(baseLayers, null, { position: 'topright' }).addTo(this.map);

    return this.map;
  }

  setupDimmer() {
    const dimOverlay = document.getElementById('dim-overlay');
    const dimSlider = document.getElementById('dimmer');
    const dimValue = document.getElementById('dim-value');

    dimSlider.addEventListener('input', (e) => {
      const val = e.target.value;
      dimOverlay.style.background = `rgba(0, 0, 0, ${val / 100})`;
      dimValue.textContent = `${val}%`;
    });
  }
}
