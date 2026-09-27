import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import JSZip from 'jszip';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Known tracker and ad network signatures
const TRACKER_PATTERNS = [
  { pattern: /google-analytics\.com|googletagmanager\.com|analytics\.google\.com/i, name: 'Google Analytics / GTM', category: 'analytics' as const },
  { pattern: /doubleclick\.net|googleadservices\.com|googlesyndication\.com/i, name: 'Google AdServices / DoubleClick', category: 'advertising' as const },
  { pattern: /connect\.facebook\.net|facebook\.com\/tr/i, name: 'Meta / Facebook Pixel', category: 'advertising' as const },
  { pattern: /hotjar\.com|hotjar-.*\.js/i, name: 'Hotjar Session Recording', category: 'analytics' as const },
  { pattern: /mixpanel\.com|api\.mixpanel\.com/i, name: 'Mixpanel Tracking', category: 'analytics' as const },
  { pattern: /segment\.(io|com)|cdn\.segment\.com/i, name: 'Segment Telemetry', category: 'telemetry' as const },
  { pattern: /amplitude\.com/i, name: 'Amplitude Analytics', category: 'analytics' as const },
  { pattern: /crazyegg\.com/i, name: 'Crazy Egg Heatmaps', category: 'analytics' as const },
  { pattern: /fullstory\.com/i, name: 'FullStory Session Recorder', category: 'analytics' as const },
  { pattern: /mouseflow\.com/i, name: 'Mouseflow Tracker', category: 'analytics' as const },
  { pattern: /optimizely\.com/i, name: 'Optimizely A/B Tracker', category: 'analytics' as const },
  { pattern: /outbrain\.com|taboola\.com/i, name: 'Outbrain / Taboola Ad Network', category: 'advertising' as const },
  { pattern: /criteo\.(net|com)/i, name: 'Criteo Retargeting', category: 'advertising' as const },
  { pattern: /pubmatic\.com|rubiconproject\.com|openx\.net/i, name: 'Ad Exchange Network', category: 'advertising' as const },
  { pattern: /scorecardresearch\.com|quantserve\.com/i, name: 'Scorecard / Quantcast Beacon', category: 'analytics' as const },
  { pattern: /amazon-adsystem\.com/i, name: 'Amazon Ad System', category: 'advertising' as const },
  { pattern: /fingerprint(js|\.com)|clientjs/i, name: 'Hardware / Canvas Fingerprinter', category: 'fingerprinting' as const },
  { pattern: /ads-twitter\.com|t\.co\/i\/adsct/i, name: 'Twitter / X Ads Beacon', category: 'advertising' as const },
  { pattern: /tiktok\.com\/analytics|byteoversea\.com/i, name: 'TikTok Pixel', category: 'advertising' as const },
  { pattern: /clarity\.ms/i, name: 'Microsoft Clarity Recorder', category: 'analytics' as const },
  { pattern: /sentry-cdn\.com|browser\.sentry-cdn/i, name: 'Error Telemetry Logger', category: 'telemetry' as const },
  { pattern: /newrelic\.com|nr-data\.net/i, name: 'New Relic Performance Telemetry', category: 'telemetry' as const },
  { pattern: /coinhive|cryptoloot/i, name: 'Crypto Miner Script', category: 'fingerprinting' as const },
];

// Tracking query parameters to strip
const TRACKING_QUERY_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'msclkid', 'mc_eid', '__twitter_impression',
  'ref_src', 'yclid', 'wickedid', 'dclid', 'zenid', 's_kwcid'
];

function sanitizeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    for (const param of TRACKING_QUERY_PARAMS) {
      parsed.searchParams.delete(param);
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

function resolveTargetUrl(input: string, searchEngine: string = 'duckduckgo'): string {
  let trimmed = input.trim();
  if (!trimmed) return 'https://html.duckduckgo.com/html/';

  // If it's already a URL
  if (/^https?:\/\//i.test(trimmed)) {
    return sanitizeUrl(trimmed);
  }

  // If it looks like a domain name (e.g. wikipedia.org or nytimes.com/world or localhost:8080)
  if (/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/i.test(trimmed) || /^(localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?(\/.*)?$/i.test(trimmed)) {
    return sanitizeUrl(`https://${trimmed}`);
  }

  // Otherwise treat as search query
  const query = encodeURIComponent(trimmed);
  switch (searchEngine) {
    case 'brave':
      return `https://search.brave.com/search?q=${query}`;
    case 'searxng':
      return `https://searx.be/search?q=${query}`;
    case 'google-clean':
      return `https://www.google.com/search?q=${query}&pws=0`;
    case 'duckduckgo':
    default:
      return `https://html.duckduckgo.com/html/?q=${query}`;
  }
}

// Extract reader-mode content from cheerio instance
function extractReaderContent($: cheerio.CheerioAPI, pageTitle: string, pageUrl: string): {
  title: string;
  byline: string;
  content: string;
  textContent: string;
  readingTimeMinutes: number;
} {
  // Candidate containers
  const selectors = [
    'article',
    '[role="main"]',
    '.article-body',
    '.post-content',
    '.entry-content',
    '.story-body',
    'main',
    '.content',
    '#content'
  ];

  let $mainElement: any = null;
  for (const selector of selectors) {
    const el = $(selector);
    if (el.length > 0) {
      $mainElement = el.first();
      break;
    }
  }

  if (!$mainElement || $mainElement.length === 0) {
    $mainElement = $('body');
  }

  // Clone element to sanitize
  const $clone = $mainElement.clone();

  // Strip non-content junk
  $clone.find('nav, footer, aside, .sidebar, .ad, .ads, .social-share, .share-buttons, .comments, .cookie, .banner, .header, script, style, iframe, button').remove();

  // Extract author / date if available
  const byline = $('[rel="author"], .byline, .author, time, .date').first().text().trim() || '';

  // Allowed tags for reader
  const allowedTags = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'ul', 'ol', 'li', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'b', 'strong', 'i', 'em', 'a', 'hr']);

  // Clean elements
  $clone.find('*').each((_, el) => {
    const tagName = el.tagName.toLowerCase();
    if (!allowedTags.has(tagName) && tagName !== 'div' && tagName !== 'span' && tagName !== 'section') {
      $(el).remove();
    }
  });

  // Strip every attribute except a small safe allowlist. Reader HTML is injected
  // into the app's own document, so a surviving on* handler or javascript: href
  // would execute with full access to the application origin.
  const allowedAttributes = new Set(['href', 'title', 'alt', 'colspan', 'rowspan', 'start']);
  $clone.find('*').each((_, el) => {
    const attribs = (el as any).attribs as Record<string, string> | undefined;
    if (!attribs) return;
    for (const attrName of Object.keys(attribs)) {
      const value = attribs[attrName] ?? '';
      const isDangerousUrl = /^(javascript|data|vbscript):/i.test(value.replace(/[\s\u0000-\u001f]/g, ''));
      if (!allowedAttributes.has(attrName.toLowerCase()) || isDangerousUrl) {
        $(el).removeAttr(attrName);
      }
    }
  });

  // Rewrite in-article links to absolute URLs so the reader view can navigate.
  $clone.find('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (!href || href.startsWith('#')) return;
    try {
      $(el).attr('href', new URL(href, pageUrl).href);
    } catch {
      $(el).removeAttr('href');
    }
  });

  const textContent = $clone.text().replace(/\s+/g, ' ').trim();
  const wordCount = textContent ? textContent.split(/\s+/).length : 0;
  const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

  // Build clean semantic reader HTML
  const readerHtml = `
    <div class="reader-container">
      <header class="reader-header">
        <h1 class="reader-title">${escapeHtml(pageTitle)}</h1>
        ${byline ? `<div class="reader-byline">${escapeHtml(byline)}</div>` : ''}
        <div class="reader-meta">
          <span>📖 ~${readingTimeMinutes} min read</span>
          <span>• ${wordCount.toLocaleString()} words</span>
          <span>• 100% Trackers &amp; Bloat Stripped</span>
        </div>
      </header>
      <div class="reader-body">
        ${$clone.html() || '<p>No structured article text detected for this page. Switch to Shield or Zero-JS mode to view full structure.</p>'}
      </div>
    </div>
  `;

  return {
    title: pageTitle,
    byline,
    content: readerHtml,
    textContent,
    readingTimeMinutes
  };
}

