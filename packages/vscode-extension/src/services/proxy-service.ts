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
            cookieDomainRewrite: "" // Rewrite all domains to match localhost
        });

        // Strip headers that block iframe embedding
        this.proxy.on('proxyRes', (proxyRes, req, res) => {
            delete proxyRes.headers['x-frame-options'];
            delete proxyRes.headers['content-security-policy'];

            // 1. Rewrite Location header for redirects
            if (proxyRes.headers['location']) {
                const location = proxyRes.headers['location'];
                if (location.startsWith(targetUrl)) {
                    proxyRes.headers['location'] = location.replace(targetUrl, `http://localhost:${this.port}`);
                }
            }

            // 2. Rewrite Cookies (Secure/SameSite adjustment)
            if (proxyRes.headers['set-cookie']) {
                proxyRes.headers['set-cookie'] = proxyRes.headers['set-cookie'].map(cookie => {
                    // Remove Secure to allow on http localhost (some browsers strict)
                    // Remove SameSite=Strict/Lax to allow iframe usage if cross-origin context were an issue (though here it's top-level webview)
                    // But mostly just stripping Domain (handled by cookieDomainRewrite) and Secure usually fixes it.
                    return cookie
                        .replace(/; Secure/gi, '')
                        .replace(/; SameSite=Strict/gi, '; SameSite=Lax') // Lax is usually safer/better for nav
                        .replace(/; Domain=[^;]+/gi, ''); // Double ensure domain is gone
                });
            }
        });

        this.proxy.on('error', (err, req, res) => {
            console.error('Proxy Error:', err);
            // Type assertion as http-proxy types can be generic
            const response = res as http.ServerResponse;
            if (!response.headersSent) {
                response.writeHead(500, { 'Content-Type': 'text/plain' });
            }
            response.end('Proxy Error: ' + err.message);
        });

        this.server = http.createServer((req, res) => {
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

            // Proxy WebSockets
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
}
