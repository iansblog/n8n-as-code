import { IN8nCredentials, IWorkflow } from '../types.js';
export declare class N8nApiClient {
    private client;
    constructor(credentials: IN8nCredentials);
    testConnection(): Promise<boolean>;
    getAllWorkflows(): Promise<IWorkflow[]>;
    getWorkflow(id: string): Promise<IWorkflow | null>;
    createWorkflow(payload: Partial<IWorkflow>): Promise<IWorkflow>;
    updateWorkflow(id: string, payload: Partial<IWorkflow>): Promise<IWorkflow>;
    activateWorkflow(id: string, active: boolean): Promise<boolean>;
}
//# sourceMappingURL=n8n-api-client.d.ts.map