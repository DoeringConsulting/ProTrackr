import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPassword() {
  const [mandant, setMandant] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, navigate] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mandant, email }),
      });
      const data = await res.json();
      if (!res.ok) {
        const messageParts: string[] = [data.error ?? "Anfrage fehlgeschlagen"];
        if (typeof data.reason === "string" && data.reason.trim().length > 0) {
          messageParts.push(data.reason);
        }
        if (typeof data.code === "string" && data.code.trim().length > 0) {
          messageParts.push(`Code: ${data.code}`);
        }
        if (typeof data.detail === "string" && data.detail.trim().length > 0) {
          messageParts.push(data.detail);
        }
        toast.error(messageParts.join(" | "));
        return;
      }
      toast.success(
        data.message ??
          "Wenn ein Konto existiert, wurde ein Link zum Zuruecksetzen versendet."
      );
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
          <CardTitle className="text-2xl">Passwort vergessen</CardTitle>
          <CardDescription>
            Wir senden Ihnen einen Link zum Zuruecksetzen per E-Mail
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mandant">Mandant</Label>
              <Input
                id="mandant"
                value={mandant}
                onChange={(e) => setMandant(e.target.value)}
                placeholder="Mandanten-Nr. oder Name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ihre@email.de"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Sende Link..." : "Reset-Link senden"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => navigate("/login")}
            >
              Zurueck zum Login
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

