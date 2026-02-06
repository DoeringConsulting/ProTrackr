import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { generateInvoiceNumber, getInvoiceNumbers } from "./db";

export const appRouter = router({
  invoiceNumbers: router({
    generate: protectedProcedure
      .input(z.object({ customerId: z.number() }))
      .mutation(async ({ input }) => {
        const invoiceNumber = await generateInvoiceNumber(input.customerId);
        return { invoiceNumber };
      }),
    list: protectedProcedure
      .input(z.object({ year: z.number().optional() }))
      .query(async ({ input }) => {
        return await getInvoiceNumbers(input.year);
      }),
  }),
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

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
        remoteRate: z.number(),
        kmRate: z.number(),
        mealRate: z.number(),
        costModel: z.enum(["exclusive", "inclusive"]),
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
        remoteRate: z.number().optional(),
        kmRate: z.number().optional(),
        mealRate: z.number().optional(),
        costModel: z.enum(["exclusive", "inclusive"]).optional(),
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
    listByTimeEntry: protectedProcedure.input((val: unknown) => {
      return z.object({ timeEntryId: z.number() }).parse(val);
    }).query(async ({ input }) => {
      const { getExpensesByTimeEntry } = await import("./db");
      return await getExpensesByTimeEntry(input.timeEntryId);
    }),
    create: protectedProcedure.input((val: unknown) => {
      return z.object({
        timeEntryId: z.number(),
        category: z.enum(["car", "train", "flight", "taxi", "transport", "meal", "hotel", "food", "fuel", "other"]),
        distance: z.number().optional(),
        rate: z.number().optional(),
        amount: z.number(),
        comment: z.string().optional(),
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
      return await createExpense(input);
    }),
    createBatch: protectedProcedure.input((val: unknown) => {
      return z.object({
        timeEntryId: z.number(),
        expenses: z.array(z.object({
          category: z.enum(["car", "train", "flight", "taxi", "transport", "meal", "hotel", "food", "fuel", "other"]),
          distance: z.number().optional(),
          rate: z.number().optional(),
          amount: z.number(),
          comment: z.string().optional(),
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
        const result = await createExpense({ timeEntryId: input.timeEntryId, ...expense });
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
        comment: z.string().optional(),
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
      await updateExpense(id, data);
      return { success: true };
    }),
    delete: protectedProcedure.input((val: unknown) => {
      return z.object({ id: z.number() }).parse(val);
    }).mutation(async ({ input }) => {
      const { deleteExpense } = await import("./db");
      await deleteExpense(input.id);
      return { success: true };
    }),
  }),

  // Currency support
  currencies: router({
    list: publicProcedure.query(() => {
      const { NBP_CURRENCIES } = require("./nbp");
      return NBP_CURRENCIES;
    }),
    getRate: publicProcedure.input((val: unknown) => {
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
      let rate = await getExchangeRateByDate(date);
      
      if (!rate) {
        const nbpRate = await fetchNBPExchangeRate("EUR", date);
        await createExchangeRate({
          date,
          currencyPair: "EUR/PLN",
          rate: Math.round(nbpRate * 10000),
          source: "NBP",
        });
        rate = await getExchangeRateByDate(date);
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

  // Scheduler
  scheduler: router({
    runTasks: protectedProcedure.mutation(async () => {
      const { runScheduledTasks } = await import("./scheduler");
      return await runScheduledTasks();
    }),
    checkMonthEnd: protectedProcedure.mutation(async () => {
      const { checkMonthEnd } = await import("./scheduler");
      return await checkMonthEnd();
    }),
    checkMissingEntries: protectedProcedure.mutation(async () => {
      const { checkMissingTimeEntries } = await import("./scheduler");
      return await checkMissingTimeEntries();
    }),
  }),

  // Notifications
  notifications: router({
    sendMonthEndNotification: protectedProcedure.input((val: unknown) => {
      return z.object({
        month: z.string(),
        revenue: z.number(),
        expenses: z.number(),
      }).parse(val);
    }).mutation(async ({ input }) => {
      const { notifyMonthEnd } = await import("./notifications");
      return await notifyMonthEnd(input.month, input.revenue, input.expenses);
    }),
    sendMissingTimeEntriesNotification: protectedProcedure.input((val: unknown) => {
      return z.object({
        date: z.string(),
        daysWithoutEntries: z.number(),
      }).parse(val);
    }).mutation(async ({ input }) => {
      const { notifyMissingTimeEntries } = await import("./notifications");
      return await notifyMissingTimeEntries(input.date, input.daysWithoutEntries);
    }),
    sendInvoiceDeadlineNotification: protectedProcedure.input((val: unknown) => {
      return z.object({
        customer: z.string(),
        deadline: z.string(),
        daysLeft: z.number(),
      }).parse(val);
    }).mutation(async ({ input }) => {
      const { notifyUpcomingInvoiceDeadline } = await import("./notifications");
      return await notifyUpcomingInvoiceDeadline(input.customer, input.deadline, input.daysLeft);
    }),
    sendIncompleteExpensesNotification: protectedProcedure.input((val: unknown) => {
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
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getFixedCosts } = await import("./db");
      return await getFixedCosts(ctx.user.id);
    }),
    create: protectedProcedure.input((val: unknown) => {
      return z.object({
        category: z.string(),
        amount: z.number(),
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
  taxSettings: router({    get: protectedProcedure.query(async ({ ctx }) => {
      const { getTaxSettings } = await import("./db");
      return await getTaxSettings(ctx.user.id);
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
    }).mutation(async ({ ctx, input }) => {
      const { upsertTaxSettings } = await import("./db");
      return await upsertTaxSettings(ctx.user.id, input);
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
});

export type AppRouter = typeof appRouter;
