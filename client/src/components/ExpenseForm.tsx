import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";

type ExpenseCategory = "car" | "train" | "flight" | "taxi" | "hotel" | "fuel" | "meal" | "other";

type ExpenseItem = {
  id: string;
  category: ExpenseCategory;
  amount: string;
  currency: string;
  comment: string;
  // Car specific
  distance?: string;
  rate?: string;
  // Flight/Train specific
  ticketNumber?: string;
  flightNumber?: string;
  departureTime?: string;
  arrivalTime?: string;
  // Hotel specific
  checkInDate?: string;
  checkOutDate?: string;
  // Fuel specific
  liters?: string;
  pricePerLiter?: string;
};

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  car: "Mietwagen",
  train: "Zug",
  flight: "Flug",
  taxi: "Taxi",
  hotel: "Hotel",
  fuel: "Tanken",
  meal: "Bewirtung",
  other: "Sonstiges",
};

const CURRENCIES = [
  { value: "EUR", label: "€ EUR" },
  { value: "PLN", label: "zł PLN" },
  { value: "USD", label: "$ USD" },
  { value: "CHF", label: "CHF" },
  { value: "GBP", label: "£ GBP" },
];

interface ExpenseFormProps {
  date: Date;
  timeEntryId?: number; // Optional: Falls bereits ein TimeEntry existiert
  onSubmit: (expenses: ExpenseItem[]) => void;
  onCancel: () => void;
}

