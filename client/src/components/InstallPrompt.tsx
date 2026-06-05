import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "simmer-install-dismissed";
const SHOW_DELAY_MS = 30_000;

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Never show if permanently dismissed
    if (localStorage.getItem(DISMISSED_KEY)) return;

    let timer: ReturnType<typeof setTimeout>;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      clearTimeout(timer);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
      setDeferred(null);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="banner"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: "#2A1F18",
        borderTop: "1px solid #3A2A20",
        padding: "14px 20px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        boxShadow: "0 -4px 32px rgba(0,0,0,0.4)",
      }}
    >
      {/* App icon */}
      <img
        src="/icons/icon-192.png"
        alt=""
        width={40}
        height={40}
        style={{ borderRadius: 10, flexShrink: 0 }}
      />

      {/* Copy */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: "#F5EDE3", margin: "0 0 2px" }}>
          Install Simmer
        </p>
        <p style={{ fontSize: 12, color: "#9A8A7A", margin: 0, lineHeight: 1.4 }}>
          Install Simmer on your home screen for the best experience
        </p>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button
          onClick={handleDismiss}
          style={{
            background: "none",
            border: "1px solid #3A2A20",
            color: "#9A8A7A",
            fontSize: 13,
            fontWeight: 600,
            padding: "8px 14px",
            borderRadius: 8,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Not now
        </button>
        <button
          onClick={handleInstall}
          style={{
            background: "#C96A3A",
            border: "none",
            color: "#F5EDE3",
            fontSize: 13,
            fontWeight: 700,
            padding: "8px 18px",
            borderRadius: 8,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Install
        </button>
      </div>
    </div>
  );
}
