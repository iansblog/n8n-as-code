import fs from 'fs';
import path from 'path';
import EventEmitter from 'events';
import deepEqual from 'deep-equal'; // Note: deep-equal doesn't have types by default usually, might need @types/deep-equal or ignore
import { N8nApiClient } from './n8n-api-client.js';
import { WorkflowSanitizer } from './workflow-sanitizer.js';
import { ISyncConfig, IWorkflow } from '../types.js';

// Define a simple deepEqual if strict module resolution fails on the import
// For this environment, we'll try to rely on the package, but if it fails we might need a utility.
// Assuming user will install @types/deep-equal or allow implicits.

export class SyncManager extends EventEmitter {
    private client: N8nApiClient;
    private config: ISyncConfig;

    // Maps filename -> Workflow ID
    private fileToIdMap: Map<string, string> = new Map();
    // Maps filePath -> Content (to detect self-written changes)
    private selfWrittenCache: Map<string, string> = new Map();

    constructor(client: N8nApiClient, config: ISyncConfig) {
        super();
        this.client = client;
        this.config = config;

        if (!fs.existsSync(this.config.directory)) {
            fs.mkdirSync(this.config.directory, { recursive: true });
        }
    }

    private getFilePath(filename: string): string {
        return path.join(this.config.directory, filename);
    }

    private safeName(name: string): string {
        return name.replace(/[\/\\:]/g, '_').replace(/\s+/g, ' ').trim();
    }

    private markAsSelfWritten(filePath: string, content: string) {
        this.selfWrittenCache.set(filePath, content);
    }

    private isSelfWritten(filePath: string, currentContent: string): boolean {
        if (!this.selfWrittenCache.has(filePath)) return false;
        return this.selfWrittenCache.get(filePath) === currentContent;
    }

    /**
     * Loads remote workflows to populate the fileToIdMap without syncing content.
     */
    async loadRemoteState() {
        this.emit('log', '🔄 [SyncManager] Loading remote state...');
        const remoteWorkflows = await this.client.getAllWorkflows();

        // Populate map
        for (const wf of remoteWorkflows) {
            if (this.shouldIgnore(wf)) continue;
            const filename = `${this.safeName(wf.name)}.json`;
            this.fileToIdMap.set(filename, wf.id);
        }
    }

    /**
     * Scans n8n instance and updates local files (Downstream Sync)
     */
    async syncDown() {
        this.emit('log', '🔄 [SyncManager] Starting Downstream Sync...');
        const remoteWorkflows = await this.client.getAllWorkflows();

        // Sort: Active first to prioritize their naming
        remoteWorkflows.sort((a, b) => (a.active === b.active ? 0 : a.active ? -1 : 1));

        const processedFiles = new Set<string>();

        for (const wf of remoteWorkflows) {
            // Filter
            if (this.shouldIgnore(wf)) continue;

            const filename = `${this.safeName(wf.name)}.json`;

            // Collision check
            if (processedFiles.has(filename)) continue;
            processedFiles.add(filename);

            this.fileToIdMap.set(filename, wf.id);

            // Fetch full details
            const fullWf = await this.client.getWorkflow(wf.id);
            if (!fullWf) continue;

            const cleanRemote = WorkflowSanitizer.cleanForStorage(fullWf);
            const filePath = this.getFilePath(filename);

            // Write to disk
            await this.writeLocalFile(filePath, cleanRemote, filename);
        }
    }

    /**
     * Writes file to disk only if changed
     */
    private async writeLocalFile(filePath: string, contentObj: any, filename: string) {
        const contentStr = JSON.stringify(contentObj, null, 2);

        if (!fs.existsSync(filePath)) {
            this.emit('log', `📥 [n8n->Local] New: "${filename}"`);
            this.markAsSelfWritten(filePath, contentStr);
            fs.writeFileSync(filePath, contentStr);
            return;
        }

        const localContent = fs.readFileSync(filePath, 'utf8');
        const localObj = JSON.parse(localContent);
        // We clean the local obj just to be sure we compare apples to apples (though it should be clean)
        const cleanLocal = WorkflowSanitizer.cleanForStorage(localObj);

        if (!deepEqual(cleanLocal, contentObj)) {
            this.emit('log', `📥 [n8n->Local] Updated: "${filename}"`);
            this.markAsSelfWritten(filePath, contentStr);
            fs.writeFileSync(filePath, contentStr);
        }
    }

