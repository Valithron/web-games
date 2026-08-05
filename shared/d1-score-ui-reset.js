(() => {
  'use strict';
  document.addEventListener('click', event => {
    if (!event.target.closest?.('[data-escapee-action="scores"]')) return;
    queueMicrotask(() => {
      const ui = window.__escapeeUniversalRuntime?.scoreUi;
      if (!ui) return;
      ui.done.textContent = 'Continue';
      ui.done.dataset.scoreAction = 'done';
      ui.board.querySelector('[data-score-action="home"]')?.remove();
    });
  }, true);
})();
