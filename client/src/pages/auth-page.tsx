import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Loader2 } from "lucide-react";

type Mode = "login" | "register" | "forgot";

export default function AuthPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [mode, setMode] = useState<Mode>("login");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const authMutation = useMutation({
    mutationFn: async () => {
      const endpoint = mode === "login" ? "/api/login" : "/api/register";
      const body: any = { username, password };
      if (mode === "register" && inviteCode) body.inviteCode = inviteCode;
      if (mode === "register" && email) body.email = email;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        try { throw new Error(JSON.parse(text).error); } catch { throw new Error(text); }
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/user"], data);
      toast({ title: mode === "login" ? "Welcome back!" : "Account created!", duration: 2500 });
      setLocation("/");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const forgotMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim().toLowerCase() }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      return res.json();
    },
    onSuccess: () => setForgotSent(true),
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  // ── Forgot password ──────────────────────────────────────────────
  if (mode === "forgot") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-sm">
          {forgotSent ? (
            <>
              <CardHeader className="text-center">
                <CheckCircle2 className="h-9 w-9 text-green-500 mx-auto mb-2" />
                <CardTitle>Check your email</CardTitle>
                <CardDescription>
                  If an account exists for <strong>{forgotEmail}</strong>, a reset link is on its way. Check your spam folder too.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full" onClick={() => { setMode("login"); setForgotSent(false); }}>
                  Back to login
                </Button>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle>Forgot password?</CardTitle>
                <CardDescription>Enter your email and we'll send a reset link.</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={e => { e.preventDefault(); forgotMutation.mutate(); }}>
                  <div className="space-y-2">
                    <Label>Email address</Label>
                    <Input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required placeholder="you@example.com" autoFocus />
                  </div>
                  <Button type="submit" className="w-full" disabled={forgotMutation.isPending}>
                    {forgotMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Send reset link
                  </Button>
                </form>
              </CardContent>
              <CardFooter>
                <Button variant="ghost" className="w-full" onClick={() => setMode("login")}>← Back to login</Button>
              </CardFooter>
            </>
          )}
        </Card>
      </div>
    );
  }

  // ── Login / Register ─────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{mode === "login" ? "Welcome back" : "Create account"}</CardTitle>
          <CardDescription>
            {mode === "login" ? "Sign in to your MealPrep account" : "Join MealPrep and start planning"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={e => { e.preventDefault(); authMutation.mutate(); }}>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={username} onChange={e => setUsername(e.target.value)} required autoComplete="username" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {mode === "login" && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setMode("forgot")}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required autoComplete={mode === "login" ? "current-password" : "new-password"} />
            </div>
            {mode === "register" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
                  <p className="text-[11px] text-muted-foreground">Used for password reset — required</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite">Invite code <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input
                    id="invite"
                    placeholder="Join an existing home"
                    value={inviteCode}
                    onChange={e => setInviteCode(e.target.value.toUpperCase())}
                    maxLength={16}
                  />
                  <p className="text-[11px] text-muted-foreground">Leave blank to create a new home</p>
                </div>
              </>
            )}
            <Button type="submit" className="w-full" disabled={authMutation.isPending}>
              {authMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                : null}
              {mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <Button variant="ghost" className="w-full" onClick={() => setMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? "Don't have an account? Register" : "Already have an account? Sign in"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
