const MAX_LENGTH = 300;

const COPY_SVG = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"
  stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <rect x="5" y="5" width="9" height="9" rx="1.5"/>
  <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5"/>
</svg>`;

const CLEAR_SVG = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none"
  stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
  <line x1="2" y1="2" x2="10" y2="10"/>
  <line x1="10" y1="2" x2="2" y2="10"/>
</svg>`;

export class ScratchPad {
  constructor({ bottomBar }) {
    this._input = null;
    this._buildUI(bottomBar);
  }

  // ─── private ────────────────────────────────────────────────────────────

  _buildUI(bottomBar) {
    const wrap = document.createElement('div');
    wrap.className = 'scratchpad';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'scratchpad__input';
    input.placeholder = 'scratch pad';
    input.maxLength = MAX_LENGTH;
    input.autocomplete = 'off';
    input.spellcheck = false;

    // Prevent map keyboard shortcuts while typing
    input.addEventListener('keydown', (e) => e.stopPropagation());

    const copyBtn = document.createElement('button');
    copyBtn.className = 'bar-btn';
    copyBtn.setAttribute('aria-label', 'Copy scratch pad');
    copyBtn.title = 'Copy';
    copyBtn.innerHTML = COPY_SVG;
    copyBtn.addEventListener('click', () => this._copy());

    const clearBtn = document.createElement('button');
    clearBtn.className = 'bar-btn';
    clearBtn.setAttribute('aria-label', 'Clear scratch pad');
    clearBtn.title = 'Clear';
    clearBtn.innerHTML = CLEAR_SVG;
    clearBtn.addEventListener('click', () => this._clear());

    wrap.appendChild(input);
    wrap.appendChild(copyBtn);
    wrap.appendChild(clearBtn);
    bottomBar.addLeftControl(wrap);
    this._input = input;
  }

  async _copy() {
    const text = this._input.value;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      this._flash('rgba(245,168,0,0.35)');
    } catch {
      // Fallback: select all so user can Ctrl+C manually
      this._input.select();
    }
  }

  _clear() {
    this._input.value = '';
    this._input.focus();
  }

  _flash(color) {
    this._input.style.transition = 'none';
    this._input.style.borderColor = color;
    setTimeout(() => {
      this._input.style.transition = 'border-color 0.6s ease';
      this._input.style.borderColor = '';
    }, 80);
  }
}
