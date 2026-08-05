const search = document.querySelector('#game-search');
const filters = document.querySelector('#filters');
const cards = [...document.querySelectorAll('.game-card')];
const count = document.querySelector('#result-count');
const noResults = document.querySelector('#no-results');
let activeFilter = 'all';

function updateCatalog() {
  const query = search?.value.trim().toLowerCase() || '';
  let visible = 0;

  for (const card of cards) {
    const matchesText = !query || card.dataset.title.includes(query) || card.textContent.toLowerCase().includes(query);
    const matchesCategory = activeFilter === 'all' || card.dataset.category === activeFilter;
    const show = matchesText && matchesCategory;
    card.hidden = !show;
    if (show) visible += 1;
  }

  if (count) count.textContent = cards.length ? `${visible} of ${cards.length} games shown` : '';
  if (noResults) noResults.hidden = visible !== 0 || cards.length === 0;
}

search?.addEventListener('input', updateCatalog);
filters?.addEventListener('click', event => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;
  activeFilter = button.dataset.filter;
  filters.querySelectorAll('.filter').forEach(item => item.classList.toggle('is-active', item === button));
  updateCatalog();
});

updateCatalog();
