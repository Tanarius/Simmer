import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { CopilotPanel } from "@/components/CopilotPanel";
import { ThemeToggle } from "@/components/theme-toggle";
import { useTheme } from "@/hooks/use-theme";
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
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
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

  // Join page is always accessible regardless of auth or loading state
  if (location.startsWith("/join/")) return <JoinPage />;

  if (isLoading || (onboardingLoading && user && user.status !== 401 && Object.keys(user).length > 0)) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!user || user.status === 401 || Object.keys(user).length === 0) {
    return <AuthPage />;
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

function AppLayout() {
  // Initialize theme on mount
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
            <header className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-border bg-background shrink-0 h-12">
              <SidebarTrigger data-testid="button-sidebar-toggle" className="h-9 w-9" />
              <ThemeToggle />
            </header>
            <main className="flex-1 overflow-auto">
              <AppRouter />
            </main>
          </div>
        </div>
        <CopilotPanel />
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
