import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function Login() {
  const [mandant, setMandant] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, navigate] = useLocation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mandant, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Login fehlgeschlagen");
        return;
      }
      toast.success(`Willkommen, ${data.user.displayName ?? data.user.email}!`);
      navigate("/");
    } catch (err) {
      toast.error("Verbindungsfehler – bitte versuchen Sie es erneut");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2">
            <img
              src="/assets/doering-consulting-logo.svg"
              alt="Döring Consulting"
              className="h-12 w-auto object-contain mx-auto"
            />
          </div>
          <CardTitle className="text-2xl">Döring Consulting</CardTitle>
          <CardDescription>Projekt & Abrechnungsmanagement</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mandant">Mandant</Label>
              <Input
                id="mandant"
                type="text"
                placeholder="Mandanten-Nr. oder Name"
                value={mandant}
                onChange={(e) => setMandant(e.target.value)}
                required
                autoComplete="organization"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="ihre@email.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Anmelden..." : "Anmelden"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => navigate("/forgot-password")}
            >
              Passwort vergessen?
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
