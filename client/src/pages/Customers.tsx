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
import { Archive, Building2, Edit, Plus, Trash2, ArchiveRestore, TrendingUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

type CustomerFormData = {
  provider: string;
  mandatenNr: string;
  projectName: string;
  location: string;
  onsiteRate: string;
  remoteRate: string;
  kmRate: string;
  mealRate: string;
  costModel: "exclusive" | "inclusive";
};

const initialFormData: CustomerFormData = {
  provider: "",
  mandatenNr: "",
  projectName: "",
  location: "",
  onsiteRate: "",
  remoteRate: "",
  kmRate: "",
  mealRate: "",
  costModel: "exclusive",
};

export default function Customers() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<number | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [formData, setFormData] = useState<CustomerFormData>(initialFormData);

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
      remoteRate: Math.round(parseFloat(formData.remoteRate) * 100),
      kmRate: Math.round(parseFloat(formData.kmRate) * 100),
      mealRate: Math.round(parseFloat(formData.mealRate) * 100),
      costModel: formData.costModel,
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
      remoteRate: (customer.remoteRate / 100).toFixed(2),
      kmRate: (customer.kmRate / 100).toFixed(2),
      mealRate: (customer.mealRate / 100).toFixed(2),
      costModel: customer.costModel,
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
                <div className="grid gap-4 py-4">
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
                      <Label htmlFor="onsiteRate">Onsite-Tagessatz (EUR) *</Label>
                      <Input
                        id="onsiteRate"
                        type="number"
                        step="0.01"
                        value={formData.onsiteRate}
                        onChange={(e) => setFormData({ ...formData, onsiteRate: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="remoteRate">Remote-Tagessatz (EUR) *</Label>
                      <Input
                        id="remoteRate"
                        type="number"
                        step="0.01"
                        value={formData.remoteRate}
                        onChange={(e) => setFormData({ ...formData, remoteRate: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="kmRate">Kilometerpauschale (EUR/km) *</Label>
                      <Input
                        id="kmRate"
                        type="number"
                        step="0.01"
                        value={formData.kmRate}
                        onChange={(e) => setFormData({ ...formData, kmRate: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="mealRate">Verpflegungspauschale (EUR/Tag) *</Label>
                      <Input
                        id="mealRate"
                        type="number"
                        step="0.01"
                        value={formData.mealRate}
                        onChange={(e) => setFormData({ ...formData, mealRate: e.target.value })}
                        required
                      />
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
            <CardTitle>Kunden</CardTitle>
            <CardDescription>Übersicht aller Kunden und Projekte</CardDescription>
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
