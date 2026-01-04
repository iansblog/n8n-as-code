import { IWorkflow } from '../types.js';
export declare class WorkflowSanitizer {
    /**
     * Prepares a workflow JSON for storage on disk (GIT).
     * Removes dynamic IDs, execution URLs, and standardizes key order.
     */
    static cleanForStorage(workflow: IWorkflow): Partial<IWorkflow>;
    /**
     * Prepares a local workflow JSON for pushing to n8n API.
     * Removes read-only fields or fields that shouldn't be overwritten blindly (like tags if needed).
     */
    static cleanForPush(workflow: Partial<IWorkflow>): Partial<IWorkflow>;
}
//# sourceMappingURL=workflow-sanitizer.d.ts.map