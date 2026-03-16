# TradeJournal

A production-quality, fully client-side trading journal with analytics dashboard. Import trades from Webull and Interactive Brokers CSV exports, view performance metrics and charts, and store everything locally in your browser.

**No server. No account. No data leaves your device.**

---

## Features

| Category | Features |
|---|---|
| **Import** | Webull & IBKR CSV, auto-detection, merge or replace mode, error reporting |
| **Dashboard** | Net P&L, win rate, profit factor, avg trade, max drawdown, fees, equity curve, P&L by day/symbol |
| **Trades** | Sortable/filterable table with 50 trades/page; filter by date range, symbol, side, broker |
| **Reports** | Win/loss stats, P&L distribution histogram, day of week analysis, hour of day analysis, symbol breakdown, risk & drawdown section |
| **Persistence** | localStorage (survives refresh), JSON export/import for cross-device backups |
| **UX** | Dark / light mode, responsive layout, collapsible sidebar |

---

## Tech Stack

- **React 18** + **TypeScript** — component framework
- **Vite** — build tooling
- **Recharts** — all charting (lightweight, React-native)
- **PapaParse** — CSV parsing
- **Tailwind CSS v3** + **shadcn/ui** — styling
- **Wouter** (hash routing) — client-side routing compatible with GitHub Pages
- **localStorage** — primary persistence (no backend)

---

## Quick Start

### Prerequisites

- Node.js 18+ (LTS)
- npm 9+

### Install & Run

```bash
git clone https://github.com/YOUR_USERNAME/trading-journal.git
cd trading-journal
npm install
npm run dev
```

Open [http://localhost:5000](http://localhost:5000).

### Build for Production

```bash
npm run build
```

Output goes to `dist/public/` — these are the static files to deploy.

---

## GitHub Pages Deployment

### Option A: gh-pages npm package (recommended)

1. Install the package:
   ```bash
   npm install --save-dev gh-pages
   ```

2. Add to `package.json`:
   ```json
   "homepage": "https://YOUR_USERNAME.github.io/trading-journal",
   "scripts": {
     "predeploy": "npm run build",
     "deploy": "gh-pages -d dist/public"
   }
   ```

3. Deploy:
   ```bash
   npm run deploy
   ```

4. In your GitHub repo settings → Pages → set Source to `gh-pages` branch.

### Option B: GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  build-deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist/public
```

### Hash Routing Note

This app uses **hash-based routing** (`/#/`, `/#/trades`, etc.) which works natively on GitHub Pages with no 404 fallback configuration needed. Direct URL access works for all routes.

---

## CSV Import

### How It Works

1. Go to **Import / Backup**.
2. Select your broker (or use Auto-detect).
3. Choose **Merge** (add to existing data) or **Replace** (start fresh).
4. Drop or click to select your CSV file.

The app parses the CSV → creates `Execution` objects → groups them into `Trade` round-trips via FIFO matching → aggregates into daily `Session` objects.

### Webull

Export from: Webull Desktop → Orders → History → Export CSV

**Expected columns:**
```
Symbol, Trade Date, Action, Quantity, Price, Amount, Commission, Fees
```
Also accepts: `Ticker`, `Date`, `Time`, `Side`, `Qty`, `Avg Price`, `Net Amount`, `Comm`

Action values: `Buy`, `Sell`, `BUY`, `SELL`, `B`, `S`

### Interactive Brokers (IBKR)

Two export formats are supported:

**1. Flex Query (Trades section)**
```
TradeDate, TradeTime, Symbol, Quantity, T. Price, Comm/Fee, Proceeds
```

**2. Activity Statement (Trades section)**
The activity statement format includes section headers like `Trades,Header,...` and `Trades,Data,...`. The parser strips these automatically.

Export from: IBKR Client Portal → Reports → Activity → Download CSV

### Adding a New Broker

1. Create `client/src/lib/parsers/yourbroker.ts`
2. Implement `detectYourBroker(headers: string[]): boolean`
3. Implement `parseYourBrokerCSV(csvText: string): { executions: Execution[]; errors: string[] }`
4. Register in `client/src/lib/csvImport.ts`:
   - Import your functions
   - Add detection to `detectBroker()`
   - Add parsing to `importCSV()`
5. Add a broker option in `client/src/pages/ImportPage.tsx`

---

## Data Model

```typescript
// A single fill from the broker
interface Execution {
  id, broker, dateTime, symbol, quantity, price, proceeds, fees
}

// A round-trip trade (one open + one or more closes)
interface Trade {
  id, broker, symbol, side,        // 'long' | 'short'
  quantity, openDateTime, closeDateTime,
  avgEntryPrice, avgExitPrice,
  grossPnL, fees, netPnL,
  strategy, dayOfWeek, hourOfDay
}

// Daily aggregate
interface Session {
  date, trades, netPnL, grossPnL, fees, winCount, lossCount, tradeCount
}
```

---

## Analytics Formulas

| Metric | Formula |
|---|---|
| **Win Rate** | `winning trades / total trades × 100` |
| **Profit Factor** | `gross profit / |gross loss|` |
| **Expectancy** | `total net P&L / total trades` |
| **Max Drawdown** | Peak-to-trough decline in cumulative equity |
| **Max DD %** | `(trough - peak) / |peak| × 100` |
| **Std Dev** | Sample standard deviation of trade-level P&L |

---

## Persistence

- **localStorage key:** `trading_journal_v1`
- **Schema version:** `1` (migrations handled in `client/src/lib/persistence.ts`)
- **JSON export:** Includes all trades, sessions, and metadata (`appName`, `version`, `exportedAt`)
- **JSON import:** Validates `appName` and `trades` array before loading

To clear all data: Import / Backup → Danger Zone → Clear All Data.

---

## Project Structure

```
client/src/
├── types/          index.ts           — all TypeScript types
├── lib/
│   ├── parsers/    webull.ts, ibkr.ts — CSV parsers (easy to extend)
│   ├── utils/      parsing.ts         — shared parsing utilities
│   ├── normalize.ts                   — executions → trades → sessions
│   ├── analytics.ts                   — all metric computations
│   ├── csvImport.ts                   — import orchestrator + dedup
│   └── persistence.ts                 — localStorage + JSON backup
├── context/        JournalContext.tsx  — global state
├── components/     AppLayout, StatCard, EmptyState
└── pages/          Dashboard, Trades, Reports, Import
```

---

## Privacy

All data is stored in your browser's `localStorage`. Exporting creates a `.json` file on your machine. No data is ever sent to any server.

---

*Built with [Perplexity Computer](https://www.perplexity.ai/computer)*
