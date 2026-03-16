/**
 * Interactive Brokers (IBKR) CSV Parser
 *
 * Supports two common IBKR export formats:
 *
 * 1. IBKR Flex Query "Trades" section:
 *    Columns: TradeDate, TradeTime, Symbol, Quantity, T. Price, Comm/Fee, Proceeds, Basis, ...
 *
 * 2. IBKR Activity Statement "Trades" section (with "Trades" section header):
 *    Same data but may have a leading "Header" row; we skip non-data rows automatically.
 *
 * Key column name variations handled:
 *   - "TradeDate" | "Trade Date" | "Date/Time" (IBKR sometimes puts both in one)
 *   - "TradeTime" | "Trade Time"
 *   - "Symbol" | "Instrument"
 *   - "Quantity" | "Qty"
 *   - "T. Price" | "T.Price" | "Trade Price" | "Price"
 *   - "Comm/Fee" | "Commission" | "Commissions" | "Comm Fee"
 *   - "Proceeds" | "Gross Proceeds"
 *   - "Basis" | "Cost Basis" (used to compute P&L, not stored directly)
 *
 * To add/adjust column mappings, edit COLUMN_MAP below.
 */

import Papa from 'papaparse';
import { Execution, Broker } from '../../types';
import { generateId, parseDecimal, combineDatetime } from '../utils/parsing';

const COLUMN_MAP: Record<string, string[]> = {
  date:       ['tradedate', 'trade date', 'date', 'date/time'],
  time:       ['tradetime', 'trade time', 'time'],
  datetime:   ['date/time'],           // IBKR sometimes combines date+time
  symbol:     ['symbol', 'instrument', 'description'],
  quantity:   ['quantity', 'qty'],
  price:      ['t. price', 't.price', 'trade price', 'price', 'tradeprice'],
  commission: ['comm/fee', 'comm fee', 'commission', 'commissions', 'commfee'],
  proceeds:   ['proceeds', 'gross proceeds'],
  basis:      ['basis', 'cost basis'],
};

function resolve(row: Record<string, string>, candidates: string[]): string {
  for (const candidate of candidates) {
    const val = row[candidate];
    if (val !== undefined && val !== null && val.trim() !== '') return val.trim();
    const key = Object.keys(row).find(k => k.toLowerCase().trim() === candidate.toLowerCase());
    if (key && row[key] !== undefined && row[key].trim() !== '') return row[key].trim();
  }
  return '';
}

/** Detect whether a CSV looks like an IBKR export */
export function detectIBKR(headers: string[]): boolean {
  const normalized = headers.map(h => h.toLowerCase().trim());
  const hasTradeDate = normalized.some(h => ['tradedate', 'trade date', 'date/time'].includes(h));
  const hasProceeds  = normalized.some(h => ['proceeds', 'gross proceeds'].includes(h));
  const hasCommFee   = normalized.some(h => ['comm/fee', 'comm fee', 'commfee'].includes(h));
  return hasTradeDate && (hasProceeds || hasCommFee);
}

/**
 * Parse an IBKR CSV (Flex Query or Activity Statement) into Execution objects.
 * IBKR activity statements have multiple sections; we filter to rows that look
 * like trade data (have a symbol and numeric quantity).
 */
export function parseIBKRCSV(csvText: string): { executions: Execution[]; errors: string[] } {
  // IBKR activity statements have section headers like "Trades,Header,..." and "Trades,Data,..."
  // We need to handle both plain CSV and the section-based format.
  const lines = csvText.split('\n');
  const isActivityStatement = lines.some(l => l.startsWith('Trades,'));

  let parsableText = csvText;
  if (isActivityStatement) {
    // Extract only "Trades,Data,..." rows, strip the first two columns
    const headerLine = lines.find(l => l.startsWith('Trades,Header,'));
    const dataLines  = lines.filter(l => l.startsWith('Trades,Data,'));
    if (!headerLine || dataLines.length === 0) {
      return { executions: [], errors: ['Could not find Trades section in IBKR activity statement.'] };
    }
    // Strip "Trades,Header," / "Trades,Data," prefix
    const cleanHeader = headerLine.replace(/^Trades,Header,/, '');
    const cleanData   = dataLines.map(l => l.replace(/^Trades,Data,/, ''));
    parsableText = [cleanHeader, ...cleanData].join('\n');
  }

  const result = Papa.parse<Record<string, string>>(parsableText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const errors: string[] = [];
  if (result.errors.length > 0) {
    errors.push(...result.errors.map(e => `Row ${e.row}: ${e.message}`));
  }

  const executions: Execution[] = [];
  const broker: Broker = 'ibkr';

  result.data.forEach((row, idx) => {
    try {
      const symbol = resolve(row, COLUMN_MAP.symbol);
      if (!symbol) return; // Skip subtotal / summary rows

      const qtyStr   = resolve(row, COLUMN_MAP.quantity);
      const qty      = parseDecimal(qtyStr);
      if (qty === 0 && qtyStr === '') return; // Skip blank rows

      // Date/time handling: IBKR may combine as "2024-01-15, 09:30:00" or separate columns
      let dateStr = resolve(row, COLUMN_MAP.datetime);
      let timeStr = '';
      if (dateStr.includes(',')) {
        const parts = dateStr.split(',');
        dateStr = parts[0].trim();
        timeStr = parts[1]?.trim() || '';
      } else {
        if (!dateStr) dateStr = resolve(row, COLUMN_MAP.date);
        timeStr = resolve(row, COLUMN_MAP.time);
      }

      const priceStr    = resolve(row, COLUMN_MAP.price);
      const commStr     = resolve(row, COLUMN_MAP.commission);
      const proceedsStr = resolve(row, COLUMN_MAP.proceeds);

      if (!dateStr) {
        errors.push(`Row ${idx + 2}: Missing date. Skipped.`);
        return;
      }

      const price    = parseDecimal(priceStr);
      // IBKR Comm/Fee is typically negative (a cost); take absolute value
      const fees     = Math.abs(parseDecimal(commStr));
      // Proceeds: IBKR shows gross proceeds (positive = sale, negative = purchase)
      let proceeds   = parseDecimal(proceedsStr);
      if (proceeds === 0 && price && qty) {
        proceeds = qty * price; // fallback
      }

      const dateTime = combineDatetime(dateStr, timeStr);

      executions.push({
        id: generateId(),
        broker,
        dateTime,
        symbol: symbol.toUpperCase(),
        quantity: qty, // IBKR already signs quantity correctly
        price,
        proceeds,
        fees,
        rawRowIndex: idx,
      });
    } catch (err) {
      errors.push(`Row ${idx + 2}: ${String(err)}`);
    }
  });

  return { executions, errors };
}
