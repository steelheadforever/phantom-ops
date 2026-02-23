function makeCross() {
  const img = document.createElement('img');
  img.className = 'top-bar__cross';
  img.src = './src/assets/558-cross.png';
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  return img;
}

function makeUtcClock() {
  const clock = document.createElement('span');
  clock.className = 'top-bar__utc';

  const tick = () => {
    const now = new Date();
    const h = String(now.getUTCHours()).padStart(2, '0');
    const m = String(now.getUTCMinutes()).padStart(2, '0');
    const s = String(now.getUTCSeconds()).padStart(2, '0');
    clock.textContent = `${h}:${m}:${s}Z`;
  };

  tick();
  setInterval(tick, 1000);
  return clock;
}

export class TopBar {
  constructor({ onHamburger } = {}) {
    this.onHamburger = onHamburger;
    this.el = null;
  }

  mount(root = document.body) {
    const bar = document.createElement('div');
    bar.className = 'top-bar';

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

    const title = document.createElement('span');
    title.className = 'top-bar__title';
    title.textContent = 'PHANTOM-OPS';

    const spacer = document.createElement('div');
    spacer.className = 'top-bar__spacer';

    bar.appendChild(hamburger);
    bar.appendChild(makeCross());
    bar.appendChild(title);
    bar.appendChild(makeCross());
    bar.appendChild(spacer);
    bar.appendChild(makeUtcClock());

    root.appendChild(bar);
    this.el = bar;
    return this;
  }
}
