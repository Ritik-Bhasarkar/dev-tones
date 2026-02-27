import * as vscode from 'vscode';

export interface Config {
  enabled: boolean;
  volume: number;
  failSounds: string[];
  successSounds: string[];
  testFailSounds: string[];
  testSuccessSounds: string[];
  lintErrorSounds: string[];
  serverCrashSounds: string[];
  cooldownMs: number;
}

export function getConfig(): Config {
  const cfg = vscode.workspace.getConfiguration('devChaosSounds');
  return {
    enabled: cfg.get<boolean>('enabled', true),
    volume: cfg.get<number>('volume', 0.5),
    failSounds: cfg.get<string[]>('failSounds', []),
    successSounds: cfg.get<string[]>('successSounds', []),
    testFailSounds: cfg.get<string[]>('testFailSounds', []),
    testSuccessSounds: cfg.get<string[]>('testSuccessSounds', []),
    lintErrorSounds: cfg.get<string[]>('lintErrorSounds', []),
    serverCrashSounds: cfg.get<string[]>('serverCrashSounds', []),
    cooldownMs: cfg.get<number>('cooldownMs', 3000),
  };
}
