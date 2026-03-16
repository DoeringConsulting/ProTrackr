import { createHash } from "node:crypto";
import { invokeLLM } from "./_core/llm";

export type ImportIssueSeverity = "error" | "warning";

export type ImportIssue = {
  code: string;
  severity: ImportIssueSeverity;
  field?: string;
  message: string;
};

export type ExpenseCategory =
  | "car"
  | "train"
  | "flight"
  | "taxi"
  | "transport"
  | "meal"
  | "hotel"
  | "food"
  | "fuel"
  | "other";

export type ReceiptExpenseCandidate = {
  category: ExpenseCategory | string;
  amount: number | null;
  currency: string | null;
  date: string | null;
  comment?: string;
  fullDay?: boolean;
  flightRouteType?: "domestic" | "international" | null;
  departureTime?: string | null;
  arrivalTime?: string | null;
  returnDate?: string | null;
  checkInDate?: string | null;
  checkOutDate?: string | null;
  nights?: number | null;
  distanceKm?: number | null;
  ratePerKm?: number | null;
  liters?: number | null;
  pricePerLiter?: number | null;
  ticketNumber?: string | null;
  flightNumber?: string | null;
  receiptNo?: string | null;
  vendorName?: string | null;
  projectName?: string | null;
  confidence?: number;
  issues?: ImportIssue[];
};

export type ReceiptAnalysisInput = {
  ocrText?: string | null;
  documentUrl?: string | null;
  mimeType?: string | null;
  hintCategory?: string | null;
  hintProjectName?: string | null;
};

export type ReceiptAnalysisResult = {
  source: "ocr_text" | "document_url" | "hybrid";
  engine: "llm" | "heuristic";
  model: string;
  rawExtraction: unknown;
  candidates: ReceiptExpenseCandidate[];
};

const DATE_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const CATEGORY_ALIASES: Record<string, ExpenseCategory> = {
  auto: "car",
  car: "car",
  mietwagen: "car",
  zug: "train",
  train: "train",
  flight: "flight",
  flug: "flight",
  taxi: "taxi",
  uber: "taxi",
  bolt: "taxi",
  transport: "transport",
  meal: "meal",
  food: "food",
  hotel: "hotel",
  overnight: "hotel",
  fuel: "fuel",
  tanken: "fuel",
  benzyna: "fuel",
  paliwo: "fuel",
  other: "other",
  sonstiges: "other",
};

const CURRENCY_ALIASES: Record<string, string> = {
  EUR: "EUR",
  EURO: "EUR",
  PLN: "PLN",
  ZL: "PLN",
  "ZŁ": "PLN",
  USD: "USD",
  CHF: "CHF",
  GBP: "GBP",
  "€": "EUR",
  "$": "USD",
};

function normalizeCurrency(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  if (!normalized) return null;
  return CURRENCY_ALIASES[normalized] ?? (normalized.length === 3 ? normalized : null);
}

function normalizeCategory(value: unknown): ExpenseCategory {
  if (typeof value !== "string") return "other";
  const normalized = value.trim().toLowerCase();
  return CATEGORY_ALIASES[normalized] ?? "other";
}

function normalizeIsoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (DATE_ISO_RE.test(trimmed)) return trimmed;
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(trimmed)) {
    const [dd, mm, yyyy] = trimmed.split(".");
    return `${yyyy}-${mm}-${dd}`;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [dd, mm, yyyy] = trimmed.split("/");
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

function normalizeTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (TIME_RE.test(trimmed)) return trimmed;
  return null;
}

function parseDecimal(input: unknown): number | null {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  if (typeof input !== "string") return null;
  const cleaned = input
    .trim()
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(?:[.,]|$))/g, "")
    .replace(",", ".");
  if (!cleaned) return null;
  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function buildIssue(code: string, severity: ImportIssueSeverity, message: string, field?: string): ImportIssue {
  return { code, severity, message, field };
}

