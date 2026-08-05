import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const deepCatchPath = path.join(process.cwd(), 'dist', 'deep-catch', 'index.html');
const unsafeAudioInit = "if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)();";
const safeAudioInit = "const AudioCtor=window.AudioContext||window.webkitAudioContext;if(!AudioCtor){soundOn=false;soundBtn.textContent='×';soundBtn.setAttribute('aria-label','Sound unavailable');return false;}if(!audioCtx) audioCtx=new AudioCtor();";

const html = await readFile(deepCatchPath, 'utf8');
if (!html.includes(unsafeAudioInit)) {
  throw new Error('Deep Catch compatibility patch target was not found.');
}

await writeFile(deepCatchPath, html.replace(unsafeAudioInit, safeAudioInit));
console.log('Applied Deep Catch Web Audio compatibility patch.');
