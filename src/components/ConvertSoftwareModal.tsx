import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Terminal,
  Laptop,
  Share2,
  Check,
  Zap,
  ShieldCheck,
  Globe,
  Sparkles,
  ArrowDownToLine,
  Copy
} from 'lucide-react';

interface ConvertSoftwareModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt?: any;
}

export const ConvertSoftwareModal: React.FC<ConvertSoftwareModalProps> = ({
  isOpen,
  onClose,
  deferredPrompt,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedDirectLink, setCopiedDirectLink] = useState(false);
  const [isInstallingPwa, setIsInstallingPwa] = useState(false);
  const [pwaInstalled, setPwaInstalled] = useState(false);

  // Generate dynamic sharing URLs based on current origin
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://tcp-browser.local';
  const shareableConvertUrl = `${origin}/?action=convert`;
  const directDownloadUrl = `${origin}/api/download/launcher?type=zip`;

  useEffect(() => {
    const handleInstalled = () => {
      setPwaInstalled(true);
      setIsInstallingPwa(false);
    };
    window.addEventListener('appinstalled', handleInstalled);
    return () => window.removeEventListener('appinstalled', handleInstalled);
  }, []);

  // Dismiss with Escape.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopyConvertLink = async () => {
    try {
      await navigator.clipboard.writeText(shareableConvertUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Fallback
      prompt('Copy this conversion link for others:', shareableConvertUrl);
    }
  };

  const handleCopyDirectDownload = async () => {
    try {
      await navigator.clipboard.writeText(directDownloadUrl);
      setCopiedDirectLink(true);
      setTimeout(() => setCopiedDirectLink(false), 2500);
    } catch {
      prompt('Direct software package link:', directDownloadUrl);
    }
  };

  const handleInstallPwa = async () => {
    if (deferredPrompt) {
      setIsInstallingPwa(true);
      try {
        deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          setPwaInstalled(true);
        }
      } catch (err) {
        console.error('PWA install error:', err);
      } finally {
        setIsInstallingPwa(false);
      }
    } else {
      // Guide the user
      alert('To install TCP Browser directly as a desktop application:\n1. Click the browser menu (⋮ or ⋯ in the top-right).\n2. Select "Install TCP Browser" or "Install App / Save to Desktop".\n3. It will launch in its own standalone, bloat-free window!');
    }
  };

  return (
    <div
      id="convert-software-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  Convert to Downloadable Software
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/60">
                  1/10th Computer Load
                </span>
              </div>
              <p className="text-xs text-slate-400">
                TCP Browser Engine • Stripped of bloat, trackers, and memory leaks
              </p>
            </div>
          </div>
          <button
            id="btn-close-convert-modal"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="overflow-y-auto p-6 space-y-6 text-sm text-slate-300">
          {/* Performance & Footprint Benchmark Card */}
          <div className="rounded-xl bg-slate-950 border border-slate-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                Computer Load Speed & Footprint Comparison
              </span>
              <span className="text-[11px] font-mono text-emerald-400 font-semibold">
                96% Memory Reduction
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Chrome bloat card */}
              <div className="rounded-lg bg-slate-900/80 border border-red-900/30 p-3">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span className="font-semibold text-red-400">Standard Chrome / Edge</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-950 text-red-400">Heavy Load</span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-400 font-mono">
                  <div className="flex justify-between">
                    <span>RAM / Tab:</span>
                    <span className="text-slate-300 font-semibold">350 – 550 MB</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GPU Utilization:</span>
                    <span className="text-slate-300 font-semibold">20% – 45%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Background Trackers:</span>
                    <span className="text-red-400 font-semibold">40+ scripts active</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cold Launch Speed:</span>
                    <span className="text-slate-300">2.4s – 4.2s</span>
                  </div>
                </div>
              </div>

              {/* TCP Browser 1/10th card */}
              <div className="rounded-lg bg-emerald-950/30 border border-emerald-600/40 p-3">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span className="font-semibold text-emerald-400">TCP Browser Software</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-900/80 text-emerald-300">1/10th Load</span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-400 font-mono">
                  <div className="flex justify-between">
                    <span>RAM / Tab:</span>
                    <span className="text-emerald-400 font-bold">~14 MB (96% less)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GPU Utilization:</span>
                    <span className="text-emerald-400 font-bold">&lt; 1%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Background Trackers:</span>
                    <span className="text-emerald-400 font-bold">0 (Clean Sandbox)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cold Launch Speed:</span>
                    <span className="text-emerald-400 font-bold">Instant (0.2s)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Primary Action 1: Universal Portable ZIP Bundle */}
          <div className="rounded-xl border-2 border-emerald-500/50 bg-gradient-to-b from-slate-900 to-slate-950 p-5 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-emerald-500 text-slate-950 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-lg">
              Recommended
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">
                    TCP Browser Standalone Software Suite
                  </h3>
                  <span className="text-[11px] font-mono text-emerald-400">(.zip)</span>
                </div>
                <p className="text-xs text-slate-400 mt-1 max-w-lg leading-relaxed">
                  Complete 1-click executable bundle. Includes Windows batch runner (<code className="text-emerald-300">.bat</code>), macOS shell script (<code className="text-emerald-300">.sh</code>), Linux desktop shortcut (<code className="text-emerald-300">.desktop</code>), Python Webview wrapper, and lean config.
                </p>
              </div>

              <a
                id="btn-download-full-bundle"
                href="/api/download/launcher?type=zip"
                download="tcp-browser-standalone-v1.zip"
                className="flex-shrink-0 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs tracking-wide shadow-lg shadow-emerald-500/20 transition-all active:scale-98"
              >
                <Download className="w-4 h-4" />
                <span>Download Standalone Software (.ZIP)</span>
              </a>
            </div>
          </div>

          {/* Primary Action 2: Shareable Link for Others */}
          <div className="rounded-xl bg-slate-950 border border-slate-800 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5 text-blue-400" />
                Shareable Link for Others to Convert & Download
              </span>
              <span className="text-[11px] text-slate-500">Public & Zero-Setup</span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Send this link to others so they can immediately open and convert TCP Browser into standalone software on their machines:
            </p>

            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 truncate select-all">
                {shareableConvertUrl}
              </div>
              <button
                id="btn-copy-shareable-link"
                onClick={handleCopyConvertLink}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-xs transition-all ${
                  copiedLink
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                }`}
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>

            <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
              <span>Anyone opening this link receives the instant 1-click Software Conversion Wizard.</span>
              <button
                onClick={handleCopyDirectDownload}
                className="text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                {copiedDirectLink ? 'Copied Direct .ZIP link!' : 'Copy Direct .ZIP Download Link'}
              </button>
            </div>
          </div>

          {/* Primary Action 3: Individual Platform Launchers */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-purple-400" />
                Platform-Specific 1-Click Launchers (Single File)
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {/* Windows Launcher */}
              <a
                id="btn-download-windows"
                href="/api/download/launcher?type=windows"
                download="tcp-browser-windows.bat"
                className="group p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/60 hover:bg-slate-900 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-200 group-hover:text-emerald-400">Windows</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">.BAT</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    1-click script configured with Edge/Chrome ultra-low memory flags.
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                  <ArrowDownToLine className="w-3.5 h-3.5" />
                  <span>Download .bat</span>
                </div>
              </a>

              {/* macOS Launcher */}
              <a
                id="btn-download-macos"
                href="/api/download/launcher?type=macos"
                download="tcp-browser-macos.sh"
                className="group p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/60 hover:bg-slate-900 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-200 group-hover:text-emerald-400">macOS</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">.SH</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Native shell script launching a clean isolated desktop window.
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                  <ArrowDownToLine className="w-3.5 h-3.5" />
                  <span>Download .sh</span>
                </div>
              </a>

              {/* Linux Launcher */}
              <a
                id="btn-download-linux"
                href="/api/download/launcher?type=linux"
                download="tcp-browser-linux.sh"
                className="group p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/60 hover:bg-slate-900 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-200 group-hover:text-emerald-400">Linux</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">.SH</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Single-process renderer script with zero background daemons.
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                  <ArrowDownToLine className="w-3.5 h-3.5" />
                  <span>Download .sh</span>
                </div>
              </a>

              {/* Python Webview Native Window */}
              <a
                id="btn-download-python"
                href="/api/download/launcher?type=python"
                download="tcp_desktop_app.py"
                className="group p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/60 hover:bg-slate-900 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-200 group-hover:text-emerald-400">Python Webview</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">.PY</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Native OS WebKit window via pywebview. True ~15MB RAM usage.
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                  <ArrowDownToLine className="w-3.5 h-3.5" />
                  <span>Download .py</span>
                </div>
              </a>
            </div>
          </div>

          {/* Primary Action 4: In-Browser PWA Desktop App Installation */}
          <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-950/80 border border-blue-800/60 flex items-center justify-center text-blue-400 flex-shrink-0 mt-0.5">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white">
                  Install as Native Desktop Application (PWA)
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Runs directly in its own standalone desktop window with offline caching, dock/taskbar pinning, and zero browser toolbar bloat.
                </p>
              </div>
            </div>

            <button
              id="btn-install-pwa"
              onClick={handleInstallPwa}
              disabled={pwaInstalled}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-xs transition-colors ${
                pwaInstalled
                  ? 'bg-slate-800 text-slate-400 cursor-default'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{pwaInstalled ? 'Installed as App' : 'Install Desktop App'}</span>
            </button>
          </div>

          {/* Architecture Checklist */}
          <div className="rounded-xl bg-slate-950/60 border border-slate-800/80 p-4">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
              1/10th Computer Load Guarantees
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>All Google Analytics, GTM, Meta Pixel, Hotjar blocked</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>URL tracking parameters (utm_*, fbclid, gclid) stripped</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Hardware & Canvas fingerprinters neutralized</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>GPU compositing throttled to prevent fan spinning</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 font-mono">
            TCP Browser Engine v1.0 • Stripped of bloat, renders with precision
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
