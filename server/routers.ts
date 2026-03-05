
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
      const { getCustomerById, getCustomersByMandatenNr, updateCustomer } = await import("./db");
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
      return await getTimeEntries(ctx.user.id, startDate, endDate);
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

      return entry;
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
        rate: z.number(),
        calculatedAmount: z.number(),
        manDays: z.number(),
      }).parse(val);
    }).mutation(async ({ ctx, input }) => {
      const { createTimeEntry } = await import("./db");
      return await createTimeEntry({
        ...input,
        userId: ctx.user.id,
        date: new Date(input.date),
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
      const { getTimeEntryById, updateTimeEntry } = await import("./db");
      const existing = await getTimeEntryById(id);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Zeiteintrag nicht gefunden" });
      }
      if (!(await canAccessUserOwnedData(ctx.user, existing.userId))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf diesen Zeiteintrag" });
      }

      await updateTimeEntry(id, {
        ...data,
        ...(date ? { date: new Date(date) } : {}),
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
      const { getTimeEntryById, createTimeEntry } = await import("./db");
      const sourceEntry = await getTimeEntryById(input.sourceId);
      
      if (!sourceEntry) {
        throw new Error("Source entry not found");
      }
      if (!(await canAccessUserOwnedData(ctx.user, sourceEntry.userId))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf diesen Quell-Zeiteintrag" });
      }
      
      const createdEntries = [];
      for (const targetDate of input.targetDates) {
        const newEntry = await createTimeEntry({
          userId: ctx.user.id,
          customerId: sourceEntry.customerId,
          date: new Date(targetDate),
          weekday: new Date(targetDate).toLocaleDateString('de-DE', { weekday: 'long' }),
          projectName: sourceEntry.projectName,
          entryType: sourceEntry.entryType,
          description: sourceEntry.description,
          hours: sourceEntry.hours,
          rate: sourceEntry.rate,
          calculatedAmount: sourceEntry.calculatedAmount,
          manDays: sourceEntry.manDays,
        });
        createdEntries.push(newEntry);
      }
      
      return { success: true, count: createdEntries.length };
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
        category: z.enum(["car", "train", "flight", "taxi", "transport", "meal", "hotel", "food", "fuel", "other"]),
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

      if (input.timeEntryId) {
        const timeEntry = await getTimeEntryById(input.timeEntryId);
        if (!timeEntry) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Zugehoeriger Zeiteintrag nicht gefunden" });
        }
        if (!(await canAccessUserOwnedData(ctx.user, timeEntry.userId))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Kein Zugriff auf diesen Zeiteintrag" });
        }
        ownerUserId = timeEntry.userId;
      }

      // Convert date string to Date object if provided
      const data = {
        ...input,
        userId: ownerUserId,
        date: input.date ? new Date(input.date) : undefined,
        checkInDate: input.checkInDate ? new Date(input.checkInDate) : undefined,
        checkOutDate: input.checkOutDate ? new Date(input.checkOutDate) : undefined,
        fullDay: input.fullDay ? 1 : 0,
      };
      return await createExpense(data);
    }),
    createBatch: protectedProcedure.input((val: unknown) => {
      return z.object({
        timeEntryId: z.number(),
        expenses: z.array(z.object({
          category: z.enum(["car", "train", "flight", "taxi", "transport", "meal", "hotel", "food", "fuel", "other"]),
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
      const results = [];
      for (const expense of input.expenses) {
        const result = await createExpense({
          timeEntryId: input.timeEntryId,
          userId: timeEntry.userId,
          ...expense,
          fullDay: expense.fullDay ? 1 : 0,
        });
        results.push(result);
      }
      return { success: true, count: results.length };
    }),
    update: protectedProcedure.input((val: unknown) => {
      return z.object({
        id: z.number(),
        category: z.enum(["car", "train", "flight", "taxi", "transport", "meal", "hotel", "food", "fuel", "other"]).optional(),
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

      const normalizedData = {
        ...data,
        ...(data.fullDay !== undefined ? { fullDay: data.fullDay ? 1 : 0 } : {}),
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
    }).mutation(async ({ input }) => {
      const { deleteDocument } = await import("./db");
      await deleteDocument(input.id);
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

      if (currentIsActive && currentIsMandantAdminRole && targetUser.mandantId) {
        const leavesMandantAdminPool =
          !nextIsMandantAdminRole || Number(nextMandantId) !== Number(targetUser.mandantId);
        if (leavesMandantAdminPool) {
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

      if (targetStatus === "active" && isMandantAdminRoleValue(String(targetUser.role)) && targetUser.mandantId) {
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
