import * as vscode from 'vscode';
import { SoundManager } from './soundManager';
import { Config } from './config';

const TEST_FAIL_PATTERNS = /test failed|FAIL|\u2717|failing/i;
const TEST_PASS_PATTERNS = /test passed|tests passed|\u2713 all|passing/i;
const CRASH_PATTERNS = /ECONNREFUSED|SIGKILL|crashed|exited with code [1-9]/i;

export class EventListener {
  private soundManager: SoundManager;
  private getConfig: () => Config;
  private disposables: vscode.Disposable[] = [];
  private lastSoundTime = 0;
  private previousErrorCount = 0;
  private outputChannel: vscode.OutputChannel;

  constructor(
    soundManager: SoundManager,
    getConfig: () => Config,
    outputChannel: vscode.OutputChannel
  ) {
    this.soundManager = soundManager;
    this.getConfig = getConfig;
    this.outputChannel = outputChannel;
  }

  registerAll(context: vscode.ExtensionContext): void {
    this.outputChannel.appendLine('[EventListener] Registering all listeners...');

    // Task completion events
    const taskDisposable = vscode.tasks.onDidEndTaskProcess((e) => {
      this.outputChannel.appendLine(`[EventListener] Task ended: "${e.execution.task.name}" exitCode=${e.exitCode}`);
      const config = this.getConfig();
      if (!config.enabled) { return; }

      if (e.exitCode === 0) {
        this.playCooldown(config.successSounds, config);
      } else {
        this.playCooldown(config.failSounds, config);
      }
    });
    this.disposables.push(taskDisposable);

    // Terminal data events for test and crash detection
    // onDidWriteTerminalData is a proposed API — access via runtime check
    const windowAny = vscode.window as any;
    if (typeof windowAny.onDidWriteTerminalData === 'function') {
      this.outputChannel.appendLine('[EventListener] onDidWriteTerminalData available — registering');
      const terminalDisposable = windowAny.onDidWriteTerminalData((e: any) => {
        const config = this.getConfig();
        if (!config.enabled) { return; }
        const data: string = e.data;

        if (TEST_FAIL_PATTERNS.test(data)) {
          this.outputChannel.appendLine('[EventListener] Terminal output matched test FAIL pattern');
          this.playCooldown(config.testFailSounds, config);
        } else if (TEST_PASS_PATTERNS.test(data)) {
          this.outputChannel.appendLine('[EventListener] Terminal output matched test PASS pattern');
          this.playCooldown(config.testSuccessSounds, config);
        }

        if (CRASH_PATTERNS.test(data)) {
          this.outputChannel.appendLine('[EventListener] Terminal output matched CRASH pattern');
          this.playCooldown(config.serverCrashSounds, config);
        }
      });
      this.disposables.push(terminalDisposable);
    } else {
      this.outputChannel.appendLine('[EventListener] onDidWriteTerminalData NOT available');
    }

    // Terminal shell execution events — catches npm run dev, build, etc.
    if (typeof vscode.window.onDidEndTerminalShellExecution === 'function') {
      this.outputChannel.appendLine('[EventListener] onDidEndTerminalShellExecution available — registering');
      const shellExecDisposable = vscode.window.onDidEndTerminalShellExecution((e) => {
        this.outputChannel.appendLine(`[EventListener] Shell execution ended: exitCode=${e.exitCode}`);
        const config = this.getConfig();
        if (!config.enabled) { return; }

        if (e.exitCode !== undefined && e.exitCode !== 0) {
          this.playCooldown(config.failSounds, config);
        } else if (e.exitCode === 0) {
          this.playCooldown(config.successSounds, config);
        }
      });
      this.disposables.push(shellExecDisposable);
    } else {
      this.outputChannel.appendLine('[EventListener] onDidEndTerminalShellExecution NOT available');
    }

    // Terminal close events for crash detection
    const termCloseDisposable = vscode.window.onDidCloseTerminal((terminal) => {
      this.outputChannel.appendLine(`[EventListener] Terminal closed: exitCode=${terminal.exitStatus?.code}`);
      const config = this.getConfig();
      if (!config.enabled) { return; }

      if (terminal.exitStatus && terminal.exitStatus.code !== undefined && terminal.exitStatus.code !== 0) {
        this.playCooldown(config.serverCrashSounds, config);
      }
    });
    this.disposables.push(termCloseDisposable);

    // Diagnostics change events for lint errors
    const diagDisposable = vscode.languages.onDidChangeDiagnostics((e) => {
      const config = this.getConfig();
      if (!config.enabled) { return; }

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

  private playCooldown(sounds: string[], config: Config): void {
    if (sounds.length === 0) { return; }

    const now = Date.now();
    if (now - this.lastSoundTime < config.cooldownMs) {
      this.outputChannel.appendLine('[EventListener] Cooldown active, skipping sound');
      return;
    }
    this.lastSoundTime = now;
    this.soundManager.playSound(sounds, config.volume);
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}
