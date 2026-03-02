import { computeLegs, formatEte } from '../../services/routes/RouteCalc.js';

/**
 * FlightRoutePanel — side-panel pushed from PlanPanel.
 * Shows DRAW ROUTE button + table of saved routes.
 */
export class FlightRoutePanel {
  constructor({ sideMenu, routeManager, routeTool, routePopup }) {
    this._sideMenu = sideMenu;   // may be null — set via late binding
    this._routeManager = routeManager;
    this._routeTool = routeTool;
    this._routePopup = routePopup;

    this._dropdown = this._buildDropdown();
    this.el = this._build();

    this._routeManager.onChange(() => this._refreshTable());

    document.addEventListener('click', (e) => {
      if (!this._dropdown.contains(e.target) && !e.target.closest('.shape-table__dots')) {
        this._hideDropdown();
      }
    });
  }

  // ─── private ────────────────────────────────────────────────────────────

  _build() {
    const el = document.createElement('div');
    el.className = 'draw-shapes-panel';

    const back = document.createElement('button');
    back.className = 'panel-back-btn';
    back.innerHTML = '&#8249; Flight Route';
    back.addEventListener('click', () => this._sideMenu.popView());
    el.appendChild(back);

    const btnGroup = document.createElement('div');
    btnGroup.className = 'panel-btn-group';
    const drawBtn = document.createElement('button');
    drawBtn.className = 'panel-section-btn';
    drawBtn.textContent = 'Draw Route';
    drawBtn.addEventListener('click', () => {
      this._sideMenu?.close();
      this._routeTool.activate();
    });
    btnGroup.appendChild(drawBtn);
    el.appendChild(btnGroup);

    const tableWrap = document.createElement('div');
    tableWrap.className = 'shape-table-wrap';
    el.appendChild(tableWrap);
    this._tableWrap = tableWrap;

    this._refreshTable();
    return el;
  }

  _refreshTable() {
    this._hideDropdown();
    const routes = this._routeManager.routes;
    this._tableWrap.innerHTML = '';

    if (routes.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'shape-table-empty';
      empty.textContent = 'No routes yet.';
      this._tableWrap.appendChild(empty);
      return;
    }

    const table = document.createElement('table');
    table.className = 'shape-table';
    table.innerHTML = `
      <thead><tr>
        <th>Name</th><th>Info</th><th>Vis</th><th></th>
      </tr></thead>
    `;
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    this._tableWrap.appendChild(table);

    for (const route of routes) {
      tbody.appendChild(this._makeRow(route));
    }
  }

  _makeRow(route) {
    const tr = document.createElement('tr');
    tr.dataset.id = route.id;

    // Name
    const nameTd = document.createElement('td');
    nameTd.className = 'shape-table__name';
    nameTd.textContent = route.name;

    // Info — total dist + ETE
    const infoTd = document.createElement('td');
    infoTd.className = 'shape-table__loc';
    const wps = route.waypoints ?? [];
    if (wps.length >= 2) {
      const legs = computeLegs(wps, route.defaultKtas, route.defaultWindHdg, route.defaultWindSpd);
      const totalDist = legs.reduce((s, l) => s + l.distNm, 0).toFixed(1);
      const allHaveEte = legs.every((l) => l.eteSeconds != null);
      const totalEte = allHaveEte ? legs.reduce((s, l) => s + l.eteSeconds, 0) : null;
      infoTd.textContent = totalEte != null
        ? `${totalDist}nm / ${formatEte(totalEte)}`
        : `${totalDist}nm`;
    } else {
      infoTd.textContent = `${wps.length} WP`;
    }

    // Visibility eye toggle
    const visTd = document.createElement('td');
    visTd.className = 'shape-table__vis';
    const eyeBtn = document.createElement('button');
    eyeBtn.className = 'shape-table__eye';
    eyeBtn.title = route.visible ? 'Hide' : 'Show';
    eyeBtn.innerHTML = route.visible ? this._eyeOpenSvg() : this._eyeClosedSvg();
    eyeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._routeManager.setVisible(route.id, !route.visible);
    });
    visTd.appendChild(eyeBtn);

    // Three-dot menu
    const dotsTd = document.createElement('td');
    dotsTd.className = 'shape-table__dots-cell';
    const dotsBtn = document.createElement('button');
    dotsBtn.className = 'shape-table__dots';
    dotsBtn.title = 'Options';
    dotsBtn.innerHTML = '&#8942;';
    dotsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._toggleDropdown(dotsBtn, route);
    });
    dotsTd.appendChild(dotsBtn);

    tr.appendChild(nameTd);
    tr.appendChild(infoTd);
    tr.appendChild(visTd);
    tr.appendChild(dotsTd);
    return tr;
  }

  // ─── Three-dot dropdown ──────────────────────────────────────

  _buildDropdown() {
    const el = document.createElement('div');
    el.className = 'shape-dots-menu';
    el.style.display = 'none';
    document.body.appendChild(el);
    return el;
  }

  _toggleDropdown(anchorBtn, route) {
    if (this._dropdown.dataset.activeId === route.id && this._dropdown.style.display !== 'none') {
      this._hideDropdown();
      return;
    }
    this._dropdown.innerHTML = '';
    this._dropdown.dataset.activeId = route.id;

    const editBtn = document.createElement('button');
    editBtn.className = 'shape-dots-menu__item';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => {
      this._hideDropdown();
      this._routePopup?.open(route.id, { isNew: false });
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'shape-dots-menu__item shape-dots-menu__item--danger';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => {
      this._hideDropdown();
      this._routeManager.removeRoute(route.id);
    });

    this._dropdown.appendChild(editBtn);
    this._dropdown.appendChild(deleteBtn);

    this._dropdown.style.display = 'block';
    const rect = anchorBtn.getBoundingClientRect();
    const ddRect = this._dropdown.getBoundingClientRect();
    let top = rect.bottom + 2;
    let left = rect.right - ddRect.width;
    if (left < 4) left = 4;
    if (top + ddRect.height > window.innerHeight - 4) top = rect.top - ddRect.height - 2;
    this._dropdown.style.top = `${top}px`;
    this._dropdown.style.left = `${left}px`;
  }

  _hideDropdown() {
    this._dropdown.style.display = 'none';
    this._dropdown.dataset.activeId = '';
  }

  // ─── SVG helpers ────────────────────────────────────────────

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
