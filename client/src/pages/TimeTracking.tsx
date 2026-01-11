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
import { trpc } from "@/lib/trpc";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type TimeEntryFormData = {
  customerId: number | null;
  date: string;
  projectName: string;
  entryType: "onsite" | "remote" | "off_duty" | "business_trip";
  hours: string;
  minutes: string;
  notes: string;
};

const initialFormData: TimeEntryFormData = {
  customerId: null,
  date: "",
  projectName: "",
  entryType: "onsite",
  hours: "8",
  minutes: "0",
  notes: "",
};

const WEEKDAYS_DE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const WEEKDAYS_PL = ["Nd", "Pn", "Wt", "Śr", "Cz", "Pt", "Sb"];
const MONTHS_DE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember"
];

const WORK_TYPE_LABELS = {
  onsite: "Onsite",
  remote: "Remote",
  off_duty: "Off Duty",
  business_trip: "Business Trip",
};

const WORK_TYPE_COLORS = {
  onsite: "bg-blue-100 text-blue-800 border-blue-200",
  remote: "bg-green-100 text-green-800 border-green-200",
  off_duty: "bg-gray-100 text-gray-800 border-gray-200",
  business_trip: "bg-purple-100 text-purple-800 border-purple-200",
};

export default function TimeTracking() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<number | null>(null);
  const [formData, setFormData] = useState<TimeEntryFormData>(initialFormData);

  const utils = trpc.useUtils();
  const { data: customers } = trpc.customers.list.useQuery();
  
  const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  
  const { data: timeEntries, isLoading } = trpc.timeEntries.list.useQuery({
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  });

  const createMutation = trpc.timeEntries.create.useMutation({
    onSuccess: () => {
      utils.timeEntries.list.invalidate();
      setIsDialogOpen(false);
      setFormData(initialFormData);
      toast.success("Zeiteintrag erfolgreich erstellt");
    },
    onError: (error) => {
      toast.error("Fehler beim Erstellen: " + error.message);
    },
  });

  const updateMutation = trpc.timeEntries.update.useMutation({
    onSuccess: () => {
      utils.timeEntries.list.invalidate();
      setIsDialogOpen(false);
      setEditingEntry(null);
      setFormData(initialFormData);
      toast.success("Zeiteintrag erfolgreich aktualisiert");
    },
    onError: (error) => {
      toast.error("Fehler beim Aktualisieren: " + error.message);
    },
  });

  const deleteMutation = trpc.timeEntries.delete.useMutation({
    onSuccess: () => {
      utils.timeEntries.list.invalidate();
      toast.success("Zeiteintrag erfolgreich gelöscht");
    },
    onError: (error) => {
      toast.error("Fehler beim Löschen: " + error.message);
    },
  });

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleAddEntry = (date: Date) => {
    const selectedCustomer = customers?.[0];
    setFormData({
      ...initialFormData,
      date: date.toISOString().split('T')[0],
      customerId: selectedCustomer?.id || null,
      projectName: selectedCustomer?.projectName || "",
    });
    setIsDialogOpen(true);
  };

  const handleEditEntry = (entry: any) => {
    setEditingEntry(entry.id);
    const totalMinutes = entry.hours;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    setFormData({
      customerId: entry.customerId,
      date: new Date(entry.date).toISOString().split('T')[0],
      projectName: entry.projectName,
      entryType: entry.entryType,
      hours: hours.toString(),
      minutes: minutes.toString(),
      notes: entry.notes || "",
    });
    setIsDialogOpen(true);
  };

  const handleDeleteEntry = (id: number) => {
    if (confirm("Möchten Sie diesen Zeiteintrag wirklich löschen?")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customerId) {
      toast.error("Bitte wählen Sie einen Kunden aus");
      return;
    }

    const totalMinutes = parseInt(formData.hours) * 60 + parseInt(formData.minutes);
    const manDays = totalMinutes / 480; // 8 hours = 1 man day

    const selectedDate = new Date(formData.date);
    const weekdayDe = WEEKDAYS_DE[selectedDate.getDay()];
    const weekdayPl = WEEKDAYS_PL[selectedDate.getDay()];

    // Get customer to calculate rate
    const customer = customers?.find(c => c.id === formData.customerId);
    const rate = formData.entryType === "onsite" ? (customer?.onsiteRate || 0) : (customer?.remoteRate || 0);
    const calculatedAmount = Math.round((manDays * rate));

    const data = {
      customerId: formData.customerId,
      date: formData.date,
      weekday: `${weekdayDe}/${weekdayPl}`,
      projectName: formData.projectName,
      entryType: formData.entryType,
      hours: totalMinutes,
      rate: rate,
      calculatedAmount: calculatedAmount,
      manDays: Math.round(manDays * 1000),
      description: formData.notes,
    };

    if (editingEntry) {
      updateMutation.mutate({ id: editingEntry, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingEntry(null);
    setFormData(initialFormData);
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const getEntriesForDate = (date: Date) => {
    if (!timeEntries) return [];
    const dateStr = date.toISOString().split('T')[0];
    return timeEntries.filter(entry => {
      const entryDate = new Date(entry.date).toISOString().split('T')[0];
      return entryDate === dateStr;
    });
  };

  const calculateDayTotal = (entries: any[]) => {
    const totalMinutes = entries.reduce((sum, entry) => sum + entry.hours, 0);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}h`;
  };

  const calculateMonthTotal = () => {
    if (!timeEntries) return { hours: "0:00h", manDays: "0.000 MT" };
    const totalMinutes = timeEntries.reduce((sum, entry) => sum + entry.hours, 0);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const manDays = (totalMinutes / 480).toFixed(3);
    return { hours: `${hours}:${minutes.toString().padStart(2, '0')}h`, manDays: `${manDays} MT` };
  };

  const days = getDaysInMonth();
  const monthTotal = calculateMonthTotal();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Zeiterfassung</h1>
            <p className="text-muted-foreground mt-2">Erfassen Sie Ihre Arbeitszeiten</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  {MONTHS_DE[currentDate.getMonth()]} {currentDate.getFullYear()}
                </CardTitle>
                <CardDescription>
                  Gesamt: {monthTotal.hours} ({monthTotal.manDays})
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handlePreviousMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Lädt...</p>
            ) : (
              <div className="grid grid-cols-7 gap-2">
                {/* Weekday headers */}
                {WEEKDAYS_DE.map((day, idx) => (
                  <div key={idx} className="text-center font-semibold text-sm p-2 text-muted-foreground">
                    {day}
                  </div>
                ))}
                
                {/* Calendar days */}
                {days.map((day, idx) => {
                  if (!day) {
                    return <div key={`empty-${idx}`} className="min-h-[120px]" />;
                  }
                  
                  const entries = getEntriesForDate(day);
                  const isToday = day.toDateString() === new Date().toDateString();
                  
                  return (
                    <div
                      key={idx}
                      className={`min-h-[120px] border rounded-lg p-2 ${
                        isToday ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-medium ${isToday ? "text-primary" : ""}`}>
                          {day.getDate()}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => handleAddEntry(day)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      <div className="space-y-1">
                        {entries.map((entry) => (
                          <div
                            key={entry.id}
                            className={`text-xs p-1 rounded border cursor-pointer ${WORK_TYPE_COLORS[entry.entryType as keyof typeof WORK_TYPE_COLORS]}`}
                            onClick={() => handleEditEntry(entry)}
                          >
                            <div className="font-medium truncate">{entry.projectName}</div>
                            <div className="text-[10px]">
                              {Math.floor(entry.hours / 60)}:{(entry.hours % 60).toString().padStart(2, '0')}h
                            </div>
                          </div>
                        ))}
                        {entries.length > 0 && (
                          <div className="text-[10px] font-semibold text-muted-foreground pt-1 border-t">
                            {calculateDayTotal(entries)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingEntry ? "Zeiteintrag bearbeiten" : "Neuer Zeiteintrag"}
              </DialogTitle>
              <DialogDescription>
                Erfassen Sie Ihre Arbeitszeit für den ausgewählten Tag
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Datum *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customer">Kunde/Projekt *</Label>
                    <Select
                      value={formData.customerId?.toString() || ""}
                      onValueChange={(value) => {
                        const customer = customers?.find(c => c.id === parseInt(value));
                        setFormData({
                          ...formData,
                          customerId: parseInt(value),
                          projectName: customer?.projectName || "",
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Kunde wählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers?.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id.toString()}>
                            {customer.projectName} ({customer.provider})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="workType">Arbeitstyp *</Label>
                  <Select
                    value={formData.entryType}
                    onValueChange={(value: any) => setFormData({ ...formData, entryType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="onsite">Onsite</SelectItem>
                      <SelectItem value="remote">Remote</SelectItem>
                      <SelectItem value="off_duty">Off Duty</SelectItem>
                      <SelectItem value="business_trip">Business Trip</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hours">Stunden *</Label>
                    <Input
                      id="hours"
                      type="number"
                      min="0"
                      max="24"
                      value={formData.hours}
                      onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minutes">Minuten *</Label>
                    <Input
                      id="minutes"
                      type="number"
                      min="0"
                      max="59"
                      value={formData.minutes}
                      onChange={(e) => setFormData({ ...formData, minutes: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notizen</Label>
                  <Input
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Optional"
                  />
                </div>

                <div className="bg-muted p-3 rounded-lg">
                  <div className="text-sm font-medium">Berechnung:</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Manntage: {((parseInt(formData.hours || "0") * 60 + parseInt(formData.minutes || "0")) / 480).toFixed(3)} MT
                  </div>
                </div>
              </div>
              <DialogFooter>
                {editingEntry && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => {
                      handleDeleteEntry(editingEntry);
                      handleDialogClose();
                    }}
                  >
                    Löschen
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={handleDialogClose}>
                  Abbrechen
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingEntry ? "Aktualisieren" : "Erstellen"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
