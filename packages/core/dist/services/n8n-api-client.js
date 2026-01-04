"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.N8nApiClient = void 0;
const axios_1 = __importDefault(require("axios"));
class N8nApiClient {
    client;
    constructor(credentials) {
        this.client = axios_1.default.create({
            baseURL: credentials.host,
            headers: {
                'X-N8N-API-KEY': credentials.apiKey,
                'Content-Type': 'application/json'
            }
        });
    }
    async testConnection() {
        try {
            await this.client.get('/api/v1/users'); // Simple endpoint to test auth
            return true;
        }
        catch (error) {
            console.error('Connection test failed:', error);
            return false;
        }
    }
    async getAllWorkflows() {
        try {
            const res = await this.client.get('/api/v1/workflows');
            return res.data.data;
        }
        catch (error) {
            console.error('Failed to get workflows:', error);
            return [];
        }
    }
    async getWorkflow(id) {
        try {
            const res = await this.client.get(`/api/v1/workflows/${id}`);
            return res.data;
        }
        catch (error) {
            // 404 is expected if workflow deleted remotely
            return null;
        }
    }
    async createWorkflow(payload) {
        const res = await this.client.post('/api/v1/workflows', payload);
        return res.data;
    }
    async updateWorkflow(id, payload) {
        const res = await this.client.put(`/api/v1/workflows/${id}`, payload);
        return res.data;
    }
    async activateWorkflow(id, active) {
        try {
            await this.client.post(`/api/v1/workflows/${id}/activate`, { active });
            return true;
        }
        catch (error) {
            return false;
        }
    }
}
exports.N8nApiClient = N8nApiClient;
//# sourceMappingURL=n8n-api-client.js.map