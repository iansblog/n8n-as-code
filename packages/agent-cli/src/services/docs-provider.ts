import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface DocPage {
    id: string;
    title: string;
    url: string;
    urlPath: string;
    category: string;
    subcategory: string | null;
    nodeName: string | null;
    nodeType: string | null;
    content: {
        markdown: string;
        excerpt: string;
        sections: Array<{
            title: string;
            level: number;
            content: string;
        }>;
    };
    metadata: {
        keywords: string[];
        useCases: string[];
        operations: string[];
        codeExamples: number;
        complexity: string;
        readingTime: string;
        contentLength: number;
        relatedPages?: Array<{
            id: string;
            title: string;
            category: string;
        }>;
    };
}

export interface DocsComplete {
    generatedAt: string;
    version: string;
    sourceUrl: string;
    totalPages: number;
    statistics: {
        byCategory: Record<string, number>;
        withNodeNames: number;
        withUseCases: number;
        withCodeExamples: number;
    };
    categories: Record<string, {
        description: string;
        totalPages: number;
        pages: string[];
    }>;
    pages: DocPage[];
    searchIndex: {
        byKeyword: Record<string, string[]>;
        byCategory: Record<string, string[]>;
        byNodeName: Record<string, string[]>;
    };
}

export interface SearchDocsOptions {
    category?: string;
    complexity?: 'beginner' | 'intermediate' | 'advanced';
    hasCodeExamples?: boolean;
    limit?: number;
}

/**
 * Provider for accessing n8n documentation
 */
export class DocsProvider {
    private docs: DocsComplete | null = null;
    private docsPath: string;

    constructor(customDocsPath?: string) {
        if (customDocsPath) {
            this.docsPath = customDocsPath;
        } else {
            this.docsPath = path.resolve(__dirname, '../assets/n8n-docs-complete.json');
        }
    }

    /**
     * Load documentation
     */
    private loadDocs(): void {
        if (this.docs) return;

        if (!fs.existsSync(this.docsPath)) {
            throw new Error(
                `Documentation not found at ${this.docsPath}. ` +
                `Please run the build process: npm run build in packages/agent-cli`
            );
        }

        try {
            const content = fs.readFileSync(this.docsPath, 'utf-8');
            this.docs = JSON.parse(content);
        } catch (error: any) {
            throw new Error(
                `Failed to load documentation: ${error.message}. ` +
                `The file may be corrupted. Try rebuilding: npm run build in packages/agent-cli`
            );
        }
    }

    /**
     * Search documentation pages
     */
    searchDocs(query: string, options: SearchDocsOptions = {}): DocPage[] {
        this.loadDocs();
        if (!this.docs) return [];

        const queryLower = query.toLowerCase();
        const results: Array<{ page: DocPage; score: number }> = [];

        for (const page of this.docs.pages) {
            // Apply filters
            if (options.category && page.category !== options.category) continue;
            if (options.complexity && page.metadata.complexity !== options.complexity) continue;
            if (options.hasCodeExamples && page.metadata.codeExamples === 0) continue;

            // Calculate score
            let score = 0;

            // Title match (highest priority)
            if (page.title.toLowerCase().includes(queryLower)) {
                score += 10;
            }

            // Keywords match
            const matchingKeywords = page.metadata.keywords.filter(k => 
                k.toLowerCase().includes(queryLower) || queryLower.includes(k.toLowerCase())
            );
            score += matchingKeywords.length * 3;

            // Content match
            if (page.content.markdown.toLowerCase().includes(queryLower)) {
                score += 2;
            }

            // Use cases match
            const matchingUseCases = page.metadata.useCases.filter(uc => 
                uc.toLowerCase().includes(queryLower)
            );
            score += matchingUseCases.length * 2;

            if (score > 0) {
                results.push({ page, score });
            }
        }

        // Sort by score
        results.sort((a, b) => b.score - a.score);

        const limit = options.limit || 10;
        return results.slice(0, limit).map(r => r.page);
    }

