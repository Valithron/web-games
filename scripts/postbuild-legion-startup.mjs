import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const gamePath = path.join(ROOT, 'dist', 'legion-commander', 'game.js');
const htmlPath = path.join(ROOT, 'dist', 'legion-commander', 'index.html');

function replaceOnce(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Legion Commander startup patch target was not found: ${label}`);
  return source.replace(needle, replacement);
}

let game = await readFile(gamePath, 'utf8');

game = replaceOnce(
  game,
  "    apply(s) { s.levels.auxilia *= 1; }",
  "    apply(s) { s.levels.auxilia += 1; }",
  'Auxilia level increment'
);

game = replaceOnce(
  game,
  "  const ac = initAudio();\n  if (!ac) return;",
  "  const ac = audio;\n  if (!ac) return;",
  'lazy tone audio lookup'
);

game = replaceOnce(
  game,
  "  lastFrame = performance.now();\n  initAudio();\n  call('Keep the Eagle moving. The legion will form around it.', 2.6);",
  "  lastFrame = performance.now();\n  call('Keep the Eagle moving. The legion will form around it.', 2.6);",
  'startup audio removal'
);

game = replaceOnce(
  game,
  "ui.nextWaveButton.addEventListener('click', nextWave);",
  `ui.nextWaveButton.addEventListener('click', nextWave);\n\nconst primeAudioAfterStart = () => {\n  if (status !== 'playing' || muted || audio) return;\n  initAudio();\n};\naddEventListener('pointerdown', primeAudioAfterStart, { capture: true, passive: true });\naddEventListener('keydown', primeAudioAfterStart, { capture: true });`,
  'post-start audio priming'
);

await writeFile(gamePath, game);

let html = await readFile(htmlPath, 'utf8');
html = replaceOnce(
  html,
  './game.js?v=20260806-1',
  './game.js?v=20260806-2',
  'game script cache bust'
);
await writeFile(htmlPath, html);

console.log('Applied Legion Commander non-blocking startup compatibility patch.');
