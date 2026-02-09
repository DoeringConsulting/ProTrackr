import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { 
  DollarSign, 
  Percent, 
  TrendingUp, 
  Database, 
  Upload, 
  User 
} from "lucide-react";
import FixedCostsTab from "./settings/FixedCostsTab";
import TaxesTab from "./settings/TaxesTab";
import ExchangeRatesTab from "./settings/ExchangeRatesTab";
import BackupTab from "./settings/BackupTab";
import ImportTab from "./settings/ImportTab";
import AccountTab from "./settings/AccountTab";

export default function Settings() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("fixed-costs");

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Einstellungen</h1>
        <p className="text-muted-foreground mt-2">
          Verwalten Sie Fixkosten, Steuern, Wechselkurse und weitere Einstellungen
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6 lg:w-auto">
          <TabsTrigger value="fixed-costs" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            <span className="hidden sm:inline">Fixkosten</span>
          </TabsTrigger>
          <TabsTrigger value="taxes" className="flex items-center gap-2">
            <Percent className="h-4 w-4" />
            <span className="hidden sm:inline">Steuern</span>
          </TabsTrigger>
          <TabsTrigger value="exchange-rates" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Wechselkurse</span>
          </TabsTrigger>
          <TabsTrigger value="backup" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">Datensicherung</span>
          </TabsTrigger>
          <TabsTrigger value="import" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Datenimport</span>
          </TabsTrigger>
          <TabsTrigger value="account" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Konto</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fixed-costs">
          <FixedCostsTab />
        </TabsContent>

        <TabsContent value="taxes">
          <TaxesTab />
        </TabsContent>

        <TabsContent value="exchange-rates">
          <ExchangeRatesTab />
        </TabsContent>

        <TabsContent value="backup">
          <BackupTab />
        </TabsContent>

        <TabsContent value="import">
          <ImportTab />
        </TabsContent>

        <TabsContent value="account">
          <AccountTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
