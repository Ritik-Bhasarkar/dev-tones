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
exports.SoundManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const child_process_1 = require("child_process");
const utils_1 = require("./utils");
const PLAYBACK_TIMEOUT_MS = 10000;
const DOWNLOAD_TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 5;
class SoundManager {
    constructor(cacheUri, extensionPath, outputChannel) {
        this.activeProcesses = new Set();
        this.playerScriptPath = '';
        this.cacheDir = cacheUri.fsPath;
        this.extensionPath = extensionPath;
        this.outputChannel = outputChannel;
        fs.mkdirSync(this.cacheDir, { recursive: true });
        if (process.platform === 'win32') {
            this.initWindowsPlayer();
        }
    }
    initWindowsPlayer() {
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
    async playSound(sources, volume) {
        const source = (0, utils_1.pickRandom)(sources);
        if (!source) {
            this.log('No source selected (empty array?)');
            return;
        }
        try {
            this.log(`Playing source: ${source}`);
            const filePath = await this.resolveSource(source);
            if (!filePath) {
                return;
            }
            this.log(`Resolved to: ${filePath}`);
            this.spawnPlayer(filePath, volume);
        }
        catch (err) {
            this.log(`Playback error: ${err}`);
        }
    }
    async resolveSource(source) {
        if (source.startsWith('http://') || source.startsWith('https://')) {
            return this.ensureCached(source);
        }
        // Handle bundled sounds (relative paths starting with ./)
        if (source.startsWith('./')) {
            const resolved = path.join(this.extensionPath, source);
            if (fs.existsSync(resolved)) {
                return resolved;
            }
            this.log(`Bundled file not found: ${resolved}`);
            return null;
        }
        if (fs.existsSync(source)) {
            return source;
        }
        this.log(`Local file not found: ${source}`);
        return null;
    }
    async ensureCached(url) {
        const ext = path.extname(new URL(url).pathname) || '.mp3';
        const filename = (0, utils_1.hashString)(url) + ext;
        const cached = path.join(this.cacheDir, filename);
        if (fs.existsSync(cached)) {
            return cached;
        }
        this.log(`Downloading: ${url}`);
        await this.download(url, cached, MAX_REDIRECTS);
        return cached;
    }
    download(url, dest, redirectsLeft) {
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
                    fs.unlink(dest, () => { });
                    reject(err);
                });
            });
            req.on('error', (err) => {
                clearTimeout(timer);
                reject(err);
            });
        });
    }
    spawnPlayer(filePath, volume) {
        let proc;
        const platform = process.platform;
        this.log(`Spawning player on ${platform} for: ${filePath}`);
        try {
            if (platform === 'darwin') {
                proc = (0, child_process_1.spawn)('afplay', ['-v', String(volume), filePath]);
            }
            else if (platform === 'linux') {
                proc = (0, child_process_1.spawn)('mpg123', ['-f', String(Math.round(volume * 32768)), filePath]);
            }
            else {
                // Windows: use wscript with pre-written VBS — plays silently, no GUI
                const vol = Math.round(volume * 100);
                proc = (0, child_process_1.spawn)('wscript', ['//B', this.playerScriptPath, filePath, String(vol)], { windowsHide: true });
            }
        }
        catch (err) {
            this.log(`Failed to spawn player: ${err}`);
            return;
        }
        this.activeProcesses.add(proc);
        proc.stderr?.on('data', (data) => {
            this.log(`Player stderr: ${data.toString().trim()}`);
        });
        proc.stdout?.on('data', (data) => {
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
    log(msg) {
        this.outputChannel.appendLine(`[SoundManager] ${msg}`);
    }
    dispose() {
        for (const proc of this.activeProcesses) {
            proc.kill();
        }
        this.activeProcesses.clear();
    }
}
exports.SoundManager = SoundManager;
//# sourceMappingURL=soundManager.js.map