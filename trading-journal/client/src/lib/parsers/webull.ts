/**
 * Webull CSV Parser
 *
 * Expected Webull transaction history columns (typical export):
 *   Symbol, Trade Date, Action, Quantity, Price, Amount, Commission, Fees, ...
 *
 * Common column name variations handled:
 *   - "Symbol" | "Ticker"
 *   - "Trade Date" | "Date" | "Transaction Date"
 *   - "Action" | "Side" | "Type" (values: "Buy","Sell","BUY","SELL")
 *   - "Quantity" | "Qty" | "Shares"
 *   - "Price" | "Avg Price" | "Average Price" | "Fill Price"
 *   - "Amount" | "Net Amount" | "Total Amount"
 *   - "Commission" | "Comm" | "Commissions"
 *   - "Fees" | "Fee" | "Regulatory Fee"
 *
 * Time column (optional):
 *   - "Time" | "Trade Time" | "Execution Time"
 *
 * To add/adjust column mappings, edit COLUMN_MAP below.
 */

import Papa from 'papaparse';
import { Execution, Broker } from '../../types';
import { generateId, parseDecimal, combineDatetime } from '../utils/parsing';

/** Maps normalized key → list of accepted raw column names (case-insensitive) */
const COLUMN_MAP: Record<string, string[]> = {
  symbol:     ['symbol', 'ticker', 'stock'],
  date:       ['trade date', 'date', 'transaction date', 'tradedate'],
  time:       ['time', 'trade time', 'execution time', 'tradetime'],
  action:     ['action', 'side', 'type', 'buy/sell', 'transaction type'],
  quantity:   ['quantity', 'qty', 'shares', 'filled qty', 'filled quantity'],
  price:      ['price', 'avg price', 'average price', 'fill price', 'executed price'],
  amount:     ['amount', 'net amount', 'total amount', 'proceeds'],
  commission: ['commission', 'comm', 'commissions'],
  fees:       ['fees', 'fee', 'regulatory fee', 'sec fee', 'other fees'],
};

/** Resolve a column value from a row given a list of candidate names */
function resolve(row: Record<string, string>, candidates: string[]): string {
  for (const candidate of candidates) {
    // Try exact match first
    const val = row[candidate];
    if (val !== undefined && val !== null) return val.trim();
    // Try case-insensitive
    const key = Object.keys(row).find(k => k.toLowerCase().trim() === candidate.toLowerCase());
    if (key && row[key] !== undefined) return row[key].trim();
  }
  return '';
}

/** Detect whether a CSV looks like a Webull export */
export function detectWebull(headers: string[]): boolean {
  const normalized = headers.map(h => h.toLowerCase().trim());
  // Webull typically has "Action" (not "TradeDate" like IBKR, not "Buy/Sell" spelled differently)
  const hasAction = normalized.some(h => ['action', 'side', 'buy/sell'].includes(h));
  const hasSymbol = normalized.some(h => ['symbol', 'ticker'].includes(h));
  const hasPrice  = normalized.some(h => ['price', 'avg price', 'fill price'].includes(h));
  return hasSymbol && hasAction && hasPrice;
}

/** Parse a Webull CSV string into an array of Execution objects */
export function parseWebullCSV(csvText: string): { executions: Execution[]; errors: string[] } {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const errors: string[] = [];
  if (result.errors.length > 0) {
    errors.push(...result.errors.map(e => `Row ${e.row}: ${e.message}`));
  }

  const executions: Execution[] = [];
  const broker: Broker = 'webull';

  result.data.forEach((row, idx) => {
    try {
      const symbol  = resolve(row, COLUMN_MAP.symbol);
      const dateStr = resolve(row, COLUMN_MAP.date);
      const timeStr = resolve(row, COLUMN_MAP.time);
      const action  = resolve(row, COLUMN_MAP.action).toUpperCase();
      const qtyStr  = resolve(row, COLUMN_MAP.quantity);
      const priceStr= resolve(row, COLUMN_MAP.price);
      const amtStr  = resolve(row, COLUMN_MAP.amount);
      const commStr = resolve(row, COLUMN_MAP.commission);
      const feeStr  = resolve(row, COLUMN_MAP.fees);

      if (!symbol || !dateStr || !action) {
        errors.push(`Row ${idx + 2}: Missing required fields (symbol, date, action). Skipped.`);
        return;
      }
      if (!['BUY', 'SELL', 'B', 'S'].includes(action)) {
        // Skip non-trade rows (dividends, transfers, etc.)
        return;
      }

      const qty    = parseDecimal(qtyStr);
      const price  = parseDecimal(priceStr);
      const commission = parseDecimal(commStr);
      const fees   = parseDecimal(feeStr);
      const totalFees = commission + fees;

      // Quantity sign: positive for buy, negative for sell
      const signedQty = action === 'BUY' || action === 'B' ? Math.abs(qty) : -Math.abs(qty);

      // Proceeds: amount from CSV, or compute if missing
      let proceeds = parseDecimal(amtStr);
      if (!proceeds && qty && price) {
        proceeds = qty * price;
        if (action === 'SELL' || action === 'S') proceeds = Math.abs(proceeds);
        else proceeds = -Math.abs(proceeds); // cost basis negative for buys
      }

      const dateTime = combineDatetime(dateStr, timeStr);

      executions.push({
        id: generateId(),
        broker,
        dateTime,
        symbol: symbol.toUpperCase(),
        quantity: signedQty,
        price,
        proceeds,
        fees: totalFees,
        rawRowIndex: idx,
      });
    } catch (err) {
      errors.push(`Row ${idx + 2}: ${String(err)}`);
    }
  });

  return { executions, errors };
}
