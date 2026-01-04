import fs from 'fs';
import { N8nApiClient } from './n8n-api-client.js';

export class AiContextGenerator {
  constructor(private client: N8nApiClient) { }

  async generate(projectRoot: string): Promise<void> {
    // 1. Generate AGENTS.md
    const agentsPath = `${projectRoot}/AGENTS.md`;

    // Fetch real version
    let version = "Unknown";
    try {
      const health = await this.client.getHealth();
      version = health.version;
    } catch { }

    const content = [
      `# 🤖 AGENTS.md - Context for AI Agents`,
      `> **CRITICAL**: Read this file before creating or modifying any n8n workflow files.`,
      ``,
      `## 🎭 Role & Objective`,
      `You are an **Expert n8n Automation Engineer**. Your goal is to manage n8n workflows as **clean, version-controlled code** (JSON) while maintaining full compatibility with the n8n Visual Editor.`,
      ``,
      `## 🌍 Instance Context`,
      `- **n8n Version**: ${version}`,
      `- **Environment**: Production/Dev (Inferred)`,
      ``,
      `## 🛠 Coding Standards & Syntax Rules`,
      `1. **JSON Structure**:`,
      `   - Workflows are stored as standard .json files.`,
      `   - Use the \`n8n-schema.json\` (if present) to validate structure.`,
      `   - **Order Matters**: Keep \`nodes\` and \`connections\` objects sorted if possible to reduce diff noise.`,
      ``,
      `2. **Expressions**:`,
      `   - Use standard n8n expression syntax: \`{{ $` + `json.myField }}\` or \`{{ $` + `node["Node Name"].json.field }}\`.`,
      `   - **Do not** use Python or generic JS unless inside a Function/Code node.`,
      ``,
      `3. **Node Configuration**:`,
      `   - **Function Nodes**: Prefer the new \`Code\` node type over legacy \`Function\`.`,
      `   - **Triggers**: Ensure only ONE trigger is active if multiple exist, or document why.`,
      ``,
      `4. **Git Workflow**:`,
      `   - **Never** commit credentials. Use n8n Credentials store.`,
      `   - **Do not** commit \`staticData\` or \`pinData\` unless specifically required for test fixtures.`,
      ``,
      `## 🧠 Common Patterns`,
      `- **Error Handling**: Use "Error Trigger" workflow or "Continue On Fail" settings.`,
      `- **Looping**: Use "Split In Batches" node.`,
      ``,
      `## 🚫 Prohibited`,
      `- Do not manually edit ID hash strings unless you are resolving a merge conflict.`,
      `- Do not remove \`parameters\` object from nodes even if empty.`
    ].join('\n');

    fs.writeFileSync(agentsPath, content);

    // 2. Generate .cursorrules
    const cursorRules = `
# .cursorrules
# Defines rules for Cursor AI Agent

# 1. ALWAYS read AGENTS.md for context on n8n specific syntax.
# 2. When asking to generate a workflow, output Valid JSON compatible with n8n import.
# 3. Refer to n8n-schema.json for validation.
`;
    fs.writeFileSync(`${projectRoot}/.cursorrules`, cursorRules.trim());

    // 3. Generate .clinerules
    const clineRules = `
# .clinerules
# Rules for Cline/Roo agents

MEMORY_BANK:
  - READ "AGENTS.md" to understand n8n-as-code principles.
  - VALIDATE generated JSON against "n8n-schema.json".

BEHAVIOR:
  - Prioritize "Code Node" (JS) over deprecated nodes.
  - Maintain clean JSON formatting (2 spaces indentation).
`;
    fs.writeFileSync(`${projectRoot}/.clinerules`, clineRules.trim());
  }
}
