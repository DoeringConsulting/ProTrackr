import Dexie, { Table } from 'dexie';

// Local database schema matching server schema
export interface LocalCustomer {
  id?: number;
  userId: number;
  provider: string;
  clientNumber: string;
  project: string;
  location: string;
  onsiteDailyRate: number;
  remoteDailyRate: number;
  kmAllowance: number;
  mealAllowance: number;
  billingModel: 'exclusive' | 'inclusive';
  createdAt: Date;
  updatedAt: Date;
  syncStatus?: 'synced' | 'pending' | 'conflict';
  lastSyncedAt?: Date;
}

export interface LocalTimeEntry {
  id?: number;
  userId: number;
  customerId: number;
  date: Date;
  workType: 'onsite' | 'remote' | 'off_duty' | 'business_trip';
  hours: number;
  manDays: number;
  rate: number;
  calculatedAmount: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  syncStatus?: 'synced' | 'pending' | 'conflict';
  lastSyncedAt?: Date;
}

export interface LocalExpense {
  id?: number;
  userId: number;
  timeEntryId?: number;
  customerId: number;
  date: Date;
  category: string;
  amount: number;
  currency: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  syncStatus?: 'synced' | 'pending' | 'conflict';
  lastSyncedAt?: Date;
}

export interface LocalFixedCost {
  id?: number;
  userId: number;
  category: string;
  amount: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  syncStatus?: 'synced' | 'pending' | 'conflict';
  lastSyncedAt?: Date;
}

export interface LocalExchangeRate {
  id?: number;
  date: Date;
  currencyPair: string;
  rate: number;
  source: string;
  createdAt: Date;
  syncStatus?: 'synced' | 'pending' | 'conflict';
  lastSyncedAt?: Date;
}

export interface LocalDocument {
  id?: number;
  userId: number;
  expenseId?: number;
  filename: string;
  fileKey: string;
  mimeType: string;
  fileSize: number;
  localPath?: string; // Path in local file system
  createdAt: Date;
  syncStatus?: 'synced' | 'pending' | 'conflict';
  lastSyncedAt?: Date;
}

export interface SyncQueue {
  id?: number;
  tableName: string;
  recordId: number;
  operation: 'create' | 'update' | 'delete';
  data: any;
  createdAt: Date;
  attempts: number;
  lastAttemptAt?: Date;
  error?: string;
}

export class LocalDatabase extends Dexie {
  customers!: Table<LocalCustomer>;
  timeEntries!: Table<LocalTimeEntry>;
  expenses!: Table<LocalExpense>;
  fixedCosts!: Table<LocalFixedCost>;
  exchangeRates!: Table<LocalExchangeRate>;
  documents!: Table<LocalDocument>;
  syncQueue!: Table<SyncQueue>;

  constructor() {
    super('DoringConsultingDB');
    
    this.version(1).stores({
      customers: '++id, userId, provider, project, syncStatus',
      timeEntries: '++id, userId, customerId, date, syncStatus',
      expenses: '++id, userId, timeEntryId, customerId, date, syncStatus',
      fixedCosts: '++id, userId, category, syncStatus',
      exchangeRates: '++id, date, currencyPair, syncStatus',
      documents: '++id, userId, expenseId, fileKey, syncStatus',
      syncQueue: '++id, tableName, recordId, operation, createdAt',
    });
  }
}

export const db = new LocalDatabase();
