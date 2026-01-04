import 'dotenv/config';
import { N8nApiClient, IN8nCredentials } from '@n8n-as-code/core';
import chalk from 'chalk';

export class BaseCommand {
    protected client: N8nApiClient;
    protected config: any;

    constructor() {
        const credentials: IN8nCredentials = {
            host: process.env.N8N_HOST || '',
            apiKey: process.env.N8N_API_KEY || ''
        };

        if (!credentials.host || !credentials.apiKey) {
            console.error(chalk.red('❌ Missing environment variables: N8N_HOST or N8N_API_KEY'));
            console.error(chalk.yellow('Please check your .env file.'));
            process.exit(1);
        }

        this.client = new N8nApiClient(credentials);

        // Basic config defaults
        this.config = {
            directory: './workflows',
            pollInterval: 3000,
            syncInactive: true,
            ignoredTags: ['archive']
        };
    }
}
