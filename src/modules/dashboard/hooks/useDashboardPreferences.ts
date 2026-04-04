'use client';

import { useCallback, useSyncExternalStore } from 'react';

export interface DashboardPreferences {
  hiddenWidgets: string[];
  accordionsOpen: boolean;
}

const DEFAULT_PREFERENCES: DashboardPreferences = {
  hiddenWidgets: [],
  accordionsOpen: true,
};

function getStorageKey(companyId: string): string {
  return `dashboard-prefs-${companyId}`;
}

function getSnapshot(companyId: string): DashboardPreferences {
  if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
  try {
    const raw = localStorage.getItem(getStorageKey(companyId));
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw);
    return {
      hiddenWidgets: Array.isArray(parsed.hiddenWidgets) ? parsed.hiddenWidgets : [],
      accordionsOpen: typeof parsed.accordionsOpen === 'boolean' ? parsed.accordionsOpen : true,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function savePreferences(companyId: string, prefs: DashboardPreferences): void {
  localStorage.setItem(getStorageKey(companyId), JSON.stringify(prefs));
  window.dispatchEvent(new Event('dashboard-prefs-change'));
}

const listeners = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  const handleChange = () => callback();
  window.addEventListener('dashboard-prefs-change', handleChange);
  return () => {
    listeners.delete(callback);
    window.removeEventListener('dashboard-prefs-change', handleChange);
  };
}

export function useDashboardPreferences(companyId: string) {
  const preferences = useSyncExternalStore(
    subscribe,
    () => getSnapshot(companyId),
    () => DEFAULT_PREFERENCES
  );

  const setPreferences = useCallback(
    (updater: (prev: DashboardPreferences) => DashboardPreferences) => {
      const current = getSnapshot(companyId);
      const next = updater(current);
      savePreferences(companyId, next);
    },
    [companyId]
  );

  const toggleWidget = useCallback(
    (widgetId: string) => {
      setPreferences((prev) => {
        const isHidden = prev.hiddenWidgets.includes(widgetId);
        return {
          ...prev,
          hiddenWidgets: isHidden
            ? prev.hiddenWidgets.filter((id) => id !== widgetId)
            : [...prev.hiddenWidgets, widgetId],
        };
      });
    },
    [setPreferences]
  );

  const setAccordionsOpen = useCallback(
    (open: boolean) => {
      setPreferences((prev) => ({ ...prev, accordionsOpen: open }));
    },
    [setPreferences]
  );

  const isWidgetVisible = useCallback(
    (widgetId: string) => !preferences.hiddenWidgets.includes(widgetId),
    [preferences.hiddenWidgets]
  );

  const resetDefaults = useCallback(() => {
    savePreferences(companyId, DEFAULT_PREFERENCES);
  }, [companyId]);

  return {
    preferences,
    toggleWidget,
    setAccordionsOpen,
    isWidgetVisible,
    resetDefaults,
  };
}
