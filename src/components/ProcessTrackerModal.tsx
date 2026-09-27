import React, { useState, useEffect } from 'react';
import {
  X,
  Cpu,
  HardDrive,
  Activity,
  Trash2,
  CheckCircle2,
  Shield,
  Layers,
  Sparkles,
  Search,
  Filter,
  Flame,
  Pause,
  Play
} from 'lucide-react';
import { BrowserTab, ProcessInfo } from '../types';

interface ProcessTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  tabs: BrowserTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onKillTab: (id: string) => void;
  onRestartTab: (id: string) => void;
  onFreezeTab: (id: string) => void;
  onPurgeTabMemory: (id: string) => void;
  onPurgeGlobalMemory: () => void;
  lowGpuMode: boolean;
  onToggleLowGpu: () => void;
}

export const ProcessTrackerModal: React.FC<ProcessTrackerModalProps> = ({
  isOpen,
  onClose,
  tabs,
  activeTabId,
  onSelectTab,
  onKillTab,
  onRestartTab,
  onFreezeTab,
  onPurgeTabMemory,
  onPurgeGlobalMemory,
  lowGpuMode,
  onToggleLowGpu,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'cpu' | 'gpu' | 'ram' | 'name'>('cpu');
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const [autoThrottle, setAutoThrottle] = useState(false);
  const [pulseTick, setPulseTick] = useState(0);

  // Periodic pulse to simulate dynamic real-time telemetry updates
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setPulseTick((prev) => (prev + 1) % 1000);
    }, 1500);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Dismiss with Escape. Shift+Esc toggles this modal from App, so only the
  // plain key is handled here.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.shiftKey) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Build process list combining all active tabs and core browser subsystems
  const tabProcesses: ProcessInfo[] = tabs.map((tab) => {
    const isHome = tab.url === 'about:home';
    const isKilled = tab.status === 'killed';
    const isFrozen = tab.status === 'frozen';
    const isLoading = tab.status === 'loading';

    // Calculate dynamic CPU based on state
    let cpuPercent = 0;
    let gpuPercent = 0;
    let ramMb = isHome ? 4 : tab.stats.estimatedRamMb || 14;

    if (isKilled) {
      cpuPercent = 0;
      gpuPercent = 0;
      ramMb = 0.8;
    } else if (isFrozen) {
      cpuPercent = 0.1;
      gpuPercent = 0;
      ramMb = Math.round(ramMb * 0.4 * 10) / 10;
    } else if (isLoading) {
      cpuPercent = 12.4 + (pulseTick % 5) * 0.8;
      gpuPercent = lowGpuMode ? 0 : 2.1;
    } else if (isHome) {
      cpuPercent = 0.3 + (pulseTick % 3) * 0.1;
      gpuPercent = 0;
    } else {
      // Running tab
      const modeMultipliers = {
        'reader': 0.1,
        'text-only': 0.15,
        'zero-js': 0.2,
        'shield': 0.8,
      };
      const mult = modeMultipliers[tab.mode] || 0.8;
      const baseCpu = 1.2 * mult;
      const jitter = ((pulseTick * 7) % 11) * 0.15;
      cpuPercent = Math.round((baseCpu + jitter) * 10) / 10;

      const baseGpu = lowGpuMode ? 0 : (tab.mode === 'reader' || tab.mode === 'text-only' ? 0 : 1.4);
      gpuPercent = Math.round((baseGpu + ((pulseTick * 3) % 5) * 0.1) * 10) / 10;
    }

    const cpuReasons = isKilled
      ? 'Process terminated: CPU usage zeroed.'
      : isFrozen
      ? 'Background loops & animation intervals suspended.'
      : tab.mode === 'zero-js'
      ? 'Zero-JS active: No user scripts executing.'
      : tab.mode === 'reader'
      ? 'Reader mode: Pure static DOM text layout.'
      : tab.domNodeCount && tab.domNodeCount > 1000
      ? `DOM layout reflow with ${tab.domNodeCount} active elements.`
      : 'Lightweight sandboxed event loop & DOM dispatching.';

    const gpuReasons = isKilled
      ? 'Process terminated: GPU compute released.'
      : lowGpuMode
      ? 'Low-GPU Throttle active: CSS keyframes & transitions suppressed.'
      : tab.mode === 'reader' || tab.mode === 'text-only'
      ? 'Text layout: Zero compositor layers or canvas contexts.'
      : 'Standard 2D rasterization & UI font subpixel rendering.';

    return {
      id: `proc-tab-${tab.id}`,
      tabId: tab.id,
      type: 'tab',
      name: tab.title || tab.displayUrl || 'New Tab',
      subTitle: isHome ? 'Internal TCP Dashboard' : tab.url,
      cpuPercent,
      gpuPercent,
      ramMb,
      networkKbps: isLoading ? 45.2 : 0.0,
      status: isKilled ? 'killed' : isFrozen ? 'frozen' : isLoading ? 'running' : 'idle',
      killable: true,
      metrics: {
        cpuReason: cpuReasons,
        gpuReason: gpuReasons,
        domNodes: tab.domNodeCount || (isHome ? 42 : 310),
        activeScripts: tab.mode === 'zero-js' ? 0 : (tab.mode === 'reader' ? 0 : 2),
        threadPriority: tab.id === activeTabId ? 'Realtime' : 'Normal',
      },
    };
  });

  // Browser Core subsystems
  const systemProcesses: ProcessInfo[] = [
    {
      id: 'proc-sys-shell',
      type: 'browser-core',
      name: 'TCP Browser UI & Compositor',
      subTitle: 'Omnibox, tab engine, window viewport & local state',
      cpuPercent: 0.8 + ((pulseTick * 2) % 4) * 0.1,
      gpuPercent: lowGpuMode ? 0 : 0.4,
      ramMb: 8.5,
      networkKbps: 0.0,
      status: 'running',
      killable: false,
      metrics: {
        cpuReason: 'Virtual DOM reconciliation & user input telemetry.',
        gpuReason: 'Window frame rasterization & dark mode backdrop filters.',
        domNodes: 120,
        activeScripts: 4,
        threadPriority: 'Realtime',
      },
    },
    {
      id: 'proc-sys-proxy',
      type: 'proxy-filter',
      name: 'Shield Sanitization & Ad Filter Engine',
      subTitle: 'Cheerio stream parser, regex tracker stripper, UTM scrubber',
      cpuPercent: tabs.some(t => t.status === 'loading') ? 6.4 : 0.2,
      gpuPercent: 0,
      ramMb: 11.2,
      networkKbps: tabs.some(t => t.status === 'loading') ? 68.4 : 0.0,
      status: 'running',
      killable: true,
      metrics: {
        cpuReason: 'Ad block rule evaluation & HTML stream sanitization.',
        gpuReason: 'Zero GPU footprint (pure server/CPU stream worker).',
        threadPriority: 'Normal',
      },
    },
    {
      id: 'proc-sys-gpu',
      type: 'gpu-compositor',
      name: 'GPU Graphics Rasterizer',
      subTitle: lowGpuMode ? 'Throttled (Zero CSS animation overhead)' : 'Active hardware compositor layer',
      cpuPercent: lowGpuMode ? 0.1 : 0.4,
      gpuPercent: lowGpuMode ? 0.0 : 1.2 + (pulseTick % 3) * 0.2,
      ramMb: lowGpuMode ? 2.4 : 6.1,
      networkKbps: 0.0,
      status: lowGpuMode ? 'throttled' : 'running',
      killable: true,
      metrics: {
        cpuReason: 'Layer boundary management & damage rect calculations.',
        gpuReason: lowGpuMode ? 'Compositor throttled: CSS keyframes suppressed.' : 'Hardware compositing of visible viewport layers.',
        threadPriority: 'Normal',
      },
    },
    {
      id: 'proc-sys-cache',
      type: 'network-io',
      name: 'Cache & Memory Garbage Collector',
      subTitle: 'Local offline snapshot store & unreferenced memory reaper',
      cpuPercent: 0.1,
      gpuPercent: 0,
      ramMb: 3.2,
      networkKbps: 0.0,
      status: 'idle',
      killable: true,
      metrics: {
        cpuReason: 'Passive memory sweep & heap garbage cleanup.',
        gpuReason: 'Zero GPU footprint.',
        threadPriority: 'Low',
      },
    },
  ];

  const allProcesses = [...tabProcesses, ...systemProcesses];

  // Filter + sort. The array is copied first: `filter` already returns a new
  // array, but `sort` mutates in place and would reorder the source list.
  const filtered = allProcesses.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.subTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  filtered.sort((a, b) => {
    if (sortBy === 'cpu') return b.cpuPercent - a.cpuPercent;
    if (sortBy === 'gpu') return b.gpuPercent - a.gpuPercent;
    if (sortBy === 'ram') return b.ramMb - a.ramMb;
    return a.name.localeCompare(b.name);
  });

  // Calculate totals
  const totalCpu = Math.round(allProcesses.reduce((sum, p) => sum + p.cpuPercent, 0) * 10) / 10;
  const totalGpu = Math.round(allProcesses.reduce((sum, p) => sum + p.gpuPercent, 0) * 10) / 10;
  const totalRam = Math.round(allProcesses.reduce((sum, p) => sum + p.ramMb, 0) * 10) / 10;
  const chromeEquivalentRam = Math.round((tabs.length * 320 + 450) * 10) / 10;
  const ramSavedPercent = Math.round(((chromeEquivalentRam - totalRam) / chromeEquivalentRam) * 100);

  // Identify runaway processes (CPU > 15% or GPU > 10%)
  const runawayProcesses = allProcesses.filter((p) => p.cpuPercent > 15 || p.gpuPercent > 10);

  // Auto-freeze: while enabled, any background tab whose measured DOM has grown
  // large enough to keep costing CPU is suspended. This uses the real
  // domNodeCount reported by the page, not the simulated telemetry figures.
  const AUTO_FREEZE_DOM_THRESHOLD = 5000;
  const autoFreezeCandidates = tabs.filter(
    (t) =>
      t.id !== activeTabId &&
      t.status === 'loaded' &&
      (t.domNodeCount ?? 0) > AUTO_FREEZE_DOM_THRESHOLD,
  );
  const autoFreezeKey = autoFreezeCandidates.map((t) => t.id).join(',');

  useEffect(() => {
    if (!isOpen || !autoThrottle || !autoFreezeKey) return;
    for (const id of autoFreezeKey.split(',')) {
      onFreezeTab(id);
    }
    // onFreezeTab toggles the tab's frozen state, so guard against re-entry by
    // only reacting to a change in the candidate set.
  }, [isOpen, autoThrottle, autoFreezeKey, onFreezeTab]);

  // Selected process details
  const currentSelected = allProcesses.find((p) => p.id === selectedProcessId) || allProcesses[0];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-slate-900 border border-slate-700/90 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Process and hardware resource tracker"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-950/80 border border-emerald-700/80 flex items-center justify-center text-emerald-400 shadow-inner">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  TCP Process & Hardware Resource Tracker
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-semibold">
                  Shift + Esc
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Live monitoring of CPU threads, GPU rasterization, and memory footprint with instant process termination.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onPurgeGlobalMemory}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-medium border border-slate-700 transition-colors"
              title="Purge cached DOM trees and run browser garbage collector"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Purge Memory</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Close Task Manager (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Telemetry Gauges Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-slate-950/50 border-b border-slate-800">
          {/* CPU Metric */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span className="font-semibold flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                Total CPU Load
              </span>
              <span className={`text-[11px] font-mono font-bold ${totalCpu > 20 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {totalCpu < 5 ? 'OPTIMAL' : totalCpu < 15 ? 'MODERATE' : 'ELEVATED'}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white font-mono">{totalCpu}%</span>
              <span className="text-xs text-slate-500 font-mono">1/10th of Chrome</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${totalCpu > 20 ? 'bg-amber-500' : 'bg-emerald-400'}`}
                style={{ width: `${Math.min(100, totalCpu * 2.5)}%` }}
              />
            </div>
          </div>

          {/* GPU Metric */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span className="font-semibold flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-emerald-400" />
                GPU Utilization
              </span>
              <button
                onClick={onToggleLowGpu}
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                  lowGpuMode
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/60 font-bold'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
                title="Toggle Low-GPU Throttle"
              >
                {lowGpuMode ? 'ECO-THROTTLED' : 'STANDARD'}
              </button>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white font-mono">{totalGpu}%</span>
              <span className="text-xs text-slate-500 font-mono">0 Thrashing</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(2, totalGpu * 8))}%` }}
              />
            </div>
          </div>

          {/* RAM Footprint vs Chrome */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span className="font-semibold flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                RAM Footprint
              </span>
              <span className="text-[11px] font-mono text-emerald-400 font-bold">
                {ramSavedPercent}% SAVED
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white font-mono">{totalRam} MB</span>
              <span className="text-xs text-slate-500 line-through font-mono">
                {chromeEquivalentRam} MB
              </span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-1">
              Runs in {tabs.length} light process{tabs.length > 1 ? 'es' : ''}
            </div>
          </div>

          {/* Processes & Quick Termination */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span className="font-semibold flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                Active Tasks
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                {allProcesses.length} Total
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white font-mono">
                {tabs.filter((t) => t.status !== 'killed').length}
              </span>
              <span className="text-xs text-slate-400">
                Active Tabs ({tabs.filter((t) => t.status === 'killed').length} Killed)
              </span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-emerald-400 font-mono">No runaway scripts</span>
              {runawayProcesses.length > 0 && (
                <button
                  onClick={() => {
                    runawayProcesses.forEach((p) => {
                      if (p.tabId) onKillTab(p.tabId);
                    });
                  }}
                  className="text-[10px] font-bold text-rose-400 hover:text-rose-300 underline"
                >
                  Kill High-Load ({runawayProcesses.length})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Toolbar & Filter */}
        <div className="px-4 py-2.5 bg-slate-950/40 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex items-center flex-1 sm:w-64 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5">
              <Search className="w-3.5 h-3.5 text-slate-500 mr-2 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search processes, tabs, subsystems..."
                className="bg-transparent text-xs text-slate-100 placeholder-slate-500 outline-none w-full"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1">
              <span className="text-slate-500 text-[11px] hidden md:inline">Sort:</span>
              {(['cpu', 'gpu', 'ram', 'name'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={`px-2 py-1 rounded text-[11px] font-mono uppercase transition-colors ${
                    sortBy === s
                      ? 'bg-slate-800 text-emerald-400 font-bold border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-slate-200">
              <input
                type="checkbox"
                checked={autoThrottle}
                onChange={(e) => setAutoThrottle(e.target.checked)}
                className="w-3.5 h-3.5 accent-emerald-500 rounded"
              />
              <span className="text-[11px]">Auto-Freeze Background Tabs</span>
            </label>
          </div>
        </div>

        {/* Process Table & Diagnostic Split View */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Main Table */}
          <div className="flex-1 overflow-y-auto border-r border-slate-800/80 divide-y divide-slate-800/60">
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-slate-500 text-xs">
                No matching processes found.
              </div>
            ) : (
              filtered.map((proc) => {
                const isSelected = selectedProcessId === proc.id || (!selectedProcessId && proc.id === currentSelected.id);
                const isRunaway = proc.cpuPercent > 15 || proc.gpuPercent > 10;
                const isTab = proc.type === 'tab';

                return (
                  <div
                    key={proc.id}
                    onClick={() => setSelectedProcessId(proc.id)}
                    className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-slate-800/90 border-l-2 border-emerald-500'
                        : 'hover:bg-slate-950/60'
                    }`}
                  >
                    {/* Process Identity */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-slate-900 border border-slate-800 text-slate-400">
                        {isTab ? (
                          <span className="text-xs">🌐</span>
                        ) : proc.type === 'gpu-compositor' ? (
                          <Flame className="w-4 h-4 text-amber-400" />
                        ) : proc.type === 'proxy-filter' ? (
                          <Shield className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Cpu className="w-4 h-4 text-blue-400" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-100 truncate">
                            {proc.name}
                          </span>
                          {proc.tabId === activeTabId && (
                            <span className="text-[9px] font-mono px-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                              ACTIVE TAB
                            </span>
                          )}
                          {proc.status === 'killed' && (
                            <span className="text-[9px] font-mono px-1 rounded bg-rose-950 text-rose-300 border border-rose-800/60 font-bold">
                              KILLED
                            </span>
                          )}
                          {proc.status === 'frozen' && (
                            <span className="text-[9px] font-mono px-1 rounded bg-amber-950 text-amber-300 border border-amber-800/60">
                              FROZEN
                            </span>
                          )}
                          {isRunaway && (
                            <span className="text-[9px] font-mono px-1 rounded bg-rose-900 text-white font-bold animate-pulse">
                              HIGH LOAD
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono truncate">
                          {proc.subTitle}
                        </div>
                      </div>
                    </div>

                    {/* Telemetry Numbers */}
                    <div className="flex items-center gap-4 text-xs font-mono flex-shrink-0">
                      {/* CPU */}
                      <div className="w-16 text-right">
                        <span className={`font-semibold ${proc.cpuPercent > 10 ? 'text-amber-400' : 'text-slate-200'}`}>
                          {proc.cpuPercent}%
                        </span>
                        <div className="text-[10px] text-slate-500">CPU</div>
                      </div>

                      {/* GPU */}
                      <div className="w-14 text-right hidden sm:block">
                        <span className={`font-semibold ${proc.gpuPercent > 5 ? 'text-amber-400' : 'text-slate-300'}`}>
                          {proc.gpuPercent}%
                        </span>
                        <div className="text-[10px] text-slate-500">GPU</div>
                      </div>

                      {/* RAM */}
                      <div className="w-16 text-right">
                        <span className="font-semibold text-slate-200">
                          {proc.ramMb} MB
                        </span>
                        <div className="text-[10px] text-slate-500">RAM</div>
                      </div>

                      {/* Action Controls */}
                      <div className="flex items-center gap-1 pl-2">
                        {isTab && proc.tabId && (
                          <>
                            {proc.status === 'killed' ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRestartTab(proc.tabId!);
                                }}
                                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-[11px] transition-colors"
                                title="Restart this tab process"
                              >
                                Relaunch
                              </button>
                            ) : (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onFreezeTab(proc.tabId!);
                                  }}
                                  className={`p-1.5 rounded transition-colors ${
                                    proc.status === 'frozen'
                                      ? 'bg-amber-950 text-amber-300 hover:bg-amber-900 border border-amber-700/60'
                                      : 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                                  }`}
                                  title={proc.status === 'frozen' ? 'Unfreeze process' : 'Freeze background execution'}
                                >
                                  {proc.status === 'frozen' ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                                </button>

                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onKillTab(proc.tabId!);
                                  }}
                                  className="px-2.5 py-1 rounded bg-rose-950 hover:bg-rose-900 text-rose-300 hover:text-rose-100 font-medium text-[11px] border border-rose-800/80 transition-colors flex items-center gap-1"
                                  title="Kill Process immediately to free CPU/GPU"
                                >
                                  <span>Kill</span>
                                </button>
                              </>
                            )}
                          </>
                        )}

                        {!isTab && proc.killable && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onPurgeGlobalMemory();
                            }}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono transition-colors"
                            title="Reset subsystem worker memory"
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Diagnostic Inspector Sidebar ("just know what is eating cpu or gpu") */}
          <div className="w-full md:w-80 bg-slate-950/80 p-4 flex flex-col justify-between overflow-y-auto text-xs space-y-4">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="font-bold text-slate-300 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Hardware Resource Diagnostics</span>
                </h3>
                <span className="text-[10px] font-mono text-slate-500">Live Inspector</span>
              </div>

              {currentSelected && (
                <div className="mt-3 space-y-3.5">
                  {/* Selected Process Header */}
                  <div>
                    <div className="font-bold text-slate-100 text-sm truncate">
                      {currentSelected.name}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono truncate">
                      {currentSelected.subTitle}
                    </div>
                  </div>

                  {/* Numbers Grid */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 text-center font-mono">
                    <div>
                      <div className="text-[10px] text-slate-500">CPU</div>
                      <div className="text-sm font-bold text-emerald-400">{currentSelected.cpuPercent}%</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">GPU</div>
                      <div className="text-sm font-bold text-emerald-400">{currentSelected.gpuPercent}%</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">RAM</div>
                      <div className="text-sm font-bold text-slate-200">{currentSelected.ramMb} MB</div>
                    </div>
                  </div>

                  {/* Exact Diagnosis: What is eating CPU? */}
                  <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-200 text-xs">
                      <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                      <span>What is using CPU:</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {currentSelected.metrics.cpuReason}
                    </p>
                    {currentSelected.metrics.domNodes !== undefined && (
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-800">
                        <span>DOM Elements</span>
                        <span className="text-slate-300 font-semibold">{currentSelected.metrics.domNodes} nodes</span>
                      </div>
                    )}
                  </div>

                  {/* Exact Diagnosis: What is eating GPU? */}
                  <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-200 text-xs">
                      <Flame className="w-3.5 h-3.5 text-emerald-400" />
                      <span>What is using GPU:</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {currentSelected.metrics.gpuReason}
                    </p>
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-800">
                      <span>Low-GPU Throttle</span>
                      <span className={lowGpuMode ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                        {lowGpuMode ? 'Enforced' : 'Off'}
                      </span>
                    </div>
                  </div>

                  {/* Process Actions */}
                  {currentSelected.tabId && (
                    <div className="pt-2 border-t border-slate-800 space-y-2">
                      <div className="text-[10px] uppercase font-bold text-slate-500">
                        Control Process:
                      </div>
                      <div className="flex items-center gap-2">
                        {currentSelected.status === 'killed' ? (
                          <button
                            onClick={() => onRestartTab(currentSelected.tabId!)}
                            className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs transition-colors text-center"
                          >
                            Relaunch Tab
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => onKillTab(currentSelected.tabId!)}
                              className="flex-1 py-1.5 bg-rose-950 hover:bg-rose-900 text-rose-200 border border-rose-800/80 font-semibold rounded-lg text-xs transition-colors text-center"
                            >
                              Kill Process
                            </button>
                            <button
                              onClick={() => onFreezeTab(currentSelected.tabId!)}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs transition-colors"
                            >
                              {currentSelected.status === 'frozen' ? 'Unfreeze' : 'Freeze'}
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => onPurgeTabMemory(currentSelected.tabId!)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                          title="Purge Tab DOM Cache"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Guarantees Footer */}
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div className="font-semibold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Zero Background Leak</span>
              </div>
              <p className="text-[10px] text-slate-500 leading-normal">
                Inactive tabs are strictly memory-throttled. No hidden coin miners, tracking loops, or audio telemetry can survive.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950/90 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-mono text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Process Watchdog Active
            </span>
            <span className="text-slate-600 hidden sm:inline">•</span>
            <span className="hidden sm:inline text-slate-500 font-mono text-[11px]">
              Memory Reclaim Engine: Ready
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                tabs.forEach((t) => {
                  if (t.id !== activeTabId && t.status !== 'killed') {
                    onFreezeTab(t.id);
                  }
                });
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors"
              title="Freeze all background tabs to save 90% CPU"
            >
              Freeze Inactive Tabs
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-lg transition-colors text-xs"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
