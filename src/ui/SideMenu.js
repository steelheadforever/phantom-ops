export class SideMenu {
  constructor({ planPanel, studyPanel } = {}) {
    this._planPanel = planPanel;
    this._studyPanel = studyPanel;
    this.el = null;
    this.backdrop = null;
    this._isOpen = false;
    this._contentEl = null;
    this._rootView = null;

    // View stack — each entry is { name, el }
    this._viewStack = [];

    this._onKeyDown = this._onKeyDown.bind(this);
  }

  mount(root = document.body) {
    const backdrop = document.createElement('div');
    backdrop.className = 'side-menu__backdrop';
    backdrop.addEventListener('click', () => this.close());

    const menu = document.createElement('div');
    menu.className = 'side-menu';

    // Root view: fixed button list at the top
    const rootView = document.createElement('div');
    rootView.className = 'side-menu__root-view';

    // PLAN button — enabled
    const planBtn = document.createElement('button');
    planBtn.className = 'side-menu__btn side-menu__btn--enabled';
    planBtn.textContent = 'PLAN';
    planBtn.addEventListener('click', () => {
      if (this._planPanel) {
        this.pushView('plan', this._planPanel.el);
      }
    });

    // STUDY button — enabled
    const studyBtn = document.createElement('button');
    studyBtn.className = 'side-menu__btn side-menu__btn--enabled';
    studyBtn.textContent = 'STUDY';
    studyBtn.addEventListener('click', () => {
      if (this._studyPanel) {
        this.pushView('study', this._studyPanel.el);
      }
    });

    rootView.appendChild(planBtn);
    rootView.appendChild(studyBtn);

    // Content area for pushed views
    const contentEl = document.createElement('div');
    contentEl.className = 'side-menu__content';
    contentEl.style.display = 'none';

    menu.appendChild(rootView);
    menu.appendChild(contentEl);

    root.appendChild(backdrop);
    root.appendChild(menu);
    document.addEventListener('keydown', this._onKeyDown);

    this.el = menu;
    this.backdrop = backdrop;
    this._contentEl = contentEl;
    this._rootView = rootView;
    return this;
  }

  /**
   * Push a named view onto the stack, swapping the sidebar content area.
   * @param {string} name
   * @param {HTMLElement} el
   */
  pushView(name, el) {
    this._viewStack.push({ name, el });
    this._renderCurrentView();
  }

  /** Pop the top view off the stack, returning to the previous one. */
  popView() {
    if (this._viewStack.length === 0) return;
    this._viewStack.pop();
    this._renderCurrentView();
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

  // ─── private ────────────────────────────────────────────────────────────

  _renderCurrentView() {
    if (!this._contentEl || !this._rootView) return;

    if (this._viewStack.length === 0) {
      // Back to root
      this._contentEl.style.display = 'none';
      this._contentEl.innerHTML = '';
      this._rootView.style.display = '';
    } else {
      this._rootView.style.display = 'none';
      this._contentEl.style.display = 'flex';
      this._contentEl.innerHTML = '';
      const { el } = this._viewStack[this._viewStack.length - 1];
      this._contentEl.appendChild(el);
    }
  }

  _onKeyDown(e) {
    if (e.key === 'Escape' && this._isOpen) {
      if (this._viewStack.length > 0) {
        this.popView();
      } else {
        this.close();
      }
    }
  }
}
