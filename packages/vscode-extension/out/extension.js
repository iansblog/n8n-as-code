"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const core_1 = require("@n8n-as-code/core");
const status_bar_js_1 = require("./ui/status-bar.js");
let syncManager;
const statusBar = new status_bar_js_1.StatusBar();
async function activate(context) {
    console.log('🔌 Activation of "n8n-as-code" ...');
    // 1. Initial Setup
    await initializeSyncManager();
    // 2. Register Commands
    context.subscriptions.push(vscode.commands.registerCommand('n8n.pull', async () => {
        if (!syncManager)
            await initializeSyncManager();
        if (syncManager) {
            statusBar.showSyncing();
            try {
                await syncManager.syncDown();
                statusBar.showSynced();
                vscode.window.showInformationMessage('✅ n8n: Workflows pulled successfully.');
            }
            catch (e) {
                statusBar.showError(e.message);
                vscode.window.showErrorMessage(`n8n Pull Error: ${e.message}`);
            }
        }
    }), vscode.commands.registerCommand('n8n.push', async () => {
        if (!syncManager)
            await initializeSyncManager();
        if (syncManager) {
            statusBar.showSyncing();
            try {
                await syncManager.syncUpMissing();
                statusBar.showSynced();
                vscode.window.showInformationMessage('✅ n8n: Pushed missing workflows.');
            }
            catch (e) {
                statusBar.showError(e.message);
                vscode.window.showErrorMessage(`n8n Push Error: ${e.message}`);
            }
        }
    }));
    // 3. Watch for File Saves (Push on Save)
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(async (document) => {
        if (document.languageId === 'json' && document.uri.fsPath.endsWith('.json')) {
            // Heuristic: Is it in our watched folder?
            const config = vscode.workspace.getConfiguration('n8n');
            const folderName = config.get('syncFolder') || 'workflows';
            if (document.uri.fsPath.includes(folderName)) {
                if (syncManager) {
                    statusBar.showSyncing();
                    try {
                        await syncManager.handleLocalFileChange(document.uri.fsPath);
                        statusBar.showSynced();
                        vscode.window.setStatusBarMessage('Saved & Pushed to n8n', 3000);
                    }
                    catch (e) {
                        statusBar.showError(e.message);
                        // Don't show modal error on every save, maybe just status bar or output channel
                        console.error(e);
                    }
                }
            }
        }
    }));
}
async function initializeSyncManager() {
    const config = vscode.workspace.getConfiguration('n8n');
    const host = config.get('host') || process.env.N8N_HOST || '';
    const apiKey = config.get('apiKey') || process.env.N8N_API_KEY || '';
    const folder = config.get('syncFolder') || 'workflows';
    if (!host || !apiKey) {
        vscode.window.showWarningMessage('n8n: Host/API Key missing. Please check Settings.');
        return;
    }
    const credentials = { host, apiKey };
    const client = new core_1.N8nApiClient(credentials);
    // Resolve Absolute Path
    let workspaceRoot = '';
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    }
    else {
        return; // No workspace open
    }
    const absDirectory = path.join(workspaceRoot, folder);
    syncManager = new core_1.SyncManager(client, {
        directory: absDirectory,
        pollIntervalMs: 0, // No polling in extension for now, relying on save events + manual pull
        syncInactive: true,
        ignoredTags: []
    });
    // Wire up logs
    syncManager.on('error', (msg) => console.error(msg));
    syncManager.on('log', (msg) => console.log(msg));
}
function deactivate() { }
//# sourceMappingURL=extension.js.map