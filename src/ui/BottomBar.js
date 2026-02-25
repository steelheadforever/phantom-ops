export class BottomBar {
  constructor() {
    this.el = null;
    this.coordinateEl = null;
    this.leftControlsEl = null;
    this.controlsEl = null;
  }

  mount(root = document.body) {
    const bar = document.createElement('div');
    bar.className = 'bottom-bar';

    // Left group: coordinate display + scratchpad (flex:1, stays left)
    const left = document.createElement('div');
    left.className = 'bottom-bar__left';

    const coord = document.createElement('span');
    coord.className = 'bottom-bar__coord';
    coord.textContent = '--';
    coord.title = 'Click to cycle format: MGRS → DMS → DMM';

    const leftControls = document.createElement('div');
    leftControls.className = 'bottom-bar__left-controls';

    left.appendChild(coord);
    left.appendChild(leftControls);

    const midControls = document.createElement('div');
    midControls.className = 'bottom-bar__mid-controls';

    const controls = document.createElement('div');
    controls.className = 'bottom-bar__controls';

    bar.appendChild(left);
    bar.appendChild(midControls);
    bar.appendChild(controls);
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
