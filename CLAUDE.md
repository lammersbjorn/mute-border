# Mute Border

Electron tray app that shows a glowing red border overlay on all monitors when the Elgato Wave Link microphone is muted. Connects to Wave Link's local WebSocket API and auto-reconnects on disconnect.

## Commands

- `npm start` -- launch in dev mode (electron-forge start)
- `npm run package` -- package for distribution
- `npm run make` -- build platform installers
- `npm run lint` -- ESLint

## Tech Stack

Electron 40 + TypeScript + Vite (via Electron Forge 7). Runtime dependency: `ws` for WebSocket.

## Architecture

**Main process** (`src/main/main.ts`) -- app entry point, wires together the three managers, registers debug shortcut, enforces single-instance lock.

**WaveLinkClient** (`src/main/wave-link-client.ts`) -- connects to `ws://127.0.0.1:1824`, uses JSON-RPC 2.0. Calls `getInputConfigs` on connect to find the primary hardware mic (`inputType === 1`). Listens for `inputMuteChanged` (mute toggle) and `inputsChanged` (re-fetches inputs) push events. Filters events to `com.elgato.mix.local` mixer only. Auto-reconnects every 5s on disconnect.

**OverlayManager** (`src/main/overlay-manager.ts`) -- creates one transparent, click-through, always-on-top BrowserWindow per display. Tracks display add/remove/resize via `screen` events. Sends `mute-state-changed` IPC to each overlay renderer.

**TrayManager** (`src/main/tray-manager.ts`) -- system tray icon with three states (disconnected/muted/unmuted). Context menu shows connection status and mic name. Asset paths differ between dev (`app.getAppPath()`) and packaged (`process.resourcesPath`).

**Preload** (`src/main/preload.ts`) -- exposes `window.muteBorder.onMuteStateChanged()` via contextBridge.

**Renderer** (`src/renderer/overlay-renderer.ts` + `overlay.css`) -- toggles `.muted` class on `#border-overlay` div. Border is a red inset box-shadow with glow effect, 300ms fade transition.

**Types** (`src/shared/types.ts`) -- `WaveLinkInput`, `InputMuteChangedEvent`, `MixerState`, `ConnectionState`.

## Key Details

- **Debug shortcut**: `Ctrl+Shift+M` simulates mute toggle (dev mode only, `!app.isPackaged`)
- **Overlay windows**: frameless, transparent, `alwaysOnTop: 'screen-saver'`, `ignoreMouseEvents: true`, visible on all workspaces
- **Forge config** (`forge.config.ts`): asar enabled, `assets/` copied as extraResource, Fuses plugin locks down Node options and cookie encryption
- **Tray icons**: 16x16 PNGs in `assets/` (disconnected, muted, unmuted)
- **Vite config**: `ws` and `electron` are external in main process build (`vite.main.config.ts`)
- **On disconnect**: border hides (assumes unmuted), tray shows disconnected state, reconnect scheduled
