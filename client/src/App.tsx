import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DirectorySetup } from "./components/DirectorySetup";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { hasSelectedDirectory, isFileSystemAccessSupported } from "./lib/fileSystem";
import { useState, useEffect } from "react";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import TimeTracking from "./pages/TimeTracking";
import Expenses from "./pages/Expenses";
import Reports from "./pages/Reports";
import Import from "@/pages/Import";
import ExchangeRates from "@/pages/ExchangeRates";
import Backup from "./pages/Backup";
import Settings from "./pages/Settings";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/customers" component={Customers} />
      <Route path="/time-tracking" component={TimeTracking} />
      <Route path="/expenses" component={Expenses} />      <Route path={"/reports"} component={Reports} />
        <Route path="/import" component={Import} />
      <Route path="/exchange-rates" component={ExchangeRates} />
      <Route path={"/backup"} component={Backup} />      <Route path="/settings" component={Settings} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  const [showDirectorySetup, setShowDirectorySetup] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Check if directory setup is needed
    if (isFileSystemAccessSupported() && !hasSelectedDirectory()) {
      setShowDirectorySetup(true);
    } else {
      setIsReady(true);
    }
  }, []);

  const handleDirectorySetupComplete = () => {
    setShowDirectorySetup(false);
    setIsReady(true);
  };

  if (showDirectorySetup) {
    return (
      <ErrorBoundary>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <Toaster />
            <DirectorySetup onComplete={handleDirectorySetupComplete} />
          </TooltipProvider>
        </ThemeProvider>
      </ErrorBoundary>
    );
  }

  if (!isReady) {
    return null; // Loading state
  }

  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <OfflineIndicator />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
