import { Router, Route, Switch } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { JournalProvider } from './context/JournalContext';
import { AppLayout } from './components/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { TradesPage } from './pages/TradesPage';
import { ReportsPage } from './pages/ReportsPage';
import { ImportPage } from './pages/ImportPage';
import { Toaster } from './components/ui/toaster';

export default function App() {
  return (
    <JournalProvider>
      <Router hook={useHashLocation}>
        <AppLayout>
          <Switch>
            <Route path="/" component={DashboardPage} />
            <Route path="/trades" component={TradesPage} />
            <Route path="/reports" component={ReportsPage} />
            <Route path="/import" component={ImportPage} />
            <Route>
              <div className="flex flex-col items-center justify-center h-full">
                <p className="text-muted-foreground text-lg">Page not found</p>
              </div>
            </Route>
          </Switch>
        </AppLayout>
      </Router>
      <Toaster />
    </JournalProvider>
  );
}
