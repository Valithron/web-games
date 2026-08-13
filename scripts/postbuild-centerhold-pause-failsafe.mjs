import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const file = path.join(process.cwd(), 'dist', 'centerhold-defense', 'index.html');
let html = await readFile(file, 'utf8');

function replaceRequired(pattern, replacement, label) {
  if (!pattern.test(html)) throw new Error(`Centerhold pause failsafe target missing: ${label}`);
  html = html.replace(pattern, replacement);
}

const universalScriptPattern = /<script\b[^>]*src=["']\/shared\/universal-game\.js(?:\?v=[^"']*)?["'][^>]*><\/script>/i;
const pauseGuard = `<script data-centerhold-pause-guard>
(() => {
  'use strict';

  // The shared runtime intentionally emits synthetic blur events to clear legacy
  // input handlers. Centerhold already clears its own keyboard and touch state in
  // EscapeeGame.pause(), so do not let that synthetic event masquerade as a real
  // browser interruption and recursively enter the universal pause lifecycle.
  window.addEventListener('blur', event => {
    if (!event.isTrusted) event.stopImmediatePropagation();
  }, true);

  // A paused runtime must never be allowed to remain with every pause UI hidden.
  // This is a recovery invariant for focus/visibility transitions and future
  // adapter errors. Returning to the page still remains paused, as required.
  function repairPauseUi() {
    const runtime = window.__escapeeUniversalRuntime;
    if (!runtime?.paused) return;

    const pauseOverlay = document.querySelector('.escapee-pause-overlay');
    const pauseButton = document.querySelector('.escapee-pause-button');
    const scoreOverlay = document.querySelector('.escapee-score-overlay');
    if (!pauseOverlay || !pauseButton) return;
    if (scoreOverlay && !scoreOverlay.hidden) return;

    if (pauseOverlay.hidden) pauseOverlay.hidden = false;
    pauseButton.hidden = true;
  }

  window.addEventListener('focus', () => queueMicrotask(repairPauseUi));
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) queueMicrotask(repairPauseUi);
  });
  window.addEventListener('escapee:pause', () => queueMicrotask(repairPauseUi));
})();
</script>`;

if (!html.includes('data-centerhold-pause-guard')) {
  replaceRequired(universalScriptPattern, match => `${pauseGuard}\n${match}`, 'universal runtime script');
}

replaceRequired(
  /      function pauseGame\(\) \{[\s\S]*?\n      \}\n\n      function resumeGame\(\) \{[\s\S]*?\n      \}/,
`      function pauseGame() {
        if (!['playing', 'upgrade', 'endlessIntro'].includes(state)) return;
        pausedFromState = state;
        state = 'paused';
        try { clearInputState(); } catch {}
        flash = 0;
        screenShake = 0;
        try { window.__centerholdSfx?.setPaused?.(true); } catch (error) {
          console.warn('Centerhold audio pause failed; gameplay pause continues.', error);
        }
        try { draw(); } catch {}
      }

      function resumeGame() {
        if (state !== 'paused') return;
        state = pausedFromState || 'playing';
        pausedFromState = null;
        try { clearInputState(); } catch {}
        flash = 0;
        screenShake = 0;
        // requestAnimationFrame is virtualized by the universal runtime. Do not
        // seed lastTime from raw performance.now(), which is a different clock
        // after a pause. Recalibrate from the next RAF timestamp instead.
        lastTime = null;
        try { window.__centerholdSfx?.setPaused?.(false); } catch (error) {
          console.warn('Centerhold audio resume failed; gameplay resume continues.', error);
        }
        try { draw(); } catch {}
      }`,
  'pause and resume functions'
);

replaceRequired(
  /      function gameLoop\(now\) \{\n        const dt = Math\.min\(0\.033, \(now - lastTime\) \/ 1000\);\n        lastTime = now;\n        update\(dt\);\n        draw\(\);\n        requestAnimationFrame\(gameLoop\);\n      \}/,
`      function gameLoop(now) {
        const rawDt = lastTime == null ? 0 : (now - lastTime) / 1000;
        const dt = Number.isFinite(rawDt) ? Math.max(0, Math.min(0.033, rawDt)) : 0;
        lastTime = now;
        update(dt);
        draw();
        requestAnimationFrame(gameLoop);
      }`,
  'non-negative animation delta'
);

if (!html.includes('data-centerhold-pause-guard')) {
  throw new Error('Centerhold pause failsafe invariant failed: lifecycle guard missing');
}
if (!html.includes("console.warn('Centerhold audio pause failed; gameplay pause continues.'")) {
  throw new Error('Centerhold pause failsafe invariant failed: exception-safe pause missing');
}
if (!html.includes('try { draw(); } catch {}')) {
  throw new Error('Centerhold pause failsafe invariant failed: clean redraw missing');
}
if (!html.includes('lastTime = null;')) {
  throw new Error('Centerhold pause failsafe invariant failed: RAF clock recalibration missing');
}
if (!html.includes('Math.max(0, Math.min(0.033, rawDt))')) {
  throw new Error('Centerhold pause failsafe invariant failed: non-negative frame delta clamp missing');
}

await writeFile(file, html);
console.log('Applied Centerhold pause lifecycle failsafe and resume clock recalibration.');
