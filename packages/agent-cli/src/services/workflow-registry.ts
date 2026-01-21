import { Index } from 'flexsearch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

    constructor() {
        // Load the index
        const indexPath = join(__dirname, '../data/workflows-index.json');
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
