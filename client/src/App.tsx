import React from "react";
import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTheme } from "@/hooks/use-theme";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { UpgradeBanner } from "@/components/UpgradeBanner";
import NotFound from "@/pages/not-found";
import RecipesPage from "@/pages/recipes";
import PlannerPage from "@/pages/planner";
import ShoppingPage from "@/pages/shopping";
import PantryPage from "@/pages/pantry";
import ProfilePage from "@/pages/profile";
import AuthPage from "@/pages/auth-page";
import JoinPage from "@/pages/join";
import PricingPage from "@/pages/pricing";
import OnboardingPage from "@/pages/onboarding";
import ResetPasswordPage from "@/pages/reset-password";
import LandingPage from "@/pages/landing";
import TermsPage from "@/pages/terms";
import PrivacyPage from "@/pages/privacy";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { Loader2 } from "lucide-react";

function AppRouter() {
  const [location] = useLocation();
  const { data: user, isLoading } = useQuery<any>({
    queryKey: ["/api/user"],
    retry: false,
  });

  const { data: onboarding, isLoading: onboardingLoading } = useQuery<{ completed: boolean }>({
    queryKey: ["/api/onboarding/state"],
    enabled: !!user && user.status !== 401 && Object.keys(user).length > 0,
  });

  // Always-public pages (no auth required)
  if (location.startsWith("/join/")) return <JoinPage />;
  if (location.startsWith("/reset-password")) return <ResetPasswordPage />;
  if (location === "/terms") return <TermsPage />;
  if (location === "/privacy") return <PrivacyPage />;

  if (isLoading || (onboardingLoading && user && user.status !== 401 && Object.keys(user).length > 0)) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  // Unauthenticated: show landing page at "/" and auth page at "/auth"
  if (!user || user.status === 401 || Object.keys(user).length === 0) {
    if (location === "/auth") return <AuthPage />;
    return <LandingPage />;
  }

  if (onboarding && !onboarding.completed) {
    return <OnboardingPage />;
  }

  return (
    <Switch>
      <Route path="/" component={RecipesPage} />
      <Route path="/planner" component={PlannerPage} />
      <Route path="/shopping" component={ShoppingPage} />
      <Route path="/pantry" component={PantryPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/join/:code" component={JoinPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function NoEmailBanner() {
  const { data: user } = useQuery<any>({ queryKey: ["/api/user"], staleTime: 60_000 });
  const [dismissed, setDismissed] = React.useState(false);
  if (!user || user.email || dismissed) return null;
  return (
    <div className="flex items-center justify-between gap-2 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs">
      <span className="text-amber-700 dark:text-amber-400">
        ⚠️ Add an email address to enable password reset.
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <Link href="/profile" className="underline text-amber-700 dark:text-amber-400 font-medium">Add email</Link>
        <button onClick={() => setDismissed(true)} className="text-amber-600 hover:text-amber-800 dark:hover:text-amber-200 ml-1">✕</button>
      </div>
    </div>
  );
}

function AppLayout() {
  useTheme();

  const sidebarStyle = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3.5rem",
  };

  return (
    <Router hook={useHashLocation}>
      <SidebarProvider style={sidebarStyle as React.CSSProperties}>
        <div className="flex h-screen w-full overflow-hidden">
          <AppSidebar />
          <div className="flex flex-col flex-1 min-w-0">
            <header className="flex flex-col shrink-0">
              <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-border bg-background h-12">
                <SidebarTrigger data-testid="button-sidebar-toggle" className="h-9 w-9" />
                <ThemeToggle />
              </div>
              <NoEmailBanner />
              <UpgradeBanner />
            </header>
            <main className="flex-1 overflow-auto">
              <ErrorBoundary>
                <AppRouter />
              </ErrorBoundary>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </Router>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppLayout />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
