import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Save, Percent, DollarSign } from "lucide-react";

export default function TaxesTab() {
  const [zusType, setZusType] = useState<"percentage" | "fixed">("percentage");
  const [zusValue, setZusValue] = useState("");
  const [healthInsuranceType, setHealthInsuranceType] = useState<"percentage" | "fixed">("percentage");
  const [healthInsuranceValue, setHealthInsuranceValue] = useState("");
  const [taxType, setTaxType] = useState<"percentage" | "fixed">("percentage");
  const [taxValue, setTaxValue] = useState("");

  const utils = trpc.useUtils();
  const { data: taxSettings, isLoading } = trpc.taxSettings.get.useQuery();

  useEffect(() => {
    if (taxSettings) {
      setZusType(taxSettings.zusType);
      setZusValue(
        taxSettings.zusType === "percentage"
          ? (taxSettings.zusValue / 100).toFixed(2)
          : (taxSettings.zusValue / 100).toFixed(2)
      );
      setHealthInsuranceType(taxSettings.healthInsuranceType);
      setHealthInsuranceValue(
        taxSettings.healthInsuranceType === "percentage"
          ? (taxSettings.healthInsuranceValue / 100).toFixed(2)
          : (taxSettings.healthInsuranceValue / 100).toFixed(2)
      );
      setTaxType(taxSettings.taxType);
      setTaxValue(
        taxSettings.taxType === "percentage"
          ? (taxSettings.taxValue / 100).toFixed(2)
          : (taxSettings.taxValue / 100).toFixed(2)
      );
    }
  }, [taxSettings]);

  const upsertMutation = trpc.taxSettings.upsert.useMutation({
    onSuccess: () => {
      utils.taxSettings.get.invalidate();
      toast.success("Steuereinstellungen erfolgreich gespeichert");
    },
    onError: (error) => {
      toast.error(`Fehler beim Speichern: ${error.message}`);
    },
  });

  const handleSave = () => {
    if (!zusValue || !healthInsuranceValue || !taxValue) {
      toast.error("Bitte füllen Sie alle Felder aus");
      return;
    }

    const zusValueInBasisPoints =
      zusType === "percentage"
        ? Math.round(parseFloat(zusValue) * 100)
        : Math.round(parseFloat(zusValue) * 100);

    const healthInsuranceValueInBasisPoints =
      healthInsuranceType === "percentage"
        ? Math.round(parseFloat(healthInsuranceValue) * 100)
        : Math.round(parseFloat(healthInsuranceValue) * 100);

    const taxValueInBasisPoints =
      taxType === "percentage"
        ? Math.round(parseFloat(taxValue) * 100)
        : Math.round(parseFloat(taxValue) * 100);

    upsertMutation.mutate({
      zusType,
      zusValue: zusValueInBasisPoints,
      healthInsuranceType,
      healthInsuranceValue: healthInsuranceValueInBasisPoints,
      taxType,
      taxValue: taxValueInBasisPoints,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            Lade Steuereinstellungen...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Steuereinstellungen</h2>
        <p className="text-muted-foreground">
          Konfigurieren Sie Ihre Steuersätze für die Buchhaltung
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ZUS (Sozialversicherung)</CardTitle>
          <CardDescription>
            Wählen Sie zwischen Prozentsatz oder festem Betrag
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={zusType} onValueChange={(value: any) => setZusType(value)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="percentage" id="zus-percentage" />
              <Label htmlFor="zus-percentage" className="flex items-center gap-2">
                <Percent className="h-4 w-4" />
                Prozentsatz
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="fixed" id="zus-fixed" />
              <Label htmlFor="zus-fixed" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Fester Betrag (PLN)
              </Label>
            </div>
          </RadioGroup>
          <div className="space-y-2">
            <Label htmlFor="zus-value">
              {zusType === "percentage" ? "Prozentsatz (%)" : "Betrag (PLN)"}
            </Label>
            <Input
              id="zus-value"
              type="number"
              step="0.01"
              placeholder={zusType === "percentage" ? "19.52" : "1000.00"}
              value={zusValue}
              onChange={(e) => setZusValue(e.target.value)}
            />
            {zusType === "percentage" && (
              <p className="text-sm text-muted-foreground">
                Standard: 19,52% (für Selbstständige in Polen)
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Krankenversicherung</CardTitle>
          <CardDescription>
            Wählen Sie zwischen Prozentsatz oder festem Betrag
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            value={healthInsuranceType}
            onValueChange={(value: any) => setHealthInsuranceType(value)}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="percentage" id="health-percentage" />
              <Label htmlFor="health-percentage" className="flex items-center gap-2">
                <Percent className="h-4 w-4" />
                Prozentsatz
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="fixed" id="health-fixed" />
              <Label htmlFor="health-fixed" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Fester Betrag (PLN)
              </Label>
            </div>
          </RadioGroup>
          <div className="space-y-2">
            <Label htmlFor="health-value">
              {healthInsuranceType === "percentage" ? "Prozentsatz (%)" : "Betrag (PLN)"}
            </Label>
            <Input
              id="health-value"
              type="number"
              step="0.01"
              placeholder={healthInsuranceType === "percentage" ? "9.00" : "500.00"}
              value={healthInsuranceValue}
              onChange={(e) => setHealthInsuranceValue(e.target.value)}
            />
            {healthInsuranceType === "percentage" && (
              <p className="text-sm text-muted-foreground">
                Standard: 9% (für Selbstständige in Polen)
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Einkommensteuer</CardTitle>
          <CardDescription>
            Wählen Sie zwischen Prozentsatz oder festem Betrag
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={taxType} onValueChange={(value: any) => setTaxType(value)}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="percentage" id="tax-percentage" />
              <Label htmlFor="tax-percentage" className="flex items-center gap-2">
                <Percent className="h-4 w-4" />
                Prozentsatz
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="fixed" id="tax-fixed" />
              <Label htmlFor="tax-fixed" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Fester Betrag (PLN)
              </Label>
            </div>
          </RadioGroup>
          <div className="space-y-2">
            <Label htmlFor="tax-value">
              {taxType === "percentage" ? "Prozentsatz (%)" : "Betrag (PLN)"}
            </Label>
            <Input
              id="tax-value"
              type="number"
              step="0.01"
              placeholder={taxType === "percentage" ? "19.00" : "2000.00"}
              value={taxValue}
              onChange={(e) => setTaxValue(e.target.value)}
            />
            {taxType === "percentage" && (
              <p className="text-sm text-muted-foreground">
                Standard: 19% (Pauschalsteuer in Polen)
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={upsertMutation.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {upsertMutation.isPending ? "Speichere..." : "Einstellungen speichern"}
        </Button>
      </div>
    </div>
  );
}
