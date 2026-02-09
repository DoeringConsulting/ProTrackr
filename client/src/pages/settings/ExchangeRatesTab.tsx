import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp } from "lucide-react";

export default function ExchangeRatesTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Wechselkurse-Verwaltung</h2>
        <p className="text-muted-foreground">
          Manuelle Wechselkurse eingeben und NBP-Kurse überschreiben
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Manuelle Wechselkurse
          </CardTitle>
          <CardDescription>
            Überschreiben Sie automatische NBP-Kurse mit manuellen Werten
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold mb-2">Funktion in Entwicklung</p>
            <p className="text-muted-foreground mb-4">
              Die manuelle Wechselkurs-Verwaltung wird in Kürze verfügbar sein.
            </p>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Geplante Features:</p>
              <ul className="list-disc list-inside mt-2">
                <li>Manuelle Eingabe von Wechselkursen</li>
                <li>Überschreiben von NBP-Kursen</li>
                <li>Historien-Ansicht für alle Kurse</li>
                <li>Automatische Synchronisierung mit NBP</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
