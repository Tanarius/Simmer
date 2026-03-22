import { ChefHat, Calendar, ShoppingCart, Package } from "lucide-react";
import { Link, useLocation } from "wouter";
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
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Recipes", url: "/", icon: ChefHat },
  { title: "Weekly Plan", url: "/planner", icon: Calendar },
  { title: "Shopping List", url: "/shopping", icon: ShoppingCart },
  { title: "Pantry", url: "/pantry", icon: Package },
];

export function AppSidebar() {
  const [location] = useLocation();

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
            <span className="text-base font-semibold text-sidebar-foreground">MealPrep</span>
            <span className="text-xs text-muted-foreground">3 roommates</span>
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
                      <Link href={item.url}>
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
      </SidebarContent>

      <SidebarFooter className="px-4 py-3 border-t border-sidebar-border">
        <a
          href="https://www.perplexity.ai/computer"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Created with Perplexity Computer
        </a>
      </SidebarFooter>
    </Sidebar>
  );
}
