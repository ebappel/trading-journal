import { useState, useMemo } from 'react';
import { useJournal } from '../context/JournalContext';
import { EmptyState } from '../components/EmptyState';
import { Trade } from '../types';
import { formatCurrency } from '../lib/utils/parsing';
import { cn } from '../lib/utils';
import {
  ChevronUp, ChevronDown, ChevronsUpDown,
  Search, X
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

type SortKey = keyof Pick<Trade, 'openDateTime' | 'symbol' | 'side' | 'netPnL' | 'quantity' | 'avgEntryPrice' | 'avgExitPrice' | 'fees'>;
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 50;

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="w-3.5 h-3.5 text-muted-foreground/50" />;
  return sortDir === 'asc'
    ? <ChevronUp className="w-3.5 h-3.5 text-primary" />
    : <ChevronDown className="w-3.5 h-3.5 text-primary" />;
}

export function TradesPage() {
  const { trades, filters, setFilters, resetFilters } = useJournal();
  const [sortKey, setSortKey] = useState<SortKey>('openDateTime');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);

  const filteredAndSorted = useMemo(() => {
    let result = [...trades];

    // Apply filters
    if (filters.search) {
      const q = filters.search.toUpperCase();
      result = result.filter(t => t.symbol.includes(q));
    }
    if (filters.side) result = result.filter(t => t.side === filters.side);
    if (filters.broker) result = result.filter(t => t.broker === filters.broker);
    if (filters.dateFrom) result = result.filter(t => t.openDateTime.slice(0, 10) >= filters.dateFrom!);
    if (filters.dateTo)   result = result.filter(t => t.openDateTime.slice(0, 10) <= filters.dateTo!);

    // Sort
    result.sort((a, b) => {
      const av = a[sortKey] as any;
      const bv = b[sortKey] as any;
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return sortDir === 'asc' ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });

    return result;
  }, [trades, filters, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSorted.length / PAGE_SIZE));
  const pageSlice  = filteredAndSorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (col: SortKey) => {
    if (col === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(col);
      setSortDir('desc');
    }
    setPage(1);
  };

  if (trades.length === 0) return <EmptyState />;

  const hasActiveFilters = !!(filters.search || filters.side || filters.broker || filters.dateFrom || filters.dateTo);

  return (
    <div className="p-6 space-y-4 max-w-screen-xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Trades</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filteredAndSorted.length} of {trades.length} trades
          </p>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap gap-2 items-center" data-testid="trade-filters">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-sm w-36"
            placeholder="Symbol..."
            value={filters.search ?? ''}
            onChange={e => { setFilters({ search: e.target.value }); setPage(1); }}
            data-testid="filter-search"
          />
        </div>

        <Select
          value={filters.side || 'all'}
          onValueChange={v => { setFilters({ side: v === 'all' ? '' as any : v as any }); setPage(1); }}
        >
          <SelectTrigger className="h-8 text-sm w-28" data-testid="filter-side">
            <SelectValue placeholder="Side" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sides</SelectItem>
            <SelectItem value="long">Long</SelectItem>
            <SelectItem value="short">Short</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.broker || 'all'}
          onValueChange={v => { setFilters({ broker: v === 'all' ? '' as any : v as any }); setPage(1); }}
        >
          <SelectTrigger className="h-8 text-sm w-32" data-testid="filter-broker">
            <SelectValue placeholder="Broker" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Brokers</SelectItem>
            <SelectItem value="webull">Webull</SelectItem>
            <SelectItem value="ibkr">IBKR</SelectItem>
          </SelectContent>
        </Select>

        <Input
          type="date"
          className="h-8 text-sm w-36"
          value={filters.dateFrom ?? ''}
          onChange={e => { setFilters({ dateFrom: e.target.value }); setPage(1); }}
          data-testid="filter-date-from"
        />
        <span className="text-xs text-muted-foreground">–</span>
        <Input
          type="date"
          className="h-8 text-sm w-36"
          value={filters.dateTo ?? ''}
          onChange={e => { setFilters({ dateTo: e.target.value }); setPage(1); }}
          data-testid="filter-date-to"
        />

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={() => { resetFilters(); setPage(1); }}
            data-testid="filter-reset"
          >
            <X className="w-3 h-3" /> Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm" data-testid="trades-table">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {([
                ['openDateTime', 'Date/Time'],
                ['symbol',        'Symbol'],
                ['side',          'Side'],
                ['quantity',      'Qty'],
                ['avgEntryPrice', 'Entry'],
                ['avgExitPrice',  'Exit'],
                ['fees',          'Fees'],
                ['netPnL',        'Net P&L'],
              ] as [SortKey, string][]).map(([col, label]) => (
                <th
                  key={col}
                  className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer select-none whitespace-nowrap"
                  onClick={() => handleSort(col)}
                >
                  <div className="flex items-center gap-1">
                    {label}
                    <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
                  </div>
                </th>
              ))}
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Broker
              </th>
            </tr>
          </thead>
          <tbody>
            {pageSlice.map((trade, i) => {
              const isWin  = trade.netPnL > 0;
              const isLoss = trade.netPnL < 0;
              return (
                <tr
                  key={trade.id}
                  data-testid={`trade-row-${i}`}
                  className={cn(
                    'border-b border-border/50 hover:bg-muted/20 transition-colors',
                    i % 2 === 0 ? '' : 'bg-muted/5'
                  )}
                >
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap tabular-nums">
                    {trade.openDateTime.slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="px-3 py-2 font-semibold text-foreground">{trade.symbol}</td>
                  <td className="px-3 py-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs px-1.5 py-0',
                        trade.side === 'long'
                          ? 'border-blue-500/30 text-blue-600 dark:text-blue-400'
                          : 'border-orange-500/30 text-orange-600 dark:text-orange-400'
                      )}
                    >
                      {trade.side}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{trade.quantity}</td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {trade.avgEntryPrice > 0 ? formatCurrency(trade.avgEntryPrice) : '—'}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {trade.avgExitPrice > 0 ? formatCurrency(trade.avgExitPrice) : '—'}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground text-xs">
                    {formatCurrency(trade.fees)}
                  </td>
                  <td className={cn(
                    'px-3 py-2 font-bold tabular-nums',
                    isWin ? 'text-green-600 dark:text-green-400' : isLoss ? 'text-red-500 dark:text-red-400' : 'text-muted-foreground'
                  )}>
                    {formatCurrency(trade.netPnL, true)}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground uppercase">{trade.broker}</td>
                </tr>
              );
            })}
            {pageSlice.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-sm text-muted-foreground">
                  No trades match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground text-xs">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              data-testid="page-prev"
            >
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              data-testid="page-next"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
