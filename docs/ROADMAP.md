# TCP Browser — Roadmap: Credible Benchmarks + Agent/Headless Niche

**Pinned to `main` @ `ae7d666`** (37 tracked files, `server.ts` 1263 lines).

Two workstreams, in this order:

- **Track A — Replace invented metrics with measured ones.** Ships first. It needs no
  restructuring, kills the biggest credibility liability, and produces the numbers that
  make Track B marketable.
- **Track B — Own the "browser for agents/headless" niche.** Depends on A only in the
  sense that you want honest numbers before you go asking people to point agents at
  this. Its real prerequisite is the engine extraction in **Phase B0**, which is
  unavoidable: the sanitiser currently lives inside an Express route handler.

Estimated effort is calendar time for one focused developer, not token counts.

---

## Why this order

`estimatedRamMb`, `ramSavedPercent` and the GPU figures are currently **modelled
constants** in `server.ts` (harvested from page size and DOM node count). They are
presented as measurements. Anyone technical who inspects them finds `estimatedRamMb = 14`
hardcoded and stops trusting the rest of the project. That is the single highest-value
thing to fix, and it is cheap.

Track B is where the project stops being "a nice HTML-proxy reimplementation" and starts
having a reason to exist: a **sanitiser with a first-class programmatic API**. No
well-packaged option exists for "give an agent clean page content without the tracker
blast radius." Per-site front-ends (SearXNG, Invidious) are not general. `fetch` +
Readability is general but does no sanitising, no rendering, no isolation.

---

# Track A — Measured, reproducible benchmarks

## The honesty problem, stated precisely

There are two different questions, and only one of them is answerable cheaply:

| Question | Answerable? | How |
| --- | --- | --- |
| How much **network traffic** does TCP Browser avoid? | **Yes, exactly.** | Count bytes through a measuring proxy, or sum the served document size vs. the raw document size. |
| How much **server time** does sanitising cost and save? | **Yes, exactly.** | `performance.now()` around fetch and around the cheerio pipeline. |
| How large is the **DOM** after sanitising? | **Yes, exactly.** | Real node count reported from the rendered frame (already implemented, `TCP_FRAME_METRICS`). |
| How much **RAM/GPU** does a tab use? | **Not from JavaScript.** | `performance.memory` is a coarse, blurred, Chromium-only heap figure and does not cover an iframe's renderer properly. GPU utilisation is not exposed to page JS at all. |
| Does it reduce **system memory** vs. the same page in Chrome? | **Yes, with headless Chrome.** | Read the renderer process RSS from the OS while a controlled page is loaded. |

So the plan has two tiers: **Tier 1** replaces the fake numbers with exact ones that
need no browser instrumentation, and **Tier 2** produces real RAM/network figures in a
reproducible harness for the README.

**Design rule to carry through everything below:** every number in the API and UI gets a
`source` field — `"measured"`, `"modelled"`, or `"unavailable"`. The UI renders modelled
values with a visible `est.` marker and a tooltip explaining the basis. Never again
present a model as a measurement.

## Phase A1 — Exact server-side metrics (small, ~half a day)

**Files touched:** `server.ts`

- Wrap the two stages in `performance.now()` and add to the `/api/browse` JSON payload:
  - `timings.upstreamMs` — DNS + TLS + TTFB + body read from the target site
  - `timings.sanitizeMs` — cheerio load, tracker removal, rewrite, serialise
  - `timings.totalMs` — existing `loadDurationMs`, kept
- Add `transfer.rawBytes` / `transfer.sanitizedBytes` (already computable from
  `originalSizeKb`/`cleanSizeKb` — expose exact bytes, not rounded KB).
- Add `content.scriptsRemoved`, `content.nodesRemoved`, `content.trackersBlocked`,
  `content.thirdPartyHostsRemoved` (distinct hosts dropped from `src`/`href`).
- Add `metrics.source: 'measured'` to the existing DOM node count path.

**Acceptance:** `/api/browse?format=json` returns real, non-round numbers that change
between two runs against the same URL.

## Phase A2 — Reframe the RAM/GPU fields honestly (small, ~half a day)

