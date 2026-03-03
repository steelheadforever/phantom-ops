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

export class BoldfacePracticeOverlay {
  constructor() {
    this._cards = [];
    this._pos = 0;
    this._hinted = false;

    this._el = null;
    this._progressEl = null;
    this._conditionEl = null;
    this._stepsEl = null;
    this._navRow = null;
    this._prevBtn = null;
    this._nextBtn = null;
    this._completeRow = null;

    this._mount();
  }

  // ─── public ──────────────────────────────────────────────────────────────

  open() {
    this._cards = shuffle(BOLDFACE);
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
    title.textContent = 'BOLDFACE PRACTICE';

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

    const condLabel = document.createElement('div');
    condLabel.className = 'fc-label';
    condLabel.textContent = 'CONDITION';

    const condText = document.createElement('div');
    condText.className = 'fc-condition';
    this._conditionEl = condText;

    const stepsEl = document.createElement('div');
    stepsEl.className = 'fc-practice-steps';
    this._stepsEl = stepsEl;

    body.appendChild(condLabel);
    body.appendChild(condText);
    body.appendChild(stepsEl);

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
    this._prevBtn = prevBtn;

    const hintBtn = document.createElement('button');
    hintBtn.className = 'fc-btn fc-btn--hint';
    hintBtn.textContent = 'HINT';
    hintBtn.addEventListener('click', () => this._onHint());

    const nextBtn = document.createElement('button');
    nextBtn.className = 'fc-btn fc-btn--nav';
    nextBtn.textContent = 'NEXT →';
    nextBtn.addEventListener('click', () => this._onNext());
    this._nextBtn = nextBtn;

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
    this._conditionEl.textContent = card.condition;
    this._hinted = false;

    // Build input rows
    this._stepsEl.innerHTML = '';
    card.steps.forEach((step, i) => {
      const row = document.createElement('div');
      row.className = 'fc-practice-step';

      const num = document.createElement('span');
      num.className = 'fc-step-num';
      num.textContent = `${i + 1}.`;

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'fc-practice-input';
      input.autocomplete = 'off';
      input.autocorrect = 'off';
      input.autocapitalize = 'characters';
      input.spellcheck = false;
      input.dataset.expected = step;
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this._onNext();
        e.stopPropagation();
      });

      row.appendChild(num);
      row.appendChild(input);
      this._stepsEl.appendChild(row);
    });

    this._navRow.style.display = '';
    this._completeRow.style.display = 'none';

    // Focus first input after paint
    const firstInput = this._stepsEl.querySelector('.fc-practice-input');
    if (firstInput) setTimeout(() => firstInput.focus(), 0);
  }

  _getInputs() {
    return Array.from(this._stepsEl.querySelectorAll('.fc-practice-input'));
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
      // Clear and re-focus first card
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
    this._cards = shuffle(BOLDFACE);
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
