(() => {
  'use strict';
  if (window.__escapeeScoreInputLock) return;
  window.__escapeeScoreInputLock = true;

  const CONTROL_CODES = [
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'
  ];
  let releasingControls = false;
  let observedOverlay = null;

  const getUi = () => window.__escapeeUniversalRuntime?.scoreUi || null;
  const overlayIsOpen = ui => Boolean(ui && !ui.overlay.hidden);

  function releaseGameControls() {
    releasingControls = true;
    try {
      for (const code of CONTROL_CODES) {
        const key = code === 'Space' ? ' ' : code;
        window.dispatchEvent(new KeyboardEvent('keyup', { code, key, bubbles: true }));
        document.dispatchEvent(new KeyboardEvent('keyup', { code, key, bubbles: true }));
      }
    } finally {
      releasingControls = false;
    }
  }

  function setInputValue(input, value, caret) {
    input.value = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
    const nextCaret = Math.max(0, Math.min(Number(caret) || 0, input.value.length));
    input.setSelectionRange?.(nextCaret, nextCaret);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function insertCharacter(input, character) {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const next = `${input.value.slice(0, start)}${character}${input.value.slice(end)}`;
    setInputValue(input, next, start + 1);
  }

  function removeCharacter(input, backward) {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;

    if (start !== end) {
      setInputValue(input, `${input.value.slice(0, start)}${input.value.slice(end)}`, start);
      return;
    }

    if (backward && start > 0) {
      setInputValue(input, `${input.value.slice(0, start - 1)}${input.value.slice(start)}`, start - 1);
      return;
    }

    if (!backward && start < input.value.length) {
      setInputValue(input, `${input.value.slice(0, start)}${input.value.slice(start + 1)}`, start);
    }
  }

  function stopGameKey(event, preventDefault = true) {
    if (preventDefault) event.preventDefault();
    event.stopImmediatePropagation();
  }

  function handleScoreKeydown(event) {
    if (releasingControls) return;
    const ui = getUi();
    if (!overlayIsOpen(ui)) return;

    const entryOpen = !ui.entry.hidden && !ui.input.readOnly;

    if (event.key === 'Tab') {
      stopGameKey(event, false);
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) {
      stopGameKey(event, false);
      return;
    }

    if (entryOpen) {
      ui.input.focus();

      if (/^[a-z0-9]$/i.test(event.key)) {
        stopGameKey(event);
        insertCharacter(ui.input, event.key.toUpperCase());
        return;
      }

      if (event.key === 'Backspace' || event.key === 'Delete') {
        stopGameKey(event);
        removeCharacter(ui.input, event.key === 'Backspace');
        return;
      }

      if (event.key === 'Enter') {
        stopGameKey(event);
        if (!ui.save.disabled) ui.save.click();
        return;
      }

      if (event.key === 'Escape') {
        stopGameKey(event);
        ui.overlay.querySelector('[data-score-action="skip"]')?.click();
        return;
      }

      stopGameKey(event);
      return;
    }

    const focusedButton = event.target?.closest?.('button');
    if ((event.key === 'Enter' || event.key === ' ') && focusedButton) {
      stopGameKey(event);
      focusedButton.click();
      return;
    }

    if (event.key === 'Escape') {
      stopGameKey(event);
      ui.done?.click();
      return;
    }

    stopGameKey(event);
  }

  function blockScoreKeyEvent(event) {
    if (releasingControls) return;
    const ui = getUi();
    if (!overlayIsOpen(ui)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  window.addEventListener('keydown', handleScoreKeydown, true);
  window.addEventListener('keypress', blockScoreKeyEvent, true);
  window.addEventListener('keyup', blockScoreKeyEvent, true);

  function observeScoreOverlay() {
    const ui = getUi();
    if (!ui?.overlay || ui.overlay === observedOverlay) return Boolean(ui?.overlay);
    observedOverlay = ui.overlay;
    let wasOpen = overlayIsOpen(ui);

    const observer = new MutationObserver(() => {
      const isOpen = overlayIsOpen(ui);
      if (isOpen !== wasOpen) {
        releaseGameControls();
        wasOpen = isOpen;
      }
    });
    observer.observe(ui.overlay, { attributes: true, attributeFilter: ['hidden'] });
    return true;
  }

  if (!observeScoreOverlay()) {
    document.addEventListener('DOMContentLoaded', observeScoreOverlay, { once: true });
  }
})();
