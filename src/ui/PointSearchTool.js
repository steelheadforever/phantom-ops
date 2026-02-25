import { searchPointByIdent } from '../services/navaids/NavaidService.js';

export class PointSearchTool {
  constructor({ map, bottomBar }) {
    this._map = map;
    this._input = null;
    this._buildUI(bottomBar);
  }

  // ─── private ────────────────────────────────────────────────────────────

  _buildUI(bottomBar) {
    const wrap = document.createElement('div');
    wrap.className = 'pt-search';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'pt-search__input';
    input.placeholder = 'search';
    input.maxLength = 7;
    input.autocomplete = 'off';
    input.spellcheck = false;

    const btn = document.createElement('button');
    btn.className = 'bar-btn pt-search__go';
    btn.textContent = 'GO';
    btn.setAttribute('aria-label', 'Go to point');

    // Prevent map key handlers firing while typing
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') this._submit();
    });
    btn.addEventListener('click', () => this._submit());

    wrap.appendChild(input);
    wrap.appendChild(btn);
    bottomBar.addMidControl(wrap);
    this._input = input;
  }

  async _submit() {
    const raw = this._input.value.trim().toUpperCase();
    if (!raw) return;

    const result = await searchPointByIdent(raw);
    if (!result) {
      this._flashError();
      return;
    }

    this._map.flyTo([result.lat, result.lon], Math.max(this._map.getZoom(), 10));
  }

  _flashError() {
    this._input.classList.remove('pt-search__input--error');
    // Force reflow so the animation re-triggers if already erroring
    void this._input.offsetWidth;
    this._input.classList.add('pt-search__input--error');
    this._input.addEventListener('animationend', () => {
      this._input.classList.remove('pt-search__input--error');
    }, { once: true });
  }
}