export default function ExpenseForm({ date, timeEntryId, onSubmit, onCancel }: ExpenseFormProps) {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([
    {
      id: crypto.randomUUID(),
      category: "car",
      amount: "",
      currency: "EUR",
      comment: "",
    },
  ]);

  const addExpense = () => {
    setExpenses([
      ...expenses,
      {
        id: crypto.randomUUID(),
        category: "car",
        amount: "",
        currency: "EUR",
        comment: "",
      },
    ]);
  };

  const removeExpense = (id: string) => {
    if (expenses.length > 1) {
      setExpenses(expenses.filter((e) => e.id !== id));
    }
  };

  const updateExpense = (id: string, field: keyof ExpenseItem, value: string) => {
    setExpenses(
      expenses.map((e) => {
        if (e.id === id) {
          return { ...e, [field]: value };
        }
        return e;
      })
    );
  };

  const handleCategoryChange = (id: string, category: ExpenseCategory) => {
    setExpenses(
      expenses.map((e) => {
        if (e.id === id) {
          // Reset category-specific fields when changing category
          return {
            id: e.id,
            category,
            amount: e.amount,
            currency: e.currency,
            comment: e.comment,
          };
        }
        return e;
      })
    );
  };

  const calculateCarAmount = (expense: ExpenseItem) => {
    if (expense.distance && expense.rate) {
      const calculated = (parseFloat(expense.distance) * parseFloat(expense.rate)).toFixed(2);
      updateExpense(expense.id, "amount", calculated);
    }
  };

  const calculateFuelAmount = (expense: ExpenseItem) => {
    if (expense.liters && expense.pricePerLiter) {
      const calculated = (parseFloat(expense.liters) * parseFloat(expense.pricePerLiter)).toFixed(2);
      updateExpense(expense.id, "amount", calculated);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[ExpenseForm] handleSubmit called', expenses);
    
    // Validate that all expenses have required fields
    const isValid = expenses.every((e) => e.category && e.amount);
    console.log('[ExpenseForm] isValid:', isValid, expenses);
    if (!isValid) {
      console.log('[ExpenseForm] Validation failed!');
      return;
    }

    console.log('[ExpenseForm] Calling onSubmit with:', expenses);
    onSubmit(expenses);
  };

  const renderCategoryFields = (expense: ExpenseItem) => {
    switch (expense.category) {
      case "car":
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor={`distance-${expense.id}`}>Kilometer</Label>
                <Input
                  id={`distance-${expense.id}`}
                  type="number"
                  step="1"
                  placeholder="z.B. 150"
                  value={expense.distance || ""}
                  onChange={(e) => updateExpense(expense.id, "distance", e.target.value)}
                  onBlur={() => calculateCarAmount(expense)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`rate-${expense.id}`}>€ pro km</Label>
                <Input
                  id={`rate-${expense.id}`}
                  type="number"
                  step="0.01"
                  placeholder="z.B. 0.30"
                  value={expense.rate || ""}
                  onChange={(e) => updateExpense(expense.id, "rate", e.target.value)}
                  onBlur={() => calculateCarAmount(expense)}
                />
              </div>
            </div>
          </>
        );

      case "flight":
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor={`flightNumber-${expense.id}`}>Flugnummer</Label>
                <Input
                  id={`flightNumber-${expense.id}`}
                  type="text"
                  placeholder="z.B. LH1234"
                  value={expense.flightNumber || ""}
                  onChange={(e) => updateExpense(expense.id, "flightNumber", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`ticketNumber-${expense.id}`}>Ticket-Nr.</Label>
                <Input
                  id={`ticketNumber-${expense.id}`}
                  type="text"
                  placeholder="Optional"
                  value={expense.ticketNumber || ""}
                  onChange={(e) => updateExpense(expense.id, "ticketNumber", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor={`departureTime-${expense.id}`}>Abflugzeit</Label>
                <Input
                  id={`departureTime-${expense.id}`}
                  type="time"
                  value={expense.departureTime || ""}
                  onChange={(e) => updateExpense(expense.id, "departureTime", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`arrivalTime-${expense.id}`}>Ankunftszeit</Label>
                <Input
                  id={`arrivalTime-${expense.id}`}
                  type="time"
                  value={expense.arrivalTime || ""}
                  onChange={(e) => updateExpense(expense.id, "arrivalTime", e.target.value)}
                />
              </div>
            </div>
          </>
        );

      case "train":
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor={`ticketNumber-${expense.id}`}>Ticket-Nr.</Label>
                <Input
                  id={`ticketNumber-${expense.id}`}
                  type="text"
                  placeholder="Optional"
                  value={expense.ticketNumber || ""}
                  onChange={(e) => updateExpense(expense.id, "ticketNumber", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`departureTime-${expense.id}`}>Abfahrtszeit</Label>
                <Input
                  id={`departureTime-${expense.id}`}
                  type="time"
                  value={expense.departureTime || ""}
                  onChange={(e) => updateExpense(expense.id, "departureTime", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`arrivalTime-${expense.id}`}>Ankunftszeit</Label>
              <Input
                id={`arrivalTime-${expense.id}`}
                type="time"
                value={expense.arrivalTime || ""}
                onChange={(e) => updateExpense(expense.id, "arrivalTime", e.target.value)}
              />
            </div>
          </>
        );

      case "hotel":
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`checkInDate-${expense.id}`}>Check-in</Label>
              <Input
                id={`checkInDate-${expense.id}`}
                type="date"
                value={expense.checkInDate || ""}
                onChange={(e) => updateExpense(expense.id, "checkInDate", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`checkOutDate-${expense.id}`}>Check-out</Label>
              <Input
                id={`checkOutDate-${expense.id}`}
                type="date"
                value={expense.checkOutDate || ""}
                onChange={(e) => updateExpense(expense.id, "checkOutDate", e.target.value)}
              />
            </div>
          </div>
        );

      case "fuel":
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`liters-${expense.id}`}>Liter</Label>
              <Input
                id={`liters-${expense.id}`}
                type="number"
                step="0.01"
                placeholder="z.B. 45.5"
                value={expense.liters || ""}
                onChange={(e) => updateExpense(expense.id, "liters", e.target.value)}
                onBlur={() => calculateFuelAmount(expense)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`pricePerLiter-${expense.id}`}>€ pro Liter</Label>
              <Input
                id={`pricePerLiter-${expense.id}`}
                type="number"
                step="0.001"
                placeholder="z.B. 1.599"
                value={expense.pricePerLiter || ""}
                onChange={(e) => updateExpense(expense.id, "pricePerLiter", e.target.value)}
                onBlur={() => calculateFuelAmount(expense)}
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('de-DE', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }).format(date);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center pb-4 border-b">
        <h3 className="text-lg font-semibold">Reisekosten</h3>
        <p className="text-sm text-muted-foreground">{formatDate(date)}</p>
      </div>
      <div className="space-y-4">
        {expenses.map((expense, index) => (
          <Card key={expense.id} className="relative">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold">Position {index + 1}</h4>
                {expenses.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeExpense(expense.id)}
                    className="h-8 w-8"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor={`category-${expense.id}`}>Kostenart</Label>
                <Select
                  value={expense.category}
                  onValueChange={(value) => handleCategoryChange(expense.id, value as ExpenseCategory)}
                >
                  <SelectTrigger id={`category-${expense.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {renderCategoryFields(expense)}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor={`amount-${expense.id}`}>Betrag</Label>
                  <Input
                    id={`amount-${expense.id}`}
                    type="number"
                    step="0.01"
                    placeholder="z.B. 45.50"
                    value={expense.amount}
                    onChange={(e) => updateExpense(expense.id, "amount", e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`currency-${expense.id}`}>Währung</Label>
                  <Select
                    value={expense.currency}
                    onValueChange={(value) => updateExpense(expense.id, "currency", value)}
                  >
                    <SelectTrigger id={`currency-${expense.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((curr) => (
                        <SelectItem key={curr.value} value={curr.value}>
                          {curr.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`comment-${expense.id}`}>Kommentar (optional)</Label>
                <Textarea
                  id={`comment-${expense.id}`}
                  placeholder="Zusätzliche Informationen..."
                  value={expense.comment}
                  onChange={(e) => updateExpense(expense.id, "comment", e.target.value)}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={addExpense}
        className="w-full"
      >
        <Plus className="h-4 w-4 mr-2" />
        Weitere Position hinzufügen
      </Button>

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Abbrechen
        </Button>
        <Button 
          type="button" 
          className="flex-1"
          onClick={(e) => {
            e.preventDefault();
            handleSubmit(e as any);
          }}
        >
          Speichern
        </Button>
      </div>
    </form>
  );
}
