import { useState, ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import {
  LayoutDashboard, LineChart, FileBarChart2,
  Upload, Menu, X, Sun, Moon, TrendingUp
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useJournal } from '../context/JournalContext';
import { formatCurrency } from '../lib/utils/parsing';
import { computeOverallStats } from '../lib/analytics';

const NAV_ITEMS = [
  { href: '/',        label: 'Dashboard', icon: LayoutDashboard },
  { href: '/trades',  label: 'Trades',    icon: LineChart },
  { href: '/reports', label: 'Reports',   icon: FileBarChart2 },
  { href: '/import',  label: 'Import / Backup', icon: Upload },
];

function useDarkMode() {
  const [dark, setDark] = useState<boolean>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
  };

  // Set initial class
  useState(() => {
    document.documentElement.classList.toggle('dark', dark);
  });

  return { dark, toggle };
}

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { dark, toggle } = useDarkMode();
  const { trades } = useJournal();

  const stats = computeOverallStats(trades);
  const pnlColor = stats.totalNetPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400';

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          'flex flex-col border-r border-border bg-card transition-all duration-200 z-20',
          sidebarOpen ? 'w-56' : 'w-14'
        )}
        data-testid="sidebar"
      >
        {/* Logo / header */}
        <div className="flex items-center gap-2 px-3 py-4 border-b border-border min-h-[56px]">
          {/* SVG Logo */}
          <svg
            aria-label="Trading Journal Logo"
            viewBox="0 0 32 32"
            fill="none"
            className="w-7 h-7 shrink-0"
          >
            <rect width="32" height="32" rx="7" fill="currentColor" className="text-primary" />
            <polyline
              points="5,22 11,14 17,18 23,9 27,12"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <circle cx="27" cy="12" r="2" fill="white" />
          </svg>
          {sidebarOpen && (
            <span className="font-bold text-sm tracking-tight truncate text-foreground">
              TradeJournal
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-2 overflow-y-auto" role="navigation">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = location === href || (href !== '/' && location.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                data-testid={`nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 mx-2 my-0.5 rounded-md text-sm transition-colors cursor-pointer',
                  active
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {sidebarOpen && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom: P&L summary + controls */}
        {sidebarOpen && trades.length > 0 && (
          <div className="px-3 py-3 border-t border-border">
            <div className="text-xs text-muted-foreground mb-1">Total P&L</div>
            <div className={cn('text-base font-bold tabular-nums', pnlColor)}>
              {formatCurrency(stats.totalNetPnL, true)}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {stats.winRate.toFixed(0)}% win · {trades.length} trades
            </div>
          </div>
        )}

        {/* Theme + collapse toggle */}
        <div className="flex items-center justify-between px-3 py-2 border-t border-border">
          <button
            onClick={toggle}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground transition-colors"
            aria-label="Toggle theme"
            data-testid="theme-toggle"
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setSidebarOpen(s => !s)}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground transition-colors"
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            data-testid="sidebar-toggle"
          >
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden" data-testid="main-content">
        {children}
      </main>
    </div>
  );
}
