import { togglePopup } from './popupManager.js';

const SUN_SVG = `
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
     stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="4"/>
  <path d="M12 2v2"/><path d="M12 20v2"/>
  <path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/>
  <path d="M2 12h2"/><path d="M20 12h2"/>
  <path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
</svg>`;

export class BrightnessSlider {
  constructor({ layerManager, bottomBar }) {
    this.layerManager = layerManager;
    this.bottomBar = bottomBar;
    this.btn = null;
    this.popup = null;
  }

  mount() {
    const btn = document.createElement('button');
    btn.className = 'bar-btn';
    btn.setAttribute('aria-label', 'Map brightness');
    btn.innerHTML = SUN_SVG;

    const popup = document.createElement('div');
    popup.className = 'popup-menu popup-menu--brightness';

    const wrap = document.createElement('div');
    wrap.className = 'brightness-slider-wrap';

    const valLabel = document.createElement('span');
    valLabel.className = 'brightness-val';
    valLabel.textContent = '0%';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '85';
    slider.value = '0';
    slider.setAttribute('aria-label', 'Map brightness');

    slider.addEventListener('input', () => {
      const v = Number(slider.value);
      this.layerManager.setBaseImageryDim(v);
      valLabel.textContent = `${v}%`;
    });

    wrap.appendChild(valLabel);
    wrap.appendChild(slider);
    popup.appendChild(wrap);

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
