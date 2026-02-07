import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Archive, Building2, Edit, Plus, Trash2, ArchiveRestore, TrendingUp, CheckSquare, Square } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

type CustomerFormData = {
  provider: string;
  mandatenNr: string;
  projectName: string;
  location: string;
  onsiteRate: string;
  onsiteRateCurrency: string;
  remoteRate: string;
  remoteRateCurrency: string;
  kmRate: string;
  kmRateCurrency: string;
  mealRate: string;
  mealRateCurrency: string;
  costModel: "exclusive" | "inclusive";
  street: string;
  postalCode: string;
  city: string;
  country: string;
  vatId: string;
};

const initialFormData: CustomerFormData = {
  provider: "",
  mandatenNr: "",
  projectName: "",
  location: "",
  onsiteRate: "",
  onsiteRateCurrency: "EUR",
  remoteRate: "",
  remoteRateCurrency: "EUR",
  kmRate: "",
  kmRateCurrency: "EUR",
  mealRate: "",
  mealRateCurrency: "EUR",
  costModel: "exclusive",
  street: "",
  postalCode: "",
  city: "",
  country: "",
  vatId: "",
};

export default function Customers() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<number | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [formData, setFormData] = useState<CustomerFormData>(initialFormData);
  const [selectedCustomers, setSelectedCustomers] = useState<Set<number>>(new Set());

  const utils = trpc.useUtils();
  const { data: customers, isLoading } = trpc.customers.list.useQuery();

  const createMutation = trpc.customers.create.useMutation({
    onSuccess: () => {
      utils.customers.list.invalidate();
      setIsDialogOpen(false);
      setFormData(initialFormData);
      toast.success("Kunde erfolgreich erstellt");
    },
    onError: (error) => {
      toast.error("Fehler beim Erstellen: " + error.message);
    },
  });

  const updateMutation = trpc.customers.update.useMutation({
    onSuccess: () => {
      utils.customers.list.invalidate();
      setIsDialogOpen(false);
      setEditingCustomer(null);
      setFormData(initialFormData);
      toast.success("Kunde erfolgreich aktualisiert");
    },
    onError: (error) => {
      toast.error("Fehler beim Aktualisieren: " + error.message);
    },
  });

  const deleteMutation = trpc.customers.delete.useMutation({
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await utils.customers.list.cancel();
      
      // Snapshot previous value
      const previousCustomers = utils.customers.list.getData();
      
      // Optimistically update
      utils.customers.list.setData(undefined, (old) => {
        if (!old) return old;
        return old.filter(c => c.id !== variables.id);
      });
      
      return { previousCustomers };
    },
    onSuccess: () => {
      toast.success("Kunde erfolgreich gelöscht");
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousCustomers) {
        utils.customers.list.setData(undefined, context.previousCustomers);
      }
      toast.error("Fehler beim Löschen: " + error.message);
      // Refetch only on error to restore correct state
      utils.customers.list.invalidate();
    },
  });

  const archiveMutation = trpc.customers.archive.useMutation({
    onSuccess: () => {
      utils.customers.list.invalidate();
      toast.success("Kunde erfolgreich archiviert");
    },
    onError: (error) => {
      toast.error("Fehler beim Archivieren: " + error.message);
    },
  });

  const unarchiveMutation = trpc.customers.unarchive.useMutation({
    onSuccess: () => {
      utils.customers.list.invalidate();
      toast.success("Kunde erfolgreich wiederhergestellt");
    },
    onError: (error) => {
      toast.error("Fehler beim Wiederherstellen: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      provider: formData.provider,
      mandatenNr: formData.mandatenNr,
      projectName: formData.projectName,
      location: formData.location,
      onsiteRate: Math.round(parseFloat(formData.onsiteRate) * 100),
      onsiteRateCurrency: formData.onsiteRateCurrency,
      remoteRate: Math.round(parseFloat(formData.remoteRate) * 100),
      remoteRateCurrency: formData.remoteRateCurrency,
      kmRate: Math.round(parseFloat(formData.kmRate) * 100),
      kmRateCurrency: formData.kmRateCurrency,
      mealRate: Math.round(parseFloat(formData.mealRate) * 100),
      mealRateCurrency: formData.mealRateCurrency,
      costModel: formData.costModel,
      street: formData.street || undefined,
      postalCode: formData.postalCode || undefined,
      city: formData.city || undefined,
      country: formData.country || undefined,
      vatId: formData.vatId || undefined,
    };

    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (customer: any) => {
    setEditingCustomer(customer.id);
    setFormData({
      provider: customer.provider,
      mandatenNr: customer.mandatenNr,
      projectName: customer.projectName,
      location: customer.location,
      onsiteRate: (customer.onsiteRate / 100).toFixed(2),
      onsiteRateCurrency: customer.onsiteRateCurrency || "EUR",
      remoteRate: (customer.remoteRate / 100).toFixed(2),
      remoteRateCurrency: customer.remoteRateCurrency || "EUR",
      kmRate: (customer.kmRate / 100).toFixed(2),
      kmRateCurrency: customer.kmRateCurrency || "EUR",
      mealRate: (customer.mealRate / 100).toFixed(2),
      mealRateCurrency: customer.mealRateCurrency || "EUR",
      costModel: customer.costModel,
      street: customer.street || "",
      postalCode: customer.postalCode || "",
      city: customer.city || "",
      country: customer.country || "",
      vatId: customer.vatId || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Möchten Sie diesen Kunden wirklich löschen?")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setEditingCustomer(null);
      setFormData(initialFormData);
    }
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingCustomer(null);
    setFormData(initialFormData);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Kundenverwaltung</h1>
            <p className="text-muted-foreground mt-2">Verwalten Sie Ihre Kunden und Projekte</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={showArchived ? "outline" : "default"}
              onClick={() => setShowArchived(!showArchived)}
            >
              {showArchived ? (
                <>
                  <ArchiveRestore className="h-4 w-4 mr-2" />
                  Aktive anzeigen
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4 mr-2" />
                  Archivierte anzeigen
                </>
              )}
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Neuer Kunde
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingCustomer ? "Kunde bearbeiten" : "Neuen Kunden anlegen"}
                </DialogTitle>
                <DialogDescription>
                  Geben Sie die Stammdaten für den Kunden ein
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="grid gap-6 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="provider">Provider/Firma *</Label>
                      <Input
                        id="provider"
                        value={formData.provider}
                        onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mandatenNr">Mandanten-Nr *</Label>
                      <Input
                        id="mandatenNr"
                        value={formData.mandatenNr}
                        onChange={(e) => setFormData({ ...formData, mandatenNr: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="projectName">Projekt/Kunde *</Label>
                      <Input
                        id="projectName"
                        value={formData.projectName}
                        onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location">Ort/Land *</Label>
                      <Input
                        id="location"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="onsiteRate">Onsite-Tagessatz *</Label>
                      <div className="flex gap-2">
                        <Input
                          id="onsiteRate"
                          type="number"
                          step="0.01"
                          value={formData.onsiteRate}
                          onChange={(e) => setFormData({ ...formData, onsiteRate: e.target.value })}
                          required
                          className="flex-1"
                        />
                        <Select
                          value={formData.onsiteRateCurrency}
                          onValueChange={(value) => setFormData({ ...formData, onsiteRateCurrency: value })}
                        >
                          <SelectTrigger className="w-[100px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="PLN">PLN</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="GBP">GBP</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="remoteRate">Remote-Tagessatz *</Label>
                      <div className="flex gap-2">
                        <Input
                          id="remoteRate"
                          type="number"
                          step="0.01"
                          value={formData.remoteRate}
                          onChange={(e) => setFormData({ ...formData, remoteRate: e.target.value })}
                          required
                          className="flex-1"
                        />
                        <Select
                          value={formData.remoteRateCurrency}
                          onValueChange={(value) => setFormData({ ...formData, remoteRateCurrency: value })}
                        >
                          <SelectTrigger className="w-[100px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="PLN">PLN</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="GBP">GBP</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="kmRate">Kilometerpauschale *</Label>
                      <div className="flex gap-2">
                        <Input
                          id="kmRate"
                          type="number"
                          step="0.01"
                          value={formData.kmRate}
                          onChange={(e) => setFormData({ ...formData, kmRate: e.target.value })}
                          required
                          className="flex-1"
                        />
                        <Select
                          value={formData.kmRateCurrency}
                          onValueChange={(value) => setFormData({ ...formData, kmRateCurrency: value })}
                        >
                          <SelectTrigger className="w-[100px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="PLN">PLN</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="GBP">GBP</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mealRate">Verpflegungspauschale *</Label>
                      <div className="flex gap-2">
                        <Input
                          id="mealRate"
                          type="number"
                          step="0.01"
                          value={formData.mealRate}
                          onChange={(e) => setFormData({ ...formData, mealRate: e.target.value })}
                          required
                          className="flex-1"
                        />
                        <Select
                          value={formData.mealRateCurrency}
                          onValueChange={(value) => setFormData({ ...formData, mealRateCurrency: value })}
                        >
                          <SelectTrigger className="w-[100px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="PLN">PLN</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="GBP">GBP</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="costModel">Kostenmodell *</Label>
                    <Select
                      value={formData.costModel}
                      onValueChange={(value: "exclusive" | "inclusive") =>
                        setFormData({ ...formData, costModel: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="exclusive">Exclusive (Kosten 1:1 verrechnet)</SelectItem>
                        <SelectItem value="inclusive">Inclusive (Pauschalsatz)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Billing Address Section */}
                  <div className="pt-6 border-t mt-2">
                    <h3 className="text-lg font-semibold mb-6">Rechnungsadresse (optional)</h3>
                    
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="street">Straße + Hausnummer</Label>
                        <Input
                          id="street"
                          value={formData.street}
                          onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                          placeholder="Musterstraße 123"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="postalCode">PLZ</Label>
                          <Input
                            id="postalCode"
                            value={formData.postalCode}
                            onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                            placeholder="12345"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="city">Stadt</Label>
                          <Input
                            id="city"
                            value={formData.city}
                            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                            placeholder="Berlin"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="country">Land</Label>
                          <Input
                            id="country"
                            value={formData.country}
                            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                            placeholder="Deutschland"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="vatId">USt-ID</Label>
                          <Input
                            id="vatId"
                            value={formData.vatId}
                            onChange={(e) => setFormData({ ...formData, vatId: e.target.value })}
                            placeholder="DE123456789"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleDialogClose}>
                    Abbrechen
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingCustomer ? "Aktualisieren" : "Erstellen"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Kunden</CardTitle>
                <CardDescription>Übersicht aller Kunden und Projekte</CardDescription>
              </div>
              {selectedCustomers.size > 0 && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      selectedCustomers.forEach(id => archiveMutation.mutate({ id }));
                      setSelectedCustomers(new Set());
                    }}
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    {selectedCustomers.size} archivieren
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm(`${selectedCustomers.size} Kunden wirklich löschen?`)) {
                        selectedCustomers.forEach(id => deleteMutation.mutate({ id }));
                        setSelectedCustomers(new Set());
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {selectedCustomers.size} löschen
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Lädt...</p>
            ) : customers && customers.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead>Mandanten-Nr</TableHead>
                      <TableHead>Projekt</TableHead>
                      <TableHead>Ort</TableHead>
                      <TableHead className="text-right">Onsite</TableHead>
                      <TableHead className="text-right">Remote</TableHead>
                      <TableHead>Modell</TableHead>
                      <TableHead className="w-12">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            const visibleCustomers = customers.filter(c => showArchived ? c.isArchived === 1 : c.isArchived === 0);
                            if (selectedCustomers.size === visibleCustomers.length) {
                              setSelectedCustomers(new Set());
                            } else {
                              setSelectedCustomers(new Set(visibleCustomers.map(c => c.id)));
                            }
                          }}
                        >
                          {selectedCustomers.size > 0 ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.filter(c => showArchived ? c.isArchived === 1 : c.isArchived === 0).map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            {customer.provider}
                          </div>
                        </TableCell>
                        <TableCell>{customer.mandatenNr}</TableCell>
                        <TableCell>{customer.projectName}</TableCell>
                        <TableCell>{customer.location}</TableCell>
                        <TableCell className="text-right">
                          €{(customer.onsiteRate / 100).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          €{(customer.remoteRate / 100).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                              customer.costModel === "exclusive"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-green-50 text-green-700"
                            }`}
                          >
                            {customer.costModel === "exclusive" ? "Exclusive" : "Inclusive"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              const newSelected = new Set(selectedCustomers);
                              if (newSelected.has(customer.id)) {
                                newSelected.delete(customer.id);
                              } else {
                                newSelected.add(customer.id);
                              }
                              setSelectedCustomers(newSelected);
                            }}
                          >
                            {selectedCustomers.has(customer.id) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                          </Button>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Link href={`/customers/${customer.id}`}>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Reisekosten-Analyse"
                              >
                                <TrendingUp className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(customer)}
                              title="Bearbeiten"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {customer.isArchived === 0 ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => archiveMutation.mutate({ id: customer.id })}
                                title="Archivieren"
                              >
                                <Archive className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => unarchiveMutation.mutate({ id: customer.id })}
                                title="Wiederherstellen"
                              >
                                <ArchiveRestore className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(customer.id)}
                              title="Löschen"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">Keine Kunden vorhanden</h3>
                <p className="text-muted-foreground mt-2">
                  Legen Sie Ihren ersten Kunden an, um zu beginnen.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
