import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Save } from "lucide-react";

function toPercent(bp: number) {
  return (bp / 100).toFixed(2);
}

function toPln(cents: number) {
  return (cents / 100).toFixed(2);
}

function parseFloatSafe(value: string) {
  const normalized = value.replace(",", ".");
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export default function TaxesTab() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Profile state
  const [taxForm, setTaxForm] = useState<"liniowy_19">("liniowy_19");
  const [zusRegime, setZusRegime] = useState<"ulga_na_start" | "preferencyjny_zus" | "maly_zus_plus" | "pelny_zus">("pelny_zus");
  const [choroboweEnabled, setChoroboweEnabled] = useState(false);
  const [fpFsEnabled, setFpFsEnabled] = useState(true);
  const [wypadkowaRate, setWypadkowaRate] = useState("1.67");
  const [zdrowotnaRateLiniowy, setZdrowotnaRateLiniowy] = useState("4.90");
  const [pitRate, setPitRate] = useState("19.00");

  // Year config state
  const [socialMinBase, setSocialMinBase] = useState("5652.00");
  const [zdrowotnaMinBase, setZdrowotnaMinBase] = useState("5652.00");
  const [zdrowotnaMinAmount, setZdrowotnaMinAmount] = useState("276.95");
  const [zdrowotnaDeductionLimitYearly, setZdrowotnaDeductionLimitYearly] = useState("0.00");
  const [socialContributionRate, setSocialContributionRate] = useState("19.52");
  const [choroboweRate, setChoroboweRate] = useState("2.45");
  const [fpFsRate, setFpFsRate] = useState("2.45");

  const utils = trpc.useUtils();
  const { data: profile, isLoading: profileLoading } = trpc.taxSettings.getProfile.useQuery();
  const { data: config, isLoading: configLoading } = trpc.taxSettings.getConfig.useQuery({ year: selectedYear });

  useEffect(() => {
    if (!profile) return;
    setTaxForm(profile.taxForm);
    setZusRegime(profile.zusRegime);
    setChoroboweEnabled(profile.choroboweEnabled);
    setFpFsEnabled(profile.fpFsEnabled);
    setWypadkowaRate(toPercent(profile.wypadkowaRateBp));
    setZdrowotnaRateLiniowy(toPercent(profile.zdrowotnaRateLiniowyBp));
    setPitRate(toPercent(profile.pitRateBp));
  }, [profile]);

  useEffect(() => {
    if (!config) return;
    setSocialMinBase(toPln(config.socialMinBaseCents));
    setZdrowotnaMinBase(toPln(config.zdrowotnaMinBaseCents));
    setZdrowotnaMinAmount(toPln(config.zdrowotnaMinAmountCents));
    setZdrowotnaDeductionLimitYearly(toPln(config.zdrowotnaDeductionLimitYearlyCents));
    setSocialContributionRate(toPercent(config.socialContributionRateBp));
    setChoroboweRate(toPercent(config.choroboweRateBp));
    setFpFsRate(toPercent(config.fpFsRateBp));
  }, [config]);

  const upsertProfileMutation = trpc.taxSettings.upsertProfile.useMutation();
  const upsertConfigMutation = trpc.taxSettings.upsertConfig.useMutation();

  const isSaving = upsertProfileMutation.isPending || upsertConfigMutation.isPending;
  const isLoading = profileLoading || configLoading;

  const handleSave = async () => {
    const wypadkowaRateNumber = parseFloatSafe(wypadkowaRate);
    const zdrowotnaRateNumber = parseFloatSafe(zdrowotnaRateLiniowy);
    const pitRateNumber = parseFloatSafe(pitRate);

    const socialMinBaseNumber = parseFloatSafe(socialMinBase);
    const zdrowotnaMinBaseNumber = parseFloatSafe(zdrowotnaMinBase);
    const zdrowotnaMinAmountNumber = parseFloatSafe(zdrowotnaMinAmount);
    const zdrowotnaDeductionLimitYearlyNumber = parseFloatSafe(zdrowotnaDeductionLimitYearly);
    const socialContributionRateNumber = parseFloatSafe(socialContributionRate);
    const choroboweRateNumber = parseFloatSafe(choroboweRate);
    const fpFsRateNumber = parseFloatSafe(fpFsRate);

    const allNumbers = [
      wypadkowaRateNumber,
      zdrowotnaRateNumber,
      pitRateNumber,
      socialMinBaseNumber,
      zdrowotnaMinBaseNumber,
      zdrowotnaMinAmountNumber,
      zdrowotnaDeductionLimitYearlyNumber,
      socialContributionRateNumber,
      choroboweRateNumber,
      fpFsRateNumber,
    ];

    if (allNumbers.some((value) => Number.isNaN(value))) {
      toast.error("Bitte alle Felder mit gültigen Zahlen ausfüllen.");
      return;
    }

    try {
      await upsertProfileMutation.mutateAsync({
        taxForm,
        zusRegime,
        choroboweEnabled,
        fpFsEnabled,
        wypadkowaRateBp: Math.round(wypadkowaRateNumber * 100),
        zdrowotnaRateLiniowyBp: Math.round(zdrowotnaRateNumber * 100),
        pitRateBp: Math.round(pitRateNumber * 100),
      });

      await upsertConfigMutation.mutateAsync({
        year: selectedYear,
        socialMinBaseCents: Math.round(socialMinBaseNumber * 100),
        zdrowotnaMinBaseCents: Math.round(zdrowotnaMinBaseNumber * 100),
        zdrowotnaMinAmountCents: Math.round(zdrowotnaMinAmountNumber * 100),
        zdrowotnaDeductionLimitYearlyCents: Math.round(zdrowotnaDeductionLimitYearlyNumber * 100),
        socialContributionRateBp: Math.round(socialContributionRateNumber * 100),
        choroboweRateBp: Math.round(choroboweRateNumber * 100),
        fpFsRateBp: Math.round(fpFsRateNumber * 100),
      });

      await Promise.all([
        utils.taxSettings.getProfile.invalidate(),
        utils.taxSettings.getConfig.invalidate({ year: selectedYear }),
      ]);

      toast.success("Steuerprofil und Jahreswerte gespeichert.");
    } catch (error: any) {
      toast.error(`Fehler beim Speichern: ${error.message}`);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            Lade Steuerprofil und Jahreswerte...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Steuern (PL) – Regime + Jahreswerte</h2>
        <p className="text-muted-foreground">
          Struktur B: tax_profile + tax_config_pl[year] für saubere und zukunftssichere Berechnungen.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1) Steuerprofil / Regellogik</CardTitle>
          <CardDescription>
            Diese Werte ändern sich selten (Regime und Sätze).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Steuerform</Label>
            <Select value={taxForm} onValueChange={(value: "liniowy_19") => setTaxForm(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="liniowy_19">liniowy_19</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>ZUS-Regime</Label>
            <Select
              value={zusRegime}
              onValueChange={(value: "ulga_na_start" | "preferencyjny_zus" | "maly_zus_plus" | "pelny_zus") =>
                setZusRegime(value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ulga_na_start">ulga_na_start</SelectItem>
                <SelectItem value="preferencyjny_zus">preferencyjny_zus</SelectItem>
                <SelectItem value="maly_zus_plus">maly_zus_plus</SelectItem>
                <SelectItem value="pelny_zus">pelny_zus</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wypadkowaRate">Wypadkowa-Satz (%)</Label>
            <Input
              id="wypadkowaRate"
              type="number"
              step="0.01"
              value={wypadkowaRate}
              onChange={(event) => setWypadkowaRate(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="zdrowotnaRateLiniowy">Zdrowotna-Satz liniowy (%)</Label>
            <Input
              id="zdrowotnaRateLiniowy"
              type="number"
              step="0.01"
              value={zdrowotnaRateLiniowy}
              onChange={(event) => setZdrowotnaRateLiniowy(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pitRate">PIT liniowy (%)</Label>
            <Input
              id="pitRate"
              type="number"
              step="0.01"
              value={pitRate}
              onChange={(event) => setPitRate(event.target.value)}
            />
          </div>

          <div className="space-y-4 pt-6">
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="choroboweEnabled">Chorobowe freiwillig</Label>
              <Switch
                id="choroboweEnabled"
                checked={choroboweEnabled}
                onCheckedChange={setChoroboweEnabled}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="fpFsEnabled">FP/FS fällig</Label>
              <Switch
                id="fpFsEnabled"
                checked={fpFsEnabled}
                onCheckedChange={setFpFsEnabled}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2) Jahreswerte (tax_config_pl)</CardTitle>
          <CardDescription>
            Gesetzliche Bemessungsgrundlagen und Limits pro Jahr.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs space-y-2">
            <Label htmlFor="year">Jahr</Label>
            <Input
              id="year"
              type="number"
              min={2000}
              max={2100}
              value={selectedYear}
              onChange={(event) => setSelectedYear(Number(event.target.value) || currentYear)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="socialMinBase">Mindestbasis sozialer ZUS (PLN)</Label>
              <Input
                id="socialMinBase"
                type="number"
                step="0.01"
                value={socialMinBase}
                onChange={(event) => setSocialMinBase(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zdrowotnaMinBase">Mindestbasis zdrowotna (PLN)</Label>
              <Input
                id="zdrowotnaMinBase"
                type="number"
                step="0.01"
                value={zdrowotnaMinBase}
                onChange={(event) => setZdrowotnaMinBase(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zdrowotnaMinAmount">Mindest-zdrowotna (PLN)</Label>
              <Input
                id="zdrowotnaMinAmount"
                type="number"
                step="0.01"
                value={zdrowotnaMinAmount}
                onChange={(event) => setZdrowotnaMinAmount(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zdrowotnaDeductionLimitYearly">Jahreslimit Abzugsfähigkeit zdrowotna (PLN)</Label>
              <Input
                id="zdrowotnaDeductionLimitYearly"
                type="number"
                step="0.01"
                value={zdrowotnaDeductionLimitYearly}
                onChange={(event) => setZdrowotnaDeductionLimitYearly(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="socialContributionRate">Sozialbeitrag-Basissatz (%)</Label>
              <Input
                id="socialContributionRate"
                type="number"
                step="0.01"
                value={socialContributionRate}
                onChange={(event) => setSocialContributionRate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="choroboweRate">Chorobowe-Satz (%)</Label>
              <Input
                id="choroboweRate"
                type="number"
                step="0.01"
                value={choroboweRate}
                onChange={(event) => setChoroboweRate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fpFsRate">FP/FS-Satz (%)</Label>
              <Input
                id="fpFsRate"
                type="number"
                step="0.01"
                value={fpFsRate}
                onChange={(event) => setFpFsRate(event.target.value)}
              />
            </div>
          </div>

          {config?.isDefault && (
            <p className="text-sm text-amber-600">
              Hinweis: Für dieses Jahr existiert noch kein gespeicherter Datensatz. Die aktuellen Werte sind Startwerte – bitte prüfen und speichern.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? "Speichere..." : "Profil + Jahreswerte speichern"}
        </Button>
      </div>
    </div>
  );
}
