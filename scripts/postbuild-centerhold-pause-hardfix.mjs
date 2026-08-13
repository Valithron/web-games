import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const runtimePath = path.join(ROOT, 'dist', 'shared', 'universal-game.js');
const centerholdPath = path.join(ROOT, 'dist', 'centerhold-defense', 'index.html');
const CACHE_BUST = '20260812-2';

function replaceRequired(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Centerhold hardfix target missing: ${label}`);
  return source.replace(needle, replacement);
}

let runtime = await readFile(runtimePath, 'utf8');

runtime = replaceRequired(
  runtime,
`  const clearInputs = () => {
    for (const code of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space']) {
      window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true }));
    }
    window.dispatchEvent(new Event('blur'));
  };`,
`  const clearInputs = () => {
    for (const code of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space']) {
      try {
        window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true }));
      } catch {}
    }
    // Input cleanup must never impersonate a real browser lifecycle event.
    try { window.dispatchEvent(new CustomEvent('escapee:clear-inputs')); } catch {}
  };`,
  'synthetic blur removal'
);

runtime = replaceRequired(
  runtime,
`  const setPaused = value => {
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
  };`,
`  const setPaused = value => {
    if (runtime.paused === value) return;
    runtime.paused = value;
    if (value) {
      runtime.pauseStarted = nativePerformanceNow();
      try { clearInputs(); } catch (error) { console.warn('Universal input cleanup failed.', error); }
      try { window.EscapeeGame?.pause?.(); } catch (error) { console.error('Game pause hook failed; universal pause remains usable.', error); }
      try { window.dispatchEvent(new CustomEvent('escapee:pause')); } catch {}
    } else {
      runtime.pausedTotal += nativePerformanceNow() - runtime.pauseStarted;
      try { window.EscapeeGame?.resume?.(); } catch (error) { console.error('Game resume hook failed; universal runtime still resumes.', error); }
      try { window.dispatchEvent(new CustomEvent('escapee:resume')); } catch {}
    }
  };`,
  'exception-safe setPaused'
);

runtime = replaceRequired(
  runtime,
`    const openPause = () => {
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
    };`,
`    const openPause = () => {
      if (!overlay.hidden || !scoreOverlay.hidden) return;
      // Expose recovery UI before any game-specific hook can run.
      overlay.hidden = false;
      button.hidden = true;
      setPaused(true);
      try { overlay.querySelector('[data-escapee-action="resume"]').focus(); } catch {}
    };

    const closePause = () => {
      // Resume the runtime first; setPaused is exception-safe.
      setPaused(false);
      overlay.hidden = true;
      button.hidden = false;
      try { button.focus(); } catch {}
    };`,
  'UI-first pause controls'
);

runtime = replaceRequired(
  runtime,
`    const showBackgroundPause = () => {
      if (!statusIsActive() || !scoreOverlay.hidden) return;
      setPaused(true);
      overlay.hidden = false;
      button.hidden = true;
    };

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) showBackgroundPause();
    });
    addEventListener('pagehide', showBackgroundPause);
    addEventListener('blur', showBackgroundPause);`,
`    const showBackgroundPause = () => {
      if (!statusIsActive() || !scoreOverlay.hidden) return;
      overlay.hidden = false;
      button.hidden = true;
      setPaused(true);
    };

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) showBackgroundPause();
    });
    addEventListener('pagehide', showBackgroundPause);
    addEventListener('blur', event => {
      if (event.isTrusted) showBackgroundPause();
    });

    // Independent of requestAnimationFrame: if anything ever leaves the runtime
    // paused without accessible UI, repair it within a fraction of a second.
    setInterval(() => {
      if (!runtime.paused || !overlay.hidden || !scoreOverlay.hidden) return;
      overlay.hidden = false;
      button.hidden = true;
    }, 200);`,
  'background pause and watchdog'
);

if (runtime.includes("window.dispatchEvent(new Event('blur'))")) {
  throw new Error('Centerhold hardfix invariant failed: synthetic blur remains in universal runtime');
}
if (!runtime.includes('Game pause hook failed; universal pause remains usable.')) {
  throw new Error('Centerhold hardfix invariant failed: exception-safe pause missing');
}
if (!runtime.includes('setInterval(() => {')) {
  throw new Error('Centerhold hardfix invariant failed: pause UI watchdog missing');
}

await writeFile(runtimePath, runtime);

let centerhold = await readFile(centerholdPath, 'utf8');

centerhold = centerhold.replace(
  /\/shared\/universal-game\.js(?:\?v=[^"']*)?/g,
  `/shared/universal-game.js?v=${CACHE_BUST}`
);

centerhold = replaceRequired(
  centerhold,
`        if (flash > 0) {
          ctx.fillStyle = \`rgba(255, 75, 96, \${flash * 0.16})\`;
          ctx.fillRect(0, 0, W, H);
        }`,
`        const safeFlash = Number.isFinite(flash) ? Math.max(0, Math.min(0.65, flash)) : 0;
        const flashAlpha = Math.min(0.104, safeFlash * 0.16);
        if (flashAlpha > 0) {
          ctx.save();
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = 'source-over';
          ctx.shadowBlur = 0;
          if ('filter' in ctx) ctx.filter = 'none';
          ctx.fillStyle = \`rgba(255, 75, 96, \${flashAlpha})\`;
          ctx.fillRect(0, 0, W, H);
          ctx.restore();
        }`,
  'damage flash render isolation'
);

if (!centerhold.includes(`/shared/universal-game.js?v=${CACHE_BUST}`)) {
  throw new Error('Centerhold hardfix invariant failed: universal runtime cache bust missing');
}
if (centerhold.includes('${flash * 0.16}')) {
  throw new Error('Centerhold hardfix invariant failed: unclamped flash renderer remains');
}

await writeFile(centerholdPath, centerhold);
console.log('Applied Centerhold pause/runtime hardfix and isolated damage flash renderer.');
