import { Request, Response } from "express";
import { runScheduledTasks } from "./scheduler";

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

const CRON_SECRET = process.env.CRON_SECRET || "change-this-secret-in-production";

export async function handleCronRequest(req: Request, res: Response) {
  try {
    // Verify secret key
    const providedSecret = req.headers["x-cron-secret"];
    
    if (providedSecret !== CRON_SECRET) {
      console.warn("[Cron] Unauthorized access attempt");
      return res.status(401).json({ 
        success: false, 
        error: "Unauthorized" 
      });
    }

    console.log("[Cron] Running scheduled tasks...");
    const results = await runScheduledTasks();

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
