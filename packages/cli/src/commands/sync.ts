import { BaseCommand } from './base.js';
import { SyncManager } from '@n8n-as-code/core';
import chalk from 'chalk';
import ora from 'ora';

export class SyncCommand extends BaseCommand {
    async pull() {
        const spinner = ora('Pulling workflows from n8n...').start();
        try {
            const syncManager = new SyncManager(this.client, {
                directory: this.config.directory,
                pollIntervalMs: 0, // Not used for one-off
                syncInactive: this.config.syncInactive,
                ignoredTags: this.config.ignoredTags
            });

            syncManager.on('log', (msg) => {
                if (msg.includes('Updated') || msg.includes('New')) spinner.info(msg);
            });

            await syncManager.syncDown();
            spinner.succeed('Pull complete.');
        } catch (e: any) {
            spinner.fail(`Pull failed: ${e.message}`);
            process.exit(1);
        }
    }

    async push() {
        const spinner = ora('Pushing new local workflows to n8n...').start();
        try {
            const syncManager = new SyncManager(this.client, {
                directory: this.config.directory,
                pollIntervalMs: 0,
                syncInactive: this.config.syncInactive,
                ignoredTags: this.config.ignoredTags
            });

            syncManager.on('log', (msg) => {
                if (msg.includes('Created') || msg.includes('Update')) spinner.info(msg);
            });

            // Prevent creation of duplicates by loading remote state first
            await syncManager.loadRemoteState();
            await syncManager.syncUpMissing();

            spinner.succeed('Push complete.');
        } catch (e: any) {
            spinner.fail(`Push failed: ${e.message}`);
            process.exit(1);
        }
    }
}
