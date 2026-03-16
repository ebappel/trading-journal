/**
 * JournalContext — global state for the trading journal.
 * Provides trade data, sessions, filters, and CRUD operations.
 * Data is persisted to localStorage on every mutation.
 */

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { Trade, Session, JournalState, TradeFilters } from '../types';
import { loadState, saveState, clearState, exportToJSON } from '../lib/persistence';
import { tradesToSessions } from '../lib/normalize';

interface JournalContextValue {
  // Data
  trades: Trade[];
  sessions: Session[];
  lastImport?: string;

  // Filters
  filters: TradeFilters;
  setFilters: (f: Partial<TradeFilters>) => void;
  resetFilters: () => void;

  // Filtered trades (derived)
  filteredTrades: Trade[];

  // Mutations
  addTrades: (newTrades: Trade[]) => void;
  replaceTrades: (newTrades: Trade[]) => void;
  clearAllData: () => void;
  restoreFromJSON: (state: JournalState) => void;

  // Export
  exportJSON: () => void;
}

const DEFAULT_FILTERS: TradeFilters = {};

const JournalContext = createContext<JournalContextValue | null>(null);

export function JournalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<JournalState>(() => loadState());
  const [filters, setFiltersState] = useState<TradeFilters>(DEFAULT_FILTERS);

  // Persist on every state change
  useEffect(() => {
    saveState(state);
  }, [state]);

  const addTrades = useCallback((newTrades: Trade[]) => {
    setState(prev => {
      const merged = [...prev.trades, ...newTrades].sort(
        (a, b) => new Date(a.closeDateTime).getTime() - new Date(b.closeDateTime).getTime()
      );
      return {
        ...prev,
        trades: merged,
        sessions: tradesToSessions(merged),
        lastImport: new Date().toISOString(),
      };
    });
  }, []);

  const replaceTrades = useCallback((newTrades: Trade[]) => {
    const sorted = [...newTrades].sort(
      (a, b) => new Date(a.closeDateTime).getTime() - new Date(b.closeDateTime).getTime()
    );
    setState({
      version: 1,
      trades: sorted,
      sessions: tradesToSessions(sorted),
      lastImport: new Date().toISOString(),
    });
  }, []);

  const clearAllData = useCallback(() => {
    clearState();
    setState({ version: 1, trades: [], sessions: [] });
    setFiltersState(DEFAULT_FILTERS);
  }, []);

  const restoreFromJSON = useCallback((newState: JournalState) => {
    const recomputed = {
      ...newState,
      sessions: tradesToSessions(newState.trades),
    };
    setState(recomputed);
    saveState(recomputed);
  }, []);

  const exportJSON = useCallback(() => {
    exportToJSON(state);
  }, [state]);

  const setFilters = useCallback((partial: Partial<TradeFilters>) => {
    setFiltersState(prev => ({ ...prev, ...partial }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
  }, []);

  // Derived: apply filters to trades
  const filteredTrades = applyFilters(state.trades, filters);

  return (
    <JournalContext.Provider value={{
      trades: state.trades,
      sessions: state.sessions,
      lastImport: state.lastImport,
      filters,
      setFilters,
      resetFilters,
      filteredTrades,
      addTrades,
      replaceTrades,
      clearAllData,
      restoreFromJSON,
      exportJSON,
    }}>
      {children}
    </JournalContext.Provider>
  );
}

export function useJournal(): JournalContextValue {
  const ctx = useContext(JournalContext);
  if (!ctx) throw new Error('useJournal must be used inside JournalProvider');
  return ctx;
}

function applyFilters(trades: Trade[], filters: TradeFilters): Trade[] {
  let result = trades;

  if (filters.symbol) {
    const sym = filters.symbol.toUpperCase();
    result = result.filter(t => t.symbol === sym);
  }
  if (filters.side) {
    result = result.filter(t => t.side === filters.side);
  }
  if (filters.broker) {
    result = result.filter(t => t.broker === filters.broker);
  }
  if (filters.dateFrom) {
    result = result.filter(t => t.openDateTime.slice(0, 10) >= filters.dateFrom!);
  }
  if (filters.dateTo) {
    result = result.filter(t => t.openDateTime.slice(0, 10) <= filters.dateTo!);
  }
  if (filters.search) {
    const q = filters.search.toUpperCase();
    result = result.filter(t => t.symbol.includes(q));
  }

  return result;
}