**Files touched:** `src/types.ts`, `src/App.tsx`, `src/components/ShieldModal.tsx`,
`src/components/PerformanceBadge.tsx`, `src/components/ProcessTrackerModal.tsx`,
`src/components/NewTabPage.tsx`, `src/components/BrowserViewport.tsx`

This is mostly deletion, which is why it is worth doing.

- Replace `estimatedRamMb` / `chromeRamEstimateMb` / `ramSavedPercent` /
  `estimatedGpuPercent` / `chromeGpuEstimatePercent` with an explicit, smaller shape:

  ```ts
  export interface SecurityStats {
    // ...existing measured fields...
    measurements: {
      upstreamMs: number;
      sanitizeMs: number;
      totalMs: number;
      rawBytes: number;
      sanitizedBytes: number;
      bytesAvoided: number;      // raw - sanitized, exact
      trackersBlocked: number;
      scriptsRemoved: number;
      thirdPartyHostsRemoved: number;
      domNodes: number | null;   // null until the frame reports
    };
    processFootprint: {
      source: 'measured' | 'modelled';
      rendererMb: number | null; // null unless a benchmark supplied it
      note: string;              // human-readable basis
    };
  }
  ```

- ShieldModal: show **"Payload: 2.4 MB → 812 KB (66% smaller)"** sourced from exact byte
  counts, plus sanitise time, plus tracker/script counts. Drop the RAM/GPU comparison
  cards entirely.
- PerformanceBadge: replace `RAM: ~14 MB (96% saved vs Chrome)` with
  **`Payload saved: 1.6 MB • 34 trackers blocked • sanitised in 82 ms`**.
- ProcessTrackerModal: the whole per-process CPU/GPU table is generated from a
  `pulseTick` sine wave and mode multipliers — it is staged data presented as live
  telemetry. Either (a) relabel the panel as a **simulation/preview** with a visible
  banner and keep the freeze/kill/purge controls (which *are* real), or (b) rebuild the
  columns around real signals: DOM nodes, sanitise time, payload bytes, tab state.
  Recommend (b), with real columns first and the animated ones clearly marked.
- Delete `pulseTick`-driven CPU/GPU numbers from anything labelled "live monitoring".
- NewTabPage: `GPU Load 0%–1%` and `Privacy Shield Active` cards become
  `Payload avoided` (from real session bytes) and `Trackers blocked`.

**Acceptance:** `grep -rn "estimatedRamMb\|ramSavedPercent\|chromeRam" src/` returns
nothing. No UI string claims a RAM or GPU saving without a `source` of `measured`.

## Phase A3 — Benchmark harness (large, ~3–4 days)

**New files:** `bench/run.mjs`, `bench/measuring-proxy.mjs`, `bench/collect-rss.mjs`,
`bench/report.mjs`, `bench/targets.json`, `bench/README.md`

**Dependencies added (dev only):** `playwright` (or `puppeteer-core` + a Chrome path).
Playwright is the recommendation: it manages its own Chromium revision, which makes the
numbers reproducible instead of dependent on whatever Chrome the machine happens to have.

### A3.1 Measuring proxy

A tiny local HTTP/HTTPS forward proxy that counts, per client connection:
`requests`, `bytesUp`, `bytesDown`, and the set of distinct destination hosts. Chromium is
launched with `--proxy-server=127.0.0.1:<port>` and an ignored certificate-error handler,
so **every** request a page makes — including third-party beacons — is counted.

This is the only way to get an honest "how many third-party requests did this page
actually emit" figure, and it is the number that makes the privacy claim concrete.

### A3.2 Chrome baseline measurement

For each target URL:

1. Launch headless Chromium with the measuring proxy, a fresh profile, and
   `--js-flags=--expose-gc`.
2. Navigate, wait for `networkidle` + a settle delay.
3. Read counters from the proxy.
4. Read resident memory of the renderer process tree from the OS:
   - Windows: `Get-CimInstance Win32_Process` filtered to the browser's child PIDs, or
     `tasklist /FI "PID eq <pid>"`.
   - macOS/Linux: `ps -o rss= -p <pids>` over the process group.
5. Close, force GC where possible, repeat N times, discard the first (warm-up) run.

