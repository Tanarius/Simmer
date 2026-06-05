import React from "react";
import { AlertTriangle } from "lucide-react";

interface State {
  hasError: boolean;
  message?: string;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, State> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-background">
          <div className="max-w-sm mx-4 text-center space-y-4">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-[#C96A3A] text-white font-bold text-2xl mx-auto select-none">
              S
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Simmer hit a snag</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Refresh the page to get back on track.
              </p>
            </div>
            {process.env.NODE_ENV !== "production" && this.state.message && (
              <p className="text-xs font-mono text-muted-foreground bg-muted rounded p-3 text-left">
                {this.state.message}
              </p>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 text-sm font-semibold bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
            >
              Refresh
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
