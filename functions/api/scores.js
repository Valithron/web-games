const PREFERRED_BINDINGS = ['WEB_GAMES_SCORES', 'web_games_scores', 'SCORES', 'DB', 'web-games-scores'];
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

function isDatabaseBinding(candidate) {
  return Boolean(
    candidate &&
    typeof candidate.prepare === 'function' &&
    (typeof candidate.batch === 'function' || typeof candidate.exec === 'function')
  );
}

function getDatabase(env) {
  for (const name of PREFERRED_BINDINGS) {
    const candidate = env?.[name];
    if (isDatabaseBinding(candidate)) return { db: candidate, bindingName: name };
  }

  for (const [name, candidate] of Object.entries(env || {})) {
    if (isDatabaseBinding(candidate)) return { db: candidate, bindingName: name };
  }

  return { db: null, bindingName: null };
}

async function ensureSchema(db) {
  const tableSql = `
    CREATE TABLE IF NOT EXISTS arcade_scores (
      id TEXT PRIMARY KEY,
      game_slug TEXT NOT NULL,
      signature TEXT NOT NULL CHECK (length(signature) = 3),
      score INTEGER NOT NULL CHECK (score >= 0),
      display TEXT NOT NULL,
      label TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `;
  const indexSql = `
    CREATE INDEX IF NOT EXISTS idx_arcade_scores_game_rank
      ON arcade_scores (game_slug, score DESC, created_at ASC, id ASC)
  `;

  if (typeof db.exec === 'function') {
    await db.exec(`${tableSql};${indexSql};`);
    return;
  }

  await db.prepare(tableSql).run();
  await db.prepare(indexSql).run();
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
    ORDER BY score DESC, created_at ASC, id ASC
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
      ORDER BY game_slug ASC, score DESC, created_at ASC, id ASC
    `).all();
    const boards = {};
    for (const entry of result.results || []) {
      if (!boards[entry.game]) boards[entry.game] = [];
      if (boards[entry.game].length < SCORE_LIMIT) boards[entry.game].push(entry);
    }
    return json({ boards });
  }

  const game = url.searchParams.get('game') || '';
  if (!validGame(game)) {
    return json({ error: 'A valid game slug is required.', code: 'INVALID_GAME' }, 400);
  }

  if (action === 'qualify') {
    const score = Number(url.searchParams.get('score'));
    if (!Number.isSafeInteger(score) || score < 0) {
      return json({ error: 'Score must be a non-negative safe integer.', code: 'INVALID_SCORE' }, 400);
    }
    return json(await qualification(db, game, score));
  }

  return json({ game, entries: await readLeaderboard(db, game) });
}

async function runInsertAndTrim(db, entry) {
  const insert = db.prepare(`
    INSERT INTO arcade_scores (id, game_slug, signature, score, display, label, created_at)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
  `).bind(
    entry.id,
    entry.game,
    entry.signature,
    entry.score,
    entry.display,
    entry.label,
    entry.createdAt
  );

  const trim = db.prepare(`
    DELETE FROM arcade_scores
    WHERE game_slug = ?1 AND id NOT IN (
      SELECT id FROM arcade_scores
      WHERE game_slug = ?1
      ORDER BY score DESC, created_at ASC, id ASC
      LIMIT ?2
    )
  `).bind(entry.game, SCORE_LIMIT);

  if (typeof db.batch === 'function') {
    await db.batch([insert, trim]);
    return;
  }

  await insert.run();
  await trim.run();
}

async function handlePost(request, db) {
  if (!sameOrigin(request)) {
    return json({ error: 'Cross-origin score submission is not allowed.', code: 'CROSS_ORIGIN' }, 403);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body.', code: 'INVALID_JSON' }, 400);
  }

  const game = String(body?.game || '');
  const signature = String(body?.signature || '').toUpperCase();
  const score = Number(body?.score);

  if (!validGame(game)) {
    return json({ error: 'A valid game slug is required.', code: 'INVALID_GAME' }, 400);
  }
  if (!SIGNATURE.test(signature)) {
    return json({ error: 'Signature must be exactly three letters or numbers.', code: 'INVALID_SIGNATURE' }, 400);
  }
  if (!Number.isSafeInteger(score) || score < 0) {
    return json({ error: 'Score must be a non-negative safe integer.', code: 'INVALID_SCORE' }, 400);
  }

  const check = await qualification(db, game, score);
  if (!check.qualifies) {
    return json({
      error: 'This score no longer qualifies for the top ten.',
      code: 'SCORE_NO_LONGER_QUALIFIES',
      ...check,
      entries: await readLeaderboard(db, game)
    }, 409);
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

  await runInsertAndTrim(db, entry);
  const entries = await readLeaderboard(db, game);

  if (!entries.some(item => item.id === entry.id)) {
    return json({
      error: 'The leaderboard cutoff changed before this score was committed.',
      code: 'SCORE_NO_LONGER_QUALIFIES',
      game,
      score,
      entries
    }, 409);
  }

  return json({ entry, entries }, 201);
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action') || '';
  const { db, bindingName } = getDatabase(env);

  if (request.method === 'GET' && action === 'health') {
    if (!db) {
      return json({
        ok: false,
        error: 'Score database binding is unavailable.',
        code: 'D1_BINDING_MISSING',
        expectedBinding: 'WEB_GAMES_SCORES'
      }, 503);
    }

    try {
      await ensureSchema(db);
      await db.prepare('SELECT 1 AS ok').first();
      return json({ ok: true, bindingName });
    } catch (error) {
      console.error('Score health check failed', error);
      return json({
        ok: false,
        error: 'The score database could not be queried.',
        code: 'D1_QUERY_FAILED',
        bindingName
      }, 500);
    }
  }

  if (!db) {
    return json({
      error: 'Score database binding is unavailable.',
      code: 'D1_BINDING_MISSING',
      expectedBinding: 'WEB_GAMES_SCORES'
    }, 503);
  }

  try {
    await ensureSchema(db);
    if (request.method === 'GET') return await handleGet(request, db);
    if (request.method === 'POST') return await handlePost(request, db);
    return json({
      error: 'Scores are insert-only and cannot be edited or deleted.',
      code: 'METHOD_NOT_ALLOWED'
    }, 405, { allow: 'GET, POST' });
  } catch (error) {
    console.error('Score API failure', error);
    return json({
      error: 'The score service is temporarily unavailable.',
      code: 'SCORE_SERVICE_FAILURE'
    }, 500);
  }
}
