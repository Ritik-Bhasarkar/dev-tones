# Dev Chaos Sounds — Architecture

## Overview

Dev Chaos Sounds is a VS Code extension that plays sound effects in response to developer workflow events — build failures, test results, lint errors, and server crashes. It watches VS Code task completions, terminal output, shell executions, and diagnostics changes, then spawns a platform-native audio player process to play a randomly selected sound.

## Module Dependency Graph

```
┌──────────────────────────────────────────────────────┐
│                    VS Code API                       │
│  (tasks, terminals, diagnostics, commands, config)   │
└────────┬──────────────────────────────────┬──────────┘
         │                                  │
         ▼                                  ▼
┌─────────────────┐               ┌─────────────────┐
│  extension.ts   │──────────────▶│   config.ts     │
│  (entry point)  │               │  (settings I/O) │
└────┬────────────┘               └────────▲────────┘
     │                                     │
     │ creates                       reads config
     ▼                                     │
┌─────────────────┐               ┌────────┴────────┐
│ soundManager.ts │◀──────────────│ eventListener.ts │
│ (playback)      │  playCooldown │ (event detect)   │
└────┬────────────┘               └─────────────────┘
     │
     │ uses
     ▼
┌─────────────────┐
│   utils.ts      │
│ (helpers)       │
└─────────────────┘
```

**Data flow:** VS Code event → `EventListener` detects it → checks cooldown → `SoundManager.playSound()` → resolve source → cache if remote → spawn native player.

## Module Breakdown

### `extension.ts` — Entry Point

The extension lifecycle module. Exports `activate()` and `deactivate()`.

| Responsibility | Detail |
|---|---|
| Activation | Creates the output channel, `SoundManager`, and `EventListener`; registers commands |
| `devChaosSounds.toggle` command | Flips `enabled` in global config, updates status bar |
| `devChaosSounds.testSound` command | Plays a random sound from `failSounds` (or `successSounds` as fallback) |
| Status bar | Shows `$(unmute)` / `$(mute)` icon; click toggles enabled state |
| Deactivation | Calls `dispose()` on sound manager and event listener |

### `soundManager.ts` — Sound Playback

Handles the full playback pipeline: source resolution, HTTP download caching, and spawning a platform-specific audio player.

| Export | Role |
|---|---|
| `SoundManager` class | Constructed with a cache URI, extension path, and output channel |
| `playSound(sources, volume)` | Picks a random source, resolves it to a local file, spawns a player |
| `dispose()` | Kills all active child processes |

**Internal methods:**

