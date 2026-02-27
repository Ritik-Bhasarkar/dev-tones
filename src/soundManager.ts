import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { spawn, execFile, ChildProcess } from 'child_process';
import { pickRandom, hashString } from './utils';

const PLAYBACK_TIMEOUT_MS = 10000;
const DOWNLOAD_TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 5;

export class SoundManager {
  private cacheDir: string;
  private extensionPath: string;
  private activeProcesses: Set<ChildProcess> = new Set();
  private outputChannel: vscode.OutputChannel;

  private playerScriptPath: string = '';

  constructor(cacheUri: vscode.Uri, extensionPath: string, outputChannel: vscode.OutputChannel) {
    this.cacheDir = cacheUri.fsPath;
    this.extensionPath = extensionPath;
    this.outputChannel = outputChannel;
    fs.mkdirSync(this.cacheDir, { recursive: true });
    if (process.platform === 'win32') {
      this.initWindowsPlayer();
    }
  }

  private initWindowsPlayer(): void {
    // Write the VBS player script once on startup to avoid per-play I/O
    this.playerScriptPath = path.join(this.cacheDir, '_player.vbs');
    const vbs = [
      'Set args = WScript.Arguments',
      'If args.Count < 2 Then WScript.Quit 1',
      'Set p = CreateObject("WMPlayer.OCX")',
      'p.settings.autoStart = False',
      'p.settings.volume = CInt(args(1))',
      'p.URL = args(0)',
      'p.controls.play()',
      'Do While p.playState <> 1',
      '  WScript.Sleep 100',
      'Loop',
      'p.close',
    ].join('\r\n');
    fs.writeFileSync(this.playerScriptPath, vbs);
    this.log('Windows player script ready: ' + this.playerScriptPath);
  }

  async playSound(sources: string[], volume: number): Promise<void> {
    const source = pickRandom(sources);
    if (!source) {
      this.log('No source selected (empty array?)');
      return;
    }

    try {
      this.log(`Playing source: ${source}`);
      const filePath = await this.resolveSource(source);
      if (!filePath) { return; }
      this.log(`Resolved to: ${filePath}`);
      this.spawnPlayer(filePath, volume);
    } catch (err) {
      this.log(`Playback error: ${err}`);
    }
  }

  private async resolveSource(source: string): Promise<string | null> {
    if (source.startsWith('http://') || source.startsWith('https://')) {
      return this.ensureCached(source);
    }
    // Handle bundled sounds (relative paths starting with ./)
    if (source.startsWith('./')) {
      const resolved = path.join(this.extensionPath, source);
      if (fs.existsSync(resolved)) { return resolved; }
      this.log(`Bundled file not found: ${resolved}`);
      return null;
    }
    if (fs.existsSync(source)) {
      return source;
    }
    this.log(`Local file not found: ${source}`);
    return null;
  }

  private async ensureCached(url: string): Promise<string> {
    const ext = path.extname(new URL(url).pathname) || '.mp3';
    const filename = hashString(url) + ext;
    const cached = path.join(this.cacheDir, filename);

    if (fs.existsSync(cached)) { return cached; }

    this.log(`Downloading: ${url}`);
    await this.download(url, cached, MAX_REDIRECTS);
    return cached;
  }

  private download(url: string, dest: string, redirectsLeft: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      const timer = setTimeout(() => {
        reject(new Error('Download timed out'));
      }, DOWNLOAD_TIMEOUT_MS);

      const req = client.get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          clearTimeout(timer);
          if (redirectsLeft <= 0) {
            reject(new Error('Too many redirects'));
            return;
          }
          this.download(res.headers.location, dest, redirectsLeft - 1).then(resolve, reject);
          return;
        }

        if (res.statusCode && res.statusCode !== 200) {
          clearTimeout(timer);
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => {
          clearTimeout(timer);
          file.close();
          resolve();
        });
        file.on('error', (err) => {
          clearTimeout(timer);
          fs.unlink(dest, () => {});
          reject(err);
        });
      });

      req.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  private spawnPlayer(filePath: string, volume: number): void {
    let proc: ChildProcess;
    const platform = process.platform;

    this.log(`Spawning player on ${platform} for: ${filePath}`);

    try {
      if (platform === 'darwin') {
        proc = spawn('afplay', ['-v', String(volume), filePath]);
      } else if (platform === 'linux') {
        proc = spawn('mpg123', ['-f', String(Math.round(volume * 32768)), filePath]);
      } else {
        // Windows: use wscript with pre-written VBS — plays silently, no GUI
        const vol = Math.round(volume * 100);
        proc = spawn('wscript', ['//B', this.playerScriptPath, filePath, String(vol)], { windowsHide: true });
      }
    } catch (err) {
      this.log(`Failed to spawn player: ${err}`);
      return;
    }

    this.activeProcesses.add(proc);

    proc.stderr?.on('data', (data: Buffer) => {
      this.log(`Player stderr: ${data.toString().trim()}`);
    });

    proc.stdout?.on('data', (data: Buffer) => {
      this.log(`Player stdout: ${data.toString().trim()}`);
    });

    const timeout = setTimeout(() => {
      this.log('Playback timeout — killing process');
      proc.kill();
    }, PLAYBACK_TIMEOUT_MS);

    proc.on('close', (code) => {
      clearTimeout(timeout);
      this.activeProcesses.delete(proc);
      this.log(`Player closed with code ${code}`);
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      this.activeProcesses.delete(proc);
      this.log(`Player error: ${err.message}`);
    });
  }

  private log(msg: string): void {
    this.outputChannel.appendLine(`[SoundManager] ${msg}`);
  }

  dispose(): void {
    for (const proc of this.activeProcesses) {
      proc.kill();
    }
    this.activeProcesses.clear();
  }
}
