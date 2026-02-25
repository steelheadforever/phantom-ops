export class StudyPanel {
  constructor() {
    this._sideMenu = null;
    this._boldfacePanel = null;
    this._opsLimitsPanel = null;
    this.el = this._build();
  }

  _build() {
    const el = document.createElement('div');
    el.className = 'study-panel';

    const back = document.createElement('button');
    back.className = 'panel-back-btn';
    back.innerHTML = '&#8592; STUDY';
    back.addEventListener('click', () => this._sideMenu?.popView());

    const btnGroup = document.createElement('div');
    btnGroup.className = 'panel-btn-group';

    const boldface = document.createElement('button');
    boldface.className = 'panel-section-btn';
    boldface.textContent = 'BOLDFACE';
    boldface.addEventListener('click', () => {
      if (this._boldfacePanel && this._sideMenu) {
        this._sideMenu.pushView('boldface', this._boldfacePanel.el);
      }
    });

    const opsLimits = document.createElement('button');
    opsLimits.className = 'panel-section-btn';
    opsLimits.textContent = 'OPS LIMITS';
    opsLimits.addEventListener('click', () => {
      if (this._opsLimitsPanel && this._sideMenu) {
        this._sideMenu.pushView('ops-limits', this._opsLimitsPanel.el);
      }
    });

    btnGroup.appendChild(boldface);
    btnGroup.appendChild(opsLimits);

    el.appendChild(back);
    el.appendChild(btnGroup);

    return el;
  }
}
