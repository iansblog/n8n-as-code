#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const watch_js_1 = require("./commands/watch.js");
const sync_js_1 = require("./commands/sync.js");
const program = new commander_1.Command();
program
    .name('n8n-sync')
    .description('CLI to synchronize n8n workflows with local files')
    .version('1.0.0');
program.command('watch')
    .description('Start bi-directional synchronization in real-time')
    .action(async () => {
    await new watch_js_1.WatchCommand().run();
});
program.command('pull')
    .description('Download all workflows from n8n to local directory')
    .action(async () => {
    await new sync_js_1.SyncCommand().pull();
});
program.command('push')
    .description('Upload missing local workflows to n8n')
    .action(async () => {
    await new sync_js_1.SyncCommand().push();
});
program.parse();
//# sourceMappingURL=index.js.map