### A3.3 TCP Browser measurement

For the same URL:

1. Start the TCP Browser server on a free port.
2. `GET /api/browse?format=json&mode=<mode>` and record `timings.sanitizeMs`,
   `timings.upstreamMs`, `transfer.rawBytes`, `transfer.sanitizedBytes`.
3. Launch headless Chromium **with the measuring proxy**, load
   `<server>/api/browse?...&mode=<mode>` as a document (the server's non-JSON path,
   which serves the sanitised HTML directly — this exercises the real render path), and
   measure the same proxy counters and renderer RSS.

**Critical:** the TCP run must be measured the same way as the Chrome run — same browser,
same proxy, same wait conditions. Comparing "Chrome loading the real page" against "a
number the server computed" is not a comparison.

### A3.4 Interleaving and statistics

Run `chrome, tcp, chrome, tcp, …` rather than all of one then all of the other, so a
thermal or background-load drift affects both. Report **median, min, max, n** per metric,
never a single sample. Report absolute values *and* the ratio.

### A3.5 Two modes of operation

- **`--fixture` (default, required for CI):** measure against pages served from a local
  fixture server (`bench/fixtures/*.html`) containing a known number of fake tracker
  `<script>`/`<img>`/`<iframe>` tags. Deterministic, offline, no third-party dependency,
  works forever. This is what proves the harness itself works.
- **`--live` (opt-in):** measure against a curated list of real news/encyclopedia URLs.
  Results vary with the internet, so these numbers get published with a date stamp and
  the commit hash, not as a stable claim.

### A3.6 Output

- `bench/results/<timestamp>.json` — raw per-run samples, so anyone can re-analyse.
- `bench/results/latest.md` — generated report.
- `BENCHMARKS.md` at the repo root — committed, generated, header stating exactly:
  platform, CPU, RAM, OS build, Node version, Playwright/Chromium version, commit hash,
  date, target list, N, and the methodology in plain language.

**Acceptance:** `node bench/run.mjs --fixture` runs offline and produces a report; the
numbers reproduce within a few percent across three consecutive invocations.

## Phase A4 — Publication and messaging (small, ~half a day)

- Add a `Benchmarks` section to `README.md` linking `BENCHMARKS.md`, with a two-sentence
  honest summary: *"On the fixture set, TCP Browser emits N requests versus M for the same
  page in Chromium, and transfers X KB versus Y KB. Renderer memory is Z MB versus W MB.
  Numbers are medians of N runs on <machine>; run `node bench/run.mjs` to reproduce."*
- Add a **"What we do not measure"** subsection: GPU utilisation (not measurable from
  page context), long-session memory growth, battery impact. This is the paragraph that
  buys credibility.
- Add `npm run bench` and `npm run bench:live` scripts.
- Update the repo description and the first README paragraph to lead with *sanitisation
  and isolation*, not memory.
- Delete every remaining quantitative marketing claim that is not backed by a generated
  number: `ConvertSoftwareModal.tsx` lines claiming "96% Memory Reduction", "~14 MB
  (96% less)", "< 1%", "Instant (0.2s)", "2.4s–4.2s", "3.2x longer battery life".

**Track A total: roughly 5–6 focused days.**

---

# Track B — Own the agent/headless niche

## The strategic claim (be precise about it)

Not "a browser for AI agents" as a product. The defensible framing:

> **A page-fetching API and CLI that returns sanitised, isolated, reader-mode content
> ready to feed to a model or an automation pipeline — with the tracker blast radius
> removed at the source and no third-party requests leaving the host.**

Existing options and why each leaves a gap:

- `fetch(url)` + Readability: no sanitising, no isolation, no rendering, you build the
  plumbing and the SSRF guard yourself every time.
- Playwright/Puppeteer headless: runs every tracker, needs an anti-bot arms race, heavy.
- SearXNG / Invidious / Nitter: per-service, not general, and they are search fronts.
- Firecrawl / Jina Reader (hosted): genuinely good, but SaaS, rate-limited, your URLs
  pass through someone else's infrastructure.
- `llm-scraper`, `crawl4ai`: closer, but they treat sanitising as optional.

