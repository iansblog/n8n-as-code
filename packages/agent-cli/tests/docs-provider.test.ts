import { DocsProvider } from '../src/services/docs-provider';
import { describe, it, expect, beforeAll } from '@jest/globals';

describe('DocsProvider', () => {
    let provider: DocsProvider;

    beforeAll(() => {
        provider = new DocsProvider();
    });

    it('should search documentation', () => {
        const results = provider.searchDocs('google sheets', { limit: 5 });
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeGreaterThan(0);
        expect(results[0]).toHaveProperty('title');
        expect(results[0]).toHaveProperty('url');
    });

    it('should get categories', () => {
        const categories = provider.getCategories();
        expect(Array.isArray(categories)).toBe(true);
        expect(categories.length).toBeGreaterThan(0);
        expect(categories[0]).toHaveProperty('name');
        expect(categories[0]).toHaveProperty('description');
    });

    it('should get examples', () => {
        const examples = provider.getExamples('ai', 5);
        expect(Array.isArray(examples)).toBe(true);
    });

    it('should get statistics', () => {
        const stats = provider.getStatistics();
        expect(stats).toHaveProperty('totalPages');
        expect(stats).toHaveProperty('byCategory');
    });
});
