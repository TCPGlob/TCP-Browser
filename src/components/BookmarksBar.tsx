import React from 'react';
import { Bookmark as BookmarkType } from '../types';
import { X } from 'lucide-react';

interface BookmarksBarProps {
  bookmarks: BookmarkType[];
  onNavigate: (url: string) => void;
  onRemoveBookmark: (id: string, e: React.MouseEvent) => void;
}

export const BookmarksBar: React.FC<BookmarksBarProps> = ({
  bookmarks,
  onNavigate,
  onRemoveBookmark,
}) => {
  if (!bookmarks || bookmarks.length === 0) return null;

  return (
    <div id="browser-bookmarks-bar" className="bg-slate-900/90 text-slate-300 px-3 py-1 text-xs border-b border-slate-800 flex items-center gap-1 overflow-x-auto no-scrollbar">
      {bookmarks.map((bm) => (
        <div
          key={bm.id}
          id={`bookmark-${bm.id}`}
          onClick={() => onNavigate(bm.url)}
          className="group flex items-center gap-1.5 px-2 py-1 rounded hover:bg-slate-800 hover:text-white cursor-pointer transition-colors flex-shrink-0 max-w-[160px]"
          title={bm.url}
        >
          <span className="text-xs">{bm.icon || '🔗'}</span>
          <span className="truncate text-[11px] font-medium">{bm.title}</span>
          <button
            onClick={(e) => onRemoveBookmark(bm.id, e)}
            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-all ml-0.5"
            title="Remove bookmark"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
