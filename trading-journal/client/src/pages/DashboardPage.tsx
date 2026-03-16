import { useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts';
import { useJournal } from '../context/JournalContext';
import { EmptyState } from '../components/EmptyState';
import { StatCard } from '../components/StatCard';
import {
  computeOverallStats,
  computeDrawdown,
  computeDayOfWeekStats,
  computeSymbolStats,
} from '../lib/analytics';
import { formatCurrency, formatPct } from '../lib/utils/parsing';

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

function EquityTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value as number;
  return (
    <div className="rounded-md border border-border bg-popover shadow-md px-3 py-2 text-xs">
      <div className="text-muted-foreground mb-1">{label}</div>
      <div className={val >= 0 ? 'text-green-500 font-bold' : 'text-red-500 font-bold'}>
        Cumulative: {formatCurrency(val, true)}
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { trades } = useJournal();

  const stats    = useMemo(() => computeOverallStats(trades), [trades]);
  const drawdown = useMemo(() => computeDrawdown(trades), [trades]);
  const dowStats = useMemo(() => computeDayOfWeekStats(trades), [trades]);
  const symStats = useMemo(() => computeSymbolStats(trades).slice(0, 8), [trades]);

  if (trades.length === 0) return <EmptyState />;

  const pfDisplay = stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2);

  // Equity curve: sample at most 200 points for performance
  const curve = drawdown.equityCurve;
  const step  = Math.max(1, Math.floor(curve.length / 200));
  const chartCurve = curve.filter((_, i) => i % step === 0 || i === curve.length - 1);

  return (
    <div className="p-6 space-y-6 max-w-screen-xl">
      {/* Page title */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{trades.length} total trades</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="kpi-grid">
        <StatCard
          label="Net P&L"
          value={formatCurrency(stats.totalNetPnL, true)}
          rawValue={stats.totalNetPnL}
          colorValue
          trend={stats.totalNetPnL >= 0 ? 'up' : 'down'}
          data-testid="kpi-net-pnl"
        />
        <StatCard
          label="Win Rate"
          value={formatPct(stats.winRate)}
          subtext={`${stats.winCount}W / ${stats.lossCount}L`}
          rawValue={stats.winRate - 50}
          colorValue
          data-testid="kpi-win-rate"
        />
        <StatCard
          label="Profit Factor"
          value={pfDisplay}
          subtext="gross profit / loss"
          rawValue={stats.profitFactor === Infinity ? 1 : stats.profitFactor - 1}
          colorValue
          data-testid="kpi-profit-factor"
        />
        <StatCard
          label="Avg Trade"
          value={formatCurrency(stats.expectancy, true)}
          rawValue={stats.expectancy}
          colorValue
          data-testid="kpi-avg-trade"
        />
        <StatCard
          label="Max Drawdown"
          value={formatCurrency(drawdown.maxDrawdown)}
          subtext={formatPct(drawdown.maxDrawdownPct)}
          rawValue={drawdown.maxDrawdown}
          colorValue
          data-testid="kpi-max-dd"
        />
        <StatCard
          label="Total Fees"
          value={formatCurrency(stats.totalFees)}
          subtext="commissions + fees"
          data-testid="kpi-fees"
        />
      </div>

      {/* Equity Curve */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground mb-4">Equity Curve</h2>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartCurve} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              width={48}
            />
            <Tooltip content={<EquityTooltip />} />
            <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="4 4" />
            <Line
              type="monotone"
              dataKey="cumulative"
              stroke={ACCENT_COLOR}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: ACCENT_COLOR }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* P&L by Day of Week */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">P&L by Day</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dowStats} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${v >= 0 ? '' : '-'}${Math.abs(v) >= 1000 ? (Math.abs(v) / 1000).toFixed(1) + 'k' : Math.abs(v).toFixed(0)}`}
                width={48}
              />
              <Tooltip content={<PnLTooltip />} />
              <ReferenceLine y={0} stroke="var(--border)" />
              <Bar dataKey="netPnL" radius={[3, 3, 0, 0]}>
                {dowStats.map((entry, i) => (
                  <Cell key={i} fill={entry.netPnL >= 0 ? PROFIT_COLOR : LOSS_COLOR} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* P&L by Symbol */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">P&L by Symbol</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={symStats}
              layout="vertical"
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${v >= 0 ? '' : '-'}${Math.abs(v) >= 1000 ? (Math.abs(v) / 1000).toFixed(1) + 'k' : Math.abs(v).toFixed(0)}`}
              />
              <YAxis
                type="category"
                dataKey="symbol"
                width={48}
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<PnLTooltip />} />
              <ReferenceLine x={0} stroke="var(--border)" />
              <Bar dataKey="netPnL" radius={[0, 3, 3, 0]}>
                {symStats.map((entry, i) => (
                  <Cell key={i} fill={entry.netPnL >= 0 ? PROFIT_COLOR : LOSS_COLOR} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Win / Loss Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Avg Win" value={formatCurrency(stats.avgWin)} rawValue={stats.avgWin} colorValue />
        <StatCard label="Avg Loss" value={formatCurrency(stats.avgLoss)} rawValue={stats.avgLoss} colorValue />
        <StatCard label="Largest Win" value={formatCurrency(stats.largestWin)} rawValue={stats.largestWin} colorValue />
        <StatCard label="Largest Loss" value={formatCurrency(stats.largestLoss)} rawValue={stats.largestLoss} colorValue />
      </div>
    </div>
  );
}
