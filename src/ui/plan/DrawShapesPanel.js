/**
 * DrawShapesPanel — Draw Shapes submenu with Circle/Polygon/Line buttons and a shape table.
 */
export class DrawShapesPanel {
  constructor({ sideMenu, shapeManager, coordinateService, circleTool, shapePopup, polygonTool, polygonPopup }) {
    this._sideMenu = sideMenu;
    this._shapeManager = shapeManager;
    this._coordinateService = coordinateService;
    this._circleTool = circleTool;
    this._shapePopup = shapePopup;
    this._polygonTool = polygonTool;
    this._polygonPopup = polygonPopup;

    // Single shared dropdown element, appended to body
    this._dropdown = this._buildDropdown();

    this.el = this._build();

    // Refresh table whenever shapes change
    this._shapeManager.onChange(() => this._refreshTable());

    // Close dropdown on outside click
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

    // Back button
    const back = document.createElement('button');
    back.className = 'panel-back-btn';
    back.innerHTML = '&#8249; Draw Shapes';
    back.addEventListener('click', () => this._sideMenu.popView());
    el.appendChild(back);

    // Tool buttons
    const btnGroup = document.createElement('div');
    btnGroup.className = 'panel-btn-group';

    const circleBtn = this._makeBtn('Circle', false);
    circleBtn.addEventListener('click', () => {
      this._sideMenu.close();
      this._circleTool.activate();
    });

    const polygonBtn = this._makeBtn('Polygon', false);
    polygonBtn.addEventListener('click', () => {
      this._sideMenu.close();
      this._polygonTool.activate();
    });

    btnGroup.appendChild(circleBtn);
    btnGroup.appendChild(polygonBtn);
    btnGroup.appendChild(this._makeBtn('Line', true));
    el.appendChild(btnGroup);

    // Shape table container
    const tableWrap = document.createElement('div');
    tableWrap.className = 'shape-table-wrap';
    el.appendChild(tableWrap);
    this._tableWrap = tableWrap;

    this._refreshTable();
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

  _refreshTable() {
    this._hideDropdown();
    const shapes = this._shapeManager.shapes;
    this._tableWrap.innerHTML = '';

    if (shapes.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'shape-table-empty';
      empty.textContent = 'No shapes yet.';
      this._tableWrap.appendChild(empty);
      return;
    }

    const table = document.createElement('table');
    table.className = 'shape-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Name</th>
          <th>Info</th>
          <th>Color</th>
          <th>Vis</th>
          <th></th>
        </tr>
      </thead>
    `;

    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    this._tableWrap.appendChild(table);

    for (const shape of shapes) {
      tbody.appendChild(this._makeRow(shape));
    }

    this._initDragDrop(tbody);
  }

  _makeRow(shape) {
    const tr = document.createElement('tr');
    tr.dataset.id = shape.id;
    tr.draggable = true;

    // Name
    const nameTd = document.createElement('td');
    nameTd.className = 'shape-table__name';
    nameTd.textContent = shape.name;

    // Info — location for circles, corner count for polygons
    const infoTd = document.createElement('td');
    infoTd.className = 'shape-table__loc';
    if (shape.type === 'polygon') {
      infoTd.textContent = `${shape.latlngs?.length ?? 0} pts`;
    } else {
      infoTd.textContent = this._formatCoord(shape.centerLat, shape.centerLng);
    }

    // Color swatch
    const colorTd = document.createElement('td');
    colorTd.className = 'shape-table__color';
    const swatch = document.createElement('span');
    swatch.className = 'shape-table__swatch';
    swatch.style.background = shape.color;
    colorTd.appendChild(swatch);

    // Visibility toggle
    const visTd = document.createElement('td');
    visTd.className = 'shape-table__vis';
    const eyeBtn = document.createElement('button');
    eyeBtn.className = 'shape-table__eye';
    eyeBtn.title = shape.visible ? 'Hide' : 'Show';
    eyeBtn.innerHTML = shape.visible ? this._eyeOpenSvg() : this._eyeClosedSvg();
    eyeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._shapeManager.setVisible(shape.id, !shape.visible);
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
      this._toggleDropdown(dotsBtn, shape);
    });
    dotsTd.appendChild(dotsBtn);

    tr.appendChild(nameTd);
    tr.appendChild(infoTd);
    tr.appendChild(colorTd);
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

  _toggleDropdown(anchorBtn, shape) {
    if (this._dropdown.dataset.activeId === shape.id && this._dropdown.style.display !== 'none') {
      this._hideDropdown();
      return;
    }

    this._dropdown.innerHTML = '';
    this._dropdown.dataset.activeId = shape.id;

    const editBtn = document.createElement('button');
    editBtn.className = 'shape-dots-menu__item';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => {
      this._hideDropdown();
      if (shape.type === 'polygon') {
        this._polygonPopup?.open(shape.id, { isNew: false });
      } else {
        this._shapePopup?.open(shape.id, { isNew: false });
      }
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'shape-dots-menu__item shape-dots-menu__item--danger';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => {
      this._hideDropdown();
      this._shapeManager.removeShape(shape.id);
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

  // ─── Drag-and-drop reorder ───────────────────────────────────

  _initDragDrop(tbody) {
    let dragSrcId = null;

    tbody.addEventListener('dragstart', (e) => {
      dragSrcId = e.target.closest('tr')?.dataset?.id ?? null;
      e.target.closest('tr')?.classList.add('dragging');
    });

    tbody.addEventListener('dragend', (e) => {
      e.target.closest('tr')?.classList.remove('dragging');
    });

    tbody.addEventListener('dragover', (e) => {
      e.preventDefault();
      const target = e.target.closest('tr');
      if (target) {
        tbody.querySelectorAll('tr').forEach((r) => r.classList.remove('drag-over'));
        target.classList.add('drag-over');
      }
    });

    tbody.addEventListener('dragleave', () => {
      tbody.querySelectorAll('tr').forEach((r) => r.classList.remove('drag-over'));
    });

    tbody.addEventListener('drop', (e) => {
      e.preventDefault();
      tbody.querySelectorAll('tr').forEach((r) => r.classList.remove('drag-over'));
      const targetRow = e.target.closest('tr');
      if (!targetRow || !dragSrcId) return;
      const targetId = targetRow.dataset.id;
      if (dragSrcId === targetId) return;

      const rows = Array.from(tbody.querySelectorAll('tr'));
      const srcRow = tbody.querySelector(`tr[data-id="${dragSrcId}"]`);
      const tgtRow = tbody.querySelector(`tr[data-id="${targetId}"]`);
      if (!srcRow || !tgtRow) return;

      if (rows.indexOf(srcRow) < rows.indexOf(tgtRow)) {
        tbody.insertBefore(srcRow, tgtRow.nextSibling);
      } else {
        tbody.insertBefore(srcRow, tgtRow);
      }

      const newOrder = Array.from(tbody.querySelectorAll('tr')).map((r) => r.dataset.id);
      this._shapeManager.reorderShapes(newOrder);
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────

  _formatCoord(lat, lng) {
    if (!this._coordinateService) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    const fmt = this._coordinateService.getCurrentFormat();
    return this._coordinateService.formatCoordinate(lat, lng, fmt);
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
