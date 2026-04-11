import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Home, Users, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function JoinPage() {
  const [location] = useLocation();
  // Works whether rendered as a <Route> or directly — parse from path
  const code = (location.split("/join/")[1] ?? "").toUpperCase();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Auth state
  const { data: user } = useQuery<any>({ queryKey: ["/api/user"], retry: false });
  const isLoggedIn = !!(user && Object.keys(user).length > 0 && user.status !== 401);

  // Preview the household
  const { data: preview, isLoading, error } = useQuery<{ id: number; name: string; memberCount: number }>({
    queryKey: ["/api/household/preview", code],
    queryFn: () => fetch(`/api/household/preview/${code}`).then(r => {
      if (!r.ok) throw new Error("invalid");
      return r.json();
    }),
    enabled: !!code,
    retry: false,
  });

  // Join mutation (for logged-in users)
  const joinMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/household/join", { inviteCode: code }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/household"] });
      toast({ title: `Joined ${preview?.name}!` });
      setLocation("/");
    },
    onError: () => toast({ title: "Failed to join", variant: "destructive" }),
  });

  // Register + join (for unauthenticated users)
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const registerMutation = useMutation({
    mutationFn: () =>
      fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, inviteCode: code }),
      }).then(async r => {
        if (!r.ok) throw new Error(await r.text());
        return r.json();
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/user"], data);
      queryClient.invalidateQueries({ queryKey: ["/api/household"] });
      toast({ title: `Welcome to ${preview?.name}!` });
      setLocation("/");
    },
    onError: (err: any) => toast({ title: "Registration failed", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3 max-w-sm px-4">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <span className="text-2xl">🔗</span>
          </div>
          <h1 className="text-xl font-semibold">Invalid invite link</h1>
          <p className="text-sm text-muted-foreground">This invite code doesn't exist or may have been regenerated.</p>
          <Button variant="outline" onClick={() => setLocation("/")}>Go home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Home preview */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center mx-auto shadow-lg">
            <Home className="h-8 w-8 text-white" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">You've been invited to join</p>
            <h1 className="text-2xl font-bold text-foreground mt-1">{preview.name}</h1>
            <div className="flex items-center justify-center gap-1.5 mt-2 text-sm text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <span>{preview.memberCount} {preview.memberCount === 1 ? "member" : "members"}</span>
            </div>
          </div>
        </div>

        {/* Action card */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          {isLoggedIn ? (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground text-center">
                Joining will move you from your current home to <strong>{preview.name}</strong>. Your account stays the same.
              </div>
              <Button
                className="w-full"
                onClick={() => joinMutation.mutate()}
                disabled={joinMutation.isPending}
              >
                {joinMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Join {preview.name}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setLocation("/")}>
                Cancel
              </Button>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={e => { e.preventDefault(); registerMutation.mutate(); }}
            >
              <div className="text-center mb-2">
                <h2 className="text-base font-semibold">Create an account to join</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Already have one? <button type="button" className="text-primary underline" onClick={() => setLocation("/auth")}>Log in</button> then open this link again.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" value={username} onChange={e => setUsername(e.target.value)} required autoFocus />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
                {registerMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogIn className="h-4 w-4 mr-2" />}
                Create account & join {preview.name}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