// Escape untrusted text before interpolating it into a server-rendered HTML page.
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Server-rendered error page for direct (non-JSON) navigations.
function renderErrorPage(heading: string, detail: string, rawUrl = ''): string {
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>${escapeHtml(heading)} - TCP Browser</title></head>
  <body style="font-family:system-ui,sans-serif;padding:40px;text-align:center;color:#334155;background:#f8fafc;">
    <h2 style="margin-bottom:8px;">${escapeHtml(heading)}</h2>
    <p style="color:#64748b;">${escapeHtml(detail)}</p>
    ${rawUrl ? `<p style="color:#94a3b8;font-family:ui-monospace,monospace;font-size:12px;word-break:break-all;">${escapeHtml(rawUrl)}</p>` : ''}
    <button onclick="location.reload()" style="margin-top:16px;padding:8px 16px;border:1px solid #cbd5e1;background:#fff;border-radius:8px;cursor:pointer;">Retry</button>
  </body>
</html>`;
}

const EMPTY_HEADERS = new Headers();

// Script MIME types that are data, not executable code, and are therefore safe
// to keep in zero-JS mode (structured data, client-side templates).
const DATA_SCRIPT_TYPES = new Set([
  'application/ld+json',
  'application/json',
  'text/template',
  'text/x-handlebars-template',
  'text/x-jquery-tmpl',
  'application/xml',
  'text/xml',
]);

// Health Check Endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', browser: 'TCP Browser', version: '1.0.0' });
});

// Domain-scoped Cookie Jar for preserving sessions, logins, and cookies across browsing requests
const cookieJar = new Map<string, Map<string, string>>();

function getCookiesForUrl(urlStr: string): string {
  try {
    const url = new URL(urlStr);
    const domain = url.hostname;
    const domainParts = domain.split('.');
    const cookiesToSend = new Map<string, string>();
    
    // Check exact domain and parent domains (e.g. .google.com for accounts.google.com)
    for (let i = 0; i <= domainParts.length - 2; i++) {
      const checkDomain = domainParts.slice(i).join('.');
      const stored = cookieJar.get(checkDomain);
      if (stored) {
        stored.forEach((val, key) => {
          cookiesToSend.set(key, val);
        });
      }
    }

    const pairs: string[] = [];
    cookiesToSend.forEach((val, key) => pairs.push(`${key}=${val}`));
    return pairs.join('; ');
  } catch {
    return '';
  }
}

function storeCookiesFromResponse(urlStr: string, responseHeaders: Headers) {
  try {
    const url = new URL(urlStr);
    const fallbackDomain = url.hostname;
    const getSetCookie = (responseHeaders as any)?.getSetCookie;
    const setCookieHeaders: string[] = typeof getSetCookie === 'function'
      ? getSetCookie.call(responseHeaders)
      : [responseHeaders?.get?.('set-cookie')].filter((v): v is string => Boolean(v));

    if (!setCookieHeaders || setCookieHeaders.length === 0) return;

    for (const header of setCookieHeaders) {
      const segments = header.split(';');
      const firstPart = segments[0].trim();
      const eqIdx = firstPart.indexOf('=');
      if (eqIdx <= 0) continue;

      const key = firstPart.slice(0, eqIdx).trim();
      const val = firstPart.slice(eqIdx + 1).trim();

      // Honour the Domain= attribute when present, otherwise scope to the
      // origin host that actually served the cookie.
      let cookieDomain = fallbackDomain;
      let expired = false;
      for (const segment of segments.slice(1)) {
        const [rawName, ...rest] = segment.split('=');
        const attrName = rawName.trim().toLowerCase();
        const attrValue = rest.join('=').trim();
        if (attrName === 'domain' && attrValue) {
          cookieDomain = attrValue.replace(/^\./, '').toLowerCase();
        } else if (attrName === 'max-age' && Number(attrValue) <= 0) {
          expired = true;
        } else if (attrName === 'expires' && attrValue && !Number.isNaN(Date.parse(attrValue)) && Date.parse(attrValue) <= Date.now()) {
          expired = true;
        }
      }
      if (!cookieDomain) cookieDomain = fallbackDomain;

      let domainMap = cookieJar.get(cookieDomain);
      if (!domainMap) {
        if (expired) continue;
        domainMap = new Map<string, string>();
        cookieJar.set(cookieDomain, domainMap);
      }
      if (expired) {
        domainMap.delete(key);
      } else {
        domainMap.set(key, val);
      }
    }
  } catch (err) {
    console.error('Cookie store error:', err);
  }
}

// Returns true when a request URL belongs to a known tracker / ad network.
function isTrackerUrl(rawUrl: string): boolean {
  return TRACKER_PATTERNS.some((tracker) => tracker.pattern.test(rawUrl));
}

// Private / loopback / cloud-metadata ranges. Reachable from the server but not
// from a browser, so proxying them would turn this app into an SSRF pivot.
const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^\[?::1\]?$/,
  /^\[?f[cd][0-9a-f]{2}:/i,
  /^metadata\.google\.internal$/i,
  /^169\.254\.169\.254$/,
];

const ALLOW_PRIVATE_TARGETS = process.env.TCP_ALLOW_PRIVATE_TARGETS === 'true';

function isBlockedTarget(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return 'Malformed target URL';
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'Only http and https targets are allowed';
  }
  if (parsed.username || parsed.password) {
    return 'Credentials in the target URL are not allowed';
  }
  if (!ALLOW_PRIVATE_TARGETS && BLOCKED_HOST_PATTERNS.some((re) => re.test(parsed.hostname))) {
    return 'Target resolves to a private, loopback or metadata address (set TCP_ALLOW_PRIVATE_TARGETS=true to allow)';
  }
  return null;
}

function parseCookieHeader(header: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const pair of header.split(';')) {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      out.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
    }
  }
  return out;
}

// Primary Proxy & Shield endpoint (handles both GET and POST for form submissions)
const handleBrowseRequest = async (req: Request, res: Response) => {
  const rawInput = (req.query.url as string) || (req.body?.url as string) || 'https://html.duckduckgo.com/html/';
  const mode = (req.query.mode as string) || (req.body?.mode as string) || 'shield'; // 'shield' | 'direct' | 'reader' | 'zero-js' | 'text-only'
  const disableImages = req.query.disableImages === 'true' || req.body?.disableImages === true;
  const searchEngine = (req.query.searchEngine as string) || (req.body?.searchEngine as string) || 'duckduckgo';
  const lowGpu = req.query.lowGpu === 'true' || req.body?.lowGpu === true;
  const postBody = req.method === 'POST' ? req.body?.postData : null;
  const wantsJson = Boolean(req.headers.accept?.includes('application/json') || req.query.format === 'json');

  const targetUrl = resolveTargetUrl(rawInput, searchEngine);
  const startTime = Date.now();

  const blockedReason = isBlockedTarget(targetUrl);
  if (blockedReason) {
    if (wantsJson) {
      return res.status(400).json({ success: false, targetUrl, error: blockedReason });
    }
    return res.status(400).type('html').send(renderErrorPage('Blocked target', blockedReason, targetUrl));
  }

  // Origin of this TCP Browser instance. Injected into the proxied document so
  // its in-page fetch/XHR calls reach our proxy rather than the remote site.
  const requestProtocol = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'http';
  const requestHost = (req.headers['x-forwarded-host'] as string) || req.headers.host || `localhost:${PORT}`;
  const appOrigin = `${requestProtocol}://${requestHost}`;

  try {
    const targetParsed = new URL(targetUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 22000);

    const forwardHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'DNT': '1',
      'Sec-GPC': '1',
      'Upgrade-Insecure-Requests': '1',
      'sec-ch-ua': '"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'none',
      'sec-fetch-user': '?1',
    };

    const cookieHeader = getCookiesForUrl(targetUrl);
    if (cookieHeader) {
      forwardHeaders['Cookie'] = cookieHeader;
    }

    const fetchInit: RequestInit = {
      method: postBody ? 'POST' : 'GET',
      signal: controller.signal,
      headers: forwardHeaders,
      redirect: 'follow',
    };

    if (postBody) {
      forwardHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
      const urlEncoded = new URLSearchParams(postBody).toString();
      fetchInit.body = urlEncoded;
    }

    const fetchResponse = await fetch(targetUrl, fetchInit);
    clearTimeout(timeout);

    // Save cookies from response
    storeCookiesFromResponse(targetUrl, fetchResponse.headers);

    // Final effective URL after any server redirects
    const finalEffectiveUrl = fetchResponse.url || targetUrl;
    const finalTargetParsed = new URL(finalEffectiveUrl);

    const contentType = fetchResponse.headers.get('content-type') || '';

    // Anything that is not a document is handed back untouched (cheerio would
    // otherwise mangle binary payloads such as images, PDFs or JSON APIs).
    const isHtmlDocument = contentType.includes('text/html') || contentType.includes('application/xhtml+xml');
    if (!isHtmlDocument) {
      const buffer = Buffer.from(await fetchResponse.arrayBuffer());
      if (contentType) res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(fetchResponse.status).send(buffer);
    }

    const originalHtml = await fetchResponse.text();
    const originalSizeKb = Math.round((Buffer.byteLength(originalHtml, 'utf-8') / 1024) * 10) / 10;

    const $ = cheerio.load(originalHtml);

    // Strip CSP & anti-frame meta tags that break assets/scripts inside sandboxes
    $('meta[http-equiv="Content-Security-Policy" i]').remove();
    $('meta[http-equiv="X-Frame-Options" i]').remove();
    $('meta[http-equiv="origin-trial" i]').remove();
    $('meta[name="referrer" i]').attr('content', 'no-referrer');

    // Collect and remove trackers
    const blockedTrackers: { name: string; category: 'analytics' | 'advertising' | 'fingerprinting' | 'telemetry' | 'social'; domain: string }[] = [];
    const seenTrackerNames = new Set<string>();

    // 1. Scan and remove scripts matching tracker patterns
    $('script').each((_, el) => {
      const src = $(el).attr('src') || '';
      const inlineContent = $(el).html() || '';
      const combined = `${src} ${inlineContent}`;

      for (const tracker of TRACKER_PATTERNS) {
        if (tracker.pattern.test(combined)) {
          if (!seenTrackerNames.has(tracker.name)) {
            seenTrackerNames.add(tracker.name);
            blockedTrackers.push({
              name: tracker.name,
              category: tracker.category,
              domain: src ? new URL(src, targetUrl).hostname : targetParsed.hostname
            });
          }
          $(el).remove();
          break;
        }
      }
    });

    // 2. Remove tracking pixels (<noscript>, 1x1 <img>, beacon iframes)
    $('noscript, iframe[src*="google"], iframe[src*="facebook"], iframe[src*="doubleclick"]').each((_, el) => {
      const src = $(el).attr('src') || '';
      for (const tracker of TRACKER_PATTERNS) {
        if (tracker.pattern.test(src)) {
          if (!seenTrackerNames.has(tracker.name)) {
            seenTrackerNames.add(tracker.name);
            blockedTrackers.push({
              name: tracker.name,
              category: tracker.category,
              domain: src ? new URL(src, targetUrl).hostname : targetParsed.hostname
            });
          }
        }
      }
      $(el).remove();
    });

    // 3. Remove ping / tracking attributes from links
    $('a[ping]').removeAttr('ping');
    $('*[data-track], *[data-tracking], *[data-analytics]').removeAttr('data-track').removeAttr('data-tracking').removeAttr('data-analytics');

    // 4. Zero-JS Mode: strip ALL scripts, inline event handlers, and JS: URLs.
    //    Because the injected navigation interceptor cannot run without scripts,
    //    links are rewritten to absolute URLs here so clicks still resolve
    //    against the real site instead of the local app origin.
    if (mode === 'zero-js') {
      $('script').remove();
      $('*').each((_, el) => {
        const element = $(el);
        const rawAttribs = (el as any)?.attribs;
        if (!rawAttribs) return;
        for (const attr of Object.keys(rawAttribs)) {
          const lower = attr.toLowerCase();
          if (lower.startsWith('on')) {
            element.removeAttr(attr);
          } else if ((lower === 'href' || lower === 'src' || lower === 'action') && /^\s*javascript:/i.test(rawAttribs[attr] || '')) {
            element.removeAttr(attr);
          }
        }
      });
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href') || '';
        if (!href || href.startsWith('#')) return;
        try {
          $(el).attr('href', new URL(href, finalEffectiveUrl).href);
        } catch {
          $(el).removeAttr('href');
        }
      });
      $('form[action]').each((_, el) => {
        const action = $(el).attr('action') || '';
        if (!action) return;
        try {
          $(el).attr('action', new URL(action, finalEffectiveUrl).href);
        } catch {
          $(el).removeAttr('action');
        }
      });
    }

    // 5. Disable images or text-only mode
    if (disableImages || mode === 'text-only') {
      $('img, picture, svg:not(.icon), video, audio, canvas').each((_, el) => {
        const alt = $(el).attr('alt') || $(el).attr('title') || 'Media asset';
        $(el).replaceWith(`<span class="barebones-placeholder" style="display:inline-block;padding:2px 6px;margin:2px;background:#e2e8f0;color:#64748b;font-size:12px;border-radius:4px;border:1px dashed #cbd5e1;">[Media: ${alt}]</span>`);
      });
    }

    // Extract page title & favicon
    const pageTitle = $('title').text().trim() || finalTargetParsed.hostname;
    let favicon = $('link[rel="shortcut icon"], link[rel="icon"]').attr('href') || '/favicon.ico';
    try {
      favicon = new URL(favicon, finalEffectiveUrl).href;
    } catch {
      favicon = `https://www.google.com/s2/favicons?domain=${finalTargetParsed.hostname}&sz=32`;
    }

    // Handle Reader Mode extraction
    let readerData = null;
    if (mode === 'reader') {
      readerData = extractReaderContent($, pageTitle, finalEffectiveUrl);
    }

    // Inject Base URL tag so relative CSS, fonts, and assets resolve to target website
    $('head').prepend(`<base href="${finalEffectiveUrl}">`);

    // Inject TCP Browser Sandbox Shield Styles and navigation interceptor
    const customStyles = `
      <style id="tcp-shield-styles">
        /* TCP Browser Low-Memory / Zero-GPU Shield Styles */
        ${lowGpu ? `
        *, *::before, *::after {
          animation-duration: 0.001s !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.001s !important;
          scroll-behavior: auto !important;
          box-shadow: none !important;
          text-shadow: none !important;
        }
        ` : ''}
        body {
          margin-bottom: 24px !important;
        }
        .reader-container {
          max-width: 760px;
          margin: 40px auto;
          padding: 0 24px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          line-height: 1.75;
          color: #1e293b;
        }
        .reader-header {
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 20px;
          margin-bottom: 32px;
        }
        .reader-title {
          font-size: 2.25rem;
          font-weight: 800;
          line-height: 1.25;
          color: #0f172a;
          margin-bottom: 12px;
        }
        .reader-byline {
          font-size: 1rem;
          color: #475569;
          font-weight: 500;
          margin-bottom: 8px;
        }
        .reader-meta {
          display: flex;
          gap: 12px;
          font-size: 0.875rem;
          color: #64748b;
        }
        .reader-body {
          font-size: 1.125rem;
        }
        .reader-body p {
          margin-bottom: 1.5em;
        }
        .reader-body h2 {
          font-size: 1.5rem;
          font-weight: 700;
          margin-top: 2em;
          margin-bottom: 0.75em;
          color: #0f172a;
        }
        .reader-body h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin-top: 1.5em;
          margin-bottom: 0.5em;
          color: #1e293b;
        }
        .reader-body blockquote {
          border-left: 4px solid #3b82f6;
          padding-left: 16px;
          margin: 24px 0;
          color: #475569;
          font-style: italic;
        }
        .reader-body pre {
          background: #0f172a;
          color: #f8fafc;
          padding: 16px;
          border-radius: 8px;
          overflow-x: auto;
          font-family: ui-monospace, monospace;
          font-size: 0.9rem;
        }
      </style>
    `;

    // Navigation interceptor, dynamic script CORS proxy & telemetry reporter
    const navScript = `
      <script id="tcp-nav-interceptor">
        (function() {
          var baseUrl = ${JSON.stringify(finalEffectiveUrl)};
          var baseOrigin = ${JSON.stringify(finalTargetParsed.origin)};
          // Must be absolute: a root-relative path would resolve against the
          // injected <base href> (the proxied site) instead of TCP Browser.
          var proxyBase = ${JSON.stringify(appOrigin)} + '/api/proxy-resource?url=';

          // 1. Dynamic fetch & API proxy: routes in-page fetch requests through proxy to eliminate CORS failures
          try {
            var origFetch = window.fetch;
            if (origFetch) {
              window.fetch = function(input, init) {
                try {
                  var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
                  if (url && !url.startsWith('data:') && !url.startsWith('blob:') && !url.startsWith(proxyBase)) {
                    var resolved = new URL(url, baseUrl).href;
                    var proxied = proxyBase + encodeURIComponent(resolved);
                    if (typeof input === 'string') {
                      input = proxied;
                    } else {
                      input = new Request(proxied, input);
                    }
                  }
                } catch(e) {}
                return origFetch.call(this, input, init);
              };
            }

            // Dynamic XMLHttpRequest proxy
            var origOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url) {
              try {
                if (url && typeof url === 'string' && !url.startsWith('data:') && !url.startsWith('blob:') && !url.startsWith(proxyBase)) {
                  var resolved = new URL(url, baseUrl).href;
                  arguments[1] = proxyBase + encodeURIComponent(resolved);
                }
              } catch(e) {}
              return origOpen.apply(this, arguments);
            };
          } catch(e) {}

          var postToParent = function(payload) {
            try { window.parent.postMessage(payload, ${JSON.stringify(appOrigin)}); } catch(e) {}
          };
          window.addEventListener('error', function() { postToParent({ type: 'TCP_FRAME_ERROR', message: 'The page reported a script error.' }); });

          // 2. Intercept link navigation (single message: duplicate delivery
          //    would double every fetch, history entry and metric.)
          document.addEventListener('click', function(e) {
            var target = e.target && e.target.closest ? e.target.closest('a') : null;
            if (!target) return;
            var rawHref = target.getAttribute('href');
            if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript:')) return;
            e.preventDefault();
            try {
              var resolved = new URL(rawHref, baseUrl).href;
              if (target.hasAttribute('target') && target.getAttribute('target') === '_blank') {
                postToParent({ type: 'TCP_OPEN_EXTERNAL', url: resolved });
              } else {
                postToParent({ type: 'TCP_NAVIGATE', url: resolved });
              }
            } catch(err) {
              console.error('URL resolve error', err);
            }
          }, true);

          // 3. Intercept GET and POST form submissions
          document.addEventListener('submit', function(e) {
            var form = e.target;
            if (form && form.tagName === 'FORM') {
              var method = (form.getAttribute('method') || 'GET').toUpperCase();
              e.preventDefault();
              try {
                var formData = new FormData(form);
                var actionUrl = form.getAttribute('action') || baseUrl;
                var resolvedAction = new URL(actionUrl, baseUrl);

                if (method === 'GET') {
                  var params = new URLSearchParams();
                  for (var pair of formData.entries()) {
                    params.append(pair[0], pair[1]);
                  }
                  resolvedAction.search = params.toString();
                  postToParent({ type: 'TCP_NAVIGATE', url: resolvedAction.href });
                } else {
                  var postData = {};
                  for (var pair of formData.entries()) {
                    if (typeof pair[1] === 'string') postData[pair[0]] = pair[1];
                  }
                  postToParent({
                    type: 'TCP_POST_SUBMIT',
                    url: resolvedAction.href,
                    body: postData
                  });
                }
              } catch(err) {
                console.error('Form resolve error', err);
              }
            }
          }, true);

          // 4. Post live telemetry and DOM node metrics to parent Process Tracker
          try {
            var reportMetrics = function() {
              var count = document.getElementsByTagName('*').length;
              var scriptCount = document.scripts.length;
              postToParent({
                type: 'TCP_FRAME_METRICS',
                domNodes: count,
                scripts: scriptCount,
                title: document.title
              });
            };
            if (document.readyState === 'complete') {
              reportMetrics();
            } else {
              window.addEventListener('load', reportMetrics);
            }
          } catch(e) {}
        })();
      </script>
    `;

    $('head').append(customStyles);
    $('body').append(navScript);

    // Zero-JS mode strips scripts twice: once above for everything the page
    // shipped, and again here so the navigation interceptor injected just above
    // is removed too. Non-executable data blocks (JSON-LD, templates) and the
    // <noscript> fallbacks are deliberately preserved.
    if (mode === 'zero-js') {
      $('script').each((_, el) => {
        const type = ($(el).attr('type') || '').trim().toLowerCase();
        const isDataBlock = DATA_SCRIPT_TYPES.has(type);
        if (!isDataBlock) $(el).remove();
      });
    }

    // Compute final clean size and memory estimates
    const finalHtml = mode === 'reader' && readerData ? `<!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <base href="${escapeHtml(finalEffectiveUrl)}">
          <title>${escapeHtml(pageTitle)} - TCP Browser Reader</title>
          ${customStyles}
        </head>
        <body style="background-color: #f8fafc;">
          ${readerData.content}
          ${navScript}
        </body>
      </html>` : $.html();

    const cleanSizeKb = Math.round((Buffer.byteLength(finalHtml, 'utf-8') / 1024) * 10) / 10;
    const loadDurationMs = Date.now() - startTime;

    // Realistic memory calculation:
    // Standard Chrome process footprint for modern rich sites: ~180MB baseline + ~150-300MB DOM/V8 heap = ~350MB.
    // TCP Browser sanitized DOM footprint: ~8-22MB (approx 1/10th or less of Chrome!)
    let estimatedRamMb = 14;
    let chromeRamEstimateMb = 320;
    let estimatedGpuPercent = 1;
    let chromeGpuEstimatePercent = 18;

    if (mode === 'reader') {
      estimatedRamMb = 6;
      chromeRamEstimateMb = 310;
      estimatedGpuPercent = 0;
      chromeGpuEstimatePercent = 16;
    } else if (mode === 'zero-js') {
      estimatedRamMb = 10;
      chromeRamEstimateMb = 330;
      estimatedGpuPercent = 1;
      chromeGpuEstimatePercent = 22;
    } else if (mode === 'text-only') {
      estimatedRamMb = 8;
      chromeRamEstimateMb = 340;
      estimatedGpuPercent = 0;
      chromeGpuEstimatePercent = 25;
    }

    const ramSavedPercent = Math.round((1 - estimatedRamMb / chromeRamEstimateMb) * 100);

    const stats = {
      trackersBlocked: blockedTrackers.length,
      trackerList: blockedTrackers,
      originalSizeKb,
      cleanSizeKb,
      estimatedRamMb,
      chromeRamEstimateMb,
      ramSavedPercent,
      estimatedGpuPercent,
      chromeGpuEstimatePercent,
      hasHttps: finalTargetParsed.protocol === 'https:',
      loadDurationMs
    };

    // If client requested JSON representation (default for browser component)
    if (wantsJson) {
      return res.json({
        success: true,
        targetUrl: finalEffectiveUrl,
        displayUrl: finalTargetParsed.hostname + (finalTargetParsed.pathname === '/' ? '' : finalTargetParsed.pathname),
        title: pageTitle,
        favicon,
        mode,
        stats,
        htmlContent: finalHtml,
        readerData
      });
    }

    // Otherwise serve sanitized HTML directly with safe sandboxed headers.
    // The sanitised document must never be cached: it is per-session state.
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.send(finalHtml);

  } catch (error: any) {
    const aborted = error?.name === 'AbortError';
    const errorMessage = aborted
      ? 'Request timed out (site took longer than 22s to respond)'
      : (error?.message || 'Unable to establish a secure connection');
    console.error(`Browse error for ${targetUrl}: ${errorMessage}`);

    if (wantsJson) {
      return res.status(aborted ? 504 : 502).json({
        success: false,
        targetUrl,
        error: errorMessage
      });
    }

    res.status(aborted ? 504 : 502).type('html').send(renderErrorPage('Unable to load page', errorMessage, targetUrl));
  }
};

