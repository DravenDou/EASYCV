/**
 * useLocalStorageYaml — persists the CV YAML in localStorage with debounce.
 *
 * Why:
 *   Without persistence the user loses all edits on page reload. This hook
 *   transparently saves every change after a short idle period and restores
 *   the last known state on mount.
 */
'use client';

import { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'rendercv:yaml';
const DEBOUNCE_MS = 800;

/**
 * Load the YAML string previously saved in localStorage.
 *
 * Returns null when localStorage is unavailable (SSR) or when no value
 * has been saved yet.
 */
function loadFromStorage(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Persist a YAML string to localStorage.
 *
 * Silently no-ops when storage is unavailable or quota is exceeded.
 */
function saveToStorage(yaml: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, yaml);
  } catch {
    // QuotaExceededError or SecurityError — ignore silently
  }
}

/**
 * Clear the persisted YAML from localStorage.
 */
export function clearStoredYaml(): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export type UseLocalStorageYamlResult = {
  /** The current YAML string managed by this hook. */
  yaml: string;
  /** Whether we restored a previously saved draft on mount. */
  restoredFromStorage: boolean;
  /** Update the YAML. The new value is debounce-persisted automatically. */
  setYaml: (nextYaml: string) => void;
};

/**
 * Manage CV YAML state with transparent localStorage persistence.
 *
 * @param fallback - Initial YAML used when no persisted draft exists.
 */
export function useLocalStorageYaml(fallback: string): UseLocalStorageYamlResult {
  const [yaml, setYamlState] = useState<string>(fallback);
  const [restoredFromStorage, setRestoredFromStorage] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstMount = useRef(true);

  // On first client-side mount, restore any previously saved draft.
  useEffect(() => {
    if (!isFirstMount.current) {
      return;
    }
    isFirstMount.current = false;

    const saved = loadFromStorage();
    if (saved !== null && saved.trim()) {
      setYamlState(saved);
      setRestoredFromStorage(true);
    }
  }, []);

  const setYaml = (nextYaml: string): void => {
    setYamlState(nextYaml);

    // Debounce the write so rapid keystrokes don't thrash localStorage.
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      saveToStorage(nextYaml);
    }, DEBOUNCE_MS);
  };

  // Clear the pending debounce on unmount to avoid stale writes.
  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return { yaml, restoredFromStorage, setYaml };
}
