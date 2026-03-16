import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell, ScatterChart,
  Scatter, ZAxis
} from 'recharts';
import { useJournal } from '../context/JournalContext';
import { EmptyState } from '../components/EmptyState';
import { StatCard } from '../components/StatCard';
import {
  computeOverallStats,
  computeDayOfWeekStats,
  computeHourOfDayStats,
  computeSymbolStats,
  computePnLDistribution,
  computeStdDev,
  computeDrawdown,
} from '../lib/analytics';
import { formatCurrency, formatPct } from '../lib/utils/parsing';
import { cn } from '../lib/utils';

const PROFIT_COLOR = '#22c55e';
const LOSS_COLOR   = '#ef4444';
const ACCENT_COLOR = '#3b82f6';

function PnLTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value as number;
  return (
    <div className="rounded-md border border-border bg-popover shadow-md px-3 py-2 text-xs">
      <div className="text-muted-foreground mb-1">{label}</div>
      <div className={val >= 0 ? 'text-green-500 font-bold' : 'text-red-500 font-bold'}>
        {formatCurrency(val, true)}
      </div>
    </div>
  );
}

function CountTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover shadow-md px-3 py-2 text-xs">
      <div className="text-muted-foreground mb-1">{label}</div>
      <div className="font-bold">{payload[0].value} trades</div>
    </div>
  );
}