app.get('/api/browse', handleBrowseRequest);
app.post('/api/browse', handleBrowseRequest);

// Sub-resource Proxy: proxies images, styles, scripts, fonts, XHR and media for
// loaded pages so that cross-origin reads succeed and tracker networks never
// receive a request at all.
app.all('/api/proxy-resource', async (req: Request, res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE, PATCH');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const targetUrl = (req.query.url as string) || (req.body && req.body.url);
  if (!targetUrl || typeof targetUrl !== 'string') {
    return res.status(400).send('Missing url parameter');
  }

  const blockedReason = isBlockedTarget(targetUrl);
  if (blockedReason) {
    return res.status(400).send(blockedReason);
  }

  // Filter out tracking networks: drop them with zero data transfer.
  if (isTrackerUrl(targetUrl)) {
    return res.status(204).end();
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': req.headers.accept || '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'DNT': '1',
      'Sec-GPC': '1',
    };

    if (req.headers.range) {
      headers['Range'] = req.headers.range as string;
    }

    const cookieHeader = getCookiesForUrl(targetUrl);
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    const fetchOptions: RequestInit = {
      method: req.method === 'GET' || req.method === 'HEAD' ? req.method : 'POST',
      headers,
      signal: controller.signal,
      redirect: 'follow',
    };

    if (fetchOptions.method === 'POST') {
      const contentType = req.headers['content-type'];
      if (typeof contentType === 'string') {
        headers['Content-Type'] = contentType;
      }
      if (req.body !== undefined && req.body !== null && !(typeof req.body === 'object' && Object.keys(req.body).length === 0 && !contentType)) {
        if (Buffer.isBuffer(req.body)) {
          fetchOptions.body = req.body;
        } else if (typeof req.body === 'string') {
          fetchOptions.body = req.body;
        } else if (typeof contentType === 'string' && !contentType.includes('application/json')) {
          // express.json() only parses JSON bodies, so a urlencoded body arrives
          // as a plain object here and must be re-serialised on the way out.
          fetchOptions.body = new URLSearchParams(
            Object.entries(req.body as Record<string, unknown>).map(([k, v]) => [k, String(v)]),
          ).toString();
        } else {
          fetchOptions.body = JSON.stringify(req.body);
          headers['Content-Type'] = 'application/json';
        }
      }
    }

    const response = await fetch(targetUrl, fetchOptions);
    clearTimeout(timeout);

    storeCookiesFromResponse(targetUrl, response.headers);

    res.status(response.status);

    const contentType = response.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    const contentLength = response.headers.get('content-length');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    const contentRange = response.headers.get('content-range');
    if (contentRange) res.setHeader('Content-Range', contentRange);
    const cacheControl = response.headers.get('cache-control');
    if (cacheControl) res.setHeader('Cache-Control', cacheControl);
    const acceptRanges = response.headers.get('accept-ranges');
    if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);

    if (req.method === 'HEAD') {
      return res.end();
    }

    const arrayBuffer = await response.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch (err: any) {
    const aborted = err?.name === 'AbortError';
    return res.status(aborted ? 504 : 502).send(aborted ? 'Upstream request timed out' : (err.message || 'Failed to proxy resource'));
  }
});

