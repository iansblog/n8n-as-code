import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DocsProvider } from './docs-provider.js';
import { NodeSchemaProvider } from './node-schema-provider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface UnifiedSearchResult {
    query: string;
    totalResults: number;
    results: Array<{
        type: 'node' | 'documentation' | 'example';
        id: string;
        name?: string;
        title?: string;
        displayName?: string;
        description?: string;
        url?: string;
        excerpt?: string;
        score: number;
        category: string;
        relevance: 'exact_match' | 'related' | 'partial';
    }>;
    suggestions: string[];
    hints: string[];
}

interface KnowledgeIndex {
    entries: {
        documentation: any[];
        nodes: any[];
    };
    indexes: {
        byKeyword: Record<string, any[]>;
    };
}

/**
 * Unified search across nodes and documentation
 */
export class KnowledgeSearch {
    private index: KnowledgeIndex | null = null;
    private indexPath: string;
    private docsProvider: DocsProvider;
    private nodeProvider: NodeSchemaProvider;

    constructor(customIndexPath?: string) {
        if (customIndexPath) {
            this.indexPath = customIndexPath;
        } else {
            this.indexPath = path.resolve(__dirname, '../assets/n8n-knowledge-index.json');
        }
        this.docsProvider = new DocsProvider();
        this.nodeProvider = new NodeSchemaProvider();
    }

    private loadIndex(): void {
        if (this.index) return;

        if (!fs.existsSync(this.indexPath)) {
            throw new Error(`Knowledge index not found at ${this.indexPath}`);
        }

        const content = fs.readFileSync(this.indexPath, 'utf-8');
        this.index = JSON.parse(content);
    }

    /**
     * Unified search across all resources
     */
    searchAll(query: string, options: { category?: string; type?: 'node' | 'documentation'; limit?: number } = {}): UnifiedSearchResult {
        this.loadIndex();
        if (!this.index) {
            return { query, totalResults: 0, results: [], suggestions: [], hints: [] };
        }

        const queryLower = query.toLowerCase();
        const results: UnifiedSearchResult['results'] = [];

        // Search in nodes
        if (!options.type || options.type === 'node') {
            for (const nodeEntry of this.index.entries.nodes) {
                if (options.category && nodeEntry.category !== options.category) continue;

                let score = 0;
                let relevance: 'exact_match' | 'related' | 'partial' = 'partial';

                // Exact name match
                if (nodeEntry.name.toLowerCase() === queryLower || 
                    nodeEntry.displayName.toLowerCase() === queryLower) {
                    score = 10;
                    relevance = 'exact_match';
                }
                // Partial name match
                else if (nodeEntry.name.toLowerCase().includes(queryLower) || 
                         nodeEntry.displayName.toLowerCase().includes(queryLower)) {
                    score = 8;
                    relevance = 'related';
                }
                // Search terms match
                else if (nodeEntry.searchTerms.some((t: string) => t.includes(queryLower))) {
                    score = 5;
                    relevance = 'related';
                }

                if (score > 0) {
                    results.push({
                        type: 'node',
                        id: nodeEntry.name,
                        name: nodeEntry.name,
                        displayName: nodeEntry.displayName,
                        description: nodeEntry.description,
                        score: score + (nodeEntry.score || 0),
                        category: nodeEntry.category,
                        relevance
                    });
                }
            }
        }

        // Search in documentation
        if (!options.type || options.type === 'documentation') {
            for (const docEntry of this.index.entries.documentation) {
                if (options.category && docEntry.category !== options.category) continue;

                let score = 0;
                let relevance: 'exact_match' | 'related' | 'partial' = 'partial';

                // Title match
                if (docEntry.title.toLowerCase() === queryLower) {
                    score = 10;
                    relevance = 'exact_match';
                } else if (docEntry.title.toLowerCase().includes(queryLower)) {
                    score = 7;
                    relevance = 'related';
                }
                // Search terms match
                else if (docEntry.searchTerms.some((t: string) => t.includes(queryLower))) {
                    score = 4;
                    relevance = 'related';
                }

                if (score > 0) {
                    const resultType = (docEntry.category === 'tutorials' || docEntry.category === 'advanced-ai') ? 'example' : 'documentation';
                    
                    results.push({
                        type: resultType,
                        id: docEntry.id,
                        title: docEntry.title,
                        url: docEntry.url,
                        excerpt: docEntry.excerpt,
                        score: score + (docEntry.score || 0),
                        category: docEntry.category,
                        relevance
                    });
                }
            }
        }

        // Sort by score
        results.sort((a, b) => b.score - a.score);

        const limit = options.limit || 10;
        const limitedResults = results.slice(0, limit);

        // Generate suggestions
        const suggestions = this.generateSuggestions(queryLower, results);

        // Generate hints
        const hints = this.generateHints(limitedResults);

        return {
            query,
            totalResults: results.length,
            results: limitedResults,
            suggestions,
            hints
        };
    }

    /**
     * Generate search suggestions
     */
    private generateSuggestions(query: string, results: any[]): string[] {
        const suggestions = new Set<string>();

        // Add related terms from top results
        for (const result of results.slice(0, 5)) {
            if (result.type === 'node') {
                const node = this.index?.entries.nodes.find((n: any) => n.name === result.id);
                if (node && node.searchTerms) {
                    node.searchTerms.slice(0, 3).forEach((t: string) => suggestions.add(t));
                }
            }
        }

        return Array.from(suggestions).slice(0, 5);
    }

    /**
     * Generate helpful hints based on search results
     */
    private generateHints(results: any[]): string[] {
        const hints: string[] = [];

        const hasNodes = results.some(r => r.type === 'node');
        const hasDocs = results.some(r => r.type === 'documentation');
        const hasExamples = results.some(r => r.type === 'example');

        if (hasNodes) {
            hints.push("💡 Use 'get <nodeName>' to see complete documentation and schema for a node");
            hints.push("📋 Use 'schema <nodeName>' for quick parameter reference");
        }

        if (hasDocs) {
            hints.push("📖 Use 'docs <title>' to read the full documentation page");
        }

        if (hasExamples) {
            hints.push("🎯 Use 'examples <query>' to find more workflow examples");
        }

        if (hasNodes && hasDocs) {
            hints.push("🔗 Use 'related <nodeName>' to discover related nodes and documentation");
        }

        return hints;
    }
}
