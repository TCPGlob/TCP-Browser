import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserTab, RenderingMode, SearchEngine } from '../types';
import { NewTabPage } from './NewTabPage';
import {
  RefreshCw,
  AlertTriangle,
  BookOpen,
  Shield,
  Printer,
  ZoomIn,
  ZoomOut,
  Cpu,
  ZapOff,
  Activity,
  Play,
  ExternalLink,
  Lock,
  Globe,
  Monitor,
  Maximize2
} from 'lucide-react';

interface BrowserViewportProps {
  tab: BrowserTab;
  onNavigate: (url: string) => void;
  onPostSubmit?: (url: string, body: Record<string, string>) => void;
  onReload: () => void;
  onSetMode: (mode: RenderingMode) => void;
  searchEngine: SearchEngine;
  onSelectSearchEngine: (se: SearchEngine) => void;
  totalTrackersBlocked: number;
  totalRamSavedMb: number;
  readerTheme: 'light' | 'sepia' | 'dark' | 'slate';
  onChangeReaderTheme: (theme: 'light' | 'sepia' | 'dark' | 'slate') => void;
  readerFontSize: 'small' | 'medium' | 'large';
  onChangeReaderFontSize: (size: 'small' | 'medium' | 'large') => void;
  onOpenConvertModal?: () => void;
  onOpenProcessTracker?: () => void;
  onOpenShieldModal?: () => void;
  onReportDomMetrics?: (tabId: string, domNodes: number) => void;
  onResumeTab?: (tabId: string) => void;
}

const READER_THEMES = {
  light: { bg: '#faf9f6', fg: '#222222', muted: '#5b5b5b', rule: '#e2e8f0', link: '#1d4ed8' },
  sepia: { bg: '#f4ecd8', fg: '#433422', muted: '#6b5a45', rule: '#e2d7c0', link: '#92400e' },
  dark: { bg: '#18181b', fg: '#d4d4d8', muted: '#a1a1aa', rule: '#27272a', link: '#7dd3fc' },
  slate: { bg: '#0f172a', fg: '#cbd5e1', muted: '#94a3b8', rule: '#1e293b', link: '#7dd3fc' },
} as const;

const READER_FONT_SIZES = { small: '16px', medium: '18px', large: '20px' } as const;

/**
 * The injected document reports its own DOM node count. It is isolated from the
 * app, so without a version marker the parent could not tell these metrics
 * apart from older payloads.
 */
const METRICS_PROTOCOL = 2;

/**
 * Builds the sandboxed reader document. Rendering the article inside an iframe
 * (rather than injecting it into the app document) keeps hostile article markup
 * away from the application origin entirely.
 */
function buildReaderDocument(
  tab: BrowserTab,
  theme: BrowserViewportProps['readerTheme'],
  fontSize: BrowserViewportProps['readerFontSize'],
  appOrigin: string,
): string {
  const palette = READER_THEMES[theme] ?? READER_THEMES.light;
  const reader = tab.readerData!;
  // A sandboxed srcDoc frame has an opaque origin, so it cannot derive the
  // parent's origin itself. Pass it in from the parent (which knows it).
  const targetOrigin = appOrigin || '*';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { color-scheme: ${theme === 'light' || theme === 'sepia' ? 'light' : 'dark'}; }
  html, body { margin: 0; padding: 0; background: ${palette.bg}; color: ${palette.fg}; }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: ${READER_FONT_SIZES[fontSize] ?? '18px'};
    line-height: 1.75;
  }
  .wrap { max-width: 46rem; margin: 0 auto; padding: 2.5rem 1.5rem 6rem; }
  h1.title { font-size: 2.25rem; line-height: 1.2; font-weight: 800; margin: 0 0 0.75rem; letter-spacing: -0.02em; }
  .byline { font-size: 0.9375rem; color: ${palette.muted}; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid ${palette.rule}; }
  a { color: ${palette.link}; text-decoration: underline; text-underline-offset: 2px; word-break: break-word; }
  p { margin: 1.25em 0; }
  h2, h3, h4 { line-height: 1.3; font-weight: 700; margin: 1.6em 0 0.6em; }
  h2 { font-size: 1.5rem; } h3 { font-size: 1.25rem; } h4 { font-size: 1.1rem; }
  ul, ol { margin: 1.25em 0; padding-inline-start: 1.5em; }
  li { margin: 0.4em 0; }
  blockquote { margin: 1.5em 0; padding-inline-start: 1em; border-inline-start: 4px solid ${palette.rule}; color: ${palette.muted}; font-style: italic; }
  pre { background: rgba(100,116,139,0.14); padding: 1em; border-radius: 0.5rem; overflow-x: auto; font-size: 0.9em; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.92em; }
  img, video { max-width: 100%; height: auto; border-radius: 0.5rem; }
  table { width: 100%; border-collapse: collapse; margin: 1.5em 0; font-size: 0.95em; }
  th, td { border: 1px solid ${palette.rule}; padding: 0.5em 0.75em; text-align: start; }
  hr { margin: 2em 0; border: 0; border-top: 1px solid ${palette.rule}; }
