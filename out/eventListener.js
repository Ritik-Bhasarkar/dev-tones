"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventListener = void 0;
const vscode = __importStar(require("vscode"));
const TEST_FAIL_PATTERNS = /test failed|FAIL|\u2717|failing/i;
const TEST_PASS_PATTERNS = /test passed|tests passed|\u2713 all|passing/i;
const CRASH_PATTERNS = /ECONNREFUSED|SIGKILL|crashed|exited with code [1-9]/i;
class EventListener {
    constructor(soundManager, getConfig, outputChannel) {
        this.disposables = [];
        this.lastSoundTime = 0;
        this.previousErrorCount = 0;
        this.soundManager = soundManager;
        this.getConfig = getConfig;
        this.outputChannel = outputChannel;
    }
    registerAll(context) {
        this.outputChannel.appendLine('[EventListener] Registering all listeners...');
        // Task completion events
        const taskDisposable = vscode.tasks.onDidEndTaskProcess((e) => {
            this.outputChannel.appendLine(`[EventListener] Task ended: "${e.execution.task.name}" exitCode=${e.exitCode}`);
            const config = this.getConfig();
            if (!config.enabled) {
                return;
            }
            if (e.exitCode === 0) {
                this.playCooldown(config.successSounds, config);
            }
            else {
                this.playCooldown(config.failSounds, config);
            }
        });
        this.disposables.push(taskDisposable);
        // Terminal data events for test and crash detection
        // onDidWriteTerminalData is a proposed API — access via runtime check
        const windowAny = vscode.window;
        if (typeof windowAny.onDidWriteTerminalData === 'function') {
            this.outputChannel.appendLine('[EventListener] onDidWriteTerminalData available — registering');
            const terminalDisposable = windowAny.onDidWriteTerminalData((e) => {
                const config = this.getConfig();
                if (!config.enabled) {
                    return;
                }
                const data = e.data;
                if (TEST_FAIL_PATTERNS.test(data)) {
                    this.outputChannel.appendLine('[EventListener] Terminal output matched test FAIL pattern');
                    this.playCooldown(config.testFailSounds, config);
                }
                else if (TEST_PASS_PATTERNS.test(data)) {
                    this.outputChannel.appendLine('[EventListener] Terminal output matched test PASS pattern');
                    this.playCooldown(config.testSuccessSounds, config);
                }
                if (CRASH_PATTERNS.test(data)) {
                    this.outputChannel.appendLine('[EventListener] Terminal output matched CRASH pattern');
                    this.playCooldown(config.serverCrashSounds, config);
                }
            });
            this.disposables.push(terminalDisposable);
        }
        else {
            this.outputChannel.appendLine('[EventListener] onDidWriteTerminalData NOT available');
        }
        // Terminal shell execution events — catches npm run dev, build, etc.
        if (typeof vscode.window.onDidEndTerminalShellExecution === 'function') {
            this.outputChannel.appendLine('[EventListener] onDidEndTerminalShellExecution available — registering');
            const shellExecDisposable = vscode.window.onDidEndTerminalShellExecution((e) => {
                this.outputChannel.appendLine(`[EventListener] Shell execution ended: exitCode=${e.exitCode}`);
                const config = this.getConfig();
                if (!config.enabled) {
                    return;
                }
                if (e.exitCode !== undefined && e.exitCode !== 0) {
                    this.playCooldown(config.failSounds, config);
                }
                else if (e.exitCode === 0) {
                    this.playCooldown(config.successSounds, config);
                }
            });
            this.disposables.push(shellExecDisposable);
        }
        else {
            this.outputChannel.appendLine('[EventListener] onDidEndTerminalShellExecution NOT available');
        }
        // Terminal close events for crash detection
        const termCloseDisposable = vscode.window.onDidCloseTerminal((terminal) => {
            this.outputChannel.appendLine(`[EventListener] Terminal closed: exitCode=${terminal.exitStatus?.code}`);
            const config = this.getConfig();
            if (!config.enabled) {
                return;
            }
            if (terminal.exitStatus && terminal.exitStatus.code !== undefined && terminal.exitStatus.code !== 0) {
                this.playCooldown(config.serverCrashSounds, config);
            }
        });
        this.disposables.push(termCloseDisposable);
        // Diagnostics change events for lint errors
        const diagDisposable = vscode.languages.onDidChangeDiagnostics((e) => {
            const config = this.getConfig();
            if (!config.enabled) {
                return;
            }
            let totalErrors = 0;
            for (const uri of e.uris) {
                const diags = vscode.languages.getDiagnostics(uri);
                totalErrors += diags.filter(d => d.severity === vscode.DiagnosticSeverity.Error).length;
            }
            if (totalErrors > this.previousErrorCount) {
                this.outputChannel.appendLine(`[EventListener] New lint errors detected: ${totalErrors} (was ${this.previousErrorCount})`);
                this.playCooldown(config.lintErrorSounds, config);
            }
            this.previousErrorCount = totalErrors;
        });
        this.disposables.push(diagDisposable);
        this.outputChannel.appendLine('[EventListener] All listeners registered.');
        context.subscriptions.push(...this.disposables);
    }
    playCooldown(sounds, config) {
        if (sounds.length === 0) {
            return;
        }
        const now = Date.now();
        if (now - this.lastSoundTime < config.cooldownMs) {
            this.outputChannel.appendLine('[EventListener] Cooldown active, skipping sound');
            return;
        }
        this.lastSoundTime = now;
        this.soundManager.playSound(sounds, config.volume);
    }
    dispose() {
        for (const d of this.disposables) {
            d.dispose();
        }
        this.disposables = [];
    }
}
exports.EventListener = EventListener;
//# sourceMappingURL=eventListener.js.map