import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const deepCatchPath = path.join(process.cwd(), 'dist', 'deep-catch', 'index.html');
const unsafeAudioFunction = `  function ensureAudio() {
    if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state==='suspended') audioCtx.resume();
  }`;
const safeAudioFunction = `  function ensureAudio() {
    if (!soundOn) return false;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) {
      soundOn = false;
      soundBtn.textContent = '×';
      soundBtn.setAttribute('aria-label', 'Sound unavailable');
      return false;
    }
    try {
      if (!audioCtx) audioCtx = new AudioCtor();
      if (audioCtx.state === 'suspended') {
        const resumeResult = audioCtx.resume();
        if (resumeResult && typeof resumeResult.catch === 'function') resumeResult.catch(() => {});
      }
      return true;
    } catch {
      soundOn = false;
      soundBtn.textContent = '×';
      soundBtn.setAttribute('aria-label', 'Sound unavailable');
      return false;
    }
  }`;

const html = await readFile(deepCatchPath, 'utf8');
if (!html.includes(unsafeAudioFunction)) {
  throw new Error('Deep Catch compatibility patch target was not found.');
}

const patched = html.replace(unsafeAudioFunction, safeAudioFunction);
await writeFile(deepCatchPath, patched);
console.log('Applied Deep Catch Web Audio compatibility patch.');
