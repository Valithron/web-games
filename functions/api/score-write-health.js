const PREFERRED_BINDINGS = ['WEB_GAMES_SCORES', 'web_games_scores', 'SCORES', 'DB', 'web-games-scores'];
const PROBE_HEADER = 'escapee-production-smoke';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

function getDatabase(env) {
  for (const name of PREFERRED_BINDINGS) {
    const candidate = env?.[name];
    if (candidate && typeof candidate.prepare === 'function') {
      return { db: candidate, bindingName: name };
    }
  }

  for (const [name, candidate] of Object.entries(env || {})) {
    if (candidate && typeof candidate.prepare === 'function') {
      return { db: candidate, bindingName: name };
    }
  }

  return { db: null, bindingName: null };
}

function diagnostic(error) {
  return String(error?.message || error || 'Unknown D1 error')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .slice(0, 180);
}

async function ensureTable(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS arcade_scores (
      id TEXT PRIMARY KEY,
      game_slug TEXT NOT NULL,
      signature TEXT NOT NULL CHECK (length(signature) = 3),
      score INTEGER NOT NULL CHECK (score >= 0),
      display TEXT NOT NULL,
      label TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `).run();
}

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return json({ error: 'The score write probe accepts POST only.' }, 405);
  }

  if (request.headers.get('x-score-health-probe') !== PROBE_HEADER) {
    return json({ error: 'Score write probe authorization failed.' }, 403);
  }

  const { db, bindingName } = getDatabase(env);
  if (!db) {
    return json({
      ok: false,
      code: 'D1_BINDING_MISSING',
      error: 'Score database binding is unavailable.'
    }, 503);
  }

  if (typeof db.batch !== 'function') {
    return json({
      ok: false,
      code: 'D1_BATCH_UNAVAILABLE',
      error: 'The bound database does not support atomic batch writes.',
      bindingName
    }, 500);
  }

  const id = `score-health-${crypto.randomUUID()}`;

  try {
    await ensureTable(db);

    const insert = db.prepare(`
      INSERT INTO arcade_scores (id, game_slug, signature, score, display, label, created_at)
      VALUES (?1, 'score-write-health', 'SYS', 0, 'Health check', 'System probe', ?2)
    `).bind(id, Date.now());

    const remove = db.prepare('DELETE FROM arcade_scores WHERE id = ?1').bind(id);
    await db.batch([insert, remove]);

    const remaining = await db
      .prepare('SELECT COUNT(*) AS count FROM arcade_scores WHERE id = ?1')
      .bind(id)
      .first('count');

    if (Number(remaining || 0) !== 0) {
      return json({
        ok: false,
        code: 'D1_PROBE_ROW_REMAINED',
        error: 'The score write probe did not clean up its synthetic row.',
        bindingName
      }, 500);
    }

    return json({
      ok: true,
      bindingName,
      inserted: true,
      deleted: true,
      remaining: 0
    });
  } catch (error) {
    console.error('Score write health probe failed', error);
    return json({
      ok: false,
      code: 'D1_WRITE_PROBE_FAILED',
      error: 'The score database write probe failed.',
      diagnostic: diagnostic(error),
      bindingName
    }, 500);
  }
}
