(() => {
  'use strict';
  if (window.__escapeeUniversalRuntime) return;

  const runtime = window.__escapeeUniversalRuntime = {
    paused: false,
    active: false,
    pauseStarted: 0,
    pausedTotal: 0,
    rafCallbacks: new Map(),
    nextRafId: 1,
    nativeRaf: window.requestAnimationFrame.bind(window),
    nativeCancelRaf: window.cancelAnimationFrame.bind(window),
    scoreUi: null,
    lastScore: null,
    lastScoreAt: 0
  };

  const nativePerformanceNow = performance.now.bind(performance);
  const virtualNow = () => nativePerformanceNow() - runtime.pausedTotal - (runtime.paused ? nativePerformanceNow() - runtime.pauseStarted : 0);
  const slug = location.pathname.split('/').filter(Boolean).at(-1) || 'game';
  const scoreKey = `escapee:${slug}:leaderboard:v1`;
  const signatureKey = 'escapee:arcade-signature:v1';
  const scoreLimit = 10;

  const safeRead = (key, fallback) => {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  };

  const safeWrite = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  };

  const normalizeSignature = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  const getLeaderboard = () => {
    const entries = safeRead(scoreKey, []);
    if (!Array.isArray(entries)) return [];
    return entries
      .filter(entry => entry && Number.isFinite(Number(entry.score)) && /^[A-Z0-9]{3}$/.test(entry.signature || ''))
      .sort((a, b) => Number(b.score) - Number(a.score) || Number(a.createdAt || 0) - Number(b.createdAt || 0))
      .slice(0, scoreLimit);
  };

  window.requestAnimationFrame = callback => {
    const id = runtime.nextRafId++;
    const run = () => {
      if (!runtime.rafCallbacks.has(id)) return;
      if (runtime.paused) {
        runtime.rafCallbacks.set(id, runtime.nativeRaf(run));
        return;
      }
      runtime.rafCallbacks.delete(id);
      callback(virtualNow());
    };
    runtime.rafCallbacks.set(id, runtime.nativeRaf(run));
    return id;
  };

  window.cancelAnimationFrame = id => {
    const nativeId = runtime.rafCallbacks.get(id);
    if (nativeId !== undefined) runtime.nativeCancelRaf(nativeId);
    runtime.rafCallbacks.delete(id);
  };

  const clearInputs = () => {
    for (const code of ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','Space']) {
      window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true }));
    }
    window.dispatchEvent(new Event('blur'));
  };

  const setPaused = value => {
    if (runtime.paused === value) return;
    runtime.paused = value;
    if (value) {
      runtime.pauseStarted = nativePerformanceNow();
      clearInputs();
      window.EscapeeGame?.pause?.();
      window.dispatchEvent(new CustomEvent('escapee:pause'));
    } else {
      runtime.pausedTotal += nativePerformanceNow() - runtime.pauseStarted;
      window.EscapeeGame?.resume?.();
      window.dispatchEvent(new CustomEvent('escapee:resume'));
    }
  };

  const statusIsActive = () => {
    const status = window.EscapeeGame?.getStatus?.();
    if (status) return ['playing','paused','between-rounds'].includes(status);
    return runtime.active;
  };

  const trySoundToggle = () => {
    const candidates = ['#soundBtn','#sound-button','#sound','[aria-label*="sound" i]'];
    const target = candidates.map(selector => document.querySelector(selector)).find(Boolean);
    target?.click();
  };

  const updateViewport = () => {
    const viewport = window.visualViewport;
    document.documentElement.style.setProperty('--escapee-vh', `${viewport?.height || window.innerHeight}px`);
    document.documentElement.style.setProperty('--escapee-vw', `${viewport?.width || window.innerWidth}px`);
  };

  const renderLeaderboard = (container, entries, highlightId = null) => {
    container.textContent = '';
    if (!entries.length) {
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
      const initials = document.createElement('strong');
      initials.textContent = entry.signature;
      const value = document.createElement('span');
      value.textContent = entry.display || Number(entry.score).toLocaleString();
      row.append(rank, initials, value);
      container.appendChild(row);
    });
  };

  const showLeaderboard = (highlightId = null) => {
    const ui = runtime.scoreUi;
    if (!ui) return;
    ui.entry.hidden = true;
    ui.board.hidden = false;
    ui.title.textContent = 'High Scores';
    ui.kicker.textContent = slug.replace(/-/g, ' ');
    renderLeaderboard(ui.rows, getLeaderboard(), highlightId);
    ui.overlay.hidden = false;
    ui.pauseButton.hidden = true;
    clearInputs();
    ui.done.focus();
  };

  const closeScores = () => {
    const ui = runtime.scoreUi;
    if (!ui) return;
    ui.overlay.hidden = true;
    ui.entry.hidden = false;
    ui.board.hidden = true;
    ui.pauseButton.hidden = false;
    ui.pauseButton.focus();
  };

  const submitScore = (rawScore, options = {}) => {
    const score = Number(options.sortValue ?? rawScore);
    if (!Number.isFinite(score)) return false;

    const now = Date.now();
    if (runtime.lastScore === score && now - runtime.lastScoreAt < 1500) return false;
    runtime.lastScore = score;
    runtime.lastScoreAt = now;

    const ui = runtime.scoreUi;
    if (!ui) {
      addEventListener('DOMContentLoaded', () => submitScore(rawScore, options), { once: true });
      return true;
    }

    runtime.active = false;
    clearInputs();
    ui.current = {
      score,
      display: String(options.display ?? Number(rawScore).toLocaleString()),
      label: String(options.label || 'Final score')
    };
    ui.kicker.textContent = ui.current.label;
    ui.title.textContent = 'Sign Your Score';
    ui.value.textContent = ui.current.display;
    ui.entry.hidden = false;
    ui.board.hidden = true;
    ui.overlay.hidden = false;
    ui.pauseButton.hidden = true;
    ui.input.value = normalizeSignature(safeRead(signatureKey, ''));
    ui.save.disabled = ui.input.value.length !== 3;
    ui.notice.textContent = 'Use exactly 3 letters or numbers.';
    ui.input.focus();
    ui.input.select();
    window.dispatchEvent(new CustomEvent('escapee:score-prompt', { detail: { score, slug } }));
    return true;
  };

  window.EscapeeScores = {
    submit: submitScore,
    getLeaderboard,
    show: () => showLeaderboard(),
    clear() {
      try { localStorage.removeItem(scoreKey); } catch {}
    }
  };

  const mount = () => {
    updateViewport();
    document.documentElement.classList.add('escapee-universal-game');
    document.body.classList.add('escapee-universal-game-body');

    const button = document.createElement('button');
    button.className = 'escapee-pause-button';
    button.type = 'button';
    button.setAttribute('aria-label', 'Pause game');
    button.textContent = 'Ⅱ';

    const overlay = document.createElement('div');
    overlay.className = 'escapee-pause-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `<section class="escapee-pause-menu" role="dialog" aria-modal="true" aria-labelledby="escapee-pause-title">
      <h2 id="escapee-pause-title">Paused</h2>
      <button type="button" data-escapee-action="resume">Resume</button>
      <button type="button" data-escapee-action="restart">Restart</button>
      <button type="button" data-escapee-action="sound">Sound</button>
      <button type="button" data-escapee-action="scores">High Scores</button>
      <button type="button" data-escapee-action="fullscreen">Full screen</button>
      <button type="button" data-escapee-action="home">Home</button>
    </section>`;

    const confirm = document.createElement('div');
    confirm.className = 'escapee-confirm-overlay';
    confirm.hidden = true;
    confirm.innerHTML = `<section class="escapee-confirm-menu" role="alertdialog" aria-modal="true" aria-labelledby="escapee-confirm-title">
      <h2 id="escapee-confirm-title">Leave this run?</h2>
      <p>Your current run will end.</p>
      <div><button type="button" data-confirm="cancel">Keep playing</button><button type="button" data-confirm="leave">Home</button></div>
    </section>`;

    const scoreOverlay = document.createElement('div');
    scoreOverlay.className = 'escapee-score-overlay';
    scoreOverlay.hidden = true;
    scoreOverlay.innerHTML = `<section class="escapee-score-menu" role="dialog" aria-modal="true" aria-labelledby="escapee-score-title">
      <p class="escapee-score-kicker"></p>
      <h2 id="escapee-score-title">Sign Your Score</h2>
      <div class="escapee-score-entry">
        <strong class="escapee-score-value"></strong>
        <label for="escapee-score-signature">Three-character signature</label>
        <input id="escapee-score-signature" type="text" maxlength="3" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-describedby="escapee-score-notice">
        <p id="escapee-score-notice" class="escapee-score-notice">Use exactly 3 letters or numbers.</p>
        <button type="button" data-score-action="save" disabled>Save Score</button>
        <button type="button" class="escapee-score-skip" data-score-action="skip">Skip</button>
      </div>
      <div class="escapee-score-board" hidden>
        <div class="escapee-score-rows"></div>
        <button type="button" data-score-action="done">Continue</button>
      </div>
    </section>`;

    document.body.append(button, overlay, confirm, scoreOverlay);

    runtime.scoreUi = {
      overlay: scoreOverlay,
      pauseButton: button,
      kicker: scoreOverlay.querySelector('.escapee-score-kicker'),
      title: scoreOverlay.querySelector('#escapee-score-title'),
      entry: scoreOverlay.querySelector('.escapee-score-entry'),
      board: scoreOverlay.querySelector('.escapee-score-board'),
      value: scoreOverlay.querySelector('.escapee-score-value'),
      input: scoreOverlay.querySelector('#escapee-score-signature'),
      notice: scoreOverlay.querySelector('.escapee-score-notice'),
      save: scoreOverlay.querySelector('[data-score-action="save"]'),
      done: scoreOverlay.querySelector('[data-score-action="done"]'),
      rows: scoreOverlay.querySelector('.escapee-score-rows'),
      current: null
    };

    const openPause = () => {
      if (!overlay.hidden || !scoreOverlay.hidden) return;
      setPaused(true);
      overlay.hidden = false;
      button.hidden = true;
      overlay.querySelector('[data-escapee-action="resume"]').focus();
    };
    const closePause = () => {
      overlay.hidden = true;
      button.hidden = false;
      setPaused(false);
      button.focus();
    };

    button.addEventListener('click', openPause);
    overlay.addEventListener('click', async event => {
      const action = event.target.closest('[data-escapee-action]')?.dataset.escapeeAction;
      if (!action) return;
      if (action === 'resume') return closePause();
      if (action === 'restart') {
        const ok = !statusIsActive() || window.confirm('Restart this run?');
        if (!ok) return;
        window.EscapeeGame?.restart?.();
        const nativeRestart = document.querySelector('#restartBtn,#restart,#restart-top-button,[data-action="restart"]');
        if (!window.EscapeeGame?.restart && nativeRestart) nativeRestart.click();
        runtime.active = true;
        return closePause();
      }
      if (action === 'sound') {
        window.EscapeeGame?.setMuted?.(false);
        trySoundToggle();
        return;
      }
      if (action === 'scores') {
        overlay.hidden = true;
        showLeaderboard();
        return;
      }
      if (action === 'fullscreen') {
        try {
          if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
          else await document.exitFullscreen?.();
        } catch {}
        return;
      }
      if (action === 'home') {
        if (!statusIsActive()) location.assign('/');
        else {
          confirm.hidden = false;
          confirm.querySelector('[data-confirm="cancel"]').focus();
        }
      }
    });

    confirm.addEventListener('click', event => {
      const choice = event.target.closest('[data-confirm]')?.dataset.confirm;
      if (choice === 'leave') location.assign('/');
      if (choice === 'cancel') {
        confirm.hidden = true;
        overlay.querySelector('[data-escapee-action="resume"]').focus();
      }
    });

    runtime.scoreUi.input.addEventListener('input', () => {
      const normalized = normalizeSignature(runtime.scoreUi.input.value);
      if (runtime.scoreUi.input.value !== normalized) runtime.scoreUi.input.value = normalized;
      runtime.scoreUi.save.disabled = normalized.length !== 3;
    });

    scoreOverlay.addEventListener('click', event => {
      const action = event.target.closest('[data-score-action]')?.dataset.scoreAction;
      if (!action) return;
      if (action === 'skip' || action === 'done') {
        closeScores();
        return;
      }
      if (action !== 'save' || !runtime.scoreUi.current) return;
      const signature = normalizeSignature(runtime.scoreUi.input.value);
      if (signature.length !== 3) {
        runtime.scoreUi.notice.textContent = 'Enter all 3 characters before saving.';
        runtime.scoreUi.input.focus();
        return;
      }
      const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        signature,
        score: runtime.scoreUi.current.score,
        display: runtime.scoreUi.current.display,
        createdAt: Date.now()
      };
      const entries = [...getLeaderboard(), entry]
        .sort((a, b) => Number(b.score) - Number(a.score) || Number(a.createdAt || 0) - Number(b.createdAt || 0))
        .slice(0, scoreLimit);
      const saved = safeWrite(scoreKey, entries);
      safeWrite(signatureKey, signature);
      runtime.scoreUi.notice.textContent = saved ? 'Score saved.' : 'This browser could not save the leaderboard.';
      window.dispatchEvent(new CustomEvent('escapee:score-saved', { detail: { ...entry, saved, slug } }));
      showLeaderboard(entry.id);
    });

    addEventListener('keydown', event => {
      if (!scoreOverlay.hidden) {
        if (event.code === 'Escape') {
          event.preventDefault();
          closeScores();
        }
        return;
      }
      if (event.code !== 'Escape' && event.code !== 'KeyP') return;
      if (!confirm.hidden && event.code === 'Escape') {
        confirm.hidden = true;
        return;
      }
      event.preventDefault();
      overlay.hidden ? openPause() : closePause();
    });

    const markActive = event => {
      if (event.target.closest?.('button,input,[role="button"]')) runtime.active = true;
    };
    document.addEventListener('pointerdown', markActive, true);
    document.addEventListener('keydown', event => {
      if (['Enter','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD'].includes(event.code)) runtime.active = true;
    }, true);

    const backgroundPause = () => {
      if (!document.hidden || !scoreOverlay.hidden) return;
      setPaused(true);
      overlay.hidden = false;
      button.hidden = true;
    };
    document.addEventListener('visibilitychange', backgroundPause);
    addEventListener('pagehide', backgroundPause);
    addEventListener('blur', () => { if (statusIsActive()) backgroundPause(); });
    addEventListener('resize', updateViewport);
    addEventListener('orientationchange', () => setTimeout(updateViewport, 100));
    window.visualViewport?.addEventListener('resize', updateViewport);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
