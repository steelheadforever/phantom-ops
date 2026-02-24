export class StudyPanel {
  constructor() {
    this._sideMenu = null;
    this._boldfacePanel = null;
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
    opsLimits.className = 'panel-section-btn panel-section-btn--disabled';
    opsLimits.disabled = true;
    opsLimits.innerHTML = 'OPS LIMITS<span class="side-menu__btn-tag">SOON</span>';

    btnGroup.appendChild(boldface);
    btnGroup.appendChild(opsLimits);

    el.appendChild(back);
    el.appendChild(btnGroup);

    return el;
  }
}
