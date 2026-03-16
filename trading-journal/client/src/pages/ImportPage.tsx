import { useState, useRef, useCallback } from 'react';
import { Upload, Download, FileJson, Trash2, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { useJournal } from '../context/JournalContext';
import { importCSV, mergeTradesDedup } from '../lib/csvImport';
import { importFromJSON } from '../lib/persistence';
import { Broker } from '../types';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';

type BrokerOption = Broker | 'auto';

interface ImportStatus {
  type: 'success' | 'error' | 'warning' | 'info';
  messages: string[];
}

export function ImportPage() {
  const { trades, addTrades, replaceTrades, clearAllData, exportJSON, restoreFromJSON, lastImport } = useJournal();

  const [broker, setBroker] = useState<BrokerOption>('auto');
  const [status, setStatus] = useState<ImportStatus | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mergeMode, setMergeMode] = useState<'merge' | 'replace'>('merge');
  const [importingCSV, setImportingCSV] = useState(false);
  const [importingJSON, setImportingJSON] = useState(false);

  const csvRef  = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);

  const handleCSVFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      setStatus({ type: 'error', messages: ['Please select a .csv file.'] });
      return;
    }
    setImportingCSV(true);
    setStatus(null);

    try {
      const text = await file.text();
      const result = importCSV(text, broker);

      if (result.errors.length > 0 && result.trades.length === 0) {
        setStatus({ type: 'error', messages: result.errors });
        return;
      }

      const messages: string[] = [];
      if (result.warnings.length > 0) messages.push(...result.warnings);
      if (result.errors.length > 0) messages.push(`${result.errors.length} rows skipped due to errors.`);

      if (mergeMode === 'merge') {
        const { merged, addedCount, skippedCount } = mergeTradesDedup(trades, result.trades);
        addTrades(result.trades.filter(t => !trades.some(e =>
          e.broker === t.broker && e.symbol === t.symbol &&
          e.openDateTime === t.openDateTime && e.closeDateTime === t.closeDateTime
        )));
        messages.unshift(`Imported ${addedCount} new trades (${skippedCount} duplicates skipped) from ${file.name}.`);
      } else {
        replaceTrades(result.trades);
        messages.unshift(`Replaced all data with ${result.trades.length} trades from ${file.name}.`);
      }

      setStatus({
        type: result.errors.length > 0 ? 'warning' : 'success',
        messages,
      });
    } catch (err) {
      setStatus({ type: 'error', messages: [`Failed to process file: ${String(err)}`] });
    } finally {
      setImportingCSV(false);
      if (csvRef.current) csvRef.current.value = '';
    }
  }, [broker, mergeMode, trades, addTrades, replaceTrades]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleCSVFile(file);
  }, [handleCSVFile]);

  const handleJSONImport = useCallback(async (file: File) => {
    if (!file.name.endsWith('.json')) {
      setStatus({ type: 'error', messages: ['Please select a .json file.'] });
      return;
    }
    setImportingJSON(true);
    setStatus(null);
    try {
      const state = await importFromJSON(file);
      restoreFromJSON(state);
      setStatus({ type: 'success', messages: [`Restored ${state.trades.length} trades from backup.`] });
    } catch (err) {
      setStatus({ type: 'error', messages: [String(err)] });
    } finally {
      setImportingJSON(false);
      if (jsonRef.current) jsonRef.current.value = '';
    }
  }, [restoreFromJSON]);

  return (
    <div className="p-6 space-y-8 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-foreground">Import / Backup</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Import trades from CSV or manage your JSON backup.
        </p>
      </div>

      {/* Status Banner */}
      {status && (
        <div
          className={cn(
            'rounded-lg border px-4 py-3 flex gap-3',
            status.type === 'success' && 'border-green-500/30 bg-green-500/10',
            status.type === 'error'   && 'border-red-500/30 bg-red-500/10',
            status.type === 'warning' && 'border-yellow-500/30 bg-yellow-500/10',
            status.type === 'info'    && 'border-blue-500/30 bg-blue-500/10',
          )}
          data-testid="import-status"
        >
          {status.type === 'success' && <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />}
          {status.type === 'error'   && <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />}
          {status.type === 'warning' && <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />}
          {status.type === 'info'    && <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />}
          <div className="flex flex-col gap-1">
            {status.messages.map((msg, i) => (
              <span key={i} className="text-sm">{msg}</span>
            ))}
          </div>
        </div>
      )}

      {/* CSV Import */}
      <section className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Upload className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Import CSV</h2>
        </div>

        {/* Broker selector */}
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">Broker</label>
          <div className="flex gap-2 flex-wrap">
            {(['auto', 'webull', 'ibkr'] as BrokerOption[]).map(b => (
              <button
                key={b}
                data-testid={`broker-${b}`}
                onClick={() => setBroker(b)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm border transition-colors',
                  broker === b
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:bg-muted'
                )}
              >
                {b === 'auto' ? 'Auto-detect' : b === 'ibkr' ? 'Interactive Brokers' : 'Webull'}
              </button>
            ))}
          </div>
        </div>

        {/* Merge mode */}
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">Import mode</label>
          <div className="flex gap-2">
            <button
              onClick={() => setMergeMode('merge')}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm border transition-colors',
                mergeMode === 'merge'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:bg-muted'
              )}
              data-testid="merge-mode-merge"
            >
              Merge (keep existing)
            </button>
            <button
              onClick={() => setMergeMode('replace')}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm border transition-colors',
                mergeMode === 'replace'
                  ? 'bg-destructive text-destructive-foreground border-destructive'
                  : 'border-border text-muted-foreground hover:bg-muted'
              )}
              data-testid="merge-mode-replace"
            >
              Replace all
            </button>
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => csvRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50 hover:bg-muted/30'
          )}
          data-testid="csv-drop-zone"
        >
          <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">
            {importingCSV ? 'Processing...' : 'Drop CSV here or click to browse'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Supports Webull and Interactive Brokers CSV exports</p>
          <input
            ref={csvRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleCSVFile(e.target.files[0])}
            data-testid="csv-file-input"
          />
        </div>

        {/* Expected columns info */}
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground transition-colors py-1">
            Expected column names
          </summary>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
            <div>
              <div className="font-semibold text-foreground mb-1">Webull</div>
              <code className="block text-xs leading-relaxed opacity-70">
                Symbol, Trade Date, Action, Quantity, Price, Amount, Commission, Fees
              </code>
            </div>
            <div>
              <div className="font-semibold text-foreground mb-1">Interactive Brokers</div>
              <code className="block text-xs leading-relaxed opacity-70">
                TradeDate, TradeTime, Symbol, Quantity, T. Price, Comm/Fee, Proceeds
              </code>
              <p className="mt-1 opacity-60">Activity Statement (Trades section) also supported.</p>
            </div>
          </div>
        </details>
      </section>

      {/* JSON Backup */}
      <section className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <FileJson className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">JSON Backup</h2>
        </div>

        <p className="text-sm text-muted-foreground">
          Export your full journal as a JSON file for backups or to move data between devices.
          All data stays in your browser — no server involved.
        </p>

        {lastImport && (
          <p className="text-xs text-muted-foreground">
            Last import: {new Date(lastImport).toLocaleString()}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <Button
            onClick={exportJSON}
            disabled={trades.length === 0}
            className="gap-2"
            data-testid="export-json-btn"
          >
            <Download className="w-4 h-4" />
            Export Journal ({trades.length} trades)
          </Button>

          <Button
            variant="outline"
            onClick={() => jsonRef.current?.click()}
            disabled={importingJSON}
            className="gap-2"
            data-testid="import-json-btn"
          >
            <Upload className="w-4 h-4" />
            {importingJSON ? 'Restoring...' : 'Import Backup'}
          </Button>

          <input
            ref={jsonRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleJSONImport(e.target.files[0])}
            data-testid="json-file-input"
          />
        </div>
      </section>

      {/* Danger Zone */}
      <section className="rounded-lg border border-red-500/20 bg-red-500/5 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Trash2 className="w-4 h-4 text-red-500" />
          <h2 className="text-sm font-semibold text-red-600 dark:text-red-400">Danger Zone</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Permanently delete all journal data. This cannot be undone. Export a JSON backup first.
        </p>
        <Button
          variant="destructive"
          size="sm"
          disabled={trades.length === 0}
          onClick={() => {
            if (confirm('Delete ALL journal data? This cannot be undone.')) {
              clearAllData();
              setStatus({ type: 'info', messages: ['All data cleared.'] });
            }
          }}
          className="gap-2"
          data-testid="clear-data-btn"
        >
          <Trash2 className="w-4 h-4" />
          Clear All Data
        </Button>
      </section>
    </div>
  );
}
