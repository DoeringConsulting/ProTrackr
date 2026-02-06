import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Plus, Upload, Trash2, Edit, FileText } from "lucide-react";

export default function Expenses() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedTimeEntry, setSelectedTimeEntry] = useState<number | null>(null);
  const [category, setCategory] = useState<string>("car");
  const [distance, setDistance] = useState("");
  const [rate, setRate] = useState("");
  const [amount, setAmount] = useState("");
  const [comment, setComment] = useState("");
  const [ticketNumber, setTicketNumber] = useState("");
  const [flightNumber, setFlightNumber] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // Get current month date range
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  const { data: timeEntries = [] } = trpc.timeEntries.list.useQuery({ startDate, endDate });
  const { data: customers = [] } = trpc.customers.list.useQuery();
  
  const createExpenseMutation = trpc.expenses.create.useMutation({
    onSuccess: () => {
      toast.success("Reisekosten erfolgreich erstellt");
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const deleteExpenseMutation = trpc.expenses.delete.useMutation({
    onSuccess: () => {
      toast.success("Reisekosten gelöscht");
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const resetForm = () => {
    setSelectedTimeEntry(null);
    setCategory("car");
    setDistance("");
    setRate("");
    setAmount("");
    setComment("");
    setTicketNumber("");
    setFlightNumber("");
    setFile(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTimeEntry) {
      toast.error("Bitte wählen Sie einen Zeiteintrag aus");
      return;
    }

    const amountInCents = Math.round(parseFloat(amount) * 100);
    
    createExpenseMutation.mutate({
      timeEntryId: selectedTimeEntry,
      category: category as any,
      distance: distance ? parseInt(distance) : undefined,
      rate: rate ? Math.round(parseFloat(rate) * 100) : undefined,
      amount: amountInCents,
      currency: "EUR",
      comment: comment || undefined,
      ticketNumber: ticketNumber || undefined,
      flightNumber: flightNumber || undefined,
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      toast.info("Datei ausgewählt (Upload-Funktion wird implementiert)");
    }
  };

  const calculateAmount = () => {
    if (category === "car" && distance && rate) {
      const calculated = (parseInt(distance) * parseFloat(rate)).toFixed(2);
      setAmount(calculated);
    }
  };

  // Group expenses by time entry
  const expensesByTimeEntry = timeEntries.map(entry => {
    const customer = customers.find(c => c.id === entry.customerId);
    return {
      ...entry,
      customerName: customer?.projectName || "Unbekannt",
      expenses: [] as any[], // Will be populated by individual queries
    };
  });

  const getCategoryLabel = (cat: string) => {
    const labels: Record<string, string> = {
      car: "Auto (km-Pauschale)",
      train: "Zug",
      flight: "Flug",
      transport: "Transport",
      meal: "Verpflegungspauschale",
      hotel: "Hotel",
      food: "Gastronomie",
      fuel: "Treibstoff",
      other: "Sonstige",
    };
    return labels[cat] || cat;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reisekosten</h1>
            <p className="text-muted-foreground">
              Verwalten Sie Ihre Reisekosten und Belege
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Reisekosten hinzufügen
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Neue Reisekosten</DialogTitle>
                <DialogDescription>
                  Erfassen Sie Ihre Reisekosten für einen Zeiteintrag
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="timeEntry">Zeiteintrag *</Label>
                  <Select
                    value={selectedTimeEntry?.toString() || ""}
                    onValueChange={(value) => {
                      setSelectedTimeEntry(parseInt(value));
                      // Auto-fill rate based on customer
                      const entry = timeEntries.find(e => e.id === parseInt(value));
                      if (entry && category === "car") {
                        const customer = customers.find(c => c.id === entry.customerId);
                        if (customer) {
                          setRate((customer.kmRate / 100).toFixed(2));
                        }
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Zeiteintrag auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeEntries.map((entry) => {
                        const customer = customers.find(c => c.id === entry.customerId);
                        const dateStr = new Date(entry.date).toLocaleDateString("de-DE");
                        return (
                          <SelectItem key={entry.id} value={entry.id.toString()}>
                            {dateStr} - {customer?.projectName || "Unbekannt"}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Kategorie *</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="car">Auto (km-Pauschale)</SelectItem>
                      <SelectItem value="train">Zug</SelectItem>
                      <SelectItem value="flight">Flug</SelectItem>
                      <SelectItem value="transport">Transport</SelectItem>
                      <SelectItem value="meal">Verpflegungspauschale</SelectItem>
                      <SelectItem value="hotel">Hotel</SelectItem>
                      <SelectItem value="food">Gastronomie</SelectItem>
                      <SelectItem value="fuel">Treibstoff</SelectItem>
                      <SelectItem value="other">Sonstige</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {category === "car" && (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="distance">Distanz (km)</Label>
                      <Input
                        id="distance"
                        type="number"
                        value={distance}
                        onChange={(e) => setDistance(e.target.value)}
                        onBlur={calculateAmount}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rate">Pauschale (€/km)</Label>
                      <Input
                        id="rate"
                        type="number"
                        step="0.01"
                        value={rate}
                        onChange={(e) => setRate(e.target.value)}
                        onBlur={calculateAmount}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="amount">Betrag (€) *</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}

                {category === "train" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="ticketNumber">Ticketnummer</Label>
                      <Input
                        id="ticketNumber"
                        value={ticketNumber}
                        onChange={(e) => setTicketNumber(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="amount">Betrag (€) *</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}

                {category === "flight" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="flightNumber">Flugnummer</Label>
                      <Input
                        id="flightNumber"
                        value={flightNumber}
                        onChange={(e) => setFlightNumber(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ticketNumber">Ticketnummer</Label>
                      <Input
                        id="ticketNumber"
                        value={ticketNumber}
                        onChange={(e) => setTicketNumber(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="amount">Betrag (€) *</Label>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}

                {!["car", "train", "flight"].includes(category) && (
                  <div className="space-y-2">
                    <Label htmlFor="amount">Betrag (€) *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="comment">Kommentar</Label>
                  <Textarea
                    id="comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Zusätzliche Informationen..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="file">Beleg hochladen</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="file"
                      type="file"
                      onChange={handleFileChange}
                      accept="image/*,application/pdf"
                    />
                    {file && (
                      <Button type="button" variant="outline" size="sm">
                        <Upload className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    PDF oder Bild (max. 10 MB)
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Abbrechen
                  </Button>
                  <Button type="submit" disabled={createExpenseMutation.isPending}>
                    {createExpenseMutation.isPending ? "Wird gespeichert..." : "Speichern"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Reisekosten-Übersicht</CardTitle>
            <CardDescription>
              Alle Reisekosten des aktuellen Monats
            </CardDescription>
          </CardHeader>
          <CardContent>
            {expensesByTimeEntry.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>Keine Zeiteinträge für diesen Monat gefunden.</p>
                <p className="text-sm mt-2">Erstellen Sie zuerst Zeiteinträge in der Zeiterfassung.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {expensesByTimeEntry.map((entry) => (
                  <ExpensesByTimeEntry
                    key={entry.id}
                    timeEntry={entry}
                    onDelete={(id) => deleteExpenseMutation.mutate({ id })}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function ExpensesByTimeEntry({ 
  timeEntry, 
  onDelete 
}: { 
  timeEntry: any; 
  onDelete: (id: number) => void;
}) {
  const { data: expenses = [] } = trpc.expenses.listByTimeEntry.useQuery({ 
    timeEntryId: timeEntry.id 
  });

  const getCategoryLabel = (cat: string) => {
    const labels: Record<string, string> = {
      car: "Auto",
      train: "Zug",
      flight: "Flug",
      transport: "Transport",
      meal: "Verpflegung",
      hotel: "Hotel",
      food: "Gastronomie",
      fuel: "Treibstoff",
      other: "Sonstige",
    };
    return labels[cat] || cat;
  };

  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const dateStr = new Date(timeEntry.date).toLocaleDateString("de-DE", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold">{dateStr}</h3>
          <p className="text-sm text-muted-foreground">{timeEntry.customerName}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Gesamt</p>
          <p className="font-semibold">€{(totalExpenses / 100).toFixed(2)}</p>
        </div>
      </div>

      {expenses.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kategorie</TableHead>
              <TableHead>Details</TableHead>
              <TableHead className="text-right">Betrag</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((expense) => (
              <TableRow key={expense.id}>
                <TableCell className="font-medium">
                  {getCategoryLabel(expense.category)}
                </TableCell>
                <TableCell>
                  {expense.distance && `${expense.distance} km`}
                  {expense.ticketNumber && `Ticket: ${expense.ticketNumber}`}
                  {expense.flightNumber && `Flug: ${expense.flightNumber}`}
                  {expense.comment && (
                    <p className="text-sm text-muted-foreground">{expense.comment}</p>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  €{(expense.amount / 100).toFixed(2)}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toast.info("Bearbeiten-Funktion wird implementiert")}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm("Möchten Sie diese Reisekosten wirklich löschen?")) {
                          onDelete(expense.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">
          Keine Reisekosten erfasst
        </p>
      )}
    </div>
  );
}
