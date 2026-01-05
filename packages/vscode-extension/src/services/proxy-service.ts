import * as http from 'http';
import httpProxy = require('http-proxy');
import * as vscode from 'vscode';
import { AddressInfo } from 'net';

export class ProxyService {
    private server: http.Server | undefined;
    private proxy: httpProxy | undefined;
    private port: number = 0;
    private target: string = '';

    constructor() { }

    public async start(targetUrl: string): Promise<string> {
        if (this.server) {
            if (this.target === targetUrl) {
                return `http://localhost:${this.port}`;
            }
            this.stop();
        }

        this.target = targetUrl;
        this.proxy = httpProxy.createProxyServer({
            target: targetUrl,
            changeOrigin: true,
            secure: false,
            cookieDomainRewrite: "", // Rewrite all domains to match localhost
            preserveHeaderKeyCase: true, // Preserve header casing
            autoRewrite: true // Automatically rewrite redirects
        });

        // Strip headers that block iframe embedding
        this.proxy.on('proxyRes', (proxyRes, req, res) => {
            // Remove headers that prevent iframe embedding
            delete proxyRes.headers['x-frame-options'];
            delete proxyRes.headers['content-security-policy'];
            delete proxyRes.headers['content-security-policy-report-only'];

            // Rewrite Location header for redirects
            if (proxyRes.headers['location']) {
                const location = proxyRes.headers['location'];
                if (location.startsWith(targetUrl)) {
                    proxyRes.headers['location'] = location.replace(targetUrl, `http://localhost:${this.port}`);
                } else if (location.startsWith('/')) {
                    // Relative redirects
                    proxyRes.headers['location'] = `http://localhost:${this.port}${location}`;
                }
            }

            // Rewrite cookies to work with localhost proxy
            if (proxyRes.headers['set-cookie']) {
                proxyRes.headers['set-cookie'] = proxyRes.headers['set-cookie'].map(cookie => {
                    return cookie
                        // Remove Secure flag for http localhost
                        .replace(/; Secure/gi, '')
                        // Make cookies more permissive for iframe context
                        .replace(/; SameSite=Strict/gi, '; SameSite=None')
                        .replace(/; SameSite=Lax/gi, '; SameSite=None')
                        // Remove domain restrictions
                        .replace(/; Domain=[^;]+/gi, '');
                });
            }

            // Add CORS headers to allow webview access
            proxyRes.headers['access-control-allow-origin'] = '*';
            proxyRes.headers['access-control-allow-credentials'] = 'true';
            proxyRes.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS, PATCH';
            proxyRes.headers['access-control-allow-headers'] = '*';
        });

        // Handle CORS preflight requests
        this.proxy.on('proxyReq', (proxyReq, req, res) => {
            // Forward credentials
            if (req.headers.cookie) {
                proxyReq.setHeader('Cookie', req.headers.cookie);
            }
        });

        this.proxy.on('error', (err, req, res) => {
            console.error('Proxy Error:', err);
            const response = res as http.ServerResponse;
            if (!response.headersSent) {
                response.writeHead(500, { 'Content-Type': 'text/plain' });
            }
            response.end('Proxy Error: ' + err.message);
        });

        this.server = http.createServer((req, res) => {
            // Handle CORS preflight
            if (req.method === 'OPTIONS') {
                res.writeHead(200, {
                    'access-control-allow-origin': '*',
                    'access-control-allow-credentials': 'true',
                    'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
                    'access-control-allow-headers': '*'
                });
                res.end();
                return;
            }

            if (this.proxy) {
                this.proxy.web(req, res);
            }
        });

        return new Promise((resolve, reject) => {
            if (!this.server) return reject(new Error('Server not initialized'));

            this.server.listen(0, 'localhost', () => {
                const address = this.server?.address() as AddressInfo;
                this.port = address.port;
                console.log(`n8n Proxy started on port ${this.port} -> ${targetUrl}`);
                resolve(`http://localhost:${this.port}`);
            });

            // Proxy WebSockets for real-time features
            this.server.on('upgrade', (req, socket, head) => {
                if (this.proxy) {
                    this.proxy.ws(req, socket, head);
                }
            });

            this.server.on('error', reject);
        });
    }

    public stop() {
        if (this.server) {
            this.server.close();
            this.server = undefined;
        }
        if (this.proxy) {
            this.proxy.close();
            this.proxy = undefined;
        }
    }

    public getProxyUrl(): string {
        return this.port > 0 ? `http://localhost:${this.port}` : '';
    }
}