    /**
     * Get documentation page by ID
     */
    getDocPage(pageId: string): DocPage | null {
        this.loadDocs();
        if (!this.docs) return null;

        return this.docs.pages.find(p => p.id === pageId) || null;
    }

    /**
     * Get documentation page by title
     */
    getDocPageByTitle(title: string): DocPage | null {
        this.loadDocs();
        if (!this.docs) return null;

        const titleLower = title.toLowerCase();
        return this.docs.pages.find(p => 
            p.title.toLowerCase() === titleLower
        ) || null;
    }

    /**
     * List pages by category
     */
    listByCategory(category: string): DocPage[] {
        this.loadDocs();
        if (!this.docs) return [];

        return this.docs.pages.filter(p => p.category === category);
    }

    /**
     * Get all categories
     */
    getCategories(): Array<{ name: string; description: string; count: number }> {
        this.loadDocs();
        if (!this.docs) return [];

        return Object.entries(this.docs.categories).map(([name, data]) => ({
            name,
            description: data.description,
            count: data.totalPages
        }));
    }

    /**
     * Find related pages
     */
    findRelated(pageId: string, limit: number = 5): DocPage[] {
        this.loadDocs();
        if (!this.docs) return [];

        const page = this.getDocPage(pageId);
        if (!page || !page.metadata.relatedPages) return [];

        const related: DocPage[] = [];
        for (const relatedRef of page.metadata.relatedPages) {
            const relatedPage = this.getDocPage(relatedRef.id);
            if (relatedPage) {
                related.push(relatedPage);
            }
            if (related.length >= limit) break;
        }

        return related;
    }

    /**
     * Search by keywords
     */
    searchByKeywords(keywords: string[]): DocPage[] {
        this.loadDocs();
        if (!this.docs) return [];

        const results: Map<string, number> = new Map();

        for (const keyword of keywords) {
            const keywordLower = keyword.toLowerCase();
            
            for (const page of this.docs.pages) {
                if (page.metadata.keywords.some(k => k.toLowerCase() === keywordLower)) {
                    const current = results.get(page.id) || 0;
                    results.set(page.id, current + 1);
                }
            }
        }

        // Sort by match count
        const sorted = Array.from(results.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([pageId]) => this.getDocPage(pageId))
            .filter((p): p is DocPage => p !== null);

        return sorted;
    }

    /**
     * Get documentation for a specific node
     */
    getNodeDocumentation(nodeName: string): DocPage[] {
        this.loadDocs();
        if (!this.docs) return [];

        return this.docs.pages.filter(p => 
            p.nodeName?.toLowerCase() === nodeName.toLowerCase()
        );
    }

    /**
     * Get examples (tutorials/advanced-ai pages)
     */
    getExamples(query?: string, limit: number = 10): DocPage[] {
        this.loadDocs();
        if (!this.docs) return [];

        let examples = this.docs.pages.filter(p => 
            p.category === 'tutorials' || 
            p.category === 'advanced-ai' ||
            p.subcategory === 'examples'
        );

        if (query) {
            const queryLower = query.toLowerCase();
            examples = examples.filter(p => 
                p.title.toLowerCase().includes(queryLower) ||
                p.metadata.keywords.some(k => k.toLowerCase().includes(queryLower)) ||
                p.metadata.useCases.some(uc => uc.toLowerCase().includes(queryLower))
            );
        }

        return examples.slice(0, limit);
    }

    /**
     * Get statistics
     */
    getStatistics() {
        this.loadDocs();
        if (!this.docs) return null;

        return {
            totalPages: this.docs.totalPages,
            byCategory: this.docs.statistics.byCategory,
            withNodeNames: this.docs.statistics.withNodeNames,
            withUseCases: this.docs.statistics.withUseCases,
            withCodeExamples: this.docs.statistics.withCodeExamples
        };
    }
}
