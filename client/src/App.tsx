import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DirectorySetup } from "./components/DirectorySetup";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { hasSelectedDirectory, isFileSystemAccessSupported } from "./lib/fileSystem";
import { useState, useEffect } from "react";
import { useUpdateCheck, checkIfJustUpdated, getCurrentVersion } from "./hooks/useUpdateCheck";
import { UpdateBanner } from "./components/UpdateBanner";
import { ChangelogDialog } from "./components/ChangelogDialog";
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
import TaxSettings from "./pages/TaxSettings";
import Faq from "./pages/Faq";

import ProjectDetail from "./pages/ProjectDetail";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

function Router() {
  return (
    <Switch>

      {/* Auth routes - without DashboardLayout */}
      <Route path="/login" component={Login} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />

      {/* App routes - with DashboardLayout */}
      <Route path="/" component={Dashboard} />
      <Route path="/customers" component={Customers} />
      <Route path="/customers/:id" component={ProjectDetail} />
      <Route path="/time-tracking" component={TimeTracking} />
      <Route path="/expenses" component={Expenses} />
      <Route path="/reports" component={Reports} />
      <Route path="/import" component={Import} />
      <Route path="/exchange-rates" component={ExchangeRates} />
      <Route path="/backup" component={Backup} />
      <Route path="/settings" component={Settings} />
      <Route path="/tax-settings" component={TaxSettings} />
      <Route path="/faq" component={Faq} />
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
  const [showChangelog, setShowChangelog] = useState(false);
  const [changelogData, setChangelogData] = useState<any>(null);
  const { updateAvailable } = useUpdateCheck();

  useEffect(() => {
    // Check if user has seen the info screen
    const hasSeenInfo = localStorage.getItem('hasSeenDownloadInfo');
    if (!hasSeenInfo) {
      setShowDirectorySetup(true);
    } else {
      setIsReady(true);
    }

    // Check if app just updated and show changelog
    if (checkIfJustUpdated()) {
      fetch('/CHANGELOG.json')
        .then(res => res.json())
        .then(data => {
          const currentVersion = getCurrentVersion();
          const versionData = data.versions.find((v: any) => v.version === currentVersion);
          if (versionData) {
            setChangelogData(versionData);
            setShowChangelog(true);
          }
        })
        .catch(err => console.error('Failed to load changelog:', err));
    }
  }, []);

  const handleDirectorySetupComplete = () => {
    localStorage.setItem('hasSeenDownloadInfo', 'true');
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
          {updateAvailable && <UpdateBanner />}
          {changelogData && (
            <ChangelogDialog
              open={showChangelog}
              onOpenChange={setShowChangelog}
              version={changelogData}
            />
          )}
          <OfflineIndicator />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
