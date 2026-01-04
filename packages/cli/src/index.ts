#!/usr/bin/env node
import { Command } from 'commander';
import { WatchCommand } from './commands/watch.js';
import { SyncCommand } from './commands/sync.js';
import { InitAiCommand } from './commands/init-ai.js';
import chalk from 'chalk';

const program = new Command();

program
    .name('n8n-sync')
    .description('CLI to synchronize n8n workflows with local files')
    .version('1.0.0');

program.command('watch')
    .description('Start bi-directional synchronization in real-time')
    .action(async () => {
        await new WatchCommand().run();
    });

program.command('pull')
    .description('Download all workflows from n8n to local directory')
    .action(async () => {
        await new SyncCommand().pull();
    });

program.command('push')
    .description('Upload missing local workflows to n8n')
    .action(async () => {
        await new SyncCommand().push();
    });

new InitAiCommand(program);

program.parse();
