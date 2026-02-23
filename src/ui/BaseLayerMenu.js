import { togglePopup } from './popupManager.js';
import { persistBaseLayerId } from '../map/baseLayerPreferences.js';

const GLOBE_SVG = `
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
     stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="10"/>
  <path d="M2 12h20"/>
  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
</svg>`;

export class BaseLayerMenu {
  constructor({ mapCore, bottomBar }) {
    this.mapCore = mapCore;
    this.bottomBar = bottomBar;
    this.btn = null;
    this.popup = null;
  }

  mount() {
    const btn = document.createElement('button');
    btn.className = 'bar-btn';
    btn.setAttribute('aria-label', 'Select map layer');
    btn.innerHTML = GLOBE_SVG;

    const popup = document.createElement('div');
    popup.className = 'popup-menu popup-menu--layers';

    const activeId = this.mapCore.layerManager.getActiveBaseLayerId();

    this.mapCore.baseLayerDefinitions.forEach((def) => {
      const item = document.createElement('label');
      item.className = 'popup-menu__item' + (def.id === activeId ? ' active-layer' : '');

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'base-layer';
      radio.value = def.id;
      radio.checked = def.id === activeId;

      const text = document.createTextNode(def.label);

      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        this.mapCore.switchBaseLayer(def.id);
        // Update active-layer highlight
        popup.querySelectorAll('.popup-menu__item').forEach((el) => el.classList.remove('active-layer'));
        item.classList.add('active-layer');
      });

      item.appendChild(radio);
      item.appendChild(text);
      popup.appendChild(item);
    });

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Align popup to right edge of button
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
