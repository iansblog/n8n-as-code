"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiContextGenerator = void 0;
const fs_1 = __importDefault(require("fs"));
class AiContextGenerator {
    client;
    constructor(client) {
        this.client = client;
    }
    async generate(outputPath) {
        // In the future, this could fetch the actual n8n version and installed community nodes.
        const version = "1.0.0"; // Placeholder or fetch from /health
        const content = `# 🤖 AGENTS.md - Context for AI Agents

**Role**: N8n Automation Enginner
**System System**: You are connected to an n8n instance (v${version}).

## 🧠 Core Principles
1. **Code First**: Workflows are defined in JSON, but managed like code.
2. **Idempotency**: All operations should be reproducible.

## 🛠 Syntax Rules
- Use expressions like {{ $json.myField }} for data access.
- Dates are ISO 8601 string.

## 📦 Installed Nodes
- n8n-nodes-base
`;
        fs_1.default.writeFileSync(outputPath, content);
    }
}
exports.AiContextGenerator = AiContextGenerator;
//# sourceMappingURL=ai-context-generator.js.map