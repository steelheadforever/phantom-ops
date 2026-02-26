function makeCross() {
  const img = document.createElement('img');
  img.className = 'top-bar__cross';
  img.src = './src/assets/558-cross.png';
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  return img;
}

function tickClock(el) {
  const now = new Date();
  const h = String(now.getUTCHours()).padStart(2, '0');
  const m = String(now.getUTCMinutes()).padStart(2, '0');
  const s = String(now.getUTCSeconds()).padStart(2, '0');
  el.textContent = `${h}:${m}:${s}Z`;
}

export class TopBar {
  constructor({ onHamburger, onInfoMode } = {}) {
    this.onHamburger = onHamburger;
    this.onInfoMode = onInfoMode;
    this.el = null;
    this._infoBtnEl = null;
    this._clockOverlay = null;
    this._clockInterval = null;
  }

  mount(root = document.body) {
    const bar = document.createElement('div');
    bar.className = 'top-bar';

    const title = document.createElement('span');
    title.className = 'top-bar__title';
    title.textContent = 'PHANTOM-OPS';

    const spacer = document.createElement('div');
    spacer.className = 'top-bar__spacer';

    // i-btn: touch-only (hidden on non-touch via CSS)
    const infoBtn = document.createElement('button');
    infoBtn.className = 'top-bar__info-btn bar-btn';
    infoBtn.setAttribute('aria-label', 'Point info');
    infoBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/>
      <text x="8" y="12" text-anchor="middle" font-size="9" font-family="B612 Mono,monospace" fill="currentColor" font-style="italic">i</text>
    </svg>`;
    infoBtn.addEventListener('click', () => {
      if (infoBtn.classList.contains('active')) {
        infoBtn.classList.remove('active');
        return;
      }
      infoBtn.classList.add('active');
      this.onInfoMode?.();
      // Deactivate on next document click (the map tap that triggers the context menu)
      setTimeout(() => {
        document.addEventListener('click', () => {
          infoBtn.classList.remove('active');
        }, { once: true });
      }, 0);
    });
    this._infoBtnEl = infoBtn;

    // clock-btn: touch-only (hidden on non-touch via CSS)
    const clockBtn = document.createElement('button');
    clockBtn.className = 'top-bar__clock-btn bar-btn';
    clockBtn.setAttribute('aria-label', 'UTC clock');
    clockBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.5"/>
      <line x1="8" y1="4" x2="8" y2="8.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="8" y1="8" x2="11" y2="10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`;
    clockBtn.addEventListener('click', () => {
      if (this._clockOverlay) {
        clearInterval(this._clockInterval);
        this._clockOverlay.remove();
        this._clockOverlay = null;
        this._clockInterval = null;
      } else {
        const overlay = document.createElement('div');
        overlay.className = 'top-bar__clock-overlay';
        document.body.appendChild(overlay);
        tickClock(overlay);
        this._clockInterval = setInterval(() => tickClock(overlay), 1000);
        this._clockOverlay = overlay;
      }
    });

    // hamburger — always visible, at the right end
    const hamburger = document.createElement('button');
    hamburger.className = 'top-bar__hamburger';
    hamburger.setAttribute('aria-label', 'Toggle menu');
    hamburger.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="4" width="14" height="1.8" rx="0.9" fill="currentColor"/>
        <rect x="2" y="8.1" width="14" height="1.8" rx="0.9" fill="currentColor"/>
        <rect x="2" y="12.2" width="14" height="1.8" rx="0.9" fill="currentColor"/>
      </svg>`;
    hamburger.addEventListener('click', () => this.onHamburger?.());

    bar.appendChild(makeCross());
    bar.appendChild(title);
    bar.appendChild(makeCross());
    bar.appendChild(spacer);
    bar.appendChild(infoBtn);
    bar.appendChild(clockBtn);
    bar.appendChild(hamburger);

    root.appendChild(bar);
    this.el = bar;
    return this;
  }
}
