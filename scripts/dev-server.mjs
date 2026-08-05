import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.xml': 'application/xml; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };

const build = spawn(process.execPath, ['scripts/build.mjs'], { stdio: 'inherit' });
build.on('exit', code => {
  if (code !== 0) process.exit(code ?? 1);

  createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      let target = path.join(DIST, decodeURIComponent(url.pathname));
      if (!target.startsWith(DIST)) throw new Error('Invalid path');
      const info = await stat(target).catch(() => null);
      if (info?.isDirectory()) target = path.join(target, 'index.html');
      if (!info && !path.extname(target)) target = path.join(target, 'index.html');
      const body = await readFile(target).catch(() => readFile(path.join(DIST, '404.html')));
      res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(500);
      res.end('Server error');
    }
  }).listen(PORT, '0.0.0.0', () => console.log(`Escapee Games: http://localhost:${PORT}`));
});
