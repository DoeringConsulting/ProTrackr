import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";

export const appRouter = router({
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
      const z = require("zod").z;
      return z.object({ id: z.number() }).parse(val);
    }).query(async ({ input }) => {
      const { getCustomerById } = await import("./db");
      return await getCustomerById(input.id);
    }),
    create: protectedProcedure.input((val: unknown) => {
      const z = require("zod").z;
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
      const z = require("zod").z;
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
      const z = require("zod").z;
      return z.object({ id: z.number() }).parse(val);
    }).mutation(async ({ input }) => {
      const { deleteCustomer } = await import("./db");
      await deleteCustomer(input.id);
      return { success: true };
    }),
  }),

  // Time tracking
  timeEntries: router({
    list: protectedProcedure.input((val: unknown) => {
      const z = require("zod").z;
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
      const z = require("zod").z;
      return z.object({ id: z.number() }).parse(val);
    }).query(async ({ input }) => {
      const { getTimeEntryById } = await import("./db");
      return await getTimeEntryById(input.id);
    }),
    create: protectedProcedure.input((val: unknown) => {
      const z = require("zod").z;
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
      const z = require("zod").z;
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
      const z = require("zod").z;
      return z.object({ id: z.number() }).parse(val);
    }).mutation(async ({ input }) => {
      const { deleteTimeEntry } = await import("./db");
      await deleteTimeEntry(input.id);
      return { success: true };
    }),
  }),

  // Expenses
  expenses: router({
    listByTimeEntry: protectedProcedure.input((val: unknown) => {
      const z = require("zod").z;
      return z.object({ timeEntryId: z.number() }).parse(val);
    }).query(async ({ input }) => {
      const { getExpensesByTimeEntry } = await import("./db");
      return await getExpensesByTimeEntry(input.timeEntryId);
    }),
    create: protectedProcedure.input((val: unknown) => {
      const z = require("zod").z;
      return z.object({
        timeEntryId: z.number(),
        category: z.enum(["car", "train", "flight", "transport", "meal", "hotel", "food", "fuel", "other"]),
        distance: z.number().optional(),
        rate: z.number().optional(),
        amount: z.number(),
        comment: z.string().optional(),
        ticketNumber: z.string().optional(),
        flightNumber: z.string().optional(),
      }).parse(val);
    }).mutation(async ({ input }) => {
      const { createExpense } = await import("./db");
      return await createExpense(input);
    }),
    update: protectedProcedure.input((val: unknown) => {
      const z = require("zod").z;
      return z.object({
        id: z.number(),
        category: z.enum(["car", "train", "flight", "transport", "meal", "hotel", "food", "fuel", "other"]).optional(),
        distance: z.number().optional(),
        rate: z.number().optional(),
        amount: z.number().optional(),
        comment: z.string().optional(),
        ticketNumber: z.string().optional(),
        flightNumber: z.string().optional(),
      }).parse(val);
    }).mutation(async ({ input }) => {
      const { id, ...data } = input;
      const { updateExpense } = await import("./db");
      await updateExpense(id, data);
      return { success: true };
    }),
    delete: protectedProcedure.input((val: unknown) => {
      const z = require("zod").z;
      return z.object({ id: z.number() }).parse(val);
    }).mutation(async ({ input }) => {
      const { deleteExpense } = await import("./db");
      await deleteExpense(input.id);
      return { success: true };
    }),
  }),

  // Exchange rates
  exchangeRates: router({
    getByDate: protectedProcedure.input((val: unknown) => {
      const z = require("zod").z;
      return z.object({ date: z.string() }).parse(val);
    }).query(async ({ input }) => {
      const { getExchangeRateByDate, createExchangeRate } = await import("./db");
      const { fetchNBPExchangeRate } = await import("./nbp");
      
      const date = new Date(input.date);
      let rate = await getExchangeRateByDate(date);
      
      if (!rate) {
        const nbpRate = await fetchNBPExchangeRate(date);
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
  }),

  // Fixed costs
  fixedCosts: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const { getFixedCosts } = await import("./db");
      return await getFixedCosts(ctx.user.id);
    }),
    create: protectedProcedure.input((val: unknown) => {
      const z = require("zod").z;
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
      const z = require("zod").z;
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
      const z = require("zod").z;
      return z.object({ id: z.number() }).parse(val);
    }).mutation(async ({ input }) => {
      const { deleteFixedCost } = await import("./db");
      await deleteFixedCost(input.id);
      return { success: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
