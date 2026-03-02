/**
 * OpMissionPanel — side-panel pushed from PlanPanel.
 * Shows DRAW OP MISSION button + table of saved missions.
 */
export class OpMissionPanel {
  constructor({ sideMenu, opMissionManager, missionTool, opMissionPopup }) {
    this._sideMenu = sideMenu;   // may be null — set via late binding
    this._manager = opMissionManager;
    this._missionTool = missionTool;
    this._popup = opMissionPopup;

    this._dropdown = this._buildDropdown();
    this.el = this._build();

    this._manager.onChange(() => this._refreshTable());

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
    back.innerHTML = '&#8249; Op Mission';
    back.addEventListener('click', () => this._sideMenu.popView());
    el.appendChild(back);

    const btnGroup = document.createElement('div');
    btnGroup.className = 'panel-btn-group';

    const drawBtn = document.createElement('button');
    drawBtn.className = 'panel-section-btn';
    drawBtn.textContent = 'Draw Op Mission';
    drawBtn.addEventListener('click', () => {
      this._sideMenu?.close();
      this._missionTool.activate();
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
    const missions = this._manager.missions;
    this._tableWrap.innerHTML = '';

    if (missions.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'shape-table-empty';
      empty.textContent = 'No missions yet.';
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

    for (const mission of missions) {
      tbody.appendChild(this._makeRow(mission));
    }
  }

  _makeRow(mission) {
    const tr = document.createElement('tr');
    tr.dataset.id = mission.id;

    // Name
    const nameTd = document.createElement('td');
    nameTd.className = 'shape-table__name';
    nameTd.textContent = mission.name;

    // Info — WP count
    const infoTd = document.createElement('td');
    infoTd.className = 'shape-table__loc';
    const wpCount = mission.waypoints?.length ?? 0;
    infoTd.textContent = `${wpCount} WP`;

    // Visibility eye toggle
    const visTd = document.createElement('td');
    visTd.className = 'shape-table__vis';
    const eyeBtn = document.createElement('button');
    eyeBtn.className = 'shape-table__eye';
    eyeBtn.title = mission.visible ? 'Hide' : 'Show';
    eyeBtn.innerHTML = mission.visible ? this._eyeOpenSvg() : this._eyeClosedSvg();
    eyeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._manager.setVisible(mission.id, !mission.visible);
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
      this._toggleDropdown(dotsBtn, mission);
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

  _toggleDropdown(anchorBtn, mission) {
    if (this._dropdown.dataset.activeId === mission.id && this._dropdown.style.display !== 'none') {
      this._hideDropdown();
      return;
    }
    this._dropdown.innerHTML = '';
    this._dropdown.dataset.activeId = mission.id;

    const editBtn = document.createElement('button');
    editBtn.className = 'shape-dots-menu__item';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => {
      this._hideDropdown();
      this._popup?.open(mission.id, { isNew: false });
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'shape-dots-menu__item shape-dots-menu__item--danger';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => {
      this._hideDropdown();
      this._manager.removeMission(mission.id);
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
