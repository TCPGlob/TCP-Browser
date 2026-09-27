import React, { useEffect, useState } from 'react';
import { X, Clock, Star, Trash2, Search, Shield } from 'lucide-react';
import { Bookmark, HistoryItem } from '../types';

interface BookmarksHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab: 'bookmarks' | 'history';
  bookmarks: Bookmark[];
  history: HistoryItem[];
  onNavigate: (url: string) => void;
  onRemoveBookmark: (id: string) => void;
  onClearHistory: () => void;
  onRemoveHistoryItem: (id: string) => void;
}

export const BookmarksHistoryDrawer: React.FC<BookmarksHistoryDrawerProps> = ({
  isOpen,
  onClose,
  initialTab,
  bookmarks,
  history,
  onNavigate,
  onRemoveBookmark,
  onClearHistory,
  onRemoveHistoryItem,
}) => {
  const [activeTab, setActiveTab] = useState<'bookmarks' | 'history'>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');

  // The drawer stays mounted while closed, so `useState(initialTab)` alone would
  // keep showing whichever tab was opened first. Resync on every open.
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setSearchQuery('');
    }
  }, [isOpen, initialTab]);

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

  const filteredBookmarks = bookmarks.filter(
    (b) =>
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredHistory = history.filter(
    (h) =>
      h.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-slate-900 border-l border-slate-700 w-full max-w-md h-full flex flex-col shadow-2xl text-slate-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Bookmarks and history"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'history'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>History ({history.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('bookmarks')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'bookmarks'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Star className="w-3.5 h-3.5" />
              <span>Bookmarks ({bookmarks.length})</span>
            </button>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5">
            <Search className="w-3.5 h-3.5 text-slate-500 mr-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Filter ${activeTab}...`}
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
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {activeTab === 'history' ? (
            filteredHistory.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                {searchQuery ? 'No matching history found.' : 'No browsing history yet.'}
              </div>
            ) : (
              filteredHistory.map((item) => (
                <div
                  key={item.id}
                  className="group flex items-start justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-all text-xs"
                >
                  <div
                    onClick={() => {
                      onNavigate(item.url);
                      onClose();
                    }}
                    className="flex-1 cursor-pointer min-w-0 mr-2"
                  >
                    <div className="font-medium text-slate-200 truncate group-hover:text-emerald-400 transition-colors">
                      {item.title || item.url}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono truncate mt-0.5">
                      {item.url}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                      <span>{formatTimestamp(item.timestamp)}</span>
                      {item.trackersBlocked > 0 && (
                        <span className="flex items-center gap-0.5 text-emerald-400 font-mono">
                          <Shield className="w-2.5 h-2.5" />
                          {item.trackersBlocked} blocked
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveHistoryItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-rose-400 transition-all rounded hover:bg-slate-800"
                    title="Delete item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )
          ) : (
            filteredBookmarks.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                {searchQuery ? 'No matching bookmarks found.' : 'No bookmarks saved yet.'}
              </div>
            ) : (
              filteredBookmarks.map((bm) => (
                <div
                  key={bm.id}
                  className="group flex items-start justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-all text-xs"
                >
                  <div
                    onClick={() => {
                      onNavigate(bm.url);
                      onClose();
                    }}
                    className="flex-1 cursor-pointer min-w-0 mr-2"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{bm.icon || '🔗'}</span>
                      <span className="font-medium text-slate-200 truncate group-hover:text-emerald-400 transition-colors">
                        {bm.title}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono truncate mt-0.5">
                      {bm.url}
                    </div>
                  </div>
                  <button
                    onClick={() => onRemoveBookmark(bm.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-rose-400 transition-all rounded hover:bg-slate-800"
                    title="Remove bookmark"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )
          )}
        </div>

        {/* Footer */}
        {activeTab === 'history' && history.length > 0 && (
          <div className="p-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
            <span className="text-[11px] text-slate-500">Stored locally in browser</span>
            <button
              onClick={onClearHistory}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition-colors border border-rose-900/40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
