import * as vscode from 'vscode';
import { IWorkflowStatus } from '@n8n-as-code/core';

export class WorkflowWebview {
    public static currentPanel: WorkflowWebview | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, workflowId: string, n8nHost: string) {
        this._panel = panel;
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.html = this.getHtmlForWebview(workflowId, n8nHost);
    }

    public static createOrShow(workflow: IWorkflowStatus, n8nHost: string, viewColumn?: vscode.ViewColumn) {
        const column = viewColumn || (vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined);

        // If we already have a panel, show it
        if (WorkflowWebview.currentPanel) {
            WorkflowWebview.currentPanel._panel.reveal(column);
            WorkflowWebview.currentPanel.update(workflow.id, n8nHost);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'n8nWorkflow',
            `n8n: ${workflow.name}`,
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        WorkflowWebview.currentPanel = new WorkflowWebview(panel, workflow.id, n8nHost);
    }

    public update(workflowId: string, n8nHost: string) {
        this._panel.title = `n8n: ${workflowId}`; // Should receive name but ID is fine for now
        this._panel.webview.html = this.getHtmlForWebview(workflowId, n8nHost);
    }

    public dispose() {
        WorkflowWebview.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) x.dispose();
        }
    }

    private getHtmlForWebview(workflowId: string, n8nHost: string) {
        const url = `${n8nHost}/workflow/${workflowId}`;
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>n8n Workflow</title>
            <style>
                body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; }
                iframe { width: 100%; height: 100%; border: none; }
            </style>
        </head>
        <body>
            <iframe src="${url}"></iframe>
        </body>
        </html>`;
    }
}
