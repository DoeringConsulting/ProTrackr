import { useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Download, Bot, ShieldCheck, CircleX } from "lucide-react";
import * as XLSX from "xlsx";
import { trpc } from "@/lib/trpc";
import { Textarea } from "@/components/ui/textarea";
import {
  IMPORT_CHECKLIST,
  IMPORT_ERROR_CATALOG,
  hasBlockingIssues,
  parseWorkbookV1,
  type ParsedImportWorkbook,
  type ImportIssue,
  validateParsedWorkbook,
  validateWorkbookStructure,
} from "@/lib/expenseImportV1";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ImportResult = {
  customersCreated: number;
  customersReused: number;
  timeEntriesCreated: number;
  timeEntriesReused: number;
  expensesCreated: number;
  expensesSkipped: number;
  runtimeErrors: string[];
};

export default function Import() {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [parsedWorkbook, setParsedWorkbook] = useState<ParsedImportWorkbook | null>(null);
  const [issues, setIssues] = useState<ImportIssue[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [issueFilter, setIssueFilter] = useState<"all" | "error" | "warning">("all");
  const [ocrText, setOcrText] = useState("");
  const [aiDocumentId, setAiDocumentId] = useState("");
  const [aiCustomerId, setAiCustomerId] = useState("");
  const [aiTimeEntryId, setAiTimeEntryId] = useState("");
  const [aiProjectName, setAiProjectName] = useState("");
  const [aiDocumentIdsBatch, setAiDocumentIdsBatch] = useState("");
  const [aiBatchFiles, setAiBatchFiles] = useState<File[]>([]);
  const [aiWizardItemsInput, setAiWizardItemsInput] = useState("");
  const [latestAiResult, setLatestAiResult] = useState<any>(null);
  const [latestAiBatchResult, setLatestAiBatchResult] = useState<any>(null);
  const [latestAiUploadResult, setLatestAiUploadResult] = useState<any>(null);
  const [latestAiDryRunResult, setLatestAiDryRunResult] = useState<any>(null);
  const [latestAiApplyResult, setLatestAiApplyResult] = useState<any>(null);

  const utils = trpc.useUtils();
  const createCustomerMutation = trpc.customers.create.useMutation();
  const createTimeEntryMutation = trpc.timeEntries.create.useMutation();
  const createExpenseMutation = trpc.expenses.create.useMutation();
  const analyzeReceiptMutation = trpc.receiptAi.analyze.useMutation({
    onSuccess: data => {
      setLatestAiResult(data);
      utils.receiptAi.list.invalidate();
      toast.success("KI-Analyse abgeschlossen");
    },
    onError: error => toast.error(`KI-Analyse fehlgeschlagen: ${error.message}`),
  });
  const analyzeReceiptBatchMutation = trpc.receiptAi.analyzeBatch.useMutation({
    onSuccess: data => {
      setLatestAiBatchResult(data);
      utils.receiptAi.list.invalidate();
      toast.success(`Batch-Analyse abgeschlossen: ${data.succeeded}/${data.total} erfolgreich`);
    },
    onError: error => toast.error(`Batch-Analyse fehlgeschlagen: ${error.message}`),
  });
  const uploadAiBatchMutation = trpc.documents.uploadForAiBatch.useMutation({
    onSuccess: data => {
      setLatestAiUploadResult(data);
      toast.success(`Upload abgeschlossen: ${data.uploadedCount}/${data.total}`);
    },
    onError: error => toast.error(`Upload fehlgeschlagen: ${error.message}`),
  });
  const dryRunBatchApproveMutation = trpc.receiptAi.dryRunBatchApprove.useMutation({
    onSuccess: data => {
      setLatestAiDryRunResult(data);
      toast.success(
        `Dry-Run abgeschlossen: ${data.ready} freigabefähig · ${data.warnings} Warnungen · ${data.blocking} blockierend`
      );
    },
    onError: error => toast.error(`Dry-Run fehlgeschlagen: ${error.message}`),
  });
  const applyBatchApproveMutation = trpc.receiptAi.applyBatchApprove.useMutation({
    onSuccess: data => {
      setLatestAiApplyResult(data);
      utils.receiptAi.list.invalidate();
      toast.success(`Batch-Freigabe abgeschlossen: ${data.approved} übernommen, ${data.skipped} übersprungen`);
    },
    onError: error => toast.error(`Batch-Freigabe fehlgeschlagen: ${error.message}`),
  });
  const approveAiMutation = trpc.receiptAi.approve.useMutation({
    onSuccess: () => {
      utils.receiptAi.list.invalidate();
      toast.success("KI-Vorschlag als Reisekosten übernommen");
    },
    onError: error => toast.error(`Freigabe fehlgeschlagen: ${error.message}`),
  });
  const rejectAiMutation = trpc.receiptAi.reject.useMutation({
    onSuccess: () => {
      utils.receiptAi.list.invalidate();
      toast.success("KI-Vorschlag verworfen");
    },
    onError: error => toast.error(`Ablehnen fehlgeschlagen: ${error.message}`),
  });
  const aiQueueQuery = trpc.receiptAi.list.useQuery({ limit: 30 });

  const filteredIssues = useMemo(() => {
    if (issueFilter === "all") return issues;
    return issues.filter(issue => issue.severity === issueFilter);
  }, [issueFilter, issues]);

  const issueSummary = useMemo(() => {
    const errors = issues.filter(issue => issue.severity === "error").length;
    const warnings = issues.filter(issue => issue.severity === "warning").length;
    return { errors, warnings };
  }, [issues]);

  const escapeCsv = (value: unknown): string => {
    const text = String(value ?? "");
    if (text.includes(";") || text.includes('"') || text.includes("\n")) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const handleDownloadIssuesCsv = () => {
    const rows = filteredIssues.length > 0 ? filteredIssues : issues;
    if (rows.length === 0) {
      toast.error("Keine Validierungsmeldungen zum Download vorhanden");
      return;
    }
    const header = ["code", "severity", "table", "row", "field", "message"];
    const lines = [header.join(";")];
    for (const issue of rows) {
      lines.push(
        [
          escapeCsv(issue.code),
          escapeCsv(issue.severity),
          escapeCsv(issue.table),
          escapeCsv(issue.row),
          escapeCsv(issue.field ?? ""),
          escapeCsv(issue.message),
        ].join(";")
      );
    }
    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const dateTag = new Date().toISOString().slice(0, 10);
    const link = document.createElement("a");
    link.href = url;
    link.download = `import-validierung-${issueFilter}-${dateTag}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownloadImportResultCsv = () => {
    if (!result) {
      toast.error("Keine Import-Ergebnisse zum Download vorhanden");
      return;
    }

    const header = ["section", "metric", "value"];
    const lines = [header.join(";")];
    lines.push(["summary", "customers_created", escapeCsv(result.customersCreated)].join(";"));
    lines.push(["summary", "customers_reused", escapeCsv(result.customersReused)].join(";"));
    lines.push(["summary", "time_entries_created", escapeCsv(result.timeEntriesCreated)].join(";"));
    lines.push(["summary", "time_entries_reused", escapeCsv(result.timeEntriesReused)].join(";"));
    lines.push(["summary", "expenses_created", escapeCsv(result.expensesCreated)].join(";"));
    lines.push(["summary", "expenses_skipped", escapeCsv(result.expensesSkipped)].join(";"));
    lines.push(["summary", "runtime_errors_count", escapeCsv(result.runtimeErrors.length)].join(";"));

    if (result.runtimeErrors.length > 0) {
      result.runtimeErrors.forEach((error, index) => {
        lines.push(["runtime_error", `error_${index + 1}`, escapeCsv(error)].join(";"));
      });
    }

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const dateTag = new Date().toISOString().slice(0, 10);
    const link = document.createElement("a");
    link.href = url;
    link.download = `import-ergebnisse-${dateTag}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const formatImportErrorMessage = (error: unknown): string => {
    const message = String((error as any)?.message ?? "Unbekannter Fehler");
    if (message.startsWith("Failed query:")) {
      return "Datenbankfehler beim Speichern (bitte Pflichtfelder/Datumsformat prüfen).";
    }
    return message;
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    if (
      !selectedFile.name.endsWith(".xlsx") &&
      !selectedFile.name.endsWith(".xls") &&
      !selectedFile.name.endsWith(".csv")
    ) {
      toast.error("Bitte wählen Sie eine Excel- oder CSV-Datei aus (.xlsx, .xls, .csv)");
      return;
    }
    setFile(selectedFile);
    setResult(null);
    setParsedWorkbook(null);
    setIssues([]);
  };

  const parseWorkbookFromFile = async (selectedFile: File): Promise<XLSX.WorkBook> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = event => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          resolve(XLSX.read(data, { type: "array" }));
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(selectedFile);
    });
  };

  const handleValidate = async () => {
    if (!file) {
      toast.error("Bitte wählen Sie eine Datei aus");
      return;
    }

    setValidating(true);
    setProgress(10);
    try {
      const workbook = await parseWorkbookFromFile(file);
      setProgress(30);
      const structureIssues = validateWorkbookStructure(workbook);
      if (structureIssues.length > 0) {
        setIssues(structureIssues);
        setParsedWorkbook(null);
        setProgress(100);
        return;
      }

      const parsed = parseWorkbookV1(workbook);
      setProgress(60);
      const contentIssues = validateParsedWorkbook(parsed);
      setParsedWorkbook(parsed);
      setIssues(contentIssues);
      setProgress(100);
      if (contentIssues.length === 0) {
        toast.success("Validierung erfolgreich: keine Auffälligkeiten");
      } else {
        const errors = contentIssues.filter(item => item.severity === "error").length;
        const warnings = contentIssues.filter(item => item.severity === "warning").length;
        toast.warning(`Validierung abgeschlossen: ${errors} Fehler, ${warnings} Warnungen`);
      }
    } catch (error: any) {
      toast.error(`Validierung fehlgeschlagen: ${error.message}`);
    } finally {
      setValidating(false);
    }
  };

  const handleImport = async () => {
    if (!parsedWorkbook) {
      toast.error("Bitte zuerst validieren");
      return;
    }
    if (hasBlockingIssues(issues)) {
      toast.error("Import blockiert: Bitte zuerst alle Fehler beheben");
      return;
    }

    setImporting(true);
    setProgress(0);
    const runtimeErrors: string[] = [];
    let customersCreated = 0;
    let customersReused = 0;
    let timeEntriesCreated = 0;
    let timeEntriesReused = 0;
    let expensesCreated = 0;
    let expensesSkipped = 0;

    try {
      const totalOps =
        parsedWorkbook.customers.length + parsedWorkbook.timeEntries.length + parsedWorkbook.expenses.length || 1;
      let opIndex = 0;

      const customerExternalToId = new Map<string, number>();
      const timeEntryExternalToId = new Map<string, number>();

      const existingCustomers = await utils.customers.list.fetch();
      const existingCustomersByMandantenNr = new Map<string, any>();
      const existingCustomersById = new Map<string, any>();
      for (const customer of existingCustomers) {
        existingCustomersByMandantenNr.set(String(customer.mandatenNr), customer);
        existingCustomersById.set(String(customer.id), customer);
      }

      const resolveCustomerId = (customerExternalId: string, mandantenNr?: string): number | null => {
        const direct = customerExternalToId.get(customerExternalId);
        if (typeof direct === "number") return direct;

        if (mandantenNr) {
          const byMandanten = existingCustomersByMandantenNr.get(mandantenNr);
          if (byMandanten?.id) {
            customerExternalToId.set(customerExternalId, Number(byMandanten.id));
            return Number(byMandanten.id);
          }
        }

        const byExternalAsMandanten = existingCustomersByMandantenNr.get(customerExternalId);
        if (byExternalAsMandanten?.id) {
          customerExternalToId.set(customerExternalId, Number(byExternalAsMandanten.id));
          return Number(byExternalAsMandanten.id);
        }

        const byId = existingCustomersById.get(customerExternalId);
        if (byId?.id) {
          customerExternalToId.set(customerExternalId, Number(byId.id));
          return Number(byId.id);
        }

        return null;
      };

      for (const row of parsedWorkbook.customers) {
        try {
          const existing = existingCustomersByMandantenNr.get(row.mandantenNr);
          if (existing) {
            customerExternalToId.set(row.customerExternalId, existing.id);
            customersReused++;
          } else {
            const created = await createCustomerMutation.mutateAsync({
              provider: row.provider,
              mandatenNr: row.mandantenNr,
              projectName: row.projectName,
              location: row.location || "n/a",
              standardDayHours: Math.round(row.standardDayHours * 100),
              onsiteRate: Math.round(row.onsiteRate * 100),
              remoteRate: Math.round(row.remoteRate * 100),
              kmRate: Math.round(row.kmRate * 100),
              mealRate: Math.round(row.mealRate * 100),
              costModel: row.costModel,
            });
            customerExternalToId.set(row.customerExternalId, Number(created.id));
            existingCustomersByMandantenNr.set(row.mandantenNr, created);
            customersCreated++;
          }
        } catch (error: any) {
          runtimeErrors.push(`Kunden-Zeile ${row.rowNumber}: ${error.message}`);
        }
        opIndex++;
        setProgress(Math.round((opIndex / totalOps) * 100));
      }

      const allDates = [
        ...parsedWorkbook.timeEntries.map(entry => entry.date),
        ...parsedWorkbook.expenses.map(expense => expense.date),
      ]
        .filter(Boolean)
        .sort();
      const minDate = allDates[0];
      const maxDate = allDates[allDates.length - 1];
      const existingTimeEntries =
        minDate && maxDate
          ? await utils.timeEntries.list.fetch({ startDate: minDate, endDate: maxDate })
          : [];
      const createdTimeEntries: any[] = [];

      for (const row of parsedWorkbook.timeEntries) {
        try {
          const customerId = resolveCustomerId(row.customerExternalId);
          if (!customerId) {
            runtimeErrors.push(`Zeiteinträge-Zeile ${row.rowNumber}: Kunde nicht aufgelöst`);
            continue;
          }
          const duplicate = [...existingTimeEntries, ...createdTimeEntries].find((entry: any) => {
            const dateValue = String(entry.date ?? "").slice(0, 10);
            return (
              Number(entry.customerId) === Number(customerId) &&
              dateValue === row.date &&
              String(entry.projectName ?? "") === row.projectName &&
              String(entry.entryType ?? "") === row.entryType &&
              Number(entry.hours ?? 0) === row.minutes
            );
          });
          if (duplicate) {
            timeEntryExternalToId.set(row.timeEntryExternalId, Number(duplicate.id));
            timeEntriesReused++;
          } else {
            const dateObj = new Date(`${row.date}T00:00:00`);
            // DB-Spalte weekday ist auf 10 Zeichen begrenzt -> kurze Form verwenden.
            const weekdayShort = dateObj
              .toLocaleDateString("de-DE", { weekday: "short" })
              .replace(".", "")
              .slice(0, 10);
            const created = await createTimeEntryMutation.mutateAsync({
              customerId,
              date: row.date,
              weekday: weekdayShort || "Mo",
              projectName: row.projectName,
              entryType: row.entryType,
              description: row.description || undefined,
              hours: row.minutes,
            });
            const createdId = Number((created as any)?.id ?? 0);
            if (createdId > 0) {
              timeEntryExternalToId.set(row.timeEntryExternalId, createdId);
            }
            createdTimeEntries.push(created);
            timeEntriesCreated++;
          }
        } catch (error: any) {
          runtimeErrors.push(`Zeiteinträge-Zeile ${row.rowNumber}: ${error.message}`);
        }
        opIndex++;
        setProgress(Math.round((opIndex / totalOps) * 100));
      }

      for (const row of parsedWorkbook.expenses) {
        try {
          const customerId = resolveCustomerId(row.customerExternalId, row.mandantenNr) ?? null;
          let timeEntryId: number | null = null;

          if (row.timeEntryExternalId) {
            timeEntryId = timeEntryExternalToId.get(row.timeEntryExternalId) ?? null;
            if (!timeEntryId && /^\d+$/.test(row.timeEntryExternalId)) {
              const numericId = Number(row.timeEntryExternalId);
              const existing = [...existingTimeEntries, ...createdTimeEntries].find(
                (entry: any) => Number(entry.id) === numericId
              );
              if (existing?.id) {
                timeEntryId = Number(existing.id);
              }
            }
            if (!timeEntryId) {
              runtimeErrors.push(
                `Reisekosten-Zeile ${row.rowNumber}: time_entry_external_id nicht aufgelöst`
              );
              expensesSkipped++;
              continue;
            }
          } else if (customerId) {
            const fallback = [...existingTimeEntries, ...createdTimeEntries].find((entry: any) => {
              const dateValue = String(entry.date ?? "").slice(0, 10);
              const projectMatch =
                !row.projectName ||
                String(entry.projectName ?? "").toLowerCase() === row.projectName.toLowerCase();
              return Number(entry.customerId) === Number(customerId) && dateValue === row.date && projectMatch;
            });
            timeEntryId = fallback?.id ? Number(fallback.id) : null;
          }

          const payload: any = {
            date: row.date,
            category: row.category,
            amount: Math.round(row.amount * 100),
            currency: row.currency,
            comment: row.comment
              ? `${row.comment} [IMPORT_ID:${row.expenseExternalId}]`
              : `[IMPORT_ID:${row.expenseExternalId}]`,
            fullDay: row.fullDay === "1",
          };

          if (timeEntryId) payload.timeEntryId = timeEntryId;

          if (row.category === "flight") {
            payload.flightRouteType = row.flightRouteType || "domestic";
            payload.departureTime = row.departureTime || undefined;
            payload.arrivalTime = row.arrivalTime || undefined;
            payload.checkOutDate = row.returnDate || undefined;
            payload.ticketNumber = row.ticketNumber || undefined;
            payload.flightNumber = row.flightNumber || undefined;
          }

          if (row.category === "hotel") {
            payload.date = row.checkInDate || row.date;
            payload.checkInDate = row.checkInDate || row.date;
            if (row.checkOutDate) payload.checkOutDate = row.checkOutDate;
            else if (typeof row.nights === "number") {
              const checkIn = new Date(`${(row.checkInDate || row.date)}T00:00:00`);
              const checkOut = new Date(checkIn);
              checkOut.setDate(checkOut.getDate() + Math.max(0, row.nights));
              payload.checkOutDate = checkOut.toISOString().slice(0, 10);
            }
          }

          if (row.category === "fuel") {
            if (typeof row.liters === "number") payload.liters = Math.round(row.liters * 1000);
            if (typeof row.pricePerLiter === "number") payload.pricePerLiter = Math.round(row.pricePerLiter * 100);
          }

          if (typeof row.distanceKm === "number") payload.distance = Math.round(row.distanceKm);
          if (typeof row.ratePerKm === "number") payload.rate = Math.round(row.ratePerKm * 100);

          await createExpenseMutation.mutateAsync(payload);
          expensesCreated++;
        } catch (error: any) {
          runtimeErrors.push(`Reisekosten-Zeile ${row.rowNumber}: ${formatImportErrorMessage(error)}`);
          expensesSkipped++;
        }
        opIndex++;
        setProgress(Math.round((opIndex / totalOps) * 100));
      }

      setResult({
        customersCreated,
        customersReused,
        timeEntriesCreated,
        timeEntriesReused,
        expensesCreated,
        expensesSkipped,
        runtimeErrors,
      });
      if (runtimeErrors.length === 0) toast.success("Import erfolgreich abgeschlossen");
      else toast.warning(`Import abgeschlossen mit ${runtimeErrors.length} Laufzeitfehlern`);
    } catch (error: any) {
      toast.error(`Import fehlgeschlagen: ${error.message}`);
      setResult({
        customersCreated,
        customersReused,
        timeEntriesCreated,
        timeEntriesReused,
        expensesCreated,
        expensesSkipped,
        runtimeErrors: [...runtimeErrors, error.message],
      });
    } finally {
      setImporting(false);
      setProgress(100);
    }
  };

  const handleAnalyzeReceipt = async () => {
    if (!ocrText.trim() && !aiDocumentId.trim()) {
      toast.error("Bitte OCR-Text oder documentId angeben");
      return;
    }
    await analyzeReceiptMutation.mutateAsync({
      ocrText: ocrText.trim() || undefined,
      documentId: aiDocumentId.trim() ? Number(aiDocumentId) : undefined,
      customerId: aiCustomerId.trim() ? Number(aiCustomerId) : undefined,
      timeEntryId: aiTimeEntryId.trim() ? Number(aiTimeEntryId) : undefined,
      projectName: aiProjectName.trim() || undefined,
    });
  };

  const handleAnalyzeReceiptBatch = async () => {
    const documentIds = Array.from(
      new Set(
        aiDocumentIdsBatch
          .split(/[\n,; ]+/)
          .map(value => Number(value.trim()))
          .filter(value => Number.isInteger(value) && value > 0)
      )
    );
    if (documentIds.length === 0) {
      toast.error("Bitte mindestens eine gültige documentId eingeben (z. B. 12,13,14)");
      return;
    }
    await analyzeReceiptBatchMutation.mutateAsync({
      documentIds,
      customerId: aiCustomerId.trim() ? Number(aiCustomerId) : undefined,
      timeEntryId: aiTimeEntryId.trim() ? Number(aiTimeEntryId) : undefined,
      projectName: aiProjectName.trim() || undefined,
    });
  };

  const mergeDocumentIdsIntoInputs = (documentIds: number[], withPrompt = true) => {
    if (documentIds.length === 0) return;
    let shouldInsert = true;
    if (withPrompt) {
      const label = documentIds.join(", ");
      shouldInsert = window.confirm(
        `Es wurden ${documentIds.length} Dokument(e) hochgeladen (${label}).\nSollen die documentIds automatisch in die Eingabefelder übernommen werden?`
      );
    }
    if (!shouldInsert) return;

    setAiDocumentIdsBatch(prev => {
      const existing = prev
        .split(/[\n,; ]+/)
        .map(value => Number(value.trim()))
        .filter(value => Number.isInteger(value) && value > 0);
      const merged = Array.from(new Set([...existing, ...documentIds]));
      return merged.join(",");
    });

    if (documentIds.length > 0) {
      setAiDocumentId(String(documentIds[0]));
    }
  };

  const parseBatchWizardItems = () => {
    const tokens = aiWizardItemsInput
      .split(/[\n,;]+/)
      .map(token => token.trim())
      .filter(Boolean);
    const unique = new Map<string, { analysisId: number; candidateIndex?: number }>();
    for (const token of tokens) {
      const match = token.match(/^(\d+)(?::(\d+))?$/);
      if (!match) continue;
      const analysisId = Number(match[1]);
      const candidateIndex = match[2] ? Number(match[2]) : undefined;
      if (!Number.isInteger(analysisId) || analysisId <= 0) continue;
      if (candidateIndex !== undefined && (!Number.isInteger(candidateIndex) || candidateIndex < 0)) continue;
      unique.set(`${analysisId}:${candidateIndex ?? 0}`, { analysisId, candidateIndex });
    }
    return Array.from(unique.values());
  };

  const handleAiBatchFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    const valid: File[] = [];
    for (const file of files) {
      const isAllowedType =
        file.type.startsWith("image/") ||
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");
      if (!isAllowedType) {
        toast.error(`Dateityp nicht unterstützt: ${file.name}`);
        continue;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`Datei zu groß (max. 20MB): ${file.name}`);
        continue;
      }
      valid.push(file);
    }
    if (valid.length > 0) {
      setAiBatchFiles(prev => [...prev, ...valid]);
    }
    event.target.value = "";
  };

  const removeAiBatchFile = (index: number) => {
    setAiBatchFiles(prev => prev.filter((_, i) => i !== index));
  };

  const toBase64Payload = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result ?? "");
        const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : "";
        if (!base64) {
          reject(new Error(`Datei konnte nicht konvertiert werden: ${file.name}`));
          return;
        }
        resolve(base64);
      };
      reader.onerror = () => reject(new Error(`Datei konnte nicht gelesen werden: ${file.name}`));
      reader.readAsDataURL(file);
    });

  const handleUploadAndAnalyzeBatch = async () => {
    if (aiBatchFiles.length === 0) {
      toast.error("Bitte zuerst Dateien für den Batch auswählen");
      return;
    }
    const filesPayload = await Promise.all(
      aiBatchFiles.map(async file => ({
        fileName: file.name,
        mimeType: file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream"),
        fileSize: file.size,
        base64Data: await toBase64Payload(file),
      }))
    );
    const uploadResult = await uploadAiBatchMutation.mutateAsync({ files: filesPayload });
    const uploadedDocs = Array.isArray(uploadResult.uploaded) ? uploadResult.uploaded : [];
    const documentIds = uploadedDocs
      .map((doc: any) => Number(doc?.id))
      .filter((id: number) => Number.isInteger(id) && id > 0);
    if (documentIds.length === 0) {
      toast.error("Keine Dokumente hochgeladen – Batch-Analyse wurde nicht gestartet");
      return;
    }
    mergeDocumentIdsIntoInputs(documentIds, true);
    await analyzeReceiptBatchMutation.mutateAsync({
      documentIds,
      customerId: aiCustomerId.trim() ? Number(aiCustomerId) : undefined,
      timeEntryId: aiTimeEntryId.trim() ? Number(aiTimeEntryId) : undefined,
      projectName: aiProjectName.trim() || undefined,
    });
  };

  const handleUploadOnly = async () => {
    if (aiBatchFiles.length === 0) {
      toast.error("Bitte zuerst Dateien für den Upload auswählen");
      return;
    }
    const filesPayload = await Promise.all(
      aiBatchFiles.map(async file => ({
        fileName: file.name,
        mimeType: file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream"),
        fileSize: file.size,
        base64Data: await toBase64Payload(file),
      }))
    );
    const uploadResult = await uploadAiBatchMutation.mutateAsync({ files: filesPayload });
    const uploadedDocs = Array.isArray(uploadResult.uploaded) ? uploadResult.uploaded : [];
    const documentIds = uploadedDocs
      .map((doc: any) => Number(doc?.id))
      .filter((id: number) => Number.isInteger(id) && id > 0);
    if (documentIds.length > 0) {
      mergeDocumentIdsIntoInputs(documentIds, true);
    }
  };

  const handleDryRunBatchApprove = async () => {
    const items = parseBatchWizardItems();
    if (items.length === 0) {
      toast.error("Bitte Analyse-IDs eingeben (Format: 123 oder 123:0)");
      return;
    }
    await dryRunBatchApproveMutation.mutateAsync({ items });
  };

  const handleApplyBatchApprove = async () => {
    const items = parseBatchWizardItems();
    if (items.length === 0) {
      toast.error("Bitte Analyse-IDs eingeben (Format: 123 oder 123:0)");
      return;
    }
    await applyBatchApproveMutation.mutateAsync({ items, skipBlocking: true });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#025a64]">Datenimport</h1>
          <p className="text-muted-foreground">
            Strukturierter Import mit strikter Validierung + KI-Belegauslese
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Importdatei hochladen (v1)</CardTitle>
            <CardDescription>
              Unterstützt: Excel (.xlsx/.xls) oder CSV. Teilimporte sind erlaubt (z. B. nur Kunden oder nur Reisekosten).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <a href="/import-templates/reisekosten-import-template-v1.xlsx" download>
                  <Download className="mr-2 h-4 w-4" />
                  Excel-Template v1
                </a>
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href="/import-templates/reisekosten-import-testdaten-v1.xlsx" download>
                  <Download className="mr-2 h-4 w-4" />
                  Testdatei mit Beispieldaten
                </a>
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="file">Datei</Label>
              <Input
                id="file"
                type="file"
                onChange={handleFileChange}
                accept=".xlsx,.xls,.csv"
                disabled={importing || validating}
              />
              {file && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>{file.name}</span>
                  <span>({(file.size / 1024).toFixed(1)} KB)</span>
                </div>
              )}
            </div>

            {(importing || validating) && (
              <div className="space-y-2">
                <Label>Fortschritt</Label>
                <Progress value={progress} />
                <p className="text-sm text-muted-foreground">{progress}% abgeschlossen</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleValidate} disabled={!file || importing || validating}>
                <ShieldCheck className="mr-2 h-4 w-4" />
                {validating ? "Validiere..." : "1) Validierung starten"}
              </Button>
              <Button
                onClick={handleImport}
                disabled={!parsedWorkbook || importing || validating || hasBlockingIssues(issues)}
              >
                <Upload className="mr-2 h-4 w-4" />
                {importing ? "Importiere..." : "2) Import ausführen"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Validierungs-Checkliste</CardTitle>
            <CardDescription>Strikte Prüfung pro Datei und Zeile</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {Object.entries(IMPORT_CHECKLIST).map(([title, entries]) => (
              <div key={title}>
                <p className="font-medium">{title}</p>
                <ul className="list-disc ml-5 text-muted-foreground">
                  {entries.map(item => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fehlerkatalog mit Klartextmeldungen</CardTitle>
            <CardDescription>Codes und Erklärung für den späteren Import-Dialog</CardDescription>
          </CardHeader>
          <CardContent className="max-h-72 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Meldung</TableHead>
                  <TableHead>Erklärung</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(IMPORT_ERROR_CATALOG).map(([code, entry]) => (
                  <TableRow key={code}>
                    <TableCell className="font-mono">{code}</TableCell>
                    <TableCell>{entry.severity}</TableCell>
                    <TableCell>{entry.template}</TableCell>
                    <TableCell>{entry.explanation}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Validierungsergebnis</CardTitle>
            <CardDescription>
              Fehler: {issueSummary.errors} · Warnungen: {issueSummary.warnings}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Select value={issueFilter} onValueChange={(value: any) => setIssueFilter(value)}>
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Meldungen</SelectItem>
                  <SelectItem value="error">Nur Fehler</SelectItem>
                  <SelectItem value="warning">Nur Warnungen</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={handleDownloadIssuesCsv}>
                <Download className="mr-2 h-4 w-4" />
                Fehler als CSV
              </Button>
              {hasBlockingIssues(issues) ? (
                <div className="text-sm text-red-600 flex items-center gap-1">
                  <CircleX className="h-4 w-4" />
                  Import blockiert
                </div>
              ) : (
                <div className="text-sm text-green-600 flex items-center gap-1">
                  <ShieldCheck className="h-4 w-4" />
                  Keine blockierenden Fehler
                </div>
              )}
            </div>
            <div className="max-h-72 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Tabelle</TableHead>
                    <TableHead>Zeile</TableHead>
                    <TableHead>Feld</TableHead>
                    <TableHead>Meldung</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIssues.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-muted-foreground">
                        Keine Meldungen vorhanden.
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredIssues.map((issue, index) => (
                    <TableRow key={`${issue.code}-${issue.row}-${index}`}>
                      <TableCell className="font-mono">{issue.code}</TableCell>
                      <TableCell>{issue.severity}</TableCell>
                      <TableCell>{issue.table}</TableCell>
                      <TableCell>{issue.row}</TableCell>
                      <TableCell>{issue.field || "-"}</TableCell>
                      <TableCell>{issue.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardHeader>
              <CardTitle>Import-Ergebnisse</CardTitle>
              <CardDescription>Zusammenfassung des Import-Vorgangs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={handleDownloadImportResultCsv}>
                  <Download className="mr-2 h-4 w-4" />
                  Import-Ergebnisse als CSV
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Kunden erstellt / wiederverwendet</p>
                    <p className="text-2xl font-bold">
                      {result.customersCreated} / {result.customersReused}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Zeiteinträge erstellt / wiederverwendet</p>
                    <p className="text-2xl font-bold">
                      {result.timeEntriesCreated} / {result.timeEntriesReused}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Reisekosten erstellt / übersprungen</p>
                    <p className="text-2xl font-bold">
                      {result.expensesCreated} / {result.expensesSkipped}
                    </p>
                  </div>
                </div>
              </div>
              {result.runtimeErrors.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-amber-600">
                    <AlertCircle className="h-5 w-5" />
                    <p className="font-medium">Laufzeitfehler ({result.runtimeErrors.length})</p>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {result.runtimeErrors.map((error, index) => (
                      <p key={index} className="text-sm text-muted-foreground">
                        {error}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>KI-Belegauslese → Reisekosten</CardTitle>
            <CardDescription>Analyse, Review und Freigabe in die Reisekosten</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>OCR/Textinhalt</Label>
                <p className="text-xs text-muted-foreground">
                  Hier reinen OCR-/Belegtext einfügen. Alternativ documentId nutzen (Dokument muss bereits als Beleg hochgeladen sein).
                </p>
                <Textarea
                  rows={8}
                  placeholder="Belegtext einfügen (oder documentId verwenden)"
                  value={ocrText}
                  onChange={event => setOcrText(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Optionale Hinweise</Label>
                <p className="text-xs text-muted-foreground">
                  Für Batch können Dokumente jetzt direkt hochgeladen werden. Alternativ können bestehende documentIds
                  genutzt werden.
                </p>
                <Input
                  placeholder="documentId (optional)"
                  value={aiDocumentId}
                  onChange={event => setAiDocumentId(event.target.value)}
                />
                <Input
                  placeholder="customerId (optional)"
                  value={aiCustomerId}
                  onChange={event => setAiCustomerId(event.target.value)}
                />
                <Input
                  placeholder="timeEntryId (optional)"
                  value={aiTimeEntryId}
                  onChange={event => setAiTimeEntryId(event.target.value)}
                />
                <Input
                  placeholder="projectName (optional)"
                  value={aiProjectName}
                  onChange={event => setAiProjectName(event.target.value)}
                />
                <div className="space-y-2 rounded border p-3">
                  <Label>Multi-File-Upload (Batch)</Label>
                  <Input type="file" multiple accept="image/*,.pdf,application/pdf" onChange={handleAiBatchFileChange} />
                  {aiBatchFiles.length > 0 && (
                    <div className="max-h-28 overflow-auto space-y-1 text-xs">
                      {aiBatchFiles.map((file, index) => (
                        <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-2">
                          <span className="truncate">
                            {file.name} ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeAiBatchFile(index)}>
                            Entfernen
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button
                    variant="outline"
                    onClick={handleUploadOnly}
                    disabled={uploadAiBatchMutation.isPending || analyzeReceiptBatchMutation.isPending}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {uploadAiBatchMutation.isPending ? "Upload läuft..." : "Dateien nur hochladen"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleUploadAndAnalyzeBatch}
                    disabled={uploadAiBatchMutation.isPending || analyzeReceiptBatchMutation.isPending}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {uploadAiBatchMutation.isPending || analyzeReceiptBatchMutation.isPending
                      ? "Upload/Analyse läuft..."
                      : "Dateien hochladen + KI-Batch starten"}
                  </Button>
                </div>
                <Textarea
                  rows={4}
                  placeholder="Batch: documentId-Liste (komma-/zeilengetrennt), z. B. 101,102,103"
                  value={aiDocumentIdsBatch}
                  onChange={event => setAiDocumentIdsBatch(event.target.value)}
                />
                <Button
                  variant="outline"
                  onClick={handleAnalyzeReceiptBatch}
                  disabled={analyzeReceiptBatchMutation.isPending}
                >
                  <Bot className="mr-2 h-4 w-4" />
                  {analyzeReceiptBatchMutation.isPending ? "Batch läuft..." : "KI-Batch-Analyse starten"}
                </Button>
                <Button onClick={handleAnalyzeReceipt} disabled={analyzeReceiptMutation.isPending}>
                  <Bot className="mr-2 h-4 w-4" />
                  {analyzeReceiptMutation.isPending ? "Analysiere..." : "KI-Analyse starten"}
                </Button>
              </div>
            </div>

            {latestAiUploadResult && (
              <Card>
                <CardContent className="pt-4 text-sm space-y-2">
                  <p className="font-medium">
                    Upload-Ergebnis: {latestAiUploadResult.uploadedCount}/{latestAiUploadResult.total} erfolgreich ·{" "}
                    {latestAiUploadResult.failedCount} fehlgeschlagen
                  </p>
                  {(latestAiUploadResult.failed || []).length > 0 && (
                    <div className="max-h-24 overflow-auto space-y-1 text-muted-foreground">
                      {latestAiUploadResult.failed.map((f: any, idx: number) => (
                        <p key={`${f.fileName}-${idx}`}>
                          {f.fileName}: {f.message}
                        </p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {latestAiBatchResult && (
              <Card>
                <CardContent className="pt-4 text-sm space-y-2">
                  <p className="font-medium">
                    Batch-Ergebnis: {latestAiBatchResult.succeeded}/{latestAiBatchResult.total} erfolgreich ·{" "}
                    {latestAiBatchResult.failed} fehlgeschlagen
                  </p>
                  <div className="max-h-48 overflow-auto space-y-1">
                    {(latestAiBatchResult.results || []).map((entry: any, idx: number) => (
                      <p key={`${entry.index}-${idx}`} className="text-muted-foreground">
                        #{entry.index + 1} · {entry.status === "ok" ? "OK" : "FEHLER"} · docId:{" "}
                        {entry.documentId ?? "-"} · {entry.status === "ok"
                          ? `Analyse ${entry.analysisId} (${entry.candidateCount} Kandidaten)`
                          : entry.error}
                      </p>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Erfolgreiche Batch-Treffer erscheinen in der Review Queue und können dort geprüft/freigegeben
                    werden.
                  </p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Batch-Freigabe-Wizard</CardTitle>
                <CardDescription>
                  Analyse-IDs eingeben (Format: <code>123</code> oder <code>123:1</code> für Kandidat 1) → Dry-Run
                  prüfen → gesammelt freigeben.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  rows={3}
                  placeholder="z. B. 901,902:0,903"
                  value={aiWizardItemsInput}
                  onChange={event => setAiWizardItemsInput(event.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={handleDryRunBatchApprove}
                    disabled={dryRunBatchApproveMutation.isPending}
                  >
                    {dryRunBatchApproveMutation.isPending ? "Dry-Run läuft..." : "Dry-Run Validierung"}
                  </Button>
                  <Button
                    onClick={handleApplyBatchApprove}
                    disabled={
                      applyBatchApproveMutation.isPending ||
                      !latestAiDryRunResult ||
                      Number(latestAiDryRunResult.blocking ?? 0) > 0
                    }
                  >
                    {applyBatchApproveMutation.isPending ? "Übernehme..." : "Alles freigeben (nur nicht-blockierend)"}
                  </Button>
                </div>
                {latestAiDryRunResult && (
                  <div className="text-sm space-y-2">
                    <p>
                      Dry-Run: {latestAiDryRunResult.ready} OK · {latestAiDryRunResult.warnings} Warnung ·{" "}
                      {latestAiDryRunResult.blocking} blockierend
                    </p>
                    <div className="max-h-44 overflow-auto space-y-1">
                      {(latestAiDryRunResult.results || []).map((entry: any, idx: number) => (
                        <p
                          key={`${entry.analysisId}-${entry.candidateIndex}-${idx}`}
                          className={
                            entry.statusClass === "blocking"
                              ? "text-red-600"
                              : entry.statusClass === "warning"
                                ? "text-amber-600"
                                : "text-green-700"
                          }
                        >
                          Analyse {entry.analysisId}:{entry.candidateIndex} · {entry.statusClass} · {entry.summary}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                {latestAiApplyResult && (
                  <p className="text-sm text-muted-foreground">
                    Übernahme: {latestAiApplyResult.approved} freigegeben, {latestAiApplyResult.skipped} übersprungen.
                  </p>
                )}
              </CardContent>
            </Card>

            {latestAiResult?.candidates?.length > 0 && (
              <div className="space-y-3">
                <p className="font-medium">
                  Letzte Analyse · Engine: {latestAiResult.engine} · Modell: {latestAiResult.model}
                </p>
                {latestAiResult.candidates.map((candidate: any, index: number) => (
                  <Card key={index}>
                    <CardContent className="pt-4 text-sm space-y-1">
                      <p>
                        <strong>Kandidat {index + 1}</strong> · Confidence:{" "}
                        {(Number(candidate.confidence || 0) / 100).toFixed(2)}%
                      </p>
                      <p>
                        Kategorie: {candidate.category} · Betrag: {candidate.amount} {candidate.currency} · Datum:{" "}
                        {candidate.date}
                      </p>
                      <p>Match: {candidate.match?.strategy || "unbekannt"} ({candidate.match?.reason || "-"})</p>
                      {(candidate.issues || []).map((issue: any, issueIndex: number) => (
                        <p key={issueIndex} className="text-muted-foreground">
                          [{issue.code}] {issue.message}
                        </p>
                      ))}
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            approveAiMutation.mutate({
                              analysisId: latestAiResult.analysisId,
                              candidateIndex: index,
                            })
                          }
                          disabled={approveAiMutation.isPending}
                        >
                          Übernehmen
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            rejectAiMutation.mutate({
                              analysisId: latestAiResult.analysisId,
                              reason: `Kandidat ${index + 1} verworfen`,
                            })
                          }
                          disabled={rejectAiMutation.isPending}
                        >
                          Verwerfen
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <div>
              <p className="font-medium mb-2">Review Queue (neueste Analysen)</p>
              <div className="max-h-56 overflow-auto space-y-2">
                {(aiQueueQuery.data || []).map((entry: any) => (
                  <div key={entry.id} className="border rounded p-2 text-sm">
                    #{entry.id} · Status: {entry.status} · Confidence:{" "}
                    {(Number(entry.confidence || 0) / 100).toFixed(2)}% · Modell: {entry.modelName}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