- `resolveSource(source)` — Routes to cached download, bundled file, or absolute path
- `ensureCached(url)` — SHA-256 hashes the URL for the cache filename; downloads if missing
- `download(url, dest, redirectsLeft)` — HTTP(S) GET with redirect following (max 5) and 10s timeout
- `spawnPlayer(filePath, volume)` — Platform dispatch (see [Windows Player Details](#windows-player-details))
- `initWindowsPlayer()` — Writes the VBScript player to the cache directory on startup

**Constants:**

- `PLAYBACK_TIMEOUT_MS` = 10,000 ms — kills player process if it runs too long
- `DOWNLOAD_TIMEOUT_MS` = 10,000 ms — aborts HTTP download
- `MAX_REDIRECTS` = 5

### `eventListener.ts` — Event Detection

Listens to VS Code events and triggers sound playback through `SoundManager`.

| Export | Role |
|---|---|
| `EventListener` class | Constructed with a `SoundManager`, config getter function, and output channel |
| `registerAll(context)` | Subscribes to all VS Code event sources (see table below) |
| `dispose()` | Disposes all registered event subscriptions |

**Regex patterns** used for terminal output matching:

| Pattern | Matches |
|---|---|
| `TEST_FAIL_PATTERNS` | `test failed`, `FAIL`, `✗`, `failing` |
| `TEST_PASS_PATTERNS` | `test passed`, `tests passed`, `✓ all`, `passing` |
| `CRASH_PATTERNS` | `ECONNREFUSED`, `SIGKILL`, `crashed`, `exited with code [1-9]` |

### `config.ts` — Configuration

Exports the `Config` interface and `getConfig()` function that reads from `vscode.workspace.getConfiguration('devChaosSounds')`.

| Field | Type | Default |
|---|---|---|
| `enabled` | `boolean` | `true` |
| `volume` | `number` | `0.5` |
| `failSounds` | `string[]` | `[]` |
| `successSounds` | `string[]` | `[]` |
| `testFailSounds` | `string[]` | `[]` |
| `testSuccessSounds` | `string[]` | `[]` |
| `lintErrorSounds` | `string[]` | `[]` |
| `serverCrashSounds` | `string[]` | `[]` |
| `cooldownMs` | `number` | `3000` |

### `utils.ts` — Helpers

| Export | Signature | Purpose |
|---|---|---|
| `pickRandom` | `<T>(arr: T[]) => T \| undefined` | Returns a random element from an array |
| `withTimeout` | `<T>(promise, ms) => Promise<T>` | Wraps a promise with a timeout rejection |
| `hashString` | `(input: string) => string` | SHA-256 hex digest of a string (used for cache filenames) |

## Event Detection Table

| VS Code Event | API | Trigger Condition | Sound Category |
|---|---|---|---|
| Task process end | `tasks.onDidEndTaskProcess` | `exitCode === 0` | `successSounds` |
| Task process end | `tasks.onDidEndTaskProcess` | `exitCode !== 0` | `failSounds` |
| Terminal data write | `window.onDidWriteTerminalData` (proposed) | Output matches `TEST_FAIL_PATTERNS` | `testFailSounds` |
| Terminal data write | `window.onDidWriteTerminalData` (proposed) | Output matches `TEST_PASS_PATTERNS` | `testSuccessSounds` |
| Terminal data write | `window.onDidWriteTerminalData` (proposed) | Output matches `CRASH_PATTERNS` | `serverCrashSounds` |
| Shell execution end | `window.onDidEndTerminalShellExecution` | `exitCode !== 0` | `failSounds` |
| Shell execution end | `window.onDidEndTerminalShellExecution` | `exitCode === 0` | `successSounds` |
| Terminal close | `window.onDidCloseTerminal` | `exitStatus.code !== 0` | `serverCrashSounds` |
| Diagnostics change | `languages.onDidChangeDiagnostics` | Error count increased | `lintErrorSounds` |

> `onDidWriteTerminalData` is a proposed API. The extension declares `"enabledApiProposals": ["terminalDataWriteEvent"]` in `package.json` and checks at runtime with `typeof windowAny.onDidWriteTerminalData === 'function'` before registering.

## Sound Playback Pipeline

```
 User config: ["./sounds/faaah.mp3", "https://example.com/boom.mp3"]
                          │
                          ▼
              ┌─── pickRandom() ───┐
              │                    │
              ▼                    ▼
       "./sounds/faaah.mp3"     "https://..."
              │                    │
              ▼                    ▼
       resolve relative      ensureCached()
       to extensionPath        │
              │                ├─ cache hit? → return path
              │                └─ cache miss? → download()
              │                          │
              │          hash URL → filename.mp3
              │          HTTP GET (follow redirects)
              │          write to globalStorage/sound-cache/
              │                          │
              ▼                          ▼
              └──────── filePath ────────┘
                          │
                          ▼
                   spawnPlayer(filePath, volume)
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
           macOS       Linux       Windows
          afplay      mpg123      wscript
           -v          -f        //B _player.vbs
```

**Source resolution priority:**

1. **HTTP(S) URL** (`http://` or `https://`) — downloaded and cached under `globalStorage/sound-cache/<sha256>.<ext>`
2. **Relative path** (`./sounds/...`) — resolved against the extension install directory
3. **Absolute path** — used directly if the file exists

## Windows Player Details

Windows lacks a simple CLI audio player like `afplay` (macOS) or `mpg123` (Linux). The extension uses a VBScript + WMPlayer.OCX approach:

1. **On startup**, `initWindowsPlayer()` writes `_player.vbs` to the cache directory
2. **On playback**, `spawnPlayer()` invokes `wscript //B _player.vbs <filePath> <volume>`
3. The `//B` flag runs wscript in batch mode (no GUI window)
4. The `windowsHide: true` spawn option prevents a console flash

**VBScript logic:**
- Creates a `WMPlayer.OCX` COM object
- Sets volume (0–100, scaled from the 0.0–1.0 config value)
- Plays the file and polls `playState` until it returns to idle (state 1)
- Closes the player

## Configuration Reference

All settings live under the `devChaosSounds.*` namespace in VS Code settings.

| Setting | Type | Default | Description |
|---|---|---|---|
| `enabled` | `boolean` | `true` | Master on/off switch |
| `volume` | `number` | `0.5` | Playback volume (0.0 silent – 1.0 full) |
| `failSounds` | `string[]` | `["./sounds/faaah.mp3"]` | Sounds for build/task failure |
| `successSounds` | `string[]` | `["./sounds/tada-fanfare.mp3"]` | Sounds for build/task success |
| `testFailSounds` | `string[]` | `[]` | Sounds for test failure (terminal pattern match) |
| `testSuccessSounds` | `string[]` | `[]` | Sounds for test success (terminal pattern match) |
| `lintErrorSounds` | `string[]` | `[]` | Sounds for new lint errors appearing |
| `serverCrashSounds` | `string[]` | `[]` | Sounds for dev server crashes |
| `cooldownMs` | `number` | `3000` | Minimum ms between consecutive sounds |

Sound values can be:
- **Relative paths** (`./sounds/faaah.mp3`) — bundled with the extension
- **Absolute paths** (`C:\my-sounds\boom.mp3`) — local files
- **URLs** (`https://example.com/sound.mp3`) — downloaded and cached on first use

## Bundled Sounds

The extension ships with three sounds in the `sounds/` directory:

| File | Default usage |
|---|---|
| `faaah.mp3` | Build/task failure |
| `tada-fanfare.mp3` | Build/task success |
| `sad-trombone.mp3` | Available but not assigned by default |

## Cooldown and Error Handling

### Cooldown (spam prevention)

`EventListener.playCooldown()` enforces a minimum gap between sounds:

1. Checks `Date.now() - lastSoundTime < config.cooldownMs`
2. If within cooldown, the sound is silently skipped (logged to output channel)
3. Otherwise, updates `lastSoundTime` and calls `playSound()`
4. Default cooldown is 3000 ms — configurable via `devChaosSounds.cooldownMs`

This is a single global cooldown across all event types — a build failure sound will suppress a lint error sound that fires within the cooldown window.

### Error handling

| Scenario | Behavior |
|---|---|
| Empty sound array | `pickRandom()` returns `undefined`; playback silently returns |
| Bundled file missing | Logged; `resolveSource()` returns `null`; no crash |
| Local file missing | Logged; `resolveSource()` returns `null` |
| HTTP download fails | Error caught and logged; no sound plays |
| Download timeout | Rejects after 10s; caught by `playSound()` |
| Too many redirects | Rejects after 5 hops; caught by `playSound()` |
| Player process timeout | Killed after 10s via `setTimeout` |
| Player spawn failure | Caught in try/catch; logged |
| Player process error | Logged; process removed from active set |
| Proposed API missing | Runtime `typeof` check; listener simply not registered |

All errors are logged to the "Dev Chaos Sounds" output channel and never surface as user-facing error dialogs.
