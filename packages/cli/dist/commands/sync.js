"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncCommand = void 0;
const base_js_1 = require("./base.js");
const core_1 = require("@n8n-as-code/core");
const ora_1 = __importDefault(require("ora"));
class SyncCommand extends base_js_1.BaseCommand {
    async pull() {
        const spinner = (0, ora_1.default)('Pulling workflows from n8n...').start();
        try {
            const syncManager = new core_1.SyncManager(this.client, {
                directory: this.config.directory,
                pollIntervalMs: 0, // Not used for one-off
                syncInactive: this.config.syncInactive,
                ignoredTags: this.config.ignoredTags
            });
            syncManager.on('log', (msg) => {
                if (msg.includes('Updated') || msg.includes('New'))
                    spinner.info(msg);
            });
            await syncManager.syncDown();
            spinner.succeed('Pull complete.');
        }
        catch (e) {
            spinner.fail(`Pull failed: ${e.message}`);
            process.exit(1);
        }
    }
    async push() {
        const spinner = (0, ora_1.default)('Pushing new local workflows to n8n...').start();
        try {
            const syncManager = new core_1.SyncManager(this.client, {
                directory: this.config.directory,
                pollIntervalMs: 0,
                syncInactive: this.config.syncInactive,
                ignoredTags: this.config.ignoredTags
            });
            syncManager.on('log', (msg) => {
                if (msg.includes('Created') || msg.includes('Update'))
                    spinner.info(msg);
            });
            // Note: Currently syncUpMissing() only handles CREATION of orphans.
            // Full Push (forcing local state to remote) would require more logic in Core if needed.
            // For now, we assume "Push" means "Upload what's missing".
            await syncManager.syncUpMissing();
            spinner.succeed('Push complete.');
        }
        catch (e) {
            spinner.fail(`Push failed: ${e.message}`);
            process.exit(1);
        }
    }
}
exports.SyncCommand = SyncCommand;
//# sourceMappingURL=sync.js.map