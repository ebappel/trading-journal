/**
 * Normalization Pipeline
 *
 * Converts raw Execution objects → Trade objects (round-trips) → Session objects.
 *
 * Algorithm:
 * - Group executions by (symbol, broker, date-day).
 * - Within each group, use FIFO matching:
 *   - Maintain an "open position" running total.
 *   - When position flips from non-zero to zero (or sign changes), close a trade.
 * - Each closed trade becomes a Trade object.
 *
 * Limitations:
 * - Partial fills are averaged.
 * - Position flips (go long → go short in one order) are split at zero.
 * - Overnight holds are treated as same trade if opened/closed on different days
 *   (only grouped by symbol+direction, not day).
 */

import { Execution, Trade, Session, Side } from '../types';
import { generateId, dateFromISO, hourFromISO, dayOfWeekFromISO } from './utils/parsing';

interface OpenLeg {
  /** Signed quantity still open (positive=long, negative=short) */
  quantity: number;
  /** Weighted average entry price */
  avgPrice: number;
  /** Total fees accumulated on entries so far */
  entryFees: number;
  /** ISO datetime of first entry */
  openDateTime: string;
  symbol: string;
  broker: Execution['broker'];
}

/**
 * Convert a list of Execution objects into Trade objects using FIFO matching.
 *
 * @param executions - All executions (may span multiple symbols and dates)
 * @returns Array of completed Trade objects, sorted by closeDateTime
 */
export function executionsToTrades(executions: Execution[]): Trade[] {
  // Sort chronologically
  const sorted = [...executions].sort(
    (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
  );

  // Open position ledger keyed by `${broker}:${symbol}`
  const openPositions: Map<string, OpenLeg> = new Map();
  const completedTrades: Trade[] = [];

  for (const exec of sorted) {
    const key = `${exec.broker}:${exec.symbol}`;
    const open = openPositions.get(key);

    if (!open) {
      // No open position — this execution opens a new position
      openPositions.set(key, {
        quantity: exec.quantity,
        avgPrice: exec.price,
        entryFees: exec.fees,
        openDateTime: exec.dateTime,
        symbol: exec.symbol,
        broker: exec.broker,
      });
    } else {
      // There is an open position
      const newQty = open.quantity + exec.quantity;

      if (Math.sign(newQty) === Math.sign(open.quantity) || newQty === 0) {
        // Adding to or fully closing the position
        if (newQty === 0) {
          // Exact close — complete the trade
          const trade = closeTrade(open, exec);
          completedTrades.push(trade);
          openPositions.delete(key);
        } else if (Math.abs(newQty) < Math.abs(open.quantity)) {
          // Partial close — complete a partial trade
          const closedQty = -exec.quantity; // how much we're closing
          const partialOpen: OpenLeg = {
            ...open,
            quantity: closedQty,
          };
          const trade = closeTrade(partialOpen, exec);
          completedTrades.push(trade);
          // Remaining open position
          openPositions.set(key, {
            ...open,
            quantity: newQty,
          });
        } else {
          // Adding to position — update weighted avg
          const totalQty = Math.abs(open.quantity) + Math.abs(exec.quantity);
          const newAvg = (open.avgPrice * Math.abs(open.quantity) + exec.price * Math.abs(exec.quantity)) / totalQty;
          openPositions.set(key, {
            ...open,
            quantity: newQty,
            avgPrice: newAvg,
            entryFees: open.entryFees + exec.fees,
          });
        }
      } else {
        // Position flip: close current, open new in opposite direction
        // First close the existing position
        const closeExec: Execution = {
          ...exec,
          quantity: -open.quantity, // just enough to close
          fees: exec.fees * (Math.abs(open.quantity) / Math.abs(exec.quantity)),
        };
        const trade = closeTrade(open, closeExec);
        completedTrades.push(trade);

        // Remaining quantity opens a new position in opposite direction
        const remainQty = exec.quantity + open.quantity;
        const remainFees = exec.fees - closeExec.fees;
        openPositions.set(key, {
          quantity: remainQty,
          avgPrice: exec.price,
          entryFees: remainFees,
          openDateTime: exec.dateTime,
          symbol: exec.symbol,
          broker: exec.broker,
        });
      }
    }
  }

  // Any still-open positions: create open (unclosed) trades as partial records
  // We include them so the user can see them, but they have no close price
  for (const [, open] of Array.from(openPositions.entries())) {
    const side: Side = open.quantity > 0 ? 'long' : 'short';
    completedTrades.push({
      id: generateId(),
      broker: open.broker,
      symbol: open.symbol,
      side,
      quantity: Math.abs(open.quantity),
      openDateTime: open.openDateTime,
      closeDateTime: open.openDateTime, // same as open (unclosed)
      avgEntryPrice: open.avgPrice,
      avgExitPrice: 0,
      grossPnL: 0,
      fees: open.entryFees,
      netPnL: -open.entryFees,
      strategy: '',
      dayOfWeek: dayOfWeekFromISO(open.openDateTime),
      hourOfDay: hourFromISO(open.openDateTime),
    });
  }

  return completedTrades.sort(
    (a, b) => new Date(a.closeDateTime).getTime() - new Date(b.closeDateTime).getTime()
  );
}

/** Build a Trade from an open leg and a closing execution */
function closeTrade(open: OpenLeg, closeExec: Execution): Trade {
  const side: Side = open.quantity > 0 ? 'long' : 'short';
  const qty = Math.abs(open.quantity);

  let grossPnL: number;
  if (side === 'long') {
    // Long: sell price - buy price × qty
    grossPnL = (closeExec.price - open.avgPrice) * qty;
  } else {
    // Short: buy price - sell price × qty
    grossPnL = (open.avgPrice - closeExec.price) * qty;
  }

  const fees = open.entryFees + closeExec.fees;
  const netPnL = grossPnL - fees;

  return {
    id: generateId(),
    broker: open.broker,
    symbol: open.symbol,
    side,
    quantity: qty,
    openDateTime: open.openDateTime,
    closeDateTime: closeExec.dateTime,
    avgEntryPrice: open.avgPrice,
    avgExitPrice: closeExec.price,
    grossPnL,
    fees,
    netPnL,
    strategy: '',
    dayOfWeek: dayOfWeekFromISO(open.openDateTime),
    hourOfDay: hourFromISO(open.openDateTime),
  };
}

/**
 * Aggregate trades into daily Session objects.
 * Groups by the calendar date of closeDateTime.
 */
export function tradesToSessions(trades: Trade[]): Session[] {
  const byDate: Map<string, Trade[]> = new Map();

  for (const trade of trades) {
    const date = dateFromISO(trade.closeDateTime);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(trade);
  }

  const sessions: Session[] = [];
  for (const [date, dayTrades] of Array.from(byDate.entries())) {
    const netPnL   = dayTrades.reduce((s: number, t: Trade) => s + t.netPnL, 0);
    const grossPnL = dayTrades.reduce((s: number, t: Trade) => s + t.grossPnL, 0);
    const fees     = dayTrades.reduce((s: number, t: Trade) => s + t.fees, 0);
    const winCount  = dayTrades.filter((t: Trade) => t.netPnL > 0).length;
    const lossCount = dayTrades.filter((t: Trade) => t.netPnL <= 0).length;

    sessions.push({
      date,
      trades: dayTrades,
      netPnL,
      grossPnL,
      fees,
      winCount,
      lossCount,
      tradeCount: dayTrades.length,
    });
  }

  return sessions.sort((a, b) => a.date.localeCompare(b.date));
}
