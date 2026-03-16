/**
 * CSV Import Orchestrator
 *
 * Ties together broker detection, parsing, normalization, and deduplication.
 */

import Papa from 'papaparse';
import { Execution, Trade, Broker } from '../types';
import { parseWebullCSV, detectWebull } from './parsers/webull';
import { parseIBKRCSV, detectIBKR } from './parsers/ibkr';
import { executionsToTrades } from './normalize';

export interface ImportResult {
  broker: Broker;
  executions: Execution[];
  trades: Trade[];
  errors: string[];
  warnings: string[];
}

/**
 * Auto-detect broker from CSV headers.
 * Returns 'unknown' if detection fails.
 */
export function detectBroker(csvText: string): Broker {
  const result = Papa.parse<string[]>(csvText, { header: false, preview: 2 });
  const firstRow = result.data[0] ?? [];
  const headers  = firstRow.map(String);

  if (detectIBKR(headers)) return 'ibkr';
  if (detectWebull(headers)) return 'webull';
  return 'unknown';
}

/**
 * Parse a CSV file and return normalized Trade objects.
 * @param csvText - Raw CSV content as a string
 * @param broker  - Force a specific broker, or 'unknown' to auto-detect
 */
export function importCSV(csvText: string, broker: Broker | 'auto' = 'auto'): ImportResult {
  const warnings: string[] = [];

  // Resolve broker
  const resolvedBroker: Broker =
    broker === 'auto' || broker === 'unknown'
      ? detectBroker(csvText)
      : broker;

  if (resolvedBroker === 'unknown') {
    warnings.push(
      'Could not auto-detect broker. Check that your CSV has standard Webull or IBKR column names. Attempting Webull format as fallback.'
    );
  }

  // Parse into executions
  let executions: Execution[] = [];
  let errors: string[] = [];

  if (resolvedBroker === 'ibkr') {
    ({ executions, errors } = parseIBKRCSV(csvText));
  } else {
    // Default / fallback: Webull
    ({ executions, errors } = parseWebullCSV(csvText));
  }

  if (executions.length === 0 && errors.length === 0) {
    errors.push('No trade rows found in CSV. Please check the file format and broker selection.');
  }

  // Normalize executions → trades
  const trades = executionsToTrades(executions);

  return {
    broker: resolvedBroker,
    executions,
    trades,
    errors,
    warnings,
  };
}

/**
 * Merge newly imported trades into an existing trade list.
 * Deduplication: trades with identical (symbol + openDateTime + closeDateTime + broker) are skipped.
 */
export function mergeTradesDedup(existing: Trade[], incoming: Trade[]): {
  merged: Trade[];
  addedCount: number;
  skippedCount: number;
} {
  const existingKeys = new Set(
    existing.map(t => `${t.broker}|${t.symbol}|${t.openDateTime}|${t.closeDateTime}`)
  );

  let addedCount = 0;
  let skippedCount = 0;
  const toAdd: Trade[] = [];

  for (const t of incoming) {
    const key = `${t.broker}|${t.symbol}|${t.openDateTime}|${t.closeDateTime}`;
    if (existingKeys.has(key)) {
      skippedCount++;
    } else {
      toAdd.push(t);
      addedCount++;
    }
  }

  return {
    merged: [...existing, ...toAdd].sort(
      (a, b) => new Date(a.closeDateTime).getTime() - new Date(b.closeDateTime).getTime()
    ),
    addedCount,
    skippedCount,
  };
}
