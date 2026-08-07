import { access, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadGames } from './validate-games.mjs';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const SITE = path.join(ROOT, 'site');
const ASSET_VERSION = '20260805-4';
const universalScript = `<script src="/shared/universal-game.js?v=${ASSET_VERSION}"></script>`;
const scoreScript = `<script src="/shared/d1-scores.js?v=${ASSET_VERSION}"></script>`;
const inputLockScript = `<script src="/shared/score-input-lock.js?v=${ASSET_VERSION}"></script>`;
const universalStyle = `<link rel="stylesheet" href="/shared/universal-game.css?v=${ASSET_VERSION}">`;
const UNSCORED_GAMES = new Set(['hivefront']);

const scoreHooks = {


  sheepdog: {
    needle: "    overlay.style.display='grid';",
    replacement: "    overlay.style.display='grid';\n    window.EscapeeScores?.submit(score, { label: 'Herding score', display: `${score.toLocaleString()} points` });"
  },
  'centerhold-defense': {
    needle: "        els.gameOver.classList.remove('hidden');",
    replacement: "        els.gameOver.classList.remove('hidden');\n        const arcadeScore = wave * 1000 + kills * 25;\n        window.EscapeeScores?.submit(arcadeScore, { label: 'Defense score', display: `${arcadeScore.toLocaleString()} pts · Wave ${wave}` });"
  }
};

const nativeScoreHooks = {};

const fileExists = file => access(file).then(() => true).catch(() => false);
const containsScoreSubmission = source => /window\.EscapeeScores\??\.submit\s*\(/.test(source);

function injectSharedRuntime(html) {
  html = html
    .replace(/\/shared\/universal-game\.js(?:\?v=[^"']*)?/g, `/shared/universal-game.js?v=${ASSET_VERSION}`)
    .replace(/\/shared\/d1-scores\.js(?:\?v=[^"']*)?/g, `/shared/d1-scores.js?v=${ASSET_VERSION}`)
    .replace(/\/shared\/score-input-lock\.js(?:\?v=[^"']*)?/g, `/shared/score-input-lock.js?v=${ASSET_VERSION}`)
    .replace(/\/shared\/universal-game\.css(?:\?v=[^"']*)?/g, `/shared/universal-game.css?v=${ASSET_VERSION}`);

  if (!html.includes('/shared/universal-game.css')) {
    html = html.replace(/<head([^>]*)>/i, `<head$1>${universalStyle}`);
  }

  if (!html.includes('/shared/universal-game.js')) {
    html = html.replace(/<head([^>]*)>/i, `<head$1>${universalScript}${scoreScript}${inputLockScript}`);
  } else {
    if (!html.includes('/shared/d1-scores.js')) {
      const universalPattern = /<script\b[^>]*src=["']\/shared\/universal-game\.js(?:\?v=[^"']*)?["'][^>]*><\/script>/i;
      if (!universalPattern.test(html)) throw new Error('Universal runtime script tag could not be located for D1 score injection.');
      html = html.replace(universalPattern, match => `${match}${scoreScript}`);
    }

    if (!html.includes('/shared/score-input-lock.js')) {
      const scorePattern = /<script\b[^>]*src=["']\/shared\/d1-scores\.js(?:\?v=[^"']*)?["'][^>]*><\/script>/i;
      if (!scorePattern.test(html)) throw new Error('D1 score script tag could not be located for score input lock injection.');
      html = html.replace(scorePattern, match => `${match}${inputLockScript}`);
    }
  }

  return html;
}

async function patchNativeScoreHook(game) {
  const hook = nativeScoreHooks[game.slug];
  if (!hook) return '';

  const file = path.join(DIST, game.slug, hook.file);
  if (!await fileExists(file)) throw new Error(`${game.slug}: native score source ${hook.file} was not found`);

  let source = await readFile(file, 'utf8');
  if (!containsScoreSubmission(source)) {
    if (!source.includes(hook.needle)) throw new Error(`${game.slug}: native score hook target was not found`);
    source = source.replace(hook.needle, hook.replacement);
    await writeFile(file, source);
  }
  return source;
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
  if (hook && !containsScoreSubmission(html)) {
    if (!html.includes(hook.needle)) throw new Error(`${game.slug}: score submission hook target was not found`);
    html = html.replace(hook.needle, hook.replacement);
  }

  let externalScoreSource = await patchNativeScoreHook(game);
  const gameScript = path.join(DIST, game.slug, 'game.js');
  if (!externalScoreSource && await fileExists(gameScript)) externalScoreSource = await readFile(gameScript, 'utf8');

  if (!html.includes('/shared/universal-game.js') || !html.includes('/shared/universal-game.css')) throw new Error(`${game.slug}: universal runtime injection failed`);
  if (!html.includes('/shared/d1-scores.js')) throw new Error(`${game.slug}: D1 score runtime injection failed`);
  if (!html.includes('/shared/score-input-lock.js')) throw new Error(`${game.slug}: score input lock injection failed`);

  const isScored = game.scoreMode !== 'none' && !UNSCORED_GAMES.has(game.slug);
  if (isScored && !containsScoreSubmission(html) && !containsScoreSubmission(externalScoreSource)) {
    throw new Error(`${game.slug}: published scored game has no high-score submission hook`);
  }

  await writeFile(file, html);
}

await mkdir(path.join(DIST, 'high-scores'), { recursive: true });
await cp(path.join(SITE, 'high-scores'), path.join(DIST, 'high-scores'), { recursive: true });

console.log('Applied the universal game baseline, D1 score qualification, score input lock, complete score-hook coverage, and site-wide leaderboards.');
