import { StatusBar } from './StatusBar.js';

export class OverlayService {
  constructor(root = document.body) {
    this.root = root;
    this.statusBar = null;
  }

  createCenterCrosshair() {
    const crosshair = document.createElement('div');
    crosshair.className = 'center-crosshair';
    crosshair.setAttribute('aria-hidden', 'true');
    this.root.appendChild(crosshair);
    return crosshair;
  }

  createStatusBar() {
    this.statusBar = new StatusBar(this.root).render('--');
    return this.statusBar;
  }
}
