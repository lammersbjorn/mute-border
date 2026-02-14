import { app, globalShortcut } from 'electron';
import started from 'electron-squirrel-startup';
import { WaveLinkClient } from './wave-link-client';
import { OverlayManager } from './overlay-manager';
import { TrayManager } from './tray-manager';

// Handle Squirrel install/uninstall events on Windows
if (started) {
  app.quit();
}

// Single instance lock
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

const waveLinkClient = new WaveLinkClient();
const overlayManager = new OverlayManager();
const trayManager = new TrayManager();

app.on('ready', () => {
  trayManager.init();
  overlayManager.init();

  waveLinkClient.on('connected', (micName: string | null) => {
    console.log(`[Main] Connected, mic: ${micName}`);
    trayManager.setConnected(micName);
  });

  waveLinkClient.on('disconnected', () => {
    console.log('[Main] Disconnected from Wave Link');
    trayManager.setDisconnected();
    // Hide border on disconnect (assume unmuted)
    overlayManager.sendMuteState(false);
  });

  waveLinkClient.on('mute-changed', (isMuted: boolean) => {
    console.log(`[Main] Mute state: ${isMuted}`);
    overlayManager.sendMuteState(isMuted);
    trayManager.setMuted(isMuted);
  });

  waveLinkClient.connect();

  // Debug shortcut: Ctrl+Shift+M to simulate mute toggle
  if (!app.isPackaged) {
    let debugMuted = false;
    globalShortcut.register('Ctrl+Shift+M', () => {
      debugMuted = !debugMuted;
      console.log(`[Debug] Simulated mute: ${debugMuted}`);
      overlayManager.sendMuteState(debugMuted);
      trayManager.setMuted(debugMuted);
    });
  }
});

// Keep app running when all windows close (tray app)
app.on('window-all-closed', (e: Event) => {
  e.preventDefault();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  waveLinkClient.destroy();
  overlayManager.destroy();
  trayManager.destroy();
});
