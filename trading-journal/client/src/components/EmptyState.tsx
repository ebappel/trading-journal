import { Upload } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from './ui/button';

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4 text-center px-6">
      <div className="rounded-full bg-primary/10 p-4">
        <Upload className="w-8 h-8 text-primary" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-1">No trade data yet</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Import a CSV from Webull or Interactive Brokers to get started, or load a JSON backup.
        </p>
      </div>
      <Link href="/import">
        <Button asChild data-testid="empty-import-btn"><span>Import Trades</span></Button>
      </Link>
    </div>
  );
}
