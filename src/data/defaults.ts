import { Bookmark, BrowserSettings, QuickLink } from '../types';

export const DEFAULT_BOOKMARKS: Bookmark[] = [
  {
    id: 'bm-1',
    title: 'DuckDuckGo',
    url: 'https://html.duckduckgo.com/html/',
    icon: '🦆',
    category: 'Search',
    createdAt: Date.now() - 100000,
  },
  {
    id: 'bm-2',
    title: 'Wikipedia',
    url: 'https://en.wikipedia.org/wiki/Main_Page',
    icon: '📚',
    category: 'Knowledge',
    createdAt: Date.now() - 90000,
  },
  {
    id: 'bm-3',
    title: 'Hacker News',
    url: 'https://news.ycombinator.com',
    icon: '📰',
    category: 'Tech',
    createdAt: Date.now() - 80000,
  },
  {
    id: 'bm-4',
    title: 'NPR News',
    url: 'https://text.npr.org',
    icon: '📻',
    category: 'News',
    createdAt: Date.now() - 70000,
  },
  {
    id: 'bm-5',
    title: 'Reuters',
    url: 'https://www.reuters.com',
    icon: '🌐',
    category: 'News',
    createdAt: Date.now() - 60000,
  },
  {
    id: 'bm-6',
    title: 'GitHub',
    url: 'https://github.com',
    icon: '💻',
    category: 'Tech',
    createdAt: Date.now() - 50000,
  },
  {
    id: 'bm-7',
    title: 'Internet Archive',
    url: 'https://archive.org',
    icon: '🏛️',
    category: 'Knowledge',
    createdAt: Date.now() - 40000,
  }
];

export const QUICK_LINKS: QuickLink[] = [
  {
    title: 'DuckDuckGo Lite',
    url: 'https://html.duckduckgo.com/html/',
    description: 'Ultra-fast search without tracking or ads',
    category: 'Search',
    iconColor: 'bg-amber-100 text-amber-700'
  },
  {
    title: 'Wikipedia',
    url: 'https://en.wikipedia.org/wiki/Main_Page',
    description: 'The free encyclopedia, stripped of scripts',
    category: 'Knowledge',
    iconColor: 'bg-stone-100 text-stone-700'
  },
  {
    title: 'Hacker News',
    url: 'https://news.ycombinator.com',
    description: 'Fast tech news and discussions',
    category: 'Tech',
    iconColor: 'bg-orange-100 text-orange-700'
  },
  {
    title: 'NPR Text View',
    url: 'https://text.npr.org',
    description: 'Minimal text-only world & national reporting',
    category: 'News',
    iconColor: 'bg-blue-100 text-blue-700'
  },
  {
    title: 'BBC News',
    url: 'https://www.bbc.com/news',
    description: 'Global news with trackers and video popups eliminated',
    category: 'News',
    iconColor: 'bg-rose-100 text-rose-700'
  },
  {
    title: 'MDN Web Docs',
    url: 'https://developer.mozilla.org/en-US/',
    description: 'Comprehensive documentation for developers',
    category: 'Tech',
    iconColor: 'bg-indigo-100 text-indigo-700'
  },
  {
    title: 'Ars Technica',
    url: 'https://arstechnica.com',
    description: 'In-depth technology and science journalism',
    category: 'Tech',
    iconColor: 'bg-cyan-100 text-cyan-700'
  },
  {
    title: 'OpenStreetMap',
    url: 'https://www.openstreetmap.org',
    description: 'Open, community-driven global mapping',
    category: 'Knowledge',
    iconColor: 'bg-emerald-100 text-emerald-700'
  }
];

export const DEFAULT_SETTINGS: BrowserSettings = {
  defaultSearchEngine: 'duckduckgo',
  defaultMode: 'shield',
  blockFingerprinting: true,
  stripUtmParams: true,
  disableAutoplay: true,
  lowGpuMode: true,
  closeTabCleansCache: true,
  fontSize: 'medium',
  readerTheme: 'light'
};
