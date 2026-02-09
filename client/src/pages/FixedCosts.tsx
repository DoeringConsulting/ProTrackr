import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Plus, Pencil, Trash2, Euro, CheckSquare, Square } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Settings() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCost, setSelectedCost] = useState<any>(null);
  const [selectedCosts, setSelectedCosts] = useState<Set<number>>(new Set());

  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("PLN");
  const [description, setDescription] = useState("");

  const utils = trpc.useUtils();
  const { data: fixedCosts = [], isLoading } = trpc.fixedCosts.list.useQuery();

  const createMutation = trpc.fixedCosts.create.useMutation({
    onSuccess: () => {
      utils.fixedCosts.list.invalidate();
      toast.success("Fixkosten erfolgreich erstellt");
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Fehler beim Erstellen: ${error.message}`);
    },
  });

  const updateMutation = trpc.fixedCosts.update.useMutation({
    onSuccess: () => {
      utils.fixedCosts.list.invalidate();
      toast.success("Fixkosten erfolgreich aktualisiert");
      setIsEditDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Fehler beim Aktualisieren: ${error.message}`);
    },
  });

  const deleteMutation = trpc.fixedCosts.delete.useMutation({
    onMutate: async (variables) => {
      await utils.fixedCosts.list.cancel();
      const previousCosts = utils.fixedCosts.list.getData();
      utils.fixedCosts.list.setData(undefined, (old) => {
        if (!old) return old;
        return old.filter(c => c.id !== variables.id);
      });
      return { previousCosts };
    },
    onSuccess: () => {
      toast.success("Fixkosten erfolgreich gelöscht");
      setIsDeleteDialogOpen(false);
      setSelectedCost(null);
    },
    onError: (error, variables, context) => {
      if (context?.previousCosts) {
        utils.fixedCosts.list.setData(undefined, context.previousCosts);
      }
      toast.error(`Fehler beim Löschen: ${error.message}`);
      utils.fixedCosts.list.invalidate();
    },
  });

  const resetForm = () => {
    setCategory("");
    setAmount("");
    setCurrency("PLN");
    setDescription("");
    setSelectedCost(null);
  };

  const handleCreate = () => {
    if (!category || !amount) {
      toast.error("Bitte füllen Sie alle Pflichtfelder aus");
      return;
    }

    const amountInCents = Math.round(parseFloat(amount) * 100);

    createMutation.mutate({
      currency,
      category,
      amount: amountInCents,
      description: description || undefined,
    });
  };

  const handleEdit = () => {
    if (!selectedCost || !category || !amount) {
      toast.error("Bitte füllen Sie alle Pflichtfelder aus");
      return;
    }

    const amountInCents = Math.round(parseFloat(amount) * 100);

    updateMutation.mutate({
      id: selectedCost.id,
      category,
      amount: amountInCents,
      description: description || undefined,
    });
  };

  const handleDelete = () => {
    if (!selectedCost) return;
    deleteMutation.mutate({ id: selectedCost.id });
  };

  const openEditDialog = (cost: any) => {
    setSelectedCost(cost);
    setCategory(cost.category);
    setAmount((cost.amount / 100).toFixed(2));
    setDescription(cost.description || "");
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (cost: any) => {
    setSelectedCost(cost);
    setIsDeleteDialogOpen(true);
  };

  const formatCurrency = (cents: number) => {
    return `€${(cents / 100).toFixed(2)}`;
  };

  const totalFixedCosts = fixedCosts.reduce((sum, cost) => sum + cost.amount, 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Fixkosten-Verwaltung</h1>
            <p className="text-muted-foreground">
              Verwalten Sie Ihre monatlichen Fixkosten für die Buchhaltung
            </p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Neue Fixkosten
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Fixkosten-Übersicht</CardTitle>
                <CardDescription>
                  Alle monatlichen Fixkosten für die Buchhaltung
                </CardDescription>
              </div>
              <div className="flex items-center gap-4">
                {selectedCosts.size > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm(`${selectedCosts.size} Fixkosten wirklich löschen?`)) {
                        selectedCosts.forEach(id => deleteMutation.mutate({ id }));
                        setSelectedCosts(new Set());
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {selectedCosts.size} löschen
                  </Button>
                )}
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Gesamt</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalFixedCosts)}</p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Lade Fixkosten...
              </div>
            ) : fixedCosts.length === 0 ? (
              <div className="text-center py-12">
                <Euro className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  Noch keine Fixkosten vorhanden
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Erste Fixkosten erstellen
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kategorie</TableHead>
                    <TableHead>Beschreibung</TableHead>
                    <TableHead className="text-right">Betrag (monatlich)</TableHead>
                    <TableHead className="w-12">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          if (selectedCosts.size === fixedCosts.length) {
                            setSelectedCosts(new Set());
                          } else {
                            setSelectedCosts(new Set(fixedCosts.map(c => c.id)));
                          }
                        }}
                      >
                        {selectedCosts.size > 0 ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">Aktionen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fixedCosts.map((cost) => (
                    <TableRow key={cost.id}>
                      <TableCell className="font-medium">{cost.category}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {cost.description || "-"}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(cost.amount)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            const newSelected = new Set(selectedCosts);
                            if (newSelected.has(cost.id)) {
                              newSelected.delete(cost.id);
                            } else {
                              newSelected.add(cost.id);
                            }
                            setSelectedCosts(newSelected);
                          }}
                        >
                          {selectedCosts.has(cost.id) ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(cost)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog(cost)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Neue Fixkosten erstellen</DialogTitle>
              <DialogDescription>
                Fügen Sie eine neue Fixkosten-Kategorie hinzu
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category">Kategorie *</Label>
                <Input
                  id="category"
                  placeholder="z.B. Auto, Telefon, Software, Buchhaltung"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Betrag *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Währung *</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="PLN">PLN (zł)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Beschreibung</Label>
                <Input
                  id="description"
                  placeholder="Optionale Beschreibung"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsCreateDialogOpen(false);
                resetForm();
              }}>
                Abbrechen
              </Button>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? "Erstelle..." : "Erstellen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Fixkosten bearbeiten</DialogTitle>
              <DialogDescription>
                Ändern Sie die Details der Fixkosten
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-category">Kategorie *</Label>
                <Input
                  id="edit-category"
                  placeholder="z.B. Auto, Telefon, Software, Buchhaltung"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-amount">Betrag (EUR) *</Label>
                <Input
                  id="edit-amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Beschreibung</Label>
                <Input
                  id="edit-description"
                  placeholder="Optionale Beschreibung"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsEditDialogOpen(false);
                resetForm();
              }}>
                Abbrechen
              </Button>
              <Button onClick={handleEdit} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Speichere..." : "Speichern"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Fixkosten löschen?</AlertDialogTitle>
              <AlertDialogDescription>
                Möchten Sie die Fixkosten "{selectedCost?.category}" wirklich löschen?
                Diese Aktion kann nicht rückgängig gemacht werden.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => {
                setIsDeleteDialogOpen(false);
                setSelectedCost(null);
              }}>
                Abbrechen
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-red-600 hover:bg-red-700"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Lösche..." : "Löschen"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
