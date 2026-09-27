import React from 'react';
import { Shield, HardDrive, Cpu, Lock, Activity } from 'lucide-react';
import { SecurityStats, BrowserTab } from '../types';

interface PerformanceBadgeProps {
  activeTab: BrowserTab;
  onOpenShieldModal: () => void;
  onOpenProcessTracker?: () => void;
  lowGpuMode: boolean;
}

export const PerformanceBadge: React.FC<PerformanceBadgeProps> = ({
  activeTab,
  onOpenShieldModal,
  onOpenProcessTracker,
  lowGpuMode,
}) => {
  const stats = activeTab.stats;
  const isHome = activeTab.url === 'about:home';
  const isKilled = activeTab.status === 'killed';
  const isFrozen = activeTab.status === 'frozen';

  return (
    <div
      id="browser-status-bar"
      className="bg-slate-950/95 border-t border-slate-800/80 px-3 py-1 text-[11px] text-slate-400 flex items-center justify-between select-none"
    >
      <div
        onClick={onOpenShieldModal}
        className="flex items-center gap-3 overflow-hidden cursor-pointer hover:text-slate-200 transition-colors"
        title="Click to view full Privacy Shield & Protection details"
      >
        {/* Security Indicator */}
        <div className="flex items-center gap-1 text-slate-300 font-mono">
          <Lock className="w-3 h-3 text-emerald-400" />
          <span>{stats.hasHttps ? 'Secure Sandbox' : 'Local Sandbox'}</span>
        </div>

        <span className="text-slate-700 hidden sm:inline">•</span>

        {/* Trackers Status */}
        <div className="flex items-center gap-1 text-emerald-400 font-mono">
          <Shield className="w-3 h-3" />
          <span>
            {stats.trackersBlocked > 0
              ? `${stats.trackersBlocked} Trackers Blocked`
              : 'Zero Trackers Active'}
          </span>
        </div>

        <span className="text-slate-700 hidden md:inline">•</span>

        {/* Live Memory Estimate */}
        <div className="hidden md:flex items-center gap-1 text-slate-300 font-mono">
          <HardDrive className="w-3 h-3 text-emerald-400" />
          <span>
            RAM: ~{isKilled ? '0.8' : isHome ? '4' : stats.estimatedRamMb} MB
            <span className="text-emerald-400 font-semibold ml-1">
              ({isKilled ? '99%' : isHome ? '98%' : stats.ramSavedPercent}% saved vs Chrome)
            </span>
          </span>
        </div>

        <span className="text-slate-700 hidden lg:inline">•</span>

        {/* GPU Estimate */}
        <div className="hidden lg:flex items-center gap-1 text-slate-300 font-mono">
          <Cpu className="w-3 h-3 text-emerald-400" />
          <span>
            GPU: {isKilled ? '0%' : isHome ? '0%' : `${stats.estimatedGpuPercent}%`}
            {lowGpuMode && <span className="text-emerald-400/90 ml-1">(Eco-Throttled)</span>}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 text-slate-500 font-mono text-[10px]">
        {/* Task Manager / Hardware Tracker Quick Button */}
        {onOpenProcessTracker && (
          <button
            type="button"
            onClick={onOpenProcessTracker}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
            title="Open CPU/GPU Process Tracker & Task Manager (Shift+Esc)"
          >
            <Activity className="w-3 h-3 text-emerald-400" />
            <span className="font-semibold">Task Manager</span>
            <span className="text-[9px] text-slate-500 hidden sm:inline">(Shift+Esc)</span>
          </button>
        )}

        {stats.loadDurationMs > 0 && !isHome && (
          <span className="hidden sm:inline">Rendered in {stats.loadDurationMs}ms</span>
        )}
        <span className="bg-emerald-950/80 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-900/60 font-semibold">
          1/10th Footprint
        </span>
      </div>
    </div>
  );
};

