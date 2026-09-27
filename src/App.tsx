/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TabBar } from './components/TabBar';
import { Omnibox } from './components/Omnibox';
import { BookmarksBar } from './components/BookmarksBar';
import { BrowserViewport } from './components/BrowserViewport';
import { ShieldModal } from './components/ShieldModal';
import { BookmarksHistoryDrawer } from './components/BookmarksHistoryDrawer';
import { SettingsModal } from './components/SettingsModal';
import { ConvertSoftwareModal } from './components/ConvertSoftwareModal';
import { PerformanceBadge } from './components/PerformanceBadge';
import { ProcessTrackerModal } from './components/ProcessTrackerModal';
import { BrowserTab, Bookmark, HistoryItem, BrowserSettings, RenderingMode, SearchEngine } from './types';
import { DEFAULT_BOOKMARKS, DEFAULT_SETTINGS } from './data/defaults';

export default function App() {
  // Local storage keys
  const STORAGE_BOOKMARKS = 'tcp_browser_bookmarks_v1';
  const STORAGE_HISTORY = 'tcp_browser_history_v1';
  const STORAGE_SETTINGS = 'tcp_browser_settings_v1';

  // Load persistent settings
  const [settings, setSettings] = useState<BrowserSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SETTINGS) || localStorage.getItem('barebones_settings_v1');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Load bookmarks
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_BOOKMARKS) || localStorage.getItem('barebones_bookmarks_v1');
      return saved ? JSON.parse(saved) : DEFAULT_BOOKMARKS;
    } catch {
      return DEFAULT_BOOKMARKS;
    }
  });

  // Load history
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_HISTORY) || localStorage.getItem('barebones_history_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Create initial home tab
  const createInitialTab = (id = 'tab-1'): BrowserTab => ({
    id,
    title: 'New Tab',
    url: 'about:home',
    displayUrl: '',
    favicon: '',
    status: 'idle',
    history: ['about:home'],
    historyIndex: 0,
    mode: settings.defaultMode,
    disableImages: false,
    stats: {
      trackersBlocked: 0,
      trackerList: [],
      originalSizeKb: 0,
      cleanSizeKb: 0,
      estimatedRamMb: 4,
      chromeRamEstimateMb: 320,
      ramSavedPercent: 98,
      estimatedGpuPercent: 0,
      chromeGpuEstimatePercent: 18,
      hasHttps: true,
      loadDurationMs: 0,
    },
    htmlContent: '',
    readerData: null,
  });

  const [tabs, setTabs] = useState<BrowserTab[]>([createInitialTab()]);
  const [activeTabId, setActiveTabId] = useState<string>('tab-1');

  // Modals & Drawers state
  const [isShieldModalOpen, setIsShieldModalOpen] = useState(false);
  const [drawerState, setDrawerState] = useState<{ isOpen: boolean; tab: 'bookmarks' | 'history' }>({
    isOpen: false,
    tab: 'history',
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [isProcessTrackerOpen, setIsProcessTrackerOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Cumulative Session Metrics
  const [totalTrackersBlocked, setTotalTrackersBlocked] = useState(0);
  const [totalRamSavedMb, setTotalRamSavedMb] = useState(0);

  // Abort handles for in-flight navigations, keyed by tab id, so that Stop and
  // a rapid second navigation actually cancel the previous request.
  const abortControllers = useRef<Map<string, AbortController>>(new Map());

  // Catch PWA beforeinstallprompt and URL parameters
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if query params ask to convert or download
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('action') === 'convert' || params.get('download') === '1' || params.get('convert') === '1') {
        setIsConvertModalOpen(true);
      }
    } catch {
      // ignore
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Active tab helper
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  // Save to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.warn('LocalStorage error', e);
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_BOOKMARKS, JSON.stringify(bookmarks));
    } catch (e) {
      console.warn('LocalStorage error', e);
    }
  }, [bookmarks]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_HISTORY, JSON.stringify(history.slice(0, 200)));
    } catch (e) {
      console.warn('LocalStorage error', e);
    }
  }, [history]);

  // Navigate function for a tab.
  // `modeOverride` exists because mode changes are applied through setTabs and
  // would otherwise be read back from a stale `tabs` closure, causing the fetch
  // to use the previous rendering mode.
  const handleNavigate = useCallback(async (
    rawTarget: string,
    tabIdToUse?: string,
    postData?: Record<string, string>,
    modeOverride?: RenderingMode,
  ) => {
    const tabId = tabIdToUse || activeTabId;
    const target = rawTarget.trim();

    // Check if target is home
    if (target === 'about:home' || target === 'about:blank' || !target) {
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== tabId) return t;
          const newHist = [...t.history.slice(0, t.historyIndex + 1), 'about:home'];
          return {
            ...t,
            url: 'about:home',
            displayUrl: '',
            title: 'New Tab',
            favicon: '',
            status: 'idle',
            history: newHist,
            historyIndex: newHist.length - 1,
            htmlContent: '',
            readerData: null,
            stats: {
              ...t.stats,
              trackersBlocked: 0,
              trackerList: [],
              estimatedRamMb: 4,
              ramSavedPercent: 98,
              estimatedGpuPercent: 0,
            }
          };
        })
      );
      return;
    }

    // Set tab to loading state
    setTabs((prev) =>
      prev.map((t) =>
        t.id === tabId
          ? { ...t, status: 'loading', url: target, errorMessage: undefined }
          : t
      )
    );

    // Cancel any request still in flight for this tab before starting another.
    abortControllers.current.get(tabId)?.abort();
    const controller = new AbortController();
    abortControllers.current.set(tabId, controller);

    try {
      const currentTab = tabs.find((t) => t.id === tabId);
      const activeMode = modeOverride || currentTab?.mode || settings.defaultMode;

      // Never show a stale render of the previous document while switching.
      if (modeOverride && modeOverride !== currentTab?.mode) {
        setTabs((prev) =>
          prev.map((t) => (t.id === tabId ? { ...t, mode: modeOverride, htmlContent: '', readerData: null } : t))
        );
      }

      // In Direct Mode: load target directly inside the frame
      if (activeMode === 'direct') {
        let directUrl = target;
        if (!/^https?:\/\//i.test(directUrl)) {
          directUrl = `https://${directUrl}`;
        }
        let directHost = '';
        try {
          directHost = new URL(directUrl).hostname;
        } catch {
          directHost = directUrl;
        }

        setTabs((prev) =>
          prev.map((t) => {
            if (t.id !== tabId) return t;
            const isSameUrl = t.history[t.historyIndex] === directUrl;
            const newHistory = isSameUrl
              ? t.history
              : [...t.history.slice(0, t.historyIndex + 1), directUrl];
            const newIndex = isSameUrl ? t.historyIndex : newHistory.length - 1;

            return {
              ...t,
              title: directHost,
              url: directUrl,
              displayUrl: directHost,
              favicon: `https://www.google.com/s2/favicons?domain=${directHost}&sz=32`,
              status: 'loaded',
              history: newHistory,
              historyIndex: newIndex,
              htmlContent: '',
              readerData: null,
            };
          })
        );
        return;
      }

      let res: globalThis.Response;
      const privacyParams = {
        disableImages: currentTab?.disableImages || false,
        searchEngine: settings.defaultSearchEngine,
        lowGpu: settings.lowGpuMode,
        stripUtmParams: settings.stripUtmParams,
        blockFingerprinting: settings.blockFingerprinting,
        disableAutoplay: settings.disableAutoplay,
      };

      if (postData) {
        res = await fetch('/api/browse', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            url: target,
            mode: activeMode,
            ...privacyParams,
            postData,
          })
        });
      } else {
        const queryParams = new URLSearchParams({
          url: target,
          mode: activeMode,
          format: 'json',
          disableImages: String(privacyParams.disableImages),
          searchEngine: privacyParams.searchEngine,
          lowGpu: String(privacyParams.lowGpu),
          stripUtmParams: String(privacyParams.stripUtmParams),
          blockFingerprinting: String(privacyParams.blockFingerprinting),
          disableAutoplay: String(privacyParams.disableAutoplay),
        });

        res = await fetch(`/api/browse?${queryParams.toString()}`, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
          },
        });
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with status ${res.status}`);
      }

      const data = await res.json();

      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== tabId) return t;
          const isSameUrl = t.history[t.historyIndex] === data.targetUrl;
          const newHistory = isSameUrl
            ? t.history
            : [...t.history.slice(0, t.historyIndex + 1), data.targetUrl];
          const newIndex = isSameUrl ? t.historyIndex : newHistory.length - 1;

          return {
            ...t,
            title: data.title || data.displayUrl,
            url: data.targetUrl,
            displayUrl: data.displayUrl,
            favicon: data.favicon,
            status: 'loaded',
            history: newHistory,
            historyIndex: newIndex,
            stats: data.stats,
            htmlContent: data.htmlContent,
            readerData: data.readerData,
          };
        })
      );

      // Add to browsing history
      const newHistoryItem: HistoryItem = {
        id: `h-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title: data.title || data.displayUrl,
        url: data.targetUrl,
        timestamp: Date.now(),
        trackersBlocked: data.stats.trackersBlocked || 0,
        mode: activeMode,
      };
      setHistory((prev) => [newHistoryItem, ...prev]);

      // Update session totals
      setTotalTrackersBlocked((prev) => prev + (data.stats.trackersBlocked || 0));
      const ramDiff = Math.max(0, (data.stats.chromeRamEstimateMb || 320) - (data.stats.estimatedRamMb || 14));
      setTotalRamSavedMb((prev) => prev + ramDiff);

    } catch (err: any) {
      // A deliberate stop must not be reported as a navigation failure.
      if (err?.name === 'AbortError') {
        setTabs((prev) =>
          prev.map((t) => (t.id === tabId && t.status === 'loading' ? { ...t, status: 'loaded' } : t))
        );
        return;
      }
      console.error('Navigation failed:', err);
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId
            ? {
                ...t,
                status: 'error',
                errorMessage: err.message || 'Failed to establish connection',
              }
            : t
        )
      );
    } finally {
      if (abortControllers.current.get(tabId) === controller) {
        abortControllers.current.delete(tabId);
      }
    }
  }, [activeTabId, settings, tabs]);

  // Stop an in-flight load for the active tab.
  const handleStopLoading = useCallback(() => {
    abortControllers.current.get(activeTabId)?.abort();
    abortControllers.current.delete(activeTabId);
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId && t.status === 'loading' ? { ...t, status: 'loaded' } : t))
    );
  }, [activeTabId]);

  // Reload current active tab
  const handleReload = () => {
    if (activeTab.url && activeTab.url !== 'about:home') {
      handleNavigate(activeTab.url);
    }
  };

  // Back button
  const handleGoBack = () => {
    if (activeTab.historyIndex > 0) {
      const targetUrl = activeTab.history[activeTab.historyIndex - 1];
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId
            ? { ...t, historyIndex: t.historyIndex - 1 }
            : t
        )
      );
      handleNavigate(targetUrl);
    }
  };

  // Forward button
  const handleGoForward = () => {
    if (activeTab.historyIndex < activeTab.history.length - 1) {
      const targetUrl = activeTab.history[activeTab.historyIndex + 1];
      setTabs((prev) =>
        prev.map((t) =>
          t.id === activeTabId
            ? { ...t, historyIndex: t.historyIndex + 1 }
            : t
        )
      );
      handleNavigate(targetUrl);
    }
  };

  // Home button
  const handleGoHome = () => {
    handleNavigate('about:home');
  };

  // New Tab
  const handleNewTab = () => {
    const newId = `tab-${Date.now()}`;
    const newTab = createInitialTab(newId);
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  };

  // Close Tab
  const handleCloseTab = (id: string, e?: { stopPropagation?: () => void }) => {
    e?.stopPropagation?.();
    if (tabs.length === 1) {
      // If closing the only tab, reset it to home
      const newTab = createInitialTab();
      setTabs([newTab]);
      setActiveTabId(newTab.id);
      return;
    }

    const tabIndex = tabs.findIndex((t) => t.id === id);
    const newTabs = tabs.filter((t) => t.id !== id);
    setTabs(newTabs);

    if (id === activeTabId) {
      const nextIndex = Math.max(0, tabIndex - 1);
      setActiveTabId(newTabs[nextIndex].id);
    }
  };

  // Rendering Mode Change
  const handleSetMode = (mode: RenderingMode) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId ? { ...t, mode } : t
      )
    );
    // Pass the new mode explicitly: `handleNavigate` would otherwise read the
    // previous mode out of its `tabs` closure and fetch the wrong render.
    if (activeTab.url && activeTab.url !== 'about:home') {
      handleNavigate(activeTab.url, activeTabId, undefined, mode);
    }
  };

  // Bookmark Toggle
  const isCurrentBookmarked = bookmarks.some((b) => b.url === activeTab.url);
  const handleToggleBookmark = () => {
    if (activeTab.url === 'about:home' || !activeTab.url) return;
    if (isCurrentBookmarked) {
      setBookmarks((prev) => prev.filter((b) => b.url !== activeTab.url));
    } else {
      const newBm: Bookmark = {
        id: `bm-${Date.now()}`,
        title: activeTab.title || activeTab.displayUrl || 'Page',
        url: activeTab.url,
        icon: activeTab.favicon || '🔖',
        createdAt: Date.now(),
      };
      setBookmarks((prev) => [...prev, newBm]);
    }
  };

  const handleRemoveBookmark = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  };

  // History management
  const handleClearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_HISTORY);
    } catch {}
  };

  const handleRemoveHistoryItem = (id: string) => {
    setHistory((prev) => prev.filter((h) => h.id !== id));
  };

  // Export Offline Snapshot
  const handleExportSnapshot = () => {
    if (!activeTab.htmlContent) return;
    const blob = new Blob([activeTab.htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(activeTab.title || 'page').replace(/[^a-zA-Z0-9_-]/g, '_')}_sanitized.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Process Manager Operations (Kill, Freeze, Purge, Telemetry)
  const handleKillTab = (tabId: string) => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id === tabId) {
          return {
            ...t,
            status: 'killed',
            htmlContent: '',
            stats: {
              ...t.stats,
              estimatedRamMb: 0.8,
              estimatedGpuPercent: 0,
              cpuUsage: 0,
              gpuUsage: 0,
            },
          };
        }
        return t;
      })
    );
  };

  const handleRestartTab = (tabId: string) => {
    const target = tabs.find((t) => t.id === tabId);
    if (target) {
      if (target.url === 'about:home' || !target.url) {
        setTabs((prev) =>
          prev.map((t) => (t.id === tabId ? { ...t, status: 'idle' } : t))
        );
      } else {
        handleNavigate(target.url, tabId);
      }
    }
  };

  const handleFreezeTab = (tabId: string) => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id === tabId) {
          const nextStatus = t.status === 'frozen' ? 'idle' : 'frozen';
          return {
            ...t,
            status: nextStatus,
            stats: {
              ...t.stats,
              cpuUsage: nextStatus === 'frozen' ? 0.1 : 1.2,
              gpuUsage: nextStatus === 'frozen' ? 0 : 0.8,
            },
          };
        }
        return t;
      })
    );
  };

  const handlePurgeTabMemory = (tabId: string) => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id === tabId) {
          return {
            ...t,
            stats: {
              ...t.stats,
              estimatedRamMb: Math.max(1.8, Math.round((t.stats.estimatedRamMb || 14) * 0.45 * 10) / 10),
            },
          };
        }
        return t;
      })
    );
  };

  const handlePurgeGlobalMemory = () => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabId && t.status !== 'killed') {
          return {
            ...t,
            stats: {
              ...t.stats,
              estimatedRamMb: Math.max(2.4, Math.round((t.stats.estimatedRamMb || 14) * 0.5 * 10) / 10),
            },
          };
        }
        return t;
      })
    );
  };

  const handleReportDomMetrics = useCallback((tabId: string, domNodes: number) => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id === tabId) {
          const dynamicRam = Math.round((7 + domNodes / 70) * 10) / 10;
          const dynamicCpu = Math.round((0.6 + domNodes / 500) * 10) / 10;
          return {
            ...t,
            domNodeCount: domNodes,
            stats: {
              ...t.stats,
              estimatedRamMb: dynamicRam,
              cpuUsage: dynamicCpu,
            },
          };
        }
        return t;
      })
    );
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Task Manager shortcut: Shift + Esc
      if (e.shiftKey && (e.key === 'Escape' || e.key === 'Esc')) {
        e.preventDefault();
        setIsProcessTrackerOpen((prev) => !prev);
        return;
      }

      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && e.key.toLowerCase() === 't') {
        e.preventDefault();
        handleNewTab();
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        handleCloseTab(activeTabId);
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        handleReload();
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        document.getElementById('omnibox-input')?.focus();
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setDrawerState((prev) => ({ ...prev, isOpen: true, tab: 'history' }));
      } else if (isCmdOrCtrl && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleToggleBookmark();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId, tabs, activeTab]);

  return (
    <div id="tcp-browser-app" className="flex flex-col h-screen w-screen bg-slate-950 overflow-hidden font-sans select-none">
      {/* Top Tab Strip */}
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={setActiveTabId}
        onCloseTab={handleCloseTab}
        onNewTab={handleNewTab}
      />

      {/* Address & Navigation Toolbar (Omnibox) */}
      <Omnibox
        activeTab={activeTab}
        onNavigate={(url) => handleNavigate(url)}
        onReload={handleReload}
        onGoBack={handleGoBack}
        onGoForward={handleGoForward}
        onGoHome={handleGoHome}
        onSetMode={handleSetMode}
        onToggleBookmark={handleToggleBookmark}
        isBookmarked={isCurrentBookmarked}
        onOpenShieldModal={() => setIsShieldModalOpen(true)}
        onOpenDrawer={(tab) => setDrawerState({ isOpen: true, tab })}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenConvertModal={() => setIsConvertModalOpen(true)}
        onOpenProcessTracker={() => setIsProcessTrackerOpen(true)}
        onExportSnapshot={handleExportSnapshot}
        onStopLoading={handleStopLoading}
        searchEngine={settings.defaultSearchEngine}
        onSelectSearchEngine={(eng) => setSettings((prev) => ({ ...prev, defaultSearchEngine: eng }))}
        lowGpuMode={settings.lowGpuMode}
        onToggleLowGpu={() => setSettings((prev) => ({ ...prev, lowGpuMode: !prev.lowGpuMode }))}
      />

      {/* Bookmarks Bar */}
      <BookmarksBar
        bookmarks={bookmarks}
        onNavigate={(url) => handleNavigate(url)}
        onRemoveBookmark={handleRemoveBookmark}
      />

      {/* Main Browser Viewport */}
      <main className="flex-1 relative flex flex-col overflow-hidden">
        <BrowserViewport
          tab={activeTab}
          onNavigate={(url) => handleNavigate(url)}
          onPostSubmit={(url, body) => handleNavigate(url, activeTab.id, body)}
          onReload={handleReload}
          onSetMode={handleSetMode}
          searchEngine={settings.defaultSearchEngine}
          onSelectSearchEngine={(eng) => setSettings((prev) => ({ ...prev, defaultSearchEngine: eng }))}
          totalTrackersBlocked={totalTrackersBlocked}
          totalRamSavedMb={totalRamSavedMb}
          readerTheme={settings.readerTheme}
          onChangeReaderTheme={(thm) => setSettings((prev) => ({ ...prev, readerTheme: thm }))}
          readerFontSize={settings.fontSize}
          onChangeReaderFontSize={(sz) => setSettings((prev) => ({ ...prev, fontSize: sz }))}
          onOpenConvertModal={() => setIsConvertModalOpen(true)}
          onOpenProcessTracker={() => setIsProcessTrackerOpen(true)}
          onOpenShieldModal={() => setIsShieldModalOpen(true)}
          onReportDomMetrics={handleReportDomMetrics}
          onResumeTab={handleFreezeTab}
        />
      </main>

      {/* Performance & Shield Status Bar */}
      <PerformanceBadge
        activeTab={activeTab}
        onOpenShieldModal={() => setIsShieldModalOpen(true)}
        onOpenProcessTracker={() => setIsProcessTrackerOpen(true)}
        lowGpuMode={settings.lowGpuMode}
      />

      {/* Inspector Modal */}
      <ShieldModal
        isOpen={isShieldModalOpen}
        onClose={() => setIsShieldModalOpen(false)}
        stats={activeTab.stats}
        currentUrl={activeTab.url}
        currentMode={activeTab.mode}
        onSetMode={handleSetMode}
      />

      {/* Bookmarks & History Drawer */}
      <BookmarksHistoryDrawer
        isOpen={drawerState.isOpen}
        onClose={() => setDrawerState({ ...drawerState, isOpen: false })}
        initialTab={drawerState.tab}
        bookmarks={bookmarks}
        history={history}
        onNavigate={(url) => handleNavigate(url)}
        onRemoveBookmark={(id) => handleRemoveBookmark(id)}
        onClearHistory={handleClearHistory}
        onRemoveHistoryItem={handleRemoveHistoryItem}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={(newVals) => setSettings((prev) => ({ ...prev, ...newVals }))}
        onOpenConvertModal={() => setIsConvertModalOpen(true)}
        onOpenProcessTracker={() => setIsProcessTrackerOpen(true)}
      />

      {/* Convert Software & Launcher Download Modal */}
      <ConvertSoftwareModal
        isOpen={isConvertModalOpen}
        onClose={() => setIsConvertModalOpen(false)}
        deferredPrompt={deferredPrompt}
      />

      {/* Internal Web Process & Hardware Resource Tracker Modal */}
      <ProcessTrackerModal
        isOpen={isProcessTrackerOpen}
        onClose={() => setIsProcessTrackerOpen(false)}
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={setActiveTabId}
        onKillTab={handleKillTab}
        onRestartTab={handleRestartTab}
        onFreezeTab={handleFreezeTab}
        onPurgeTabMemory={handlePurgeTabMemory}
        onPurgeGlobalMemory={handlePurgeGlobalMemory}
        lowGpuMode={settings.lowGpuMode}
        onToggleLowGpu={() => setSettings((prev) => ({ ...prev, lowGpuMode: !prev.lowGpuMode }))}
      />
    </div>
  );
}
