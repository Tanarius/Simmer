import { ChefHat, Calendar, ShoppingCart, Package, Sparkles, LogOut, Cookie, Home } from "lucide-react";
import { ActivityFeed } from "@/components/ActivityFeed";
import { Link, useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Home", url: "/", icon: Home },
  { title: "Recipes", url: "/recipes", icon: ChefHat },
  { title: "Weekly Plan", url: "/planner", icon: Calendar },
  { title: "Shopping List", url: "/shopping", icon: ShoppingCart },
  { title: "Snacks & Products", url: "/snacks", icon: Cookie },
  { title: "Pantry", url: "/pantry", icon: Package },
];

export function AppSidebar() {
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const { isMobile, setOpenMobile } = useSidebar();

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/logout").then(() => {}),
    onSuccess: () => {
      queryClient.clear();
      window.location.href = "/auth";
    },
  });

  const { data: user } = useQuery<any>({
    queryKey: ["/api/user"],
    staleTime: 60_000,
  });

  const { data: household } = useQuery<{ name: string; inviteCode: string; members: { id: number; username: string }[] }>({
    queryKey: ["/api/household"],
    staleTime: 60_000,
    enabled: !!user,
  });

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-4">
        <Link href="/" className="flex items-center gap-2.5 no-underline">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground shrink-0">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="w-5 h-5"
              aria-label="MealPrep logo"
            >
              {/* Fork */}
              <path
                d="M5 2v6c0 1.1.9 2 2 2h0v12"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M5 2v4M7 2v4M5 6h2"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
              {/* Knife */}
              <path
                d="M19 2v20"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M19 2c0 0-3 3-3 7h3"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-base font-semibold text-sidebar-foreground">
              {household?.name ?? "MealPrep"}
            </span>
            <span className="text-xs text-muted-foreground">
              {household
                ? `${household.members.length} ${household.members.length === 1 ? "member" : "members"}`
                : "Your home"}
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  item.url === "/"
                    ? location === "/" || location === ""
                    : location.startsWith(item.url);

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      data-testid={`nav-${item.title.toLowerCase().replace(" ", "-")}`}
                    >
                      <Link href={item.url} onClick={() => isMobile && setOpenMobile(false)}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4">
          <SidebarGroupContent>
            <ActivityFeed />
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location === "/profile"}
                  className="bg-purple-600/10 text-purple-500 hover:bg-purple-600/20 hover:text-purple-600 transition-colors"
                >
                  <Link href="/profile">
                    <Sparkles className="h-4 w-4" />
                    <span className="font-medium">Profile & Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-4 py-3 border-t border-sidebar-border space-y-2">
        {user && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 bg-muted rounded-full px-2 py-0.5 font-mono tabular-nums">
              AI {user.aiCallsToday ?? 0}/{user.subscriptionTier === 'test' ? 50 : user.subscriptionTier === 'premium' ? '∞' : 5}
            </span>
            <span className="inline-flex items-center gap-1 bg-muted rounded-full px-2 py-0.5 font-mono tabular-nums">
              Chat {user.copilotCallsToday ?? 0}/{user.subscriptionTier === 'test' ? 50 : user.subscriptionTier === 'premium' ? '∞' : 20}
            </span>
          </div>
        )}
        <button
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
          data-testid="button-logout"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
