import { useState, useEffect } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle } from "lucide-react";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Extract token from URL query parameters
    const params = new URLSearchParams(searchParams);
    const tokenParam = params.get("token");
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      setError("Kein Reset-Token gefunden. Bitte fordern Sie einen neuen Link an.");
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError("Passwörter stimmen nicht überein");
      return;
    }

    // Validate password length
    if (newPassword.length < 8) {
      setError("Passwort muss mindestens 8 Zeichen lang sein");
      return;
    }

    if (!token) {
      setError("Kein Reset-Token gefunden");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Fehler beim Zurücksetzen des Passworts");
        setIsLoading(false);
        return;
      }

      setSuccess(true);
      setIsLoading(false);

      // Redirect to login after 2 seconds
      setTimeout(() => {
        setLocation("/login");
      }, 2000);
    } catch (err) {
      setError("Verbindungsfehler. Bitte versuchen Sie es erneut.");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Neues Passwort setzen</CardTitle>
          <CardDescription>
            Geben Sie Ihr neues Passwort ein
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
                  Passwort erfolgreich zurückgesetzt! Sie werden zur Anmeldeseite weitergeleitet...
                </AlertDescription>
              </Alert>
            )}
            {!success && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Neues Passwort</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="Mindestens 8 Zeichen"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Passwort wiederholen"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
              </>
            )}
          </CardContent>
          {!success && (
            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" className="w-full" disabled={isLoading || !token}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Passwort zurücksetzen...
                  </>
                ) : (
                  "Passwort zurücksetzen"
                )}
              </Button>
              <div className="text-sm text-center text-muted-foreground">
                <Link href="/login" className="text-primary hover:underline">
                  Zurück zur Anmeldung
                </Link>
              </div>
            </CardFooter>
          )}
        </form>
      </Card>
    </div>
  );
}
