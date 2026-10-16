/**
 * @file CrmSyncEngine.ts
 * @description Edge CRM synchronization engine featuring pluggable storage adapters and strict Read-After-Write (RAW) state verification.
 * @author Ashflow Ecosystem <contact@ashflow.site>
 * @license MIT
 */
import { CrmAdapter, CrmSyncRecord, CrmVerificationResult } from '../types/index.js';
/**
 * Generates a deterministic SHA-256 checksum for record payload verification.
 */
export declare function calculateRecordChecksum(data: Record<string, unknown>): string;
/**
 * Adapter 1: SQLite / Turso Edge Database Adapter
 * Simulates low-latency LibSQL/Turso replica with atomic local storage.
 */
export declare class SqliteTursoAdapter implements CrmAdapter {
    readonly name = "sqlite-turso";
    private db;
    private isConnected;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    upsert(record: CrmSyncRecord): Promise<CrmSyncRecord>;
    read(id: string): Promise<CrmSyncRecord | null>;
    query(filter: Record<string, unknown>): Promise<CrmSyncRecord[]>;
}
/**
 * Adapter 2: Google Sheets Edge Mirror Adapter
 * Simulates row-based CRM synchronization (common in SMB & enterprise pipelines).
 */
export declare class GoogleSheetsAdapter implements CrmAdapter {
    readonly name = "google-sheets";
    private sheetRows;
    private nextRow;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    upsert(record: CrmSyncRecord): Promise<CrmSyncRecord>;
    read(id: string): Promise<CrmSyncRecord | null>;
    query(filter: Record<string, unknown>): Promise<CrmSyncRecord[]>;
}
/**
 * Adapter 3: Enterprise Webhook Adapter
 * Dispatches outbound event streams to remote CRM endpoints with idempotent store.
 */
export declare class WebhookAdapter implements CrmAdapter {
    readonly name = "crm-webhook";
    private targetUrl;
    private delivered;
    constructor(targetUrl?: string);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    upsert(record: CrmSyncRecord): Promise<CrmSyncRecord>;
    read(id: string): Promise<CrmSyncRecord | null>;
    query(filter: Record<string, unknown>): Promise<CrmSyncRecord[]>;
}
/**
 * CrmSyncEngine: Orchestrates edge sync and executes Read-After-Write (RAW) state verification.
 */
export declare class CrmSyncEngine {
    private adapters;
    private primaryAdapterName;
    private logger;
    constructor(primaryAdapterName?: string);
    registerAdapter(adapter: CrmAdapter): void;
    setPrimaryAdapter(name: string): void;
    getAdapter(name?: string): CrmAdapter;
    /**
     * Synchronizes a CRM record with mandatory Read-After-Write (RAW) state verification.
     */
    syncRecord(recordData: {
        id: string;
        entityType: CrmSyncRecord['entityType'];
        data: Record<string, unknown>;
        version?: number;
    }, options?: {
        adapterName?: string;
        verifyRaw?: boolean;
    }): Promise<{
        record: CrmSyncRecord;
        verification: CrmVerificationResult;
    }>;
    /**
     * Batch synchronizes records across the edge adapter.
     */
    syncBatch(records: Array<{
        id: string;
        entityType: CrmSyncRecord['entityType'];
        data: Record<string, unknown>;
        version?: number;
    }>, options?: {
        adapterName?: string;
    }): Promise<Array<{
        record: CrmSyncRecord;
        verification: CrmVerificationResult;
    }>>;
}
//# sourceMappingURL=CrmSyncEngine.d.ts.map