import * as vscode from 'vscode';
import { SoundManager } from './soundManager';
import { EventListener } from './eventListener';
import { getConfig } from './config';

let soundManager: SoundManager;
let eventListener: EventListener;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel('Dev Chaos Sounds');
  outputChannel.appendLine('Dev Chaos Sounds activating...');

  // Initialize sound manager with cache directory
  const cacheUri = vscode.Uri.joinPath(context.globalStorageUri, 'sound-cache');
  soundManager = new SoundManager(cacheUri, context.extensionPath, outputChannel);

  // Initialize event listener
  eventListener = new EventListener(soundManager, getConfig, outputChannel);
  eventListener.registerAll(context);

  // Register toggle command
  const toggleCmd = vscode.commands.registerCommand('devChaosSounds.toggle', () => {
    const cfg = vscode.workspace.getConfiguration('devChaosSounds');
    const current = cfg.get<boolean>('enabled', true);
    cfg.update('enabled', !current, vscode.ConfigurationTarget.Global);
    const state = !current ? 'enabled' : 'disabled';
    vscode.window.showInformationMessage(`Dev Chaos Sounds: ${state}`);
    updateStatusBar(!current);
    outputChannel.appendLine(`Toggled: ${state}`);
  });

  // Register test sound command
  const testCmd = vscode.commands.registerCommand('devChaosSounds.testSound', () => {
    const config = getConfig();
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
  updateStatusBar(getConfig().enabled);
  statusBarItem.show();

  context.subscriptions.push(toggleCmd, testCmd, statusBarItem, outputChannel);
  outputChannel.appendLine('Dev Chaos Sounds activated.');
}

function updateStatusBar(enabled: boolean): void {
  statusBarItem.text = enabled ? '$(unmute)' : '$(mute)';
  statusBarItem.tooltip = `Dev Chaos Sounds: ${enabled ? 'ON' : 'OFF'} (click to toggle)`;
}

export function deactivate(): void {
  soundManager?.dispose();
  eventListener?.dispose();
}
