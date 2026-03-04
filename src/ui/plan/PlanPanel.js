/**
 * PlanPanel — top-level Plan submenu.
 * Shows a scrollable overview of all drawings, plus nav buttons for each plan tool.
 */
export class PlanPanel {
  constructor({
    sideMenu,
    drawShapesPanel, flightRoutePanel, opMissionPanel, eMissionPanel,
    shapeManager, routeManager, opMissionManager, eMissionManager,
    shapePopup, polygonPopup, linePopup, pointPopup,
    routePopup, opMissionPopup, eMissionPopup,
  } = {}) {
    this._sideMenu = sideMenu;
    this._drawShapesPanel = drawShapesPanel;
    this._flightRoutePanel = flightRoutePanel;
    this._opMissionPanel = opMissionPanel;
    this._eMissionPanel = eMissionPanel;

    this._shapeManager = shapeManager;
    this._routeManager = routeManager;
    this._opMissionManager = opMissionManager;
    this._eMissionManager = eMissionManager;

    this._shapePopup = shapePopup;
    this._polygonPopup = polygonPopup;
    this._linePopup = linePopup;
    this._pointPopup = pointPopup;
    this._routePopup = routePopup;
    this._opMissionPopup = opMissionPopup;
    this._eMissionPopup = eMissionPopup;

    this._overviewEl = null;
    this.el = this._build();

    // Subscribe to all managers for live overview updates
    shapeManager?.onChange(() => this._refreshOverview());
    routeManager?.onChange(() => this._refreshOverview());
    opMissionManager?.onChange(() => this._refreshOverview());
    eMissionManager?.onChange(() => this._refreshOverview());
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

    // Nav buttons
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

    const opMissionBtn = this._makeBtn('Op Mission', false);
    opMissionBtn.addEventListener('click', () => {
      this._sideMenu.pushView('op-mission', this._opMissionPanel.el);
    });

    const eMissionBtn = this._makeBtn('E-Mission', false);
    eMissionBtn.addEventListener('click', () => {
      this._sideMenu.pushView('e-mission', this._eMissionPanel.el);
    });

    btnGroup.appendChild(drawShapesBtn);
    btnGroup.appendChild(drawRouteBtn);
    btnGroup.appendChild(opMissionBtn);
    btnGroup.appendChild(eMissionBtn);
    btnGroup.appendChild(this._makeBtn('Add Tasks', true));
    el.appendChild(btnGroup);

    // Divider
    const divider = document.createElement('div');
    divider.className = 'plan-overview-divider';
    el.appendChild(divider);

    // Overview section (scrollable, below buttons)
    const overviewEl = document.createElement('div');
    overviewEl.className = 'plan-overview';
    this._overviewEl = overviewEl;
    el.appendChild(overviewEl);
    this._refreshOverview();

    return el;
  }

  _refreshOverview() {
    if (!this._overviewEl) return;
    this._overviewEl.innerHTML = '';

    const shapes = this._shapeManager?.shapes ?? [];
    const routes = this._routeManager?.routes ?? [];
    const opMissions = this._opMissionManager?.missions ?? [];
    const eMissions = this._eMissionManager?.missions ?? [];

    const hasAny = shapes.length || routes.length || opMissions.length || eMissions.length;
    if (!hasAny) {
      const empty = document.createElement('div');
      empty.className = 'plan-ov-empty';
      empty.textContent = 'No drawings yet';
      this._overviewEl.appendChild(empty);
      return;
    }

    if (shapes.length) {
      this._overviewEl.appendChild(this._makeCategoryHeader('SHAPES'));
      for (const shape of shapes) {
        this._overviewEl.appendChild(this._makeRow(
          shape,
          () => this._shapeManager.setVisible(shape.id, !shape.visible),
          this._popupForShape(shape),
          () => this._shapeManager.removeShape(shape.id),
        ));
      }
    }

    if (routes.length) {
      this._overviewEl.appendChild(this._makeCategoryHeader('ROUTES'));
      for (const route of routes) {
        this._overviewEl.appendChild(this._makeRow(
          route,
          () => this._routeManager.setVisible(route.id, !route.visible),
          () => this._routePopup?.open(route.id, { isNew: false }),
          () => this._routeManager.removeRoute(route.id),
        ));
      }
    }

    if (opMissions.length) {
      this._overviewEl.appendChild(this._makeCategoryHeader('OP MISSIONS'));
      for (const m of opMissions) {
        this._overviewEl.appendChild(this._makeRow(
          m,
          () => this._opMissionManager.setVisible(m.id, !m.visible),
          () => this._opMissionPopup?.open(m.id, { isNew: false }),
          () => this._opMissionManager.removeMission(m.id),
        ));
      }
    }

    if (eMissions.length) {
      this._overviewEl.appendChild(this._makeCategoryHeader('E-MISSIONS'));
      for (const m of eMissions) {
        this._overviewEl.appendChild(this._makeRow(
          m,
          () => this._eMissionManager.setVisible(m.id, !m.visible),
          () => this._eMissionPopup?.open(m.id, { isNew: false }),
          () => this._eMissionManager.removeMission(m.id),
        ));
      }
    }
  }

