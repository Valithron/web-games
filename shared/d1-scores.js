(() => {
  'use strict';

  const localScores = window.EscapeeScores;
  if (!localScores || window.__escapeeD1Scores) return;
  window.__escapeeD1Scores = true;

  const slug = location.pathname.split('/').filter(Boolean).at(-1) || 'game';
  const endpoint = `/api/scores?game=${encodeURIComponent(slug)}`;
  const signatureKey = 'escapee:arcade-signature:v1';
  const originalSubmit = localScores.submit.bind(localScores);
  const originalShow = localScores.show.bind(localScores);

  const getUi = () => window.__escapeeUniversalRuntime?.scoreUi || null;
  const normalizeSignature = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);

  const saveSignaturePreference = signature => {
    try { localStorage.setItem(signatureKey, JSON.stringify(signature)); } catch {}
  };

  const renderLeaderboard = (container, entries, highlightId = null) => {
    container.textContent = '';
    if (!Array.isArray(entries) || entries.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'escapee-score-empty';
      empty.textContent = 'No signed scores yet.';
      container.appendChild(empty);
      return;
    }

    entries.forEach((entry, index) => {
      const row = document.createElement('div');
      row.className = `escapee-score-row${entry.id === highlightId ? ' is-new' : ''}`;

      const rank = document.createElement('span');
      rank.textContent = String(index + 1).padStart(2, '0');

      const signature = document.createElement('strong');
      signature.textContent = entry.signature;

      const value = document.createElement('span');
      value.textContent = entry.display || Number(entry.score).toLocaleString();

      row.append(rank, signature, value);
      container.appendChild(row);
    });
  };

  async function fetchLeaderboard() {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { accept: 'application/json' },
      cache: 'no-store',
      credentials: 'same-origin'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Could not load high scores.');
    return Array.isArray(data.entries) ? data.entries : [];
  }

  async function refreshLeaderboard(highlightId = null) {
    const ui = getUi();
    if (!ui) return [];

    ui.entry.hidden = true;
    ui.board.hidden = false;
    ui.title.textContent = 'High Scores';
    ui.kicker.textContent = slug.replace(/-/g, ' ');
    ui.rows.innerHTML = '<p class="escapee-score-empty">Loading scores...</p>';

    try {
      const entries = await fetchLeaderboard();
      renderLeaderboard(ui.rows, entries, highlightId);
      return entries;
    } catch (error) {
      ui.rows.innerHTML = '';
      const message = document.createElement('p');
      message.className = 'escapee-score-empty';
      message.textContent = error.message || 'Could not load high scores.';
      ui.rows.appendChild(message);
      return [];
    }
  }

  async function submitSignedScore() {
    const ui = getUi();
    if (!ui?.current) return;

    const signature = normalizeSignature(ui.input.value);
    const score = Number(ui.current.score);
    if (signature.length !== 3) {
      ui.notice.textContent = 'Enter all 3 characters before saving.';
      ui.input.focus();
      return;
    }
    if (!Number.isSafeInteger(score) || score < 0) {
      ui.notice.textContent = 'This score cannot be submitted.';
      return;
    }

    ui.input.value = signature;
    ui.input.readOnly = true;
    ui.save.disabled = true;
    ui.notice.textContent = 'Saving permanently...';

    try {
      const response = await fetch('/api/scores', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json'
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          game: slug,
          signature,
          score,
          display: ui.current.display,
          label: ui.current.label
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not save this score.');

      saveSignaturePreference(signature);
      ui.current = null;
      ui.entry.hidden = true;
      ui.board.hidden = false;
      ui.title.textContent = 'High Scores';
      ui.kicker.textContent = slug.replace(/-/g, ' ');
      renderLeaderboard(ui.rows, data.entries || [], data.entry?.id || null);
      ui.done.focus();

      window.dispatchEvent(new CustomEvent('escapee:score-saved', {
        detail: { ...data.entry, saved: true, slug }
      }));
    } catch (error) {
      ui.input.readOnly = false;
      ui.save.disabled = false;
      ui.notice.textContent = `${error.message || 'Could not save this score.'} Nothing was recorded.`;
      ui.input.focus();
    }
  }

  window.EscapeeScores = {
    submit(score, options = {}) {
      return originalSubmit(score, options);
    },
    getLeaderboard: fetchLeaderboard,
    show() {
      originalShow();
      queueMicrotask(() => refreshLeaderboard());
    }
  };

  document.addEventListener('click', event => {
    const save = event.target.closest?.('[data-score-action="save"]');
    if (save) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      submitSignedScore();
      return;
    }

    if (event.target.closest?.('[data-escapee-action="scores"]')) {
      setTimeout(() => refreshLeaderboard(), 0);
    }
  }, true);
})();
