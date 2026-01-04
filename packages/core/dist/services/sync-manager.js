"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncManager = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const events_1 = __importDefault(require("events"));
const deep_equal_1 = __importDefault(require("deep-equal")); // Note: deep-equal doesn't have types by default usually, might need @types/deep-equal or ignore
const workflow_sanitizer_js_1 = require("./workflow-sanitizer.js");
// Define a simple deepEqual if strict module resolution fails on the import
// For this environment, we'll try to rely on the package, but if it fails we might need a utility.
// Assuming user will install @types/deep-equal or allow implicits.
class SyncManager extends events_1.default {
    client;
    config;
    // Maps filename -> Workflow ID
    fileToIdMap = new Map();
    // Maps filePath -> Content (to detect self-written changes)
    selfWrittenCache = new Map();
    constructor(client, config) {
        super();
        this.client = client;
        this.config = config;
        if (!fs_1.default.existsSync(this.config.directory)) {
            fs_1.default.mkdirSync(this.config.directory, { recursive: true });
        }
    }
    getFilePath(filename) {
        return path_1.default.join(this.config.directory, filename);
    }
    safeName(name) {
        return name.replace(/[\/\\:]/g, '_').replace(/\s+/g, ' ').trim();
    }
    markAsSelfWritten(filePath, content) {
        this.selfWrittenCache.set(filePath, content);
    }
    isSelfWritten(filePath, currentContent) {
        if (!this.selfWrittenCache.has(filePath))
            return false;
        return this.selfWrittenCache.get(filePath) === currentContent;
    }
    /**
     * Scans n8n instance and updates local files (Downstream Sync)
     */
    async syncDown() {
        this.emit('log', '🔄 [SyncManager] Starting Downstream Sync...');
        const remoteWorkflows = await this.client.getAllWorkflows();
        // Sort: Active first to prioritize their naming
        remoteWorkflows.sort((a, b) => (a.active === b.active ? 0 : a.active ? -1 : 1));
        const processedFiles = new Set();
        for (const wf of remoteWorkflows) {
            // Filter
            if (this.shouldIgnore(wf))
                continue;
            const filename = `${this.safeName(wf.name)}.json`;
            // Collision check
            if (processedFiles.has(filename))
                continue;
            processedFiles.add(filename);
            this.fileToIdMap.set(filename, wf.id);
            // Fetch full details
            const fullWf = await this.client.getWorkflow(wf.id);
            if (!fullWf)
                continue;
            const cleanRemote = workflow_sanitizer_js_1.WorkflowSanitizer.cleanForStorage(fullWf);
            const filePath = this.getFilePath(filename);
            // Write to disk
            await this.writeLocalFile(filePath, cleanRemote, filename);
        }
    }
    /**
     * Writes file to disk only if changed
     */
    async writeLocalFile(filePath, contentObj, filename) {
        const contentStr = JSON.stringify(contentObj, null, 2);
        if (!fs_1.default.existsSync(filePath)) {
            this.emit('log', `📥 [n8n->Local] New: "${filename}"`);
            this.markAsSelfWritten(filePath, contentStr);
            fs_1.default.writeFileSync(filePath, contentStr);
            return;
        }
        const localContent = fs_1.default.readFileSync(filePath, 'utf8');
        const localObj = JSON.parse(localContent);
        // We clean the local obj just to be sure we compare apples to apples (though it should be clean)
        const cleanLocal = workflow_sanitizer_js_1.WorkflowSanitizer.cleanForStorage(localObj);
        if (!(0, deep_equal_1.default)(cleanLocal, contentObj)) {
            this.emit('log', `📥 [n8n->Local] Updated: "${filename}"`);
            this.markAsSelfWritten(filePath, contentStr);
            fs_1.default.writeFileSync(filePath, contentStr);
        }
    }
    shouldIgnore(wf) {
        if (!this.config.syncInactive && !wf.active)
            return true;
        if (wf.tags) {
            const hasIgnoredTag = wf.tags.some(t => this.config.ignoredTags.includes(t.name.toLowerCase()));
            if (hasIgnoredTag)
                return true;
        }
        return false;
    }
    /**
     * Uploads local files that don't exist remotely (Upstream Sync - Init)
     */
    async syncUpMissing() {
        this.emit('log', '🔄 [SyncManager] Checking for orphans...');
        const localFiles = fs_1.default.readdirSync(this.config.directory).filter(f => f.endsWith('.json'));
        for (const file of localFiles) {
            if (this.fileToIdMap.has(file))
                continue;
            const filePath = this.getFilePath(file);
            const localData = this.readLocalFile(filePath);
            if (!localData)
                continue;
            this.emit('log', `📤 [Local->n8n] Creating orphan: "${file}"`);
            try {
                let payload = workflow_sanitizer_js_1.WorkflowSanitizer.cleanForPush(localData);
                // Name Safety Check
                const nameFromFile = path_1.default.parse(file).name;
                const payLoadName = payload.name || '';
                const safePayloadName = this.safeName(payLoadName);
                if (safePayloadName !== nameFromFile) {
                    this.emit('log', `⚠️  Name mismatch. File: "${file}" vs JSON: "${payLoadName}". Auto-correcting to filename.`);
                    payload.name = nameFromFile;
                }
                else {
                    payload.name = payload.name || nameFromFile;
                }
                const newWf = await this.client.createWorkflow(payload);
                this.emit('log', `✅ Created (ID: ${newWf.id})`);
                this.fileToIdMap.set(file, newWf.id);
            }
            catch (error) {
                this.emit('error', `❌ Failed to create "${file}": ${error.message}`);
            }
        }
    }
    /**
     * Handle FS watcher events
     */
    async handleLocalFileChange(filePath) {
        if (!filePath.endsWith('.json'))
            return;
        // Ignore self-written files to avoid infinite loops
        const rawContent = this.readRawFile(filePath);
        if (!rawContent || this.isSelfWritten(filePath, rawContent))
            return;
        const filename = path_1.default.basename(filePath);
        const nameFromFile = path_1.default.parse(filename).name;
        const id = this.fileToIdMap.get(filename);
        const json = JSON.parse(rawContent);
        const payload = workflow_sanitizer_js_1.WorkflowSanitizer.cleanForPush(json);
        try {
            if (id) {
                // UPDATE
                // Check if actually changed vs remote (Optimization)
                const remoteRaw = await this.client.getWorkflow(id);
                if (remoteRaw) {
                    const remoteClean = workflow_sanitizer_js_1.WorkflowSanitizer.cleanForStorage(remoteRaw);
                    const localClean = workflow_sanitizer_js_1.WorkflowSanitizer.cleanForStorage(json);
                    // We use deepEqual here, assuming it's imported or available
                    if ((0, deep_equal_1.default)(remoteClean, localClean))
                        return;
                }
                if (!payload.name)
                    payload.name = nameFromFile;
                this.emit('log', `📤 [Local->n8n] Update: "${filename}"`);
                await this.client.updateWorkflow(id, payload);
                this.emit('log', `✅ Update OK`);
            }
            else {
                // CREATE (New file added manually)
                const safePayloadName = this.safeName(payload.name || '');
                if (safePayloadName !== nameFromFile) {
                    this.emit('log', `⚠️  Name mismatch on creation. Using filename: "${nameFromFile}"`);
                    payload.name = nameFromFile;
                }
                else {
                    payload.name = payload.name || nameFromFile;
                }
                this.emit('log', `✨ [Local->n8n] Create: "${filename}"`);
                const newWf = await this.client.createWorkflow(payload);
                this.emit('log', `✅ Created (ID: ${newWf.id})`);
                this.fileToIdMap.set(filename, newWf.id);
            }
        }
        catch (error) {
            this.emit('error', `❌ Sync Up Error: ${error.message}`);
        }
    }
    readLocalFile(filePath) {
        try {
            return JSON.parse(fs_1.default.readFileSync(filePath, 'utf8'));
        }
        catch {
            return null;
        }
    }
    readRawFile(filePath) {
        try {
            return fs_1.default.readFileSync(filePath, 'utf8');
        }
        catch {
            return null;
        }
    }
}
exports.SyncManager = SyncManager;
//# sourceMappingURL=sync-manager.js.map