import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const file = process.argv[2] || path.join(process.cwd(), 'dist', 'centerhold-defense', 'index.html');
let html = await readFile(file, 'utf8');

function patch(needle, replacement, label) {
  if (!html.includes(needle)) throw new Error(`Centerhold pause patch target missing: ${label}`);
  html = html.replace(needle, replacement);
}

patch(
`      function togglePause(forceResume = false) {
        if (state === 'playing') {
          state = 'paused';
          els.pause.classList.remove('hidden');
        } else if (state === 'paused' || forceResume) {
          state = 'playing';
          els.pause.classList.add('hidden');
          lastTime = performance.now();
        }
      }`,
`      function clearTransientPauseState() {
        keys.clear();
        flash = 0;
        screenShake = 0;
        touchMoveX = 0;
        touchMoveY = 0;
        touchPointerId = null;
        els.touchStick.style.transform = 'translate(0px, 0px)';
        els.pause.classList.add('hidden');
      }`,
'native pause state machine'
);

patch(
`        if (key.startsWith('Arrow') || ['w','a','s','d','p','1','2','3','r',' '].includes(key)) event.preventDefault();
        keys.add(key);

        if (key === 'p' && (state === 'playing' || state === 'paused')) togglePause();`,
`        if (key.startsWith('Arrow') || ['w','a','s','d','1','2','3','r',' '].includes(key)) event.preventDefault();
        keys.add(key);`,
'duplicate P-key pause handler'
);

patch(
`      window.addEventListener('blur', () => {
        keys.clear();
        if (state === 'playing') togglePause();
      });`,
`      window.addEventListener('blur', () => {
        clearTransientPauseState();
        draw();
      });`,
'blur auto-pause handler'
);

patch(
`      els.resumeButton.addEventListener('click', () => togglePause(true));`,
`      els.resumeButton.addEventListener('click', () => {
        clearTransientPauseState();
        lastTime = performance.now();
      });`,
'native resume button'
);

patch(
`      resetGame();
      requestAnimationFrame(gameLoop);`,
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

await writeFile(file, html);
console.log('Applied Centerhold single-authority pause fix.');
