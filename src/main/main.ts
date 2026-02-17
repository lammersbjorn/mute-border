import { app, globalShortcut } from 'electron';
import { WaveLinkClient } from './wave-link-client';
import { OBSClient } from './obs-client';
import { OverlayManager } from './overlay-manager';
import { TrayManager } from './tray-manager';
import { MuteAggregator } from './mute-aggregator';
import { loadConfig } from './config';
import type { SourceKey, MuteSourceClient } from '../shared/types';

// Handle Squirrel events for Windows installer
if (process.platform === 'win32') {
  const squirrelArgs = ['--squirrel-install', '--squirrel-updated', '--squirrel-uninstall', '--squirrel-obsolete'];
  if (squirrelArgs.some(arg => process.argv.includes(arg))) {
    app.quit();
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

function setupClient(
  client: MuteSourceClient,
  source: SourceKey,
  aggregator: MuteAggregator,
  trayManager: TrayManager
): void {
  client.on('connected', (name: unknown) => {
    aggregator.setSourceState(source, { 
      type: 'connected', 
      name: typeof name === 'string' ? name : null, 
      muted: false 
    });
    trayManager.updateSourceState(aggregator.getSources());
  });

  client.on('disconnected', () => {
    aggregator.setSourceState(source, { type: 'disconnected' });
    trayManager.updateSourceState(aggregator.getSources());
  });

  client.on('mute-changed', (isMuted: unknown) => {
    const current = aggregator.getSources()[source];
    if (current.type === 'connected' && typeof isMuted === 'boolean') {
      aggregator.setSourceState(source, { ...current, muted: isMuted });
    }
    trayManager.updateSourceState(aggregator.getSources());
  });

  client.connect();
}

const config = loadConfig();
const aggregator = new MuteAggregator();
const overlayManager = new OverlayManager();
const trayManager = new TrayManager();

let waveLinkClient: WaveLinkClient | null = null;
let obsClient: OBSClient | null = null;

app.on('ready', () => {
  trayManager.init();
  overlayManager.init();

  aggregator.on('mute-changed', (isMuted: boolean) => {
    overlayManager.sendMuteState(isMuted);
  });

  if (config.waveLink.enabled) {
    waveLinkClient = new WaveLinkClient();
    setupClient(waveLinkClient, 'waveLink', aggregator, trayManager);
  } else {
    aggregator.setSourceState('waveLink', { type: 'disabled' });
  }

  if (config.obs.enabled) {
    obsClient = new OBSClient(config.obs);
    setupClient(obsClient, 'obs', aggregator, trayManager);
  } else {
    aggregator.setSourceState('obs', { type: 'disabled' });
  }

  trayManager.updateSourceState(aggregator.getSources());

  if (!app.isPackaged) {
    let debugMuted = false;
    const accelerator = process.platform === 'darwin' ? 'Cmd+Shift+M' : 'Ctrl+Shift+M';

    const toggleDebug = (): void => {
      debugMuted = !debugMuted;
      console.log(`[Debug] Mute: ${debugMuted}`);
      aggregator.setSourceState('waveLink', {
        type: 'connected',
        name: 'Debug',
        muted: debugMuted,
      });
      trayManager.updateSourceState(aggregator.getSources());
    };

    globalShortcut.register(accelerator, toggleDebug);
  }
});

app.on('window-all-closed', (e: Event) => {
  e.preventDefault();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  waveLinkClient?.destroy();
  obsClient?.destroy();
  overlayManager.destroy();
  trayManager.destroy();
});
