import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SyncManager, N8nApiClient, IN8nCredentials } from '@n8n-as-code/core';
import { StatusBar } from './ui/status-bar.js';

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
                    await syncManager.syncUpMissing();
                    statusBar.showSynced();
                    vscode.window.showInformationMessage('✅ n8n: Pushed missing workflows.');
                } catch (e: any) {
                    statusBar.showError(e.message);
                    vscode.window.showErrorMessage(`n8n Push Error: ${e.message}`);
                }
            }
        })
    );

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
