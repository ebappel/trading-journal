/**
 * Persistence Layer
 *
 * Handles saving/loading the journal state to/from localStorage,
 * and JSON export/import for cross-machine backups.
 *
 * Storage key: "trading_journal_v1"
 * JSON schema version: 1
 *
 * To extend persistence:
 * - Add fields to JournalState in types/index.ts
 * - Bump SCHEMA_VERSION
 * - Add migration logic in migrateState()
 */

import { JournalState, Trade, Session } from '../types';

const STORAGE_KEY = 'trading_journal_v1';
const SCHEMA_VERSION = 1;

const EMPTY_STATE: JournalState = {
  version: SCHEMA_VERSION,
  trades: [],
  sessions: [],
};

/** Load journal state from localStorage. Returns empty state if nothing saved. */
export function loadState(): JournalState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_STATE };
    const parsed = JSON.parse(raw) as JournalState;
    return migrateState(parsed);
  } catch (err) {
    console.error('[Persistence] Failed to load state:', err);
    return { ...EMPTY_STATE };
  }
}

/** Save journal state to localStorage */
export function saveState(state: JournalState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('[Persistence] Failed to save state:', err);
  }
}

/** Clear all journal data from localStorage */
export function clearState(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Export the full journal state as a downloadable JSON file.
 * Creates a blob URL and triggers a browser download.
 */
export function exportToJSON(state: JournalState): void {
  const exportData = {
    ...state,
    version: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appName: 'TradingJournal',
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href     = url;
  a.download = `trading-journal-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Import journal state from a JSON file.
 * Returns the loaded state or throws an error with a descriptive message.
 */
export async function importFromJSON(file: File): Promise<JournalState> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text);

        // Basic structural validation
        if (!data || typeof data !== 'object') {
          reject(new Error('Invalid JSON: not an object.'));
          return;
        }
        if (!data.appName || data.appName !== 'TradingJournal') {
          reject(new Error('This file does not appear to be a Trading Journal backup.'));
          return;
        }
        if (!Array.isArray(data.trades)) {
          reject(new Error('Invalid backup: missing trades array.'));
          return;
        }

        const state = migrateState(data as JournalState);
        resolve(state);
      } catch (err) {
        reject(new Error(`Failed to parse JSON: ${String(err)}`));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsText(file);
  });
}

/**
 * Handle schema migrations between versions.
 * Add cases here as the schema evolves.
 */
function migrateState(state: Partial<JournalState>): JournalState {
  const version = state.version ?? 0;

  // v0 → v1: ensure required fields exist
  if (version < 1) {
    return {
      version: SCHEMA_VERSION,
      trades: state.trades ?? [],
      sessions: state.sessions ?? [],
    };
  }

  return {
    version: SCHEMA_VERSION,
    trades: state.trades ?? [],
    sessions: state.sessions ?? [],
    lastImport: state.lastImport,
  };
}
