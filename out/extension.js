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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const soundManager_1 = require("./soundManager");
const eventListener_1 = require("./eventListener");
const config_1 = require("./config");
let soundManager;
let eventListener;
let statusBarItem;
function activate(context) {
    const outputChannel = vscode.window.createOutputChannel('Dev Chaos Sounds');
    outputChannel.appendLine('Dev Chaos Sounds activating...');
    // Initialize sound manager with cache directory
    const cacheUri = vscode.Uri.joinPath(context.globalStorageUri, 'sound-cache');
    soundManager = new soundManager_1.SoundManager(cacheUri, context.extensionPath, outputChannel);
    // Initialize event listener
    eventListener = new eventListener_1.EventListener(soundManager, config_1.getConfig, outputChannel);
    eventListener.registerAll(context);
    // Register toggle command
    const toggleCmd = vscode.commands.registerCommand('devChaosSounds.toggle', () => {
        const cfg = vscode.workspace.getConfiguration('devChaosSounds');
        const current = cfg.get('enabled', true);
        cfg.update('enabled', !current, vscode.ConfigurationTarget.Global);
        const state = !current ? 'enabled' : 'disabled';
        vscode.window.showInformationMessage(`Dev Chaos Sounds: ${state}`);
        updateStatusBar(!current);
        outputChannel.appendLine(`Toggled: ${state}`);
    });
    // Register test sound command
    const testCmd = vscode.commands.registerCommand('devChaosSounds.testSound', () => {
        const config = (0, config_1.getConfig)();
        const sounds = config.failSounds.length > 0 ? config.failSounds : config.successSounds;
        if (sounds.length === 0) {
            vscode.window.showWarningMessage('Dev Chaos Sounds: No sounds configured to test.');
            return;
        }
        outputChannel.appendLine('Playing test sound...');
        soundManager.playSound(sounds, config.volume);
    });
    // Status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'devChaosSounds.toggle';
    updateStatusBar((0, config_1.getConfig)().enabled);
    statusBarItem.show();
    context.subscriptions.push(toggleCmd, testCmd, statusBarItem, outputChannel);
    outputChannel.appendLine('Dev Chaos Sounds activated.');
}
function updateStatusBar(enabled) {
    statusBarItem.text = enabled ? '$(unmute)' : '$(mute)';
    statusBarItem.tooltip = `Dev Chaos Sounds: ${enabled ? 'ON' : 'OFF'} (click to toggle)`;
}
function deactivate() {
    soundManager?.dispose();
    eventListener?.dispose();
}
//# sourceMappingURL=extension.js.map