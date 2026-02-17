# Mute Border

Electron tray app that shows a glowing red border overlay on all monitors when your microphone is muted. Supports multiple audio sources: Elgato Wave Link and OBS Studio.

## Commands

- `npm start` — launch in dev mode (electron-forge start)
- `npm run package` — package for distribution
- `npm run make` — build platform installers
- `npm run lint` — ESLint

## Tech Stack

Electron 40 + TypeScript + Vite (via Electron Forge 7). Runtime dependencies: `ws` for WebSocket, `obs-websocket-js` for OBS.

## Architecture

**Main process** (`src/main/main.ts`) — app entry point, handles Squirrel events (Windows installer), loads config, creates clients, wires to aggregator, registers debug shortcuts, enforces single-instance lock.

**Config** (`src/main/config.ts`) — loads `~/.mute-border/config.json`, creates default on first run.

**WaveLinkClient** (`src/main/wave-link-client.ts`) — connects to `ws://127.0.0.1:1824`, uses JSON-RPC 2.0. Calls `getInputConfigs` on connect to find the primary hardware mic (`isWaveMicInput: true`). Listens for `inputMuteChanged` and `microphoneConfigChanged` push events. Filters events to `com.elgato.mix.local` mixer only. Auto-reconnects every 5s on disconnect.

**OBSClient** (`src/main/obs-client.ts`) — connects to OBS WebSocket at configurable host:port (default `ws://127.0.0.1:4455`). Uses `obs-websocket-js` library for auth flow. Watches a configurable audio input (auto-detects first mic/aux input if not specified). Listens for `InputMuteStateChanged` events. Auto-reconnects on disconnect.

**MuteAggregator** (`src/main/mute-aggregator.ts`) — combines mute states from all sources with OR logic: border shows if ANY connected source is muted. Emits `mute-changed` when aggregated state changes.

**OverlayManager** (`src/main/overlay-manager.ts`) — creates one transparent, click-through, always-on-top BrowserWindow per display. Tracks display add/remove/resize via `screen` events. Sends `mute-state-changed` IPC to each overlay renderer.

**TrayManager** (`src/main/tray-manager.ts`) — system tray icon with states based on aggregated mute state. Context menu shows per-source connection status. Asset paths differ between dev (`app.getAppPath()`) and packaged (`process.resourcesPath`). Uses template icons on macOS for dark/light mode adaptation.

**Preload** (`src/main/preload.ts`) — exposes `window.muteBorder.onMuteStateChanged()` and `window.muteBorder.platform` (`process.platform`) via contextBridge.

**Renderer** (`src/renderer/overlay-renderer.ts` + `overlay.css`) — toggles `.muted` class on `#border-overlay` div. Border is a red inset box-shadow with glow effect, 300ms fade transition.

**Types** (`src/shared/types.ts`) — `WaveLinkInput`, `InputMuteChangedEvent`, `MixerState`, `Config`, `OBSConfig`, `SourceState`, `MuteSource`.

## Configuration

Config file: `~/.mute-border/config.json`

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
| `obs.enabled` | boolean | false | Enable OBS integration |
| `obs.host` | string | "127.0.0.1" | OBS WebSocket host |
| `obs.port` | number | 4455 | OBS WebSocket port |
| `obs.password` | string | "" | OBS WebSocket password |
| `obs.inputName` | string \| null | null | Specific input to watch (null = auto-detect mic/aux) |
| `waveLink.enabled` | boolean | true | Enable Wave Link integration |

## Key Details

- **Debug shortcut** (dev mode only): `Cmd+Shift+M` (macOS) / `Ctrl+Shift+M` (Windows) — toggle simulated mute via aggregator (sets waveLink source to a "Debug" connected state)
- **Overlay windows**: frameless, transparent, `alwaysOnTop: 'screen-saver'`, `ignoreMouseEvents: true`, visible on all workspaces, `visibleOnFullScreen: true` (macOS fullscreen support)
- **Rounded corners**: macOS only (`window.muteBorder.platform === 'darwin'`), applied via CSS `.rounded-corners` class
- **Forge config** (`forge.config.ts`): asar enabled, `assets/` copied as extraResource, Fuses plugin locks down Node options and cookie encryption, DMG maker for macOS
- **Tray icons**: 16x16 PNGs in `assets/` (disconnected, muted, unmuted) + template icons (`*Template.png`) for macOS dark/light mode
- **Vite config**: `electron`, `bufferutil`, and `utf-8-validate` are external in main process build
- **On disconnect**: border hides only if ALL sources disconnect, individual source disconnection doesn't hide border if others are connected, reconnect scheduled every 5s
- **Mute logic**: OR aggregation — border shows if ANY connected source reports muted state
- **Cross-platform**: macOS + Windows, platform-specific keyboard shortcuts and tray icon handling