  _popupForShape(shape) {
    switch (shape.type) {
      case 'polygon': return () => this._polygonPopup?.open(shape.id, { isNew: false });
      case 'line':    return () => this._linePopup?.open(shape.id, { isNew: false });
      case 'point':   return () => this._pointPopup?.open(shape.id, { isNew: false });
      default:        return () => this._shapePopup?.open(shape.id, { isNew: false });
    }
  }

  _makeCategoryHeader(label) {
    const el = document.createElement('div');
    el.className = 'plan-ov-category';
    el.textContent = label;
    return el;
  }

  _makeRow(item, onEye, onEdit, onDelete) {
    const row = document.createElement('div');
    row.className = 'plan-ov-row';

    const name = document.createElement('span');
    name.className = 'plan-ov-name';
    name.textContent = item.name ?? '(unnamed)';
    name.title = item.name ?? '';

    const eyeBtn = document.createElement('button');
    eyeBtn.className = 'plan-ov-eye shape-table__eye';
    eyeBtn.title = item.visible ? 'Hide' : 'Show';
    eyeBtn.innerHTML = item.visible ? this._eyeOpenSvg() : this._eyeClosedSvg();
    eyeBtn.addEventListener('click', (e) => { e.stopPropagation(); onEye(); });

    const editBtn = document.createElement('button');
    editBtn.className = 'plan-ov-edit';
    editBtn.title = 'Edit';
    editBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
      <path d="M12.85 2.15a1.5 1.5 0 0 0-2.12 0L2 10.88V14h3.12l8.73-8.73a1.5 1.5 0 0 0 0-2.12zM4.38 13H3v-1.38l7.5-7.5 1.38 1.38L4.38 13z"/>
    </svg>`;
    editBtn.addEventListener('click', (e) => { e.stopPropagation(); onEdit(); });

    const delBtn = document.createElement('button');
    delBtn.className = 'plan-ov-del';
    delBtn.title = 'Delete';
    delBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
      <path d="M6 2h4a1 1 0 0 0-2 0H6a1 1 0 0 0 0 2V2zm-2 2v9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4H4zm2 2h1v6H6V6zm3 0h1v6H9V6z"/>
    </svg>`;
    delBtn.addEventListener('click', (e) => { e.stopPropagation(); onDelete(); });

    row.appendChild(name);
    row.appendChild(eyeBtn);
    row.appendChild(editBtn);
    row.appendChild(delBtn);
    return row;
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

  _eyeOpenSvg() {
    return `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 3C4.5 3 1.5 6 .5 8c1 2 4 5 7.5 5s6.5-3 7.5-5C14.5 6 11.5 3 8 3zm0 8a3 3 0 1 1 0-6 3 3 0 0 1 0 6zm0-4.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/>
    </svg>`;
  }

  _eyeClosedSvg() {
    return `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M13.36 2.64 2.64 13.36l.7.7 1.4-1.4A7.9 7.9 0 0 0 8 13c3.5 0 6.5-3 7.5-5a8.5 8.5 0 0 0-1.5-2.64l1.07-1.07-.7-.65zM8 11a3 3 0 0 1-2.58-1.48l.83-.83A1.5 1.5 0 0 0 9.49 6.75l.83-.83A3 3 0 0 1 8 11zM.5 8C1.5 6 4.5 3 8 3c.96 0 1.88.2 2.73.53L9.2 5.06A3 3 0 0 0 5.06 9.2L3.35 10.9A8.8 8.8 0 0 1 .5 8z"/>
    </svg>`;
  }
}
