import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SyncManager, N8nApiClient, IN8nCredentials, IWorkflowStatus } from '@n8n-as-code/core';
import { StatusBar } from './ui/status-bar.js';
import { WorkflowTreeProvider } from './ui/workflow-tree-provider.js';
import { WorkflowWebview } from './ui/workflow-webview.js';

let syncManager: SyncManager | undefined;
const statusBar = new StatusBar();

export async function activate(context: vscode.ExtensionContext) {
    console.log('🔌 Activation of "n8n-as-code" ...');

    // 1. Initial Setup
    await initializeSyncManager();

    // 2. Register Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('n8n.pull', async () => {
            if (!syncManager) await initializeSyncManager();
            if (syncManager) {
                statusBar.showSyncing();
                try {
                    await syncManager.syncDown();
                    // Refresh tree
                    treeProvider.refresh();
                    statusBar.showSynced();
                    vscode.window.showInformationMessage('✅ n8n: Workflows pulled successfully.');
                } catch (e: any) {
                    statusBar.showError(e.message);
                    vscode.window.showErrorMessage(`n8n Pull Error: ${e.message}`);
                }
            }
        }),

        vscode.commands.registerCommand('n8n.push', async () => {
            if (!syncManager) await initializeSyncManager();
            if (syncManager) {
                statusBar.showSyncing();
                try {
                    // Update: use syncUp() for full sync like in CLI
                    await syncManager.syncUp();
                    // Refresh tree
                    treeProvider.refresh();
                    statusBar.showSynced();
                    vscode.window.showInformationMessage('✅ n8n: Pushed missing/updated workflows.');
                } catch (e: any) {
                    statusBar.showError(e.message);
                    vscode.window.showErrorMessage(`n8n Push Error: ${e.message}`);
                }
            }
        }),

        vscode.commands.registerCommand('n8n.openBoard', (arg: any) => {
            const wf = arg?.workflow ? arg.workflow : arg;
            if (!wf) return;

            const config = vscode.workspace.getConfiguration('n8n');
            const host = config.get<string>('host') || process.env.N8N_HOST || '';
            if (host) {
                WorkflowWebview.createOrShow(wf, host);
            } else {
                vscode.window.showErrorMessage('n8n Host not configured.');
            }
        }),

        vscode.commands.registerCommand('n8n.openJson', async (arg: any) => {
            const wf = arg?.workflow ? arg.workflow : arg;
            if (!wf || !syncManager) return;

            if (wf.filename) {
                const uri = vscode.Uri.file(path.join(syncManager['config'].directory, wf.filename));
                try {
                    const doc = await vscode.workspace.openTextDocument(uri);
                    await vscode.window.showTextDocument(doc);
                } catch (e: any) {
                    vscode.window.showErrorMessage(`Could not open file: ${e.message}`);
                }
            }
        }),

        vscode.commands.registerCommand('n8n.openSplit', async (arg: any) => {
            const wf = arg?.workflow ? arg.workflow : arg;
            if (!wf || !syncManager) return;

            // 1. Open JSON
            if (wf.filename) {
                const uri = vscode.Uri.file(path.join(syncManager['config'].directory, wf.filename));
                try {
                    const doc = await vscode.workspace.openTextDocument(uri);
                    await vscode.window.showTextDocument(doc, { viewColumn: vscode.ViewColumn.One });
                } catch (e: any) {
                    vscode.window.showErrorMessage(`Could not open file: ${e.message}`);
                }
            }

            // 2. Open Webview Aside
            const config = vscode.workspace.getConfiguration('n8n');
            const host = config.get<string>('host') || process.env.N8N_HOST || '';
            if (host) {
                WorkflowWebview.createOrShow(wf, host, vscode.ViewColumn.Two);
            }
        }),

        vscode.commands.registerCommand('n8n.pushWorkflow', async (arg: any) => {
            const wf = arg?.workflow ? arg.workflow : arg;
            if (!wf || !syncManager || !wf.filename) return;

            statusBar.showSyncing();
            try {
                // We reuse handleLocalFileChange which does the "Push" (Update/Create) logic
                const absPath = path.join(syncManager['config'].directory, wf.filename);
                await syncManager.handleLocalFileChange(absPath);

                treeProvider.refresh();
                statusBar.showSynced();
                vscode.window.showInformationMessage(`✅ Pushed "${wf.name}"`);
            } catch (e: any) {
                statusBar.showError(e.message);
                vscode.window.showErrorMessage(`Push Error: ${e.message}`);
            }
        }),

        vscode.commands.registerCommand('n8n.pullWorkflow', async (arg: any) => {
            const wf = arg?.workflow ? arg.workflow : arg;
            if (!wf || !syncManager || !wf.id) return;

            statusBar.showSyncing();
            try {
                if (wf.filename) {
                    await syncManager.pullWorkflow(wf.filename, wf.id);
                    treeProvider.refresh();
                    statusBar.showSynced();
                    vscode.window.showInformationMessage(`✅ Pulled "${wf.name}"`);
                }
            } catch (e: any) {
                statusBar.showError(e.message);
                vscode.window.showErrorMessage(`Pull Error: ${e.message}`);
            }
        }),

        vscode.commands.registerCommand('n8n.refresh', () => {
            treeProvider.refresh();
        })
    );

    // Register Tree View
    const treeProvider = new WorkflowTreeProvider();
    vscode.window.registerTreeDataProvider('n8n-explorer.workflows', treeProvider);

    // Pass syncManager to provider once ready
    if (syncManager) treeProvider.setSyncManager(syncManager);

    // 3. Watch for File Saves (Push on Save)
    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(async (document) => {
            if (document.languageId === 'json' && document.uri.fsPath.endsWith('.json')) {
                // Heuristic: Is it in our watched folder?
                const config = vscode.workspace.getConfiguration('n8n');
                const folderName = config.get<string>('syncFolder') || 'workflows';

                if (document.uri.fsPath.includes(folderName)) {
                    if (syncManager) {
                        statusBar.showSyncing();
                        try {
                            await syncManager.handleLocalFileChange(document.uri.fsPath);
                            treeProvider.refresh(); // Refresh tree to show "Modifying..." or updated status if we tracked it
                            statusBar.showSynced();
                            vscode.window.setStatusBarMessage('Saved & Pushed to n8n', 3000);
                        } catch (e: any) {
                            statusBar.showError(e.message);
                            // Don't show modal error on every save, maybe just status bar or output channel
                            console.error(e);
                        }
                    }
                }
            }
        })
    );
}

async function initializeSyncManager() {
    const config = vscode.workspace.getConfiguration('n8n');
    const host = config.get<string>('host') || process.env.N8N_HOST || '';
    const apiKey = config.get<string>('apiKey') || process.env.N8N_API_KEY || '';
    const folder = config.get<string>('syncFolder') || 'workflows';

    if (!host || !apiKey) {
        vscode.window.showWarningMessage('n8n: Host/API Key missing. Please check Settings.');
        return;
    }

    const credentials: IN8nCredentials = { host, apiKey };
    const client = new N8nApiClient(credentials);

    // Resolve Absolute Path
    let workspaceRoot = '';
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    } else {
        return; // No workspace open
    }

    const absDirectory = path.join(workspaceRoot, folder);

    syncManager = new SyncManager(client, {
        directory: absDirectory,
        pollIntervalMs: 0, // No polling in extension for now, relying on save events + manual pull
        syncInactive: true,
        ignoredTags: []
    });

    // Wire up logs
    syncManager.on('error', (msg) => console.error(msg));
    syncManager.on('log', (msg) => console.log(msg));
}

export function deactivate() { }
