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
            <div className="flex items-center justify-center gap-3">
              <AlertTriangle className="h-8 w-8 text-amber-400" />
              <h1 className="text-xl font-bold text-foreground">Something went wrong</h1>
            </div>
            {process.env.NODE_ENV !== "production" && this.state.message && (
              <p className="text-xs font-mono text-muted-foreground bg-muted rounded p-3 text-left">
                {this.state.message}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              The page crashed unexpectedly. Try reloading.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
