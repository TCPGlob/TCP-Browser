import React, { useEffect } from 'react';
import { X, Settings, Shield, Cpu, Search, Check, Activity } from 'lucide-react';
import { BrowserSettings, RenderingMode, SearchEngine } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: BrowserSettings;
  onUpdateSettings: (newSettings: Partial<BrowserSettings>) => void;
  onOpenConvertModal?: () => void;
  onOpenProcessTracker?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onOpenConvertModal,
  onOpenProcessTracker,
}) => {
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

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-slate-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Browser preferences and shields"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Browser Preferences & Shields</h2>
              <p className="text-xs text-slate-400">Configure memory optimization and privacy rules</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto text-xs">
          {/* Default Search Engine */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              Default Search Engine (No-Track)
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'duckduckgo', label: 'DuckDuckGo (Lite)' },
                { id: 'brave', label: 'Brave Search' },
                { id: 'searxng', label: 'SearXNG' },
                { id: 'google-clean', label: 'Google Clean' },
              ].map((engine) => (
                <button
                  key={engine.id}
                  type="button"
                  onClick={() => onUpdateSettings({ defaultSearchEngine: engine.id as SearchEngine })}
                  className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition-all ${
                    settings.defaultSearchEngine === engine.id
                      ? 'bg-emerald-950/60 border-emerald-600 text-emerald-300 font-medium'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span>{engine.label}</span>
                  {settings.defaultSearchEngine === engine.id && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </button>
              ))}
            </div>
          </div>

          {/* Default Rendering Profile */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              Default Rendering Profile
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'shield', label: 'Shield (Auto Filter)' },
                { id: 'reader', label: 'Reader Mode' },
                { id: 'zero-js', label: 'Zero-JS (Max Security)' },
                { id: 'text-only', label: 'Text Only' },
              ].map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => onUpdateSettings({ defaultMode: mode.id as RenderingMode })}
                  className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition-all ${
                    settings.defaultMode === mode.id
                      ? 'bg-emerald-950/60 border-emerald-600 text-emerald-300 font-medium'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span>{mode.label}</span>
                  {settings.defaultMode === mode.id && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                </button>
              ))}
            </div>
          </div>

          {/* Performance & Privacy Toggles */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            <h3 className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">
              Hardware & Shield Rules
            </h3>

            {/* Low-GPU Mode */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="pr-4">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Low-GPU Throttle</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Suppresses CSS animation loops, keyframe recalculations, and GPU compositing.
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.lowGpuMode}
                onChange={(e) => onUpdateSettings({ lowGpuMode: e.target.checked })}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
            </div>

            {/* Strip UTMs */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="pr-4">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Strip URL Tracking Parameters</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Removes utm_source, fbclid, gclid, and referral tokens from all addresses.
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.stripUtmParams}
                onChange={(e) => onUpdateSettings({ stripUtmParams: e.target.checked })}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
            </div>

            {/* Block Fingerprinting */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="pr-4">
                <div className="font-semibold text-slate-200">
                  Neutralize Hardware & Canvas Fingerprinting
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Blocks fingerprintjs and script queries probing machine graphics specs.
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.blockFingerprinting}
                onChange={(e) => onUpdateSettings({ blockFingerprinting: e.target.checked })}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
            </div>

            {/* Disable Autoplay */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="pr-4">
                <div className="font-semibold text-slate-200">
                  Block Autoplay Video & Audio Telemetry
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Prevents unsolicited background video ads and audio loops from eating RAM.
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.disableAutoplay}
                onChange={(e) => onUpdateSettings({ disableAutoplay: e.target.checked })}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
            </div>

            {/* Hardware Resource & Process Tracker */}
            {onOpenProcessTracker && (
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-white flex items-center gap-1.5 text-xs">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span>Hardware Resource & Process Tracker</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Monitor live CPU threads and GPU rasterization with instant process termination.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenProcessTracker();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 font-semibold text-xs border border-slate-700 transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5"
                >
                  <span>Open Tracker</span>
                  <span className="text-[9px] font-mono opacity-60">(Shift+Esc)</span>
                </button>
              </div>
            )}

            {/* Standalone Software Suite */}
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/40 via-slate-950 to-slate-950 border border-emerald-800/60 flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-white flex items-center gap-1.5">
                  <span>Standalone Software Version</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-900 text-emerald-300">1/10th Load</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 max-w-xs">
                  Convert TCP Browser into standalone portable software for Windows, Mac, or Linux to run with zero browser overhead.
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onOpenConvertModal) onOpenConvertModal();
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-sm transition-colors whitespace-nowrap cursor-pointer"
              >
                Convert to App
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-lg transition-colors text-xs"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};
