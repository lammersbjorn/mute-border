# Mute Border

A cross-platform tray app that displays a glowing red border overlay on all monitors when your microphone is muted. Never forget you're muted again.

Supports multiple audio sources:
- [Elgato Wave Link](https://www.elgato.com/us/en/s/wave-link) — direct WebSocket integration
- [OBS Studio](https://obsproject.com) — via obs-websocket plugin (bundled with OBS 28+)

---

## The Problem

It's easy to lose track of your mute state during calls, streams, or recordings. You talk while muted, or worse — broadcast unintended audio.

Mute Border provides persistent visual feedback: a red border and "MUTED" badge across all monitors.

---

## Features

- Red glowing border on all monitors when muted
- "MUTED" badge at bottom center of each display
- Multi-source support: Elgato Wave Link + OBS Studio
- Cross-platform: macOS + Windows
- System tray with per-source connection status
- Auto-reconnects every 5 seconds on disconnect
- Rounded corners on macOS for native look

---

## Requirements

- **macOS** or **Windows**
- At least one of:
  - [Elgato Wave Link](https://www.elgato.com/us/en/s/wave-link) running
  - [OBS Studio 28+](https://obsproject.com) with WebSocket enabled

---

## Installation

> [!NOTE]
> Downloads available from [Releases](../../releases)

**macOS**
1. Download the DMG
2. Open and drag **Mute Border** to Applications
3. On first launch: System Preferences → Privacy & Security → allow the app

**Windows**
1. Download the EXE
2. Run the installer
3. Launch from Start Menu

> [!TIP]
> Right-click the tray icon → **Launch at Login** to start automatically

---

## Setup Guides

<details>
<summary>Elgato Wave Link</summary>

1. Install and run [Wave Link software](https://www.elgato.com/us/en/s/wave-link)
2. Mute Border auto-connects on launch
3. No additional configuration needed

</details>

<details>
<summary>OBS Studio</summary>

1. Install [OBS Studio 28+](https://obsproject.com) (includes obs-websocket)
2. In OBS: **Tools** → **WebSocket Server Settings**
3. Enable **WebSocket Server**
4. Enable **Authentication** and set a password
5. Add the password to your config file (see Configuration below)
6. Restart Mute Border

**To watch a specific audio input:**
- Set `inputName` in config to match your OBS source name (e.g., `"Mic/Aux"`)
- If `null`, auto-detects the first input with "mic" or "aux" in the name

</details>

---

## Configuration

On first run, Mute Border creates a config file at:

```
~/.mute-border/config.json
```

```json
{
  "obs": {
    "enabled": false,
    "host": "127.0.0.1",
    "port": 4455,
    "password": "",
    "inputName": null
  },
  "waveLink": {
    "enabled": true
  }
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `obs.enabled` | boolean | `false` | Enable OBS integration |
| `obs.host` | string | `"127.0.0.1"` | OBS WebSocket host |
| `obs.port` | number | `4455` | OBS WebSocket port |
| `obs.password` | string | `""` | OBS WebSocket password |
| `obs.inputName` | string \| null | `null` | Specific input to watch (`null` = auto-detect) |
| `waveLink.enabled` | boolean | `true` | Enable Wave Link integration |

---

## Keyboard Shortcuts (Dev Mode)

When running from source (`npm start`):

| Shortcut | Action |
|----------|--------|
| `Cmd+Shift+M` (macOS) / `Ctrl+Shift+M` (Windows) | Toggle simulated mute |

Useful for testing without audio hardware.

---

## Building from Source

```bash
git clone https://github.com/coppinger/mute-border.git
cd mute-border
npm install
npm start        # Development
npm run make     # Build installers
```

Output locations:
- **macOS**: `out/make/dmg/x64/`
- **Windows**: `out/make/squirrel.windows/x64/`

---

## Architecture

<details>
<summary>Module overview (for contributors)</summary>

| Module | Description |
|--------|-------------|
| `src/main/main.ts` | App entry point, loads config, creates clients |
| `src/main/config.ts` | Loads/creates config file |
| `src/main/wave-link-client.ts` | WebSocket client for Wave Link JSON-RPC |
| `src/main/obs-client.ts` | WebSocket client for OBS obs-websocket |
| `src/main/mute-aggregator.ts` | Combines mute states with OR logic |
| `src/main/overlay-manager.ts` | Transparent overlay windows per display |
| `src/main/tray-manager.ts` | System tray with connection status |
| `src/main/preload.ts` | Context bridge for IPC |
| `src/renderer/overlay-renderer.ts` | Toggles border based on mute state |
| `src/shared/types.ts` | TypeScript types |

</details>

---

## Troubleshooting

> [!WARNING]
> **Border not showing when muted?**
> - Ensure Wave Link or OBS is running
> - Check tray menu shows "Connected" status
> - For OBS: verify WebSocket is enabled and password matches config

> [!WARNING]
> **OBS won't connect?**
> - Check OBS WebSocket settings: Tools → WebSocket Server Settings
> - Ensure server is enabled and password matches config
> - Try disabling password temporarily to isolate the issue

> [!WARNING]
> **macOS: "App is damaged" error?**
> - System Preferences → Privacy & Security → click "Open Anyway"
> - Or run: `xattr -cr /Applications/Mute\ Border.app`

---

## License

MIT