The gap is a **self-hosted, general-purpose, sanitise-first fetch layer with an MCP
interface.** That is a real niche and it is unclaimed.

## Phase B0 — Extract the engine (prerequisite, ~2 days)

**This is the blocker for everything else in Track B, and it is the riskiest part.**

Right now the sanitiser is inlined in `handleBrowseRequest` (`server.ts` ~384–925), a
540-line Express handler mixing HTTP concerns with content transformation. Nothing else
can use it.

**New layout:**

```
packages/
  core/                     @tcp-browser/core  (publishable, zero Express dependency)
    src/
      index.ts              public surface
      fetch-page.ts         fetch + redirects + timeout + cookie jar + SSRF guard
      sanitize.ts           the cheerio pipeline
      tracker-rules.ts      TRACKER_PATTERNS, TRACKING_QUERY_PARAMS
      reader.ts             extractReaderContent
      url.ts                resolveTargetUrl, sanitizeUrl, isBlockedTarget
      cookies.ts            jar
      types.ts
    package.json
  mcp/                      @tcp-browser/mcp   (Phase B3)
  cli/                      @tcp-browser/cli   (Phase B2)
apps/
  web/                      current src/ + index.html
server.ts                   thin Express adapter over packages/core
```

**Monorepo mechanics:** npm workspaces (no new tooling, no pnpm/turbo needed for three
packages). Root `package.json` gains `"workspaces": ["packages/*", "apps/*"]`. Vite is
configured per app. `tsconfig.json` gains project references, or a simple `paths` mapping
to `packages/core/src` — recommend the latter for speed, references if you want build
isolation.

**The refactor itself:**

1. Move the pure functions out verbatim. They already have clean signatures:
   `sanitizeUrl`, `resolveTargetUrl`, `isTrackerUrl`, `isBlockedTarget`,
   `extractReaderContent`, `escapeHtml`, `getCookiesForUrl`, `storeCookiesFromResponse`,
   `TRACKER_PATTERNS`, `TRACKING_QUERY_PARAMS`, `DATA_SCRIPT_TYPES`,
   `BLOCKED_HOST_PATTERNS`.
2. Define the seam the handler needs:

   ```ts
   export interface FetchPageOptions {
     url: string;
     mode: RenderingMode;
     searchEngine?: SearchEngine;
     disableImages?: boolean;
     lowGpu?: boolean;
     stripUtmParams?: boolean;
     blockFingerprinting?: boolean;
     disableAutoplay?: boolean;
     postData?: Record<string, string>;
     timeoutMs?: number;
     cookieJar?: CookieJar;
     appOrigin: string;          // needed for the injected interceptor
     signal?: AbortSignal;
   }

   export interface FetchPageResult {
     success: true;
     targetUrl: string;          // after redirects
     displayUrl: string;
     title: string;
     favicon: string;
     mode: RenderingMode;
     html: string;               // sanitised document (or reader document)
     reader: ReaderData | null;
     text: string;               // extracted plain text (new; needed by the CLI/MCP)
     markdown: string;           // new; needed by agents
     links: Array<{ text: string; href: string }>;   // new
     measurements: Measurements; // from Track A
     trackerList: TrackerItem[];
   }

   export function fetchPage(options: FetchPageOptions): Promise<FetchPageResult>;
   export function sanitizeHtml(html: string, ctx: SanitizeContext): SanitizeResult;
   ```

3. `server.ts` becomes an adapter: parse query/body, build `FetchPageOptions`, call
   `fetchPage`, JSON-encode or `res.send(result.html)`.
4. Add `text` extraction and a **`markdown`** renderer (headings, paragraphs, lists,
   links, code, tables → GFM). This is the artefact agents actually want and it does not
   exist yet. Roughly 150 lines with cheerio; no new dependency needed.
5. Add `links` collection (deduped, absolute) for agent navigation.

**Acceptance criteria — non-negotiable:**

- `npm run lint` clean.
- `npm test` still 31/31.
- `npm run build` + `npm run test:prod` still pass.
- **No behaviour change** in the web app. This phase is a pure refactor; if any test
  needs editing to pass, the refactor is wrong.
