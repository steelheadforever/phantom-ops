const OPS_LIMITS = [
  {
    title: 'TORQUE LIMITS',
    lines: [
      { prompt: 'NORMAL RANGE:', answer: '0 - 104%' },
      { prompt: 'MAX:', answer: '107.8%' },
    ],
  },
  {
    title: 'RPM',
    lines: [
      { prompt: 'MIN:', answer: '64%' },
      { prompt: 'NORMAL RANGE:', answer: '65 - 100.5%' },
      { prompt: 'MAX:', answer: '105.5%' },
    ],
  },
  {
    title: 'EGT',
    lines: [
      { prompt: 'MIN:', answer: '300 °C' },
      { prompt: 'NORMAL IN-FLIGHT RANGE:', answer: '350 - 650 °C' },
      { prompt: 'MAX:', answer: '675 °C' },
    ],
  },
  {
    title: 'OIL TEMPERATURE',
    lines: [
      { prompt: 'NORMAL RANGE (TAKEOFF & FLIGHT):', answer: '70 - 115 °C' },
      { prompt: 'MAX:', answer: '119 °C' },
    ],
  },
  {
    title: 'OIL PRESSURE',
    lines: [
      { prompt: 'MIN:', answer: '44 psi' },
      { prompt: 'NORMAL OPERATING RANGE:', answer: '50 - 120 psi' },
      { prompt: 'MAX:', answer: '126 psi' },
    ],
  },
  {
    title: 'OPERATING SPEEDS',
    lines: [
      { prompt: 'Vne - NEVER EXCEED:', answer: '230 KIAS' },
      { prompt: 'MAX LANDING GEAR IN TRANSIT:', answer: '135 KIAS' },
      { prompt: 'MAX LANDING GEAR EXTENDED:', answer: '160 KIAS' },
    ],
  },
  {
    title: 'MISCELLANEOUS',
    lines: [
      { prompt: 'ATLC STEADY CROSSWIND COMPONENT ALL CONFIGS:', answer: '20 kts' },
      { prompt: 'TOTAL CROSSWIND COMPONENT (INCLUDING GUSTS):', answer: '25 kts' },
      { prompt: 'MAX TAILWIND:', answer: '10 kts' },
      { prompt: 'MAX TOTAL WINDS (TAKEOFF/LANDING):', answer: '30 kts' },
      { prompt: 'MAX GUST FACTOR (TAKEOFF/LANDING):', answer: '20 kts' },
      { prompt: 'ATLC MAX LAND WEIGHT - NORM/EMER:', answer: '10,500 lbs/11,700 lbs' },
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

export class OpsLimitsFlashcardOverlay {
  constructor() {
    this._cards = [];
    this._pos = 0;
    this._state = 'question'; // 'question' | 'answer'

    // DOM refs
    this._el = null;
    this._progressEl = null;
    this._titleEl = null;
    this._linesEl = null;
    this._checkBtn = null;
    this._navRow = null;
    this._prevBtn = null;
    this._nextBtn = null;

    this._mount();
  }

  // ─── public ──────────────────────────────────────────────────────────────

  open() {
    this._cards = shuffle(OPS_LIMITS);
    this._pos = 0;
    this._state = 'question';
    this._render();
    this._el.classList.add('fc-overlay--active');
  }

  close() {
    this._el.classList.remove('fc-overlay--active');
  }

  // ─── private ─────────────────────────────────────────────────────────────

  _mount() {
    // Full-screen backdrop
    const el = document.createElement('div');
    el.className = 'fc-overlay';
    el.addEventListener('click', (e) => {
      if (e.target === el) this.close();
    });

    // Card container
    const card = document.createElement('div');
    card.className = 'fc-card';

    // — Header —
    const header = document.createElement('div');
    header.className = 'fc-header';

    const title = document.createElement('span');
    title.className = 'fc-title';
    title.textContent = 'OPS LIMITS FLASHCARDS';

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

    // — Body —
    const body = document.createElement('div');
    body.className = 'fc-body';

    const limitsLabel = document.createElement('div');
    limitsLabel.className = 'fc-label';
    limitsLabel.textContent = 'LIMITS';

    const titleEl = document.createElement('div');
    titleEl.className = 'fc-condition';
    this._titleEl = titleEl;

    const linesEl = document.createElement('div');
    linesEl.className = 'fc-ol-lines';
    this._linesEl = linesEl;

    body.appendChild(limitsLabel);
    body.appendChild(titleEl);
    body.appendChild(linesEl);

    // — Footer —
    const footer = document.createElement('div');
    footer.className = 'fc-footer';

    const checkBtn = document.createElement('button');
    checkBtn.className = 'fc-btn fc-btn--check';
    checkBtn.textContent = 'CHECK';
    checkBtn.addEventListener('click', () => this._onCheck());
    this._checkBtn = checkBtn;

    // Nav row (PREV / NEXT) — shown after CHECK
    const navRow = document.createElement('div');
    navRow.className = 'fc-nav-row';
    this._navRow = navRow;

    const prevBtn = document.createElement('button');
    prevBtn.className = 'fc-btn fc-btn--nav';
    prevBtn.textContent = '← PREV';
    prevBtn.addEventListener('click', () => this._onPrev());
    this._prevBtn = prevBtn;

    const nextBtn = document.createElement('button');
    nextBtn.className = 'fc-btn fc-btn--nav';
    nextBtn.textContent = 'NEXT →';
    nextBtn.addEventListener('click', () => this._onNext());
    this._nextBtn = nextBtn;

    navRow.appendChild(prevBtn);
    navRow.appendChild(nextBtn);

    footer.appendChild(checkBtn);
    footer.appendChild(navRow);

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(footer);
    el.appendChild(card);
    document.body.appendChild(el);

    this._el = el;
  }

  _onCheck() {
    this._state = 'answer';
    this._render();
  }

  _onPrev() {
    if (this._pos > 0) {
      this._pos--;
      this._state = 'question';
      this._render();
    }
  }

  _onNext() {
    if (this._pos < this._cards.length - 1) {
      this._pos++;
      this._state = 'question';
      this._render();
    }
  }

  _render() {
    const card = this._cards[this._pos];
    const isAnswer = this._state === 'answer';

    // Progress counter
    this._progressEl.textContent = `${this._pos + 1} / ${this._cards.length}`;

    // Card title
    this._titleEl.textContent = card.title;

    // Limit lines — rebuild on each render
    this._linesEl.innerHTML = '';
    card.lines.forEach(({ prompt, answer }) => {
      const line = document.createElement('div');
      line.className = 'fc-ol-line';

      const promptSpan = document.createElement('span');
      promptSpan.textContent = `${prompt} `;

      const valueSpan = document.createElement('span');
      if (isAnswer) {
        valueSpan.className = 'fc-ol-answer';
        valueSpan.textContent = answer;
      } else {
        valueSpan.className = 'fc-ol-blank';
        valueSpan.textContent = '____';
      }

      line.appendChild(promptSpan);
      line.appendChild(valueSpan);
      this._linesEl.appendChild(line);
    });

    // Footer: CHECK vs nav row
    this._checkBtn.style.display = isAnswer ? 'none' : '';
    this._navRow.style.display = isAnswer ? '' : 'none';

    if (isAnswer) {
      this._prevBtn.disabled = this._pos === 0;
      this._nextBtn.disabled = this._pos === this._cards.length - 1;
    }
  }
}
