import { db, SyncQueue } from './db';

/**
 * Sync Service for Online/Offline synchronization
 */
class SyncService {
  private isOnline: boolean = navigator.onLine;
  private isSyncing: boolean = false;
  private syncInterval: number | null = null;

  constructor() {
    // Listen to online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.syncAll();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Start periodic sync every 5 minutes
    this.startPeriodicSync();
  }

  /**
   * Check if online
   */
  public isConnected(): boolean {
    return this.isOnline;
  }

  /**
   * Start periodic synchronization
   */
  private startPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = window.setInterval(() => {
      if (this.isOnline && !this.isSyncing) {
        this.syncAll();
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Sync all pending changes
   */
  public async syncAll(): Promise<void> {
    if (!this.isOnline || this.isSyncing) {
      return;
    }

    this.isSyncing = true;

    try {
      // Get all pending items from sync queue
      const pendingItems = await db.syncQueue.toArray();
      let syncedCount = 0;

      for (const item of pendingItems) {
        try {
          const synced = await this.syncItem(item);
          // Remove from queue only after a confirmed sync.
          if (synced) {
            await db.syncQueue.delete(item.id!);
            syncedCount += 1;
          }
        } catch (error) {
          console.error(`Failed to sync item ${item.id}:`, error);
          // Update attempts and error
          await db.syncQueue.update(item.id!, {
            attempts: item.attempts + 1,
            lastAttemptAt: new Date(),
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      console.log(`Synced ${syncedCount}/${pendingItems.length} items`);
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync individual item
   */
  private async syncItem(item: SyncQueue): Promise<boolean> {
    // Explicitly keep queued items until server sync mutations are implemented.
    console.warn(
      `[SyncService] Sync not implemented for ${item.tableName}.${item.operation}; queue item retained.`,
      { id: item.id, recordId: item.recordId }
    );
    return false;
  }

  /**
   * Add item to sync queue
   */
  public async queueSync(
    tableName: string,
    recordId: number,
    operation: 'create' | 'update' | 'delete',
    data: any
  ): Promise<void> {
    await db.syncQueue.add({
      tableName,
      recordId,
      operation,
      data,
      createdAt: new Date(),
      attempts: 0,
    });

    // Try to sync immediately if online
    if (this.isOnline) {
      this.syncAll();
    }
  }

  /**
   * Get pending sync count
   */
  public async getPendingSyncCount(): Promise<number> {
    return await db.syncQueue.count();
  }

  /**
   * Stop sync service
   */
  public stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
}

export const syncService = new SyncService();