export function ReportsPage() {
  const { trades } = useJournal();

  const stats    = useMemo(() => computeOverallStats(trades), [trades]);
  const drawdown = useMemo(() => computeDrawdown(trades), [trades]);
  const dowStats = useMemo(() => computeDayOfWeekStats(trades), [trades]);
  const hourStats= useMemo(() => computeHourOfDayStats(trades), [trades]);
  const symStats = useMemo(() => computeSymbolStats(trades), [trades]);
  const distrib  = useMemo(() => computePnLDistribution(trades, 20), [trades]);
  const stdDev   = useMemo(() => computeStdDev(trades), [trades]);

  if (trades.length === 0) return <EmptyState />;

  const pfDisplay = stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2);

  return (
    <div className="p-6 space-y-8 max-w-screen-xl">
      <div>
        <h1 className="text-xl font-bold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Deep analytics for {trades.length} trades</p>
      </div>

      {/* ─── Win / Loss Analysis ─── */}
      <section>
        <h2 className="text-base font-semibold text-foreground mb-3">Win / Loss Analysis</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatCard label="Winners" value={stats.winCount} subtext={`${formatPct(stats.winRate)} win rate`} rawValue={1} colorValue />
          <StatCard label="Losers"  value={stats.lossCount} subtext={`${formatPct(100 - stats.winRate)} loss rate`} rawValue={-1} colorValue />
          <StatCard label="Avg Win"  value={formatCurrency(stats.avgWin)}  rawValue={stats.avgWin}  colorValue />
          <StatCard label="Avg Loss" value={formatCurrency(stats.avgLoss)} rawValue={stats.avgLoss} colorValue />
          <StatCard label="Largest Win"  value={formatCurrency(stats.largestWin)}  rawValue={stats.largestWin}  colorValue />
          <StatCard label="Largest Loss" value={formatCurrency(stats.largestLoss)} rawValue={stats.largestLoss} colorValue />
          <StatCard label="Gross Profit" value={formatCurrency(stats.grossProfit)} rawValue={stats.grossProfit} colorValue />
          <StatCard label="Gross Loss"   value={formatCurrency(stats.grossLoss)}   rawValue={stats.grossLoss}   colorValue />
        </div>

        {/* P&L Distribution Histogram */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">P&L Distribution</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={distrib} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} vertical={false} />
              <XAxis
                dataKey="range"
                tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                axisLine={false}
                interval={Math.floor(distrib.length / 8)}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={32}
              />
              <Tooltip content={<CountTooltip />} />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {distrib.map((entry, i) => (
                  <Cell key={i} fill={entry.min >= 0 ? PROFIT_COLOR : LOSS_COLOR} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ─── Day / Time Analysis ─── */}
      <section>
        <h2 className="text-base font-semibold text-foreground mb-3">Day & Time Analysis</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* By Day of Week */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">P&L by Day of Week</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dowStats} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={(v) => `$${v >= 0 ? '' : '-'}${Math.abs(v) >= 1000 ? (Math.abs(v) / 1000).toFixed(1) + 'k' : Math.abs(v).toFixed(0)}`}
                />
                <Tooltip content={<PnLTooltip />} />
                <ReferenceLine y={0} stroke="var(--border)" />
                <Bar dataKey="netPnL" radius={[3, 3, 0, 0]}>
                  {dowStats.map((entry, i) => <Cell key={i} fill={entry.netPnL >= 0 ? PROFIT_COLOR : LOSS_COLOR} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {/* Win rate overlay */}
            <div className="flex gap-3 mt-2">
              {dowStats.map(d => (
                <div key={d.day} className="flex flex-col items-center flex-1 text-xs">
                  <span className="text-muted-foreground">{d.label}</span>
                  <span className="font-semibold">{d.tradeCount > 0 ? formatPct(d.winRate, 0) : '—'}</span>
                </div>
              ))}
            </div>
          </div>

          {/* By Hour of Day */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">P&L by Hour of Day</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={hourStats} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={(v) => `$${v >= 0 ? '' : '-'}${Math.abs(v) >= 1000 ? (Math.abs(v) / 1000).toFixed(1) + 'k' : Math.abs(v).toFixed(0)}`}
                />
                <Tooltip content={<PnLTooltip />} />
                <ReferenceLine y={0} stroke="var(--border)" />
                <Bar dataKey="netPnL" radius={[3, 3, 0, 0]}>
                  {hourStats.map((entry, i) => <Cell key={i} fill={entry.netPnL >= 0 ? PROFIT_COLOR : LOSS_COLOR} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* ─── Symbol Breakdown ─── */}
      <section>
        <h2 className="text-base font-semibold text-foreground mb-3">Symbol Breakdown</h2>
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm" data-testid="symbol-table">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {['Symbol', 'Trades', 'Net P&L', 'Win Rate', 'Avg P&L', 'Profit Factor', 'Largest Win', 'Largest Loss'].map(col => (
                  <th key={col} className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {symStats.map((s, i) => (
                <tr key={s.symbol} className={cn('border-b border-border/50 hover:bg-muted/20', i % 2 === 0 ? '' : 'bg-muted/5')}>
                  <td className="px-3 py-2 font-semibold">{s.symbol}</td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{s.tradeCount}</td>
                  <td className={cn('px-3 py-2 font-bold tabular-nums', s.netPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400')}>
                    {formatCurrency(s.netPnL, true)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{formatPct(s.winRate)}</td>
                  <td className={cn('px-3 py-2 tabular-nums', s.avgTradePnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400')}>
                    {formatCurrency(s.avgTradePnL, true)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{s.profitFactor === Infinity ? '∞' : s.profitFactor.toFixed(2)}</td>
                  <td className="px-3 py-2 tabular-nums text-green-600 dark:text-green-400">{formatCurrency(s.largestWin, true)}</td>
                  <td className="px-3 py-2 tabular-nums text-red-500 dark:text-red-400">{formatCurrency(s.largestLoss, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── Risk & Drawdown ─── */}
      <section>
        <h2 className="text-base font-semibold text-foreground mb-3">Risk & Drawdown</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <StatCard label="Max Drawdown" value={formatCurrency(drawdown.maxDrawdown)} rawValue={drawdown.maxDrawdown} colorValue />
          <StatCard label="Max DD %" value={formatPct(drawdown.maxDrawdownPct)} rawValue={drawdown.maxDrawdownPct} colorValue />
          <StatCard label="DD Duration" value={`${drawdown.maxDrawdownDuration} trades`} subtext="peak-to-trough" />
          <StatCard label="P&L Std Dev" value={formatCurrency(stdDev)} subtext="per trade volatility" />
          <StatCard label="Expectancy" value={formatCurrency(stats.expectancy, true)} rawValue={stats.expectancy} colorValue />
          <StatCard label="Profit Factor" value={pfDisplay} rawValue={stats.profitFactor === Infinity ? 1 : stats.profitFactor - 1} colorValue />
          <StatCard label="Gross Profit" value={formatCurrency(stats.grossProfit)} rawValue={stats.grossProfit} colorValue />
          <StatCard label="Total Fees" value={formatCurrency(stats.totalFees)} subtext="commissions + fees" />
        </div>
      </section>
    </div>
  );
}
