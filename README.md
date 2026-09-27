<div align="center">

# TCP Browser

**A privacy-first browser front-end that lives in your browser.**

Every page is fetched server-side, stripped of trackers and telemetry, then rendered
into a locked-down sandbox — with Reader, Zero-JS and Text-only profiles when you
want even less.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](package.json)

</div>

---

## What it is

TCP Browser is a self-hosted web application that behaves like a browser: it has
tabs, an omnibox, bookmarks, history, back/forward, a process manager and a
privacy inspector. When you navigate somewhere, the **server** fetches the page,
removes known tracking scripts and pixels, scrubs tracking query parameters
(`utm_*`, `fbclid`, `gclid`, …), and hands back a sanitised document that the
client renders inside a sandboxed frame.

That architecture is the whole point: the page never gets to run with access to
the application's own origin, and the page never talks to an ad network directly.

## What it is not

Be clear about the boundaries before you deploy this:

- **It is not a native browser.** It runs inside a normal browser tab. There is no
  engine, no network stack of its own, and no OS-level process isolation.
- **Many sites cannot be embedded.** Anything sending `X-Frame-Options: DENY` or a
  restrictive `frame-ancestors` CSP (Google sign-in, most banks, some news sites)
  will refuse to render in the frame. Use **Open in Native Window** for those.
- **It is an open proxy by design.** `/api/browse` fetches arbitrary URLs
  server-side. Before exposing it to the internet, read [Security](#security).
- **The performance numbers in the UI are estimates, not measurements.** Memory and
  GPU figures are modelled from page size and DOM node counts. Treat them as
  indicative.

## Quick start

```bash
git clone <your-fork-url> tcp-browser
cd tcp-browser
npm install
npm run dev
```

Open the URL printed on startup (default <http://localhost:3000>).

No `.env` file and no API keys are required. Node 18 or newer is the only
prerequisite.

### Changing the port

Port 3000 is popular, so TCP Browser tells you clearly when it is taken:

```bash
# macOS / Linux
PORT=3101 npm run dev

# Windows PowerShell
$env:PORT=3101; npm run dev
```

### Production

```bash
npm install          # dev dependencies are needed to build
npm run build        # emits dist/ (client bundle + dist/server.cjs)
npm start            # serves dist/
```

`npm start` auto-detects the production bundle. Set `NODE_ENV=production`
explicitly to make a missing build a hard error instead of falling back to dev
mode.

## Rendering profiles

| Profile | What it does | Typical use |
| --- | --- | --- |
| **Shield** | Keeps the page's own scripts, removes known trackers, ads and beacon pixels, strips tracking URL parameters | Default; normal browsing |
| **Direct** | Loads the site unproxied straight into the frame | Sites that break when sanitised |
| **Reader** | Extracts the article, discards navigation/ads/scripts, renders it in an isolated frame with light/sepia/dark/slate themes | Long-form reading |
| **Zero-JS** | Removes every script, inline handler and `javascript:` URL; rewrites links to absolute URLs | Maximum safety |
| **Text Only** | Zero-JS plus replacing all media with text placeholders | Slow links, metered data |

Switching profiles re-fetches the current page immediately.

## Features

- **Tracker stripping** — 20+ known analytics, advertising and fingerprinting
  networks are dropped before the page reaches the client; tracking pixels and
  beacon iframes go with them.
- **URL hygiene** — `utm_*`, `fbclid`, `gclid`, `msclkid`, `mc_eid` and friends are
  removed from every navigation.
- **Sandboxed rendering** — pages render in a frame *without* `allow-same-origin`,
  so page scripts cannot read your bookmarks, history or settings.
- **Reader mode** — server-side article extraction with themes, font sizing and
  printing.
- **Session cookie jar** — cookies are held per-domain server-side so logins
  survive across navigations, without the page ever seeing another site's cookies.
- **Process & resource tracker** — a task-manager view (Shift+Esc) that shows
  per-tab DOM size, estimated memory, and lets you freeze, kill or purge a tab.
- **Offline snapshots** — export the sanitised HTML of any page as a standalone
  file.
- **Standalone launcher bundles** — generate `.bat` / `.sh` / `.py` / `node`
  launchers that open TCP Browser in a dedicated app window.
- **PWA** — installable, with a service worker that caches the app shell and never
  caches page content.

## Desktop shell (optional)

`tcp_desktop_app.py` opens the running TCP Browser server in a native OS webview
window instead of browser chrome:

```bash
npm run dev                                  # in one terminal
pip install pywebview                        # optional native backend
python tcp_desktop_app.py                    # in another
python tcp_desktop_app.py --url http://127.0.0.1:3101
```

It needs the server to be reachable, since all fetching and sanitising happens
there. If pywebview (or a usable GUI backend) is missing, it falls back to opening
the URL in your default browser.

## Security

Read this before putting TCP Browser on the public internet.

**It is an open proxy.** `/api/browse` and `/api/proxy-resource` fetch arbitrary
`http(s)` URLs on the user's behalf, with no authentication and no rate limiting.
Anyone who can reach the server can use it to fetch pages through your IP address.
If you deploy it publicly:

1. Put it behind authentication (reverse-proxy basic auth, OAuth proxy, VPN).
2. Add rate limiting at the edge.
3. Consider restricting which targets are allowed.

**SSRF guard.** By default the server refuses to fetch loopback, private
(`10/8`, `172.16/12`, `192.168/16`), link-local and cloud-metadata addresses, so a
deployed instance is not a pivot into your internal network. Set
`TCP_ALLOW_PRIVATE_TARGETS=true` only if you deliberately want to browse LAN
machines from your own machine.

**Untrusted page content.** Sanitised pages render in an iframe with
`allow-scripts` but **without** `allow-same-origin`. Page JavaScript therefore
cannot read `localStorage`, cannot reach `window.parent.document`, and cannot
remove its own sandbox attribute. Messages from the frame are additionally
validated against the frame's own `window` reference.

**In-memory state only.** The cookie jar and the browsing session live in server
memory. Restarting the server clears them; nothing is written to disk.

## Tests

```bash
npm run lint      # TypeScript, no emit
npm test          # boots the real server and exercises every API route
npm run test:prod # production path — requires `npm run build` first
```

`npm test` starts the server on a free port, then checks the health endpoint, the
app shell, the PWA assets, every launcher download format, the proxy guard rails,
the browse contract (including Reader, Zero-JS and Text-only modes), snapshot
export, and that a crafted `Host` header cannot inject commands into a generated
launcher. Live-network checks are best-effort and skipped gracefully when the
network is unavailable.

If port 3000 is busy, tests pick their own free port, so they never collide with
a running dev server.

## Project layout

```
server.ts                    Express server: proxy, sanitiser, launcher bundles
src/                         React client
  App.tsx                    Tab/navigation state machine
  components/                Omnibox, tab strip, viewport, modals, task manager
  data/defaults.ts           Default bookmarks, quick links, settings
public/                      PWA manifest, service worker, generated icons
scripts/
  smoke-test.mjs             End-to-end API smoke test
  check-host-injection.mjs   Launcher Host-header injection guard
  check-production.mjs       Production build serving check
  generate-icons.mjs         Regenerates the PWA icons
tcp_desktop_app.py           Optional native webview shell
```

## Configuration

Copy `.env.example` to `.env`. All variables are optional.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `NODE_ENV` | auto | `production` serves `dist/`; `development` uses Vite middleware |
| `DISABLE_HMR` | `false` | Disable hot reload and file watching |
| `TCP_ALLOW_PRIVATE_TARGETS` | `false` | Allow proxying loopback/private addresses |

## License

[MIT](LICENSE)
