"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowSanitizer = void 0;
class WorkflowSanitizer {
    /**
     * Prepares a workflow JSON for storage on disk (GIT).
     * Removes dynamic IDs, execution URLs, and standardizes key order.
     */
    static cleanForStorage(workflow) {
        const settings = { ...(workflow.settings || {}) };
        // Remove instance-specific settings
        const keysToRemove = [
            'executionUrl',
            'availableInMCP',
            'callerPolicy',
            'saveDataErrorExecution',
            'saveManualExecutions',
            'saveExecutionProgress',
            'executionOrder'
        ];
        keysToRemove.forEach(k => delete settings[k]);
        return {
            name: workflow.name,
            nodes: workflow.nodes || [],
            connections: workflow.connections || {},
            settings: settings,
            tags: workflow.tags || [],
            active: workflow.active
        };
    }
    /**
     * Prepares a local workflow JSON for pushing to n8n API.
     * Removes read-only fields or fields that shouldn't be overwritten blindly (like tags if needed).
     */
    static cleanForPush(workflow) {
        const clean = this.cleanForStorage(workflow);
        // When pushing, we might not want to force-overwrite active state if handled separately,
        // but for now we follow the simple sync logic.
        // removing active state from payload might be safer effectively? 
        // Sync.js logic: delete clean.active; delete clean.tags;
        delete clean.active;
        delete clean.tags;
        return clean;
    }
}
exports.WorkflowSanitizer = WorkflowSanitizer;
//# sourceMappingURL=workflow-sanitizer.js.map