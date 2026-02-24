const BOLDFACE = [
  {
    condition: 'ENGINE FIRE/RPM DECAY ON THE GROUND',
    steps: ['CONDITION LEVER - AFT'],
  },
  {
    condition: 'TOTAL DOWNLINK FAILURE BELOW 2000 FEET AGL OR ON THE GROUND',
    steps: ['UPLINK/COMMAND LINK - OFF'],
  },
  {
    condition: 'LOSS OF CONTROL PREVENT',
    steps: ['LANDING CONFIGURATION - COMMAND', 'MTS - POSITION MODE'],
  },
  {
    condition: 'TAKEOFF ABORT',
    steps: ['THROTTLE - FULL REVERSE, AS REQUIRED', 'BRAKES - APPLY'],
  },
  {
    condition: 'LANDING PIO RECOVERY',
    steps: ['CONTROL STICK - AFT AND HOLD', 'THROTTLE - FULL FORWARD'],
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

export class FlashcardOverlay {
  constructor() {
    this._cards = [];
    this._pos = 0;
    this._state = 'question'; // 'question' | 'answer'

    // DOM refs
    this._el = null;
    this._progressEl = null;
    this._conditionEl = null;
    this._responseSection = null;
    this._stepsEl = null;
    this._checkBtn = null;
    this._navRow = null;
    this._prevBtn = null;
    this._nextBtn = null;

    this._mount();
  }

  // ─── public ──────────────────────────────────────────────────────────────

  open() {
    this._cards = shuffle(BOLDFACE);
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
    title.textContent = 'BOLDFACE FLASHCARDS';

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

    const condLabel = document.createElement('div');
    condLabel.className = 'fc-label';
    condLabel.textContent = 'CONDITION';

    const condText = document.createElement('div');
    condText.className = 'fc-condition';
    this._conditionEl = condText;

    // Response section (hidden until CHECK)
    const respSection = document.createElement('div');
    respSection.className = 'fc-response-section';
    this._responseSection = respSection;

    const respLabel = document.createElement('div');
    respLabel.className = 'fc-label fc-label--response';
    respLabel.textContent = 'RESPONSE';

    const stepsList = document.createElement('ol');
    stepsList.className = 'fc-steps';
    this._stepsEl = stepsList;

    respSection.appendChild(respLabel);
    respSection.appendChild(stepsList);

    body.appendChild(condLabel);
    body.appendChild(condText);
    body.appendChild(respSection);

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

    // Condition text
    this._conditionEl.textContent = card.condition;

    // Response section
    this._responseSection.style.display = isAnswer ? '' : 'none';
    if (isAnswer) {
      this._stepsEl.innerHTML = '';
      card.steps.forEach((step) => {
        const li = document.createElement('li');
        li.textContent = step;
        this._stepsEl.appendChild(li);
      });
    }

    // Footer: CHECK vs nav row
    this._checkBtn.style.display = isAnswer ? 'none' : '';
    this._navRow.style.display = isAnswer ? '' : 'none';

    if (isAnswer) {
      this._prevBtn.disabled = this._pos === 0;
      this._nextBtn.disabled = this._pos === this._cards.length - 1;
    }
  }
}
