import axios, { AxiosInstance } from 'axios';
import { IN8nCredentials, IWorkflow } from '../types.js';

export class N8nApiClient {
    private client: AxiosInstance;

    constructor(credentials: IN8nCredentials) {
        this.client = axios.create({
            baseURL: credentials.host,
            headers: {
                'X-N8N-API-KEY': credentials.apiKey,
                'Content-Type': 'application/json'
            }
        });
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.client.get('/api/v1/users'); // Simple endpoint to test auth
            return true;
        } catch (error) {
            console.error('Connection test failed:', error);
            return false;
        }
    }

    async getAllWorkflows(): Promise<IWorkflow[]> {
        try {
            const res = await this.client.get('/api/v1/workflows');
            return res.data.data;
        } catch (error) {
            console.error('Failed to get workflows:', error);
            return [];
        }
    }

    async getWorkflow(id: string): Promise<IWorkflow | null> {
        try {
            const res = await this.client.get(`/api/v1/workflows/${id}`);
            return res.data;
        } catch (error) {
            // 404 is expected if workflow deleted remotely
            return null;
        }
    }

    async createWorkflow(payload: Partial<IWorkflow>): Promise<IWorkflow> {
        const res = await this.client.post('/api/v1/workflows', payload);
        return res.data;
    }

    async updateWorkflow(id: string, payload: Partial<IWorkflow>): Promise<IWorkflow> {
        const res = await this.client.put(`/api/v1/workflows/${id}`, payload);
        return res.data;
    }

    async activateWorkflow(id: string, active: boolean): Promise<boolean> {
        try {
            await this.client.post(`/api/v1/workflows/${id}/activate`, { active });
            return true;
        } catch (error) {
            return false;
        }
    }
}
