import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  X,
  Home,
  Lock,
  Search,
  Shield,
  BookOpen,
  Zap,
  FileText,
  Star,
  Download,
  Clock,
  Settings,
  Cpu,
  Activity,
  Globe,
  ExternalLink
} from 'lucide-react';
import { BrowserTab, RenderingMode, SearchEngine } from '../types';

interface OmniboxProps {
  activeTab: BrowserTab;
  onNavigate: (url: string) => void;
  onReload: () => void;
  onStopLoading?: () => void;
  onGoBack: () => void;
  onGoForward: () => void;
  onGoHome: () => void;
  onSetMode: (mode: RenderingMode) => void;
  onToggleBookmark: () => void;
  isBookmarked: boolean;
  onOpenShieldModal: () => void;
  onOpenDrawer: (tab: 'bookmarks' | 'history') => void;
  onOpenSettings: () => void;
  onOpenConvertModal: () => void;
  onOpenProcessTracker?: () => void;
  onExportSnapshot: () => void;
  searchEngine: SearchEngine;
  onSelectSearchEngine: (se: SearchEngine) => void;
  lowGpuMode: boolean;
  onToggleLowGpu: () => void;
}

export const Omnibox: React.FC<OmniboxProps> = ({
  activeTab,
  onNavigate,
  onReload,
  onStopLoading,
  onGoBack,
  onGoForward,
  onGoHome,
  onSetMode,
  onToggleBookmark,
  isBookmarked,
  onOpenShieldModal,
  onOpenDrawer,
  onOpenSettings,
  onOpenConvertModal,
  onOpenProcessTracker,
  onExportSnapshot,
  searchEngine,
  onSelectSearchEngine,
  lowGpuMode,
  onToggleLowGpu,
}) => {
  const [inputValue, setInputValue] = useState(activeTab.url === 'about:home' ? '' : activeTab.url);
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const searchMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(activeTab.url === 'about:home' ? '' : activeTab.url);
  }, [activeTab.url]);

  // Both dropdowns are dismissible with Escape or a click anywhere outside them.
  useEffect(() => {
    if (!showModeDropdown && !showSearchDropdown) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (!modeMenuRef.current?.contains(target)) setShowModeDropdown(false);
      if (!searchMenuRef.current?.contains(target)) setShowSearchDropdown(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowModeDropdown(false);
        setShowSearchDropdown(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showModeDropdown, showSearchDropdown]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onNavigate(inputValue.trim());
    }
  };

  const handleInputFocus = () => {
    inputRef.current?.select();
  };

  const canGoBack = activeTab.historyIndex > 0;
  const canGoForward = activeTab.historyIndex < activeTab.history.length - 1;

  const modeIcons = {
    'shield': <Shield className="w-3.5 h-3.5 text-emerald-400" />,
    'direct': <Globe className="w-3.5 h-3.5 text-blue-400" />,
    'reader': <BookOpen className="w-3.5 h-3.5 text-blue-400" />,
    'zero-js': <Zap className="w-3.5 h-3.5 text-amber-400" />,
    'text-only': <FileText className="w-3.5 h-3.5 text-purple-400" />,
  };

  const modeLabels = {
    'shield': 'Shield Mode',
    'direct': 'Direct Mode',
    'reader': 'Reader Mode',
    'zero-js': 'Zero-JS Mode',
    'text-only': 'Text Only',
  };

  return (
    <div id="browser-omnibox-bar" className="bg-slate-800 text-slate-200 px-3 py-2 border-b border-slate-700/80 flex items-center gap-2">
      {/* Navigation Controls */}
      <div className="flex items-center gap-1">
        <button
          id="btn-nav-back"
          onClick={onGoBack}
          disabled={!canGoBack}
          className={`p-1.5 rounded-md transition-colors ${
            canGoBack
              ? 'text-slate-300 hover:bg-slate-700 hover:text-white'
              : 'text-slate-600 cursor-not-allowed'
          }`}
          title="Click to go back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <button
          id="btn-nav-forward"
          onClick={onGoForward}
          disabled={!canGoForward}
          className={`p-1.5 rounded-md transition-colors ${
            canGoForward
              ? 'text-slate-300 hover:bg-slate-700 hover:text-white'
              : 'text-slate-600 cursor-not-allowed'
          }`}
          title="Click to go forward"
        >
          <ArrowRight className="w-4 h-4" />
        </button>

        <button
          id="btn-nav-reload"
          onClick={activeTab.status === 'loading' && onStopLoading ? onStopLoading : onReload}
          className="p-1.5 rounded-md text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          title={activeTab.status === 'loading' ? 'Stop loading' : 'Reload page'}
        >
          {activeTab.status === 'loading' ? (
            <X className="w-4 h-4 text-amber-400" />
          ) : (
            <RotateCw className="w-4 h-4" />
          )}
        </button>

        <button
          id="btn-nav-home"
          onClick={onGoHome}
          className="p-1.5 rounded-md text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          title="Open New Tab Homepage"
        >
          <Home className="w-4 h-4" />
        </button>
      </div>

      {/* Main Address / Search Bar */}
      <form onSubmit={handleSubmit} className="flex-1 flex items-center min-w-0">
        <div className="relative flex items-center w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 focus-within:border-emerald-500/80 focus-within:ring-1 focus-within:ring-emerald-500/50 transition-all">
          {/* HTTPS / Search Icon */}
          <div className="flex items-center gap-1 mr-2 text-slate-400">
            {activeTab.url.startsWith('https://') ? (
              <span title="Encrypted Connection (HTTPS)">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
              </span>
            ) : activeTab.url === 'about:home' ? (
              <Search className="w-3.5 h-3.5 text-slate-500" />
            ) : (
              <GlobeIcon className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>

          {/* URL / Search Input */}
          <input
            id="omnibox-input"
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={handleInputFocus}
            placeholder="Search without trackers or enter address..."
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none min-w-0 select-text"
            spellCheck={false}
            autoComplete="off"
          />

          {/* Clear input button if populated */}
          {inputValue && (
            <button
              type="button"
              onClick={() => setInputValue('')}
              className="p-0.5 text-slate-500 hover:text-slate-300 mr-2"
              title="Clear address"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Search Engine Selector Badge */}
          <div className="relative" ref={searchMenuRef}>
            <button
              type="button"
              id="btn-search-engine-toggle"
              onClick={() => {
                setShowModeDropdown(false);
                setShowSearchDropdown((prev) => !prev);
              }}
              className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 mr-2 flex items-center gap-1"
              title="Change Privacy Search Engine"
            >
              <Search className="w-2.5 h-2.5 text-emerald-400" />
              <span className="capitalize">{searchEngine.replace('-clean', '')}</span>
            </button>

            {showSearchDropdown && (
              <div className="absolute right-0 top-full mt-2 w-44 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1 z-50 text-xs">
                <div className="px-3 py-1 font-semibold text-[10px] text-slate-400 uppercase tracking-wider">
                  Default Search
                </div>
                {[
                  { id: 'duckduckgo', name: 'DuckDuckGo (Lite)' },
                  { id: 'brave', name: 'Brave Search' },
                  { id: 'searxng', name: 'SearXNG' },
                  { id: 'google-clean', name: 'Google (No-Track)' },
                ].map((eng) => (
                  <button
                    key={eng.id}
                    type="button"
                    onClick={() => {
                      onSelectSearchEngine(eng.id as SearchEngine);
                      setShowSearchDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 hover:bg-slate-800 transition-colors flex items-center justify-between ${
                      searchEngine === eng.id ? 'text-emerald-400 font-semibold' : 'text-slate-300'
                    }`}
                  >
                    <span>{eng.name}</span>
                    {searchEngine === eng.id && <span className="text-emerald-400 text-xs">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tracker Shield Pill */}
          <button
            type="button"
            id="btn-shield-pill"
            onClick={onOpenShieldModal}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs transition-all ${
              activeTab.stats.trackersBlocked > 0
                ? 'bg-emerald-950 text-emerald-300 hover:bg-emerald-900 border border-emerald-700/60'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
            }`}
            title="Inspect Blocked Trackers & Memory Profile"
          >
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-mono text-[11px] font-medium">
              {activeTab.stats.trackersBlocked > 0 ? `${activeTab.stats.trackersBlocked} Blocked` : 'Shield Active'}
            </span>
          </button>
        </div>
      </form>

      {/* Rendering Mode Selector (1/10th Memory / 0 GPU Toggle) */}
      <div className="relative" ref={modeMenuRef}>
        <button
          type="button"
          id="btn-mode-selector"
          onClick={() => {
            setShowSearchDropdown(false);
            setShowModeDropdown((prev) => !prev);
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-900 hover:bg-slate-700/80 border border-slate-700 text-xs font-medium text-slate-200 transition-colors"
          title="Select Rendering Profile (Saves Memory & GPU)"
        >
          {modeIcons[activeTab.mode]}
          <span className="hidden sm:inline">{modeLabels[activeTab.mode]}</span>
        </button>

        {showModeDropdown && (
          <div className="absolute right-0 top-full mt-2 w-56 bg-slate-900 border border-slate-700 rounded-lg shadow-xl py-1 z-50 text-xs">
            <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              Low-Footprint Profiles
            </div>
            {[
              { id: 'shield', label: 'Shield Mode', desc: 'Standard layout, all trackers stripped (~75% RAM saved)', icon: <Shield className="w-4 h-4 text-emerald-400" /> },
              { id: 'direct', label: 'Direct Mode', desc: 'Direct un-proxied frame connection for full web app features', icon: <Globe className="w-4 h-4 text-blue-400" /> },
              { id: 'reader', label: 'Reader Mode', desc: 'Distraction-free article text (~92% RAM saved, 0% GPU)', icon: <BookOpen className="w-4 h-4 text-blue-400" /> },
              { id: 'zero-js', label: 'Zero-JS Mode', desc: 'Zero scripts executed, no tracking possible (~90% RAM saved)', icon: <Zap className="w-4 h-4 text-amber-400" /> },
              { id: 'text-only', label: 'Text Only', desc: 'Replaces all media with text (~94% RAM saved)', icon: <FileText className="w-4 h-4 text-purple-400" /> },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onSetMode(m.id as RenderingMode);
                  setShowModeDropdown(false);
                }}
                className={`w-full text-left px-3 py-2 hover:bg-slate-800 transition-colors flex items-start gap-2.5 ${
                  activeTab.mode === m.id ? 'bg-slate-800/80 text-emerald-400' : 'text-slate-300'
                }`}
              >
                <div className="mt-0.5 flex-shrink-0">{m.icon}</div>
                <div>
                  <div className="font-medium text-slate-200">{m.label}</div>
                  <div className="text-[11px] text-slate-400">{m.desc}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1 border-l border-slate-700 pl-2">
        {/* Open in Standalone / Native Window (Essential for Google / Protected Auth) */}
        {activeTab.url !== 'about:home' && (
          <button
            id="btn-open-native-window"
            type="button"
            onClick={() => window.open(activeTab.url, '_blank', 'noopener,noreferrer')}
            className="p-1.5 rounded-md text-slate-400 hover:bg-slate-700 hover:text-emerald-400 transition-colors"
            title="Open Current Site in Direct Native Window (Bypasses all iframe / Google Login limits)"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        )}

        {/* Bookmark Current Page */}
        <button
          id="btn-toggle-bookmark"
          type="button"
          onClick={onToggleBookmark}
          disabled={activeTab.url === 'about:home'}
          className={`p-1.5 rounded-md transition-colors ${
            isBookmarked
              ? 'text-amber-400 hover:bg-slate-700'
              : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
          }`}
          title={isBookmarked ? 'Remove bookmark' : 'Bookmark this page'}
        >
          <Star className={`w-4 h-4 ${isBookmarked ? 'fill-amber-400' : ''}`} />
        </button>

        {/* Low-GPU Throttle switch */}
        <button
          id="btn-toggle-low-gpu"
          type="button"
          onClick={onToggleLowGpu}
          className={`p-1.5 rounded-md transition-colors ${
            lowGpuMode
              ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-800/40'
              : 'text-slate-400 hover:bg-slate-700'
          }`}
          title={lowGpuMode ? 'Low-GPU Throttle: Active (Zero CSS animation overhead)' : 'Low-GPU Throttle: Inactive'}
        >
          <Cpu className="w-4 h-4" />
        </button>

        {/* Download Clean Offline Snapshot */}
        <button
          id="btn-download-snapshot"
          type="button"
          onClick={onExportSnapshot}
          disabled={!activeTab.htmlContent || activeTab.url === 'about:home'}
          className="p-1.5 rounded-md text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Download Sanitized Offline HTML (Tracker-free)"
        >
          <Download className="w-4 h-4" />
        </button>

        {/* Internal Web Process & Hardware Resource Tracker */}
        {onOpenProcessTracker && (
          <button
            id="btn-open-task-manager"
            type="button"
            onClick={onOpenProcessTracker}
            className="p-1.5 rounded-md text-slate-400 hover:bg-slate-700 hover:text-emerald-400 transition-colors"
            title="CPU & GPU Process Tracker / Task Manager (Shift+Esc)"
          >
            <Activity className="w-4 h-4 text-emerald-400" />
          </button>
        )}

        {/* Bookmarks & History Drawer Toggle */}
        <button
          id="btn-open-history"
          type="button"
          onClick={() => onOpenDrawer('history')}
          className="p-1.5 rounded-md text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
          title="History & Bookmarks (Ctrl+H)"
        >
          <Clock className="w-4 h-4" />
        </button>

        {/* Browser Settings */}
        <button
          id="btn-open-settings"
          type="button"
          onClick={onOpenSettings}
          className="p-1.5 rounded-md text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
          title="Browser Settings & Shields"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Convert to Standalone Downloadable Software */}
        <button
          id="btn-convert-to-software"
          type="button"
          onClick={onOpenConvertModal}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all ml-1 active:scale-95 cursor-pointer"
          title="Convert to Standalone Downloadable Software (1/10th Computer Load)"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline font-medium">Convert to App</span>
        </button>
      </div>
    </div>
  );
};

function GlobeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}
