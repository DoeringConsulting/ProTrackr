
import { systemRouter } from "./_core/systemRouter";
import {
  adminOrMandantAdminProcedure,
  isMandantAdmin,
  isWebAppAdmin,
  mandantAdminProcedure,
  publicProcedure,
  protectedProcedure,
  router,
} from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import bcrypt from "bcrypt";
import { generateInvoiceNumber, getInvoiceNumbers, getDb } from "./db";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { expenses } from "../drizzle/schema";
import {
  analyzeReceipt,
  buildReceiptDedupeHash,
  toExpenseMutationPayload,
  validateReceiptCandidate,
  type ReceiptExpenseCandidate,
} from "./receiptAi";

async function isSameMandantForUser(actorMandantId: number | null, targetUserId: number): Promise<boolean> {
  if (!actorMandantId) return false;
  const { findUserById } = await import("./db");
  const owner = await findUserById(targetUserId);
  return !!owner && owner.mandantId === actorMandantId;
}

async function canAccessUserOwnedData(
  actor: { id: number; mandantId: number | null; role: string },
  targetUserId: number
): Promise<boolean> {
  if (isWebAppAdmin(actor)) return false;
  if (actor.id === targetUserId) return true;
  if (!isMandantAdmin(actor)) return false;
  return await isSameMandantForUser(actor.mandantId, targetUserId);
}

function canAssignRoleAsMandantAdmin(role: string): boolean {
  const normalized = normalizeManagedRole(role);
  return normalized === "user" || normalized === "mandant_admin";
}

function normalizeManagedRole(role: string): "user" | "admin" | "mandant_admin" | "webapp_admin" {
  // Legacy compatibility: incoming "admin" is treated as "mandant_admin".
  if (role === "admin") return "mandant_admin";
  if (role === "webapp_admin") return "webapp_admin";
  if (role === "mandant_admin") return "mandant_admin";
  return "user";
}

function canAssignRoleAsGlobalSetupAdmin(role: string): boolean {
  const normalized = normalizeManagedRole(role);
  return normalized === "user" || normalized === "mandant_admin" || normalized === "webapp_admin";
}

function isGlobalSetupAdmin(actor: { role?: string | null } | null | undefined): boolean {
  // Personal-union compatibility:
  // - native global admin role: webapp_admin
  // - legacy bootstrap admin: role=admin and first user (id=1)
  //   to avoid granting global scope to every admin.
  const id = actor && "id" in actor ? Number((actor as any).id) : null;
  const role = actor?.role ?? null;
  return role === "webapp_admin" || (role === "admin" && id === 1);
}

function isMandantAdminRoleValue(role: string | null | undefined): boolean {
  return role === "mandant_admin" || role === "admin";
}

function isGlobalSetupAdminRoleValue(role: string | null | undefined, userId: number): boolean {
  return role === "webapp_admin" || (role === "admin" && userId === 1);
}

function resolveAccountStatus(
  user: { accountStatus?: string | null; passwordHash?: string | null } | null | undefined
): "active" | "suspended" | "deleted" {
  const status = user?.accountStatus ?? null;
  if (status === "active" || status === "suspended" || status === "deleted") {
    return status;
  }
  return user?.passwordHash ? "active" : "suspended";
}

async function canAccessCustomerOwnedData(
  actor: { id: number; mandantId: number | null; role: string },
  customer: { userId: number | null }
): Promise<boolean> {
  if (isWebAppAdmin(actor)) return false;
  if (!customer.userId) return false;
  return await canAccessUserOwnedData(actor, customer.userId);
}

function parseMandatenNumberSequence(mandatenNr: string | null | undefined): number | null {
  if (!mandatenNr) return null;
  const normalized = mandatenNr.trim();
  if (normalized.length === 0) return null;
  const trailingDigits = normalized.match(/(\d+)\s*$/);
  if (!trailingDigits) return null;
  const parsed = Number.parseInt(trailingDigits[1], 10);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return parsed;
}

function formatMandatenNumber(sequence: number): string {
  return String(sequence).padStart(3, "0");
}

type CopyScope = "day" | "week" | "month";

function formatDateKeyLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKeyInput(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`);
  }
  return new Date(value);
}

function addMonthsClamped(date: Date, months: number): Date {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  const targetMonthDate = new Date(year, month + months, 1);
  const targetYear = targetMonthDate.getFullYear();
  const targetMonth = targetMonthDate.getMonth();
  const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  return new Date(targetYear, targetMonth, Math.min(day, lastDayOfTargetMonth));
}

function getScopeRange(anchorDate: Date, scope: CopyScope) {
  const normalizedAnchor = new Date(
    anchorDate.getFullYear(),
    anchorDate.getMonth(),
    anchorDate.getDate()
  );

  if (scope === "day") {
    return { start: normalizedAnchor, end: normalizedAnchor };
  }

  if (scope === "week") {
    const start = new Date(normalizedAnchor);
    const day = start.getDay();
    const diffToMonday = (day + 6) % 7;
    start.setDate(start.getDate() - diffToMonday);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end };
  }

  const start = new Date(normalizedAnchor.getFullYear(), normalizedAnchor.getMonth(), 1);
  const end = new Date(normalizedAnchor.getFullYear(), normalizedAnchor.getMonth() + 1, 0);
  return { start, end };
}

function shiftDateByScope(sourceDate: Date, scope: CopyScope): Date {
  const normalized = new Date(sourceDate.getFullYear(), sourceDate.getMonth(), sourceDate.getDate());
  if (scope === "day") {
    normalized.setDate(normalized.getDate() + 1);
    return normalized;
  }
  if (scope === "week") {
    normalized.setDate(normalized.getDate() + 7);
    return normalized;
  }
  return addMonthsClamped(normalized, 1);
}

function tryShiftDateValue(value: unknown, scope: CopyScope): string | undefined {
  if (value === null || value === undefined) return undefined;
  const input = String(value).trim();
  if (!input) return undefined;
  const source = parseDateKeyInput(input.split(" ")[0] ?? input);
  if (Number.isNaN(source.getTime())) return undefined;
  return formatDateKeyLocal(shiftDateByScope(source, scope));
}

const expenseCategoryValues = [
  "car",
  "train",
  "flight",
  "taxi",
  "transport",
  "meal",
  "hotel",
  "food",
  "fuel",
  "other",
] as const;

const expenseCategorySchema = z.enum(expenseCategoryValues);
const flightRouteTypeSchema = z.enum(["domestic", "international"]);
const hhmmTimeSchema = /^([01]\d|2[0-3]):([0-5]\d)$/;

function toComparableDate(value: unknown): Date | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{2}\.\d{2}\.\d{4}$/.test(trimmed)) {
    const [dd, mm, yyyy] = trimmed.split(".");
    const parsed = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIsoDateOnly(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    if (/^\d{4}-\d{2}-\d{2}[T ]/.test(trimmed)) return trimmed.slice(0, 10);
    if (/^\d{2}\.\d{2}\.\d{4}$/.test(trimmed)) {
      const [dd, mm, yyyy] = trimmed.split(".");
      return `${yyyy}-${mm}-${dd}`;
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return undefined;
}

function validateFlightAndHotelExpenseRules(input: {
  category?: string;
  date?: string;
  checkInDate?: string;
  checkOutDate?: string;
  departureTime?: string;
  arrivalTime?: string;
  flightRouteType?: string;
}) {
  if (input.category === "flight") {
    const routeType = input.flightRouteType ?? "domestic";
    if (routeType !== "domestic" && routeType !== "international") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Ungueltiger Flugtyp. Erlaubt: domestic|international",
      });
    }

    if (!input.date) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Flug erfordert ein Hinflug-Datum",
      });
    }

    if (input.departureTime && !hhmmTimeSchema.test(input.departureTime)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Abflugzeit muss im Format HH:MM angegeben werden",
      });
    }

    if (input.arrivalTime && !hhmmTimeSchema.test(input.arrivalTime)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Ankunftszeit muss im Format HH:MM angegeben werden",
      });
    }

    if (routeType === "international") {
      if (!input.departureTime || !input.arrivalTime) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Bei internationalen Fluegen sind Abflugzeit und Ankunftszeit verpflichtend",
        });
      }
    }

    const outboundDate = toComparableDate(input.date);
    const returnDate = toComparableDate(input.checkOutDate);
    if (outboundDate && returnDate && returnDate.getTime() < outboundDate.getTime()) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Rueckflug-Datum darf nicht vor dem Hinflug-Datum liegen",
      });
    }
  }

  if (input.category === "hotel") {
    if (!input.checkInDate) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Hotel erfordert ein Check-in-Datum",
      });
    }
    const checkIn = toComparableDate(input.checkInDate);
    const checkOut = toComparableDate(input.checkOutDate);
    if (checkIn && checkOut && checkOut.getTime() < checkIn.getTime()) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Check-out darf nicht vor Check-in liegen",
      });
    }
  }
}

function calculateTimeEntryFinancials(input: {
  hoursMinutes: number;
  entryType: string;
  customer: {
    onsiteRate: number;
    remoteRate: number;
    standardDayHours?: number | null;
  };
}) {
  const baseHours = Math.max(1, Number(input.customer.standardDayHours ?? 800) / 100);
  const baseMinutesPerManDay = baseHours * 60;
  const rawManDays = input.hoursMinutes / baseMinutesPerManDay;
  const manDaysThousandths = Math.round(rawManDays * 1000);
  const manDays = manDaysThousandths / 1000;
  const selectedRate = input.entryType === "onsite" ? input.customer.onsiteRate : input.customer.remoteRate;
  const calculatedAmount = Math.round(manDays * selectedRate);
  return {
    rate: selectedRate,
    manDaysThousandths,
    calculatedAmount,
  };
}

async function normalizeTimeEntryFinancialsWithCustomer(
  entry: any,
  customerCache?: Map<number, any | null>
) {
  const { getCustomerById } = await import("./db");
  let customer: any | null | undefined;
  if (customerCache) {
    customer = customerCache.get(entry.customerId);
  }
  if (customer === undefined) {
    customer = await getCustomerById(entry.customerId);
    if (customerCache) {
      customerCache.set(entry.customerId, customer ?? null);
    }
  }
  if (!customer) return entry;
  const financials = calculateTimeEntryFinancials({
    hoursMinutes: entry.hours,
    entryType: entry.entryType,
    customer,
  });
  return {
    ...entry,
    rate: financials.rate,
    manDays: financials.manDaysThousandths,
    calculatedAmount: financials.calculatedAmount,
  };
}

type ReceiptMatchSuggestion = {
  strategy: "time_entry_hint" | "customer_project_date" | "customer_date" | "date_only" | "unmatched";
  confidence: number;
  customerId: number | null;
  timeEntryId: number | null;
  projectName: string | null;
  reason: string;
};

function parseJsonSafely(value: unknown): any {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function toDateKey(value: unknown): string | null {
  if (!value) return null;
  const stringValue = String(value).trim();
  if (!stringValue) return null;
  const onlyDate = stringValue.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(onlyDate)) return onlyDate;
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(stringValue)) {
    const [dd, mm, yyyy] = stringValue.split(".");
    return `${yyyy}-${mm}-${dd}`;
  }
  const date = new Date(stringValue);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function buildReceiptMatchSuggestion(input: {
  candidate: ReceiptExpenseCandidate;
  timeEntryHintId?: number;
  customerHintId?: number;
  projectHintName?: string;
  timeEntries: any[];
  customersById: Map<number, any>;
}): ReceiptMatchSuggestion {
  const dateKey = toDateKey(input.candidate.date);
  const normalizedProject = (input.projectHintName || input.candidate.projectName || "").trim().toLowerCase();

  if (input.timeEntryHintId) {
    const byHint = input.timeEntries.find(entry => entry.id === input.timeEntryHintId);
    if (byHint) {
      return {
        strategy: "time_entry_hint",
        confidence: 9900,
        customerId: byHint.customerId ?? null,
        timeEntryId: byHint.id,
        projectName: byHint.projectName ?? null,
        reason: "Zeit-Eintrag wurde explizit als Hinweis übergeben.",
      };
    }
  }

  const filteredByDate = dateKey
    ? input.timeEntries.filter(entry => toDateKey(entry.date) === dateKey)
    : input.timeEntries;

  if (input.customerHintId && normalizedProject) {
    const exact = filteredByDate.find(
      entry => entry.customerId === input.customerHintId && String(entry.projectName || "").trim().toLowerCase() === normalizedProject
    );
    if (exact) {
      return {
        strategy: "customer_project_date",
        confidence: 9600,
        customerId: exact.customerId ?? null,
        timeEntryId: exact.id,
        projectName: exact.projectName ?? null,
        reason: "Match über Kunde + Projektname + Datum.",
      };
    }
  }

  if (input.customerHintId) {
    const byCustomerDate = filteredByDate.find(entry => entry.customerId === input.customerHintId);
    if (byCustomerDate) {
      return {
        strategy: "customer_date",
        confidence: 9000,
        customerId: byCustomerDate.customerId ?? null,
        timeEntryId: byCustomerDate.id,
        projectName: byCustomerDate.projectName ?? null,
        reason: "Match über Kunde + Datum.",
      };
    }

    const customer = input.customersById.get(input.customerHintId);
    if (customer) {
      return {
        strategy: "customer_date",
        confidence: 6500,
        customerId: customer.id,
        timeEntryId: null,
        projectName: customer.projectName ?? null,
        reason: "Kunde gefunden, aber kein passender Zeit-Eintrag am Datum.",
      };
    }
  }

  if (normalizedProject && filteredByDate.length > 0) {
    const byProject = filteredByDate.find(
      entry => String(entry.projectName || "").trim().toLowerCase() === normalizedProject
    );
    if (byProject) {
      return {
        strategy: "date_only",
        confidence: 7800,
        customerId: byProject.customerId ?? null,
        timeEntryId: byProject.id,
        projectName: byProject.projectName ?? null,
        reason: "Match über Datum + Projektname.",
      };
    }
  }

  if (filteredByDate.length === 1) {
    const only = filteredByDate[0];
    return {
      strategy: "date_only",
      confidence: 6800,
      customerId: only.customerId ?? null,
      timeEntryId: only.id ?? null,
      projectName: only.projectName ?? null,
      reason: "Genau ein Zeit-Eintrag am Datum gefunden.",
    };
  }

  return {
    strategy: "unmatched",
    confidence: 0,
    customerId: input.customerHintId ?? null,
    timeEntryId: null,
    projectName: input.projectHintName ?? null,
    reason: "Kein eindeutiger Match gefunden.",
  };
}

export const appRouter = router({
  invoiceNumbers: router({
    generate: protectedProcedure
      .input(z.object({ customerId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const { getCustomerById } = await import("./db");
        const customer = await getCustomerById(input.customerId);
        if (!customer) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Kunde nicht gefunden" });
        }
        if (!(await canAccessCustomerOwnedData(ctx.user, { userId: customer.userId ?? null }))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf diesen Kunden" });
        }
        const invoiceNumber = await generateInvoiceNumber(input.customerId);
        return { invoiceNumber };
      }),
    list: protectedProcedure
      .input(z.object({ year: z.number().optional() }))
      .query(async ({ ctx, input }) => {
        const { getCustomerById } = await import("./db");
        const invoices = await getInvoiceNumbers(input.year);

        if (isWebAppAdmin(ctx.user)) {
          return [];
        }

        const result = [];
        for (const invoice of invoices) {
          const customer = await getCustomerById(invoice.customerId);
          if (!customer) continue;
          if (await canAccessCustomerOwnedData(ctx.user, { userId: customer.userId ?? null })) {
            result.push(invoice);
          }
        }
        return result;
      }),
  }),
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,

  // Customer management
  customers: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getCustomers } = await import("./db");
      if (isWebAppAdmin(ctx.user)) return [];
      const customers = await getCustomers();
      const result = [];
      for (const customer of customers) {
        if (await canAccessCustomerOwnedData(ctx.user, { userId: customer.userId ?? null })) {
          result.push(customer);
        }
      }
      return result;
    }),
    getById: protectedProcedure.input((val: unknown) => {
      return z.object({ id: z.number() }).parse(val);
    }).query(async ({ ctx, input }) => {
      const { getCustomerById } = await import("./db");
      const customer = await getCustomerById(input.id);
      if (!customer) return null;
      if (!(await canAccessCustomerOwnedData(ctx.user, { userId: customer.userId ?? null }))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf diesen Kunden" });
      }
      return customer;
    }),
    create: mandantAdminProcedure.input((val: unknown) => {
      return z.object({
        provider: z.string(),
        mandatenNr: z.string().optional(),
        projectName: z.string(),
        location: z.string(),
        standardDayHours: z.number().min(1).max(2400).optional(),
        onsiteRate: z.number(),
        onsiteRateCurrency: z.string().optional(),
        remoteRate: z.number(),
        remoteRateCurrency: z.string().optional(),
        kmRate: z.number(),
        kmRateCurrency: z.string().optional(),
        mealRate: z.number(),
        mealRateCurrency: z.string().optional(),
        costModel: z.enum(["exclusive", "inclusive"]),
        street: z.string().optional(),
        postalCode: z.string().optional(),
        city: z.string().optional(),
        country: z.string().optional(),
        vatId: z.string().optional(),
      }).parse(val);
    }).mutation(async ({ ctx, input }) => {
      const { createCustomer, getAllCustomersIncludingArchived, getCustomersByMandatenNr } = await import("./db");
      const allCustomers = await getAllCustomersIncludingArchived();
      let maxSequence = 0;

      for (const existing of allCustomers) {
        if (!(await canAccessCustomerOwnedData(ctx.user, { userId: existing.userId ?? null }))) {
          continue;
        }
        const sequence = parseMandatenNumberSequence(existing.mandatenNr);
        if (sequence && sequence > maxSequence) {
          maxSequence = sequence;
        }
      }
      let nextSequence = maxSequence + 1;
      let assignedMandatenNr = formatMandatenNumber(nextSequence);

      // Reserve the next free number in scope; protects against pre-existing gaps/conflicts.
      while (true) {
        const existingWithSameNumber = await getCustomersByMandatenNr(assignedMandatenNr);
        let conflictInScope = false;

        for (const existing of existingWithSameNumber) {
          if (await canAccessCustomerOwnedData(ctx.user, { userId: existing.userId ?? null })) {
            conflictInScope = true;
            break;
          }
        }

        if (!conflictInScope) {
          break;
        }

        nextSequence += 1;
        assignedMandatenNr = formatMandatenNumber(nextSequence);
      }

      return await createCustomer({
        ...input,
        standardDayHours: input.standardDayHours ?? 800,
        mandatenNr: assignedMandatenNr,
        userId: ctx.user.id,
      });
    }),
    update: mandantAdminProcedure.input((val: unknown) => {
      return z.object({
        id: z.number(),
        provider: z.string().optional(),
        mandatenNr: z.string().optional(),
        projectName: z.string().optional(),
        location: z.string().optional(),
        standardDayHours: z.number().min(1).max(2400).optional(),
        onsiteRate: z.number().optional(),
        onsiteRateCurrency: z.string().optional(),
        remoteRate: z.number().optional(),
        remoteRateCurrency: z.string().optional(),
        kmRate: z.number().optional(),
        kmRateCurrency: z.string().optional(),
        mealRate: z.number().optional(),
        mealRateCurrency: z.string().optional(),
        costModel: z.enum(["exclusive", "inclusive"]).optional(),
        street: z.string().optional(),
        postalCode: z.string().optional(),
        city: z.string().optional(),
        country: z.string().optional(),
        vatId: z.string().optional(),
      }).parse(val);
    }).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const {
        getCustomerById,
        getCustomersByMandatenNr,
        recalculateTimeEntriesForCustomer,
        updateCustomer,
      } = await import("./db");
      const customer = await getCustomerById(id);
      if (!customer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Kunde nicht gefunden" });
      }
      if (!(await canAccessCustomerOwnedData(ctx.user, { userId: customer.userId ?? null }))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf diesen Kunden" });
      }

      if (data.mandatenNr && data.mandatenNr !== customer.mandatenNr) {
        const existingWithSameNumber = await getCustomersByMandatenNr(data.mandatenNr);
        for (const existing of existingWithSameNumber) {
          if (existing.id === id) continue;
          if (await canAccessCustomerOwnedData(ctx.user, { userId: existing.userId ?? null })) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "Mandanten-Nr ist im aktuellen Mandantenbereich bereits vergeben",
            });
          }
        }
      }

      await updateCustomer(id, data);
      if (
        data.standardDayHours !== undefined ||
        data.onsiteRate !== undefined ||
        data.remoteRate !== undefined
      ) {
        await recalculateTimeEntriesForCustomer(id);
      }
      return { success: true };
    }),
    delete: mandantAdminProcedure.input((val: unknown) => {
      return z.object({ id: z.number() }).parse(val);
    }).mutation(async ({ ctx, input }) => {
      const { deleteCustomer, getCustomerById } = await import("./db");
      const customer = await getCustomerById(input.id);
      if (!customer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Kunde nicht gefunden" });
      }
      if (!(await canAccessCustomerOwnedData(ctx.user, { userId: customer.userId ?? null }))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf diesen Kunden" });
      }
      await deleteCustomer(input.id);
      return { success: true };
    }),
    archive: mandantAdminProcedure.input((val: unknown) => {
      return z.object({ id: z.number() }).parse(val);
    }).mutation(async ({ ctx, input }) => {
      const { archiveCustomer, getCustomerById } = await import("./db");
      const customer = await getCustomerById(input.id);
      if (!customer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Kunde nicht gefunden" });
      }
      if (!(await canAccessCustomerOwnedData(ctx.user, { userId: customer.userId ?? null }))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf diesen Kunden" });
      }
      await archiveCustomer(input.id);
      return { success: true };
    }),
    unarchive: mandantAdminProcedure.input((val: unknown) => {
      return z.object({ id: z.number() }).parse(val);
    }).mutation(async ({ ctx, input }) => {
      const { getCustomerById, unarchiveCustomer } = await import("./db");
      const customer = await getCustomerById(input.id);
      if (!customer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Kunde nicht gefunden" });
      }
      if (!(await canAccessCustomerOwnedData(ctx.user, { userId: customer.userId ?? null }))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf diesen Kunden" });
      }
      await unarchiveCustomer(input.id);
      return { success: true };
    }),
  }),

  // Time tracking
  timeEntries: router({
    list: protectedProcedure.input((val: unknown) => {
      return z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).parse(val);
    }).query(async ({ ctx, input }) => {
      const { getTimeEntries } = await import("./db");
      const startDate = input.startDate ? new Date(input.startDate) : undefined;
      const endDate = input.endDate ? new Date(input.endDate) : undefined;
      const entries = await getTimeEntries(ctx.user.id, startDate, endDate);
      const customerCache = new Map<number, any | null>();
      const normalized = await Promise.all(
        entries.map((entry) => normalizeTimeEntryFinancialsWithCustomer(entry, customerCache))
      );
      return normalized;
    }),
    getById: protectedProcedure.input((val: unknown) => {
      return z.object({ id: z.number() }).parse(val);
    }).query(async ({ ctx, input }) => {
      const { getTimeEntryById } = await import("./db");
      const entry = await getTimeEntryById(input.id);
      if (!entry) return null;

      if (!(await canAccessUserOwnedData(ctx.user, entry.userId))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf diesen Zeiteintrag" });
      }

      return await normalizeTimeEntryFinancialsWithCustomer(entry);
    }),
    create: protectedProcedure.input((val: unknown) => {
      return z.object({
        customerId: z.number(),
        date: z.string(),
        weekday: z.string(),
        projectName: z.string(),
        entryType: z.enum(["onsite", "remote", "off_duty", "business_trip"]),
        description: z.string().optional(),
        hours: z.number(),
        rate: z.number().optional(),
        calculatedAmount: z.number().optional(),
        manDays: z.number().optional(),
      }).parse(val);
    }).mutation(async ({ ctx, input }) => {
      const { createTimeEntry, getCustomerById } = await import("./db");
      const customer = await getCustomerById(input.customerId);
      if (!customer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Kunde nicht gefunden" });
      }
      if (!(await canAccessCustomerOwnedData(ctx.user, { userId: customer.userId ?? null }))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf diesen Kunden" });
      }

      const financials = calculateTimeEntryFinancials({
        hoursMinutes: input.hours,
        entryType: input.entryType,
        customer,
      });

      return await createTimeEntry({
        ...input,
        userId: ctx.user.id,
        date: new Date(input.date),
        rate: financials.rate,
        manDays: financials.manDaysThousandths,
        calculatedAmount: financials.calculatedAmount,
      });
    }),
    update: protectedProcedure.input((val: unknown) => {
      return z.object({
        id: z.number(),
        customerId: z.number().optional(),
        date: z.string().optional(),
        weekday: z.string().optional(),
        projectName: z.string().optional(),
        entryType: z.enum(["onsite", "remote", "off_duty", "business_trip"]).optional(),
        description: z.string().optional(),
        hours: z.number().optional(),
        rate: z.number().optional(),
        calculatedAmount: z.number().optional(),
        manDays: z.number().optional(),
      }).parse(val);
    }).mutation(async ({ ctx, input }) => {
      const { id, date, ...data } = input;
      const { getCustomerById, getTimeEntryById, updateTimeEntry } = await import("./db");
      const existing = await getTimeEntryById(id);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Zeiteintrag nicht gefunden" });
      }
      if (!(await canAccessUserOwnedData(ctx.user, existing.userId))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf diesen Zeiteintrag" });
      }

      const nextCustomerId = data.customerId ?? existing.customerId;
      const customer = await getCustomerById(nextCustomerId);
      if (!customer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Kunde nicht gefunden" });
      }
      if (!(await canAccessCustomerOwnedData(ctx.user, { userId: customer.userId ?? null }))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf diesen Kunden" });
      }

      const nextHours = data.hours ?? existing.hours;
      const nextEntryType = data.entryType ?? existing.entryType;
      const financials = calculateTimeEntryFinancials({
        hoursMinutes: nextHours,
        entryType: nextEntryType,
        customer,
      });

      await updateTimeEntry(id, {
        ...data,
        ...(date ? { date: new Date(date) } : {}),
        rate: financials.rate,
        manDays: financials.manDaysThousandths,
        calculatedAmount: financials.calculatedAmount,
      });
      return { success: true };
    }),
    delete: protectedProcedure.input((val: unknown) => {
      return z.object({ id: z.number() }).parse(val);
    }).mutation(async ({ ctx, input }) => {
      const { deleteTimeEntry, getTimeEntryById } = await import("./db");
      const existing = await getTimeEntryById(input.id);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Zeiteintrag nicht gefunden" });
      }
      if (!(await canAccessUserOwnedData(ctx.user, existing.userId))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf diesen Zeiteintrag" });
      }

      await deleteTimeEntry(input.id);
      return { success: true };
    }),
    bulkCreate: protectedProcedure.input((val: unknown) => {
      return z.object({
        sourceId: z.number(),
        targetDates: z.array(z.string()),
      }).parse(val);
    }).mutation(async ({ input, ctx }) => {
      const { getTimeEntryById, createTimeEntry, getCustomerById } = await import("./db");
      const sourceEntry = await getTimeEntryById(input.sourceId);
      
      if (!sourceEntry) {
        throw new Error("Source entry not found");
      }
      if (!(await canAccessUserOwnedData(ctx.user, sourceEntry.userId))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf diesen Quell-Zeiteintrag" });
      }

      const customer = await getCustomerById(sourceEntry.customerId);
      if (!customer) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Kunde nicht gefunden" });
      }
      
      const createdEntries = [];
      for (const targetDate of input.targetDates) {
        const financials = calculateTimeEntryFinancials({
          hoursMinutes: sourceEntry.hours,
          entryType: sourceEntry.entryType,
          customer,
        });
        const newEntry = await createTimeEntry({
          userId: ctx.user.id,
          customerId: sourceEntry.customerId,
          date: new Date(targetDate),
          weekday: new Date(targetDate).toLocaleDateString('de-DE', { weekday: 'long' }),
          projectName: sourceEntry.projectName,
          entryType: sourceEntry.entryType,
          description: sourceEntry.description,
          hours: sourceEntry.hours,
          rate: financials.rate,
          calculatedAmount: financials.calculatedAmount,
          manDays: financials.manDaysThousandths,
        });
        createdEntries.push(newEntry);
      }
      
      return { success: true, count: createdEntries.length };
    }),
    copyRangeToNext: protectedProcedure.input((val: unknown) => {
      return z.object({
        scope: z.enum(["day", "week", "month"]),
        anchorDate: z.string(),
      }).parse(val);
    }).mutation(async ({ ctx, input }) => {
      const { getTimeEntries, getAllExpenses, createTimeEntry, createExpense, getCustomerById } =
        await import("./db");

      const anchor = parseDateKeyInput(input.anchorDate);
      if (Number.isNaN(anchor.getTime())) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Ungueltiges Datum fuer Kopiervorgang" });
      }

      const { start, end } = getScopeRange(anchor, input.scope);
      const sourceStartKey = formatDateKeyLocal(start);
      const sourceEndKey = formatDateKeyLocal(end);

      const sourceEntries = await getTimeEntries(ctx.user.id, start, end);
      const sourceExpenses = await getAllExpenses(ctx.user.id, sourceStartKey, sourceEndKey);

      if (sourceEntries.length === 0 && sourceExpenses.length === 0) {
        return {
          success: true,
          copiedTimeEntries: 0,
          copiedExpenses: 0,
          skippedExpenses: 0,
          sourceStart: sourceStartKey,
          sourceEnd: sourceEndKey,
        };
      }

      const weekdayDe = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
      const weekdayPl = ["Nd", "Pn", "Wt", "Sr", "Cz", "Pt", "Sb"];
      const entryIdMap = new Map<number, number>();
      const customerCache = new Map<number, any>();
      let copiedTimeEntries = 0;
      let copiedExpenses = 0;
      let skippedExpenses = 0;

      for (const entry of sourceEntries) {
        let customer = customerCache.get(entry.customerId);
        if (!customer) {
          customer = await getCustomerById(entry.customerId);
          if (customer) customerCache.set(entry.customerId, customer);
        }
        if (!customer) continue;

        const sourceDate = new Date(entry.date as any);
        if (Number.isNaN(sourceDate.getTime())) continue;
        const shiftedDate = shiftDateByScope(sourceDate, input.scope);
        const shiftedDateKey = formatDateKeyLocal(shiftedDate);
        const weekday = `${weekdayDe[shiftedDate.getDay()]}/${weekdayPl[shiftedDate.getDay()]}`;
        const financials = calculateTimeEntryFinancials({
          hoursMinutes: entry.hours,
          entryType: entry.entryType,
          customer,
        });

        const created = await createTimeEntry({
          userId: entry.userId,
          customerId: entry.customerId,
          date: new Date(`${shiftedDateKey}T00:00:00`),
          weekday,
          projectName: entry.projectName,
          entryType: entry.entryType,
          description: entry.description,
          hours: entry.hours,
          rate: financials.rate,
          calculatedAmount: financials.calculatedAmount,
          manDays: financials.manDaysThousandths,
        });
        if (created && typeof created === "object" && "id" in created) {
          entryIdMap.set(Number(entry.id), Number((created as any).id));
          copiedTimeEntries += 1;
        }
      }

      for (const expense of sourceExpenses as any[]) {
        const shiftedPrimaryDate = tryShiftDateValue(expense.date, input.scope);
        if (!shiftedPrimaryDate) continue;

        const mappedTimeEntryId =
          expense.timeEntryId && entryIdMap.has(Number(expense.timeEntryId))
            ? Number(entryIdMap.get(Number(expense.timeEntryId)))
            : null;

        if (expense.timeEntryId && !mappedTimeEntryId) {
          skippedExpenses += 1;
          continue;
        }

        const payload: Record<string, any> = {
          timeEntryId: mappedTimeEntryId ?? undefined,
          userId: mappedTimeEntryId ? undefined : expense.userId ?? ctx.user.id,
          date: shiftedPrimaryDate,
          category: expense.category,
          amount: expense.amount,
          currency: expense.currency || "EUR",
          comment: expense.comment || undefined,
          travelStart: expense.travelStart || undefined,
          travelEnd: expense.travelEnd || undefined,
          fullDay: Number(expense.fullDay || 0),
          ticketNumber: expense.ticketNumber || undefined,
          flightNumber: expense.flightNumber || undefined,
          flightRouteType: expense.flightRouteType || undefined,
          departureTime: expense.departureTime || undefined,
          arrivalTime: expense.arrivalTime || undefined,
          checkInDate: tryShiftDateValue(expense.checkInDate, input.scope) || undefined,
          checkOutDate: tryShiftDateValue(expense.checkOutDate, input.scope) || undefined,
          distance: expense.distance ?? undefined,
          rate: expense.rate ?? undefined,
          liters: expense.liters ?? undefined,
          pricePerLiter: expense.pricePerLiter ?? undefined,
        };

        await createExpense(payload);
        copiedExpenses += 1;
      }

      return {
        success: true,
        copiedTimeEntries,
        copiedExpenses,
        skippedExpenses,
        sourceStart: sourceStartKey,
        sourceEnd: sourceEndKey,
      };
    }),
  }),

  // Expenses
  expenses: router({
    list: protectedProcedure.input((val: unknown) => {
      return z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).parse(val);
    }).query(async ({ ctx, input }) => {
      const { getAllExpenses, listUsersByMandantId } = await import("./db");

      if (isWebAppAdmin(ctx.user)) {
        return [];
      }

      if (isMandantAdmin(ctx.user) && ctx.user.mandantId) {
        const mandantUsers = await listUsersByMandantId(ctx.user.mandantId);
        const result = await Promise.all(
          mandantUsers.map((user) =>
            getAllExpenses(user.id, input.startDate, input.endDate)
          )
        );
        return result.flat();
      }

      return await getAllExpenses(ctx.user.id, input.startDate, input.endDate);
    }),
    listByTimeEntry: protectedProcedure.input((val: unknown) => {
      return z.object({ timeEntryId: z.number() }).parse(val);
    }).query(async ({ ctx, input }) => {
      const { getExpensesByTimeEntry, getTimeEntryById } = await import("./db");
      const timeEntry = await getTimeEntryById(input.timeEntryId);
      if (!timeEntry) {
        return [];
      }
      if (!(await canAccessUserOwnedData(ctx.user, timeEntry.userId))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf diese Reisekosten" });
      }
      return await getExpensesByTimeEntry(input.timeEntryId);
    }),
    create: protectedProcedure.input((val: unknown) => {
      return z.object({
        timeEntryId: z.number().optional(),
        date: z.string().optional(), // ISO date string for standalone expenses
        category: expenseCategorySchema,
        distance: z.number().optional(),
        rate: z.number().optional(),
        amount: z.number(),
        currency: z.string().length(3).optional().default("EUR"),
        comment: z.string().optional(),
        travelStart: z.string().optional(),
        travelEnd: z.string().optional(),
        fullDay: z.boolean().optional(),
        ticketNumber: z.string().optional(),
        flightNumber: z.string().optional(),
        flightRouteType: flightRouteTypeSchema.optional(),
        departureTime: z.string().optional(),
        arrivalTime: z.string().optional(),
        checkInDate: z.string().optional(),
        checkOutDate: z.string().optional(),
        liters: z.number().optional(),
        pricePerLiter: z.number().optional(),
      }).parse(val);
    }).mutation(async ({ ctx, input }) => {
      const { createExpense, getTimeEntryById } = await import("./db");
      let ownerUserId = ctx.user.id;
      let linkedTimeEntryDate: string | undefined;

      if (input.timeEntryId) {
        const timeEntry = await getTimeEntryById(input.timeEntryId);
        if (!timeEntry) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Zugehoeriger Zeiteintrag nicht gefunden" });
        }
        if (!(await canAccessUserOwnedData(ctx.user, timeEntry.userId))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf diesen Zeiteintrag" });
        }
        ownerUserId = timeEntry.userId;
        linkedTimeEntryDate = toIsoDateOnly(timeEntry.date);
      }

      const normalizedInput = {
        ...input,
        date: input.date ?? linkedTimeEntryDate,
        ...(input.category === "flight"
          ? { flightRouteType: input.flightRouteType ?? "domestic" }
          : {}),
      };
      validateFlightAndHotelExpenseRules(normalizedInput);

      const data = {
        ...normalizedInput,
        userId: ownerUserId,
        fullDay: input.fullDay ? 1 : 0,
      };
      return await createExpense(data);
    }),
    createBatch: protectedProcedure.input((val: unknown) => {
      return z.object({
        timeEntryId: z.number(),
        expenses: z.array(z.object({
          date: z.string().optional(),
          category: expenseCategorySchema,
          distance: z.number().optional(),
          rate: z.number().optional(),
          amount: z.number(),
          currency: z.string().length(3).optional().default("EUR"),
          comment: z.string().optional(),
          travelStart: z.string().optional(),
          travelEnd: z.string().optional(),
          fullDay: z.boolean().optional(),
          ticketNumber: z.string().optional(),
          flightNumber: z.string().optional(),
          flightRouteType: flightRouteTypeSchema.optional(),
          departureTime: z.string().optional(),
          arrivalTime: z.string().optional(),
          checkInDate: z.string().optional(),
          checkOutDate: z.string().optional(),
          liters: z.number().optional(),
          pricePerLiter: z.number().optional(),
        })),
      }).parse(val);
    }).mutation(async ({ ctx, input }) => {
      const { createExpense, getTimeEntryById } = await import("./db");
      const timeEntry = await getTimeEntryById(input.timeEntryId);
      if (!timeEntry) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Zugehoeriger Zeiteintrag nicht gefunden" });
      }
      if (!(await canAccessUserOwnedData(ctx.user, timeEntry.userId))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf diesen Zeiteintrag" });
      }
      const linkedTimeEntryDate = toIsoDateOnly(timeEntry.date);
      const results = [];
      for (const expense of input.expenses) {
        const normalizedExpense = {
          ...expense,
          date: expense.date ?? linkedTimeEntryDate,
          ...(expense.category === "flight"
            ? { flightRouteType: expense.flightRouteType ?? "domestic" }
            : {}),
        };
        validateFlightAndHotelExpenseRules(normalizedExpense);

        const result = await createExpense({
          timeEntryId: input.timeEntryId,
          userId: timeEntry.userId,
          ...normalizedExpense,
          fullDay: expense.fullDay ? 1 : 0,
        });
        results.push(result);
      }
      return { success: true, count: results.length };
    }),
    update: protectedProcedure.input((val: unknown) => {
      return z.object({
        id: z.number(),
        date: z.string().optional(),
        category: expenseCategorySchema.optional(),
        distance: z.number().optional(),
        rate: z.number().optional(),
        amount: z.number().optional(),
        currency: z.string().length(3).optional(),
        comment: z.string().optional(),
        travelStart: z.string().optional(),
        travelEnd: z.string().optional(),
        fullDay: z.boolean().optional(),
        ticketNumber: z.string().optional(),
        flightNumber: z.string().optional(),
        flightRouteType: flightRouteTypeSchema.optional(),
        departureTime: z.string().optional(),
        arrivalTime: z.string().optional(),
        checkInDate: z.string().optional(),
        checkOutDate: z.string().optional(),
        liters: z.number().optional(),
        pricePerLiter: z.string().optional(),
      }).parse(val);
    }).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const { getExpenseById, getTimeEntryById, updateExpense } = await import("./db");
      const expense = await getExpenseById(id);
      if (!expense) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Reisekosten-Eintrag nicht gefunden" });
      }

      let ownerUserId: number | null = expense.userId ?? null;
      if (!ownerUserId && expense.timeEntryId) {
        const parentEntry = await getTimeEntryById(expense.timeEntryId);
        ownerUserId = parentEntry?.userId ?? null;
      }

      if (!ownerUserId || !(await canAccessUserOwnedData(ctx.user, ownerUserId))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf diesen Reisekosten-Eintrag" });
      }

      const mergedValidationInput = {
        category: data.category ?? expense.category ?? undefined,
        date: data.date ?? (expense.date ? String(expense.date) : undefined),
        checkInDate: data.checkInDate ?? (expense.checkInDate ? String(expense.checkInDate) : undefined),
        checkOutDate: data.checkOutDate ?? (expense.checkOutDate ? String(expense.checkOutDate) : undefined),
        departureTime: data.departureTime ?? (expense.departureTime ? String(expense.departureTime) : undefined),
        arrivalTime: data.arrivalTime ?? (expense.arrivalTime ? String(expense.arrivalTime) : undefined),
        flightRouteType:
          data.flightRouteType ??
          (expense.flightRouteType ? String(expense.flightRouteType) : undefined) ??
          ((data.category ?? expense.category) === "flight" ? "domestic" : undefined),
      };
      validateFlightAndHotelExpenseRules(mergedValidationInput);

      const nextCategory = mergedValidationInput.category;
      const nextFlightRouteType =
        nextCategory === "flight" ? mergedValidationInput.flightRouteType ?? "domestic" : undefined;

      const normalizedData = {
        ...data,
        ...(data.fullDay !== undefined ? { fullDay: data.fullDay ? 1 : 0 } : {}),
        ...(nextFlightRouteType !== undefined ? { flightRouteType: nextFlightRouteType } : {}),
        ...(data.category && data.category !== "flight" ? { flightRouteType: null } : {}),
      };
      await updateExpense(id, normalizedData);
      return { success: true };
    }),
    delete: protectedProcedure.input((val: unknown) => {
      return z.object({ id: z.number() }).parse(val);
    }).mutation(async ({ ctx, input }) => {
      const { deleteExpense, getExpenseById, getTimeEntryById } = await import("./db");
      const expense = await getExpenseById(input.id);
      if (!expense) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Reisekosten-Eintrag nicht gefunden" });
      }

      let ownerUserId: number | null = expense.userId ?? null;
      if (!ownerUserId && expense.timeEntryId) {
        const parentEntry = await getTimeEntryById(expense.timeEntryId);
        ownerUserId = parentEntry?.userId ?? null;
      }

      if (!ownerUserId || !(await canAccessUserOwnedData(ctx.user, ownerUserId))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf diesen Reisekosten-Eintrag" });
      }

      await deleteExpense(input.id);
      return { success: true };
    }),
    aggregateByCustomer: protectedProcedure.input((val: unknown) => {
      return z.object({
        customerId: z.number(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).parse(val);
    }).query(async ({ ctx, input }) => {
      const { getExpensesByCustomer, listUsersByMandantId } = await import("./db");
      const startDate = input.startDate ? new Date(input.startDate) : undefined;
      const endDate = input.endDate ? new Date(input.endDate) : undefined;

      if (isWebAppAdmin(ctx.user)) {
        return [];
      }

      if (isMandantAdmin(ctx.user) && ctx.user.mandantId) {
        const mandantUsers = await listUsersByMandantId(ctx.user.mandantId);
        const result = await Promise.all(
          mandantUsers.map((user) =>
            getExpensesByCustomer(user.id, input.customerId, startDate, endDate)
          )
        );
        return result.flat();
      }

      return await getExpensesByCustomer(ctx.user.id, input.customerId, startDate, endDate);
    }),
  }),

  // Currency support
  currencies: router({
    list: protectedProcedure.query(() => {
      const { NBP_CURRENCIES } = require("./nbp");
      return NBP_CURRENCIES;
    }),
    getRate: protectedProcedure.input((val: unknown) => {
      return z.object({
        currencyCode: z.string(),
        date: z.string(),
      }).parse(val);
    }).query(async ({ input }) => {
      const { fetchNBPExchangeRate } = await import("./nbp");
      const date = new Date(input.date);
      const rate = await fetchNBPExchangeRate(input.currencyCode, date);
      return { currencyCode: input.currencyCode, date: input.date, rate };
    }),
  }),

  // Exchange rates
  exchangeRates: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getExchangeRates } = await import("./db");
      if (isWebAppAdmin(ctx.user)) return [];
      return await getExchangeRates({ userId: ctx.user.id });
    }),
    getByDate: protectedProcedure.input((val: unknown) => {
      return z.object({ date: z.string() }).parse(val);
    }).query(async ({ ctx, input }) => {
      const { getExchangeRateByDate, createExchangeRate } = await import("./db");
      const { fetchNBPExchangeRate } = await import("./nbp");
      if (isWebAppAdmin(ctx.user)) return null;
      
      const date = new Date(input.date);
      // Prefer user-specific manual override, fallback to global rate.
      let rate = await getExchangeRateByDate("EUR/PLN", date, ctx.user.id);
      if (!rate) {
        rate = await getExchangeRateByDate("EUR/PLN", date, 0);
      }
      
      if (!rate) {
        const nbpRate = await fetchNBPExchangeRate("EUR", date);
        await createExchangeRate({
          date,
          currencyPair: "EUR/PLN",
          userId: 0,
          rate: Math.round(nbpRate * 10000),
          source: "NBP",
        });
        rate = await getExchangeRateByDate("EUR/PLN", date, 0);
      }
      
      return rate;
    }),
    fetchRate: protectedProcedure.input((val: unknown) => {
      return z.object({
        currencyCode: z.string(),
        date: z.string(),
      }).parse(val);
    }).mutation(async ({ ctx, input }) => {
      const { createExchangeRate } = await import("./db");
      const { fetchNBPExchangeRate } = await import("./nbp");
      if (isWebAppAdmin(ctx.user)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "WebApp-Admin hat keinen Dateneinblick" });
      }
      
      const date = new Date(input.date);
      const nbpRate = await fetchNBPExchangeRate(input.currencyCode, date);
      
      return await createExchangeRate({
        date,
        currencyPair: `${input.currencyCode}/PLN`,
        userId: 0,
        rate: Math.round(nbpRate * 10000),
        source: "NBP",
      });
    }),
    create: protectedProcedure.input((val: unknown) => {
      return z.object({
        date: z.string(),
        currencyPair: z.string(),
        rate: z.number(),
        source: z.string(),
      }).parse(val);
    }).mutation(async ({ ctx, input }) => {
      const { createExchangeRate } = await import("./db");
      if (isWebAppAdmin(ctx.user)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "WebApp-Admin hat keinen Dateneinblick" });
      }
      return await createExchangeRate({
        date: new Date(input.date),
        currencyPair: input.currencyPair,
        userId: String(input.source).toLowerCase() === "manual" ? ctx.user.id : 0,
        rate: Math.round(input.rate * 10000),
        source: input.source,
      });
    }),
  }),

  // Scheduler – geschützt durch API-Key (für Cron-Jobs, nicht für eingeloggte User)
  scheduler: router({
    runTasks: publicProcedure.mutation(async ({ ctx }) => {
      const apiKey = ctx.req.headers["x-scheduler-key"];
      if (apiKey !== process.env.SCHEDULER_API_KEY) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Ungültiger Scheduler API-Key" });
      }
      const { runScheduledTasks } = await import("./scheduler");
      return await runScheduledTasks();
    }),
    checkMonthEnd: publicProcedure.mutation(async ({ ctx }) => {
      const apiKey = ctx.req.headers["x-scheduler-key"];
      if (apiKey !== process.env.SCHEDULER_API_KEY) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Ungültiger Scheduler API-Key" });
      }
      const { checkMonthEnd } = await import("./scheduler");
      return await checkMonthEnd();
    }),
    checkMissingEntries: publicProcedure.mutation(async ({ ctx }) => {
      const apiKey = ctx.req.headers["x-scheduler-key"];
      if (apiKey !== process.env.SCHEDULER_API_KEY) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Ungültiger Scheduler API-Key" });
      }
      const { checkMissingTimeEntries } = await import("./scheduler");
      return await checkMissingTimeEntries();
    }),
  }),

  // Notifications
  notifications: router({
    sendMonthEndNotification: publicProcedure.input((val: unknown) => {
      return z.object({
        month: z.string(),
        revenue: z.number(),
        expenses: z.number(),
      }).parse(val);
    }).mutation(async ({ input }) => {
      const { notifyMonthEnd } = await import("./notifications");
      return await notifyMonthEnd(input.month, input.revenue, input.expenses);
    }),
    sendMissingTimeEntriesNotification: publicProcedure.input((val: unknown) => {
      return z.object({
        date: z.string(),
        daysWithoutEntries: z.number(),
      }).parse(val);
    }).mutation(async ({ input }) => {
      const { notifyMissingTimeEntries } = await import("./notifications");
      return await notifyMissingTimeEntries(input.date, input.daysWithoutEntries);
    }),
    sendInvoiceDeadlineNotification: publicProcedure.input((val: unknown) => {
      return z.object({
        customer: z.string(),
        deadline: z.string(),
        daysLeft: z.number(),
      }).parse(val);
    }).mutation(async ({ input }) => {
      const { notifyUpcomingInvoiceDeadline } = await import("./notifications");
      return await notifyUpcomingInvoiceDeadline(input.customer, input.deadline, input.daysLeft);
    }),
    sendIncompleteExpensesNotification: publicProcedure.input((val: unknown) => {
      return z.object({
        month: z.string(),
        entriesWithoutExpenses: z.number(),
      }).parse(val);
    }).mutation(async ({ input }) => {
      const { notifyIncompleteExpenses } = await import("./notifications");
      return await notifyIncompleteExpenses(input.month, input.entriesWithoutExpenses);
    }),
  }),

  // Documents
  documents: router({ listByExpense: protectedProcedure.input((val: unknown) => {
      return z.object({ expenseId: z.number() }).parse(val);
    }).query(async ({ ctx, input }) => {
      const { getDocumentsByExpense, getExpenseById, getTimeEntryById } = await import("./db");
      const expense = await getExpenseById(input.expenseId);
      if (!expense) return [];

      let ownerUserId: number | null = expense.userId ?? null;
      if (!ownerUserId && expense.timeEntryId) {
        const parentEntry = await getTimeEntryById(expense.timeEntryId);
        ownerUserId = parentEntry?.userId ?? null;
      }

      if (!ownerUserId || !(await canAccessUserOwnedData(ctx.user, ownerUserId))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf diese Dokumente" });
      }

      return await getDocumentsByExpense(input.expenseId);
    }),
    create: protectedProcedure.input((val: unknown) => {
      return z.object({
        expenseId: z.number().optional(),
        timeEntryId: z.number().optional(),
        fileName: z.string(),
        fileKey: z.string(),
        fileUrl: z.string(),
        mimeType: z.string(),
        fileSize: z.number(),
      }).parse(val);
    }).mutation(async ({ ctx, input }) => {
      const { createDocument, getExpenseById, getTimeEntryById } = await import("./db");

      if (input.timeEntryId) {
        const timeEntry = await getTimeEntryById(input.timeEntryId);
        if (!timeEntry) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Zeiteintrag nicht gefunden" });
        }
        if (!(await canAccessUserOwnedData(ctx.user, timeEntry.userId))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf diesen Zeiteintrag" });
        }
      }

      if (input.expenseId) {
        const expense = await getExpenseById(input.expenseId);
        if (!expense) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Reisekosten-Eintrag nicht gefunden" });
        }
        let ownerUserId: number | null = expense.userId ?? null;
        if (!ownerUserId && expense.timeEntryId) {
          const parentEntry = await getTimeEntryById(expense.timeEntryId);
          ownerUserId = parentEntry?.userId ?? null;
        }
        if (!ownerUserId || !(await canAccessUserOwnedData(ctx.user, ownerUserId))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf diesen Reisekosten-Eintrag" });
        }
      }

      return await createDocument({
        ...input,
        userId: ctx.user.id,
      });
    }),
    delete: protectedProcedure.input((val: unknown) => {
      return z.object({ id: z.number() }).parse(val);
    }).mutation(async ({ ctx, input }) => {
      const { deleteDocument, getDocumentById } = await import("./db");
      const document = await getDocumentById(input.id);
      if (!document) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Dokument nicht gefunden" });
      }
      if (!(await canAccessUserOwnedData(ctx.user, document.userId))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf dieses Dokument" });
      }
      await deleteDocument(input.id);
      return { success: true };
    }),
  }),

  receiptAi: router({
    analyze: protectedProcedure.input((val: unknown) => {
      return z
        .object({
          documentId: z.number().optional(),
          ocrText: z.string().optional(),
          customerId: z.number().optional(),
          timeEntryId: z.number().optional(),
          projectName: z.string().optional(),
          hintCategory: z.string().optional(),
        })
        .refine(input => Boolean(input.documentId || input.ocrText?.trim()), {
          message: "Bitte OCR-Text oder documentId angeben",
        })
        .parse(val);
    }).mutation(async ({ ctx, input }) => {
      const {
        getDocumentById,
        getTimeEntryById,
        getTimeEntries,
        getCustomerById,
        getCustomers,
        createExpenseAiAnalysis,
      } = await import("./db");

      let ownerUserId = ctx.user.id;
      let documentUrl: string | null = null;
      let mimeType: string | null = null;

      if (input.documentId) {
        const document = await getDocumentById(input.documentId);
        if (!document) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Dokument nicht gefunden" });
        }
        if (!(await canAccessUserOwnedData(ctx.user, document.userId))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf dieses Dokument" });
        }
        ownerUserId = document.userId;
        documentUrl = document.fileUrl ?? null;
        mimeType = document.mimeType ?? null;
      }

      if (input.timeEntryId) {
        const timeEntry = await getTimeEntryById(input.timeEntryId);
        if (!timeEntry) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Zeiteintrag nicht gefunden" });
        }
        if (!(await canAccessUserOwnedData(ctx.user, timeEntry.userId))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf diesen Zeiteintrag" });
        }
        ownerUserId = timeEntry.userId;
      }

      if (input.customerId) {
        const customer = await getCustomerById(input.customerId);
        if (!customer) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Kunde nicht gefunden" });
        }
        if (!(await canAccessCustomerOwnedData(ctx.user, { userId: customer.userId ?? null }))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf diesen Kunden" });
        }
        if (customer.userId) {
          ownerUserId = customer.userId;
        }
      }

      const analysis = await analyzeReceipt({
        ocrText: input.ocrText,
        documentUrl,
        mimeType,
        hintCategory: input.hintCategory,
        hintProjectName: input.projectName,
      });

      const customers = (await getCustomers()).filter(
        (customer: any) => Number(customer.userId ?? 0) === Number(ownerUserId)
      );
      const customersById = new Map<number, any>();
      for (const customer of customers) {
        customersById.set(customer.id, customer);
      }

      const timeEntries = await getTimeEntries(ownerUserId);
      const enrichedCandidates = analysis.candidates.map((candidate, index) => {
        const match = buildReceiptMatchSuggestion({
          candidate,
          customerHintId: input.customerId,
          timeEntryHintId: input.timeEntryId,
          projectHintName: input.projectName,
          timeEntries,
          customersById,
        });
        const baseIssues = Array.isArray(candidate.issues) ? candidate.issues : validateReceiptCandidate(candidate);
        const issues =
          match.strategy === "unmatched"
            ? [
                ...baseIssues,
                {
                  code: "REF-003",
                  severity: "warning" as const,
                  message: "Kein eindeutiger Projekt-/Zeiteintrags-Match gefunden. Manuelle Prüfung erforderlich.",
                  field: "timeEntryId",
                },
              ]
            : baseIssues;
        const candidateConfidence = Math.max(0, Math.min(10000, Number(candidate.confidence ?? 0)));
        const overallConfidence = Math.round(candidateConfidence * 0.7 + match.confidence * 0.3);
        return {
          ...candidate,
          confidence: overallConfidence,
          issues,
          match,
          index,
        };
      });

      const highestConfidence = enrichedCandidates.reduce(
        (max, candidate) => Math.max(max, Number(candidate.confidence ?? 0)),
        0
      );
      const primary = enrichedCandidates[0] as ReceiptExpenseCandidate | undefined;
      const dedupeHash = primary ? buildReceiptDedupeHash(primary) : null;
      const validationPayload = enrichedCandidates.map(candidate => ({
        index: candidate.index,
        issues: candidate.issues ?? [],
      }));
      const matchingPayload = enrichedCandidates.map(candidate => ({
        index: candidate.index,
        match: candidate.match,
      }));

      const persisted = await createExpenseAiAnalysis({
        userId: ownerUserId,
        documentId: input.documentId ?? null,
        source: analysis.source,
        modelName: analysis.model,
        ocrText: input.ocrText ?? null,
        extractionPayload: JSON.stringify(analysis.rawExtraction ?? null),
        normalizedPayload: JSON.stringify(enrichedCandidates),
        validationPayload: JSON.stringify(validationPayload),
        matchingPayload: JSON.stringify(matchingPayload),
        dedupeHash,
        status: enrichedCandidates.length > 0 ? "needs_review" : "error",
        confidence: highestConfidence,
      });

      return {
        analysisId: persisted?.id ?? null,
        status: persisted?.status ?? "needs_review",
        source: analysis.source,
        engine: analysis.engine,
        model: analysis.model,
        candidates: enrichedCandidates,
      };
    }),

    list: protectedProcedure.input((val: unknown) => {
      return z.object({ limit: z.number().min(1).max(200).optional() }).parse(val);
    }).query(async ({ ctx, input }) => {
      const { listExpenseAiAnalysesByUser } = await import("./db");
      const rows = await listExpenseAiAnalysesByUser(ctx.user.id, input.limit ?? 50);
      return rows.map(row => ({
        ...row,
        normalizedPayload: parseJsonSafely(row.normalizedPayload),
        validationPayload: parseJsonSafely(row.validationPayload),
        matchingPayload: parseJsonSafely(row.matchingPayload),
      }));
    }),

    approve: protectedProcedure.input((val: unknown) => {
      return z.object({
        analysisId: z.number(),
        candidateIndex: z.number().min(0).optional(),
        overrides: z.object({
          customerId: z.number().optional(),
          timeEntryId: z.number().optional(),
          projectName: z.string().optional(),
          category: expenseCategorySchema.optional(),
          date: z.string().optional(),
          amount: z.number().optional(), // major currency unit
          currency: z.string().length(3).optional(),
          comment: z.string().optional(),
        }).optional(),
      }).parse(val);
    }).mutation(async ({ ctx, input }) => {
      const {
        getExpenseAiAnalysisById,
        updateExpenseAiAnalysis,
        getTimeEntryById,
        getCustomerById,
        createExpense,
      } = await import("./db");
      const analysis = await getExpenseAiAnalysisById(input.analysisId);
      if (!analysis) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Analyse nicht gefunden" });
      }
      if (!(await canAccessUserOwnedData(ctx.user, analysis.userId))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf diese Analyse" });
      }

      const candidates = parseJsonSafely(analysis.normalizedPayload);
      if (!Array.isArray(candidates) || candidates.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Analyse enthält keine Kandidaten" });
      }
      const candidateIndex = input.candidateIndex ?? 0;
      const selected = candidates[candidateIndex];
      if (!selected) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Ungültiger candidateIndex" });
      }

      const mutableCandidate: ReceiptExpenseCandidate = {
        ...selected,
        ...(input.overrides?.category ? { category: input.overrides.category } : {}),
        ...(input.overrides?.date ? { date: input.overrides.date } : {}),
        ...(typeof input.overrides?.amount === "number" ? { amount: input.overrides.amount } : {}),
        ...(input.overrides?.currency ? { currency: input.overrides.currency.toUpperCase() } : {}),
        ...(input.overrides?.comment !== undefined ? { comment: input.overrides.comment } : {}),
        ...(input.overrides?.projectName ? { projectName: input.overrides.projectName } : {}),
      };

      const issues = validateReceiptCandidate(mutableCandidate);
      const hardErrors = issues.filter(issue => issue.severity === "error");
      if (hardErrors.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: hardErrors.map(issue => issue.message).join(" | "),
        });
      }

      let ownerUserId = analysis.userId;
      const matchingPayload = parseJsonSafely(analysis.matchingPayload);
      const defaultMatch = Array.isArray(matchingPayload)
        ? matchingPayload.find(item => Number(item?.index) === candidateIndex)?.match
        : null;

      const targetTimeEntryId = input.overrides?.timeEntryId ?? defaultMatch?.timeEntryId ?? null;
      const targetCustomerId = input.overrides?.customerId ?? defaultMatch?.customerId ?? null;

      if (targetTimeEntryId) {
        const timeEntry = await getTimeEntryById(Number(targetTimeEntryId));
        if (!timeEntry) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Zeit-Eintrag für Freigabe nicht gefunden" });
        }
        if (!(await canAccessUserOwnedData(ctx.user, timeEntry.userId))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf den Ziel-Zeiteintrag" });
        }
        ownerUserId = timeEntry.userId;
      } else if (targetCustomerId) {
        const customer = await getCustomerById(Number(targetCustomerId));
        if (!customer) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Kunde für Freigabe nicht gefunden" });
        }
        if (!(await canAccessCustomerOwnedData(ctx.user, { userId: customer.userId ?? null }))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf den Ziel-Kunden" });
        }
        if (customer.userId) ownerUserId = customer.userId;
      }

      const payload = toExpenseMutationPayload(mutableCandidate);
      const basePayload: Record<string, unknown> = {
        ...payload,
        userId: ownerUserId,
      };
      if (targetTimeEntryId) {
        basePayload.timeEntryId = Number(targetTimeEntryId);
      }

      const created = await createExpense(basePayload);
      const approvedExpenseId = Number((created as any)?.insertId ?? (created as any)?.[0]?.insertId ?? 0) || null;
      await updateExpenseAiAnalysis(input.analysisId, {
        status: "approved",
        approvedExpenseId,
        normalizedPayload: JSON.stringify(candidates),
        validationPayload: JSON.stringify([{ index: candidateIndex, issues }]),
      });

      return {
        success: true,
        approvedExpenseId,
        issues,
      };
    }),

    reject: protectedProcedure.input((val: unknown) => {
      return z.object({
        analysisId: z.number(),
        reason: z.string().optional(),
      }).parse(val);
    }).mutation(async ({ ctx, input }) => {
      const { getExpenseAiAnalysisById, updateExpenseAiAnalysis } = await import("./db");
      const analysis = await getExpenseAiAnalysisById(input.analysisId);
      if (!analysis) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Analyse nicht gefunden" });
      }
      if (!(await canAccessUserOwnedData(ctx.user, analysis.userId))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf diese Analyse" });
      }
      await updateExpenseAiAnalysis(input.analysisId, {
        status: "rejected",
        validationPayload: JSON.stringify({
          rejectedAt: new Date().toISOString(),
          reason: input.reason ?? "Keine Begründung angegeben",
        }),
      });
      return { success: true };
    }),
  }),

  // Fixed costs
  fixedCosts: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getFixedCosts } = await import("./db");
      const allCosts = await getFixedCosts();

      // WebApp admins must stay blind regarding tenant business data.
      if (isWebAppAdmin(ctx.user)) {
        return [];
      }

      if (isMandantAdmin(ctx.user)) {
        const ownerCache = new Map<number, boolean>();
        const filtered = [];

        for (const cost of allCosts) {
          if (!ownerCache.has(cost.userId)) {
            ownerCache.set(
              cost.userId,
              await isSameMandantForUser(ctx.user.mandantId, cost.userId)
            );
          }
          if (ownerCache.get(cost.userId)) {
            filtered.push(cost);
          }
        }

        return filtered;
      }

      return allCosts.filter((cost) => cost.userId === ctx.user.id);
    }),
    create: protectedProcedure.input((val: unknown) => {
      return z.object({
        category: z.string(),
        amount: z.number(),
        currency: z.string().length(3).default("PLN"),
        description: z.string().optional(),
      }).parse(val);
    }).mutation(async ({ ctx, input }) => {
      if (isWebAppAdmin(ctx.user)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "WebApp-Admin hat keinen Dateneinblick" });
      }

      const { createFixedCost } = await import("./db");
      return await createFixedCost({
        ...input,
        userId: ctx.user.id,
      });
    }),
    update: protectedProcedure.input((val: unknown) => {
      return z.object({
        id: z.number(),
        category: z.string().optional(),
        amount: z.number().optional(),
        currency: z.string().length(3).optional(),
        description: z.string().optional(),
      }).parse(val);
    }).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const { getFixedCostById, updateFixedCost } = await import("./db");
      const existing = await getFixedCostById(id);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Fixkosten-Eintrag nicht gefunden" });
      }

      if (!(await canAccessUserOwnedData(ctx.user, existing.userId))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf diesen Fixkosten-Eintrag" });
      }

      await updateFixedCost(id, data);
      return { success: true };
    }),
    delete: protectedProcedure.input((val: unknown) => {
      return z.object({ id: z.number() }).parse(val);
    }).mutation(async ({ ctx, input }) => {
      const { deleteFixedCost, getFixedCostById } = await import("./db");
      const existing = await getFixedCostById(input.id);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Fixkosten-Eintrag nicht gefunden" });
      }

      if (!(await canAccessUserOwnedData(ctx.user, existing.userId))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf diesen Fixkosten-Eintrag" });
      }

      await deleteFixedCost(input.id);
      return { success: true };
    }),
  }),

  // Tax settings
  taxSettings: router({
    get: protectedProcedure.query(async () => {
      const { getTaxSettings } = await import("./db");
      return await getTaxSettings();
    }),
    upsert: mandantAdminProcedure.input((val: unknown) => {
      return z.object({
        zusType: z.enum(["percentage", "fixed"]),
        zusValue: z.number(),
        healthInsuranceType: z.enum(["percentage", "fixed"]),
        healthInsuranceValue: z.number(),
        taxType: z.enum(["percentage", "fixed"]),
        taxValue: z.number(),
      }).parse(val);
    }).mutation(async ({ input }) => {
      const { upsertTaxSettings } = await import("./db");
      return await upsertTaxSettings(input);
    }),
    getProfile: protectedProcedure.query(async ({ ctx }) => {
      const { getTaxProfile } = await import("./db");
      const profile = await getTaxProfile(ctx.user.id);

      if (!profile) {
        return {
          taxCalculationMode: "normal" as const,
          taxForm: "liniowy_19" as const,
          zusRegime: "pelny_zus" as const,
          choroboweEnabled: false,
          fpFsEnabled: true,
          wypadkowaRateBp: 167,
          zdrowotnaRateLiniowyBp: 490,
          pitRateBp: 1900,
        };
      }

      return {
        ...profile,
        taxCalculationMode: (profile.taxCalculationMode ?? "normal") as "normal" | "zero",
        choroboweEnabled: profile.choroboweEnabled === 1,
        fpFsEnabled: profile.fpFsEnabled === 1,
      };
    }),
    upsertProfile: mandantAdminProcedure.input((val: unknown) => {
      return z.object({
        taxCalculationMode: z.enum(["normal", "zero"]).default("normal"),
        taxForm: z.enum(["liniowy_19"]).default("liniowy_19"),
        zusRegime: z.enum(["ulga_na_start", "preferencyjny_zus", "maly_zus_plus", "pelny_zus"]),
        choroboweEnabled: z.boolean(),
        fpFsEnabled: z.boolean(),
        wypadkowaRateBp: z.number().int().min(0).max(5000),
        zdrowotnaRateLiniowyBp: z.number().int().min(0).max(5000),
        pitRateBp: z.number().int().min(0).max(10000),
      }).parse(val);
    }).mutation(async ({ ctx, input }) => {
      const { upsertTaxProfile } = await import("./db");
      const profile = await upsertTaxProfile(ctx.user.id, {
        ...input,
        choroboweEnabled: input.choroboweEnabled ? 1 : 0,
        fpFsEnabled: input.fpFsEnabled ? 1 : 0,
      });

      if (!profile) return null;

      return {
        ...profile,
        taxCalculationMode: (profile.taxCalculationMode ?? "normal") as "normal" | "zero",
        choroboweEnabled: profile.choroboweEnabled === 1,
        fpFsEnabled: profile.fpFsEnabled === 1,
      };
    }),
    getConfig: protectedProcedure.input((val: unknown) => {
      return z.object({
        year: z.number().int().min(2000).max(2100).optional(),
      }).parse(val ?? {});
    }).query(async ({ input }) => {
      const { getTaxConfigByYear } = await import("./db");
      const year = input.year ?? new Date().getFullYear();
      const config = await getTaxConfigByYear(year);

      if (!config) {
        return {
          year,
          socialMinBaseCents: 565200,
          zdrowotnaMinBaseCents: 565200,
          zdrowotnaMinAmountCents: 27695,
          zdrowotnaDeductionLimitYearlyCents: 0,
          socialContributionRateBp: 1952,
          choroboweRateBp: 245,
          fpFsRateBp: 245,
          isDefault: true,
        };
      }

      return {
        ...config,
        isDefault: false,
      };
    }),
    upsertConfig: mandantAdminProcedure.input((val: unknown) => {
      return z.object({
        year: z.number().int().min(2000).max(2100),
        socialMinBaseCents: z.number().int().min(0),
        zdrowotnaMinBaseCents: z.number().int().min(0),
        zdrowotnaMinAmountCents: z.number().int().min(0),
        zdrowotnaDeductionLimitYearlyCents: z.number().int().min(0),
        socialContributionRateBp: z.number().int().min(0).max(10000),
        choroboweRateBp: z.number().int().min(0).max(5000),
        fpFsRateBp: z.number().int().min(0).max(5000),
      }).parse(val);
    }).mutation(async ({ input }) => {
      const { upsertTaxConfigByYear } = await import("./db");
      return await upsertTaxConfigByYear(input);
    }),
  }),

  // Backup
  backup: router({
    create: mandantAdminProcedure.mutation(async () => {
      const { createBackup } = await import("./backup");
      return await createBackup();
    }),
    restore: adminOrMandantAdminProcedure.input((val: unknown) => {
      return z.object({
        backup: z.any(),
      }).parse(val);
    }).mutation(async ({ ctx, input }) => {
      const { restoreBackup } = await import("./backup");
      const result = await restoreBackup(input.backup);

      // WebApp admins are allowed to execute restore blindly (DSGVO),
      // but must not receive any payload with domain data.
      if (isWebAppAdmin(ctx.user)) {
        return { success: true, message: "Restore ausgefuehrt" };
      }

      return result;
    }),
  }),

  // Global search
  search: router({
    global: protectedProcedure
      .input(z.object({ query: z.string().min(1) }))
      .query(async ({ input }) => {
        const { globalSearch } = await import("./globalSearch");
        return await globalSearch(input.query);
      }),
  }),

  // Account settings
  accountSettings: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const { getAccountSettings } = await import("./db");
      return await getAccountSettings(ctx.user.id);
    }),
    upsert: protectedProcedure.input((val: unknown) => {
      return z.object({
        companyName: z.string().optional(),
        companyLogoUrl: z.string().optional(),
        companyLogoKey: z.string().optional(),
        street: z.string().optional(),
        postalCode: z.string().optional(),
        city: z.string().optional(),
        country: z.string().optional(),
        vatId: z.string().optional(),
        taxNumber: z.string().optional(),
        bankName: z.string().optional(),
        iban: z.string().optional(),
        swift: z.string().optional(),
      }).parse(val);
    }).mutation(async ({ ctx, input }) => {
      const { upsertAccountSettings } = await import("./db");
      return await upsertAccountSettings(ctx.user.id, input);
    }),
  }),

  // Mandant management (step 1 of setup flow)
  mandantenAdmin: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (!isGlobalSetupAdmin(ctx.user)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Nur General-Admins duerfen Mandanten verwalten",
        });
      }
      const { getAllMandanten } = await import("./db-mandanten");
      return await getAllMandanten();
    }),
    create: protectedProcedure.input((val: unknown) => {
      return z.object({
        name: z.string().trim().min(2).max(255),
        mandantNr: z
          .string()
          .trim()
          .min(2)
          .max(50)
          .regex(/^[A-Za-z0-9._-]+$/, "mandantNr darf nur A-Z, 0-9, . _ - enthalten"),
      }).parse(val);
    }).mutation(async ({ ctx, input }) => {
      if (!isGlobalSetupAdmin(ctx.user)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Nur General-Admins duerfen Mandanten anlegen",
        });
      }

      const { createMandant, findMandantByName, findMandantByNr } = await import("./db-mandanten");

      const byNr = await findMandantByNr(input.mandantNr);
      if (byNr) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Mandant mit dieser Mandantennummer existiert bereits",
        });
      }

      const byName = await findMandantByName(input.name);
      if (byName) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Mandant mit diesem Namen existiert bereits",
        });
      }

      const created = await createMandant({
        name: input.name,
        mandantNr: input.mandantNr,
      });

      if (!created) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Mandant konnte nicht angelegt werden",
        });
      }

      return created;
    }),
  }),

  // User management (Phase 2 - direct admin creation, no invite flow yet)
  usersAdmin: router({
    list: adminOrMandantAdminProcedure.query(async ({ ctx }) => {
      const { listUsersByMandantId, listUsersGlobal } = await import("./db");

      if (isGlobalSetupAdmin(ctx.user)) {
        return await listUsersGlobal();
      }

      if (!ctx.user.mandantId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Mandant fehlt im Kontext" });
      }

      return await listUsersByMandantId(ctx.user.mandantId);
    }),
    create: adminOrMandantAdminProcedure.input((val: unknown) => {
      return z.object({
        mandantId: z.number().int().positive().optional(),
        email: z.string().email(),
        displayName: z.string().min(1).max(255).optional(),
        password: z.string().min(8),
        role: z.enum(["user", "admin", "mandant_admin", "webapp_admin"]).default("user"),
      }).parse(val);
    }).mutation(async ({ ctx, input }) => {
      const { createUser, findUserByEmailAndMandant } = await import("./db");
      const { findMandantById } = await import("./db-mandanten");

      const actorIsGlobalSetupAdmin = isGlobalSetupAdmin(ctx.user);
      const normalizedRole = normalizeManagedRole(input.role);

      if (actorIsGlobalSetupAdmin) {
        if (!canAssignRoleAsGlobalSetupAdmin(input.role)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "General-Admin darf nur Benutzer, Mandanten-Admins oder WebApp-Admins anlegen",
          });
        }
      } else if (!canAssignRoleAsMandantAdmin(normalizedRole)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Mandanten-Admins duerfen nur Benutzer anlegen",
        });
      }

      const targetMandantId = actorIsGlobalSetupAdmin ? input.mandantId : ctx.user.mandantId;
      if (!targetMandantId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "mandantId ist erforderlich",
        });
      }

      const mandant = await findMandantById(targetMandantId);
      if (!mandant) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Mandant existiert nicht",
        });
      }

      const existing = await findUserByEmailAndMandant(input.email, targetMandantId);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Benutzer mit dieser E-Mail existiert bereits im Mandanten",
        });
      }

      const passwordHash = await bcrypt.hash(input.password, 10);
      await createUser({
        mandantId: targetMandantId,
        email: input.email,
        passwordHash,
        displayName: input.displayName ?? null,
        role: normalizedRole,
      });

      const created = await findUserByEmailAndMandant(input.email, targetMandantId);
      return created
        ? {
            id: created.id,
            mandantId: created.mandantId,
            email: created.email,
            displayName: created.displayName,
            role: created.role,
            createdAt: created.createdAt,
          }
        : { success: true };
    }),
    update: adminOrMandantAdminProcedure.input((val: unknown) => {
      return z
        .object({
          userId: z.number().int().positive(),
          mandantId: z.number().int().positive().optional(),
          email: z.string().email().optional(),
          displayName: z.string().max(255).optional(),
          role: z.enum(["user", "admin", "mandant_admin", "webapp_admin"]).optional(),
          password: z.string().min(8).optional(),
        })
        .refine(
          (data) =>
            data.mandantId !== undefined ||
            data.email !== undefined ||
            data.displayName !== undefined ||
            data.role !== undefined ||
            data.password !== undefined,
          { message: "Keine Aenderung uebergeben" }
        )
        .parse(val);
    }).mutation(async ({ ctx, input }) => {
      const {
        countActiveGlobalSetupAdmins,
        countActiveMandantAdmins,
        countNonDeletedMandantAdmins,
        findUserByEmailAndMandant,
        findUserById,
        updateUserById,
      } = await import("./db");
      const { findMandantById } = await import("./db-mandanten");

      if (ctx.user.id === input.userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Eigener Benutzer kann hier nicht bearbeitet werden",
        });
      }

      const targetUser = await findUserById(input.userId);
      if (!targetUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Benutzer nicht gefunden" });
      }

      const actorIsGlobalSetupAdmin = isGlobalSetupAdmin(ctx.user);

      if (!actorIsGlobalSetupAdmin) {
        if (!ctx.user.mandantId || targetUser.mandantId !== ctx.user.mandantId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf diesen Benutzer" });
        }
        if (input.mandantId && input.mandantId !== targetUser.mandantId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Mandantenwechsel nicht erlaubt" });
        }
        if (input.role && !canAssignRoleAsMandantAdmin(normalizeManagedRole(input.role))) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Mandanten-Admins duerfen nur Benutzer-Rollen setzen",
          });
        }
      }

      const nextMandantId = actorIsGlobalSetupAdmin
        ? input.mandantId ?? targetUser.mandantId
        : targetUser.mandantId;
      const currentStatus = resolveAccountStatus(targetUser);
      const currentIsActive = currentStatus === "active";

      const mandant = await findMandantById(nextMandantId);
      if (!mandant) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Mandant existiert nicht" });
      }

      if (input.email) {
        const existing = await findUserByEmailAndMandant(input.email, nextMandantId);
        if (existing && existing.id !== targetUser.id) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Benutzer mit dieser E-Mail existiert bereits im Mandanten",
          });
        }
      }

      if (input.role && actorIsGlobalSetupAdmin && !canAssignRoleAsGlobalSetupAdmin(input.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Unzulaessige Rolle fuer General-Admin",
        });
      }

      const normalizedRole = input.role ? normalizeManagedRole(input.role) : undefined;
      const nextRole = normalizedRole ?? String(targetUser.role ?? "user");
      const targetUserId = Number(targetUser.id);
      const currentIsGlobalSetupAdminRole = isGlobalSetupAdminRoleValue(
        String(targetUser.role),
        targetUserId
      );
      const nextIsGlobalSetupAdminRole = isGlobalSetupAdminRoleValue(nextRole, targetUserId);
      const currentIsMandantAdminRole = isMandantAdminRoleValue(String(targetUser.role));
      const nextIsMandantAdminRole = isMandantAdminRoleValue(nextRole);

      if (currentIsActive && currentIsGlobalSetupAdminRole && !nextIsGlobalSetupAdminRole) {
        const remainingGlobalAdmins = await countActiveGlobalSetupAdmins(targetUserId);
        if (remainingGlobalAdmins < 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Mindestens ein aktiver WebApp-Admin muss global erhalten bleiben",
          });
        }
      }

      if (currentStatus !== "deleted" && currentIsMandantAdminRole && targetUser.mandantId) {
        const leavesMandantAdminPool =
          !nextIsMandantAdminRole || Number(nextMandantId) !== Number(targetUser.mandantId);
        if (leavesMandantAdminPool) {
          const remainingMandantAdmins = await countNonDeletedMandantAdmins(
            Number(targetUser.mandantId),
            targetUserId
          );
          if (remainingMandantAdmins < 1) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Der letzte verbleibende Mandanten-Admin kann nicht entfernt oder umgehaengt werden",
            });
          }
          if (currentStatus === "active") {
            const remainingActiveMandantAdmins = await countActiveMandantAdmins(
              Number(targetUser.mandantId),
              targetUserId
            );
            if (remainingActiveMandantAdmins < 1) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "Mindestens ein aktiver Mandanten-Admin pro Mandant muss erhalten bleiben",
              });
            }
          }
        }
      }

      const passwordHash = input.password ? await bcrypt.hash(input.password, 10) : undefined;

      await updateUserById(input.userId, {
        mandantId: nextMandantId,
        email: input.email,
        displayName:
          input.displayName !== undefined ? input.displayName.trim() || null : undefined,
        role: normalizedRole,
        passwordHash,
      });

      return { success: true };
    }),
    suspend: adminOrMandantAdminProcedure.input((val: unknown) => {
      return z.object({
        userId: z.number().int().positive(),
      }).parse(val);
    }).mutation(async ({ ctx, input }) => {
      const {
        countActiveGlobalSetupAdmins,
        countActiveMandantAdmins,
        findUserById,
        suspendUserById,
      } = await import("./db");

      if (ctx.user.id === input.userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Eigener Benutzer kann nicht gesperrt werden",
        });
      }

      const targetUser = await findUserById(input.userId);
      if (!targetUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Benutzer nicht gefunden" });
      }
      const targetUserId = Number(targetUser.id);
      const targetStatus = resolveAccountStatus(targetUser);

      if (!isGlobalSetupAdmin(ctx.user)) {
        if (!ctx.user.mandantId || targetUser.mandantId !== ctx.user.mandantId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf diesen Benutzer" });
        }
        if (isGlobalSetupAdminRoleValue(String(targetUser.role), targetUserId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "WebApp-Admin kann nur global verwaltet werden" });
        }
      }

      if (targetStatus !== "active") {
        return { success: true };
      }

      if (isGlobalSetupAdminRoleValue(String(targetUser.role), targetUserId)) {
        const remainingGlobalAdmins = await countActiveGlobalSetupAdmins(targetUserId);
        if (remainingGlobalAdmins < 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Mindestens ein aktiver WebApp-Admin muss global erhalten bleiben",
          });
        }
      }

      if (isMandantAdminRoleValue(String(targetUser.role)) && targetUser.mandantId) {
        const remainingMandantAdmins = await countActiveMandantAdmins(
          Number(targetUser.mandantId),
          targetUserId
        );
        if (remainingMandantAdmins < 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Mindestens ein aktiver Mandanten-Admin pro Mandant muss erhalten bleiben",
          });
        }
      }

      await suspendUserById(input.userId);
      return { success: true };
    }),
    delete: adminOrMandantAdminProcedure.input((val: unknown) => {
      return z.object({
        userId: z.number().int().positive(),
      }).parse(val);
    }).mutation(async ({ ctx, input }) => {
      const {
        countActiveGlobalSetupAdmins,
        countActiveMandantAdmins,
        countNonDeletedMandantAdmins,
        deleteUserById,
        findUserById,
      } = await import("./db");

      if (ctx.user.id === input.userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Eigener Benutzer kann nicht geloescht werden",
        });
      }

      const targetUser = await findUserById(input.userId);
      if (!targetUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Benutzer nicht gefunden" });
      }
      const targetUserId = Number(targetUser.id);
      const targetStatus = resolveAccountStatus(targetUser);

      if (!isGlobalSetupAdmin(ctx.user)) {
        if (!ctx.user.mandantId || targetUser.mandantId !== ctx.user.mandantId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf diesen Benutzer" });
        }
        if (isGlobalSetupAdminRoleValue(String(targetUser.role), targetUserId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "WebApp-Admin kann nur global verwaltet werden" });
        }
      }

      if (targetStatus === "active" && isGlobalSetupAdminRoleValue(String(targetUser.role), targetUserId)) {
        const remainingGlobalAdmins = await countActiveGlobalSetupAdmins(targetUserId);
        if (remainingGlobalAdmins < 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Mindestens ein aktiver WebApp-Admin muss global erhalten bleiben",
          });
        }
      }

      if (targetStatus !== "deleted" && isMandantAdminRoleValue(String(targetUser.role)) && targetUser.mandantId) {
        const remainingMandantAdmins = await countNonDeletedMandantAdmins(
          Number(targetUser.mandantId),
          targetUserId
        );
        if (remainingMandantAdmins < 1) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Der letzte verbleibende Mandanten-Admin kann nicht geloescht werden",
          });
        }
        if (targetStatus === "active") {
          const remainingActiveMandantAdmins = await countActiveMandantAdmins(
            Number(targetUser.mandantId),
            targetUserId
          );
          if (remainingActiveMandantAdmins < 1) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Mindestens ein aktiver Mandanten-Admin pro Mandant muss erhalten bleiben",
            });
          }
        }
      }

      await deleteUserById(input.userId);
      return { success: true };
    }),
    restore: adminOrMandantAdminProcedure.input((val: unknown) => {
      return z.object({
        userId: z.number().int().positive(),
      }).parse(val);
    }).mutation(async ({ ctx, input }) => {
      const { findUserById, restoreUserById } = await import("./db");

      const targetUser = await findUserById(input.userId);
      if (!targetUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Benutzer nicht gefunden" });
      }
      const targetUserId = Number(targetUser.id);

      if (!isGlobalSetupAdmin(ctx.user)) {
        if (!ctx.user.mandantId || targetUser.mandantId !== ctx.user.mandantId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf diesen Benutzer" });
        }
        if (isGlobalSetupAdminRoleValue(String(targetUser.role), targetUserId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "WebApp-Admin kann nur global verwaltet werden" });
        }
      }

      await restoreUserById(input.userId);
      return { success: true };
    }),
  }),

  // Exchange rates management
  exchangeRatesManagement: router({
    list: protectedProcedure.input((val: unknown) => {
      return z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        currency: z.string().optional(),
      }).parse(val);
    }).query(async ({ ctx, input }) => {
      const { getExchangeRates } = await import("./db");
      if (isWebAppAdmin(ctx.user)) return [];
      return await getExchangeRates({
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        currency: input.currency,
        userId: ctx.user.id,
      });
    }),
    upsert: protectedProcedure.input((val: unknown) => {
      return z.object({
        date: z.string(),
        currencyPair: z.string(),
        rate: z.number(),
        source: z.string().default("Manual"),
      }).parse(val);
    }).mutation(async ({ ctx, input }) => {
      const { upsertExchangeRate } = await import("./db");
      if (isWebAppAdmin(ctx.user)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "WebApp-Admin hat keinen Dateneinblick" });
      }
      const manualSource = String(input.source).toLowerCase() === "manual";
      return await upsertExchangeRate({
        date: new Date(input.date),
        currencyPair: input.currencyPair,
        rate: Math.round(input.rate * 10000),
        source: input.source,
        userId: manualSource ? ctx.user.id : 0,
      });
    }),
    updateFromNBP: protectedProcedure.input((val: unknown) => {
      return z.object({
        currencies: z.array(z.string()),
      }).parse(val);
    }).mutation(async ({ ctx, input }) => {
      const { fetchNBPExchangeRate } = await import("./nbp");
      const { upsertExchangeRate } = await import("./db");
      if (isWebAppAdmin(ctx.user)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "WebApp-Admin hat keinen Dateneinblick" });
      }
      
      const results = [];
      for (const currency of input.currencies) {
        try {
          const rate = await fetchNBPExchangeRate(currency);
          await upsertExchangeRate({
            date: new Date(),
            currencyPair: `${currency}/PLN`,
            rate: Math.round(rate * 10000),
            source: "NBP",
            userId: 0,
          });
          results.push({ currency, success: true, rate });
        } catch (error: any) {
          results.push({ currency, success: false, error: error.message });
        }
      }
      return results;
    }),
    createManual: protectedProcedure.input((val: unknown) => {
      return z.object({
        date: z.string(),
        currencyPair: z.string(),
        rate: z.number(),
      }).parse(val);
    }).mutation(async ({ ctx, input }) => {
      const { upsertExchangeRate } = await import("./db");
      if (isWebAppAdmin(ctx.user)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "WebApp-Admin hat keinen Dateneinblick" });
      }
      return await upsertExchangeRate({
        date: new Date(input.date),
        currencyPair: input.currencyPair,
        rate: Math.round(input.rate * 10000),
        source: "Manual",
        userId: ctx.user.id,
      });
    }),
  }),

  // Database export/import
  database: router({
    export: adminOrMandantAdminProcedure.mutation(async ({ ctx }) => {
      if (isWebAppAdmin(ctx.user)) {
        // Blind admin operation: execution allowed, domain data is not exposed.
        return { success: true, message: "Export ausgefuehrt (blind)" };
      }

      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
      }
      if (!ctx.user.mandantId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Mandant fehlt im Kontext" });
      }

      const {
        accountSettings,
        customers,
        documents,
        expenseAiAnalyses,
        exchangeRates,
        fixedCosts,
        invoiceNumbers,
        taxConfigPl,
        taxProfiles,
        taxSettings,
        timeEntries,
        users,
        expenses: expensesTable,
      } = await import("../drizzle/schema");

      const mandantUsers = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.mandantId, ctx.user.mandantId));
      const userIds = mandantUsers.map((u) => u.id);

      const timeEntriesData =
        userIds.length > 0
          ? await db.select().from(timeEntries).where(inArray(timeEntries.userId, userIds))
          : [];
      const timeEntryIds = timeEntriesData.map((entry) => entry.id);
      const customerIds = Array.from(new Set(timeEntriesData.map((entry) => entry.customerId)));

      const expensesData =
        userIds.length > 0 || timeEntryIds.length > 0
          ? await db
              .select()
              .from(expensesTable)
              .where(
                or(
                  userIds.length > 0 ? inArray(expensesTable.userId, userIds) : sql`FALSE`,
                  timeEntryIds.length > 0
                    ? inArray(expensesTable.timeEntryId, timeEntryIds)
                    : sql`FALSE`
                )
              )
          : [];

      const fixedCostsData =
        userIds.length > 0
          ? await db.select().from(fixedCosts).where(inArray(fixedCosts.userId, userIds))
          : [];
      const documentsData =
        userIds.length > 0
          ? await db.select().from(documents).where(inArray(documents.userId, userIds))
          : [];
      const expenseAiAnalysesData =
        userIds.length > 0
          ? await db.select().from(expenseAiAnalyses).where(inArray(expenseAiAnalyses.userId, userIds))
          : [];
      const accountSettingsData =
        userIds.length > 0
          ? await db.select().from(accountSettings).where(inArray(accountSettings.userId, userIds))
          : [];
      const taxSettingsData =
        userIds.length > 0
          ? await db.select().from(taxSettings).where(inArray(taxSettings.userId, userIds))
          : [];
      const taxProfilesData =
        userIds.length > 0
          ? await db.select().from(taxProfiles).where(inArray(taxProfiles.userId, userIds))
          : [];
      const customersData =
        customerIds.length > 0
          ? await db.select().from(customers).where(inArray(customers.id, customerIds))
          : [];
      const invoiceNumbersData =
        customerIds.length > 0
          ? await db
              .select()
              .from(invoiceNumbers)
              .where(inArray(invoiceNumbers.customerId, customerIds))
          : [];
      const exchangeRatesData = await db
        .select()
        .from(exchangeRates)
        .where(
          or(
            eq(exchangeRates.userId, 0),
            userIds.length > 0 ? inArray(exchangeRates.userId, userIds) : sql`FALSE`
          )
        );
      const taxConfigData = await db.select().from(taxConfigPl);

      return {
        version: "1.0",
        exportDate: new Date().toISOString(),
        data: {
          customers: customersData,
          timeEntries: timeEntriesData,
          expenses: expensesData,
          documents: documentsData,
          expenseAiAnalyses: expenseAiAnalysesData,
          exchangeRates: exchangeRatesData,
          fixedCosts: fixedCostsData,
          taxSettings: taxSettingsData,
          taxProfiles: taxProfilesData,
          taxConfigPl: taxConfigData,
          accountSettings: accountSettingsData,
          invoiceNumbers: invoiceNumbersData,
        },
      };
    }),
    import: adminOrMandantAdminProcedure.input((val: unknown) => {
      return z.object({
        backup: z.any(),
      }).parse(val);
    }).mutation(async ({ ctx, input }) => {
      const { importDatabase } = await import("./db");
      let backupToImport = input.backup;

      if (!isWebAppAdmin(ctx.user)) {
        if (!ctx.user.mandantId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Mandant fehlt im Kontext" });
        }

        const db = await getDb();
        if (!db) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        }

        const { users } = await import("../drizzle/schema");
        const mandantUsers = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.mandantId, ctx.user.mandantId));
        const allowedUserIds = new Set(mandantUsers.map((u) => u.id));

        const rawData = input.backup?.data ?? {};
        const scopedTimeEntries = Array.isArray(rawData.timeEntries)
          ? rawData.timeEntries.filter((entry: any) => allowedUserIds.has(entry.userId))
          : [];
        const scopedTimeEntryIds = new Set(scopedTimeEntries.map((entry: any) => entry.id));
        const scopedCustomerIds = new Set(scopedTimeEntries.map((entry: any) => entry.customerId));

        const isAllowedExpense = (expense: any) =>
          allowedUserIds.has(expense?.userId) ||
          (expense?.timeEntryId != null && scopedTimeEntryIds.has(expense.timeEntryId));

        backupToImport = {
          ...input.backup,
          data: {
            customers: Array.isArray(rawData.customers)
              ? rawData.customers.filter((customer: any) => scopedCustomerIds.has(customer.id))
              : [],
            timeEntries: scopedTimeEntries,
            expenses: Array.isArray(rawData.expenses)
              ? rawData.expenses.filter(isAllowedExpense)
              : [],
            documents: Array.isArray(rawData.documents)
              ? rawData.documents.filter((doc: any) => allowedUserIds.has(doc.userId))
              : [],
            expenseAiAnalyses: Array.isArray(rawData.expenseAiAnalyses)
              ? rawData.expenseAiAnalyses.filter((analysis: any) => allowedUserIds.has(analysis.userId))
              : [],
            exchangeRates: Array.isArray(rawData.exchangeRates)
              ? rawData.exchangeRates.filter(
                  (rate: any) => Number(rate.userId ?? 0) === 0 || allowedUserIds.has(Number(rate.userId))
                )
              : [],
            fixedCosts: Array.isArray(rawData.fixedCosts)
              ? rawData.fixedCosts.filter((cost: any) => allowedUserIds.has(cost.userId))
              : [],
            taxSettings: Array.isArray(rawData.taxSettings)
              ? rawData.taxSettings.filter((setting: any) => allowedUserIds.has(setting.userId))
              : [],
            taxProfiles: Array.isArray(rawData.taxProfiles)
              ? rawData.taxProfiles.filter((profile: any) => allowedUserIds.has(profile.userId))
              : [],
            taxConfigPl: Array.isArray(rawData.taxConfigPl) ? rawData.taxConfigPl : [],
            accountSettings: Array.isArray(rawData.accountSettings)
              ? rawData.accountSettings.filter((setting: any) => allowedUserIds.has(setting.userId))
              : [],
            invoiceNumbers: Array.isArray(rawData.invoiceNumbers)
              ? rawData.invoiceNumbers.filter((invoice: any) => scopedCustomerIds.has(invoice.customerId))
              : [],
          },
        };
      }

      const result = await importDatabase(backupToImport);

      // Blind admin operation for global WebApp admins (DSGVO).
      if (isWebAppAdmin(ctx.user)) {
        return { success: true, message: "Import ausgefuehrt" };
      }

      return result;
    }),
  }),
});

export type AppRouter = typeof appRouter;
