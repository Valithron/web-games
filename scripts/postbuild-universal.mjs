import { access, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadGames } from './validate-games.mjs';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const SITE = path.join(ROOT, 'site');
const ASSET_VERSION = '20260805-2';
const universalScript = `<script src="/shared/universal-game.js?v=${ASSET_VERSION}"></script>`;
const scoreScript = `<script src="/shared/d1-scores.js?v=${ASSET_VERSION}"></script>`;
const universalStyle = `<link rel="stylesheet" href="/shared/universal-game.css?v=${ASSET_VERSION}">`;

const scoreHooks = {
  'deep-catch': {
    needle: "    summaryScreen.classList.remove('hidden');",
    replacement: "    summaryScreen.classList.remove('hidden');\n    window.EscapeeScores?.submit(runScore, { label: 'Final catch', display: `${runScore.toLocaleString()} coins` });"
  },
  'garden-defender': {
    needle: '    ui.end.hidden = false;',
    replacement: "    ui.end.hidden = false;\n    window.EscapeeScores?.submit(score, { label: 'Garden score', display: `${score.toLocaleString()} points` });"
  },
  sheepdog: {
    needle: "    overlay.style.display='grid';",
    replacement: "    overlay.style.display='grid';\n    window.EscapeeScores?.submit(score, { label: 'Herding score', display: `${score.toLocaleString()} points` });"
  },
  'centerhold-defense': {
    needle: "        els.gameOver.classList.remove('hidden');",
    replacement: "        els.gameOver.classList.remove('hidden');\n        const arcadeScore = wave * 1000 + kills * 25;\n        window.EscapeeScores?.submit(arcadeScore, { label: 'Defense score', display: `${arcadeScore.toLocaleString()} pts · Wave ${wave}` });"
  },
  'last-lantern': {
    needle: "        els.gameOver.classList.remove('hidden');",
    replacement: "        els.gameOver.classList.remove('hidden');\n        window.EscapeeScores?.submit(score, { label: 'Lantern score', display: `${score.toLocaleString()} points` });"
  }
};

function injectSharedRuntime(html) {
  html = html
    .replace(/\/shared\/universal-game\.js(?:\?v=[^"']*)?/g, `/shared/universal-game.js?v=${ASSET_VERSION}`)
    .replace(/\/shared\/d1-scores\.js(?:\?v=[^"']*)?/g, `/shared/d1-scores.js?v=${ASSET_VERSION}`)
    .replace(/\/shared\/universal-game\.css(?:\?v=[^"']*)?/g, `/shared/universal-game.css?v=${ASSET_VERSION}`);

  if (!html.includes('/shared/universal-game.css')) {
    html = html.replace(/<head([^>]*)>/i, `<head$1>${universalStyle}`);
  }

  if (!html.includes('/shared/universal-game.js')) {
    const scripts = `${universalScript}${html.includes('/shared/d1-scores.js') ? '' : scoreScript}`;
    html = html.replace(/<head([^>]*)>/i, `<head$1>${scripts}`);
  } else if (!html.includes('/shared/d1-scores.js')) {
    const universalPattern = /<script\b[^>]*src=["']\/shared\/universal-game\.js(?:\?v=[^"']*)?["'][^>]*><\/script>/i;
    if (!universalPattern.test(html)) throw new Error('Universal runtime script tag could not be located for D1 score injection.');
    html = html.replace(universalPattern, match => `${match}${scoreScript}`);
  }

  return html;
}

for (const game of (await loadGames()).filter(item => item.status === 'published')) {
  const file = path.join(DIST, game.slug, 'index.html');
  await access(file);
  let html = await readFile(file, 'utf8');
  if (!/viewport-fit=cover/i.test(html)) {
    html = html.replace(/<meta\s+name=["']viewport["']\s+content=["']([^"']*)["']\s*\/?\s*>/i, (_, content) => `<meta name="viewport" content="${content},viewport-fit=cover">`);
  }

  html = injectSharedRuntime(html);

  const hook = scoreHooks[game.slug];
  if (hook && !html.includes('window.EscapeeScores?.submit')) {
    if (!html.includes(hook.needle)) throw new Error(`${game.slug}: score submission hook target was not found`);
    html = html.replace(hook.needle, hook.replacement);
  }

  if (!html.includes('/shared/universal-game.js') || !html.includes('/shared/universal-game.css')) throw new Error(`${game.slug}: universal runtime injection failed`);
  if (!html.includes('/shared/d1-scores.js')) throw new Error(`${game.slug}: D1 score runtime injection failed`);
  if (hook && !html.includes('window.EscapeeScores?.submit')) throw new Error(`${game.slug}: high-score submission hook failed`);
  await writeFile(file, html);
}

await mkdir(path.join(DIST, 'high-scores'), { recursive: true });
await cp(path.join(SITE, 'high-scores'), path.join(DIST, 'high-scores'), { recursive: true });

console.log('Applied the universal game baseline, versioned D1 scores, and site-wide leaderboards.');
