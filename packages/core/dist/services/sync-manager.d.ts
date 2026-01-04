import EventEmitter from 'events';
import { N8nApiClient } from './n8n-api-client.js';
import { ISyncConfig } from '../types.js';
export declare class SyncManager extends EventEmitter {
    private client;
    private config;
    private fileToIdMap;
    private selfWrittenCache;
    constructor(client: N8nApiClient, config: ISyncConfig);
    private getFilePath;
    private safeName;
    private markAsSelfWritten;
    private isSelfWritten;
    /**
     * Scans n8n instance and updates local files (Downstream Sync)
     */
    syncDown(): Promise<void>;
    /**
     * Writes file to disk only if changed
     */
    private writeLocalFile;
    private shouldIgnore;
    /**
     * Uploads local files that don't exist remotely (Upstream Sync - Init)
     */
    syncUpMissing(): Promise<void>;
    /**
     * Handle FS watcher events
     */
    handleLocalFileChange(filePath: string): Promise<void>;
    private readLocalFile;
    private readRawFile;
}
//# sourceMappingURL=sync-manager.d.ts.map