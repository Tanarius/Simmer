import { createPortal } from "react-dom";
import { Home, ChefHat, Calendar, ShoppingCart, User } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";

const NAV_ITEMS = [
  { title: "Home",    href: "/",         Icon: Home },
  { title: "Recipes", href: "/recipes",  Icon: ChefHat },
  { title: "Plan",    href: "/planner",  Icon: Calendar },
  { title: "List",    href: "/shopping", Icon: ShoppingCart },
  { title: "Profile", href: "/profile",  Icon: User },
];

export function MobileNav() {
  const [location] = useLocation();
  // Gate on the SAME breakpoint as the sidebar (useIsMobile → 768px = Tailwind `md`).
  // The desktop sidebar renders at ≥ 768 (`hidden md:block`); below 768 it collapses to a
  // Sheet. Showing the bottom nav only when isMobile keeps exactly one of {sidebar, bottom
  // nav} visible at every width — no overlap band, so it can't cover the usage counters.
  const isMobile = useIsMobile();

  if (!isMobile) return null;

  const nav = (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 64,
        zIndex: 99999,
        background: "rgba(42, 31, 24, 0.97)",
        borderTop: "1px solid #3D2E24",
        display: "flex",
        flexDirection: "row",
        alignItems: "stretch",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      {NAV_ITEMS.map(({ title, href, Icon }) => {
        const isActive =
          href === "/" ? location === "/" || location === "" : location.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              color: isActive ? "#C96A3A" : "#9A8A7A",
              textDecoration: "none",
              minHeight: 44,
              fontSize: 10,
              fontWeight: isActive ? 600 : 400,
              background: "none",
              border: "none",
              cursor: "pointer",
              position: "relative",
            }}
          >
            {isActive && (
              <span
                style={{
                  position: "absolute",
                  top: 6,
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: "#C96A3A",
                }}
              />
            )}
            <Icon size={20} />
            <span>{title}</span>
          </Link>
        );
      })}
    </nav>
  );

  // Portal to body so the fixed bar isn't trapped by the app shell's overflow-hidden.
  return createPortal(nav, document.body);
}
