import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Loader2 } from "lucide-react";

export default function ResetPasswordPage() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const token = location.replace("/reset-password/", "").replace("/reset-password", "").trim();

  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDone(true);
    } catch (err: any) {
      toast({ title: "Reset failed", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        {done ? (
          <>
            <CardHeader className="text-center">
              <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
              <CardTitle>Password updated</CardTitle>
              <CardDescription>You can now log in with your new password.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => setLocation("/")}>Go to login</Button>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader>
              <CardTitle>Set new password</CardTitle>
              <CardDescription>Choose a strong password — at least 8 characters.</CardDescription>
            </CardHeader>
            <CardContent>
              {!token ? (
                <p className="text-sm text-destructive">Invalid reset link. Please request a new one.</p>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="np">New password</Label>
                    <Input id="np" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8} autoFocus />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cp">Confirm password</Label>
                    <Input id="cp" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8} />
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Set new password
                  </Button>
                </form>
              )}
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
