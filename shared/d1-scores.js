(() => {
  'use strict';

  const baseScores = window.EscapeeScores;
  if (!baseScores || window.__escapeeD1Scores) return;
  window.__escapeeD1Scores = true;

  const slug = location.pathname.split('/').filter(Boolean).at(-1) || 'game';
  const leaderboardEndpoint = `/api/scores?game=${encodeURIComponent(slug)}`;
  const originalSubmit = baseScores.submit.bind(baseScores);
  const originalShow = baseScores.show.bind(baseScores);
  let lastSubmission = null;
  let lastSubmissionAt = 0;

  function clearLegacyScoreStorage() {
    try {
      const remove = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index) || '';
        if (
          key === 'escapee:arcade-signature:v1' ||
          /escapee:.*:leaderboard/i.test(key) ||
          /escapee:.*:(best|high-?score|score-records?)/i.test(key)
        ) remove.push(key);
      }
      remove.forEach(key => localStorage.removeItem(key));
    } catch {}
  }

  clearLegacyScoreStorage();

  const getUi = () => window.__escapeeUniversalRuntime?.scoreUi || null;
  const normalizeSignature = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);

  function renderLeaderboard(container, entries, highlightId = null) {
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
  }

  async function requestJson(url, options = {}) {
    const response = await fetch(url, {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { accept: 'application/json', ...(options.headers || {}) },
      ...options
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || 'The score service is unavailable.');
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  async function fetchLeaderboard() {
    const data = await requestJson(leaderboardEndpoint);
    return Array.isArray(data.entries) ? data.entries : [];
  }

  async function checkQualification(score) {
    return requestJson(`${leaderboardEndpoint}&action=qualify&score=${encodeURIComponent(score)}`);
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
      ui.rows.textContent = '';
      const message = document.createElement('p');
      message.className = 'escapee-score-empty';
      message.textContent = error.message || 'Could not load high scores.';
      ui.rows.appendChild(message);
      return [];
    }
  }

  function preparePostScoreActions() {
    const ui = getUi();
    if (!ui) return;
    ui.done.textContent = 'Play Again';
    ui.done.dataset.scoreAction = 'play-again';
    let home = ui.board.querySelector('[data-score-action="home"]');
    if (!home) {
      home = document.createElement('button');
      home.type = 'button';
      home.dataset.scoreAction = 'home';
      home.textContent = 'Home';
      ui.board.appendChild(home);
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
      const data = await requestJson('/api/scores', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ game: slug, signature, score, display: ui.current.display, label: ui.current.label })
      });
      ui.current = null;
      ui.entry.hidden = true;
      ui.board.hidden = false;
      ui.title.textContent = 'High Scores';
      ui.kicker.textContent = slug.replace(/-/g, ' ');
      renderLeaderboard(ui.rows, data.entries || [], data.entry?.id || null);
      preparePostScoreActions();
      ui.done.focus();
      window.dispatchEvent(new CustomEvent('escapee:score-saved', { detail: { ...data.entry, saved: true, slug } }));
    } catch (error) {
      if (error.status === 409 && error.data?.entries) {
        ui.current = null;
        ui.entry.hidden = true;
        ui.board.hidden = false;
        ui.title.textContent = 'High Scores';
        ui.kicker.textContent = 'Cutoff changed before save';
        renderLeaderboard(ui.rows, error.data.entries);
        preparePostScoreActions();
        return;
      }
      ui.input.readOnly = false;
      ui.save.disabled = false;
      ui.notice.textContent = `${error.message || 'Could not save this score.'} Nothing was recorded.`;
      ui.input.focus();
    }
  }

  async function submitQualifiedScore(rawScore, options = {}) {
    const score = Number(options.sortValue ?? rawScore);
    if (!Number.isSafeInteger(score) || score < 0) return false;

    const now = Date.now();
    if (lastSubmission === score && now - lastSubmissionAt < 1500) return false;
    lastSubmission = score;
    lastSubmissionAt = now;
    clearLegacyScoreStorage();

    try {
      const result = await checkQualification(score);
      if (!result.qualifies) {
        window.dispatchEvent(new CustomEvent('escapee:score-not-qualified', { detail: result }));
        return false;
      }
      originalSubmit(rawScore, options);
      const ui = getUi();
      if (ui) {
        ui.input.value = '';
        ui.save.disabled = true;
        ui.kicker.textContent = result.rank ? `Provisional rank #${result.rank}` : String(options.label || 'Top 10 score');
        ui.notice.textContent = 'Enter exactly 3 letters or numbers. Saved entries cannot be changed.';
      }
      return true;
    } catch (error) {
      window.dispatchEvent(new CustomEvent('escapee:score-service-error', { detail: { message: error.message, score, slug } }));
      return false;
    }
  }

  window.EscapeeScores = {
    submit: submitQualifiedScore,
    getLeaderboard: fetchLeaderboard,
    show() {
      originalShow();
      queueMicrotask(() => refreshLeaderboard());
    }
  };

  document.addEventListener('click', event => {
    const action = event.target.closest?.('[data-score-action]')?.dataset.scoreAction;
    if (action === 'save') {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      submitSignedScore();
      return;
    }
    if (action === 'play-again') {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const ui = getUi();
      if (ui) ui.overlay.hidden = true;
      if (window.EscapeeGame?.restart) window.EscapeeGame.restart();
      else document.querySelector('#restartButton,#restartBtn,#restart,[data-action="restart"]')?.click();
      return;
    }
    if (action === 'home') {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      location.assign('/');
      return;
    }
    if (event.target.closest?.('[data-escapee-action="scores"]')) {
      setTimeout(() => refreshLeaderboard(), 0);
    }
  }, true);
})();