function extractBasicCandidateFromText(text: string, input: ReceiptAnalysisInput): ReceiptExpenseCandidate {
  const normalized = text.replace(/\r/g, "");
  const lower = normalized.toLowerCase();
  const lines = normalized.split("\n").map(line => line.trim()).filter(Boolean);

  const amountCurrencyPatterns = [
    /(\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d{2}))\s*(EUR|PLN|USD|CHF|GBP|ZL|ZŁ|€|\$)\b/i,
    /\b(EUR|PLN|USD|CHF|GBP|ZL|ZŁ|€|\$)\s*(\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d{2}))\b/i,
  ];

  let amount: number | null = null;
  let currency: string | null = null;
  for (const pattern of amountCurrencyPatterns) {
    const match = normalized.match(pattern);
    if (!match) continue;
    if (pattern === amountCurrencyPatterns[0]) {
      amount = parseDecimal(match[1]);
      currency = normalizeCurrency(match[2]);
    } else {
      amount = parseDecimal(match[2]);
      currency = normalizeCurrency(match[1]);
    }
    if (amount !== null) break;
  }

  if (amount === null) {
    const amountOnly = normalized.match(/(?:total|summe|betrag|kwota)\D+(\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d{2}))/i);
    if (amountOnly) {
      amount = parseDecimal(amountOnly[1]);
    }
  }

  if (!currency) {
    if (lower.includes(" pln ") || lower.includes(" zł") || lower.includes(" zl")) currency = "PLN";
    if (!currency && lower.includes(" eur ")) currency = "EUR";
    if (!currency && lower.includes(" usd ")) currency = "USD";
  }

  const dateMatch = normalized.match(/\b(\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4}|\d{2}\/\d{2}\/\d{4})\b/);
  const date = normalizeIsoDate(dateMatch?.[1] ?? null);

  const allTimes = normalized.match(/\b([01]\d|2[0-3]):[0-5]\d\b/g) ?? [];
  const departureTime = allTimes[0] ?? null;
  const arrivalTime = allTimes[1] ?? null;

  const nightsMatch = normalized.match(/(\d{1,2})\s*(n[äa]chte|night|nights|noclegi)/i);
  const nights = nightsMatch ? Number.parseInt(nightsMatch[1], 10) : null;

  const checkInMatch = normalized.match(/(?:check[\s-]?in|zameldowanie|anreise)\D+(\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4})/i);
  const checkOutMatch = normalized.match(/(?:check[\s-]?out|wymeldowanie|abreise)\D+(\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4})/i);

  const receiptNoMatch = normalized.match(/(?:receipt|beleg|invoice|faktura|nr|no)\s*[:#]?\s*([A-Z0-9\-\/]+)/i);

  let category = normalizeCategory(input.hintCategory ?? "");
  if (category === "other") {
    if (/\b(hotel|check-in|check out|nocleg|nacht)\b/i.test(lower)) category = "hotel";
    else if (/\b(flight|flug|boarding|airline|lot|lufthansa)\b/i.test(lower)) category = "flight";
    else if (/\b(taxi|uber|bolt)\b/i.test(lower)) category = "taxi";
    else if (/\b(train|zug|pkp)\b/i.test(lower)) category = "train";
    else if (/\b(fuel|tanken|benzyna|diesel|orlen|shell)\b/i.test(lower)) category = "fuel";
    else if (/\b(meal|food|restaurant|gastronomia)\b/i.test(lower)) category = "meal";
  }

  const isInternational =
    /\b(international|ausland|zagranicz|intl)\b/i.test(lower) ||
    /(?:from|ab)\s+[a-z]{3,}\s+(?:to|nach)\s+[a-z]{3,}/i.test(lower);

  const vendorName = lines[0]?.slice(0, 120) ?? null;

  return {
    category,
    amount,
    currency,
    date,
    comment: lines.slice(0, 3).join(" | ").slice(0, 500),
    fullDay: false,
    flightRouteType: category === "flight" ? (isInternational ? "international" : "domestic") : null,
    departureTime,
    arrivalTime,
    returnDate: null,
    checkInDate: normalizeIsoDate(checkInMatch?.[1] ?? null),
    checkOutDate: normalizeIsoDate(checkOutMatch?.[1] ?? null),
    nights,
    receiptNo: receiptNoMatch?.[1] ?? null,
    vendorName,
    projectName: input.hintProjectName ?? null,
  };
}

async function extractByLlm(input: ReceiptAnalysisInput): Promise<{ model: string; raw: unknown; candidates: ReceiptExpenseCandidate[] } | null> {
  try {
    const messageParts: any[] = [
      {
        type: "text",
        text:
          "Extrahiere Reisekosten aus Belegen. Gib NUR strukturierte Daten zurück. Kategorien: car,train,flight,taxi,transport,meal,hotel,food,fuel,other.",
      },
    ];

    if (input.ocrText && input.ocrText.trim()) {
      messageParts.push({
        type: "text",
        text: `OCR-TEXT:\n${input.ocrText.slice(0, 12000)}`,
      });
    }

    if (input.documentUrl && input.documentUrl.trim()) {
      const isImageInput =
        (input.mimeType?.startsWith("image/") ?? false) || input.documentUrl.startsWith("data:image/");
      if (isImageInput) {
        messageParts.push({
          type: "image_url",
          image_url: {
            url: input.documentUrl,
            detail: "high",
          },
        });
      } else {
        messageParts.push({
          type: "file_url",
          file_url: {
            url: input.documentUrl,
            ...(input.mimeType && input.mimeType.startsWith("application/pdf")
              ? { mime_type: "application/pdf" as const }
              : {}),
          },
        });
      }
    }

    const response = await invokeLLM({
      messages: [
        {
          role: "user",
          content: messageParts,
        },
      ],
      responseFormat: {
        type: "json_schema",
        json_schema: {
          name: "receipt_expense_extraction",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              candidates: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    category: { type: "string" },
                    amount: { type: ["number", "null"] },
                    currency: { type: ["string", "null"] },
                    date: { type: ["string", "null"] },
                    comment: { type: ["string", "null"] },
                    fullDay: { type: ["boolean", "null"] },
                    flightRouteType: { type: ["string", "null"] },
                    departureTime: { type: ["string", "null"] },
                    arrivalTime: { type: ["string", "null"] },
                    returnDate: { type: ["string", "null"] },
                    checkInDate: { type: ["string", "null"] },
                    checkOutDate: { type: ["string", "null"] },
                    nights: { type: ["number", "null"] },
                    distanceKm: { type: ["number", "null"] },
                    ratePerKm: { type: ["number", "null"] },
                    liters: { type: ["number", "null"] },
                    pricePerLiter: { type: ["number", "null"] },
                    ticketNumber: { type: ["string", "null"] },
                    flightNumber: { type: ["string", "null"] },
                    receiptNo: { type: ["string", "null"] },
                    vendorName: { type: ["string", "null"] },
                    projectName: { type: ["string", "null"] },
                  },
                  required: ["category", "amount", "currency", "date", "comment", "fullDay"],
                },
              },
            },
            required: ["candidates"],
          },
        },
      },
      maxTokens: 4000,
    });

    const firstChoice = response.choices?.[0]?.message?.content;
    let jsonText = "";
    if (typeof firstChoice === "string") {
      jsonText = firstChoice;
    } else if (Array.isArray(firstChoice)) {
      jsonText = firstChoice
        .map((part: any) => (part?.type === "text" ? String(part.text ?? "") : ""))
        .join("\n");
    }
    const rawParsed = JSON.parse(jsonText || "{}");
    const rawCandidates = Array.isArray((rawParsed as any)?.candidates) ? (rawParsed as any).candidates : [];

    const candidates: ReceiptExpenseCandidate[] = rawCandidates.map((candidate: any) => ({
      category: normalizeCategory(candidate?.category),
      amount: parseDecimal(candidate?.amount),
      currency: normalizeCurrency(candidate?.currency),
      date: normalizeIsoDate(candidate?.date),
      comment: typeof candidate?.comment === "string" ? candidate.comment : undefined,
      fullDay: typeof candidate?.fullDay === "boolean" ? candidate.fullDay : false,
      flightRouteType:
        candidate?.flightRouteType === "international" || candidate?.flightRouteType === "domestic"
          ? candidate.flightRouteType
          : null,
      departureTime: normalizeTime(candidate?.departureTime),
      arrivalTime: normalizeTime(candidate?.arrivalTime),
      returnDate: normalizeIsoDate(candidate?.returnDate),
      checkInDate: normalizeIsoDate(candidate?.checkInDate),
      checkOutDate: normalizeIsoDate(candidate?.checkOutDate),
      nights: typeof candidate?.nights === "number" ? Math.max(0, Math.round(candidate.nights)) : null,
      distanceKm: parseDecimal(candidate?.distanceKm),
      ratePerKm: parseDecimal(candidate?.ratePerKm),
      liters: parseDecimal(candidate?.liters),
      pricePerLiter: parseDecimal(candidate?.pricePerLiter),
      ticketNumber: typeof candidate?.ticketNumber === "string" ? candidate.ticketNumber : null,
      flightNumber: typeof candidate?.flightNumber === "string" ? candidate.flightNumber : null,
      receiptNo: typeof candidate?.receiptNo === "string" ? candidate.receiptNo : null,
      vendorName: typeof candidate?.vendorName === "string" ? candidate.vendorName : null,
      projectName: typeof candidate?.projectName === "string" ? candidate.projectName : null,
    }));

    return {
      model: response.model || "llm-default",
      raw: rawParsed,
      candidates,
    };
  } catch {
    return null;
  }
}