- `packages/core` has no `express` import (`grep -r "express" packages/core/src` empty).

## Phase B1 — Agent-facing HTTP API (~2 days)

**New in `server.ts` (thin, over `packages/core`):**

| Endpoint | Purpose |
| --- | --- |
| `POST /api/v1/fetch` | Body: `{ url, mode?, format?, ...options }`. Returns the full structured result. |
| `POST /api/v1/extract` | Shorthand returning `{ title, byline, markdown, text, links, measurements }` only — no HTML. |
| `GET  /api/v1/fetch?url=…&format=markdown` | Same, GET-friendly for curl. |
| `POST /api/v1/batch` | Up to N URLs, concurrency-limited, per-item success/error. |
| `GET  /api/v1/health` | Extends existing `/api/health` with version, feature flags, auth mode. |

**Formats:** `html` (sanitised document), `reader` (reader doc), `markdown`, `text`,
`links`, `json` (all of it). Default for `/extract`: `markdown`.

**Response envelope** (stable, versioned, documented):

```json
{
  "success": true,
  "requestUrl": "https://example.com/article",
  "finalUrl": "https://example.com/article",
  "title": "…",
  "byline": "…",
  "publishedAt": null,
  "markdown": "# …",
  "text": "…",
  "links": [{ "text": "…", "href": "https://…" }],
  "measurements": { "...": "from Track A" },
  "blocked": [{ "name": "Google Analytics / GTM", "category": "analytics", "domain": "…" }],
  "meta": { "mode": "reader", "format": "markdown", "durationMs": 412, "core": "1.0.0" }
}
```

**Also required:**

- Keep `/api/browse` working unchanged for the web UI. Do not break the app to add an API.
- `?format=` must be validated against an allowlist; unknown → 400 with the allowed list.
- Big-response guard: cap serialised JSON at a configurable size, return 413 with a hint
  to use `format=markdown`.
- Per-request timeout honoured from `options.timeoutMs`, clamped to a max.
- Concurrency limiter on `/batch` (simple semaphore, configurable).

**Acceptance:** `curl -X POST localhost:3000/api/v1/extract -d '{"url":"https://en.wikipedia.org/wiki/Transmission_Control_Protocol"}' -H 'content-type: application/json' | jq .markdown | head` returns clean GFM and no boilerplate. New tests in `scripts/` covering the contract, every format, error envelopes and the allowlist.

## Phase B2 — CLI (~1.5 days)

**New package:** `packages/cli`, exposing a `tcp-browser` bin. Zero new runtime
dependencies (arg parsing by hand, or `node:util.parseArgs` — built in since Node 18.3,
so use it).

```
tcp-browser fetch <url> [--mode reader|shield|zero-js|text-only]
                        [--format markdown|text|html|links|json]
                        [--no-images] [--timeout 20000] [--json]
tcp-browser extract <url>            # alias for fetch --format markdown
tcp-browser links <url>
tcp-browser blocked <url>            # what would be stripped, without rendering
tcp-browser serve [--port] [--api-key]   # boots the HTTP API only
tcp-browser --version | --help
```

Behaviours that matter:

- **In-process by default.** The CLI imports `packages/core` directly — no server needed,
  no port, works in a container with nothing running. This is the single biggest
  ergonomic win over "start the server then curl it".
- `--server <url>` mode to talk to a remote instance instead.
- Exit codes: `0` success, `1` fetch/parse failure, `2` usage error, `3` blocked target.
  Scriptable.
- stdout is the content only; every diagnostic goes to stderr, so
  `tcp-browser extract <url> > page.md` is clean.
- Piping: reads URLs from stdin one per line with `-`.

**Acceptance:** `npx tcp-browser extract https://example.com` works from a clean
checkout with no server running, and `tcp-browser extract <url> > x.md` produces a file
with no diagnostics in it.

## Phase B3 — MCP server (~3 days) ← the actual niche claim

**New package:** `packages/mcp`, bin `tcp-browser-mcp`. This is what makes it usable by
Claude Desktop, Claude Code, Cursor, Cline, Windsurf, and any other MCP client, which is
where the agent audience already lives.

