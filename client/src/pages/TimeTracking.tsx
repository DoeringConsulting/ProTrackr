import DashboardLayout from "@/components/DashboardLayout";
import { ExpenseFormInline } from "@/components/ExpenseFormInline";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { ChevronLeft, ChevronRight, Plus, Copy, Clock, Receipt, X } from "lucide-react";
import { useState, useEffect } from "react";
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

type CopyScope = "day" | "week" | "month";

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
const WEEKDAYS_PL = ["Nd", "Pn", "Wt", "Sr", "Cz", "Pt", "Sb"];
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

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  car: "Auto",
  train: "ÖPNV",
  flight: "Flug",
  taxi: "Taxi",
  transport: "Transport",
  meal: "Verpflegung",
  hotel: "Hotel",
  food: "Essen",
  fuel: "Kraftstoff",
  other: "Sonstiges",
};

// Tages-Nuancen: 1. Eintrag Basisfarbe, 2./3. Eintrag dunkler (max. 2 Nuancen).
const PROJECT_ENTRY_TONE_CLASSES = [
  "bg-[#dcefe4] text-[#2f4a3c] border-[#c3decf]",
  "bg-[#cfe7d9] text-[#2a4336] border-[#b6d6c3]",
  "bg-[#c2e0ce] text-[#243b2f] border-[#a7cdb6]",
] as const;

const EXPENSE_ENTRY_TONE_CLASSES = [
  "bg-[#f6ead6] text-[#5b4830] border-[#ead6b8]",
  "bg-[#f1e0c8] text-[#4f3f2b] border-[#dfc7a6]",
  "bg-[#ebd6b9] text-[#433623] border-[#d3b992]",
] as const;

function getToneClass(toneClasses: readonly string[], index: number): string {
  const clampedIndex = Math.max(0, Math.min(index, toneClasses.length - 1));
  return toneClasses[clampedIndex] ?? toneClasses[0];
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateKey(value: string | Date): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(trimmed)) {
      const [dd, mm, yyyy] = trimmed.split(".");
      return `${yyyy}-${mm}-${dd}`;
    }
    if (trimmed.includes("T")) return trimmed.split("T")[0] ?? trimmed;
    if (trimmed.includes(" ")) return trimmed.split(" ")[0] ?? trimmed;
    return trimmed;
  }
  return formatLocalDate(value);
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function addDays(dateKey: string, days: number): string {
  const base = parseDateKey(dateKey);
  base.setDate(base.getDate() + days);
  return formatLocalDate(base);
}

function dayDiff(startDateKey: string, endDateKey: string): number {
  const start = parseDateKey(startDateKey).getTime();
  const end = parseDateKey(endDateKey).getTime();
  return Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24)));
}

function addMonthsClamped(dateKey: string, months: number): string {
  const source = parseDateKey(dateKey);
  const y = source.getFullYear();
  const m = source.getMonth();
  const d = source.getDate();
  const targetStart = new Date(y, m + months, 1);
  const lastDay = new Date(targetStart.getFullYear(), targetStart.getMonth() + 1, 0).getDate();
  return formatLocalDate(
    new Date(targetStart.getFullYear(), targetStart.getMonth(), Math.min(d, lastDay))
  );
}

