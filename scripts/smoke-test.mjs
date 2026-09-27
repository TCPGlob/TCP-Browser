/**
 * TCP Browser - runtime smoke test.
 *
 * Boots the real server on a free port and exercises every public API route,
 * asserting on real responses. No network access to third-party sites is
 * required for the core assertions (external fetches are best-effort).
 *
 * Usage: node scripts/smoke-test.mjs
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const results = [];
function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` :: ${detail}` : ''}`);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function waitForHealth(base, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  let lastErr = 'no attempt';
  while (Date.now() < deadline) {
    if (exitInfo) throw new Error(`server exited early (code ${exitInfo.code}) — see log above`);
    try {
      const res = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(10_000) });
      if (res.ok) return await res.json();
      lastErr = `HTTP ${res.status}`;
    } catch (err) {
      lastErr = `${err.name}: ${err.message}`;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`server never became healthy: ${lastErr}`);
}

const port = await freePort();
const base = `http://127.0.0.1:${port}`;
console.log(`Booting TCP Browser on ${base}\n`);

const child = spawn(
  process.execPath,
  [path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'), path.join(repoRoot, 'server.ts')],
  {
    cwd: repoRoot,
    env: { ...process.env, PORT: String(port), NODE_ENV: 'development', DISABLE_HMR: 'true' },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

let serverLog = '';
child.stdout.on('data', (d) => { serverLog += d.toString(); });
child.stderr.on('data', (d) => { serverLog += d.toString(); });

let exitInfo = null;
child.on('exit', (code, signal) => { exitInfo = { code, signal }; });

const fail = (msg) => {
  console.error(`\nFATAL: ${msg}`);
  console.error('--- server log ---\n' + serverLog);
  child.kill();
  process.exit(1);
};

try {
  const health = await waitForHealth(base);
  record('GET /api/health returns ok', health?.status === 'ok', JSON.stringify(health));

  // --- SPA shell is served -------------------------------------------------
  const shell = await fetch(`${base}/`);
  const shellHtml = await shell.text();
  record(
    'GET / serves the app shell',
    shell.ok && shellHtml.includes('<div id="root">'),
    `HTTP ${shell.status}, ${shellHtml.length} bytes`,
  );

  // --- PWA assets ----------------------------------------------------------
  const manifest = await fetch(`${base}/manifest.webmanifest`);
  const manifestJson = await manifest.json().catch(() => null);
  record('GET /manifest.webmanifest is valid JSON', !!manifestJson?.name, manifestJson?.name ?? 'invalid');

  const swRes = await fetch(`${base}/sw.js`);
  const swText = await swRes.text();
  record('GET /sw.js served as javascript', swRes.ok && swText.includes('addEventListener'), `HTTP ${swRes.status}`);

  for (const icon of ['/icon-192.png', '/icon-512.png']) {
    const r = await fetch(`${base}${icon}`);
    const buf = Buffer.from(await r.arrayBuffer());
    const isPng = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const width = buf.length > 24 ? buf.readUInt32BE(16) : 0;
    const height = buf.length > 24 ? buf.readUInt32BE(20) : 0;
    const expected = icon.includes('192') ? 192 : 512;
    record(
      `GET ${icon} is a real ${expected}x${expected} PNG`,
      isPng && width === expected && height === expected,
      `png=${isPng} ${width}x${height} (${buf.length} bytes)`,
    );
  }

  // --- Download bundle -----------------------------------------------------
  const zipRes = await fetch(`${base}/api/download/launcher?type=zip`);
  const zipBuf = Buffer.from(await zipRes.arrayBuffer());
  record(
    'GET /api/download/launcher?type=zip returns a ZIP',
    zipRes.ok && zipBuf.subarray(0, 2).toString() === 'PK',
    `HTTP ${zipRes.status}, ${zipBuf.length} bytes, magic=${zipBuf.subarray(0, 2).toString()}`,
  );

  for (const type of ['windows', 'macos', 'linux', 'python', 'node']) {
    const r = await fetch(`${base}/api/download/launcher?type=${type}`);
    const body = await r.text();
    record(
      `GET /api/download/launcher?type=${type} returns text`,
      r.ok && body.length > 50 && !body.includes('undefined'),
      `HTTP ${r.status}, ${body.length} bytes`,
    );
  }

  const pyLauncher = await fetch(`${base}/api/download/launcher?type=python`).then((r) => r.text());
  record(
    'python launcher targets the requesting origin',
    pyLauncher.includes(`APP_URL = "${base}"`),
    pyLauncher.split('\n').find((l) => l.startsWith('APP_URL')) ?? 'no APP_URL line',
  );

  // Host-header injection is covered by scripts/check-host-injection.mjs, which
  // uses a raw socket because fetch() will not let a caller set Host.

  // --- Proxy guard rails ---------------------------------------------------
  const badProxy = await fetch(`${base}/api/proxy-resource`);
  record('GET /api/proxy-resource without url -> 400', badProxy.status === 400, `HTTP ${badProxy.status}`);

  const badProto = await fetch(`${base}/api/proxy-resource?url=${encodeURIComponent('file:///etc/passwd')}`);
  record('GET /api/proxy-resource file:// -> 400', badProto.status === 400, `HTTP ${badProto.status}`);

  const tracker = await fetch(`${base}/api/proxy-resource?url=${encodeURIComponent('https://www.google-analytics.com/analytics.js')}`);
  record('GET /api/proxy-resource tracker -> 204 (silently dropped)', tracker.status === 204, `HTTP ${tracker.status}`);

  // --- Browse endpoint (offline-safe: assertions on error contract) --------
  const browseBad = await fetch(`${base}/api/browse?format=json&url=${encodeURIComponent('https://this-domain-does-not-exist-tcp.invalid')}`, {
    headers: { Accept: 'application/json' },
  });
  const browseBadJson = await browseBad.json().catch(() => null);
  record(
    'GET /api/browse on unreachable host returns JSON error (no crash)',
    browseBad.status >= 500 && browseBadJson?.success === false && typeof browseBadJson.error === 'string',
    `HTTP ${browseBad.status} ${JSON.stringify(browseBadJson)}`,
  );

  const browseBlocked = await fetch(`${base}/api/browse?format=json&url=${encodeURIComponent('http://169.254.169.254/latest/meta-data/')}`, {
    headers: { Accept: 'application/json' },
  });
  const browseBlockedJson = await browseBlocked.json().catch(() => null);
  record(
    'GET /api/browse blocks cloud-metadata addresses (SSRF guard)',
    browseBlocked.status === 400 && browseBlockedJson?.success === false,
    `HTTP ${browseBlocked.status} ${JSON.stringify(browseBlockedJson)}`,
  );

  const handleBrowseLive = async (target, label) => {
    try {
      const r = await fetch(`${base}/api/browse?format=json&url=${encodeURIComponent(target)}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(40_000),
      });
      const json = await r.json().catch(() => null);
      const ok = r.ok && json?.success === true && typeof json.htmlContent === 'string' && json.htmlContent.length > 0;
      record(`GET /api/browse live: ${label}`, ok, ok ? `title="${json.title}" ${json.stats?.cleanSizeKb}KB, ${json.stats?.trackersBlocked} trackers` : `HTTP ${r.status} ${JSON.stringify(json)?.slice(0, 200)}`);
      return json;
    } catch (err) {
      record(`GET /api/browse live: ${label}`, false, `network unavailable: ${err.message}`);
      return null;
    }
  };

  const example = await handleBrowseLive('https://example.com', 'example.com');
  if (example?.htmlContent) {
    record('browse response injects the navigation interceptor', example.htmlContent.includes('tcp-nav-interceptor'));
    record('browse response injects a <base href>', /<base href="https:\/\/example\.com\/?">/i.test(example.htmlContent));
    record('browse response strips no-op trackers cleanly', typeof example.stats?.trackersBlocked === 'number');
    record(
      'injected interstitial posts a single navigate message per click',
      !example.htmlContent.includes('BAREBONES_NAVIGATE'),
    );
    record(
      'injected interstitial proxies through the app origin, not the target',
      example.htmlContent.includes('/api/proxy-resource?url='),
    );

    const zeroJs = await fetch(`${base}/api/browse?format=json&mode=zero-js&url=${encodeURIComponent('https://example.com')}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(40_000),
    }).then((r) => r.json()).catch(() => null);
    if (zeroJs?.success) {
      record(
        'zero-js mode removes every script tag',
        !/<script[\s>]/i.test(zeroJs.htmlContent),
        `${(zeroJs.htmlContent.match(/<script/gi) || []).length} script tags remain`,
      );
      record(
        'zero-js mode produces no javascript: URLs',
        !/javascript:/i.test(zeroJs.htmlContent),
      );
    }

    const textOnly = await fetch(`${base}/api/browse?format=json&mode=text-only&url=${encodeURIComponent('https://example.com')}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(40_000),
    }).then((r) => r.json()).catch(() => null);
    if (textOnly?.success) {
      record(
        'text-only mode replaces media with text placeholders',
        !/<img[\s>]/i.test(textOnly.htmlContent),
      );
    }
  }

  const article = await handleBrowseLive('https://en.wikipedia.org/wiki/Transmission_Control_Protocol', 'wikipedia (reader mode target)');
  if (article) {
    const readerRes = await fetch(`${base}/api/browse?format=json&mode=reader&url=${encodeURIComponent('https://en.wikipedia.org/wiki/Transmission_Control_Protocol')}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(40_000),
    }).catch(() => null);
    if (readerRes) {
      const readerJson = await readerRes.json().catch(() => null);
      record(
        'reader mode returns readerData payload',
        readerJson?.success === true && !!readerJson.readerData?.textContent,
        readerJson ? `words≈${readerJson.readerData?.textContent?.split(/\s+/).length ?? 0}` : 'no response',
      );
    }
  }

  // --- Export snapshot -----------------------------------------------------
  const exp = await fetch(`${base}/api/export-snapshot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Test Page', url: 'https://example.com', htmlContent: '<html><body>hi</body></html>' }),
  });
  record(
    'POST /api/export-snapshot returns an html attachment',
    exp.ok && (exp.headers.get('content-disposition') || '').includes('attachment'),
    `HTTP ${exp.status} ${exp.headers.get('content-disposition')}`,
  );

  const expNoBody = await fetch(`${base}/api/export-snapshot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  record('POST /api/export-snapshot without html -> 400', expNoBody.status === 400, `HTTP ${expNoBody.status}`);
} catch (err) {
  fail(err.message);
}

console.log('\n--- server log ---');
console.log(serverLog.trim() || '(no output)');

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (exitInfo && exitInfo.code !== 0 && exitInfo.code !== null) {
  console.log(`WARNING: server exited early with code ${exitInfo.code}`);
}

child.kill();
await new Promise((r) => setTimeout(r, 300));
process.exit(failed.length === 0 ? 0 : 1);
