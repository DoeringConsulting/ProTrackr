import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [devToken, setDevToken] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/request-reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Fehler beim Anfordern des Passwort-Resets");
        setIsLoading(false);
        return;
      }

      setSuccess(true);
      if (data._devToken) {
        setDevToken(data._devToken);
      }
      setIsLoading(false);
    } catch (err) {
      setError("Verbindungsfehler. Bitte versuchen Sie es erneut.");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Passwort zurücksetzen</CardTitle>
          <CardDescription>
            Geben Sie Ihre E-Mail-Adresse ein, um einen Passwort-Reset-Link zu erhalten
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Wenn die E-Mail-Adresse existiert, wurde eine Passwort-Reset-E-Mail gesendet.
                  {devToken && (
                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                      <strong>Entwicklungsmodus:</strong> Token: {devToken}
                      <br />
                      <Link href={`/reset-password?token=${devToken}`} className="text-primary hover:underline">
                        Direkt zum Reset-Formular
                      </Link>
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="ihre@email.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Senden...
                </>
              ) : (
                "Reset-Link anfordern"
              )}
            </Button>
            <div className="text-sm text-center text-muted-foreground">
              <Link href="/login" className="text-primary hover:underline">
                Zurück zur Anmeldung
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
