import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ChangelogVersion = {
  version: string;
  date: string;
  changes: Array<{
    type: string;
    title: string;
    description: string;
  }>;
};

type ChangelogPayload = {
  versions: ChangelogVersion[];
};

const FAQ_SECTIONS: Array<{
  title: string;
  items: Array<{ question: string; answer: string }>;
}> = [
  {
    title: "Schnellstart: Neue KI- und Importfunktion",
    items: [
      {
        question: "Wo finde ich die neuen Funktionen?",
        answer:
          'Im linken Menü unter "Import". Dort gibt es jetzt den strukturierten Import (v1) und den Bereich "KI-Belegauslese → Reisekosten".',
      },
      {
        question: "Was muss ich zuerst tun?",
        answer:
          "1) Vorlage herunterladen (Excel-Template v1), 2) Datei befüllen, 3) im Reiter Import zuerst validieren, 4) erst danach importieren.",
      },
      {
        question: "Wie funktioniert der KI-Teil für Belege?",
        answer:
          "Du fügst OCR-Text ein (oder nutzt eine documentId), optional mit customerId/timeEntryId/projectName. Danach analysiert die KI den Beleg und erzeugt Kandidaten mit Confidence, Regelprüfung und Matching-Vorschlag.",
      },
      {
        question: "Wie übernehme ich einen KI-Vorschlag?",
        answer:
          'Im KI-Bereich nach der Analyse bei einem Kandidaten auf "Übernehmen" klicken. Der Eintrag wird dann als Reisekosten gespeichert und in der Review-Queue als approved markiert.',
      },
    ],
  },
  {
    title: "Import v1: Struktur und Validierung",
    items: [
      {
        question: "Welche Tabellen/Sheets werden erwartet?",
        answer:
          'Excel mit den Sheets: "Kunden", "Zeiteintraege", "Reisekosten". Alternativ einzelne CSV-Dateien im selben Spaltenformat.',
      },
      {
        question: "Warum ist der Import manchmal blockiert?",
        answer:
          "Blockierende Fehler (Severity=error) verhindern den Import bewusst, z. B. ungültiges Datum, fehlender Kundenbezug, ungültige Währung oder Flug ohne Zeitangabe.",
      },
      {
        question: "Was bedeuten Warnungen?",
        answer:
          "Warnungen blockieren nicht. Beispiel: kein direkter Zeiteintrag referenziert, daher Fallback-Matching nötig.",
      },
      {
        question: "Wie finde ich die Bedeutung eines Fehlercodes?",
        answer:
          "Im Import-Reiter gibt es einen Fehlerkatalog mit Code, Klartextmeldung und Erklärung.",
      },
    ],
  },
  {
    title: "Betrieb und Updates",
    items: [
      {
        question: "Wird diese FAQ automatisch aktualisiert?",
        answer:
          "Ja, der Abschnitt „Neueste Änderungen“ wird automatisch aus dem aktuellen CHANGELOG geladen und zeigt neue Funktionen/Fixes ohne manuelle Pflege der Seite.",
      },
      {
        question: "Wo sehe ich die neuesten Änderungen in der App?",
        answer:
          "Hier auf dieser FAQ-Seite im Bereich „Neueste Änderungen (automatisch)“ sowie im Update-Dialog der App-Version.",
      },
    ],
  },
];

export default function Faq() {
  const [versions, setVersions] = useState<ChangelogVersion[]>([]);

  useEffect(() => {
    fetch("/CHANGELOG.json")
      .then(response => response.json())
      .then((data: ChangelogPayload) => {
        setVersions(Array.isArray(data?.versions) ? data.versions.slice(0, 3) : []);
      })
      .catch(() => setVersions([]));
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#025a64]">FAQ & Hilfe</h1>
          <p className="text-muted-foreground">
            Anleitung für Funktionen, Bedienung und neueste Änderungen
          </p>
        </div>

        {FAQ_SECTIONS.map(section => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {section.items.map(item => (
                <div key={item.question} className="rounded-md border p-3">
                  <p className="font-medium">{item.question}</p>
                  <p className="text-sm text-muted-foreground mt-1">{item.answer}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader>
            <CardTitle>Neueste Änderungen (automatisch)</CardTitle>
            <CardDescription>
              Wird direkt aus CHANGELOG.json geladen
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {versions.length === 0 && (
              <p className="text-sm text-muted-foreground">Keine Änderungsdaten verfügbar.</p>
            )}
            {versions.map(version => (
              <div key={version.version} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">v{version.version}</Badge>
                  <span className="text-sm text-muted-foreground">{version.date}</span>
                </div>
                <div className="space-y-2">
                  {version.changes.map((change, index) => (
                    <div key={`${version.version}-${index}`} className="text-sm">
                      <p className="font-medium">
                        [{change.type}] {change.title}
                      </p>
                      <p className="text-muted-foreground">{change.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
