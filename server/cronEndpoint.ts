import { Request, Response } from "express";
import crypto from "crypto";
import { runScheduledTasksGlobal } from "./scheduler";

/**
 * Public endpoint for cron job to trigger scheduled tasks
 * 
 * Usage:
 * Configure your cron service (e.g., cron-job.org, EasyCron, or server crontab) to call:
 * POST https://your-domain.com/api/cron/run-scheduler
 * Header: X-Cron-Secret: <your-secret-key>
 * 
 * Example crontab entry (runs daily at 9:00 AM):
 * 0 9 * * * curl -X POST -H "X-Cron-Secret: YOUR_SECRET" https://your-domain.com/api/cron/run-scheduler
 */

function getCronSecret(): string | null {
  const value = process.env.CRON_SECRET?.trim();
  return value && value.length > 0 ? value : null;
}

function toBuffer(value: string): Buffer {
  return Buffer.from(value, "utf8");
}

function safeSecretEquals(expected: string, actual: string): boolean {
  const expectedBuffer = toBuffer(expected);
  const actualBuffer = toBuffer(actual);
  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

export async function handleCronRequest(req: Request, res: Response) {
  try {
    const cronSecret = getCronSecret();
    if (!cronSecret) {
      console.error("[Cron] CRON_SECRET not configured");
      return res.status(503).json({
        success: false,
        error: "Cron endpoint not configured",
      });
    }

    // Verify secret key
    const headerValue = req.headers["x-cron-secret"];
    const providedSecret =
      typeof headerValue === "string"
        ? headerValue
        : Array.isArray(headerValue)
          ? headerValue[0]
          : "";

    if (!providedSecret || !safeSecretEquals(cronSecret, providedSecret)) {
      console.warn("[Cron] Unauthorized access attempt");
      return res.status(401).json({ 
        success: false, 
        error: "Unauthorized" 
      });
    }

    console.log("[Cron] Running scheduled tasks...");
    const results = await runScheduledTasksGlobal();

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      results,
    });
  } catch (error) {
    console.error("[Cron] Error running scheduled tasks:", error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
