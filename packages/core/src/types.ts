export interface IN8nCredentials {
    host: string;
    apiKey: string;
}

export interface IWorkflow {
    id: string;
    name: string;
    active: boolean;
    nodes: any[];
    connections: any;
    settings?: any;
    tags?: ITag[];
    updatedAt?: string;
    createdAt?: string;
}

export interface ITag {
    id: string;
    name: string;
}

export interface ISyncConfig {
    directory: string;
    pollIntervalMs: number;
    syncInactive: boolean;
    ignoredTags: string[];
}
