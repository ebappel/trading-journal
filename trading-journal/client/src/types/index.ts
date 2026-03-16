/**
 * Core data types for the Trading Journal.
 * All monetary values are in USD.
 */

/** Supported broker identifiers */
export type Broker = 'webull' | 'ibkr' | 'unknown';

/** Trade direction */
export type Side = 'long' | 'short';

/**
 * A single fill / execution from the broker CSV.
 * Represents one line in the raw import.
 */
export interface Execution {
  id: string;
  broker: Broker;
  /** ISO datetime string */
  dateTime: string;
  symbol: string;
  /** Positive = buy, negative = sell */
  quantity: number;
  price: number;
  /** Gross proceeds/cost of this fill (before fees) */
  proceeds: number;
  /** Commission + fees for this fill */
  fees: number;
  /** Raw row index from CSV for debugging */
  rawRowIndex?: number;
}

/**
 * A normalized round-trip trade: one open + one or more closes.
 * This is the primary unit for analytics.
 */
export interface Trade {
  id: string;
  broker: Broker;
  symbol: string;
  side: Side;
  /** Total quantity traded (absolute) */
  quantity: number;
  /** ISO datetime of first entry */
  openDateTime: string;
  /** ISO datetime of last exit */
  closeDateTime: string;
  avgEntryPrice: number;
  avgExitPrice: number;
  /** Gross P&L before fees */
  grossPnL: number;
  /** Total fees and commissions */
  fees: number;
  /** Net P&L after fees */
  netPnL: number;
  /** Optional user-defined tag or strategy */
  strategy?: string;
  /** Optional: day of week 0=Sun..6=Sat derived from openDateTime */
  dayOfWeek?: number;
  /** Optional: hour of day (0-23) derived from openDateTime */
  hourOfDay?: number;
}

/**
 * Daily session: aggregate of all trades on a single calendar day.
 */
export interface Session {
  /** YYYY-MM-DD */
  date: string;
  trades: Trade[];
  netPnL: number;
  grossPnL: number;
  fees: number;
  winCount: number;
  lossCount: number;
  tradeCount: number;
}

/**
 * Application-level persisted state (saved to localStorage and exported as JSON).
 */
export interface JournalState {
  /** Schema version for future migration */
  version: number;
  trades: Trade[];
  /** Sessions are recomputed from trades, but we cache them */
  sessions: Session[];
  /** ISO timestamp of last import */
  lastImport?: string;
}

/**
 * Filter state for the Trades view.
 */
export interface TradeFilters {
  symbol?: string;
  side?: Side | '';
  broker?: Broker | '';
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}
