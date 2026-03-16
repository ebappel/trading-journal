/**
 * Analytics Engine
 *
 * All analytics are computed from an array of Trade objects.
 * No state is mutated; all functions are pure.
 *
 * Formulas:
 * - Win Rate = winning trades / total closed trades × 100
 * - Profit Factor = gross profit / |gross loss|  (Infinity if no losing trades)
 * - Expectancy = average net P&L per trade
 * - Drawdown = peak-to-trough decline in cumulative equity
 * - R-Multiple = netPnL / |avgLoss|  (only meaningful when avgLoss > 0)
 */

import { Trade, Session } from '../types';

export interface OverallStats {
  totalNetPnL: number;
  totalGrossPnL: number;
  totalFees: number;
  totalTrades: number;
  winCount: number;
  lossCount: number;
  evenCount: number;
  winRate: number;          // 0-100
  profitFactor: number;     // gross_profit / |gross_loss|
  expectancy: number;       // avg net P&L per trade
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  avgTradePnL: number;
  grossProfit: number;
  grossLoss: number;        // always negative
}

export interface DrawdownStats {
  maxDrawdown: number;          // absolute dollar value (negative)
  maxDrawdownPct: number;       // as % of peak equity (negative)
  maxDrawdownDuration: number;  // in number of trades
  /** Equity curve: [{tradeIndex, cumulativePnL}] */
  equityCurve: { index: number; date: string; pnl: number; cumulative: number }[];
}

export interface DayOfWeekStats {
  day: number;        // 0=Sun, 1=Mon... 6=Sat
  label: string;
  netPnL: number;
  tradeCount: number;
  winRate: number;
}

export interface HourOfDayStats {
  hour: number;       // 0-23
  label: string;
  netPnL: number;
  tradeCount: number;
  winRate: number;
}

export interface SymbolStats {
  symbol: string;
  netPnL: number;
  grossPnL: number;
  fees: number;
  tradeCount: number;
  winCount: number;
  winRate: number;
  avgTradePnL: number;
  profitFactor: number;
  largestWin: number;
  largestLoss: number;
}

