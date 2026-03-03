import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);

  const token = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("token") || "";
  }, []);

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setIsTokenValid(false);
        setIsChecking(false);
        return;
      }

      try {
        const res = await fetch("/api/auth/verify-reset-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        setIsTokenValid(Boolean(data.valid));
      } catch {
        setIsTokenValid(false);
      } finally {
        setIsChecking(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast.error("Passwort muss mindestens 8 Zeichen haben");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwoerter stimmen nicht ueberein");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Passwort konnte nicht zurueckgesetzt werden");
        return;
      }

      toast.success("Passwort erfolgreich gesetzt. Bitte melden Sie sich an.");
      navigate("/login");
    } catch {
      toast.error("Verbindungsfehler - bitte erneut versuchen");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Neues Passwort</CardTitle>
          <CardDescription>Setzen Sie ein neues Passwort fuer Ihr Konto</CardDescription>
        </CardHeader>
        <CardContent>
          {isChecking ? (
            <p className="text-sm text-muted-foreground text-center">Pruefe Reset-Link...</p>
          ) : !isTokenValid ? (
            <div className="space-y-4">
              <p className="text-sm text-red-600 text-center">
                Der Reset-Link ist ungueltig oder abgelaufen.
              </p>
              <Button className="w-full" onClick={() => navigate("/forgot-password")}>
                Neuen Link anfordern
              </Button>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Neues Passwort</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Passwort bestaetigen</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Speichere..." : "Passwort setzen"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

