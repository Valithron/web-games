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
    nativeCancelRaf: window.cancelAnimationFrame.bind(window)
  };

  const nativePerformanceNow = performance.now.bind(performance);
  const virtualNow = () => nativePerformanceNow() - runtime.pausedTotal - (runtime.paused ? nativePerformanceNow() - runtime.pauseStarted : 0);

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

    document.body.append(button, overlay, confirm);

    const openPause = () => {
      if (!overlay.hidden) return;
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

    addEventListener('keydown', event => {
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
      if (!document.hidden) return;
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
