import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function AuthPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  // Redirect is handled by App.tsx wrapper

  const loginMutation = useMutation({
    mutationFn: async () => {
      const endpoint = isLogin ? "/api/login" : "/api/register";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/user"], data);
      toast({ title: isLogin ? "Logged in successfully" : "Registered successfully" });
      setLocation("/");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <Card className="w-[350px]">
        <CardHeader>
          <CardTitle>{isLogin ? "Login" : "Register"} to MealPrep</CardTitle>
          <CardDescription>
            {isLogin ? "Welcome back!" : "Create an account to get started."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); loginMutation.mutate(); }}>
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={username} onChange={e => setUsername(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "Please wait..." : (isLogin ? "Login" : "Register")}
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <Button variant="ghost" className="w-full" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? "Need an account? Register" : "Already have an account? Login"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