function getScopeRanges(anchorDateKey: string, scope: CopyScope) {
  const anchor = parseDateKey(anchorDateKey);
  let sourceStart = formatLocalDate(anchor);
  let sourceEnd = formatLocalDate(anchor);
  let targetStart = addDays(sourceStart, 1);
  let targetEnd = addDays(sourceEnd, 1);

  if (scope === "week") {
    const day = anchor.getDay();
    const diffToMonday = (day + 6) % 7;
    const monday = new Date(anchor);
    monday.setDate(anchor.getDate() - diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sourceStart = formatLocalDate(monday);
    sourceEnd = formatLocalDate(sunday);
    targetStart = addDays(sourceStart, 7);
    targetEnd = addDays(sourceEnd, 7);
  } else if (scope === "month") {
    const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    sourceStart = formatLocalDate(monthStart);
    sourceEnd = formatLocalDate(monthEnd);
    targetStart = addMonthsClamped(sourceStart, 1);
    targetEnd = addMonthsClamped(sourceEnd, 1);
  }

  return { sourceStart, sourceEnd, targetStart, targetEnd };
}

type ExpenseCalendarItem = {
  id: number;
  category: string;
  amount: number;
  currency?: string | null;
  comment?: string | null;
  date: string | Date;
  checkInDate?: string | Date | null;
  checkOutDate?: string | Date | null;
  flightRouteType?: "domestic" | "international" | string | null;
  departureTime?: string | null;
  arrivalTime?: string | null;
  _showAmount?: boolean;
  _subLabel?: string;
  _flightLeg?: "outbound" | "return";
};

export default function TimeTracking() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<number | null>(null);
  const [formData, setFormData] = useState<TimeEntryFormData>(initialFormData);
  const [isBulkCopyDialogOpen, setIsBulkCopyDialogOpen] = useState(false);
  const [bulkCopySourceId, setBulkCopySourceId] = useState<number | null>(null);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [isScopeCopyDialogOpen, setIsScopeCopyDialogOpen] = useState(false);
  const [copyScope, setCopyScope] = useState<CopyScope>("day");
  const [copyAnchorDate, setCopyAnchorDate] = useState(formatLocalDate(new Date()));
  const [isExpensesDialogOpen, setIsExpensesDialogOpen] = useState(false);
  const [selectedExpenseDate, setSelectedExpenseDate] = useState<Date | null>(null);
  const [expandedDay, setExpandedDay] = useState<Date | null>(null);
  const [tempExpenseAmount, setTempExpenseAmount] = useState('');
  const [tempExpenseCategory, setTempExpenseCategory] = useState('car');
  const [tempExpenseCurrency, setTempExpenseCurrency] = useState('EUR');
  const [tempExpenseComment, setTempExpenseComment] = useState('');
  const [tempExpenseDate, setTempExpenseDate] = useState('');
  const [tempFlightReturnDate, setTempFlightReturnDate] = useState('');
  const [tempFlightRouteType, setTempFlightRouteType] = useState<'domestic' | 'international'>('domestic');
  const [tempFlightTravelStart, setTempFlightTravelStart] = useState('');
  const [tempFlightTravelEnd, setTempFlightTravelEnd] = useState('');
  const [tempHotelCheckInDate, setTempHotelCheckInDate] = useState('');
  const [tempHotelNights, setTempHotelNights] = useState('1');
  const [tempFullDay, setTempFullDay] = useState(false);
  const [editingExpense, setEditingExpense] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      console.log('[TimeTracking] Mobile detection:', mobile, 'width:', window.innerWidth);
      setIsMobile(mobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const utils = trpc.useUtils();
  const { data: customers } = trpc.customers.list.useQuery();
  
  const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  
  const { data: timeEntries, isLoading } = trpc.timeEntries.list.useQuery({
    startDate: formatLocalDate(startDate),
    endDate: formatLocalDate(endDate),
  });

  const { data: expenses } = trpc.expenses.list.useQuery({
    startDate: formatLocalDate(startDate),
    endDate: formatLocalDate(endDate),
  });  const createExpenseMutation = trpc.expenses.create.useMutation({
    onSuccess: () => {
      utils.expenses.list.invalidate();
    },
  });

  const updateExpenseMutation = trpc.expenses.update.useMutation({
    onSuccess: () => {
      utils.expenses.list.invalidate();
      setIsExpensesDialogOpen(false);
      setEditingExpense(null);
      toast.success("Reisekosten erfolgreich aktualisiert");
    },
  });

  const deleteExpenseMutation = trpc.expenses.delete.useMutation({
    onSuccess: () => {
      utils.expenses.list.invalidate();
      setIsExpensesDialogOpen(false);
      setEditingExpense(null);
      toast.success("Reisekosten erfolgreich gelöscht");
    },
  });

  const createMutation = trpc.timeEntries.create.useMutation({
    onSuccess: () => {
      utils.timeEntries.list.invalidate();
      setIsDialogOpen(false);
      setFormData(initialFormData);
      toast.success("Zeiteintrag erfolgreich erstellt");
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
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
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const deleteMutation = trpc.timeEntries.delete.useMutation({
    onSuccess: () => {
      utils.timeEntries.list.invalidate();
      toast.success("Zeiteintrag erfolgreich gelöscht");
    },
    onError: (error) => {
      toast.error(`Fehler: ${error.message}`);
    },
  });

  const copyRangeMutation = trpc.timeEntries.copyRangeToNext.useMutation({
    onSuccess: (result) => {
      utils.timeEntries.list.invalidate();
      utils.expenses.list.invalidate();
      const skipSuffix =
        result.skippedExpenses > 0 ? `, ${result.skippedExpenses} Reisekosten übersprungen` : "";
      toast.success(
        `Kopiert: ${result.copiedTimeEntries} Zeiteinträge, ${result.copiedExpenses} Reisekosten${skipSuffix}`
      );
      setIsScopeCopyDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Kopiervorgang fehlgeschlagen: ${error.message}`);
    },
  });

  const resetExpenseFormState = (date?: Date) => {
    const defaultDate = date ? formatLocalDate(date) : "";
    setEditingExpense(null);
    setTempExpenseAmount("");
    setTempExpenseCategory("car");
    setTempExpenseCurrency("EUR");
    setTempExpenseComment("");
    setTempExpenseDate(defaultDate);
    setTempFlightReturnDate("");
    setTempFlightRouteType("domestic");
    setTempFlightTravelStart("");
    setTempFlightTravelEnd("");
    setTempHotelCheckInDate(defaultDate);
    setTempHotelNights("1");
    setTempFullDay(false);
  };

  // Bulk copy functionality temporarily disabled

  const handlePreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];
    
    // Add empty slots for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const toggleDateSelection = (dateStr: string) => {
    setSelectedDates(prev => {
      if (prev.includes(dateStr)) {
        return prev.filter(d => d !== dateStr);
      } else {
        return [...prev, dateStr];
      }
    });
  };

  const handleAddEntry = (date: Date) => {
    const selectedCustomer = customers?.[0];
    // Format date as YYYY-MM-DD in local timezone to avoid UTC conversion issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    setFormData({
      ...initialFormData,
      date: dateStr,
      customerId: selectedCustomer?.id || null,
      projectName: selectedCustomer?.projectName || "",
    });
    setIsDialogOpen(true);
  };

  const handleAddExpenses = (date: Date) => {
    setSelectedExpenseDate(date);
    resetExpenseFormState(date);
    setIsExpensesDialogOpen(true);
  };

  const handleEditEntry = (entry: any) => {
    setEditingEntry(entry.id);
    const totalMinutes = entry.hours;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    // Parse using local date parts to avoid UTC timezone shifts.
    const entryDate = getDateKey(entry.date as string | Date);
    
    setFormData({
      customerId: entry.customerId,
      date: entryDate,
      projectName: entry.projectName,
      entryType: entry.entryType,
      hours: hours.toString(),
      minutes: minutes.toString(),
      notes: entry.description || entry.notes || "",
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

    const selectedDate = new Date(formData.date);
    const weekdayDe = WEEKDAYS_DE[selectedDate.getDay()];
    const weekdayPl = WEEKDAYS_PL[selectedDate.getDay()];

    // Get customer to calculate rate
    const customer = customers?.find(c => c.id === formData.customerId);
    const standardDayHours = Math.max(1, Number(customer?.standardDayHours ?? 800) / 100);
    const baseMinutesPerManDay = standardDayHours * 60;
    const manDays = totalMinutes / baseMinutesPerManDay;
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

  const handleBulkCopy = (sourceId: number) => {
    setBulkCopySourceId(sourceId);
    setSelectedDates([]);
    setIsBulkCopyDialogOpen(true);
  };

  const handleBulkCopySubmit = () => {
    if (!bulkCopySourceId || selectedDates.length === 0) {
      toast.error("Bitte wählen Sie mindestens einen Tag aus");
      return;
    }
    toast.info("Bulk-Kopierfunktion wird bald verfügbar sein");
    setIsBulkCopyDialogOpen(false);
  };

  const handleScopeCopySubmit = () => {
    if (!copyAnchorDate) {
      toast.error("Bitte ein Datum auswählen");
      return;
    }
    copyRangeMutation.mutate({
      scope: copyScope,
      anchorDate: copyAnchorDate,
    });
  };

  const getEntriesForDate = (date: Date) => {
    if (!timeEntries) return [];
    const dateStr = formatLocalDate(date);
    
    return timeEntries.filter(entry => {
      const entryDate = getDateKey(entry.date as string | Date);
      return entryDate === dateStr;
    });
  };

  const getExpensesForDate = (date: Date) => {
    if (!expenses) return [];
    const dateStr = formatLocalDate(date);

    return expenses.flatMap((expense: any) => {
      const primaryDate = getDateKey(expense.date as string | Date);
      const checkInDate = expense.checkInDate
        ? getDateKey(expense.checkInDate as string | Date)
        : primaryDate;
      const checkOutDate = expense.checkOutDate
        ? getDateKey(expense.checkOutDate as string | Date)
        : checkInDate;
      const baseItem: ExpenseCalendarItem = { ...expense, _showAmount: true };

      if (expense.category === "flight") {
        const items: ExpenseCalendarItem[] = [];
        if (primaryDate === dateStr) {
          items.push({
            ...baseItem,
            _showAmount: true,
            _subLabel: "Hinflug",
            _flightLeg: "outbound",
          });
        }
        if (expense.checkOutDate) {
          const returnDate = getDateKey(expense.checkOutDate as string | Date);
          if (returnDate === dateStr && returnDate !== primaryDate) {
            items.push({
              ...baseItem,
              _showAmount: false,
              _subLabel: "Rückflug",
              _flightLeg: "return",
            });
          }
        }
        return items;
      }

      if (expense.category === "hotel") {
        if (dateStr < checkInDate || dateStr > checkOutDate) {
          return [];
        }
        return [
          {
            ...baseItem,
            _showAmount: dateStr === checkInDate,
            _subLabel: dateStr === checkInDate ? "Check-in" : "Hotelnacht",
          },
        ];
      }

      if (primaryDate === dateStr) {
        return [{ ...baseItem, _showAmount: true }];
      }
      return [];
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
    const manDays = (
      timeEntries.reduce((sum, entry) => sum + Number(entry.manDays || 0), 0) / 1000
    ).toFixed(3);
    return { hours: `${hours}:${minutes.toString().padStart(2, '0')}h`, manDays: `${manDays} MT` };
  };

  const handleDayClick = (day: Date) => {
    console.log('[DEBUG] handleDayClick called for day:', day.toISOString());
    console.log('[DEBUG] Current expandedDay:', expandedDay?.toISOString());
    if (expandedDay && expandedDay.getTime() === day.getTime()) {
      console.log('[DEBUG] Collapsing day');
      setExpandedDay(null);
    } else {
      console.log('[DEBUG] Expanding day');
      setExpandedDay(day);
    }
  };

  const days = getDaysInMonth();
  const monthTotal = calculateMonthTotal();
  const copyRanges = getScopeRanges(copyAnchorDate, copyScope);
  const computedHotelCheckOutDate =
    tempHotelCheckInDate && Number(tempHotelNights) >= 0
      ? addDays(tempHotelCheckInDate, Number(tempHotelNights))
      : "";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Zeiterfassung</h1>
            <p className="text-muted-foreground mt-2">Erfassen Sie Ihre Arbeitszeiten</p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setCopyAnchorDate(formatLocalDate(expandedDay || new Date()));
              setIsScopeCopyDialogOpen(true);
            }}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy & Paste
          </Button>
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
                  const dayExpenses = getExpensesForDate(day);
                  const isToday = day.toDateString() === new Date().toDateString();
                  const isExpanded = expandedDay && expandedDay.getTime() === day.getTime();
                  
                  // Combine entries and expenses for display
                  const allItems = [
                    ...entries.map(e => ({ type: 'time', data: e })),
                    ...dayExpenses.map(e => ({ type: 'expense', data: e }))
                  ];
                  
                  // Desktop: zeige alle Einträge mit Scroll, Mobile: nur 2 im collapsed state
                  const displayItems = isMobile ? (isExpanded ? allItems : allItems.slice(0, 2)) : allItems;
                  const hasMore = isMobile && allItems.length > 2;
                  
                  return (
                    <div
                      key={idx}
                      className={`min-h-[120px] md:min-h-[120px] min-h-[80px] border rounded-lg p-2 transition-all bg-white ${
                        isToday ? "border-primary" : "border-border"
                      } ${isExpanded ? "fixed md:relative z-50 shadow-2xl md:max-h-[240px] max-h-[320px] md:-translate-y-4 left-4 right-4 md:left-auto md:right-auto top-20 md:top-auto" : "relative"}`}
                        onClick={(e) => {
                          // Nur wenn nicht auf Button/Dropdown geklickt wurde
                          if ((e.target as HTMLElement).closest('button, [role="menuitem"]')) {
                            return;
                          }
                          console.log('[DEBUG] Kachel onClick triggered for day:', day.getDate());
                          console.log('[DEBUG] entries.length:', entries.length, 'dayExpenses.length:', dayExpenses.length);
                          if (entries.length > 0 || dayExpenses.length > 0) {
                            handleDayClick(day);
                          } else {
                            console.log('[DEBUG] No entries/expenses, skipping handleDayClick');
                          }
                        }}
                        style={(entries.length > 0 || dayExpenses.length > 0) ? { cursor: 'pointer' } : {}}
                      >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm md:text-sm text-xs font-medium ${isToday ? "text-primary" : ""}`}>
                            {day.getDate()}
                          </span>
                          {isExpanded && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 ml-auto"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedDay(null);
                              }}
                              title="Schließen"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                          {/* Desktop: Badges */}
                          {!isMobile && entries.length > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--badge-inclusive-bg)] text-[var(--badge-inclusive-text)] font-medium">
                              {entries.length}
                            </span>
                          )}
                          {!isMobile && dayExpenses.length > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--badge-exclusive-bg)] text-[var(--badge-exclusive-text)] font-medium">
                              {dayExpenses.length}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {/* Mobile: Farbige Kreis-Icons immer sichtbar */}
                          {isMobile && (
                            <>
                              {entries.length > 0 && (
                              <div 
                                className="flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold"
                                style={{ 
                                  backgroundColor: '#dcefe4',
                                  color: '#2f4a3c',
                                  opacity: 1,
                                  border: '2px solid #c3decf'
                                } as React.CSSProperties}
                                  title={`${entries.length} Zeiteinträge`}
                                >
                                  {entries.length}
                                </div>
                              )}
                              {dayExpenses.length > 0 && (
                              <div 
                                className="flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold"
                                style={{ 
                                  backgroundColor: '#f6ead6',
                                  color: '#5b4830',
                                  opacity: 1,
                                  border: '2px solid #ead6b8'
                                } as React.CSSProperties}
                                  title={`${dayExpenses.length} Reisekosten`}
                                >
                                  {dayExpenses.length}
                                </div>
                              )}
                            </>
                          )}
                          {/* Plus-Button */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={(e) => e.stopPropagation()}
                                title="Eintrag hinzufügen"
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                handleAddEntry(day);
                              }}>
                                <Clock className="h-4 w-4 mr-2" />
                                Zeiterfassung
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                handleAddExpenses(day);
                              }}>
                                <Receipt className="h-4 w-4 mr-2" />
                                Reisekosten
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      
                      {/* Mobile: Verstecke Details wenn nicht expanded, Desktop: zeige immer mit Scroll */}
                      <div className={`space-y-1 ${isExpanded ? "max-h-[180px] md:max-h-[180px] max-h-[240px] overflow-y-auto pr-2" : "md:block hidden md:max-h-[180px] md:overflow-y-auto md:pr-2"}`}>
                        {(() => {
                          let projectEntryIndex = 0;
                          let expenseEntryIndex = 0;
                          return displayItems.map((item, itemIdx) => {
                          if (item.type === 'time') {
                            const entry = item.data as any;
                            const toneClass = getToneClass(PROJECT_ENTRY_TONE_CLASSES, projectEntryIndex);
                            projectEntryIndex += 1;
                            return (
                              <div
                                key={`time-${entry.id}`}
                                className={`text-xs p-1 rounded border group ${toneClass}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <div className="flex-1 cursor-pointer" onClick={() => handleEditEntry(entry)}>
                                    <div className="font-medium truncate">{entry.projectName}</div>
                                    <div className="text-[10px]">
                                      {Math.floor(entry.hours / 60)}:{(entry.hours % 60).toString().padStart(2, '0')}h
                                    </div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleBulkCopy(entry.id);
                                    }}
                                    title="Auf mehrere Tage kopieren"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            );
                          } else {
                            const expense = item.data as any;
                            const toneClass = getToneClass(EXPENSE_ENTRY_TONE_CLASSES, expenseEntryIndex);
                            expenseEntryIndex += 1;
                            const showOutboundDeparture =
                              expense.category === "flight" &&
                              expense._flightLeg !== "return" &&
                              !!expense.departureTime;
                            const showArrival =
                              expense.category === "flight" &&
                              !!expense.arrivalTime &&
                              (expense._flightLeg === "return" || !expense.checkOutDate);
                            return (
                              <div
                                key={`expense-${expense.id}`}
                                className={`text-xs p-1 rounded border cursor-pointer ${toneClass}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Open edit dialog for expense
                                  setEditingExpense(expense.id);
                                  setTempExpenseAmount((expense.amount / 100).toString());
                                  setTempExpenseCategory(expense.category);
                                  setTempExpenseCurrency(expense.currency || 'EUR');
                                  setTempExpenseComment(expense.comment || '');
                                  const expenseDateKey = getDateKey(expense.date ? expense.date : day);
                                  setTempExpenseDate(expenseDateKey);
                                  setTempFlightReturnDate(
                                    expense.checkOutDate ? getDateKey(expense.checkOutDate as string | Date) : ""
                                  );
                                  setTempFlightRouteType(
                                    expense.flightRouteType === "international" ? "international" : "domestic"
                                  );
                                  setTempFlightTravelStart(expense.departureTime || "");
                                  setTempFlightTravelEnd(expense.arrivalTime || "");
                                  const hotelCheckIn = expense.checkInDate
                                    ? getDateKey(expense.checkInDate as string | Date)
                                    : expenseDateKey;
                                  const hotelCheckOut = expense.checkOutDate
                                    ? getDateKey(expense.checkOutDate as string | Date)
                                    : hotelCheckIn;
                                  setTempHotelCheckInDate(hotelCheckIn);
                                  setTempHotelNights(String(dayDiff(hotelCheckIn, hotelCheckOut)));
                                  setTempFullDay(Boolean(expense.fullDay));
                                  setSelectedExpenseDate(parseDateKey(expenseDateKey));
                                  setIsExpensesDialogOpen(true);
                                }}
                              >
                                <div className="font-medium truncate">
                                  {EXPENSE_CATEGORY_LABELS[expense.category] || expense.category}
                                </div>
                                {expense._subLabel && (
                                  <div className="text-[10px] opacity-80">{expense._subLabel}</div>
                                )}
                                {expense._showAmount !== false && (
                                  <div className="text-[10px]">
                                    {(expense.amount / 100).toFixed(2)} {expense.currency || 'EUR'}
                                  </div>
                                )}
                                {showOutboundDeparture && (
                                  <div className="text-[10px] opacity-80">Abflug: {expense.departureTime}</div>
                                )}
                                {showArrival && (
                                  <div className="text-[10px] opacity-80">Ankunft: {expense.arrivalTime}</div>
                                )}
                              </div>
                            );
                          }
                          });
                        })()}
                        {!isExpanded && hasMore && (
                          <div className="text-[10px] text-muted-foreground text-center pt-1">
                            +{allItems.length - 2} weitere
                          </div>
                        )}
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
                Erfassen Sie Ihre Arbeitszeit für {formData.date ? new Date(formData.date + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'den ausgewählten Tag'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
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
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleDialogClose}>
                  Abbrechen
                </Button>
                {editingEntry && (
                  <Button type="button" variant="destructive" onClick={() => handleDeleteEntry(editingEntry)}>
                    Löschen
                  </Button>
                )}
                <Button type="submit">
                  {editingEntry ? "Aktualisieren" : "Erstellen"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={isScopeCopyDialogOpen} onOpenChange={setIsScopeCopyDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Copy & Paste für Tag/Woche/Monat</DialogTitle>
              <DialogDescription>
                Überträgt alle Zeiteinträge und Reisekosten auf den nächsten Zeitraum.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="copy-scope">Bereich</Label>
                <Select value={copyScope} onValueChange={(value) => setCopyScope(value as CopyScope)}>
                  <SelectTrigger id="copy-scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Tag → nächster Tag</SelectItem>
                    <SelectItem value="week">Woche → nächste Woche</SelectItem>
                    <SelectItem value="month">Monat → nächster Monat</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="copy-anchor-date">Referenzdatum</Label>
                <Input
                  id="copy-anchor-date"
                  type="date"
                  value={copyAnchorDate}
                  onChange={(e) => setCopyAnchorDate(e.target.value)}
                />
              </div>

              <div className="rounded-md border p-3 text-sm">
                <div>
                  <span className="font-medium">Quelle:</span>{" "}
                  {new Date(`${copyRanges.sourceStart}T00:00:00`).toLocaleDateString("de-DE")} –{" "}
                  {new Date(`${copyRanges.sourceEnd}T00:00:00`).toLocaleDateString("de-DE")}
                </div>
                <div>
                  <span className="font-medium">Ziel:</span>{" "}
                  {new Date(`${copyRanges.targetStart}T00:00:00`).toLocaleDateString("de-DE")} –{" "}
                  {new Date(`${copyRanges.targetEnd}T00:00:00`).toLocaleDateString("de-DE")}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsScopeCopyDialogOpen(false)}
              >
                Abbrechen
              </Button>
              <Button
                type="button"
                onClick={handleScopeCopySubmit}
                disabled={copyRangeMutation.isPending}
              >
                {copyRangeMutation.isPending ? "Kopiere..." : "Jetzt kopieren"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isBulkCopyDialogOpen} onOpenChange={setIsBulkCopyDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Zeiteintrag auf mehrere Tage kopieren</DialogTitle>
              <DialogDescription>
                Wählen Sie die Tage aus, auf die der Zeiteintrag kopiert werden soll
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-7 gap-2 py-4">
              {WEEKDAYS_DE.map((day, idx) => (
                <div key={idx} className="text-center font-semibold text-sm p-2 text-muted-foreground">
                  {day}
                </div>
              ))}
              {days.map((day, idx) => {
                if (!day) {
                  return <div key={`empty-${idx}`} className="min-h-[60px]" />;
                }
                
                const year = day.getFullYear();
                const month = String(day.getMonth() + 1).padStart(2, '0');
                const dayStr = String(day.getDate()).padStart(2, '0');
                const dateStr = `${year}-${month}-${dayStr}`;
                const isSelected = selectedDates.includes(dateStr);
                const isToday = day.toDateString() === new Date().toDateString();
                
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleDateSelection(dateStr)}
                    className={`min-h-[60px] border rounded-lg p-2 text-sm transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : isToday
                        ? "border-primary bg-white"
                        : "border-border bg-white hover:bg-accent"
                    }`}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsBulkCopyDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button type="button" onClick={handleBulkCopySubmit}>
                Kopieren ({selectedDates.length} Tage)
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isExpensesDialogOpen} onOpenChange={setIsExpensesDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingExpense ? 'Reisekosten bearbeiten' : 'Reisekosten hinzufügen'}</DialogTitle>
              <DialogDescription>
                {editingExpense ? 'Bearbeiten Sie Ihre Reisekosten' : 'Erfassen Sie Ihre Reisekosten'} für {selectedExpenseDate?.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </DialogDescription>
            </DialogHeader>
            {selectedExpenseDate && (
              <form
                className="space-y-4"
                onSubmit={async (e) => {
                  e.preventDefault();

                  if (!tempExpenseAmount) {
                    toast.error('Bitte Betrag eingeben');
                    return;
                  }

                  const normalizedPrimaryDate = tempExpenseDate || formatLocalDate(selectedExpenseDate!);
                  const hotelCheckIn = tempHotelCheckInDate || normalizedPrimaryDate;
                  const hotelNights = Math.max(0, Number(tempHotelNights || "0"));
                  const hotelCheckOut = addDays(hotelCheckIn, hotelNights);

                  const payloadBase: any = {
                    category: tempExpenseCategory as any,
                    amount: Math.round(parseFloat(tempExpenseAmount) * 100),
                    currency: tempExpenseCurrency,
                    comment: tempExpenseComment || undefined,
                    fullDay: tempFullDay,
                  };

                  if (tempExpenseCategory === "flight") {
                    if (
                      tempFlightRouteType === "international" &&
                      (!tempFlightTravelStart || !tempFlightTravelEnd)
                    ) {
                      toast.error(
                        "Bei internationalen Flügen sind Abflugzeit und Ankunftszeit verpflichtend"
                      );
                      return;
                    }
                    payloadBase.date = normalizedPrimaryDate;
                    payloadBase.flightRouteType = tempFlightRouteType;
                    payloadBase.departureTime = tempFlightTravelStart || undefined;
                    payloadBase.arrivalTime = tempFlightTravelEnd || undefined;
                    payloadBase.checkOutDate = tempFlightReturnDate || undefined;
                  } else if (tempExpenseCategory === "hotel") {
                    payloadBase.date = hotelCheckIn;
                    payloadBase.checkInDate = hotelCheckIn;
                    payloadBase.checkOutDate = hotelCheckOut;
                  } else {
                    payloadBase.date = normalizedPrimaryDate;
                  }

                  try {
                    if (editingExpense) {
                      await updateExpenseMutation.mutateAsync({
                        id: editingExpense,
                        ...payloadBase,
                      });
                    } else {
                      await createExpenseMutation.mutateAsync(payloadBase);
                      toast.success('Reisekosten erfolgreich gespeichert');
                    }
                    setIsExpensesDialogOpen(false);
                    resetExpenseFormState();
                  } catch (error: any) {
                    console.error('[TimeTracking] Error:', error);
                    toast.error(`Fehler beim Speichern: ${error.message}`);
                  }
                }}
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="expense-amount">Betrag</Label>
                    <div className="flex gap-2">
                      <Input
                        id="expense-amount"
                        type="number"
                        step="0.01"
                        placeholder="z.B. 45.50"
                        value={tempExpenseAmount}
                        onChange={(e) => setTempExpenseAmount(e.target.value)}
                        className="flex-1"
                      />
                      <Select value={tempExpenseCurrency} onValueChange={setTempExpenseCurrency}>
                        <SelectTrigger className="w-[100px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PLN">PLN</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="CHF">CHF</SelectItem>
                          <SelectItem value="GBP">GBP</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expense-category">Kategorie</Label>
                    <Select
                      value={tempExpenseCategory}
                      onValueChange={(value) => {
                        setTempExpenseCategory(value);
                        if (!tempExpenseDate && selectedExpenseDate) {
                          const baseDate = formatLocalDate(selectedExpenseDate);
                          setTempExpenseDate(baseDate);
                          setTempHotelCheckInDate(baseDate);
                        }
                      }}
                    >
                      <SelectTrigger id="expense-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="car">Mietwagen</SelectItem>
                        <SelectItem value="train">ÖPNV</SelectItem>
                        <SelectItem value="flight">Flug</SelectItem>
                        <SelectItem value="taxi">Taxi</SelectItem>
                        <SelectItem value="transport">Sonstiger Transport</SelectItem>
                        <SelectItem value="hotel">Hotel</SelectItem>
                        <SelectItem value="food">Gastronomie</SelectItem>
                        <SelectItem value="meal">Verpflegungspauschale</SelectItem>
                        <SelectItem value="fuel">Kraftstoff</SelectItem>
                        <SelectItem value="other">Sonstiges</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {tempExpenseCategory === "flight" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="flight-route-type">Flugtyp</Label>
                      <Select
                        value={tempFlightRouteType}
                        onValueChange={(value) =>
                          setTempFlightRouteType(value as "domestic" | "international")
                        }
                      >
                        <SelectTrigger id="flight-route-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="domestic">Inland</SelectItem>
                          <SelectItem value="international">International (Inland ↔ Ausland)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="flight-outbound-date">Hinflug-Datum</Label>
                        <Input
                          id="flight-outbound-date"
                          type="date"
                          value={tempExpenseDate}
                          onChange={(e) => setTempExpenseDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="flight-return-date">Rückflug-Datum (optional)</Label>
                        <Input
                          id="flight-return-date"
                          type="date"
                          value={tempFlightReturnDate}
                          onChange={(e) => setTempFlightReturnDate(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="flight-travel-start">
                          Reise-Start (Abflugzeit
                          {tempFlightRouteType === "international" ? ", Pflicht" : ", optional"})
                        </Label>
                        <Input
                          id="flight-travel-start"
                          type="time"
                          value={tempFlightTravelStart}
                          onChange={(e) => setTempFlightTravelStart(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="flight-travel-end">
                          Reise-Ende (Landezeit
                          {tempFlightRouteType === "international" ? ", Pflicht" : ", optional"})
                        </Label>
                        <Input
                          id="flight-travel-end"
                          type="time"
                          value={tempFlightTravelEnd}
                          onChange={(e) => setTempFlightTravelEnd(e.target.value)}
                        />
                      </div>
                    </div>
                  </>
                )}
                {tempExpenseCategory === "hotel" && (
                  <>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="hotel-checkin-date">Check-in-Datum</Label>
                        <Input
                          id="hotel-checkin-date"
                          type="date"
                          value={tempHotelCheckInDate}
                          onChange={(e) => setTempHotelCheckInDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="hotel-nights">Anzahl Nächte</Label>
                        <Input
                          id="hotel-nights"
                          type="number"
                          min="0"
                          value={tempHotelNights}
                          onChange={(e) => setTempHotelNights(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="hotel-checkout-date">Check-out (automatisch)</Label>
                        <Input id="hotel-checkout-date" type="date" value={computedHotelCheckOutDate} readOnly />
                      </div>
                    </div>
                  </>
                )}
                {tempExpenseCategory !== "flight" && tempExpenseCategory !== "hotel" && (
                  <div className="space-y-2">
                    <Label htmlFor="expense-date">Datum</Label>
                    <Input
                      id="expense-date"
                      type="date"
                      value={tempExpenseDate}
                      onChange={(e) => setTempExpenseDate(e.target.value)}
                    />
                  </div>
                )}
                <div className="flex items-center gap-2 rounded-md border p-3">
                  <input
                    id="expense-full-day"
                    type="checkbox"
                    checked={tempFullDay}
                    onChange={(e) => setTempFullDay(e.target.checked)}
                  />
                  <Label htmlFor="expense-full-day">Ganzer Tag</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expense-comment">Kommentar (optional)</Label>
                  <Textarea
                    id="expense-comment"
                    placeholder="Zusätzliche Informationen..."
                    value={tempExpenseComment}
                    onChange={(e) => setTempExpenseComment(e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => {
                    setIsExpensesDialogOpen(false);
                    resetExpenseFormState();
                  }} className="flex-1">
                    Abbrechen
                  </Button>
                  {editingExpense && (
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={async () => {
                        if (confirm('Möchten Sie diese Reisekosten wirklich löschen?')) {
                          await deleteExpenseMutation.mutateAsync({ id: editingExpense });
                        }
                      }}
                      className="flex-1"
                    >
                      Löschen
                    </Button>
                  )}
                  <Button type="submit" className="flex-1">
                    {editingExpense ? 'Aktualisieren' : 'Speichern'}
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
