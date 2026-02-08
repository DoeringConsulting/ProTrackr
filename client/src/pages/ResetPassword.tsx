import { useState, useEffect } from 'react';
import { useLocation, useSearch, Link } from 'wouter';
import { trpc } from '../lib/trpc';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Loader2, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react';

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    const tokenParam = params.get('token');
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      setError('Kein Reset-Token gefunden. Bitte fordern Sie einen neuen Link an.');
    }
  }, [searchParams]);

  // Token validieren
  const { data: tokenValidation, isLoading: isValidating } = trpc.auth.verifyResetToken.useQuery(
    { token },
    { enabled: !!token && !success }
  );

  const resetPasswordMutation = trpc.auth.resetPassword.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setError('');
      setTimeout(() => {
        setLocation('/login');
      }, 3000);
    },
    onError: (err) => {
      setError(err.message || 'Fehler beim Zurücksetzen des Passworts');
    },
  });

  // Passwort-Stärke prüfen
  const getPasswordStrength = (password: string): { strength: number; text: string; color: string } => {
    if (!password) return { strength: 0, text: '', color: '' };
    
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    if (strength <= 2) return { strength, text: 'Schwach', color: 'text-red-600' };
    if (strength <= 3) return { strength, text: 'Mittel', color: 'text-yellow-600' };
    return { strength, text: 'Stark', color: 'text-green-600' };
  };

  const passwordStrength = getPasswordStrength(newPassword);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newPassword || !confirmPassword) {
      setError('Bitte füllen Sie alle Felder aus');
      return;
    }

    if (newPassword.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen lang sein');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Die Passwörter stimmen nicht überein');
      return;
    }

    resetPasswordMutation.mutate({ token, newPassword });
  };

  // Kein Token vorhanden
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              Ungültiger Link
            </CardTitle>
            <CardDescription>
              Der Passwort-Reset-Link ist ungültig oder fehlt.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation('/login')} className="w-full">
              Zur Anmeldung
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Token wird validiert
  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-sm text-gray-600">Link wird überprüft...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Token ungültig oder abgelaufen
  if (tokenValidation && !tokenValidation.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              Link abgelaufen
            </CardTitle>
            <CardDescription>
              Dieser Passwort-Reset-Link ist abgelaufen oder wurde bereits verwendet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Passwort-Reset-Links sind aus Sicherheitsgründen nur 1 Stunde gültig.
            </p>
            <Button onClick={() => setLocation('/forgot-password')} className="w-full">
              Neuen Link anfordern
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Erfolgreiche Passwort-Änderung
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              Passwort erfolgreich geändert
            </CardTitle>
            <CardDescription>
              Ihr Passwort wurde erfolgreich zurückgesetzt.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Sie werden in wenigen Sekunden zur Anmeldung weitergeleitet...
            </p>
            <Button onClick={() => setLocation('/login')} className="w-full">
              Jetzt anmelden
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Passwort-Reset-Formular
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Neues Passwort festlegen</CardTitle>
          <CardDescription>
            Bitte geben Sie Ihr neues Passwort ein.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="newPassword">Neues Passwort</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mindestens 8 Zeichen"
                  className="pr-10"
                  disabled={resetPasswordMutation.isPending}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {newPassword && (
                <div className="flex items-center gap-2 text-sm">
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        passwordStrength.strength <= 2
                          ? 'bg-red-500'
                          : passwordStrength.strength <= 3
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${(passwordStrength.strength / 5) * 100}%` }}
                    />
                  </div>
                  <span className={passwordStrength.color}>{passwordStrength.text}</span>
                </div>
              )}
              <p className="text-xs text-gray-500">
                Verwenden Sie Groß- und Kleinbuchstaben, Zahlen und Sonderzeichen.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Passwort bestätigen</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Passwort wiederholen"
                  className="pr-10"
                  disabled={resetPasswordMutation.isPending}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-600">Die Passwörter stimmen nicht überein</p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full"
              disabled={
                resetPasswordMutation.isPending ||
                !newPassword ||
                !confirmPassword ||
                newPassword !== confirmPassword ||
                newPassword.length < 8
              }
            >
              {resetPasswordMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird gespeichert...
                </>
              ) : (
                'Passwort zurücksetzen'
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
