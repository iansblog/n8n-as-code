"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WatchCommand = void 0;
const base_js_1 = require("./base.js");
const core_1 = require("@n8n-as-code/core");
const chokidar_1 = __importDefault(require("chokidar"));
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
class WatchCommand extends base_js_1.BaseCommand {
    async run() {
        console.log(chalk_1.default.blue('🚀 Starting n8n-as-code Watcher...'));
        const syncManager = new core_1.SyncManager(this.client, {
            directory: this.config.directory,
            pollIntervalMs: this.config.pollInterval,
            syncInactive: this.config.syncInactive,
            ignoredTags: this.config.ignoredTags
        });
        const spinner = (0, ora_1.default)('Initializing...').start();
        // Connect logs
        syncManager.on('log', (msg) => {
            if (msg.includes('Error')) {
                spinner.fail(msg);
            }
            else if (msg.includes('✅') || msg.includes('✨') || msg.includes('Updated')) {
                spinner.succeed(msg);
                spinner.start('Watching...');
            }
            else {
                // spinner.info(msg); // Too verbose?
                // Just keep spinner spinning or log info if important
                if (msg.includes('Starting') || msg.includes('Checking')) {
                    spinner.text = msg;
                }
            }
        });
        syncManager.on('error', (err) => {
            spinner.fail(chalk_1.default.red(err));
            spinner.start('Watching...');
        });
        // 1. Initial Sync
        try {
            await syncManager.syncDown();
            await syncManager.syncUpMissing();
            spinner.succeed('Initial sync complete.');
        }
        catch (e) {
            spinner.fail(`Initial sync failed: ${e.message}`);
        }
        // 2. Start Watcher
        console.log(chalk_1.default.cyan(`👀 Watching directory: ${this.config.directory}`));
        const watcher = chokidar_1.default.watch(this.config.directory, {
            ignored: /(^|[\/\\])\../,
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 }
        });
        watcher
            .on('change', (p) => syncManager.handleLocalFileChange(p))
            .on('add', (p) => syncManager.handleLocalFileChange(p));
        // 3. Polling Loop
        setInterval(async () => {
            await syncManager.syncDown();
        }, this.config.pollInterval);
    }
}
exports.WatchCommand = WatchCommand;
//# sourceMappingURL=watch.js.map