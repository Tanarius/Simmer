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
import NotFound from "@/pages/not-found";
import RecipesPage from "@/pages/recipes";
import PlannerPage from "@/pages/planner";
import ShoppingPage from "@/pages/shopping";
import PantryPage from "@/pages/pantry";
import AuthPage from "@/pages/auth-page";
import PricingPage from "@/pages/pricing";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

function AppRouter() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/user"],
    retry: false,
  });

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!user || user.status === 401 || Object.keys(user).length === 0) {
    return <AuthPage />;
  }

  return (
    <Switch>
      <Route path="/" component={RecipesPage} />
      <Route path="/planner" component={PlannerPage} />
      <Route path="/shopping" component={ShoppingPage} />
      <Route path="/pantry" component={PantryPage} />
      <Route path="/pricing" component={PricingPage} />
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
            <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-background shrink-0 h-12">
              <SidebarTrigger data-testid="button-sidebar-toggle" className="h-9 w-9" />
              <ThemeToggle />
            </header>
            <main className="flex-1 overflow-auto">
              <AppRouter />
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
