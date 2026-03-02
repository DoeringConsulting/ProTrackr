
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { generateInvoiceNumber, getInvoiceNumbers, getDb } from "./db";
import { sql } from "drizzle-orm";
import { expenses } from "../drizzle/schema";

export const appRouter = router({
  invoiceNumbers: router({
    generate: publicProcedure
      .input(z.object({ customerId: z.number() }))
      .mutation(async ({ input }) => {
        const invoiceNumber = await generateInvoiceNumber(input.customerId);
        return { invoiceNumber };
      }),
    list: publicProcedure
      .input(z.object({ year: z.number().optional() }))
      .query(async ({ input }) => {
        return await getInvoiceNumbers(input.year);
      }),
  }),
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,

  // Customer management
  customers: router({
    list: protectedProcedure.query(async () => {
      const { getCustomers } = await import("./db");
      return await getCustomers();
    }),
    getById: protectedProcedure.input((val: unknown) => {
      return z.object({ id: z.number() }).parse(val);
    }).query(async ({ input }) => {
      const { getCustomerById } = await import("./db");
      return await getCustomerById(input.id);
    }),
    create: protectedProcedure.input((val: unknown) => {
      return z.object({
        provider: z.string(),
        mandatenNr: z.string(),
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
    }).mutation(async ({ input }) => {
      const { createCustomer } = await import("./db");
      return await createCustomer(input);
    }),
    update: protectedProcedure.input((val: unknown) => {
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
    }).mutation(async ({ input }) => {
      const { id, ...data } = input;
      const { updateCustomer } = await import("./db");
      await updateCustomer(id, data);
      return { success: true };
    }),
    delete: protectedProcedure.input((val: unknown) => {
      return z.object({ id: z.number() }).parse(val);
    }).mutation(async ({ input }) => {
      const { deleteCustomer } = await import("./db");
      await deleteCustomer(input.id);
      return { success: true };
    }),
    archive: protectedProcedure.input((val: unknown) => {
      return z.object({ id: z.number() }).parse(val);
    }).mutation(async ({ input }) => {
      const { archiveCustomer } = await import("./db");
      await archiveCustomer(input.id);
      return { success: true };
    }),
    unarchive: protectedProcedure.input((val: unknown) => {
      return z.object({ id: z.number() }).parse(val);
    }).mutation(async ({ input }) => {
      const { unarchiveCustomer } = await import("./db");
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
    }).query(async ({ input }) => {
      const { getTimeEntryById } = await import("./db");
      return await getTimeEntryById(input.id);
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
    }).mutation(async ({ input }) => {
      const { id, date, ...data } = input;
      const { updateTimeEntry } = await import("./db");
      await updateTimeEntry(id, {
        ...data,
        ...(date ? { date: new Date(date) } : {}),
      });
      return { success: true };
    }),
    delete: protectedProcedure.input((val: unknown) => {
      return z.object({ id: z.number() }).parse(val);
    }).mutation(async ({ input }) => {
      const { deleteTimeEntry } = await import("./db");
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
      const { getAllExpenses } = await import("./db");
      return await getAllExpenses(ctx.user.id, input.startDate, input.endDate);
    }),
    listByTimeEntry: protectedProcedure.input((val: unknown) => {
      return z.object({ timeEntryId: z.number() }).parse(val);
    }).query(async ({ input }) => {
      const { getExpensesByTimeEntry } = await import("./db");
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
    }).mutation(async ({ input }) => {
      const { createExpense } = await import("./db");
      // Convert date string to Date object if provided
      const data = {
        ...input,
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
    }).mutation(async ({ input }) => {
      const { createExpense } = await import("./db");
      const results = [];
      for (const expense of input.expenses) {
        const result = await createExpense({
          timeEntryId: input.timeEntryId,
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
    }).mutation(async ({ input }) => {
      const { id, ...data } = input;
      const { updateExpense } = await import("./db");
      const normalizedData = {
        ...data,
        ...(data.fullDay !== undefined ? { fullDay: data.fullDay ? 1 : 0 } : {}),
      };
      await updateExpense(id, normalizedData);
      return { success: true };
    }),
    delete: protectedProcedure.input((val: unknown) => {
      return z.object({ id: z.number() }).parse(val);
    }).mutation(async ({ input }) => {
      const { deleteExpense } = await import("./db");
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
      const { getExpensesByCustomer } = await import("./db");
      const startDate = input.startDate ? new Date(input.startDate) : undefined;
      const endDate = input.endDate ? new Date(input.endDate) : undefined;
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
    list: protectedProcedure.query(async () => {
      const { getExchangeRates } = await import("./db");
      return await getExchangeRates();
    }),
    getByDate: protectedProcedure.input((val: unknown) => {
      return z.object({ date: z.string() }).parse(val);
    }).query(async ({ input }) => {
      const { getExchangeRateByDate, createExchangeRate } = await import("./db");
      const { fetchNBPExchangeRate } = await import("./nbp");
      
      const date = new Date(input.date);
      let rate = await getExchangeRateByDate("EUR/PLN", date);
      
      if (!rate) {
        const nbpRate = await fetchNBPExchangeRate("EUR", date);
        await createExchangeRate({
          date,
          currencyPair: "EUR/PLN",
          rate: Math.round(nbpRate * 10000),
          source: "NBP",
        });
        rate = await getExchangeRateByDate("EUR/PLN", date);
      }
      
      return rate;
    }),
    fetchRate: protectedProcedure.input((val: unknown) => {
      return z.object({
        currencyCode: z.string(),
        date: z.string(),
      }).parse(val);
    }).mutation(async ({ input }) => {
      const { createExchangeRate } = await import("./db");
      const { fetchNBPExchangeRate } = await import("./nbp");
      
      const date = new Date(input.date);
      const nbpRate = await fetchNBPExchangeRate(input.currencyCode, date);
      
      return await createExchangeRate({
        date,
        currencyPair: `${input.currencyCode}/PLN`,
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
    }).mutation(async ({ input }) => {
      const { createExchangeRate } = await import("./db");
      return await createExchangeRate({
        date: new Date(input.date),
        currencyPair: input.currencyPair,
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
    }).query(async ({ input }) => {
      const { getDocumentsByExpense } = await import("./db");
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
      const { createDocument } = await import("./db");
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
    list: protectedProcedure.query(async () => {
      const { getFixedCosts } = await import("./db");
      return await getFixedCosts();
    }),
    create: protectedProcedure.input((val: unknown) => {
      return z.object({
        category: z.string(),
        amount: z.number(),
        currency: z.string().length(3).default("PLN"),
        description: z.string().optional(),
      }).parse(val);
    }).mutation(async ({ ctx, input }) => {
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
    }).mutation(async ({ input }) => {
      const { id, ...data } = input;
      const { updateFixedCost } = await import("./db");
      await updateFixedCost(id, data);
      return { success: true };
    }),
    delete: protectedProcedure.input((val: unknown) => {
      return z.object({ id: z.number() }).parse(val);
    }).mutation(async ({ input }) => {
      const { deleteFixedCost } = await import("./db");
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
    upsert: protectedProcedure.input((val: unknown) => {
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
        choroboweEnabled: profile.choroboweEnabled === 1,
        fpFsEnabled: profile.fpFsEnabled === 1,
      };
    }),
    upsertProfile: protectedProcedure.input((val: unknown) => {
      return z.object({
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
    upsertConfig: protectedProcedure.input((val: unknown) => {
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
    create: protectedProcedure.mutation(async () => {
      const { createBackup } = await import("./backup");
      return await createBackup();
    }),
    restore: protectedProcedure.input((val: unknown) => {
      return z.object({
        backup: z.any(),
      }).parse(val);
    }).mutation(async ({ input }) => {
      const { restoreBackup } = await import("./backup");
      return await restoreBackup(input.backup);
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

  // Exchange rates management
  exchangeRatesManagement: router({
    list: protectedProcedure.input((val: unknown) => {
      return z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        currency: z.string().optional(),
      }).parse(val);
    }).query(async ({ input }) => {
      const { getExchangeRates } = await import("./db");
      return await getExchangeRates({
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        currency: input.currency,
      });
    }),
    upsert: protectedProcedure.input((val: unknown) => {
      return z.object({
        date: z.string(),
        currencyPair: z.string(),
        rate: z.number(),
        source: z.string().default("Manual"),
      }).parse(val);
    }).mutation(async ({ input }) => {
      const { upsertExchangeRate } = await import("./db");
      return await upsertExchangeRate({
        date: new Date(input.date),
        currencyPair: input.currencyPair,
        rate: Math.round(input.rate * 10000),
        source: input.source,
      });
    }),
    updateFromNBP: protectedProcedure.input((val: unknown) => {
      return z.object({
        currencies: z.array(z.string()),
      }).parse(val);
    }).mutation(async ({ input }) => {
      const { fetchNBPExchangeRate } = await import("./nbp");
      const { upsertExchangeRate } = await import("./db");
      
      const results = [];
      for (const currency of input.currencies) {
        try {
          const rate = await fetchNBPExchangeRate(currency);
          await upsertExchangeRate({
            date: new Date(),
            currencyPair: `${currency}/PLN`,
            rate: Math.round(rate * 10000),
            source: "NBP",
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
    }).mutation(async ({ input }) => {
      const { upsertExchangeRate } = await import("./db");
      return await upsertExchangeRate({
        date: new Date(input.date),
        currencyPair: input.currencyPair,
        rate: Math.round(input.rate * 10000),
        source: "Manual",
      });
    }),
  }),

  // Database export/import
  database: router({
    export: publicProcedure.mutation(async () => {
      const { exportDatabase } = await import("./db");
      return await exportDatabase();
    }),
    import: publicProcedure.input((val: unknown) => {
      return z.object({
        backup: z.any(),
      }).parse(val);
    }).mutation(async ({ input }) => {
      const { importDatabase } = await import("./db");
      return await importDatabase(input.backup);
    }),
  }),
});

export type AppRouter = typeof appRouter;