function getCandidateConfidence(candidate: ReceiptExpenseCandidate): number {
  let score = 2500;
  if (candidate.category && candidate.category !== "other") score += 1500;
  if (typeof candidate.amount === "number" && candidate.amount > 0) score += 2500;
  if (candidate.currency) score += 1000;
  if (candidate.date) score += 1500;
  if (candidate.category === "flight" && candidate.departureTime && candidate.arrivalTime) score += 500;
  if (candidate.category === "hotel" && candidate.checkInDate) score += 500;
  return Math.max(0, Math.min(10000, score));
}

export function validateReceiptCandidate(candidate: ReceiptExpenseCandidate): ImportIssue[] {
  const issues: ImportIssue[] = [];
  const category = normalizeCategory(candidate.category);
  const currency = normalizeCurrency(candidate.currency);

  if (!candidate.date || !DATE_ISO_RE.test(candidate.date)) {
    issues.push(buildIssue("EXP-004", "error", "Datum fehlt oder ist ungültig (YYYY-MM-DD).", "date"));
  }
  if (typeof candidate.amount !== "number" || !Number.isFinite(candidate.amount) || candidate.amount <= 0) {
    issues.push(buildIssue("EXP-002", "error", "Betrag fehlt oder ist <= 0.", "amount"));
  }
  if (!currency) {
    issues.push(buildIssue("EXP-003", "error", "Währung fehlt oder ist ungültig (ISO-3).", "currency"));
  }

  if (category === "flight") {
    const routeType = candidate.flightRouteType ?? "domestic";
    if (routeType === "international") {
      if (!candidate.departureTime) {
        issues.push(buildIssue("EXP-FLT-001", "error", "Internationaler Flug ohne Abflugzeit.", "departureTime"));
      }
      if (!candidate.arrivalTime) {
        issues.push(buildIssue("EXP-FLT-002", "error", "Internationaler Flug ohne Ankunftszeit.", "arrivalTime"));
      }
    }
    if (candidate.departureTime && !TIME_RE.test(candidate.departureTime)) {
      issues.push(buildIssue("EXP-FLT-003", "error", "Abflugzeit muss im Format HH:MM sein.", "departureTime"));
    }
    if (candidate.arrivalTime && !TIME_RE.test(candidate.arrivalTime)) {
      issues.push(buildIssue("EXP-FLT-005", "error", "Ankunftszeit muss im Format HH:MM sein.", "arrivalTime"));
    }
    if (candidate.returnDate && candidate.date && candidate.returnDate < candidate.date) {
      issues.push(buildIssue("EXP-FLT-004", "error", "Rückflugdatum liegt vor Hinflugdatum.", "returnDate"));
    }
  }

  if (category === "hotel") {
    if (!candidate.checkInDate) {
      issues.push(buildIssue("EXP-HOT-001", "error", "Hotel erfordert check_in_date.", "checkInDate"));
    }
    if (!candidate.checkOutDate && typeof candidate.nights !== "number") {
      issues.push(buildIssue("EXP-HOT-002", "error", "Hotel benötigt nights oder check_out_date.", "nights"));
    }
    if (typeof candidate.nights === "number" && candidate.nights < 0) {
      issues.push(buildIssue("EXP-HOT-003", "error", "Hotelnächte dürfen nicht negativ sein.", "nights"));
    }
    if (candidate.checkInDate && candidate.checkOutDate && candidate.checkOutDate < candidate.checkInDate) {
      issues.push(buildIssue("EXP-HOT-004", "error", "Check-out liegt vor Check-in.", "checkOutDate"));
    }
  }

  if (category === "fuel") {
    if (typeof candidate.liters !== "number" || candidate.liters <= 0) {
      issues.push(buildIssue("EXP-FUEL-001", "error", "Fuel erfordert liters > 0.", "liters"));
    }
    if (typeof candidate.pricePerLiter !== "number" || candidate.pricePerLiter <= 0) {
      issues.push(buildIssue("EXP-FUEL-002", "error", "Fuel erfordert price_per_liter > 0.", "pricePerLiter"));
    }
  }

  return issues;
}

