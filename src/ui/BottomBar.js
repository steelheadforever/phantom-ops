function makeUtcClock() {
  const clock = document.createElement('span');
  clock.className = 'bottom-bar__clock';

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

export class BottomBar {
  constructor() {
    this.el = null;
    this.coordinateEl = null;
    this.leftControlsEl = null;
    this.midControlsEl = null;
    this.controlsEl = null;
  }

  mount(root = document.body) {
    const bar = document.createElement('div');
    bar.className = 'bottom-bar';

    // Row 1: coord display + scratchpad + point search
    const row1 = document.createElement('div');
    row1.className = 'bottom-bar__row-1';

    const coord = document.createElement('span');
    coord.className = 'bottom-bar__coord';
    coord.textContent = '--';
    coord.title = 'Click to cycle format: MGRS → DMS → DMM';

    const leftControls = document.createElement('div');
    leftControls.className = 'bottom-bar__left-controls';

    const midControls = document.createElement('div');
    midControls.className = 'bottom-bar__mid-controls';

    row1.appendChild(coord);
    row1.appendChild(leftControls);
    row1.appendChild(midControls);

    // Row 2: control buttons + desktop clock
    const row2 = document.createElement('div');
    row2.className = 'bottom-bar__row-2';

    const controls = document.createElement('div');
    controls.className = 'bottom-bar__controls';

    row2.appendChild(controls);
    row2.appendChild(makeUtcClock());

    bar.appendChild(row1);
    bar.appendChild(row2);
    root.appendChild(bar);

    this.el = bar;
    this.coordinateEl = coord;
    this.leftControlsEl = leftControls;
    this.midControlsEl = midControls;
    this.controlsEl = controls;
    return this;
  }

  setCoordinate(value) {
    if (this.coordinateEl) {
      this.coordinateEl.textContent = value || '--';
    }
  }

  onCoordinateClick(handler) {
    this.coordinateEl?.addEventListener('click', handler);
  }

  addLeftControl(el) {
    this.leftControlsEl?.appendChild(el);
  }

  addMidControl(buttonEl) {
    this.midControlsEl?.appendChild(buttonEl);
  }

  addControl(buttonEl) {
    this.controlsEl?.appendChild(buttonEl);
  }
}
