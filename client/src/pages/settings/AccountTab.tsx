import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AccountTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Konto für Nutzer</h2>
        <p className="text-muted-foreground">
          Firmenlogo, Mehrbenutzer-Verwaltung und Rechte
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Konto-Verwaltung
          </CardTitle>
          <CardDescription>
            Funktion in Planung - Konzept verfügbar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <User className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold mb-2">Funktion in Entwicklung</p>
            <p className="text-muted-foreground mb-6">
              Die Konto-Verwaltung wird nach Freigabe implementiert.
            </p>

            <div className="max-w-md mx-auto text-left space-y-4">
              <div className="text-sm text-muted-foreground space-y-2">
                <p className="font-semibold">Geplante Features:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Firmenlogo hochladen und verwalten</li>
                  <li>Mehrbenutzer-Verwaltung (Admin/Benutzer)</li>
                  <li>Rechteverwaltung pro Feature</li>
                  <li>Firmenstammdaten (Adresse, USt-ID, Bankverbindung)</li>
                  <li>Benutzer-Einladungen per E-Mail</li>
                </ul>
              </div>

              <div className="pt-4">
                <Button variant="outline" className="w-full" asChild>
                  <a href="#" onClick={(e) => {
                    e.preventDefault();
                    alert("Das Konzept-Dokument wird nach Erstellung verfügbar sein.");
                  }}>
                    <FileText className="mr-2 h-4 w-4" />
                    Konzept-Dokumentation ansehen
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
          <CardDescription>
            Aktueller Entwicklungsstand
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-2">
              <div className="mt-0.5">📋</div>
              <div>
                <strong>Konzept-Phase:</strong> Detailliertes Konzept wird erstellt
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="mt-0.5">⏸️</div>
              <div>
                <strong>Umsetzung:</strong> Noch nicht freigegeben
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="mt-0.5">✅</div>
              <div>
                <strong>Datenbank:</strong> Schema bereits vorbereitet (accountSettings-Tabelle)
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="mt-0.5">✅</div>
              <div>
                <strong>Backend-API:</strong> Grundfunktionen bereits implementiert
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
