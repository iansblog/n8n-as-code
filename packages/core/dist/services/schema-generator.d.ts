import { N8nApiClient } from './n8n-api-client.js';
export declare class SchemaGenerator {
    private client;
    constructor(client: N8nApiClient);
    /**
     * Fetches node types from n8n and generates a standard JSON Schema.
     * This schema can be used by AI agents to validate node parameters.
     */
    generateSchema(outputPath: string): Promise<void>;
}
//# sourceMappingURL=schema-generator.d.ts.map