// Offline Snapshot Downloader: exports clean, tracker-free standalone HTML
app.post('/api/export-snapshot', (req: Request, res: Response) => {
  const { title, url, htmlContent } = req.body;
  if (!htmlContent) {
    return res.status(400).json({ error: 'No HTML content provided' });
  }

  res.setHeader('Content-Disposition', `attachment; filename="${(title || 'page').replace(/[^a-zA-Z0-9_-]/g, '_')}.html"`);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(htmlContent);
});

// ---------------------------------------------------------------------------
// Standalone launcher generation.
//
// The download endpoints embed the instance URL into files the user is told to
// execute, so the URL is derived from the request and strictly validated: an
// unvalidated Host header would otherwise be an injection vector into .bat /
// .sh / .py / .js sources.
// ---------------------------------------------------------------------------

const HOSTNAME_PATTERN = /^[a-z0-9.-]+$/i;

function resolveAppOrigin(req: Request): string {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const protocol = forwardedProto === 'https' || forwardedProto === 'http'
    ? forwardedProto
    : (req.protocol === 'https' ? 'https' : 'http');

  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const candidate = forwardedHost || req.headers.host || `localhost:${PORT}`;

  // Only accept "host" or "host:port" made of safe characters.
  if (!/^[a-z0-9.-]+(:\d{1,5})?$/i.test(candidate)) {
    return `${protocol}://localhost:${PORT}`;
  }
  const [hostname] = candidate.split(':');
  if (!HOSTNAME_PATTERN.test(hostname)) {
    return `${protocol}://localhost:${PORT}`;
  }
  return `${protocol}://${candidate}`;
}

