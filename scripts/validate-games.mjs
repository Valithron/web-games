import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const GAMES_DIR = path.join(ROOT, 'games');
const REQUIRED = ['slug', 'title', 'description', 'category', 'thumbnail', 'desktopControls', 'mobileControls', 'orientation', 'status'];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function loadGames() {
  const entries = await readdir(GAMES_DIR, { withFileTypes: true });
  const games = [];
  const seen = new Set();

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
    const dir = path.join(GAMES_DIR, entry.name);
    const manifestPath = path.join(dir, 'game.json');
    let game;

    try {
      game = JSON.parse(await readFile(manifestPath, 'utf8'));
    } catch (error) {
      throw new Error(`${entry.name}: invalid or missing game.json (${error.message})`);
    }

    for (const field of REQUIRED) {
      if (game[field] === undefined || game[field] === null || game[field] === '') {
        throw new Error(`${entry.name}: missing required field "${field}"`);
      }
    }

    if (!SLUG.test(game.slug)) throw new Error(`${entry.name}: slug must be lowercase kebab-case`);
    if (game.slug !== entry.name) throw new Error(`${entry.name}: folder name must match slug "${game.slug}"`);
    if (seen.has(game.slug)) throw new Error(`${entry.name}: duplicate slug "${game.slug}"`);
    if (!['portrait', 'landscape', 'any'].includes(game.orientation)) throw new Error(`${entry.name}: invalid orientation`);
    if (!['published', 'draft'].includes(game.status)) throw new Error(`${entry.name}: status must be published or draft`);
    if (!Array.isArray(game.desktopControls) || game.desktopControls.length === 0) throw new Error(`${entry.name}: desktopControls must not be empty`);
    if (!Array.isArray(game.mobileControls) || game.mobileControls.length === 0) throw new Error(`${entry.name}: mobileControls must not be empty`);

    await access(path.join(dir, 'index.html'));
    await access(path.join(dir, game.thumbnail));
    seen.add(game.slug);
    games.push({ ...game, sourceDir: dir });
  }

  return games;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const games = await loadGames();
  console.log(`Validated ${games.length} game package${games.length === 1 ? '' : 's'}.`);
}
