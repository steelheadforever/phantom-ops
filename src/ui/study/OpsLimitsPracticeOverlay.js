// Each line has: prompt (display text) + fields (array of {value, unit})
// value = what the user must type; unit = displayed after the input
const OPS_LIMITS_PRACTICE = [
  {
    title: 'TORQUE LIMITS',
    lines: [
      { prompt: 'NORMAL RANGE:', fields: [{ value: '0 - 104', unit: '%' }] },
      { prompt: 'MAX:', fields: [{ value: '107.8', unit: '%' }] },
    ],
  },
  {
    title: 'RPM',
    lines: [
      { prompt: 'MIN:', fields: [{ value: '64', unit: '%' }] },
      { prompt: 'NORMAL RANGE:', fields: [{ value: '65 - 100.5', unit: '%' }] },
      { prompt: 'MAX:', fields: [{ value: '105.5', unit: '%' }] },
    ],
  },
  {
    title: 'EGT',
    lines: [
      { prompt: 'MIN:', fields: [{ value: '300', unit: '°C' }] },
      { prompt: 'NORMAL IN-FLIGHT RANGE:', fields: [{ value: '350 - 650', unit: '°C' }] },
      { prompt: 'MAX:', fields: [{ value: '675', unit: '°C' }] },
    ],
  },
  {
    title: 'OIL TEMPERATURE',
    lines: [
      { prompt: 'NORMAL RANGE (TAKEOFF & FLIGHT):', fields: [{ value: '70 - 115', unit: '°C' }] },
      { prompt: 'MAX:', fields: [{ value: '119', unit: '°C' }] },
    ],
  },
  {
    title: 'OIL PRESSURE',
    lines: [
      { prompt: 'MIN:', fields: [{ value: '44', unit: 'psi' }] },
      { prompt: 'NORMAL OPERATING RANGE:', fields: [{ value: '50 - 120', unit: 'psi' }] },
      { prompt: 'MAX:', fields: [{ value: '126', unit: 'psi' }] },
    ],
  },
  {
    title: 'OPERATING SPEEDS',
    lines: [
      { prompt: 'Vne - NEVER EXCEED:', fields: [{ value: '230', unit: 'KIAS' }] },
      { prompt: 'MAX LANDING GEAR IN TRANSIT:', fields: [{ value: '135', unit: 'KIAS' }] },
      { prompt: 'MAX LANDING GEAR EXTENDED:', fields: [{ value: '160', unit: 'KIAS' }] },
    ],
  },
  {
    title: 'MISCELLANEOUS',
    lines: [
      { prompt: 'ATLC STEADY CROSSWIND COMPONENT ALL CONFIGS:', fields: [{ value: '20', unit: 'kts' }] },
      { prompt: 'TOTAL CROSSWIND COMPONENT (INCLUDING GUSTS):', fields: [{ value: '25', unit: 'kts' }] },
      { prompt: 'MAX TAILWIND:', fields: [{ value: '10', unit: 'kts' }] },
      { prompt: 'MAX TOTAL WINDS (TAKEOFF/LANDING):', fields: [{ value: '30', unit: 'kts' }] },
      { prompt: 'MAX GUST FACTOR (TAKEOFF/LANDING):', fields: [{ value: '20', unit: 'kts' }] },
      {
        prompt: 'ATLC MAX LAND WEIGHT - NORM/EMER:',
        fields: [{ value: '10,500', unit: 'lbs' }, { value: '11,700', unit: 'lbs' }],
      },
    ],
  },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class OpsLimitsPracticeOverlay {
  constructor() {
    this._cards = [];
    this._pos = 0;
    this._hinted = false;

    this._el = null;
    this._progressEl = null;
    this._titleEl = null;
    this._linesEl = null;
    this._bodyEl = null;
    this._navRow = null;
    this._completeRow = null;

    this._mount();
  }

  // ─── public ──────────────────────────────────────────────────────────────

  open() {
    this._cards = shuffle(OPS_LIMITS_PRACTICE);
    this._pos = 0;
    this._hinted = false;
    this._render();
    this._el.classList.add('fc-overlay--active');
  }

  close() {
    this._el.classList.remove('fc-overlay--active');
  }

  // ─── private ─────────────────────────────────────────────────────────────

  _mount() {
    const el = document.createElement('div');
    el.className = 'fc-overlay';
    el.addEventListener('click', (e) => { if (e.target === el) this.close(); });

    const card = document.createElement('div');
    card.className = 'fc-card';

    // Header
    const header = document.createElement('div');
    header.className = 'fc-header';

    const title = document.createElement('span');
    title.className = 'fc-title';
    title.textContent = 'OPS LIMITS PRACTICE';

    const progress = document.createElement('span');
    progress.className = 'fc-progress';
    this._progressEl = progress;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'fc-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => this.close());

    header.appendChild(title);
    header.appendChild(progress);
    header.appendChild(closeBtn);

    // Body
    const body = document.createElement('div');
    body.className = 'fc-body';
    this._bodyEl = body;

    const limLabel = document.createElement('div');
    limLabel.className = 'fc-label';
    limLabel.textContent = 'LIMITS';

    const titleEl = document.createElement('div');
    titleEl.className = 'fc-condition';
    this._titleEl = titleEl;

    const linesEl = document.createElement('div');
    linesEl.className = 'fc-pr-ol-lines';
    this._linesEl = linesEl;

    body.appendChild(limLabel);
    body.appendChild(titleEl);
    body.appendChild(linesEl);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'fc-footer';

    // Nav row: PREV | HINT | NEXT
    const navRow = document.createElement('div');
    navRow.className = 'fc-nav-row fc-nav-row--practice';
    this._navRow = navRow;

    const prevBtn = document.createElement('button');
    prevBtn.className = 'fc-btn fc-btn--nav';
    prevBtn.textContent = '← PREV';
    prevBtn.addEventListener('click', () => this._onPrev());

    const hintBtn = document.createElement('button');
    hintBtn.className = 'fc-btn fc-btn--hint';
    hintBtn.textContent = 'HINT';
    hintBtn.addEventListener('click', () => this._onHint());

    const nextBtn = document.createElement('button');
    nextBtn.className = 'fc-btn fc-btn--nav';
    nextBtn.textContent = 'NEXT →';
    nextBtn.addEventListener('click', () => this._onNext());

    navRow.appendChild(prevBtn);
    navRow.appendChild(hintBtn);
    navRow.appendChild(nextBtn);

    // Complete row: DONE | REPEAT
    const completeRow = document.createElement('div');
    completeRow.className = 'fc-complete-row';
    completeRow.style.display = 'none';
    this._completeRow = completeRow;

    const doneBtn = document.createElement('button');
    doneBtn.className = 'fc-btn fc-btn--done';
    doneBtn.textContent = 'DONE';
    doneBtn.addEventListener('click', () => this.close());

    const repeatBtn = document.createElement('button');
    repeatBtn.className = 'fc-btn fc-btn--repeat';
    repeatBtn.textContent = 'REPEAT';
    repeatBtn.addEventListener('click', () => this._onRepeat());

    completeRow.appendChild(doneBtn);
    completeRow.appendChild(repeatBtn);

    footer.appendChild(navRow);
    footer.appendChild(completeRow);

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(footer);
    el.appendChild(card);
    document.body.appendChild(el);

    this._el = el;
  }

  _render() {
    const card = this._cards[this._pos];
    this._progressEl.textContent = `${this._pos + 1} / ${this._cards.length}`;
    this._titleEl.textContent = card.title;
    this._hinted = false;

    this._linesEl.innerHTML = '';

    card.lines.forEach((line) => {
      const lineEl = document.createElement('div');
      lineEl.className = 'fc-pr-ol-line';

      const promptEl = document.createElement('div');
      promptEl.className = 'fc-pr-ol-prompt';
      promptEl.textContent = line.prompt;

      const fieldsEl = document.createElement('div');
      fieldsEl.className = 'fc-pr-ol-fields';

      line.fields.forEach(({ value, unit }) => {
        const fieldEl = document.createElement('span');
        fieldEl.className = 'fc-pr-ol-field';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'fc-practice-input fc-practice-input--sm';
        input.autocomplete = 'off';
        input.autocorrect = 'off';
        input.autocapitalize = 'off';
        input.spellcheck = false;
        input.dataset.expected = value;
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') this._onNext();
          e.stopPropagation();
        });

        const unitEl = document.createElement('span');
        unitEl.className = 'fc-pr-ol-unit';
        unitEl.textContent = unit;

        fieldEl.appendChild(input);
        fieldEl.appendChild(unitEl);
        fieldsEl.appendChild(fieldEl);
      });

      lineEl.appendChild(promptEl);
      lineEl.appendChild(fieldsEl);
      this._linesEl.appendChild(lineEl);
    });

    this._navRow.style.display = '';
    this._completeRow.style.display = 'none';

    // Focus first input after paint
    const firstInput = this._linesEl.querySelector('.fc-practice-input');
    if (firstInput) setTimeout(() => firstInput.focus(), 0);
  }

  _getInputs() {
    return Array.from(this._linesEl.querySelectorAll('.fc-practice-input'));
  }

  _onHint() {
    const inputs = this._getInputs();
    inputs.forEach((input) => {
      input.value = input.dataset.expected;
      input.classList.add('fc-practice-input--hinted');
    });
    this._hinted = true;
  }

  _onNext() {
    const isLast = this._pos === this._cards.length - 1;

    if (this._hinted) {
      if (isLast) {
        this._showComplete();
      } else {
        this._pos++;
        this._render();
      }
      return;
    }

    const inputs = this._getInputs();
    const allCorrect = inputs.every((input) => input.value.trim() === input.dataset.expected);

    if (allCorrect) {
      if (isLast) {
        this._showComplete();
      } else {
        this._pos++;
        this._render();
      }
    } else {
      this._buzz();
    }
  }

  _onPrev() {
    if (this._pos === 0) {
      const inputs = this._getInputs();
      inputs.forEach((input) => {
        input.value = '';
        input.classList.remove('fc-practice-input--hinted');
      });
      this._hinted = false;
      if (inputs[0]) inputs[0].focus();
    } else {
      this._pos--;
      this._render();
    }
  }

  _onRepeat() {
    this._cards = shuffle(OPS_LIMITS_PRACTICE);
    this._pos = 0;
    this._hinted = false;
    this._render();
  }

  _showComplete() {
    this._navRow.style.display = 'none';
    this._completeRow.style.display = '';
    this._progressEl.textContent = `${this._cards.length} / ${this._cards.length}`;
  }

  _buzz() {
    const inputs = this._getInputs();
    inputs.forEach((input) => { input.value = ''; });

    this._bodyEl.classList.remove('fc-buzz');
    void this._bodyEl.offsetWidth; // force reflow
    this._bodyEl.classList.add('fc-buzz');
    this._bodyEl.addEventListener('animationend', () => {
      this._bodyEl.classList.remove('fc-buzz');
    }, { once: true });

    if (inputs[0]) inputs[0].focus();
  }
}
