import { OpsLimitsFlashcardOverlay } from './OpsLimitsFlashcardOverlay.js';
import { OpsLimitsPracticeOverlay } from './OpsLimitsPracticeOverlay.js';

export class OpsLimitsPanel {
  constructor() {
    this._sideMenu = null;
    this._overlay = new OpsLimitsFlashcardOverlay();
    this._practiceOverlay = new OpsLimitsPracticeOverlay();
    this.el = this._build();
  }

  _build() {
    const el = document.createElement('div');
    el.className = 'study-panel';

    const back = document.createElement('button');
    back.className = 'panel-back-btn';
    back.innerHTML = '&#8592; OPS LIMITS';
    back.addEventListener('click', () => this._sideMenu?.popView());

    const btnGroup = document.createElement('div');
    btnGroup.className = 'panel-btn-group';

    const flashcards = document.createElement('button');
    flashcards.className = 'panel-section-btn';
    flashcards.textContent = 'FLASHCARDS';
    flashcards.addEventListener('click', () => {
      this._sideMenu?.close();
      this._overlay.open();
    });

    const practice = document.createElement('button');
    practice.className = 'panel-section-btn';
    practice.textContent = 'PRACTICE';
    practice.addEventListener('click', () => {
      this._sideMenu?.close();
      this._practiceOverlay.open();
    });

    btnGroup.appendChild(flashcards);
    btnGroup.appendChild(practice);

    el.appendChild(back);
    el.appendChild(btnGroup);

    return el;
  }
}
