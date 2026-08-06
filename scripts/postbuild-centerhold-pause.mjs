import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const file = process.argv[2] || path.join(process.cwd(), 'dist', 'centerhold-defense', 'index.html');
let html = await readFile(file, 'utf8');
const notes = [];

function replace(pattern, replacement, label) {
  const before = html;
  html = html.replace(pattern, replacement);
  notes.push(`${label}: ${html === before ? 'not found' : 'applied'}`);
}

replace(
  /\s*function togglePause\([^)]*\) \{[\s\S]*?\n\s*\}\n\n\s*function endGame\(\) \{/,
`\n      function clearTransientPauseState() {
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

replace(
  /'w','a','s','d','p','1','2','3','r',' '/,
  `'w','a','s','d','1','2','3','r',' '`,
  'P-key prevent-default list'
);

replace(
  /\n\s*if \(key === 'p'[^\n]*togglePause\(\);/,
  '',
  'duplicate P-key pause handler'
);

replace(
  /if \(state === 'playing'\) togglePause\(\);/,
  `clearTransientPauseState();\n        draw();`,
  'blur auto-pause transition'
);

replace(
  /els\.resumeButton\.addEventListener\('click', \(\) => togglePause\(true\)\);/,
`els.resumeButton.addEventListener('click', () => {
        clearTransientPauseState();
        lastTime = performance.now();
      });`,
  'native resume button'
);

if (!html.includes('window.EscapeeGame = {')) {
  replace(
    /\n\s*resetGame\(\);\n\s*requestAnimationFrame\(gameLoop\);/,
`\n      window.EscapeeGame = {
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
}

if (/function togglePause\b/.test(html)) notes.push('warning: native togglePause still present');
if (/key === 'p'.*togglePause/.test(html)) notes.push('warning: duplicate P pause still present');
if (!html.includes('window.EscapeeGame = {')) notes.push('warning: EscapeeGame bridge missing');

await writeFile(file, html);
console.log(`Applied Centerhold pause compatibility pass. ${notes.join(' | ')}`);
