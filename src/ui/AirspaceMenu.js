import { togglePopup } from './popupManager.js';

// Quadrilateral / airspace boundary icon
const QUAD_SVG = `
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
     stroke-linecap="round" stroke-linejoin="round">
  <polygon points="5,20 3,7 14,3 21,14"/>
</svg>`;

const CHEVRON_SVG = `<svg class="am-chevron" width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
  <path d="M2 3.5 5 6.5 8 3.5" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

export class AirspaceMenu {
  constructor({ layerManager, categories, bottomBar, mapLegend = null }) {
    this.layerManager = layerManager;
    this.categories = categories;
    this.bottomBar = bottomBar;
    this.mapLegend = mapLegend;
    this.btn = null;
    this.popup = null;
    /** @type {Map<string, HTMLElement>} category label → body element */
    this._categoryBodies = new Map();
  }

  mount() {
    const btn = document.createElement('button');
    btn.className = 'bar-btn';
    btn.setAttribute('aria-label', 'Toggle airspace layers');
    btn.innerHTML = QUAD_SVG;

    const popup = document.createElement('div');
    popup.className = 'popup-menu popup-menu--airspace';

    this.categories.forEach((cat, i) => {
      if (i > 0) {
        const divider = document.createElement('div');
        divider.className = 'popup-menu__divider';
        popup.appendChild(divider);
      }

      // Category header
      const header = document.createElement('button');
      header.className = 'am-category-header';
      header.innerHTML = `${CHEVRON_SVG}<span>${cat.label}</span>`;

      // Category body — starts collapsed
      const body = document.createElement('div');
      body.className = 'am-category-body';
      this._categoryBodies.set(cat.label, body);

      // Build layer rows
      cat.layers.forEach((def) => {
        body.appendChild(this._makeItem(def));
      });

      header.addEventListener('click', () => {
        const open = body.classList.toggle('am-category-body--open');
        header.classList.toggle('am-category-header--open', open);
      });

      popup.appendChild(header);
      popup.appendChild(body);
    });

    // Legend checkbox — always at the bottom
    const divider = document.createElement('div');
    divider.className = 'popup-menu__divider';
    popup.appendChild(divider);

    const legendItem = document.createElement('label');
    legendItem.className = 'popup-menu__item';
    const legendCb = document.createElement('input');
    legendCb.type = 'checkbox';
    legendCb.checked = false;
    legendCb.addEventListener('change', () => {
      this.mapLegend?.setVisible(legendCb.checked);
    });
    legendItem.appendChild(legendCb);
    legendItem.appendChild(document.createTextNode('Legend'));
    popup.appendChild(legendItem);

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

  /**
   * Dynamically add a layer entry to a category (e.g. Simulated Airspace).
   * @param {string} categoryLabel
   * @param {{ id: string, label: string }} def
   */
  addLayer(categoryLabel, def) {
    const body = this._categoryBodies.get(categoryLabel);
    if (!body) return;
    body.appendChild(this._makeItem(def));
  }

  // ─── private ────────────────────────────────────────────────────────────

  _makeItem(def) {
    const item = document.createElement('label');
    item.className = 'popup-menu__item';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = def.defaultOn ?? true;

    cb.addEventListener('change', () => {
      this.layerManager.setLayerVisibility(def.id, cb.checked);
    });

    item.appendChild(cb);
    item.appendChild(document.createTextNode(def.label));
    return item;
  }
}
