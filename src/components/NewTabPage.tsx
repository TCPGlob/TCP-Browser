import React, { useState } from 'react';
import { Search, Shield, Cpu, HardDrive, Lock, ExternalLink, CheckCircle2, Download, Laptop, Share2, Check, ArrowRight } from 'lucide-react';
import { QUICK_LINKS } from '../data/defaults';
import { SearchEngine } from '../types';

interface NewTabPageProps {
  onNavigate: (url: string) => void;
  searchEngine: SearchEngine;
  onSelectSearchEngine: (se: SearchEngine) => void;
  totalTrackersBlocked: number;
  totalRamSavedMb: number;
  onOpenConvertModal?: () => void;
  onOpenProcessTracker?: () => void;
  onOpenShieldModal?: () => void;
}

export const NewTabPage: React.FC<NewTabPageProps> = ({
  onNavigate,
  searchEngine,
  onSelectSearchEngine,
  totalTrackersBlocked,
  totalRamSavedMb,
  onOpenConvertModal,
  onOpenProcessTracker,
  onOpenShieldModal,
}) => {
  const [query, setQuery] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onNavigate(query.trim());
    }
  };

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const url = `${window.location.origin}/?action=convert`;
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      if (onOpenConvertModal) onOpenConvertModal();
    }
  };

  return (
    <div id="new-tab-page" className="min-h-full bg-slate-950 text-slate-100 flex flex-col items-center justify-start p-6 md:p-12 overflow-y-auto">
      {/* Brand & Mission */}
      <div className="w-full max-w-3xl flex flex-col items-center text-center mt-4 mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 text-xs font-mono mb-4">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span>TCP Browser • 1/10th Computer Load Engine</span>
        </div>

        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-2">
          Fast. Private. Bloat-Free.
        </h1>
        <p className="text-slate-400 text-sm md:text-base max-w-xl">
          Engineered to replace memory-heavy browsers by stripping trackers, background miners, and GPU thrashing while rendering everything with perfection.
        </p>
      </div>

      {/* Standalone Software Conversion & Download Banner */}
      <div className="w-full max-w-3xl mb-6">
        <div
          onClick={onOpenConvertModal}
          className="group relative cursor-pointer overflow-hidden rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-950 p-4 sm:p-5 shadow-xl hover:border-emerald-500 hover:shadow-emerald-500/10 transition-all"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 flex-shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                <Laptop className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-white group-hover:text-emerald-300 transition-colors">
                    Convert to Downloadable Standalone Software
                  </h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-900/80 text-emerald-300 border border-emerald-600/50">
                    1/10th Load Speed
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 max-w-lg leading-relaxed">
                  Click to convert into portable native software for Windows, Mac, or Linux. Completely stripped of bloat with zero telemetry and 96% lower RAM.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition-colors"
                title="Copy conversion link to share with others"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Link Copied!' : 'Share Link'}</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onOpenConvertModal) onOpenConvertModal();
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md transition-all group-hover:shadow-emerald-500/25"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Convert & Download</span>
                <ArrowRight className="w-3.5 h-3.5 ml-0.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Search Input */}
      <div className="w-full max-w-2xl mb-8">
        <form onSubmit={handleSearchSubmit} className="relative">
          <div className="relative flex items-center bg-slate-900 border-2 border-slate-700 hover:border-slate-600 focus-within:border-emerald-500 rounded-xl px-4 py-3 shadow-2xl transition-all">
            <Search className="w-5 h-5 text-slate-400 mr-3 flex-shrink-0" />
            <input
              id="new-tab-search-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search privacy web or type any website URL..."
              autoFocus
              className="flex-1 bg-transparent text-slate-100 text-base outline-none placeholder-slate-500"
            />
            <button
              type="submit"
              className="ml-2 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors shadow-sm"
            >
              Go
            </button>
          </div>

          {/* Search Engine Switcher Pills */}
          <div className="flex items-center justify-center gap-2 mt-3 text-xs text-slate-400">
            <span className="text-[11px] font-mono text-slate-500">ENGINE:</span>
            {[
              { id: 'duckduckgo', label: 'DuckDuckGo (Lite)' },
              { id: 'brave', label: 'Brave Search' },
              { id: 'searxng', label: 'SearXNG' },
              { id: 'google-clean', label: 'Google Clean' },
            ].map((engine) => (
              <button
                key={engine.id}
                type="button"
                onClick={() => onSelectSearchEngine(engine.id as SearchEngine)}
                className={`px-2.5 py-0.5 rounded-full border transition-all text-xs ${
                  searchEngine === engine.id
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80 font-medium'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {engine.label}
              </button>
            ))}
          </div>
        </form>
      </div>

      {/* Real-time Hardware & Efficiency Metrics */}
      <div className="w-full max-w-3xl grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        <div
          onClick={onOpenProcessTracker}
          className={`bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between transition-all ${
            onOpenProcessTracker ? 'cursor-pointer hover:border-emerald-500/60 hover:bg-slate-850 shadow-sm' : ''
          }`}
          title="Click to view full CPU & GPU Process Tracker (Shift+Esc)"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Memory Saved</span>
            <HardDrive className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">
            {totalRamSavedMb > 0 ? `~${Math.round(totalRamSavedMb)} MB` : '—'}
          </div>
          <span className="text-[11px] text-emerald-400/90 font-mono mt-1">
            {totalRamSavedMb > 0 ? 'vs Chrome process' : 'Browsing totals appear here'}
          </span>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Trackers Blocked</span>
            <Shield className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">
            {totalTrackersBlocked}
          </div>
          <span className="text-[11px] text-slate-400 font-mono mt-1">Telemetry & ads blocked</span>
        </div>

        <div
          onClick={onOpenProcessTracker}
          className={`bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between transition-all ${
            onOpenProcessTracker ? 'cursor-pointer hover:border-emerald-500/60 hover:bg-slate-850 shadow-sm' : ''
          }`}
          title="Click to view CPU & GPU load breakdown and kill tasks"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">GPU Load</span>
            <Cpu className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono flex items-center justify-between">
            <span>&lt; 1%</span>
            {onOpenProcessTracker && (
              <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-semibold">
                Tracker
              </span>
            )}
          </div>
          <span className="text-[11px] text-emerald-400/90 font-mono mt-1">Low-GPU profile</span>
        </div>

        <div
          onClick={onOpenShieldModal}
          className={`bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between transition-all ${
            onOpenShieldModal ? 'cursor-pointer hover:border-emerald-500/60 hover:bg-slate-850 shadow-sm' : ''
          }`}
          title="Click to inspect the privacy shield for the current tab"
        >
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-xs font-medium">Privacy Shield</span>
            <Lock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">
            Active
          </div>
          <span className="text-[11px] text-slate-400 font-mono mt-1">No accounts, no cloud logs</span>
        </div>
      </div>

      {/* Speed Dial / Quick Sites */}
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Optimized Quick Sites
          </h2>
          <span className="text-[11px] text-slate-500">Trackers stripped automatically</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {QUICK_LINKS.map((link) => (
            <button
              key={link.title}
              onClick={() => onNavigate(link.url)}
              className="group text-left p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-emerald-500/50 hover:bg-slate-850 hover:shadow-lg transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-200 group-hover:text-emerald-400 transition-colors">
                    {link.title}
                  </span>
                  <ExternalLink className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                  {link.description}
                </p>
              </div>
              <span className="text-[10px] text-slate-500 font-mono mt-3 uppercase">
                {link.category}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Security Architecture Guarantees */}
      <div className="w-full max-w-3xl mt-10 p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>UTM parameters & Facebook/Google click identifiers (fbclid, gclid) stripped from all URLs.</span>
        </div>
        <div className="flex items-center gap-4 text-slate-500 font-mono text-[11px]">
          <span>Sandboxed DOM</span>
          <span>•</span>
          <span>Zero Fingerprinting</span>
          <span>•</span>
          <span>No Cloud Logs</span>
        </div>
      </div>
    </div>
  );
};
