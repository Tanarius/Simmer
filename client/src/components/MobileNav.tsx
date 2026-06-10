import { createPortal } from "react-dom";
import { useState, useEffect } from "react";
import { Home, ChefHat, Calendar, ShoppingCart, User } from "lucide-react";
import { Link, useLocation } from "wouter";

const NAV_ITEMS = [
  { title: "Home",    href: "/",         Icon: Home },
  { title: "Recipes", href: "/recipes",  Icon: ChefHat },
  { title: "Plan",    href: "/planner",  Icon: Calendar },
  { title: "List",    href: "/shopping", Icon: ShoppingCart },
  { title: "Profile", href: "/profile",  Icon: User },
];

export function MobileNav() {
  const [location] = useLocation();
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 1024 : true
  );
  const [dims, setDims] = useState(() =>
    typeof window !== "undefined"
      ? `${window.innerWidth}x${window.innerHeight}`
      : "?"
  );

  useEffect(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    console.log("[MobileNav] mounted — width:", w, "height:", h, "isMobile:", w < 1024);
    document.title = `Nav ${w}px`;

    const check = () => {
      setIsMobile(window.innerWidth < 1024);
      setDims(`${window.innerWidth}x${window.innerHeight}`);
    };
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("resize", check);
      console.log("[MobileNav] unmounted");
    };
  }, []);

  // DIAGNOSTIC: always-visible viewport badge so we can see mount + reported size
  // Remove after confirming nav shows on device
  const diagnosticBadge = (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 999999,
        background: "red",
        color: "white",
        padding: "4px 8px",
        fontSize: "12px",
        fontFamily: "monospace",
        pointerEvents: "none",
      }}
    >
      {dims} {isMobile ? "📱" : "🖥️"}
    </div>
  );

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

  // Always render diagnostic badge; nav only when isMobile
  return createPortal(
    <>
      {diagnosticBadge}
      {isMobile && nav}
    </>,
    document.body
  );
}
