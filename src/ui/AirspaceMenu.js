import { togglePopup } from './popupManager.js';

// Quadrilateral / airspace boundary icon
const QUAD_SVG = `
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
     stroke-linecap="round" stroke-linejoin="round">
  <polygon points="5,20 3,7 14,3 21,14"/>
</svg>`;

export class AirspaceMenu {
  constructor({ layerManager, airspaceLayerDefs, bottomBar }) {
    this.layerManager = layerManager;
    this.airspaceLayerDefs = airspaceLayerDefs;
    this.bottomBar = bottomBar;
    this.btn = null;
    this.popup = null;
  }

  mount() {
    const btn = document.createElement('button');
    btn.className = 'bar-btn';
    btn.setAttribute('aria-label', 'Toggle airspace layers');
    btn.innerHTML = QUAD_SVG;

    const popup = document.createElement('div');
    popup.className = 'popup-menu popup-menu--airspace';

    this.airspaceLayerDefs.forEach((def) => {
      const item = document.createElement('label');
      item.className = 'popup-menu__item';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = true;

      const text = document.createTextNode(def.label);

      cb.addEventListener('change', () => {
        this.layerManager.setLayerVisibility(def.id, cb.checked);
      });

      item.appendChild(cb);
      item.appendChild(text);
      popup.appendChild(item);
    });

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const rect = btn.getBoundingClientRect();
      popup.style.right = (window.innerWidth - rect.right) + 'px';
      togglePopup(popup, btn);
    });

    document.body.appendChild(popup);
    this.bottomBar.addControl(btn);
    this.btn = btn;
    this.popup = popup;
    return this;
  }
}
