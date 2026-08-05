import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadGames } from './validate-games.mjs';

const DIST = path.join(process.cwd(), 'dist');
const bootstrap = '<script src="/shared/universal-game.js"></script><link rel="stylesheet" href="/shared/universal-game.css">';

for (const game of (await loadGames()).filter(item => item.status === 'published')) {
  const file = path.join(DIST, game.slug, 'index.html');
  await access(file);
  let html = await readFile(file, 'utf8');
  if (!/viewport-fit=cover/i.test(html)) {
    html = html.replace(/<meta\s+name=["']viewport["']\s+content=["']([^"']*)["']\s*\/?\s*>/i, (_, content) => `<meta name="viewport" content="${content},viewport-fit=cover">`);
  }
  if (!html.includes('/shared/universal-game.js')) html = html.replace(/<head([^>]*)>/i, `<head$1>${bootstrap}`);
  if (!html.includes('/shared/universal-game.js') || !html.includes('/shared/universal-game.css')) {
    throw new Error(`${game.slug}: universal runtime injection failed`);
  }
  await writeFile(file, html);
}

console.log('Applied the universal pause, viewport, lifecycle, and Home baseline to all published games.');
