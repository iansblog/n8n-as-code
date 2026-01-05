import * as vscode from 'vscode';
import { IWorkflowStatus } from '@n8n-as-code/core';

export class WorkflowWebview {
    public static currentPanel: WorkflowWebview | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _workflowId: string;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, workflowId: string, url: string) {
        this._panel = panel;
        this._workflowId = workflowId;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.html = this.getHtmlForWebview(workflowId, url);
    }

    public static createOrShow(workflow: IWorkflowStatus, url: string, viewColumn?: vscode.ViewColumn) {
        const column = viewColumn || (vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined);

        // If we already have a panel, show it
        if (WorkflowWebview.currentPanel) {
            WorkflowWebview.currentPanel._panel.reveal(column);
            WorkflowWebview.currentPanel.update(workflow.id, url);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'n8nWorkflow',
            `n8n: ${workflow.name}`,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true, // Keep webview state when hidden
                localResourceRoots: [] // Security: No local file access needed
            }
        );

        WorkflowWebview.currentPanel = new WorkflowWebview(panel, workflow.id, url);
    }

    /**
     * Trigger a reload of the webview if the workflowId matches the one currently displayed.
     */
    public static reloadIfMatching(workflowId: string, outputChannel?: vscode.OutputChannel) {
        if (WorkflowWebview.currentPanel) {
            const panelId = WorkflowWebview.currentPanel._workflowId;
            if (panelId === workflowId) {
                outputChannel?.appendLine(`[Webview] Reloading matching workflow: ${workflowId}`);
                WorkflowWebview.currentPanel._panel.webview.postMessage({ type: 'reload' });
                return true;
            } else {
                outputChannel?.appendLine(`[Webview] Workflow ID mismatch for reload. Panel: ${panelId}, Requested: ${workflowId}`);
            }
        } else {
            outputChannel?.appendLine(`[Webview] No active panel for reload matching: ${workflowId}`);
        }
        return false;
    }

    /**
     * Reload the currently open webview regardless of workflow ID.
     */
    public static reloadCurrent(outputChannel?: vscode.OutputChannel) {
        if (WorkflowWebview.currentPanel) {
            outputChannel?.appendLine(`[Webview] Reloading current panel (${WorkflowWebview.currentPanel._workflowId})`);
            WorkflowWebview.currentPanel._panel.webview.postMessage({ type: 'reload' });
            return true;
        }
        return false;
    }

    public update(workflowId: string, url: string) {
        this._workflowId = workflowId;
        this._panel.title = `n8n: ${workflowId}`;
        this._panel.webview.html = this.getHtmlForWebview(workflowId, url);
    }

    public dispose() {
        WorkflowWebview.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) x.dispose();
        }
    }

    private getHtmlForWebview(workflowId: string, url: string) {
        // url is the proxy URL pointing to the n8n workflow
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval'; frame-src *; connect-src *; img-src * data:; style-src * 'unsafe-inline';">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>n8n: ${workflowId}</title>
            <style>
                body, html { 
                    margin: 0; 
                    padding: 0; 
                    height: 100%; 
                    overflow: hidden; 
                    background: #f0f0f0;
                }
                iframe { 
                    width: 100%; 
                    height: 100%; 
                    border: none; 
                    display: block;
                }
                .loading {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    font-family: system-ui, -apple-system, sans-serif;
                    color: #666;
                    text-align: center;
                }
                .loading::after {
                    content: '...';
                    animation: dots 1.5s steps(4, end) infinite;
                }
                @keyframes dots {
                    0%, 20% { content: '.'; }
                    40% { content: '..'; }
                    60%, 100% { content: '...'; }
                }
            </style>
        </head>
        <body>
            <div class="loading">Loading n8n workflow</div>
            <iframe 
                id="n8n-frame"
                src="${url}" 
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads allow-top-navigation allow-top-navigation-by-user-activation"
                allow="clipboard-read; clipboard-write; geolocation; microphone; camera"
                onload="document.querySelector('.loading').style.display='none'; console.log('n8n iframe loaded');"
                onerror="console.error('n8n iframe failed to load');">
            </iframe>
            <script>
                const vscode = acquireVsCodeApi();
                const frame = document.getElementById('n8n-frame');

                // Handle messages from the extension
                window.addEventListener('message', (event) => {
                    const message = event.data;
                    console.log('Webview received message:', message);
                    
                    if (message.type === 'reload') {
                        console.log('Reloading n8n iframe...');
                        document.querySelector('.loading').style.display = 'block';
                        // Refresh the iframe by re-setting its src
                        const currentSrc = frame.src;
                        frame.src = 'about:blank';
                        setTimeout(() => {
                            frame.src = currentSrc;
                        }, 10);
                    }
                });
            </script>
        </body>
        </html>`;
    }
}
