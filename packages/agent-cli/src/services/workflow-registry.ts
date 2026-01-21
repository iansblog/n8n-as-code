import { Index } from 'flexsearch';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { readFileSync, existsSync } from 'fs';

// Helper to get __dirname in ESM and CJS (bundled)
const _filename = typeof __filename !== 'undefined'
    ? __filename
    : (typeof import.meta !== 'undefined' && import.meta.url ? fileURLToPath(import.meta.url) : '');

const _dirname = typeof __dirname !== 'undefined'
    ? __dirname
    : (_filename ? dirname(_filename) : '');

export interface WorkflowMetadata {
    id: number | string;
    slug: string;
    name: string;
    tags: string[];
    author: string;
    createdAt: string | null;
    description: string | null;
    hasWorkflow: boolean;
}

interface WorkflowIndex {
    generatedAt: string;
    repository: string;
    totalWorkflows: number;
    workflows: WorkflowMetadata[];
}

export class WorkflowRegistry {
    private index: WorkflowIndex;
    private searchIndex: Index;
    private workflowsById: Map<string | number, WorkflowMetadata>;

    constructor(customIndexPath?: string) {
        // Load the index
        let indexPath: string;
        const envAssetsDir = process.env.N8N_AS_CODE_ASSETS_DIR;

        if (customIndexPath) {
            indexPath = customIndexPath;
        } else if (envAssetsDir) {
            indexPath = join(envAssetsDir, 'workflows-index.json');
        } else {
            // Fallback to relative path
            const siblingPath = resolve(_dirname, '../data/workflows-index.json');
            if (existsSync(siblingPath)) {
                indexPath = siblingPath;
            } else {
                indexPath = resolve(_dirname, '../../data/workflows-index.json');
            }
        }

        if (!existsSync(indexPath)) {
            // If still not found and we are in a bundled environment, try assets dir as fallback
            const fallbackPath = envAssetsDir
                ? join(envAssetsDir, 'workflows-index.json')
                : resolve(_dirname, '../assets/workflows-index.json');
            
            if (existsSync(fallbackPath)) {
                indexPath = fallbackPath;
            } else {
                // Return empty index if not found to prevent crash, but log error
                console.error(`Workflow index not found at ${indexPath}. AI workflow search will be disabled.`);
                this.index = {
                    generatedAt: new Date().toISOString(),
                    repository: '',
                    totalWorkflows: 0,
                    workflows: []
                };
                this.workflowsById = new Map();
                this.searchIndex = new Index({
                    tokenize: 'forward',
                    resolution: 9,
                    cache: true,
                });
                return;
            }
        }

        const raw = readFileSync(indexPath, 'utf-8');
        this.index = JSON.parse(raw);

        // Build lookup map
        this.workflowsById = new Map();
        for (const workflow of this.index.workflows) {
            this.workflowsById.set(workflow.id, workflow);
        }

        // Initialize FlexSearch
        this.searchIndex = new Index({
            tokenize: 'forward',
            resolution: 9,
            cache: true,
        });

        // Index all workflows
        for (const workflow of this.index.workflows) {
            const searchableText = [
                workflow.name,
                workflow.description || '',
                ...workflow.tags,
                workflow.author,
            ].join(' ');

            this.searchIndex.add(workflow.id, searchableText);
        }
    }

    /**
     * Search workflows using FlexSearch
     */
    search(query: string, limit: number = 10): WorkflowMetadata[] {
        const results = this.searchIndex.search(query, { limit }) as Array<string | number>;

        return results
            .map((id: string | number) => this.workflowsById.get(id))
            .filter((w): w is WorkflowMetadata => w !== undefined);
    }

    /**
     * Get workflow by ID
     */
    getById(id: string | number): WorkflowMetadata | undefined {
        // Try numeric conversion if string
        const numericId = typeof id === 'string' ? parseInt(id, 10) : id;

        return this.workflowsById.get(id) || this.workflowsById.get(numericId);
    }

    /**
     * Get all workflows
     */
    getAll(): WorkflowMetadata[] {
        return this.index.workflows;
    }

    /**
     * Generate the raw GitHub URL for a workflow
     */
    getRawUrl(workflow: WorkflowMetadata, branch: string = 'main'): string {
        const baseUrl = 'https://raw.githubusercontent.com/nusquama/n8nworkflows.xyz';
        return `${baseUrl}/${branch}/workflows/${workflow.slug}/workflow.json`;
    }

    /**
     * Get index metadata
     */
    getMetadata() {
        return {
            generatedAt: this.index.generatedAt,
            repository: this.index.repository,
            totalWorkflows: this.index.totalWorkflows,
        };
    }
}