export function buildReceiptDedupeHash(candidate: ReceiptExpenseCandidate): string {
  const normalized = [
    normalizeCategory(candidate.category),
    candidate.date ?? "",
    candidate.amount?.toFixed(2) ?? "",
    normalizeCurrency(candidate.currency) ?? "",
    (candidate.receiptNo ?? "").trim().toUpperCase(),
    (candidate.vendorName ?? "").trim().toUpperCase(),
  ].join("|");
  return createHash("sha256").update(normalized).digest("hex");
}

export function toExpenseMutationPayload(candidate: ReceiptExpenseCandidate): Record<string, unknown> {
  const category = normalizeCategory(candidate.category);
  const payload: Record<string, unknown> = {
    category,
    amount: Math.round((candidate.amount ?? 0) * 100),
    currency: normalizeCurrency(candidate.currency) ?? "EUR",
    date: candidate.date ?? "",
    comment: candidate.comment ?? undefined,
    fullDay: Boolean(candidate.fullDay),
  };

  if (category === "flight") {
    payload.flightRouteType = candidate.flightRouteType ?? "domestic";
    payload.departureTime = candidate.departureTime ?? undefined;
    payload.arrivalTime = candidate.arrivalTime ?? undefined;
    payload.checkOutDate = candidate.returnDate ?? undefined;
    payload.ticketNumber = candidate.ticketNumber ?? undefined;
    payload.flightNumber = candidate.flightNumber ?? undefined;
  }

  if (category === "hotel") {
    payload.checkInDate = candidate.checkInDate ?? candidate.date ?? undefined;
    payload.checkOutDate = candidate.checkOutDate ?? candidate.checkInDate ?? candidate.date ?? undefined;
  }

  if (category === "fuel") {
    if (typeof candidate.liters === "number") {
      payload.liters = Math.round(candidate.liters * 1000);
    }
    if (typeof candidate.pricePerLiter === "number") {
      payload.pricePerLiter = Math.round(candidate.pricePerLiter * 100);
    }
  }

  if (typeof candidate.distanceKm === "number") {
    payload.distance = Math.round(candidate.distanceKm);
  }
  if (typeof candidate.ratePerKm === "number") {
    payload.rate = Math.round(candidate.ratePerKm * 100);
  }

  return payload;
}