/** Escapes a value for embedding inside a double-quoted shell/JS string. */
function escapeShellDoubleQuoted(value: string): string {
  return value.replace(/[\\$`"]/g, (ch) => `\\${ch}`);
}

/** Escapes a value for embedding inside a double-quoted Python string literal. */
function escapePythonString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** Escapes a value for embedding inside a batch file line. */
function escapeBatch(value: string): string {
  return value.replace(/["%^&|<>]/g, '');
}

function buildWindowsLauncher(appUrl: string): string {
  const safe = escapeBatch(appUrl);
  return `@echo off
title TCP Browser
echo ========================================================
echo   TCP BROWSER - STANDALONE LAUNCHER
echo ========================================================
echo   Opening ${safe} in a dedicated app window...
echo ========================================================

start "" msedge --app="${safe}" --disable-background-networking --disable-extensions --disable-component-update --disable-default-apps --disable-sync --disable-features=Translate,OptimizationHints,MediaRouter --process-per-site --renderer-process-limit=2 --enable-low-end-device-mode 2>nul
if errorlevel 1 start "" chrome --app="${safe}" --disable-background-networking --disable-extensions --disable-component-update --process-per-site --renderer-process-limit=2 --enable-low-end-device-mode 2>nul
if errorlevel 1 start "" "${safe}"
exit /b 0
`;
}

function buildMacLauncher(appUrl: string): string {
  const safe = escapeShellDoubleQuoted(appUrl);
  return `#!/usr/bin/env bash
# TCP Browser - macOS launcher
set -u
APP_URL="${safe}"

if [ -d "/Applications/Google Chrome.app" ]; then
  open -na "Google Chrome" --args --app="$APP_URL" --disable-background-networking --disable-extensions --disable-component-update --process-per-site --renderer-process-limit=2 --enable-low-end-device-mode
elif [ -d "/Applications/Brave Browser.app" ]; then
  open -na "Brave Browser" --args --app="$APP_URL" --disable-background-networking --disable-extensions --process-per-site --renderer-process-limit=2
elif [ -d "/Applications/Microsoft Edge.app" ]; then
  open -na "Microsoft Edge" --args --app="$APP_URL" --disable-background-networking --disable-extensions --process-per-site --renderer-process-limit=2
else
  open "$APP_URL"
fi
`;
}

function buildLinuxLauncher(appUrl: string): string {
  const safe = escapeShellDoubleQuoted(appUrl);
  return `#!/usr/bin/env bash
# TCP Browser - Linux launcher
set -u
APP_URL="${safe}"

if command -v google-chrome >/dev/null 2>&1; then
  google-chrome --app="$APP_URL" --disable-background-networking --disable-extensions --process-per-site --renderer-process-limit=2 --enable-low-end-device-mode &
elif command -v chromium >/dev/null 2>&1; then
  chromium --app="$APP_URL" --disable-background-networking --disable-extensions --process-per-site --renderer-process-limit=2 &
elif command -v chromium-browser >/dev/null 2>&1; then
  chromium-browser --app="$APP_URL" --disable-background-networking --disable-extensions --process-per-site --renderer-process-limit=2 &
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$APP_URL" &
else
  echo "No supported browser found. Open $APP_URL manually."
  exit 1
fi
`;
}

function buildPythonLauncher(appUrl: string): string {
  const safe = escapePythonString(appUrl);
  return `#!/usr/bin/env python3
"""TCP Browser desktop shell (generated).

Opens the TCP Browser server in a native OS webview window.
Install the optional dependency first:  pip install pywebview
"""
import webbrowser

APP_URL = "${safe}"


def main() -> None:
    try:
        import webview
    except ImportError:
        print("[tcp-browser] pywebview is not installed (pip install pywebview).")
        print(f"[tcp-browser] Opening {APP_URL} in your default browser.")
        webbrowser.open(APP_URL)
        return

    try:
        webview.create_window(
            title="TCP Browser",
            url=APP_URL,
            width=1280,
            height=820,
            min_size=(640, 480),
            confirm_close=False,
            text_select=True,
        )
        webview.start(private_mode=True)
    except Exception as exc:
        print(f"[tcp-browser] Native window unavailable: {exc}")
        print(f"[tcp-browser] Opening {APP_URL} in your default browser.")
        webbrowser.open(APP_URL)


if __name__ == "__main__":
    main()
`;
}

function buildNodeLauncher(appUrl: string): string {
  const safe = escapeShellDoubleQuoted(appUrl);
  return `// TCP Browser - Node launcher (generated)
const { exec } = require('node:child_process');

const target = "${safe}";
console.log('Launching TCP Browser:', target);

const command = process.platform === 'win32'
  ? \`start "" msedge --app="\${target}" --process-per-site --renderer-process-limit=2 --enable-low-end-device-mode\`
  : process.platform === 'darwin'
    ? \`open -na "Google Chrome" --args --app="\${target}" --process-per-site --renderer-process-limit=2\`
    : \`google-chrome --app="\${target}" --process-per-site --renderer-process-limit=2\`;

exec(command, (error) => {
  if (error) console.log('Could not launch a dedicated window; open this URL manually:', target);
});
`;
}

function buildDesktopEntry(appUrl: string): string {
  const safe = escapeShellDoubleQuoted(appUrl);
  return `[Desktop Entry]
Version=1.0
Type=Application
Name=TCP Browser
Comment=Privacy browser front-end with tracker stripping
Exec=bash -c "google-chrome --app='${safe}' --process-per-site --renderer-process-limit=2 || xdg-open '${safe}'"
Icon=web-browser
Terminal=false
Categories=Network;WebBrowser;
`;
}

function buildBundleReadme(appUrl: string): string {
  return `TCP BROWSER - STANDALONE LAUNCHER BUNDLE
================================================================================

This bundle contains launchers that open the TCP Browser web interface in a
dedicated application window (no tabs, no browser chrome).

This is a launcher for the TCP Browser web app, not a separate rendering
engine. Every page is still fetched and sanitised by the TCP Browser server, so
that server has to be reachable from the machine running these scripts.

SERVER URL THIS BUNDLE WAS GENERATED FOR
--------------------------------------------------------------------------------
${appUrl}

If that server is not running, these launchers will open an error page. Start
the server first (see the project README), or re-download this bundle from a
server that is running.

HOW TO LAUNCH
--------------------------------------------------------------------------------
1. Windows
   Double-click run-windows.bat

2. macOS
   chmod +x run-macos.sh && ./run-macos.sh

3. Linux
   chmod +x run-linux.sh && ./run-linux.sh
   Optional: copy tcp-browser.desktop into ~/.local/share/applications/

4. Python native webview (cross-platform, no Chrome required)
   pip install pywebview
   python tcp_desktop_app.py

5. Node
   node launcher.js

WHAT THE SERVER DOES
--------------------------------------------------------------------------------
- Removes known analytics, advertising and telemetry scripts.
- Strips tracking query parameters (utm_*, fbclid, gclid, ...).
- Serves the sanitised document into a sandboxed frame.
- Renders the result in Reader, Zero-JS or Text-only mode on request.

LIMITATIONS
--------------------------------------------------------------------------------
- Many sites (including Google sign-in) refuse to be embedded in a frame. Use
  the "Open in Native Window" button for those.
- Performance figures shown in the interface are estimates, not measurements.
================================================================================
`;
}

// Convert to Standalone Software: Downloadable launchers, scripts & portable zip bundles
app.get('/api/download/launcher', async (req: Request, res: Response) => {
  try {
    const appUrl = resolveAppOrigin(req);
    const type = (req.query.type as string) || 'zip';

    const singleFile = (filename: string, contentType: string, body: string) => {
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', contentType);
      return res.send(body);
    };

    if (type === 'windows') {
      return singleFile('tcp-browser-windows.bat', 'application/x-bat; charset=utf-8', buildWindowsLauncher(appUrl));
    }
    if (type === 'macos') {
      return singleFile('tcp-browser-macos.sh', 'application/x-sh; charset=utf-8', buildMacLauncher(appUrl));
    }
    if (type === 'linux') {
      return singleFile('tcp-browser-linux.sh', 'application/x-sh; charset=utf-8', buildLinuxLauncher(appUrl));
    }
    if (type === 'python') {
      return singleFile('tcp_desktop_app.py', 'text/x-python; charset=utf-8', buildPythonLauncher(appUrl));
    }
    if (type === 'node') {
      return singleFile('launcher.js', 'application/javascript; charset=utf-8', buildNodeLauncher(appUrl));
    }

    // Default: generate the full portable ZIP bundle.
    const zip = new JSZip();

    const pkgJson = JSON.stringify({
      name: "tcp-browser-standalone",
      version: "1.0.0",
      description: "TCP Browser standalone window launcher",
      license: "MIT",
      main: "launcher.js",
      scripts: {
        start: "node launcher.js"
      }
    }, null, 2);

    const configJson = JSON.stringify({
      app: "TCP Browser",
      version: "1.0.0",
      appUrl,
      settings: {
        renderingProfile: "shield",
        lowGpuMode: true,
        stripTrackers: true,
        stripUtmParams: true,
        defaultSearchEngine: "duckduckgo"
      }
    }, null, 2);

    zip.file("README.txt", buildBundleReadme(appUrl));
    zip.file("run-windows.bat", buildWindowsLauncher(appUrl));
    zip.file("run-macos.sh", buildMacLauncher(appUrl));
    zip.file("run-linux.sh", buildLinuxLauncher(appUrl));
    zip.file("tcp_desktop_app.py", buildPythonLauncher(appUrl));
    zip.file("tcp-browser.desktop", buildDesktopEntry(appUrl));
    zip.file("package.json", pkgJson);
    zip.file("launcher.js", buildNodeLauncher(appUrl));
    zip.file("tcp-config.json", configJson);

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    res.setHeader('Content-Disposition', 'attachment; filename="tcp-browser-standalone-v1.zip"');
    res.setHeader('Content-Type', 'application/zip');
    res.send(zipBuffer);

  } catch (err: any) {
    console.error('Download packaging error:', err);
    res.status(500).json({ error: 'Failed to package standalone software' });
  }
});

// Serve PWA Web App Manifest
app.get('/manifest.webmanifest', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  res.sendFile(path.join(process.cwd(), 'public', 'manifest.webmanifest'));
});

// Serve Service Worker
app.get('/sw.js', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Service-Worker-Allowed', '/');
  res.sendFile(path.join(process.cwd(), 'public', 'sw.js'));
});

