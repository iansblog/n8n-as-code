import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import { N8nApiClient, SchemaGenerator, AiContextGenerator, SnippetGenerator, IN8nCredentials } from '@n8n-as-code/core';
import dotenv from 'dotenv';

export class InitAiCommand {
    constructor(private program: Command) {
        this.program
            .command('init-ai')
            .description('Initialize AI Context (AGENTS.md, n8n-schema.json, rule files)')
            .option('--doc-only', 'Generate only documentation, skip schema')
            .action(async (options) => {
                await this.run(options);
            });
    }

    private async run(options: any) {
        console.log(chalk.blue('🤖 Initializing AI Context Injection...'));

        const projectRoot = process.cwd();

        // Load credentials for API usage (needed for Schema/Context generators potentially)
        // Even if we use placeholders now, good to have the structure.
        dotenv.config();
        const credentials: IN8nCredentials = {
            host: process.env.N8N_HOST || '',
            apiKey: process.env.N8N_API_KEY || ''
        };
        console.log(chalk.gray(`   - Host: ${credentials.host || 'undefined'}`));
        const client = new N8nApiClient(credentials);

        try {
            // Debug Version Fetch
            const health = await client.getHealth();
            console.log(chalk.gray(`   - Detected Version: ${health.version}`));
            // 1. Generate Schema
            if (!options.docOnly) {
                console.log(chalk.gray('   - Generating n8n-schema.json...'));
                const schemaGen = new SchemaGenerator(client);
                await schemaGen.generateSchema(path.join(projectRoot, 'n8n-schema.json'));
                console.log(chalk.green('   ✅ n8n-schema.json created.'));
            }

            // 2. Generate Context (AGENTS.md, rules)
            console.log(chalk.gray('   - Generating AGENTS.md and AI rules...'));
            const contextGen = new AiContextGenerator(client);
            await contextGen.generate(projectRoot);
            console.log(chalk.green('   ✅ AGENTS.md, .cursorrules, .clinerules created.'));

            // 3. Generate Snippets
            if (!options.docOnly) {
                console.log(chalk.gray('   - Generating VS Code Snippets (fetching node types)...'));
                const snippetGen = new SnippetGenerator(client);
                await snippetGen.generate(projectRoot);
                console.log(chalk.green('   ✅ .vscode/n8n.code-snippets created.'));
            }

            console.log(chalk.blueBright('\n✨ AI Context Ready! Your agents are now n8n experts.'));

        } catch (error: any) {
            console.error(chalk.red(`❌ Error during init-ai: ${error.message}`));
            process.exit(1);
        }
    }
}
