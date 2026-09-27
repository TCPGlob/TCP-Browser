/**
 * Verifies that a crafted Host header cannot inject commands into the generated
 * launcher scripts. Uses a raw socket because fetch() refuses to set Host.
 *
 * Usage: node scripts/check-host-injection.mjs
 */
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const port = await new Promise((resolve) => {
  const srv = net.createServer();
  srv.listen(0, '127.0.0.1', () => {
    const { port } = srv.address();
    srv.close(() => resolve(port));
  });
});

const child = spawn(
  process.execPath,
  [path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'), path.join(repoRoot, 'server.ts')],
  { cwd: repoRoot, env: { ...process.env, PORT: String(port), NODE_ENV: 'development', DISABLE_HMR: 'true' }, stdio: ['ignore', 'pipe', 'pipe'] },
);
child.stdout.resume();
child.stderr.resume();

const base = `http://127.0.0.1:${port}`;
let ready = false;
for (let i = 0; i < 90 && !ready; i++) {
  try {
    const r = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(5000) });
    ready = r.ok;
  } catch {
    await new Promise((r) => setTimeout(r, 1000));
  }
}
if (!ready) {
  child.kill();
  console.error('server never started');
  process.exit(1);
}

const fetchWithHost = (host) => new Promise((resolve, reject) => {
  const req = http.request(
    { host: '127.0.0.1', port, path: '/api/download/launcher?type=windows', method: 'GET', headers: { Host: host } },
    (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve(body));
    },
  );
  req.on('error', reject);
  req.end();
});

const payload = 'evil.example.com;calc;#';
const body = await fetchWithHost(payload);
const startLine = (body.split('\n').find((l) => l.includes('start ""')) || '').trim();

const injected = body.includes('evil.example.com') || body.includes('calc');
const fellBack = body.includes(`localhost:${port}`);

console.log(`${injected || !fellBack ? 'FAIL' : 'PASS'}  crafted Host header neutralised`);
console.log(`      crafted Host : ${payload}`);
console.log(`      generated    : ${startLine.slice(0, 120)}`);
console.log(`      fell back to : localhost:${port} -> ${fellBack}`);

// Also confirm a legitimate Host is honoured.
const legit = await fetchWithHost(`127.0.0.1:${port}`);
const legitOk = legit.includes(`--app="http://127.0.0.1:${port}"`);
console.log(`${legitOk ? 'PASS' : 'FAIL'}  legitimate Host header preserved`);

child.kill();
await new Promise((r) => setTimeout(r, 200));
process.exit(injected || !fellBack || !legitOk ? 1 : 0);
