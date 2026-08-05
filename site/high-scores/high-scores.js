(() => {
  'use strict';
  const grid = document.querySelector('#score-grid');
  const status = document.querySelector('#scores-status');

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));

  function renderCard(game, entries) {
    const rows = entries.length
      ? entries.map((entry, index) => `<div class="score-row"><span>${String(index + 1).padStart(2, '0')}</span><strong>${esc(entry.signature)}</strong><span>${esc(entry.display || Number(entry.score).toLocaleString())}</span></div>`).join('')
      : '<p class="score-empty">No signed scores yet.</p>';
    return `<article class="score-card"><div class="score-card__head"><img src="/${esc(game.slug)}/${esc(game.thumbnail)}" alt=""><div><h2>${esc(game.title)}</h2><a href="/${esc(game.slug)}/">Play game</a></div></div><div class="score-list">${rows}</div></article>`;
  }

  async function load() {
    try {
      const [gamesResponse, scoresResponse] = await Promise.all([
        fetch('/games.json', { cache: 'no-store' }),
        fetch('/api/scores?action=all', { cache: 'no-store', headers: { accept: 'application/json' } })
      ]);
      if (!gamesResponse.ok || !scoresResponse.ok) throw new Error('Could not load the arcade leaderboards.');
      const games = await gamesResponse.json();
      const data = await scoresResponse.json();
      const boards = data.boards || {};
      const scoredGames = games.filter(game => game.scoreMode !== 'none');
      grid.innerHTML = scoredGames.map(game => renderCard(game, boards[game.slug] || [])).join('');
      status.textContent = `${scoredGames.length} game leaderboard${scoredGames.length === 1 ? '' : 's'}`;
    } catch (error) {
      status.textContent = error.message || 'Could not load high scores.';
      grid.innerHTML = '<div class="score-empty">The leaderboard service is unavailable. Refresh to try again.</div>';
    }
  }

  load();
})();
