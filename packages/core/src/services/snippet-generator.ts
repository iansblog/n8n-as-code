import fs from 'fs';
import { N8nApiClient } from './n8n-api-client.js';

export class SnippetGenerator {
    constructor(private client: N8nApiClient) { }

    async generate(projectRoot: string): Promise<void> {
        const nodeTypes = await this.client.getNodeTypes();
        const snippets: any = {};

        // If no nodes found (API permission or endpoint issue), generate generic ones
        if (!nodeTypes || nodeTypes.length === 0) {
            // Hardcoded common nodes for fallback
            this.addFallbackSnippets(snippets);
        } else {
            for (const node of nodeTypes) {
                const name = node.name.replace('n8n-nodes-base.', '');
                snippets[`n8n-${name}`] = {
                    prefix: `n8n-${name}`,
                    body: [
                        "{",
                        `  "parameters": {},`,
                        `  "name": "${node.displayName}",`,
                        `  "type": "${node.name}",`,
                        `  "typeVersion": ${node.defaults?.typeVersion || 1},`,
                        `  "position": [0, 0]`,
                        "}"
                    ],
                    description: `Insert a ${node.displayName} node`
                };
            }
        }

        const vscodeDir = `${projectRoot}/.vscode`;
        if (!fs.existsSync(vscodeDir)) {
            fs.mkdirSync(vscodeDir, { recursive: true });
        }

        fs.writeFileSync(`${vscodeDir}/n8n.code-snippets`, JSON.stringify(snippets, null, 2));
    }

    private addFallbackSnippets(snippets: any) {
        const commonNodes = [
            {
                name: "Webhook",
                type: "n8n-nodes-base.webhook",
                ver: 1,
                icon: "⚡",
                params: { "path": "webhook", "httpMethod": "POST" }
            },
            {
                name: "Code",
                type: "n8n-nodes-base.code",
                ver: 2,
                icon: "💻",
                params: { "jsCode": "// Access data with $('NodeName').item.json\nreturn [{ json: { hello: 'world' } }];" }
            },
            {
                name: "HTTP Request",
                type: "n8n-nodes-base.httpRequest",
                ver: 4,
                icon: "🌐",
                params: { "url": "https://api.example.com", "method": "GET" }
            },
            {
                name: "Schedule Trigger",
                type: "n8n-nodes-base.scheduleTrigger",
                ver: 1,
                icon: "⏰",
                params: { "rule": { "interval": [{ "field": "minutes", "minutesInterval": 15 }] } }
            },
            {
                name: "Split In Batches",
                type: "n8n-nodes-base.splitInBatches",
                ver: 1,
                icon: "📦",
                params: { "batchSize": 10 }
            },
            {
                name: "Switch",
                type: "n8n-nodes-base.switch",
                ver: 1,
                icon: "🔀",
                params: { "datatypes": "string", "rules": { "rules": [{ "operation": "equals" }] } }
            },
            {
                name: "Merge",
                type: "n8n-nodes-base.merge",
                ver: 2,
                icon: "🔗",
                params: { "mode": "append" }
            },
            {
                name: "Google Sheets",
                type: "n8n-nodes-base.googleSheets",
                ver: 3,
                icon: "📊",
                params: { "operation": "append", "resource": "row" }
            },
            {
                name: "Slack",
                type: "n8n-nodes-base.slack",
                ver: 2,
                icon: "💬",
                params: { "channel": "general", "text": "Hello form n8n" }
            },
            {
                name: "Postgres",
                type: "n8n-nodes-base.postgres",
                ver: 1,
                icon: "🐘",
                params: { "operation": "executeQuery", "query": "SELECT * FROM users;" }
            }
        ];

        for (const node of commonNodes) {
            const key = `n8n-${node.name.toLowerCase().replace(/\s+/g, '-')}`;
            snippets[key] = {
                prefix: key,
                body: [
                    "{",
                    `  "parameters": ${JSON.stringify(node.params)},`,
                    `  "name": "${node.name}",`,
                    `  "type": "${node.type}",`,
                    `  "typeVersion": ${node.ver},`,
                    `  "position": [0, 0]`,
                    "}"
                ],
                description: `${node.icon} Insert a ${node.name} node`
            };
        }
    }
}

