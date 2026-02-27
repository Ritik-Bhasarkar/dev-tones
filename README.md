# Dev Chaos Sounds

A VS Code extension that plays fun sound effects when builds fail, tests pass, dev servers crash, and more. Think: sad trombone on build failure, victory fanfare on success.

## Features

- Sound effects on **build/task failure** and **success**
- Detect **test pass/fail** from terminal output
- Detect **lint errors** from diagnostics
- Detect **dev server crashes** from terminal output and exit codes
- Configurable sound URLs or local file paths per event type
- Cross-platform playback (macOS, Linux, Windows)
- Smart cooldown to prevent sound spam
- Status bar toggle to quickly mute/unmute

## Development

```bash
cd dev-chaos-sounds
npm install
npm run compile
```

## Run in Extension Development Host

1. Open this folder in VS Code
2. Press **F5** to launch the Extension Development Host
3. The extension activates automatically

## Testing

### Test a failing task

Create `.vscode/tasks.json` in the test window:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Fail Test",
      "type": "shell",
      "command": "exit 1"
    }
  ]
}
```

Run via **Terminal > Run Task > Fail Test** — you should hear the fail sound.

### Test a passing task

```json
{
  "label": "Success Test",
  "type": "shell",
  "command": "echo done"
}
```

Run it — you should hear the success sound.

### Test the command

**Ctrl+Shift+P** (or **Cmd+Shift+P** on macOS) > `Dev Chaos Sounds: Test Sound`

## Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `devChaosSounds.enabled` | boolean | `true` | Enable or disable all sounds |
| `devChaosSounds.volume` | number | `0.5` | Playback volume (0.0–1.0) |
| `devChaosSounds.failSounds` | string[] | `[sad-trombone URL]` | Sounds for build/task failure |
| `devChaosSounds.successSounds` | string[] | `[fanfare URL]` | Sounds for build/task success |
| `devChaosSounds.testFailSounds` | string[] | `[]` | Sounds for test failure |
| `devChaosSounds.testSuccessSounds` | string[] | `[]` | Sounds for test success |
| `devChaosSounds.lintErrorSounds` | string[] | `[]` | Sounds for lint errors |
| `devChaosSounds.serverCrashSounds` | string[] | `[]` | Sounds for dev server crashes |
| `devChaosSounds.cooldownMs` | number | `3000` | Min ms between sounds |

## Packaging & Publishing

```bash
# Install vsce
npm install -g @vscode/vsce

# Package
vsce package

# This creates dev-chaos-sounds-0.0.1.vsix
# Install locally:
code --install-extension dev-chaos-sounds-0.0.1.vsix

# Publish (requires Personal Access Token from https://dev.azure.com)
vsce publish
```
