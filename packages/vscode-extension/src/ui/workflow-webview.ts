import * as vscode from 'vscode';
import { IWorkflowStatus } from '@n8n-as-code/core';

export class WorkflowWebview {
    public static currentPanel: WorkflowWebview | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, workflowId: string, url: string) {
        this._panel = panel;
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

    public update(workflowId: string, url: string) {
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
                src="${url}" 
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads"
                allow="clipboard-read; clipboard-write"
                onload="document.querySelector('.loading').style.display='none'">
            </iframe>
        </body>
        </html>`;
    }
}