</style>
</head>
<body>
  <div class="wrap">
    <h1 class="title">${reader.title}</h1>
    ${reader.byline ? `<div class="byline">${reader.byline}</div>` : ''}
    <div class="reader-body">${reader.content}</div>
  </div>
  <script>
    (function () {
      var APP_ORIGIN = ${JSON.stringify(targetOrigin)};
      var post = function (payload) { try { window.parent.postMessage(payload, APP_ORIGIN); } catch (e) {} };
      document.addEventListener('click', function (event) {
        var anchor = event.target && event.target.closest ? event.target.closest('a') : null;
        if (!anchor) return;
        var href = anchor.getAttribute('href');
        if (!href || href.charAt(0) === '#') return;
        event.preventDefault();
        post({ type: 'TCP_NAVIGATE', url: anchor.href });
      }, true);
      var report = function () {
        post({ type: 'TCP_FRAME_METRICS', protocol: ${METRICS_PROTOCOL}, domNodes: document.getElementsByTagName('*').length, scripts: document.scripts.length, title: document.title });
      };
      if (document.readyState === 'complete') report(); else window.addEventListener('load', report);
    })();
  </script>
</body>
</html>`;
}

export const BrowserViewport: React.FC<BrowserViewportProps> = ({
  tab,
  onNavigate,
  onPostSubmit,
  onReload,
  onSetMode,
  searchEngine,
  onSelectSearchEngine,
  totalTrackersBlocked,
  totalRamSavedMb,
  readerTheme,
  onChangeReaderTheme,
  readerFontSize,
  onChangeReaderFontSize,
  onOpenConvertModal,
  onOpenProcessTracker,
  onOpenShieldModal,
  onReportDomMetrics,
  onResumeTab,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [frameStatus, setFrameStatus] = useState<'idle' | 'loading' | 'ready'>('idle');

  // Changing either of these forces the iframe element to be recreated. Without
  // it React keeps the same <iframe> node and Reload / "Try Again" are no-ops
  // whenever the URL string is unchanged.
  const [reloadNonce, setReloadNonce] = useState(0);

  // Older sanitised documents counted the interceptor script itself; ignore
  // their metrics so the Process Tracker RAM figure stays meaningful.
  const lastMetricsProtocol = useRef(0);

  const appOrigin = useMemo(
    () => (typeof window === 'undefined' ? '' : window.location.origin),
    [],
  );

  // Wrapper so that both the toolbar reload and the in-viewport retry button
  // also recreate the frame.
  const handleReload = useCallback(() => {
    setFrameStatus('loading');
    if (tab.mode === 'direct') {
      setReloadNonce((n) => n + 1);
    }
    onReload();
  }, [onReload, tab.mode]);

  // Messages from inside the sandboxed frame. Every payload is validated
  // against the frame's own window, because `event.origin` is "null" for a
  // sandboxed document and any other window could otherwise spoof navigation.
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const frameWindow = iframeRef.current?.contentWindow;
      if (!frameWindow || event.source !== frameWindow) return;

      const data = event.data;
      if (!data || typeof data !== 'object' || typeof data.type !== 'string') return;

      switch (data.type) {
        case 'TCP_NAVIGATE': {
          if (typeof data.url === 'string' && data.url) onNavigate(data.url);
          break;
        }
        case 'TCP_POST_SUBMIT': {
          if (typeof data.url !== 'string' || !data.url) break;
          const body = data.body && typeof data.body === 'object' ? data.body as Record<string, string> : {};
          if (onPostSubmit) onPostSubmit(data.url, body);
          else onNavigate(data.url);
          break;
        }
        case 'TCP_OPEN_EXTERNAL': {
          if (typeof data.url === 'string' && /^https?:/i.test(data.url)) {
            window.open(data.url, '_blank', 'noopener,noreferrer');
          }
          break;
        }
        case 'TCP_FRAME_ERROR': {
          setFrameStatus('ready');
          break;
        }
        case 'TCP_FRAME_METRICS': {
          setFrameStatus('ready');
          const protocol = typeof data.protocol === 'number' ? data.protocol : 0;
          if (protocol >= METRICS_PROTOCOL && typeof data.domNodes === 'number' && onReportDomMetrics) {
            lastMetricsProtocol.current = protocol;
            onReportDomMetrics(tab.id, data.domNodes);
          }
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onNavigate, onPostSubmit, onReportDomMetrics, tab.id]);

  // Entering the reader view always starts from a freshly built document.
  const readerDocument = useMemo(() => {
    if (tab.mode !== 'reader' || !tab.readerData) return null;
    return buildReaderDocument(tab, readerTheme, readerFontSize, appOrigin);
  }, [tab, readerTheme, readerFontSize, appOrigin]);

  const zoomIn = () => setZoomLevel((z) => Math.min(200, z + 10));
  const zoomOut = () => setZoomLevel((z) => Math.max(50, z - 10));
  const resetZoom = () => setZoomLevel(100);

  // If tab process was terminated via Process Tracker
  if (tab.status === 'killed') {
    const ramSaved = Math.max(
      0,
      (tab.stats.chromeRamEstimateMb || 320) - (tab.stats.estimatedRamMb || 0.8),
    );
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-slate-300 p-8 select-none">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-950/70 border border-rose-800/80 flex items-center justify-center mx-auto mb-4 text-rose-400">
            <ZapOff className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">
            Process Terminated
          </h3>
          <p className="text-xs text-slate-400 font-mono mb-4 break-all bg-slate-950 p-2.5 rounded-lg border border-slate-800">
            {tab.url}
          </p>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            This tab's renderer was terminated via the Internal Process Tracker. All CPU loops and GPU compute have been released, saving <strong className="text-emerald-400 font-mono">~{ramSaved.toFixed(1)} MB</strong> of system memory.
          </p>

          <div className="grid grid-cols-3 gap-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 mb-6 text-center font-mono text-xs">
            <div>
              <div className="text-[10px] text-slate-500 uppercase">CPU now</div>
              <div className="text-emerald-400 font-bold">{tab.stats.cpuUsage ?? 0}%</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase">GPU now</div>
              <div className="text-emerald-400 font-bold">{tab.stats.gpuUsage ?? 0}%</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase">Status</div>
              <div className="text-rose-400 font-bold">Dead</div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
            <button
              onClick={onReload}
              className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md active:scale-95"
            >
              Relaunch Process
            </button>
            {onOpenProcessTracker && (
              <button
                onClick={onOpenProcessTracker}
                className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-xl transition-colors border border-slate-700 flex items-center justify-center gap-1.5"
              >
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>Task Manager</span>
              </button>
            )}
            <button
              onClick={() => onNavigate('about:home')}
              className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-xl transition-colors border border-slate-700"
            >
              Go to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If tab is frozen
  if (tab.status === 'frozen') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-slate-300 p-8 select-none">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-950/70 border border-amber-800/80 flex items-center justify-center mx-auto mb-4 text-amber-400">
            <Cpu className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">
            Tab Process Suspended
          </h3>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            Background timers and animation rendering loops have been frozen to conserve battery and CPU/GPU compute power.
          </p>
          <button
            onClick={() => (onResumeTab ? onResumeTab(tab.id) : onReload())}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 mx-auto"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            <span>Resume Process</span>
          </button>
        </div>
      </div>
    );
  }

  // If tab is at home
  if (tab.url === 'about:home' || !tab.url) {
    return (
      <NewTabPage
        onNavigate={onNavigate}
        searchEngine={searchEngine}
        onSelectSearchEngine={onSelectSearchEngine}
        totalTrackersBlocked={totalTrackersBlocked}
        totalRamSavedMb={totalRamSavedMb}
        onOpenConvertModal={onOpenConvertModal}
        onOpenProcessTracker={onOpenProcessTracker}
        onOpenShieldModal={onOpenShieldModal}
      />
    );
  }

  // If loading
  if (tab.status === 'loading') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-slate-300 p-8">
        <div className="flex flex-col items-center max-w-sm text-center">
          <div className="w-12 h-12 rounded-2xl bg-emerald-950/60 border border-emerald-800/80 flex items-center justify-center mb-4 text-emerald-400">
            <RefreshCw className="w-6 h-6 animate-spin" />
          </div>
          <h3 className="text-base font-semibold text-white mb-1">
            Sanitizing & Loading Page
          </h3>
          <p className="text-xs text-slate-400 font-mono truncate max-w-xs mb-4">
            {tab.url}
          </p>
          <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-900/60 px-3 py-1 rounded-full">
            <Shield className="w-3.5 h-3.5" />
            <span>Stripping Trackers & Telemetry...</span>
          </div>
        </div>
      </div>
    );
  }

  // If error occurred
  if (tab.status === 'error') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-slate-300 p-8">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-xl p-6 text-center shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-amber-950/60 border border-amber-800/60 flex items-center justify-center mx-auto mb-4 text-amber-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">
            Unable to Connect
          </h3>
          <p className="text-xs text-slate-400 font-mono mb-4 break-all bg-slate-950 p-2 rounded border border-slate-800">
            {tab.url}
          </p>
          <p className="text-sm text-slate-400 mb-6">
            {tab.errorMessage || 'The remote server did not respond or blocked connection.'}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 flex-wrap">
            <button
              onClick={handleReload}
              className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-semibold text-xs rounded-lg transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => onSetMode(tab.mode === 'direct' ? 'shield' : 'direct')}
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Switch to {tab.mode === 'direct' ? 'Shield Mode' : 'Direct Mode'}</span>
            </button>
            <button
              onClick={() => window.open(tab.url, '_blank', 'noopener,noreferrer')}
              className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition-colors border border-slate-700 flex items-center justify-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
              <span>Open in Native Window</span>
            </button>
            <button
              onClick={() => onNavigate(tab.url)}
              className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition-colors border border-slate-700"
              title={`Search with the configured engine (${searchEngine})`}
            >
              Search Web
            </button>
            <button
              onClick={() => onNavigate('about:home')}
              className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition-colors border border-slate-700"
            >
              Go to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Reader Mode View: the article renders inside an isolated sandboxed frame.
  if (tab.mode === 'reader' && tab.readerData && readerDocument) {
    return (
      <div className={`flex-1 flex flex-col h-full overflow-hidden ${READER_THEMES[readerTheme]?.bg === '#18181b' || READER_THEMES[readerTheme]?.bg === '#0f172a' ? 'bg-slate-900' : 'bg-white'}`}>
        <div className="sticky top-0 z-20 backdrop-blur-md border-b border-slate-400/20 px-4 py-2 flex items-center justify-between flex-wrap gap-2 text-xs bg-slate-900/95 text-slate-300">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-[11px] bg-blue-500/10 text-blue-400 font-semibold">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Reader View</span>
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400 font-mono text-[11px]">
              {tab.readerData.readingTimeMinutes} min read
            </span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-400 font-mono text-[11px]">
              {tab.readerData.length.toLocaleString()} words
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Theme Selector */}
            <div className="flex items-center gap-1">
              {(['light', 'sepia', 'dark', 'slate'] as const).map((thm) => (
                <button
                  key={thm}
                  onClick={() => onChangeReaderTheme(thm)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium capitalize border transition-all ${
                    readerTheme === thm
                      ? 'border-blue-500 ring-1 ring-blue-500 text-white'
                      : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  {thm}
                </button>
              ))}
            </div>

            {/* Font Size Selector */}
            <div className="flex items-center gap-1 border-l pl-2 border-slate-400/20">
              <button
                onClick={() => onChangeReaderFontSize('small')}
                className={`px-1.5 py-0.5 rounded text-[11px] ${readerFontSize === 'small' ? 'font-bold underline text-white' : 'opacity-70'}`}
              >
                A-
              </button>
              <button
                onClick={() => onChangeReaderFontSize('medium')}
                className={`px-1.5 py-0.5 rounded text-xs ${readerFontSize === 'medium' ? 'font-bold underline text-white' : 'opacity-70'}`}
              >
                A
              </button>
              <button
                onClick={() => onChangeReaderFontSize('large')}
                className={`px-1.5 py-0.5 rounded text-sm ${readerFontSize === 'large' ? 'font-bold underline text-white' : 'opacity-70'}`}
              >
                A+
              </button>
            </div>

            {/* Print / Exit */}
            <div className="flex items-center gap-1 border-l pl-2 border-slate-400/20">
              <button
                onClick={() => iframeRef.current?.contentWindow?.print()}
                className="p-1 rounded hover:opacity-80 transition-opacity"
                title="Print Article"
              >
                <Printer className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onSetMode('shield')}
                className="px-2 py-0.5 rounded bg-slate-500/10 hover:bg-slate-500/20 text-[11px] font-medium transition-colors"
                title="Exit Reader Mode"
              >
                Exit Reader
              </button>
            </div>
          </div>
        </div>

        <iframe
          key={`reader-${tab.id}-${reloadNonce}-${readerTheme}-${readerFontSize}`}
          ref={iframeRef}
          srcDoc={readerDocument}
          sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-modals"
          title={tab.readerData.title || 'Reader article'}
          className="w-full flex-1 border-0 bg-transparent"
        />
      </div>
    );
  }

  const isGoogleOrAuth = /accounts\.google\.com|mail\.google\.com|google\.com\/(accounts|signin)|login\.live\.com|login\.microsoftonline\.com|appleid\.apple\.com/i.test(tab.url);
  const frameSrc = tab.mode === 'direct' ? tab.url : undefined;
  // `allow-same-origin` is deliberately absent: a srcDoc frame would otherwise
  // inherit this application's origin, letting any script in the sanitised page
  // read the user's bookmarks, history and settings from localStorage, or reach
  // into the parent document.
  const frameSandbox = tab.mode === 'zero-js'
    ? 'allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals'
    : 'allow-forms allow-scripts allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals';

  return (
    <div className="relative flex-1 w-full h-full bg-slate-900 overflow-hidden flex flex-col">
      {/* Google / High-Security Auth Notice Gateway */}
      {isGoogleOrAuth && (
        <div className="bg-amber-950/95 text-amber-200 border-b border-amber-800/80 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs z-30 shadow-md">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              <strong>Google / Protected Sign-In:</strong> Google security blocks in-frame authentication. Click <strong>Open in Native Window</strong> to sign into Gmail securely, or run the desktop app.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.open(tab.url, '_blank', 'noopener,noreferrer')}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded flex items-center gap-1.5 transition-colors shadow-sm"
              title="Open Google / Gmail in a direct native window"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in Native Window</span>
            </button>
            {onOpenConvertModal && (
              <button
                onClick={onOpenConvertModal}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-200 border border-amber-700/50 rounded flex items-center gap-1 transition-colors"
                title="Run as full desktop app without iframe sandbox"
              >
                <Monitor className="w-3 h-3 text-amber-400" />
                <span>Desktop App</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Frame status / zoom HUD */}
      <div className="absolute bottom-3 right-3 z-30 flex items-center gap-1 bg-slate-900/90 text-slate-200 border border-slate-700 px-2 py-1 rounded-lg text-xs shadow-lg backdrop-blur">
        <button onClick={zoomOut} className="p-0.5 hover:text-emerald-400" title="Zoom out">
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="font-mono text-[11px] w-10 text-center">{zoomLevel}%</span>
        <button onClick={zoomIn} className="p-0.5 hover:text-emerald-400" title="Zoom in">
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button onClick={resetZoom} className="p-0.5 hover:text-emerald-400" title="Reset zoom to 100%">
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Direct mode cannot be verified from the parent, so surface that. */}
      {tab.mode === 'direct' && frameStatus !== 'ready' && (
        <div className="absolute bottom-3 left-3 z-30 bg-amber-950/90 text-amber-200 border border-amber-800/70 px-2.5 py-1 rounded-lg text-[11px]">
          Loading directly from the site (no sanitising)…
        </div>
      )}

      {/* Sandboxed / Direct Iframe */}
      <iframe
        id="browser-content-frame"
        key={`${tab.id}:${tab.mode}:${tab.url}:${reloadNonce}`}
        ref={iframeRef}
        src={frameSrc}
        srcDoc={tab.mode === 'direct' ? undefined : tab.htmlContent}
        sandbox={frameSandbox}
        referrerPolicy="no-referrer"
        onLoad={() => setFrameStatus('ready')}
        onError={() => setFrameStatus('ready')}
        title={tab.title || 'Web Content'}
        className="w-full h-full border-0 bg-white"
        style={{
          transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : 'none',
          transformOrigin: 'top left',
          width: zoomLevel !== 100 ? `${10000 / zoomLevel}%` : '100%',
          height: zoomLevel !== 100 ? `${10000 / zoomLevel}%` : '100%',
        }}
      />
    </div>
  );
};
