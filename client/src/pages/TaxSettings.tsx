import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Calculator, Info } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

type TaxFormData = {
  zusType: "percentage" | "fixed";
  zusValue: string;
  healthInsuranceType: "percentage" | "fixed";
  healthInsuranceValue: string;
  taxType: "percentage" | "fixed";
  taxValue: string;
};

const defaultFormData: TaxFormData = {
  zusType: "percentage",
  zusValue: "19.52",
  healthInsuranceType: "percentage",
  healthInsuranceValue: "9",
  taxType: "percentage",
  taxValue: "19",
};

export default function TaxSettings() {
  const [formData, setFormData] = useState<TaxFormData>(defaultFormData);

  const { data: settings, isLoading } = trpc.taxSettings.get.useQuery();
  const upsertMutation = trpc.taxSettings.upsert.useMutation({
    onSuccess: () => {
      toast.success("Steuereinstellungen erfolgreich gespeichert");
    },
    onError: (error) => {
      toast.error("Fehler beim Speichern: " + error.message);
    },
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        zusType: settings.zusType,
        zusValue: settings.zusType === "percentage" 
          ? (settings.zusValue / 100).toFixed(2) 
          : (settings.zusValue / 100).toFixed(2),
        healthInsuranceType: settings.healthInsuranceType,
        healthInsuranceValue: settings.healthInsuranceType === "percentage"
          ? (settings.healthInsuranceValue / 100).toFixed(2)
          : (settings.healthInsuranceValue / 100).toFixed(2),
        taxType: settings.taxType,
        taxValue: settings.taxType === "percentage"
          ? (settings.taxValue / 100).toFixed(2)
          : (settings.taxValue / 100).toFixed(2),
      });
    }
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const zusValue = parseFloat(formData.zusValue);
    const healthInsuranceValue = parseFloat(formData.healthInsuranceValue);
    const taxValue = parseFloat(formData.taxValue);

    if (isNaN(zusValue) || isNaN(healthInsuranceValue) || isNaN(taxValue)) {
      toast.error("Bitte geben Sie gültige Zahlen ein");
      return;
    }

    upsertMutation.mutate({
      zusType: formData.zusType,
      zusValue: Math.round(zusValue * 100), // Convert to cents or basis points
      healthInsuranceType: formData.healthInsuranceType,
      healthInsuranceValue: Math.round(healthInsuranceValue * 100),
      taxType: formData.taxType,
      taxValue: Math.round(taxValue * 100),
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Steuereinstellungen</h1>
          <p className="text-muted-foreground mt-2">
            Konfigurieren Sie Ihre Steuersätze und Abgaben für Berechnungen
          </p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">Hinweis zur Konfiguration</p>
            <p>
              Sie können für jede Abgabe wählen, ob sie als <strong>Prozentsatz</strong> (z.B. 19%) 
              oder als <strong>fester Betrag</strong> (z.B. 500 PLN) berechnet werden soll.
            </p>
            <p className="mt-2">
              <strong>Prozentsatz:</strong> Wird automatisch vom Umsatz berechnet<br />
              <strong>Fester Betrag:</strong> Wird als fixe Summe abgezogen
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 md:grid-cols-3">
            {/* ZUS */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  ZUS (Sozialversicherung)
                </CardTitle>
                <CardDescription>
                  Polnische Sozialversicherungsbeiträge
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="zusType">Berechnungsart</Label>
                  <Select 
                    value={formData.zusType} 
                    onValueChange={(value: "percentage" | "fixed") => 
                      setFormData({ ...formData, zusType: value })
                    }
                  >
                    <SelectTrigger id="zusType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Prozentsatz</SelectItem>
                      <SelectItem value="fixed">Fester Betrag</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="zusValue">
                    {formData.zusType === "percentage" ? "Prozentsatz (%)" : "Betrag (PLN)"}
                  </Label>
                  <Input
                    id="zusValue"
                    type="number"
                    step="0.01"
                    value={formData.zusValue}
                    onChange={(e) => setFormData({ ...formData, zusValue: e.target.value })}
                    placeholder={formData.zusType === "percentage" ? "19.52" : "1500.00"}
                    required
                  />
                  {formData.zusType === "percentage" && (
                    <p className="text-xs text-muted-foreground">Standard: 19.52%</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Health Insurance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Krankenversicherung
                </CardTitle>
                <CardDescription>
                  Gesundheitsversicherungsbeiträge
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="healthInsuranceType">Berechnungsart</Label>
                  <Select 
                    value={formData.healthInsuranceType} 
                    onValueChange={(value: "percentage" | "fixed") => 
                      setFormData({ ...formData, healthInsuranceType: value })
                    }
                  >
                    <SelectTrigger id="healthInsuranceType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Prozentsatz</SelectItem>
                      <SelectItem value="fixed">Fester Betrag</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="healthInsuranceValue">
                    {formData.healthInsuranceType === "percentage" ? "Prozentsatz (%)" : "Betrag (PLN)"}
                  </Label>
                  <Input
                    id="healthInsuranceValue"
                    type="number"
                    step="0.01"
                    value={formData.healthInsuranceValue}
                    onChange={(e) => setFormData({ ...formData, healthInsuranceValue: e.target.value })}
                    placeholder={formData.healthInsuranceType === "percentage" ? "9.00" : "800.00"}
                    required
                  />
                  {formData.healthInsuranceType === "percentage" && (
                    <p className="text-xs text-muted-foreground">Standard: 9%</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Tax */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Einkommensteuer
                </CardTitle>
                <CardDescription>
                  Steuer auf Steuerbasis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="taxType">Berechnungsart</Label>
                  <Select 
                    value={formData.taxType} 
                    onValueChange={(value: "percentage" | "fixed") => 
                      setFormData({ ...formData, taxType: value })
                    }
                  >
                    <SelectTrigger id="taxType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Prozentsatz</SelectItem>
                      <SelectItem value="fixed">Fester Betrag</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="taxValue">
                    {formData.taxType === "percentage" ? "Prozentsatz (%)" : "Betrag (PLN)"}
                  </Label>
                  <Input
                    id="taxValue"
                    type="number"
                    step="0.01"
                    value={formData.taxValue}
                    onChange={(e) => setFormData({ ...formData, taxValue: e.target.value })}
                    placeholder={formData.taxType === "percentage" ? "19.00" : "2000.00"}
                    required
                  />
                  {formData.taxType === "percentage" && (
                    <p className="text-xs text-muted-foreground">Standard: 19%</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end mt-6">
            <Button type="submit" disabled={upsertMutation.isPending || isLoading}>
              {upsertMutation.isPending ? "Speichert..." : "Einstellungen speichern"}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
