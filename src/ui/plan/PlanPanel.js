/**
 * PlanPanel — top-level Plan submenu.
 * Three items: Draw Shapes (enabled), Draw Route (enabled), Add Tasks (SOON).
 */
export class PlanPanel {
  constructor({ sideMenu, drawShapesPanel, flightRoutePanel }) {
    this._sideMenu = sideMenu;
    this._drawShapesPanel = drawShapesPanel;
    this._flightRoutePanel = flightRoutePanel;
    this.el = this._build();
  }

  _build() {
    const el = document.createElement('div');
    el.className = 'plan-panel';

    // Back button
    const back = document.createElement('button');
    back.className = 'panel-back-btn';
    back.innerHTML = '&#8249; Plan';
    back.addEventListener('click', () => this._sideMenu.popView());
    el.appendChild(back);

    // Buttons
    const btnGroup = document.createElement('div');
    btnGroup.className = 'panel-btn-group';

    const drawShapesBtn = this._makeBtn('Draw Shapes/Points', false);
    drawShapesBtn.addEventListener('click', () => {
      this._sideMenu.pushView('draw-shapes', this._drawShapesPanel.el);
    });

    const drawRouteBtn = this._makeBtn('Draw Route', false);
    drawRouteBtn.addEventListener('click', () => {
      this._sideMenu.pushView('flight-route', this._flightRoutePanel.el);
    });

    btnGroup.appendChild(drawShapesBtn);
    btnGroup.appendChild(drawRouteBtn);
    btnGroup.appendChild(this._makeBtn('Add Tasks', true));
    el.appendChild(btnGroup);

    return el;
  }

  _makeBtn(label, disabled) {
    const btn = document.createElement('button');
    btn.className = disabled
      ? 'panel-section-btn panel-section-btn--disabled'
      : 'panel-section-btn';
    btn.disabled = disabled;
    btn.textContent = label;
    if (disabled) {
      const tag = document.createElement('span');
      tag.className = 'side-menu__btn-tag';
      tag.textContent = 'SOON';
      btn.appendChild(tag);
    }
    return btn;
  }
}