export async function analyzeReceipt(input: ReceiptAnalysisInput): Promise<ReceiptAnalysisResult> {
  const source: "ocr_text" | "document_url" | "hybrid" =
    input.ocrText && input.documentUrl ? "hybrid" : input.documentUrl ? "document_url" : "ocr_text";

  const llmExtraction = await extractByLlm(input);
  if (llmExtraction && llmExtraction.candidates.length > 0) {
    const enriched = llmExtraction.candidates.map(candidate => {
      const issues = validateReceiptCandidate(candidate);
      return {
        ...candidate,
        confidence: getCandidateConfidence(candidate),
        issues,
      };
    });
    return {
      source,
      engine: "llm",
      model: llmExtraction.model,
      rawExtraction: llmExtraction.raw,
      candidates: enriched,
    };
  }

  const fallback = extractBasicCandidateFromText(input.ocrText ?? "", input);
  const fallbackIssues = validateReceiptCandidate(fallback);
  const fallbackCandidate: ReceiptExpenseCandidate = {
    ...fallback,
    confidence: getCandidateConfidence(fallback),
    issues: fallbackIssues,
  };

  return {
    source,
    engine: "heuristic",
    model: "heuristic-v1",
    rawExtraction: {
      fallback: true,
      sourceLength: (input.ocrText ?? "").length,
    },
    candidates: [fallbackCandidate],
  };
}
