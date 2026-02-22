export class StatusBar {
  constructor(root = document.body) {
    this.root = root;
    this.container = null;
    this.coordinateEl = null;
  }

  render(initialValue = '--') {
    const bar = document.createElement('div');
    bar.className = 'status-bar';

    const coordinate = document.createElement('span');
    coordinate.className = 'status-bar__coord';
    coordinate.textContent = initialValue;
    coordinate.title = 'Click to cycle format: MGRS → DMS → DMM';

    bar.appendChild(coordinate);
    this.root.appendChild(bar);

    this.container = bar;
    this.coordinateEl = coordinate;

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
}