// Vite middleware for development vs Production static serving
async function startServer() {
  const distPath = path.join(process.cwd(), 'dist');
  const distIndex = path.join(distPath, 'index.html');
  const builtAppExists = fs.existsSync(distIndex);
  const isProduction = process.env.NODE_ENV === 'production' || (builtAppExists && process.env.NODE_ENV !== 'development');

  if (isProduction) {
    if (!builtAppExists) {
      console.error(`\n[tcp-browser] NODE_ENV=production but ${distIndex} was not found.`);
      console.error('[tcp-browser] Run `npm run build` first, or start with `npm run dev`.\n');
      process.exit(1);
    }
    app.use(express.static(distPath, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!api\/).*/, (req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-store');
      res.sendFile(distIndex);
    });
    console.log('[tcp-browser] Serving production build from ./dist');
  } else {
    // Loaded lazily so a production install never has to resolve Vite, which is
    // a devDependency used only for the dev middleware.
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[tcp-browser] Vite dev middleware attached (hot reload active)');
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`TCP Browser running at http://localhost:${PORT}`);
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[tcp-browser] Port ${PORT} is already in use.`);
      console.error(`[tcp-browser] Start on another port, e.g.  PORT=3101 npm run dev\n`);
    } else {
      console.error('[tcp-browser] Failed to start server:', err);
    }
    process.exit(1);
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer().catch((err) => {
  console.error('[tcp-browser] Fatal startup error:', err);
  process.exit(1);
});
