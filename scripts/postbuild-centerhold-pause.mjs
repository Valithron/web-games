import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const file = process.argv[2] || path.join(process.cwd(), 'dist', 'centerhold-defense', 'index.html');
let html = await readFile(file, 'utf8');

function replaceRequired(pattern, replacement, label) {
  if (!pattern.test(html)) throw new Error(`Centerhold pause patch target missing: ${label}`);
  html = html.replace(pattern, replacement);
}

replaceRequired(
  /      function togglePause\(forceResume = false\) \{[\s\S]*?\n      \}\n\n      function endGame\(\) \{/,
`      function clearTransientPauseState() {
        keys.clear();
        flash = 0;
        screenShake = 0;
        touchMoveX = 0;
        touchMoveY = 0;
        touchPointerId = null;
        els.touchStick.style.transform = 'translate(0px, 0px)';
        els.pause.classList.add('hidden');
      }

      function endGame() {`,
  'native pause state machine'
);

replaceRequired(
  /        if \(key\.startsWith\('Arrow'\) \|\| \[[^\n]*'p'[^\n]*\]\.includes\(key\)\) event\.preventDefault\(\);/,
  `        if (key.startsWith('Arrow') || ['w','a','s','d','1','2','3','r',' '].includes(key)) event.preventDefault();`,
  'P-key prevent-default list'
);

html = html.replace(/\n        if \(key === 'p' && \(state === 'playing' \|\| state === 'paused'\)\) togglePause\(\);/, '');

replaceRequired(
  /      window\.addEventListener\('blur', \(\) => \{\n        keys\.clear\(\);\n        if \(state === 'playing'\) togglePause\(\);\n      \}\);/,
`      window.addEventListener('blur', () => {
        clearTransientPauseState();
        draw();
      });`,
  'blur auto-pause handler'
);

replaceRequired(
  /      els\.resumeButton\.addEventListener\('click', \(\) => togglePause\(true\)\);/,
`      els.resumeButton.addEventListener('click', () => {
        clearTransientPauseState();
        lastTime = performance.now();
      });`,
  'native resume button'
);

replaceRequired(
  /      resetGame\(\);\n      requestAnimationFrame\(gameLoop\);/,
`      window.EscapeeGame = {
        restart: startGame,
        pause() {
          clearTransientPauseState();
          draw();
        },
        resume() {
          clearTransientPauseState();
          lastTime = performance.now();
          draw();
        },
        getStatus() {
          if (state === 'playing') return 'playing';
          if (state === 'upgrade' || state === 'endlessIntro') return 'between-rounds';
          if (state === 'gameover') return 'game-over';
          return state;
        }
      };

      resetGame();
      requestAnimationFrame(gameLoop);`,
  'universal pause API'
);

if (/function togglePause\b/.test(html)) throw new Error('Centerhold pause patch invariant failed: native togglePause remains');
if (/key === 'p'.*togglePause/.test(html)) throw new Error('Centerhold pause patch invariant failed: duplicate P pause remains');
if (!html.includes('window.EscapeeGame = {')) throw new Error('Centerhold pause patch invariant failed: EscapeeGame bridge missing');

await writeFile(file, html);
console.log('Applied Centerhold single-authority pause fix.');