export interface PnLDistributionBucket {
  range: string;
  min: number;
  max: number;
  count: number;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Compute all overall performance stats from a list of trades */
export function computeOverallStats(trades: Trade[]): OverallStats {
  if (trades.length === 0) {
    return {
      totalNetPnL: 0, totalGrossPnL: 0, totalFees: 0, totalTrades: 0,
      winCount: 0, lossCount: 0, evenCount: 0, winRate: 0, profitFactor: 0,
      expectancy: 0, avgWin: 0, avgLoss: 0, largestWin: 0, largestLoss: 0,
      avgTradePnL: 0, grossProfit: 0, grossLoss: 0,
    };
  }

  const winners = trades.filter(t => t.netPnL > 0);
  const losers  = trades.filter(t => t.netPnL < 0);
  const evens   = trades.filter(t => t.netPnL === 0);

  const totalNetPnL  = trades.reduce((s, t) => s + t.netPnL, 0);
  const totalGrossPnL= trades.reduce((s, t) => s + t.grossPnL, 0);
  const totalFees    = trades.reduce((s, t) => s + t.fees, 0);

  const grossProfit  = winners.reduce((s, t) => s + t.netPnL, 0);
  const grossLoss    = losers.reduce((s, t) => s + t.netPnL, 0);

  const winRate = trades.length > 0 ? (winners.length / trades.length) * 100 : 0;
  const profitFactor = grossLoss !== 0 ? grossProfit / Math.abs(grossLoss) : Infinity;
  const expectancy   = totalNetPnL / trades.length;

  const avgWin  = winners.length > 0 ? grossProfit / winners.length : 0;
  const avgLoss = losers.length  > 0 ? grossLoss   / losers.length  : 0;

  const largestWin  = winners.length > 0 ? Math.max(...winners.map(t => t.netPnL)) : 0;
  const largestLoss = losers.length  > 0 ? Math.min(...losers.map(t => t.netPnL))  : 0;

  return {
    totalNetPnL, totalGrossPnL, totalFees, totalTrades: trades.length,
    winCount: winners.length, lossCount: losers.length, evenCount: evens.length,
    winRate, profitFactor, expectancy, avgWin, avgLoss,
    largestWin, largestLoss, avgTradePnL: expectancy, grossProfit, grossLoss,
  };
}

/**
 * Compute equity curve and drawdown statistics.
 * Equity curve is based on chronological order of closeDateTime.
 */
export function computeDrawdown(trades: Trade[]): DrawdownStats {
  if (trades.length === 0) {
    return { maxDrawdown: 0, maxDrawdownPct: 0, maxDrawdownDuration: 0, equityCurve: [] };
  }

  const sorted = [...trades].sort(
    (a, b) => new Date(a.closeDateTime).getTime() - new Date(b.closeDateTime).getTime()
  );

  let cumulative = 0;
  let peak = 0;
  let maxDD = 0;
  let maxDDPct = 0;
  let ddStart = 0;
  let maxDDDuration = 0;
  let currentDDStart = 0;

  const equityCurve = sorted.map((trade, i) => {
    cumulative += trade.netPnL;

    if (cumulative > peak) {
      // New peak — reset drawdown tracking
      peak = cumulative;
      currentDDStart = i;
    }

    const dd = cumulative - peak; // always <= 0
    if (dd < maxDD) {
      maxDD = dd;
      maxDDPct = peak !== 0 ? (dd / Math.abs(peak)) * 100 : 0;
      maxDDDuration = i - currentDDStart;
    }

    return {
      index: i,
      date: trade.closeDateTime.slice(0, 10),
      pnl: trade.netPnL,
      cumulative,
    };
  });

  return {
    maxDrawdown: maxDD,
    maxDrawdownPct: maxDDPct,
    maxDrawdownDuration: maxDDDuration,
    equityCurve,
  };
}

/** Compute P&L by day of week */
export function computeDayOfWeekStats(trades: Trade[]): DayOfWeekStats[] {
  const map: Record<number, Trade[]> = {};
  for (let i = 0; i < 7; i++) map[i] = [];

  for (const t of trades) {
    const dow = t.dayOfWeek ?? new Date(t.openDateTime).getDay();
    map[dow].push(t);
  }

  return Object.entries(map)
    .filter(([day]) => [1, 2, 3, 4, 5].includes(Number(day))) // Mon–Fri only
    .map(([dayStr, dayTrades]) => {
      const day = Number(dayStr);
      const netPnL = dayTrades.reduce((s, t) => s + t.netPnL, 0);
      const winners = dayTrades.filter(t => t.netPnL > 0).length;
      return {
        day,
        label: DAY_LABELS[day],
        netPnL,
        tradeCount: dayTrades.length,
        winRate: dayTrades.length > 0 ? (winners / dayTrades.length) * 100 : 0,
      };
    });
}

/** Compute P&L by hour of day */
export function computeHourOfDayStats(trades: Trade[]): HourOfDayStats[] {
  const map: Record<number, Trade[]> = {};
  for (let h = 0; h < 24; h++) map[h] = [];

  for (const t of trades) {
    const hour = t.hourOfDay ?? new Date(t.openDateTime).getHours();
    map[hour].push(t);
  }

  // Only return hours that have at least one trade
  return Object.entries(map)
    .filter(([, ts]) => ts.length > 0)
    .map(([hourStr, hourTrades]) => {
      const hour = Number(hourStr);
      const netPnL = hourTrades.reduce((s, t) => s + t.netPnL, 0);
      const winners = hourTrades.filter(t => t.netPnL > 0).length;
      const amPm = hour < 12 ? 'AM' : 'PM';
      const displayHour = hour % 12 === 0 ? 12 : hour % 12;
      return {
        hour,
        label: `${displayHour}${amPm}`,
        netPnL,
        tradeCount: hourTrades.length,
        winRate: hourTrades.length > 0 ? (winners / hourTrades.length) * 100 : 0,
      };
    })
    .sort((a, b) => a.hour - b.hour);
}

/** Compute per-symbol statistics */
export function computeSymbolStats(trades: Trade[]): SymbolStats[] {
  const map: Record<string, Trade[]> = {};

  for (const t of trades) {
    if (!map[t.symbol]) map[t.symbol] = [];
    map[t.symbol].push(t);
  }

  return Object.entries(map).map(([symbol, symTrades]) => {
    const stats = computeOverallStats(symTrades);
    return {
      symbol,
      netPnL: stats.totalNetPnL,
      grossPnL: stats.totalGrossPnL,
      fees: stats.totalFees,
      tradeCount: symTrades.length,
      winCount: stats.winCount,
      winRate: stats.winRate,
      avgTradePnL: stats.avgTradePnL,
      profitFactor: stats.profitFactor,
      largestWin: stats.largestWin,
      largestLoss: stats.largestLoss,
    };
  }).sort((a, b) => b.netPnL - a.netPnL);
}

/** Compute P&L distribution histogram (20 buckets) */
export function computePnLDistribution(trades: Trade[], buckets = 20): PnLDistributionBucket[] {
  if (trades.length === 0) return [];

  const pnls = trades.map(t => t.netPnL);
  const min  = Math.min(...pnls);
  const max  = Math.max(...pnls);
  const range = max - min || 1;
  const step  = range / buckets;

  const distribution: PnLDistributionBucket[] = Array.from({ length: buckets }, (_, i) => ({
    range: `${formatNum(min + i * step)}\n${formatNum(min + (i + 1) * step)}`,
    min: min + i * step,
    max: min + (i + 1) * step,
    count: 0,
  }));

  for (const pnl of pnls) {
    let idx = Math.floor((pnl - min) / step);
    if (idx >= buckets) idx = buckets - 1; // include max in last bucket
    distribution[idx].count++;
  }

  return distribution;
}

function formatNum(n: number): string {
  return n >= 0 ? `$${n.toFixed(0)}` : `-$${Math.abs(n).toFixed(0)}`;
}

/** Standard deviation of trade P&Ls */
export function computeStdDev(trades: Trade[]): number {
  if (trades.length < 2) return 0;
  const pnls = trades.map(t => t.netPnL);
  const mean = pnls.reduce((a, b) => a + b, 0) / pnls.length;
  const variance = pnls.reduce((s, p) => s + (p - mean) ** 2, 0) / (pnls.length - 1);
  return Math.sqrt(variance);
}
