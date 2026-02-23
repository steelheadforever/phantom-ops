// Shared singleton: ensures only one popup is open at a time.

let activePopup = null;
let activeBtn = null;

export function openPopup(popupEl, btnEl) {
  if (activePopup && activePopup !== popupEl) {
    activePopup.classList.remove('open');
    activeBtn?.classList.remove('active');
  }
  popupEl.classList.add('open');
  btnEl?.classList.add('active');
  activePopup = popupEl;
  activeBtn = btnEl;
}

export function closePopup(popupEl, btnEl) {
  popupEl.classList.remove('open');
  btnEl?.classList.remove('active');
  if (activePopup === popupEl) {
    activePopup = null;
    activeBtn = null;
  }
}

export function togglePopup(popupEl, btnEl) {
  if (popupEl.classList.contains('open')) {
    closePopup(popupEl, btnEl);
  } else {
    openPopup(popupEl, btnEl);
  }
}

// Close active popup on click-outside
document.addEventListener('click', (e) => {
  if (!activePopup) return;
  if (activePopup.contains(e.target)) return;
  if (activeBtn?.contains(e.target)) return;
  closePopup(activePopup, activeBtn);
}, true);
