import { LifetimeStats, PersistedSettings } from './types';

const PREFIX = 'qz.zenpulse.';
const KEY_STATS = `${PREFIX}stats`;
const KEY_SETTINGS = `${PREFIX}settings`;
const KEY_BEST = `${PREFIX}best`;

const defaultSettings: PersistedSettings = {
  muted: true,
  calmMode: false,
  showHint: true,
};

const defaultStats: LifetimeStats = {
  plays: 0,
  perfects: 0,
  hits: 0,
  attempts: 0,
  longestStreak: 0,
  bestScore: 0,
};

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors (quota, private mode)
  }
}

export function loadSettings(): PersistedSettings {
  return readJSON<PersistedSettings>(KEY_SETTINGS, defaultSettings);
}

export function saveSettings(settings: PersistedSettings) {
  writeJSON(KEY_SETTINGS, settings);
}

export function hasStoredSettings(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(KEY_SETTINGS) !== null;
}

export function loadStats(): LifetimeStats {
  const stats = readJSON<LifetimeStats>(KEY_STATS, defaultStats);
  const best = readJSON<number>(KEY_BEST, stats.bestScore ?? 0);
  return { ...stats, bestScore: typeof best === 'number' ? best : 0 };
}

export function saveStats(stats: LifetimeStats) {
  writeJSON(KEY_STATS, stats);
  writeJSON(KEY_BEST, stats.bestScore);
}

export function updateBestScore(bestScore: number) {
  if (typeof window === 'undefined') return;
  writeJSON(KEY_BEST, bestScore);
}

export { defaultSettings, defaultStats };
