import { Link } from "wouter";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="w-full max-w-sm mx-4 text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <AlertCircle className="h-8 w-8 text-muted-foreground" />
          <h1 className="text-2xl font-bold text-foreground">Page not found</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <Link href="/" className="inline-block text-sm text-primary hover:underline">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
