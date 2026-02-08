import { useState } from 'react';
import { Link } from 'wouter';
import { trpc } from '../lib/trpc';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Loader2, Mail, CheckCircle2, ArrowLeft } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [success, setSuccess] = useState(false);

  const requestResetMutation = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => {
      setSuccess(true);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      return;
    }

    requestResetMutation.mutate({ email });
  };

  // Erfolgs-Ansicht
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              E-Mail versendet
            </CardTitle>
            <CardDescription>
              Prüfen Sie Ihr E-Mail-Postfach
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <Mail className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-blue-900">
                  Passwort-Reset-Link wurde versendet
                </p>
                <p className="text-sm text-blue-700">
                  Falls ein Konto mit der E-Mail-Adresse <strong>{email}</strong> existiert, 
                  haben wir Ihnen einen Link zum Zurücksetzen des Passworts gesendet.
                </p>
              </div>
            </div>

            <div className="space-y-2 text-sm text-gray-600">
              <p className="font-medium">Was Sie jetzt tun sollten:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Öffnen Sie Ihr E-Mail-Postfach</li>
                <li>Suchen Sie nach einer E-Mail von Döring Consulting</li>
                <li>Klicken Sie auf den Link in der E-Mail</li>
                <li>Setzen Sie Ihr neues Passwort</li>
              </ol>
            </div>

            <Alert>
              <AlertDescription className="text-sm">
                <strong>Wichtig:</strong> Der Link ist aus Sicherheitsgründen nur 1 Stunde gültig.
              </AlertDescription>
            </Alert>

            <div className="pt-2">
              <p className="text-xs text-gray-500">
                E-Mail nicht erhalten? Prüfen Sie Ihren Spam-Ordner oder fordern Sie einen neuen Link an.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setSuccess(false);
                setEmail('');
              }}
            >
              Neuen Link anfordern
            </Button>
            <Link href="/login" className="w-full">
              <Button variant="ghost" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Zurück zur Anmeldung
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Formular-Ansicht
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Passwort vergessen?</CardTitle>
          <CardDescription>
            Geben Sie Ihre E-Mail-Adresse ein, um einen Passwort-Reset-Link zu erhalten.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail-Adresse</Label>
              <Input
                id="email"
                type="email"
                placeholder="ihre@email.de"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={requestResetMutation.isPending}
                autoFocus
              />
              <p className="text-xs text-gray-500">
                Wir senden Ihnen einen Link zum Zurücksetzen Ihres Passworts.
              </p>
            </div>

            <Alert>
              <AlertDescription className="text-sm">
                Aus Sicherheitsgründen erhalten Sie nur dann eine E-Mail, wenn ein Konto mit dieser 
                E-Mail-Adresse existiert.
              </AlertDescription>
            </Alert>
          </CardContent>

          <CardFooter className="flex flex-col space-y-3">
            <Button
              type="submit"
              className="w-full"
              disabled={requestResetMutation.isPending || !email}
            >
              {requestResetMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird versendet...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Reset-Link senden
                </>
              )}
            </Button>

            <div className="text-sm text-center text-muted-foreground">
              <Link href="/login" className="text-primary hover:underline inline-flex items-center">
                <ArrowLeft className="mr-1 h-3 w-3" />
                Zurück zur Anmeldung
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
