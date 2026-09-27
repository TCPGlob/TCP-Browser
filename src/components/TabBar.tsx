import React from 'react';
import { Plus, X, Globe, Shield, RefreshCw } from 'lucide-react';
import { BrowserTab } from '../types';

interface TabBarProps {
  tabs: BrowserTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string, e: React.MouseEvent) => void;
  onNewTab: () => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
}) => {
  return (
    <div id="browser-tab-bar" className="flex items-center bg-slate-900 text-slate-300 px-2 pt-2 select-none overflow-x-auto no-scrollbar border-b border-slate-800">
      <div className="flex items-center gap-1 flex-1 min-w-0">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              id={`tab-${tab.id}`}
              onClick={() => onSelectTab(tab.id)}
              className={`group relative flex items-center gap-2 max-w-[220px] min-w-[120px] h-9 px-3 rounded-t-lg text-xs font-medium cursor-pointer transition-all ${
                isActive
                  ? 'bg-slate-800 text-white shadow-sm border-t-2 border-emerald-400'
                  : 'bg-slate-900/60 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              {/* Favicon or status icon */}
              <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                {tab.status === 'loading' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                ) : tab.favicon ? (
                  <img
                    src={tab.favicon}
                    alt=""
                    className="w-3.5 h-3.5 object-contain rounded-xs"
                    onError={(e) => {
                      // Fallback to globe icon
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                )}
              </div>

              {/* Title */}
              <span className="truncate flex-1">
                {tab.title || (tab.status === 'loading' ? 'Loading...' : 'New Tab')}
              </span>

              {/* Security shield indicator */}
              {tab.stats.trackersBlocked > 0 && (
                <span
                  title={`${tab.stats.trackersBlocked} trackers blocked`}
                  className="flex-shrink-0 text-[10px] px-1 py-0.5 bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 rounded font-mono"
                >
                  {tab.stats.trackersBlocked}
                </span>
              )}

              {/* Close Tab Button */}
              <button
                id={`btn-close-tab-${tab.id}`}
                onClick={(e) => onCloseTab(tab.id, e)}
                className="flex-shrink-0 p-0.5 rounded hover:bg-slate-700/80 text-slate-400 hover:text-white transition-colors"
                title="Close Tab (Ctrl+W)"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}

        {/* New Tab Button */}
        <button
          id="btn-new-tab"
          onClick={onNewTab}
          className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors ml-1"
          title="Open New Tab (Ctrl+T)"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Lightweight Browser Identity Pill */}
      <div className="hidden md:flex items-center gap-2 pl-3 pr-2 text-xs text-slate-400 font-mono">
        <span className="inline-flex items-center gap-1.5 text-emerald-400 text-[11px] bg-emerald-950/60 px-2.5 py-0.5 rounded border border-emerald-800/60 font-semibold">
          <Shield className="w-3 h-3 text-emerald-400" />
          <span>TCP Browser • {tabs.reduce((sum, t) => sum + (t.stats?.trackersBlocked || 0), 0)} Trackers Blocked</span>
        </span>
      </div>
    </div>
  );
};
