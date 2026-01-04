"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseCommand = void 0;
require("dotenv/config");
const core_1 = require("@n8n-as-code/core");
const chalk_1 = __importDefault(require("chalk"));
class BaseCommand {
    client;
    config;
    constructor() {
        const credentials = {
            host: process.env.N8N_HOST || '',
            apiKey: process.env.N8N_API_KEY || ''
        };
        if (!credentials.host || !credentials.apiKey) {
            console.error(chalk_1.default.red('❌ Missing environment variables: N8N_HOST or N8N_API_KEY'));
            console.error(chalk_1.default.yellow('Please check your .env file.'));
            process.exit(1);
        }
        this.client = new core_1.N8nApiClient(credentials);
        // Basic config defaults
        this.config = {
            directory: './workflows',
            pollInterval: 3000,
            syncInactive: true,
            ignoredTags: ['archive']
        };
    }
}
exports.BaseCommand = BaseCommand;
//# sourceMappingURL=base.js.map