    private shouldIgnore(wf: IWorkflow): boolean {
        if (!this.config.syncInactive && !wf.active) return true;
        if (wf.tags) {
            const hasIgnoredTag = wf.tags.some(t => this.config.ignoredTags.includes(t.name.toLowerCase()));
            if (hasIgnoredTag) return true;
        }
        return false;
    }

    /**
     * Uploads local files that don't exist remotely (Upstream Sync - Init)
     */
    async syncUpMissing() {
        this.emit('log', '🔄 [SyncManager] Checking for orphans...');
        const localFiles = fs.readdirSync(this.config.directory).filter(f => f.endsWith('.json'));

        for (const file of localFiles) {
            if (this.fileToIdMap.has(file)) continue;

            const filePath = this.getFilePath(file);
            await this.handleLocalFileChange(filePath);
        }
    }

    /**
     * Full Upstream Sync: Updates existing and Creates new.
     */
    async syncUp() {
        this.emit('log', '📤 [SyncManager] Starting Upstream Sync (Push)...');
        const localFiles = fs.readdirSync(this.config.directory).filter(f => f.endsWith('.json'));

        for (const file of localFiles) {
            const filePath = this.getFilePath(file);
            await this.handleLocalFileChange(filePath);
        }
    }

    /**
     * Handle FS watcher events
     */
    async handleLocalFileChange(filePath: string) {
        if (!filePath.endsWith('.json')) return;

        // Ignore self-written files to avoid infinite loops
        const rawContent = this.readRawFile(filePath);
        if (!rawContent || this.isSelfWritten(filePath, rawContent)) return;

        const filename = path.basename(filePath);
        const nameFromFile = path.parse(filename).name;
        const id = this.fileToIdMap.get(filename);

        const json = JSON.parse(rawContent);
        const payload = WorkflowSanitizer.cleanForPush(json);

        try {
            if (id) {
                // UPDATE
                // Check if actually changed vs remote (Optimization)
                const remoteRaw = await this.client.getWorkflow(id);
                if (remoteRaw) {
                    const remoteClean = WorkflowSanitizer.cleanForStorage(remoteRaw);
                    const localClean = WorkflowSanitizer.cleanForStorage(json);
                    // We use deepEqual here, assuming it's imported or available
                    if (deepEqual(remoteClean, localClean)) return;
                }

                if (!payload.name) payload.name = nameFromFile;

                this.emit('log', `📤 [Local->n8n] Update: "${filename}"`);
                await this.client.updateWorkflow(id, payload);
                this.emit('log', `✅ Update OK`);

            } else {
                // CREATE (New file added manually)
                const safePayloadName = this.safeName(payload.name || '');
                if (safePayloadName !== nameFromFile) {
                    this.emit('log', `⚠️  Name mismatch on creation. Using filename: "${nameFromFile}"`);
                    payload.name = nameFromFile;
                } else {
                    payload.name = payload.name || nameFromFile;
                }

                this.emit('log', `✨ [Local->n8n] Create: "${filename}"`);
                const newWf = await this.client.createWorkflow(payload);
                this.emit('log', `✅ Created (ID: ${newWf.id})`);
                this.fileToIdMap.set(filename, newWf.id);
            }
        } catch (error: any) {
            this.emit('error', `❌ Sync Up Error: ${error.message}`);
        }
    }

    private readLocalFile(filePath: string): any {
        try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; }
    }

    private readRawFile(filePath: string): string | null {
        try { return fs.readFileSync(filePath, 'utf8'); } catch { return null; }
    }
}

