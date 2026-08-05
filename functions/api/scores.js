const BINDING_NAMES = ['WEB_GAMES_SCORES', 'web_games_scores', 'SCORES', 'DB', 'web-games-scores'];
const GAME_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SIGNATURE = /^[A-Z0-9]{3}$/;
const SCORE_LIMIT = 10;

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders
    }
  });
}

function getDatabase(env) {
  for (const name of BINDING_NAMES) {
    const candidate = env?.[name];
    if (candidate?.prepare && candidate?.exec) return candidate;
  }
  return null;
}

async function ensureSchema(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS arcade_scores (
      id TEXT PRIMARY KEY,
      game_slug TEXT NOT NULL,
      signature TEXT NOT NULL CHECK (length(signature) = 3),
      score INTEGER NOT NULL CHECK (score >= 0),
      display TEXT NOT NULL,
      label TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_arcade_scores_game_rank
      ON arcade_scores (game_slug, score DESC, created_at ASC);
  `);
}

function cleanText(value, fallback, maxLength) {
  const text = String(value ?? fallback).replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return (text || fallback).slice(0, maxLength);
}

function validGame(game) {
  return GAME_SLUG.test(game) && game.length <= 64;
}

function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

async function readLeaderboard(db, game) {
  const result = await db.prepare(`
    SELECT id, game_slug AS game, signature, score, display, label, created_at AS createdAt
    FROM arcade_scores
    WHERE game_slug = ?1
    ORDER BY score DESC, created_at ASC
    LIMIT ?2
  `).bind(game, SCORE_LIMIT).all();
  return result.results || [];
}

async function qualification(db, game, score) {
  const entries = await readLeaderboard(db, game);
  const entryCount = entries.length;
  const cutoffScore = entryCount < SCORE_LIMIT ? null : Number(entries[SCORE_LIMIT - 1].score);
  const qualifies = entryCount < SCORE_LIMIT || score > cutoffScore;
  const rank = qualifies ? entries.filter(entry => Number(entry.score) >= score).length + 1 : null;
  return { game, score, qualifies, rank, entryCount, cutoffScore };
}

async function handleGet(request, db) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || 'leaderboard';

  if (action === 'all') {
    const result = await db.prepare(`
      SELECT id, game_slug AS game, signature, score, display, label, created_at AS createdAt
      FROM arcade_scores
      ORDER BY game_slug ASC, score DESC, created_at ASC
    `).all();
    const boards = {};
    for (const entry of result.results || []) {
      if (!boards[entry.game]) boards[entry.game] = [];
      if (boards[entry.game].length < SCORE_LIMIT) boards[entry.game].push(entry);
    }
    return json({ boards });
  }

  const game = url.searchParams.get('game') || '';
  if (!validGame(game)) return json({ error: 'A valid game slug is required.' }, 400);

  if (action === 'qualify') {
    const score = Number(url.searchParams.get('score'));
    if (!Number.isSafeInteger(score) || score < 0) {
      return json({ error: 'Score must be a non-negative safe integer.' }, 400);
    }
    return json(await qualification(db, game, score));
  }

  return json({ game, entries: await readLeaderboard(db, game) });
}

async function handlePost(request, db) {
  if (!sameOrigin(request)) return json({ error: 'Cross-origin score submission is not allowed.' }, 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const game = String(body?.game || '');
  const signature = String(body?.signature || '').toUpperCase();
  const score = Number(body?.score);

  if (!validGame(game)) return json({ error: 'A valid game slug is required.' }, 400);
  if (!SIGNATURE.test(signature)) return json({ error: 'Signature must be exactly three letters or numbers.' }, 400);
  if (!Number.isSafeInteger(score) || score < 0) return json({ error: 'Score must be a non-negative safe integer.' }, 400);

  const check = await qualification(db, game, score);
  if (!check.qualifies) {
    return json({ error: 'This score no longer qualifies for the top ten.', code: 'SCORE_NO_LONGER_QUALIFIES', ...check, entries: await readLeaderboard(db, game) }, 409);
  }

  const entry = {
    id: crypto.randomUUID(),
    game,
    signature,
    score,
    display: cleanText(body?.display, score.toLocaleString('en-US'), 80),
    label: cleanText(body?.label, 'Final score', 40),
    createdAt: Date.now()
  };

  await db.prepare(`
    INSERT INTO arcade_scores (id, game_slug, signature, score, display, label, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
  `).bind(entry.id, entry.game, entry.signature, entry.score, entry.display, entry.label, entry.createdAt).run();

  await db.prepare(`
    DELETE FROM arcade_scores
    WHERE game_slug = ?1 AND id NOT IN (
      SELECT id FROM arcade_scores
      WHERE game_slug = ?1
      ORDER BY score DESC, created_at ASC
      LIMIT ?2
    )
  `).bind(game, SCORE_LIMIT).run();

  return json({ entry, entries: await readLeaderboard(db, game) }, 201);
}

export async function onRequest({ request, env }) {
  const db = getDatabase(env);
  if (!db) return json({ error: 'Score database binding is unavailable.', expectedBinding: 'WEB_GAMES_SCORES' }, 503);

  try {
    await ensureSchema(db);
    if (request.method === 'GET') return await handleGet(request, db);
    if (request.method === 'POST') return await handlePost(request, db);
    return json({ error: 'Scores are insert-only and cannot be edited or deleted.' }, 405, { allow: 'GET, POST' });
  } catch (error) {
    console.error('Score API failure', error);
    return json({ error: 'The score service is temporarily unavailable.' }, 500);
  }
}
