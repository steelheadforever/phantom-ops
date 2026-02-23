export class SideMenu {
  constructor() {
    this.el = null;
    this.backdrop = null;
    this._isOpen = false;
    this._onKeyDown = this._onKeyDown.bind(this);
  }

  mount(root = document.body) {
    const backdrop = document.createElement('div');
    backdrop.className = 'side-menu__backdrop';
    backdrop.addEventListener('click', () => this.close());

    const menu = document.createElement('div');
    menu.className = 'side-menu';

    const items = [
      { label: 'PLAN' },
      { label: 'STUDY' },
    ];

    items.forEach(({ label }) => {
      const btn = document.createElement('button');
      btn.className = 'side-menu__btn';
      btn.disabled = true;
      btn.innerHTML = `${label}<span class="side-menu__btn-tag">SOON</span>`;
      menu.appendChild(btn);
    });

    root.appendChild(backdrop);
    root.appendChild(menu);
    document.addEventListener('keydown', this._onKeyDown);

    this.el = menu;
    this.backdrop = backdrop;
    return this;
  }

  open() {
    this._isOpen = true;
    this.el?.classList.add('open');
    this.backdrop?.classList.add('open');
  }

  close() {
    this._isOpen = false;
    this.el?.classList.remove('open');
    this.backdrop?.classList.remove('open');
  }

  toggle() {
    this._isOpen ? this.close() : this.open();
  }

  _onKeyDown(e) {
    if (e.key === 'Escape' && this._isOpen) this.close();
  }
}
