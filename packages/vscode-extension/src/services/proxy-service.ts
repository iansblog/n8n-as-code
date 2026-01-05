import * as http from 'http';
import httpProxy = require('http-proxy');
import * as vscode from 'vscode';
import { AddressInfo } from 'net';

export class ProxyService {
    private server: http.Server | undefined;
    private proxy: httpProxy | undefined;
    private port: number = 0;
    private target: string = '';
    private outputChannel: vscode.OutputChannel | undefined;

    constructor() { }

    public setOutputChannel(channel: vscode.OutputChannel) {
        this.outputChannel = channel;
    }

    private log(message: string) {
        if (this.outputChannel) {
            this.outputChannel.appendLine(message);
        } else {
            console.log(message);
        }
    }

    public async start(targetUrl: string): Promise<string> {
        if (this.server) {
            if (this.target === targetUrl) {
                return `http://localhost:${this.port}`;
            }
            this.stop();
        }

        // Ensure targetUrl doesn't have trailing slash for consistency
        this.target = targetUrl.endsWith('/') ? targetUrl.slice(0, -1) : targetUrl;

        this.proxy = httpProxy.createProxyServer({
            target: targetUrl,
            changeOrigin: true,
            secure: false,
            cookieDomainRewrite: "", // Rewrite all domains to match localhost
            preserveHeaderKeyCase: true, // Preserve header casing
            autoRewrite: true // Automatically rewrite redirects
        });

        // Strip headers that block iframe embedding and manage cookies
        this.proxy.on('proxyRes', (proxyRes, req, res) => {
            this.log(`[Proxy] ${req.method} ${req.url} -> ${proxyRes.statusCode}`);

            // Remove headers that prevent iframe embedding
            delete proxyRes.headers['x-frame-options'];
            delete proxyRes.headers['content-security-policy'];
            delete proxyRes.headers['content-security-policy-report-only'];

            // Rewrite Location header for redirects
            if (proxyRes.headers['location']) {
                const location = proxyRes.headers['location'];
                const newLocation = location.startsWith(this.target)
                    ? location.replace(this.target, `http://localhost:${this.port}`)
                    : location.startsWith('/')
                        ? `http://localhost:${this.port}${location}`
                        : location;

                this.log(`[Proxy] Redirect: ${location} -> ${newLocation}`);
                proxyRes.headers['location'] = newLocation;
            }

            // CRITICAL: Fix cookies for iframe/webview context
            if (proxyRes.headers['set-cookie']) {
                proxyRes.headers['set-cookie'] = proxyRes.headers['set-cookie'].map(cookie => {
                    this.log(`[Proxy] Set-Cookie: ${cookie}`);

                    // For localhost proxy, we need to:
                    // 1. Remove Domain so cookie applies to localhost
                    // 2. Remove SameSite restrictions entirely (let browser use default Lax)
                    // 3. Remove Secure flag since we're on http://localhost
                    const modified = cookie
                        .replace(/; Secure/gi, '')
                        .replace(/; SameSite=None/gi, '')
                        .replace(/; SameSite=Strict/gi, '')
                        .replace(/; SameSite=Lax/gi, '')
                        .replace(/; Domain=[^;]+/gi, '');

                    return modified;
                });
            }

            // Inject CORS for the webview
            proxyRes.headers['access-control-allow-origin'] = '*';
            proxyRes.headers['access-control-allow-credentials'] = 'true';
        });

        // Handle outgoing requests - spoof headers to look like they come from n8n origin
        this.proxy.on('proxyReq', (proxyReq, req, res) => {
            this.log(`[Proxy] Forwarding: ${req.method} ${req.url}`);

            // Spoof Origin and Referer to satisfy n8n CSRF checks
            proxyReq.setHeader('Origin', this.target);
            proxyReq.setHeader('Referer', this.target + '/');

            // Forward all cookies from the request
            if (req.headers.cookie) {
                this.log(`[Proxy] Sending Cookies: ${req.headers.cookie.substring(0, 30)}...`);
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
                const proxyUrl = `http://localhost:${this.port}`;
                this.log(`🟢 [Proxy] Server started successfully!`);
                this.log(`   Local: ${proxyUrl}`);
                this.log(`   Target: ${this.target}`);
                this.log(`   Ready to proxy n8n requests`);
                resolve(proxyUrl);
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
