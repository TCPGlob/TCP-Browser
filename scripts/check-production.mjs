/**
 * Verifies the production path: `npm run build` output served by
 * `node dist/server.cjs` with NODE_ENV unset (auto-detection).
 *
 * Usage: node scripts/check-production.mjs
 */
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distServer = path.join(repoRoot, 'dist', 'server.cjs');

if (!fs.existsSync(distServer)) {
  console.error(`FAIL  ${path.relative(repoRoot, distServer)} not found — run \`npm run build\` first.`);
  process.exit(1);
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${detail}` : ''}`);
};

const port = await new Promise((resolve) => {
  const srv = net.createServer();
  srv.listen(0, '127.0.0.1', () => {
    const { port } = srv.address();
    srv.close(() => resolve(port));
  });
});

// NODE_ENV deliberately unset: the server must auto-detect ./dist.
const env = { ...process.env, PORT: String(port) };
delete env.NODE_ENV;

const child = spawn(process.execPath, [distServer], { cwd: repoRoot, env, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
child.stdout.on('data', (d) => { log += d.toString(); });
child.stderr.on('data', (d) => { log += d.toString(); });

const base = `http://127.0.0.1:${port}`;
let ready = false;
for (let i = 0; i < 60 && !ready; i++) {
  try {
    const r = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(5000) });
    ready = r.ok;
  } catch {
    await new Promise((r) => setTimeout(r, 1000));
  }
}

if (!ready) {
  console.error('FAIL  production server never became healthy\n--- log ---\n' + log);
  child.kill();
  process.exit(1);
}

check(
  'production mode detected without NODE_ENV',
  log.includes('Serving production build'),
  (log.split('\n').find((l) => l.includes('Serving production build')) || '').trim(),
);

const shell = await fetch(`${base}/`);
const shellHtml = await shell.text();
check(
  'GET / serves the built bundle',
  shell.ok && /\/assets\/index-[\w-]+\.js/.test(shellHtml) && !shellHtml.includes('/src/main.tsx'),
  `${shellHtml.length} bytes`,
);

const assetPath = shellHtml.match(/\/assets\/index-[\w-]+\.js/)?.[0];
if (assetPath) {
  const asset = await fetch(`${base}${assetPath}`);
  const body = await asset.text();
  check('built JS asset is served', asset.ok && body.length > 1000, `HTTP ${asset.status}, ${body.length} bytes`);
}

const spa = await fetch(`${base}/some/spa/route`);
check('SPA fallback route returns the shell', spa.ok && (await spa.text()).includes('<div id="root">'), `HTTP ${spa.status}`);

const missingApi = await fetch(`${base}/api/does-not-exist`);
check('unknown /api/* route returns 404 (no SPA fallback)', missingApi.status === 404, `HTTP ${missingApi.status}`);

// `vite` must not be required at runtime in production.
const viteRequired = log.includes('Vite') && log.includes('dev middleware');
check('Vite dev middleware is NOT attached in production', !viteRequired);

console.log('\n--- server log ---');
console.log(log.trim());

child.kill();
// Give the child a moment to release its stdio pipes before this process exits;
// tearing them down too early trips a libuv assertion on Windows.
await new Promise((r) => setTimeout(r, 500));
child.unref();

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} production checks passed.`);
process.exitCode = failed === 0 ? 0 : 1;
