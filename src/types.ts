export type RenderingMode = 'shield' | 'direct' | 'reader' | 'zero-js' | 'text-only';

export type SearchEngine = 'duckduckgo' | 'brave' | 'searxng' | 'google-clean';

export interface TrackerItem {
  name: string;
  category: 'analytics' | 'advertising' | 'fingerprinting' | 'telemetry' | 'social';
  domain: string;
}

export interface SecurityStats {
  trackersBlocked: number;
  trackerList: TrackerItem[];
  originalSizeKb: number;
  cleanSizeKb: number;
  estimatedRamMb: number;
  chromeRamEstimateMb: number;
  ramSavedPercent: number;
  estimatedGpuPercent: number;
  chromeGpuEstimatePercent: number;
  hasHttps: boolean;
  loadDurationMs: number;
}

export interface ReaderData {
  title: string;
  byline?: string;
  excerpt?: string;
  content: string;
  textContent: string;
  length: number;
  readingTimeMinutes: number;
}

export interface BrowserTab {
  id: string;
  title: string;
  url: string;
  displayUrl: string;
  favicon: string;
  status: 'idle' | 'loading' | 'loaded' | 'error' | 'killed' | 'frozen';
  history: string[];
  historyIndex: number;
  mode: RenderingMode;
  disableImages: boolean;
  stats: SecurityStats;
  htmlContent: string;
  readerData?: ReaderData | null;
  errorMessage?: string;
  domNodeCount?: number;
  cpuUsage?: number;
  gpuUsage?: number;
}

export interface ProcessInfo {
  id: string;
  tabId?: string;
  type: 'tab' | 'browser-core' | 'proxy-filter' | 'gpu-compositor' | 'js-engine' | 'network-io';
  name: string;
  subTitle: string;
  cpuPercent: number;
  gpuPercent: number;
  ramMb: number;
  networkKbps: number;
  status: 'running' | 'idle' | 'throttled' | 'frozen' | 'killed';
  killable: boolean;
  metrics: {
    cpuReason: string;
    gpuReason: string;
    domNodes?: number;
    activeScripts?: number;
    threadPriority: 'Low' | 'Normal' | 'Realtime';
  };
}

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  icon?: string;
  category?: string;
  createdAt: number;
}

export interface HistoryItem {
  id: string;
  title: string;
  url: string;
  timestamp: number;
  trackersBlocked: number;
  mode: RenderingMode;
}

export interface BrowserSettings {
  defaultSearchEngine: SearchEngine;
  defaultMode: RenderingMode;
  blockFingerprinting: boolean;
  stripUtmParams: boolean;
  disableAutoplay: boolean;
  lowGpuMode: boolean;
  closeTabCleansCache: boolean;
  fontSize: 'small' | 'medium' | 'large';
  readerTheme: 'light' | 'sepia' | 'dark' | 'slate';
}

export interface QuickLink {
  title: string;
  url: string;
  description: string;
  category: string;
  iconColor: string;
}