**Dependency:** `@modelcontextprotocol/sdk`. First new runtime dependency in the project —
justified, since hand-rolling the protocol is a maintenance trap.

**Tools to expose (small, sharp, well-described):**

| Tool | Input | Returns |
| --- | --- | --- |
| `fetch_page` | `url`, `mode?`, `format?` | Sanitised content in the requested format |
| `extract_article` | `url` | Title, byline, markdown, link list |
| `get_links` | `url`, `filter?` | Deduped absolute links with anchor text |
| `inspect_blocking` | `url` | Tracker list and counts, **without** rendering the page |
| `batch_fetch` | `urls[]`, `format?` | Per-URL results, concurrency-capped |

**Transports:**

- **stdio** (primary) — how every MCP client launches local servers. This is the one that
  must work.
- **Streamable HTTP** (secondary, opt-in via `--http --port`) — for hosted/shared use.
  Requires `--api-key`; refuse to start without one, since it is an open proxy.

**Tool-description quality is the product here.** The descriptions are what the model
reads to decide when to call the tool. Each needs: what it does, when to use it, when
*not* to (e.g. "not for pages requiring login; Google sign-in is blocked by frame
policy"), and the shape of the return. Budget real time for this; it is the difference
between the tool being used correctly and being ignored.

**Also required:**

- Server must run standalone (in-process core, no separate TCP Browser server needed),
  with `--server <url>` to proxy to a remote one.
- Structured errors: `TIMEOUT`, `BLOCKED_TARGET`, `TOO_LARGE`, `UPSTREAM_4XX/5XX`,
  `NO_CONTENT` — agents need machine-readable failures, not stack traces.
- Content size guard: truncate markdown at a configurable limit with an explicit
  `truncated: true` flag, so a model never silently receives half a page.
- A `README.md` in the package with a copy-pasteable client config block:

  ```json
  { "mcpServers": { "tcp-browser": { "command": "npx", "args": ["-y", "@tcp-browser/mcp"] } } }
  ```

**Acceptance:** verified against at least two real MCP clients (Claude Code and one of
Cursor/Cline), with the tool list visible and `extract_article` returning usable markdown
for a Wikipedia article and a news article.

## Phase B4 — Make it safe to actually expose (~2 days)

An agent-facing open proxy is a materially worse idea than a local browsing toy. This
phase is not optional if you publish the HTTP mode.

- **API keys.** `TCP_API_KEYS` env (comma-separated) or `--api-key`. `Authorization:
  Bearer …` or `X-API-Key`. Constant-time comparison (`crypto.timingSafeEqual`).
  Unset → the API endpoints require a key whenever the bind address is not loopback, and
  refuse to start otherwise. This is the right default; do not make it opt-in.
- **Rate limiting.** Token bucket per key, configurable rps and burst; `429` with
  `Retry-After`. In-memory is fine; document that it is per-instance.
- **Concurrency ceiling** on outbound fetches, so one caller cannot exhaust sockets.
- **Response size cap** and streaming cut-off.
- **`robots.txt`** — decide and document. Recommend: honour it by default for the API and
  CLI (`--ignore-robots` to override), with the reasoning written down. Do not silently
  ignore it while marketing the thing as ethical infrastructure.
- **Retain the SSRF guard** and re-verify it in the new code path — it currently lives in
  `server.ts` and must move into `packages/core` without regression.
- **Dockerfile + `docker-compose.yml`** so self-hosting is one command, with the API key
  as a required variable and a non-root user.
- **Structured audit logging** (opt-in): method, target host, status, duration, caller key
  id — never full URLs by default, since those are the sensitive part.

**Acceptance:** unauthenticated request to a non-loopback bound instance is rejected;
rate limit returns 429; a private-IP target is still refused; the container starts and
serves a successful extract with a key.

## Phase B5 — Docs and positioning (~2 days)

- `README.md`: restructure into three entry points — **Use it as a browser** (existing),
  **Use it from an agent** (MCP config + curl examples), **Use it as a library**
  (`npm i @tcp-browser/core`).
- `docs/api.md` — the `/api/v1` surface, verbatim request/response examples, every error
  code, auth, limits.
- `docs/mcp.md` — each tool with an example prompt, plus a "when not to use this" list.
- `docs/architecture.md` — the request lifecycle, why the sanitiser is in the middle, the
  sandbox model, and the trust boundary (self-hosted vs. hosted), with the failure modes
  named.
- `examples/` — working snippets: LangChain tool, a plain `fetch` script, a shell one-liner,
  a Cursor config.
- Repo description and topics updated: `mcp`, `model-context-protocol`, `llm-tools`,
  `sanitizer`, `reader-mode`, `privacy`, `headless`. Topics are how the audience finds this.
- A short demo: a terminal recording of an agent fetching a tracker-heavy page and
  receiving clean markdown, with the blocked-tracker count visible. This is the artefact
  that makes the niche claim legible in ten seconds.

**Track B total: roughly 12–14 focused days**, of which B0 is the risky 2.

---

# Sequencing and dependencies

```
Track A:  A1 ──▶ A2 ──▶ A4
                 A3 ──▶ A4          (A3 can run in parallel with A2)
Track B:  B0 ──▶ B1 ──▶ B2
                 └────▶ B3 ──▶ B4 ──▶ B5
```

- A1 before A3: the harness consumes the exact byte/timing fields A1 adds.
- A3 is independent of A2 and can be parallelised.
- **B0 before everything in B.** It is the only unavoidable structural work, and doing it
  second means redoing it.
- B3 is the strategic payoff; B1 and B2 are the cheap on-ramps that share the same core.
- B4 before any public HTTP deployment — treat as a release gate, not a nice-to-have.

**Total: roughly 17–20 focused days** for both tracks. A useful split: Track A alone is
about a week, and it is the part that makes the repo defensible to a critical reader
immediately, so it is worth finishing and shipping before starting B0.

---

# Decisions needed before starting

1. **Does `npm install` need to stay network-restricted?** If the environment that built
   this cannot fetch new packages, Phase A3 (Playwright) and B3 (`@modelcontextprotocol/sdk`)
   are blocked. Track A1/A2/A4 and B0/B1/B2 need **no new dependencies at all** and can
   proceed regardless. This is the single most important unknown.
2. **Publish to npm, or GitHub only?** Publishing `@tcp-browser/core`, `@tcp-browser/cli`
   and `@tcp-browser/mcp` is what makes `npx @tcp-browser/mcp` work in someone's MCP
   config. GitHub-only means installs are `git clone` + local paths. Recommend npm for
   the packages, with the app staying a repo you clone.
3. **Scope of the benchmark:** fixture-only (deterministic, ships in CI, no third-party
   traffic) or fixture + live (more persuasive, not reproducible)? Recommend both, with
   only fixture numbers in CI and live numbers in `BENCHMARKS.md` with a date stamp.
4. **Monorepo layout:** adopt `packages/` + `apps/` (recommended, needed for B2/B3 to be
   independently installable) or keep one package and add `bin` entries to it (simpler,
   but couples the app's dependency tree to the agent tooling)?
5. **`robots.txt` policy** for the API/CLI: honour by default (recommended, and defensible
   in public), or ignore with a documented rationale?
6. **Is a GPU figure wanted at all?** It cannot be measured from a page context. The
   honest options are to drop it entirely (recommended) or to report Chrome's GPU process
   memory from the benchmark only, clearly labelled as a benchmark artefact.

---

# Definition of done

**Track A**

- No invented metric is displayed anywhere in the UI.
- Every number carries a `source` of `measured`, `modelled` or `unavailable`.
- `node bench/run.mjs --fixture` reproduces offline and writes `BENCHMARKS.md`.
- `BENCHMARKS.md` contains machine specs, methodology, N, and a "what we do not measure"
  section.
- No remaining unsourced percentage or megabyte claim in `src/`.

**Track B**

- `npx @tcp-browser/cli extract <url>` yields clean markdown with no server running.
- `npx @tcp-browser/mcp` works in at least two real MCP clients.
- `/api/v1/extract` returns the documented envelope, with tests covering every format and
  error code.
- The HTTP API refuses to bind publicly without a key, rate-limits, and still blocks
  private targets.
- The repo README has an "Use it from an agent" section a stranger can follow in under
  two minutes.
