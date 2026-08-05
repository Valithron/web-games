import { access, cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gunzip } from 'node:zlib';
import { promisify } from 'node:util';
import { loadGames } from './validate-games.mjs';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const SITE = path.join(ROOT, 'site');
const SHARED = path.join(ROOT, 'shared');
const BASE_URL = 'https://fun.skpfam.com';
const unzip = promisify(gunzip);

const esc = (value = '') => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));

function card(game) {
  const controls = [...game.desktopControls, ...game.mobileControls].slice(0, 3);
  return `<article class="game-card" data-title="${esc(game.title.toLowerCase())}" data-category="${esc(game.category.toLowerCase())}">
    <a class="game-card__link" href="/${esc(game.slug)}/" aria-label="Play ${esc(game.title)}">
      <div class="game-card__art"><img src="/${esc(game.slug)}/${esc(game.thumbnail)}" alt="${esc(game.title)} game preview" loading="lazy"></div>
      <div class="game-card__body">
        <div class="game-card__eyebrow"><span>${esc(game.category)}</span><span>${esc(game.sessionMinutes || 'Quick play')}</span></div>
        <h2>${esc(game.title)}</h2>
        <p>${esc(game.description)}</p>
        <div class="game-card__footer"><span>${controls.map(esc).join(' · ')}</span><strong>Play</strong></div>
      </div>
    </a>
  </article>`;
}

async function build() {
  const games = (await loadGames())
    .filter(game => game.status === 'published')
    .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || String(b.published || '').localeCompare(String(a.published || '')) || a.title.localeCompare(b.title));

  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  await cp(path.join(SITE, 'assets'), path.join(DIST, 'assets'), { recursive: true });
  await cp(SHARED, path.join(DIST, 'shared'), { recursive: true });

  const template = await readFile(path.join(SITE, 'index.template.html'), 'utf8');
  const categories = [...new Set(games.map(game => game.category))].sort();
  const filters = ['All', ...categories].map((category, index) => `<button class="filter${index === 0 ? ' is-active' : ''}" type="button" data-filter="${esc(category.toLowerCase())}">${esc(category)}</button>`).join('');
  const cards = games.length ? games.map(card).join('\n') : '<div class="empty-state"><h2>The arcade is being stocked.</h2><p>New escape routes are opening soon.</p></div>';
  const html = template.replace('<!-- FILTERS -->', filters).replace('<!-- GAME_GRID -->', cards).replaceAll('{{GAME_COUNT}}', String(games.length));

  await writeFile(path.join(DIST, 'index.html'), html);
  await cp(path.join(SITE, 'site.css'), path.join(DIST, 'site.css'));
  await cp(path.join(SITE, 'site.js'), path.join(DIST, 'site.js'));
  await cp(path.join(SITE, '404.html'), path.join(DIST, '404.html'));
  await writeFile(path.join(DIST, 'games.json'), JSON.stringify(games.map(({ sourceDir, compressedEntry, ...game }) => game), null, 2));

  for (const game of games) {
    const targetDir = path.join(DIST, game.slug);
    await cp(game.sourceDir, targetDir, { recursive: true });

    const compressed = path.join(targetDir, 'index.html.gz');
    if (game.compressedEntry && await access(compressed).then(() => true).catch(() => false)) {
      const html = await unzip(await readFile(compressed));
      await writeFile(path.join(targetDir, 'index.html'), html);
      await rm(compressed, { force: true });
    }
  }

  const urls = ['', ...games.map(game => game.slug)].map(slug => `<url><loc>${BASE_URL}/${slug ? `${slug}/` : ''}</loc></url>`).join('');
  await writeFile(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
  await writeFile(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${BASE_URL}/sitemap.xml\n`);
  await writeFile(path.join(DIST, '_headers'), `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=(), fullscreen=(self)\n\n/assets/*\n  Cache-Control: public, max-age=604800\n\n/*/thumbnail.*\n  Cache-Control: public, max-age=604800\n`);
  console.log(`Built Escapee Games with ${games.length} published game${games.length === 1 ? '' : 's'}.`);
}

build().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
