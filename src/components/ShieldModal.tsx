import React, { useEffect } from 'react';
import { X, Shield, Cpu, HardDrive, CheckCircle, BookOpen, Zap } from 'lucide-react';
import { SecurityStats, RenderingMode } from '../types';

interface ShieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: SecurityStats;
  currentUrl: string;
  currentMode: RenderingMode;
  onSetMode: (mode: RenderingMode) => void;
}

export const ShieldModal: React.FC<ShieldModalProps> = ({
  isOpen,
  onClose,
  stats,
  currentUrl,
  currentMode,
  onSetMode,
}) => {
  // Dismiss with Escape while the modal is open.
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
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Privacy Shield and Efficiency Inspector"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-950/80 border border-emerald-800/80 flex items-center justify-center text-emerald-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Privacy Shield & Efficiency Inspector
              </h2>
              <p className="text-xs text-slate-400 font-mono truncate max-w-sm">
                {currentUrl}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Comparison Cards: Memory & GPU vs Chrome */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                <span className="font-semibold flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                  RAM Footprint
                </span>
                <span className="text-[11px] font-mono text-emerald-400 font-bold">
                  {stats.ramSavedPercent}% SAVED
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-white font-mono">
                  ~{stats.estimatedRamMb} MB
                </span>
                <span className="text-xs text-slate-500 line-through font-mono">
                  {stats.chromeRamEstimateMb} MB
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Runs in isolated lightweight DOM without Chrome’s per-site bloated V8 isolates.
              </p>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                <span className="font-semibold flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                  GPU Overhead
                </span>
                <span className="text-[11px] font-mono text-emerald-400 font-bold">
                  {stats.chromeGpuEstimatePercent > 0
                    ? `${Math.max(0, Math.round((1 - stats.estimatedGpuPercent / stats.chromeGpuEstimatePercent) * 100))}% LESS THAN CHROME`
                    : 'LOW GPU PROFILE'}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-white font-mono">
                  {stats.estimatedGpuPercent}%
                </span>
                <span className="text-xs text-slate-500 line-through font-mono">
                  {stats.chromeGpuEstimatePercent}%
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Zero GPU compositor thrashing; video telemetry and canvas loops neutralized.
              </p>
            </div>
          </div>

          {/* Privacy & Security Checklists */}
          <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
            <h3 className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">
              Active Privacy Protections
            </h3>

            <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
              <div className="flex items-center gap-2 text-slate-300">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Trackers & Ad Scripts</span>
              </div>
              <span className="font-mono text-emerald-400 font-medium">
                {stats.trackersBlocked} neutralized
              </span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
              <div className="flex items-center gap-2 text-slate-300">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Tracking Query Strings (UTM, fbclid, gclid)</span>
              </div>
              <span className="text-emerald-400 font-medium font-mono">Stripped</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
              <div className="flex items-center gap-2 text-slate-300">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Canvas / Hardware Fingerprinting</span>
              </div>
              <span className="text-emerald-400 font-medium font-mono">Isolated</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
              <div className="flex items-center gap-2 text-slate-300">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Page Payload Sanitized</span>
              </div>
              <span className="text-emerald-400 font-medium font-mono">
                {stats.originalSizeKb > 0
                  ? `${stats.originalSizeKb} KB → ${stats.cleanSizeKb} KB`
                  : '—'}
              </span>
            </div>

            <div className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2 text-slate-300">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Connection Encryption</span>
              </div>
              <span className="text-emerald-400 font-medium font-mono">
                {stats.hasHttps ? 'HTTPS' : 'HTTP'}
              </span>
            </div>
          </div>

          {/* Blocked Tracker List */}
          <div>
            <h3 className="font-bold text-slate-300 uppercase tracking-wider text-[10px] mb-2 flex items-center justify-between">
              <span>Neutralized Telemetry on this Page ({stats.trackerList.length})</span>
              <span className="font-mono text-[10px] text-slate-500">Auto-Filtered</span>
            </h3>

            {stats.trackerList.length === 0 ? (
              <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl text-center text-xs text-slate-400">
                No third-party trackers detected on this page. Pure and clean!
              </div>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 text-xs">
                {stats.trackerList.map((tracker, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                      <span className="font-medium text-slate-200 truncate">{tracker.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        {tracker.category}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500 max-w-[120px] truncate">
                        {tracker.domain}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Profile Switch */}
          <div className="pt-2 border-t border-slate-800">
            <h4 className="text-[11px] font-semibold text-slate-400 mb-2">
              Switch Low-Footprint Mode:
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'shield', label: 'Shield', icon: <Shield className="w-3.5 h-3.5" /> },
                { id: 'reader', label: 'Reader', icon: <BookOpen className="w-3.5 h-3.5" /> },
                { id: 'zero-js', label: 'Zero-JS', icon: <Zap className="w-3.5 h-3.5" /> },
                { id: 'text-only', label: 'Text-Only', icon: <HardDrive className="w-3.5 h-3.5" /> },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onSetMode(item.id as RenderingMode);
                    onClose();
                  }}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors ${
                    currentMode === item.id
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <span>Payload: {stats.cleanSizeKb} KB ({Math.round(stats.originalSizeKb - stats.cleanSizeKb)} KB bloat pruned)</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
